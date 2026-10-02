const ROAD_CLASSES = new Set(["motorway", "trunk", "primary", "secondary"]);
const TRAIL_CLASSES = new Set(["path","track"]);
const RAIL_CLASSES = new Set(["rail","transit"]);
const RAIL_SUBCLASSES = new Set(["rail","narrow_gauge","preserved","funicular","subway","light_rail","monorail","tram"]);
const WATERWAY_CLASSES = new Set(["river", "canal"]);
const PLACE_CLASSES = new Set(["city", "town", "village"]);
const WATER_CLASSES = new Set(["ocean", "lake", "river", "dock"]);

export function transportationKind(props={}){
  const cls=String(props.class||""),subclass=String(props.subclass||"");
  if(ROAD_CLASSES.has(cls))return "road";
  if(TRAIL_CLASSES.has(cls))return "trail";
  if(RAIL_CLASSES.has(cls)||RAIL_SUBCLASSES.has(subclass))return "railway";
  return null;
}

export function buildingPrintHeight(props={}){
  const raw=Number(props.render_height ?? props.renderHeight ?? 0);
  return Math.max(3,Math.min(80,Number.isFinite(raw)&&raw>0?raw:3));
}

function readVarint(bytes, state, end = bytes.length) {
  let value = 0;
  let shift = 0;
  while (state.offset < end) {
    const byte = bytes[state.offset++];
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return value;
    shift += 7;
    if (shift > 53) throw new Error("MVT varint exceeds JavaScript's safe integer range.");
  }
  throw new Error("Unexpected end of MVT varint.");
}

function skipField(bytes, state, wireType, end) {
  if (wireType === 0) { readVarint(bytes, state, end); return; }
  if (wireType === 1) { state.offset += 8; return; }
  if (wireType === 2) { state.offset += readVarint(bytes, state, end); return; }
  if (wireType === 5) { state.offset += 4; return; }
  throw new Error(`Unsupported MVT wire type ${wireType}.`);
}

function readMessageFields(bytes, start, end, visitor) {
  const state = { offset: start };
  while (state.offset < end) {
    const tag = readVarint(bytes, state, end);
    const field = Math.floor(tag / 8);
    const wireType = tag & 7;
    if (wireType === 0) {
      const value = readVarint(bytes, state, end);
      visitor(field, wireType, null, null, bytes, value);
    } else if (wireType === 1) {
      const valueStart = state.offset;
      state.offset += 8;
      if (state.offset > end) throw new Error("MVT fixed64 field exceeds message boundary.");
      visitor(field, wireType, valueStart, state.offset, bytes, null);
    } else if (wireType === 2) {
      const length = readVarint(bytes, state, end);
      const valueStart = state.offset;
      const valueEnd = valueStart + length;
      if (valueEnd > end) throw new Error("MVT length-delimited field exceeds message boundary.");
      state.offset = valueEnd;
      visitor(field, wireType, valueStart, valueEnd, bytes, null);
    } else if (wireType === 5) {
      const valueStart = state.offset;
      state.offset += 4;
      if (state.offset > end) throw new Error("MVT fixed32 field exceeds message boundary.");
      visitor(field, wireType, valueStart, state.offset, bytes, null);
    } else {
      skipField(bytes, state, wireType, end);
    }
  }
}

function decodeString(bytes, start, end) {
  return new TextDecoder().decode(bytes.subarray(start, end));
}

function decodeValue(bytes, start, end) {
  let value = null;
  readMessageFields(bytes, start, end, (field, wire, fieldStart, fieldEnd, _bytes, scalar) => {
    if (field === 1 && wire === 2) { value = decodeString(bytes, fieldStart, fieldEnd); return false; }
    if (field === 2 && wire === 5) { value = new DataView(bytes.buffer, bytes.byteOffset + fieldStart, 4).getFloat32(0, true); return false; }
    if (field === 3 && wire === 1) { value = new DataView(bytes.buffer, bytes.byteOffset + fieldStart, 8).getFloat64(0, true); return false; }
    if ((field === 4 || field === 5 || field === 7) && wire === 0) {
      value = field === 7 ? Boolean(scalar) : scalar;
      return false;
    }
    if (field === 6 && wire === 0) {
      value = (scalar & 1) ? -(Math.floor(scalar / 2) + 1) : Math.floor(scalar / 2);
      return false;
    }
    return false;
  });
  return value;
}

function decodePackedVarints(bytes, start, end) {
  const values = [];
  const state = { offset: start };
  while (state.offset < end) values.push(readVarint(bytes, state, end));
  return values;
}

function zigZag(value) {
  return value % 2 ? -(Math.floor(value / 2) + 1) : Math.floor(value / 2);
}

function decodeGeometry(values, geometryType) {
  const parts = [];
  let current = null;
  let x = 0;
  let y = 0;
  let index = 0;
  while (index < values.length) {
    const commandInteger = values[index++];
    const command = commandInteger & 7;
    const count = Math.floor(commandInteger / 8);
    if (command === 1 || command === 2) {
      for (let n = 0; n < count; n++) {
        if (index + 1 >= values.length) throw new Error("Malformed MVT geometry command.");
        x += zigZag(values[index++]);
        y += zigZag(values[index++]);
        if (command === 1 || !current) {
          current = [];
          parts.push(current);
        }
        current.push({ x, y });
        if (geometryType === 1) current = null;
      }
    } else if (command === 7) {
      if (current?.length) {
        const first = current[0];
        const last = current[current.length - 1];
        if (last.x !== first.x || last.y !== first.y) current.push({ ...first });
      }
    } else {
      throw new Error(`Unsupported MVT geometry command ${command}.`);
    }
  }
  return parts;
}

function decodeFeature(bytes, start, end, keys, values) {
  let type = 0;
  let tags = [];
  let geometry = [];
  readMessageFields(bytes, start, end, (field, wire, fieldStart, fieldEnd, _bytes, scalar) => {
    if (field === 2 && wire === 2) { tags = decodePackedVarints(bytes, fieldStart, fieldEnd); return false; }
    if (field === 3 && wire === 0) {
      type = scalar;
      return false;
    }
    if (field === 4 && wire === 2) { geometry = decodePackedVarints(bytes, fieldStart, fieldEnd); return false; }
    return false;
  });
  const properties = {};
  for (let i = 0; i + 1 < tags.length; i += 2) {
    const key = keys[tags[i]];
    if (key !== undefined) properties[key] = values[tags[i + 1]];
  }
  return { type, properties, geometry: decodeGeometry(geometry, type) };
}

function decodeLayer(bytes, start, end) {
  let name = "";
  let extent = 4096;
  const featureRanges = [];
  const keys = [];
  const values = [];
  readMessageFields(bytes, start, end, (field, wire, fieldStart, fieldEnd, _bytes, scalar) => {
    if (field === 1 && wire === 2) { name = decodeString(bytes, fieldStart, fieldEnd); return false; }
    if (field === 2 && wire === 2) { featureRanges.push([fieldStart, fieldEnd]); return false; }
    if (field === 3 && wire === 2) { keys.push(decodeString(bytes, fieldStart, fieldEnd)); return false; }
    if (field === 4 && wire === 2) { values.push(decodeValue(bytes, fieldStart, fieldEnd)); return false; }
    if (field === 5 && wire === 0) {
      extent = scalar;
      return false;
    }
    return false;
  });
  return { name, extent, features: featureRanges.map(([featureStart, featureEnd]) => decodeFeature(bytes, featureStart, featureEnd, keys, values)) };
}

function tilePointToLonLat(point, tile) {
  const n = 2 ** tile.z;
  const worldX = tile.x + point.x / tile.extent;
  const worldY = tile.y + point.y / tile.extent;
  const lon = worldX / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * worldY / n))) * 180 / Math.PI;
  return { lon, lat };
}

function convertParts(parts, tile, extent) {
  const context = { ...tile, extent };
  return parts.map(part => part.map(point => tilePointToLonLat(point, context)));
}

function featureBounds(rings) {
  const bounds = { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const ring of rings) for (const point of ring) {
    bounds.minLon = Math.min(bounds.minLon, point.lon);
    bounds.maxLon = Math.max(bounds.maxLon, point.lon);
    bounds.minLat = Math.min(bounds.minLat, point.lat);
    bounds.maxLat = Math.max(bounds.maxLat, point.lat);
  }
  return bounds;
}

export function decodeCartographyTile(buffer, tile) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const layers = [];
  readMessageFields(bytes, 0, bytes.length, (field, wire, start, end) => {
    if (field === 3 && wire === 2) { layers.push(decodeLayer(bytes, start, end)); return false; }
    return false;
  });
  const result = { roads: [], trails: [], railways: [], buildings: [], waterways: [], boundaries: [], countryBoundaries: [], places: [], waterPolygons: [] };
  for (const layer of layers) {
    for (const feature of layer.features) {
      const props = feature.properties || {};
      const parts = convertParts(feature.geometry, tile, layer.extent);
      if (layer.name === "transportation" && feature.type === 2) {
        const kind=transportationKind(props),brunnel=String(props.brunnel||""),subclass=String(props.subclass||"");
        if(kind==="road"){
          for (const points of parts) if (points.length > 1) result.roads.push({ class: String(props.class || "road"), subclass, brunnel, points });
        }else if(kind==="trail"){
          for (const points of parts) if (points.length > 1) result.trails.push({ class: String(props.class || "path"), subclass, brunnel, surface:String(props.surface||""), bicycle:String(props.bicycle||""), foot:String(props.foot||""), points });
        }else if(kind==="railway"){
          for (const points of parts) if (points.length > 1) result.railways.push({ class: String(props.class || "rail"), subclass, brunnel, service:String(props.service||""), points });
        }
      } else if (layer.name === "building" && feature.type === 3 && String(props.hide_3d ?? "0") !== "1" && props.hide_3d !== true) {
        const rings=parts.filter(part=>part.length>=4);
        if(rings.length)result.buildings.push({renderHeight:buildingPrintHeight(props),renderMinHeight:Math.max(0,Number(props.render_min_height??0)||0),colour:String(props.colour||""),rings,bounds:featureBounds(rings)});
      } else if (layer.name === "waterway" && feature.type === 2 && WATERWAY_CLASSES.has(String(props.class || ""))) {
        for (const points of parts) if (points.length > 1) result.waterways.push({ class: String(props.class || "river"), name: String(props.name || ""), points });
      } else if (layer.name === "boundary" && feature.type === 2) {
        const level = Number(props.admin_level ?? props.adminLevel ?? 99);
        const maritime = String(props.maritime ?? "0") === "1";
        const adm0Left = String(props.adm0_l || "");
        const adm0Right = String(props.adm0_r || "");
        for (const points of parts) if (points.length > 1) {
          if (level === 2) result.countryBoundaries.push({ adminLevel: level, adm0Left, adm0Right, maritime, disputed: String(props.disputed ?? "0") === "1", points });
          else if (level === 4) result.boundaries.push({ adminLevel: level, points });
        }
      } else if (layer.name === "place" && feature.type === 1 && PLACE_CLASSES.has(String(props.class || ""))) {
        const first = parts[0]?.[0];
        if (first) result.places.push({ class: String(props.class), name: String(props.name || props.name_en || ""), rank: Number(props.rank || 99), ...first });
      } else if (layer.name === "water" && feature.type === 3 && WATER_CLASSES.has(String(props.class || ""))) {
        const rings = parts.filter(part => part.length >= 4);
        if (rings.length) result.waterPolygons.push({ class: String(props.class || "water"), rings, bounds: featureBounds(rings) });
      }
    }
  }
  return result;
}

export function projectLonLat(point, bounds, size = 1.45) {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const midLon = (bounds.minLon + bounds.maxLon) / 2;
  const lonScale = Math.cos(midLat * Math.PI / 180);
  const width = Math.max(0.000001, (bounds.maxLon - bounds.minLon) * lonScale);
  const height = Math.max(0.000001, bounds.maxLat - bounds.minLat);
  const extent = Math.max(width, height);
  return {
    x: ((point.lon - midLon) * lonScale / extent) * size,
    y: ((point.lat - midLat) / extent) * size
  };
}

function pointInsideBounds(point, bounds) {
  return point.lon >= bounds.minLon && point.lon <= bounds.maxLon && point.lat >= bounds.minLat && point.lat <= bounds.maxLat;
}

function clipSegmentToBounds(a, b, bounds) {
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  let t0 = 0;
  let t1 = 1;
  const checks = [
    [-dx, a.lon - bounds.minLon],
    [ dx, bounds.maxLon - a.lon],
    [-dy, a.lat - bounds.minLat],
    [ dy, bounds.maxLat - a.lat]
  ];
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [
    { lon: a.lon + t0 * dx, lat: a.lat + t0 * dy },
    { lon: a.lon + t1 * dx, lat: a.lat + t1 * dy }
  ];
}

function sameLonLat(a, b) {
  return Math.abs(a.lon - b.lon) < 1e-10 && Math.abs(a.lat - b.lat) < 1e-10;
}

export function clipLineToBounds(points, bounds) {
  if (!Array.isArray(points) || points.length < 2) return [];
  const parts = [];
  let current = [];
  for (let i = 1; i < points.length; i++) {
    const clipped = clipSegmentToBounds(points[i - 1], points[i], bounds);
    if (!clipped) {
      if (current.length > 1) parts.push(current);
      current = [];
      continue;
    }
    const [start, end] = clipped;
    if (!current.length) current = [start, end];
    else if (sameLonLat(current[current.length - 1], start)) current.push(end);
    else {
      if (current.length > 1) parts.push(current);
      current = [start, end];
    }
  }
  if (current.length > 1) parts.push(current);
  return parts;
}

function perpendicularDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

export function simplifyLine(points, tolerance = 0.003) {
  if (points.length <= 2) return points.slice();
  let maxDistance = 0;
  let index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) { maxDistance = distance; index = i; }
  }
  if (maxDistance <= tolerance || index < 0) return [points[0], points[points.length - 1]];
  const left = simplifyLine(points.slice(0, index + 1), tolerance);
  const right = simplifyLine(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (((a.lat > lat) !== (b.lat > lat)) && (lon < (b.lon - a.lon) * (lat - a.lat) / ((b.lat - a.lat) || 1e-12) + a.lon)) inside = !inside;
  }
  return inside;
}

export function isPointInWater(lon, lat, waterPolygons) {
  for (const polygon of waterPolygons || []) {
    const b = polygon.bounds;
    if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;
    let inside = false;
    for (const ring of polygon.rings) if (pointInRing(lon, lat, ring)) inside = !inside;
    if (inside) return true;
  }
  return false;
}

export function selectPlacesSpatially(places, bounds, maxPlaces = 48, grid = {}) {
  const columns = Math.max(1, Number(grid.columns ?? 6));
  const rows = Math.max(1, Number(grid.rows ?? 4));
  const classPriority = { city: 0, town: 1, village: 2 };
  const buckets = new Map();
  const width = Math.max(1e-9, bounds.maxLon - bounds.minLon);
  const height = Math.max(1e-9, bounds.maxLat - bounds.minLat);
  for (const place of places || []) {
    const nx = Math.max(0, Math.min(0.999999, (place.lon - bounds.minLon) / width));
    const ny = Math.max(0, Math.min(0.999999, (place.lat - bounds.minLat) / height));
    const key = `${Math.floor(nx * columns)}:${Math.floor(ny * rows)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(place);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => ((classPriority[a.class] ?? 9) - (classPriority[b.class] ?? 9)) || (a.rank ?? 99) - (b.rank ?? 99) || a.name.localeCompare(b.name));
  }
  const orderedBuckets = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, items]) => items);
  const selected = [];
  let depth = 0;
  while (selected.length < maxPlaces) {
    let added = false;
    for (const bucket of orderedBuckets) {
      if (bucket[depth]) {
        selected.push(bucket[depth]);
        added = true;
        if (selected.length >= maxPlaces) break;
      }
    }
    if (!added) break;
    depth += 1;
  }
  return selected;
}

export function selectScreenPlacesSpatially(places,maxPlaces=72,grid={}){
  const columns=Math.max(1,Number(grid.columns??8));
  const rows=Math.max(1,Number(grid.rows??6));
  const width=Math.max(1,Number(grid.width??1000));
  const height=Math.max(1,Number(grid.height??800));
  const classPriority={city:0,town:1,village:2};
  const buckets=new Map();
  for(const place of places||[]){
    if(!Number.isFinite(place.screenX)||!Number.isFinite(place.screenY))continue;
    const nx=Math.max(0,Math.min(.999999,place.screenX/width));
    const ny=Math.max(0,Math.min(.999999,place.screenY/height));
    const key=`${Math.floor(nx*columns)}:${Math.floor(ny*rows)}`;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(place);
  }
  for(const bucket of buckets.values()){
    bucket.sort((a,b)=>((classPriority[a.class]??9)-(classPriority[b.class]??9))||(a.rank??99)-(b.rank??99)||String(a.name||"").localeCompare(String(b.name||"")));
  }
  const ordered=[...buckets.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,items])=>items);
  const selected=[];
  for(let depth=0;selected.length<maxPlaces;depth++){
    let added=false;
    for(const bucket of ordered){
      if(bucket[depth]){selected.push(bucket[depth]);added=true;if(selected.length>=maxPlaces)break;}
    }
    if(!added)break;
  }
  return selected;
}

function roadFeatureLength(feature) {
  return feature.points.reduce((sum, point, index) => index ? sum + Math.hypot(point.x - feature.points[index - 1].x, point.y - feature.points[index - 1].y) : 0, 0);
}

export function selectRoadsSpatially(roads, maxRoads = 2200, grid = {}) {
  const columns = Math.max(1, Number(grid.columns ?? 8));
  const rows = Math.max(1, Number(grid.rows ?? 5));
  const extent = Math.max(0.01, Number(grid.extent ?? 1.45));
  const roadPriority = { motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4 };
  const buckets = new Map();
  for (const road of roads || []) {
    if (!road?.points?.length) continue;
    const midpoint = road.points[Math.floor(road.points.length / 2)];
    const nx = Math.max(0, Math.min(0.999999, (midpoint.x + extent) / (extent * 2)));
    const ny = Math.max(0, Math.min(0.999999, (midpoint.y + extent) / (extent * 2)));
    const key = `${Math.floor(nx * columns)}:${Math.floor(ny * rows)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(road);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => (roadPriority[a.class] ?? 9) - (roadPriority[b.class] ?? 9) || roadFeatureLength(b) - roadFeatureLength(a));
  }
  const orderedBuckets = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, items]) => items);
  const selected = [];
  let depth = 0;
  while (selected.length < maxRoads) {
    let added = false;
    for (const bucket of orderedBuckets) {
      if (bucket[depth]) {
        selected.push(bucket[depth]);
        added = true;
        if (selected.length >= maxRoads) break;
      }
    }
    if (!added) break;
    depth += 1;
  }
  return selected;
}

function projectAndSimplifySegments(feature, bounds, tolerance, size = 1.45) {
  return clipLineToBounds(feature.points, bounds)
    .map(points => ({ ...feature, points: simplifyLine(points.map(point => projectLonLat(point, bounds, size)), tolerance) }))
    .filter(item => item.points.length > 1);
}

export function compileCartography(tiles, bounds, options = {}) {
  const tolerance = Number(options.tolerance ?? 0.004);
  const projectionSize = Number(options.projectionSize ?? 1.45);
  const combined = { roads: [], trails: [], railways: [], buildings: [], waterways: [], boundaries: [], countryBoundaries: [], places: [], waterPolygons: [] };
  for (const tile of tiles) {
    combined.roads.push(...(tile.roads||[]));
    combined.trails.push(...(tile.trails||[]));
    combined.railways.push(...(tile.railways||[]));
    combined.buildings.push(...(tile.buildings||[]));
    combined.waterways.push(...(tile.waterways||[]));
    combined.boundaries.push(...(tile.boundaries||[]));
    combined.countryBoundaries.push(...(tile.countryBoundaries || []));
    combined.places.push(...(tile.places||[]));
    combined.waterPolygons.push(...(tile.waterPolygons||[]));
  }
  const maxRoads = Math.max(1, Number(options.maxRoads ?? 1200));
  const maxTrails = Math.max(0, Number(options.maxTrails ?? 500));
  const maxRailways = Math.max(0, Number(options.maxRailways ?? 400));
  const maxBuildings = Math.max(0, Number(options.maxBuildings ?? 450));
  const projectedRoads = combined.roads.filter(feature=>feature.brunnel!=="tunnel"&&ROAD_CLASSES.has(String(feature.class||""))).flatMap(feature => projectAndSimplifySegments(feature, bounds, tolerance, projectionSize));
  const roads = selectRoadsSpatially(projectedRoads, maxRoads, { ...(options.roadGrid || {}), extent: projectionSize });
  const trails = combined.trails.filter(feature=>feature.brunnel!=="tunnel").flatMap(feature=>projectAndSimplifySegments(feature,bounds,tolerance*.8,projectionSize)).slice(0,maxTrails);
  const railways = combined.railways.filter(feature=>feature.brunnel!=="tunnel").flatMap(feature=>projectAndSimplifySegments(feature,bounds,tolerance*.8,projectionSize)).slice(0,maxRailways);
  const buildings=combined.buildings
    .filter(feature=>feature.bounds&&!(feature.bounds.maxLon<bounds.minLon||feature.bounds.minLon>bounds.maxLon||feature.bounds.maxLat<bounds.minLat||feature.bounds.minLat>bounds.maxLat))
    .slice(0,maxBuildings)
    .map(feature=>({...feature,rings:feature.rings.map(ring=>simplifyLine(ring.map(point=>projectLonLat(point,bounds,projectionSize)),tolerance*.45)).filter(ring=>ring.length>=3)}))
    .filter(feature=>feature.rings.length);
  const waterways = combined.waterways.flatMap(feature => projectAndSimplifySegments(feature, bounds, tolerance, projectionSize));
  const boundaries = combined.boundaries.flatMap(feature => projectAndSimplifySegments(feature, bounds, tolerance * 1.4, projectionSize));
  const targetCountry = String(options.country || "").toLowerCase();
  const countryBoundaries = combined.countryBoundaries
    .filter(feature => !feature.maritime && (!targetCountry || feature.adm0Left.toLowerCase() === targetCountry || feature.adm0Right.toLowerCase() === targetCountry))
    .flatMap(feature => projectAndSimplifySegments(feature, bounds, tolerance * 0.7, projectionSize));
  const placeByName = new Map();
  const classPriority = { city: 0, town: 1, village: 2 };
  for (const place of combined.places) {
    if (!place.name || !pointInsideBounds(place, bounds)) continue;
    const key = place.name.trim().toLowerCase();
    const previous = placeByName.get(key);
    const score = (classPriority[place.class] ?? 9) * 100 + (Number.isFinite(place.rank) ? place.rank : 99);
    const previousScore = previous ? (classPriority[previous.class] ?? 9) * 100 + (Number.isFinite(previous.rank) ? previous.rank : 99) : Infinity;
    if (score < previousScore) placeByName.set(key, place);
  }
  const maxPlaces = Number(options.maxPlaces ?? 48);
  const places = selectPlacesSpatially([...placeByName.values()], bounds, maxPlaces, options.placeGrid)
    .map(place => ({ ...place, ...projectLonLat(place, bounds, projectionSize) }));
  return {
    roads,trails,railways,buildings,
    waterways,
    boundaries,
    countryBoundaries,
    places,
    waterPolygons: combined.waterPolygons,
    stats: { roads: roads.length, trails:trails.length, railways:railways.length, buildings:buildings.length, waterways: waterways.length, boundaries: boundaries.length, countryBoundaries: countryBoundaries.length, places: places.length, waterPolygons: combined.waterPolygons.length }
  };
}
