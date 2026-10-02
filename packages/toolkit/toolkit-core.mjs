import { parseGpxText, extractGpxName, serializeGpxRoute, shouldPreprocessLiveGpx, processGpxTextJob } from "../gpx/gpx-core.mjs";
export { parseGpxText, extractGpxName, serializeGpxRoute, shouldPreprocessLiveGpx, processGpxTextJob } from "../gpx/gpx-core.mjs";
import {
  adaptiveLargeFormatPlan,
  classifyTerrainWorkload,
  loadGeoTiffArrayBuffer,
  reconcileGpxElevations
} from "../engine/pro-dem-core.mjs";
import {
  decodeCartographyTile,
  compileCartography,
  projectLonLat
} from "../engine/vector-map-core.mjs";
import {
  buildRadialMedalMesh,
  buildRectangularHeightfieldMesh,
  buildExtrudedPolygonMesh,
  buildDovetailKeyMesh,
  buildCylinderMesh,
  buildAnnulusMesh,
  buildDisplayStandMesh,
  buildPrintValidationCoupon,
  mergeMeshes,
  encodeObj,
  encodeMtl,
  encodeGlb,
  encode3mf,
  encodeBinaryStl,
  encodeArtifactZip,
  meshEdgeUse
} from "../engine/print-model-core.mjs";
import {
  parseArcAsciiGrid,
  sampleArcAsciiGrid,
  planTiledMap,
  pointInsideShape,
  shapeBoundaryRadius,
  magnetPocketDepth,
  dovetailSlotDepth,
  alignmentSocketDepth
} from "../engine/fabrication-extras-core.mjs";
import {
  projectGeographicOutline,
  insidePolygons,
  maskPolygons,
  findEmptyLogoPlacement
} from "../engine/map-outline-core.mjs";

export const ADVANCED_GROUPS=Object.freeze([
  {id:"dem",label:"DEM & elevation",defaultOpen:false},
  {id:"map",label:"Map layers",defaultOpen:false},
  {id:"shape",label:"Shape & branding",defaultOpen:false},
  {id:"fabrication",label:"Fabrication",defaultOpen:false},
  {id:"export",label:"Export & validation",defaultOpen:false}
]);

export const PRODUCTION_FORMATS=Object.freeze(["3mf","stl","obj","glb"]);


export function normalizeCustomization(input={}){
  return {
    event:String(input.event||"").trim().replace(/\s+/g," "),
    name:String(input.name||input.rider||"").trim().replace(/\s+/g," "),
    date:String(input.date||"").trim().replace(/\s+/g," "),
    distance:String(input.distance||"").trim().replace(/\s+/g," "),
    elevation:String(input.elevation||"").trim().replace(/\s+/g," "),
    duration:String(input.duration||"").trim().replace(/\s+/g," ")
  };
}

export function productionDisplayTitle(routeTitle="",customization={}){
  const meta=normalizeCustomization(customization),parts=[];
  const add=value=>{
    const clean=String(value||"").trim();
    if(!clean)return;
    if(parts.some(part=>part.toLocaleLowerCase()===clean.toLocaleLowerCase()))return;
    parts.push(clean);
  };
  add(meta.event||routeTitle);
  add(meta.name);
  add(meta.date);
  if(!parts.length)add(routeTitle||"TrailRelief");
  return parts.join(" · ");
}

export function defaultAdvancedConfig(){
  return {
    dem:{source:"terrarium",fillNoData:true,smoothingRadius:0,crsOverride:"",routeElevationMode:"dem",routeElevationBlend:.5,maxDeltaM:150},
    map:{roads:true,trails:true,railways:true,buildings:false},
    shape:{kind:"route-fit",aspect:1.35,outlineGeometry:null,logoEnabled:false,logoAuto:true,logoWidthMm:18,logoRiseMm:.8},
    colors:{land:"#b7a77a",forest:"#3f6b3a",mountain:"#8b8378",snow:"#f4f7f8",water:"#2f86a6",terrain:"#b7a77a",route:"#ff6a1f",roads:"#c9c1b5",trails:"#3f6b3a",railways:"#7e8791",buildings:"#d8d1c4",logo:"#f2c14e",text:"#f2c14e"},
    terrainBands:{mountainM:1200,snowM:2600},
    customization:{event:"",name:"",date:"",distance:"",elevation:"",duration:""},
    fabrication:{
      modelWidthMm:180,baseMm:3,reliefMm:8,targetXyMm:1,
      routeWidthMm:1.6,routeRiseMm:1.2,
      tiled:false,maxTileMm:200,jointType:"dovetail",
      magnetEnabled:false,magnetDiameterMm:8,magnetDepthMm:2,
      hangerEnabled:false,standEnabled:false
    }
  };
}

function deepMerge(base,patch){
  if(!patch||typeof patch!=="object")return base;
  const out={...base};
  for(const [key,value] of Object.entries(patch)){
    if(value&&typeof value==="object"&&!Array.isArray(value)&&base[key]&&typeof base[key]==="object"&&!Array.isArray(base[key]))out[key]=deepMerge(base[key],value);
    else out[key]=value;
  }
  return out;
}

export function normalizeAdvancedConfig(config={}){
  return deepMerge(defaultAdvancedConfig(),config);
}

export function reconcileRouteElevations(points,demSampler,options={}){
  return reconcileGpxElevations(points,demSampler,options);
}

export function planLargeFormat(options={}){
  return adaptiveLargeFormatPlan(options);
}

export function validateMesh(mesh){
  const edges=meshEdgeUse(mesh);
  return {...edges,watertight:edges.boundaryEdges===0&&edges.nonManifoldEdges===0};
}

export function routeBounds(points=[]){
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
  for(const point of points){
    if(!Number.isFinite(point?.lat)||!Number.isFinite(point?.lon))continue;
    minLat=Math.min(minLat,point.lat);maxLat=Math.max(maxLat,point.lat);
    minLon=Math.min(minLon,point.lon);maxLon=Math.max(maxLon,point.lon);
  }
  if(!Number.isFinite(minLat))throw new Error("Route has no valid coordinates.");
  return {minLat,maxLat,minLon,maxLon};
}

export function expandBounds(bounds,margin=.06){
  const latSpan=Math.max(1e-4,bounds.maxLat-bounds.minLat),lonSpan=Math.max(1e-4,bounds.maxLon-bounds.minLon);
  return {
    minLat:Math.max(-85,bounds.minLat-latSpan*margin),
    maxLat:Math.min(85,bounds.maxLat+latSpan*margin),
    minLon:Math.max(-180,bounds.minLon-lonSpan*margin),
    maxLon:Math.min(180,bounds.maxLon+lonSpan*margin)
  };
}


function geometryBounds(geometry){
  const source=geometry?.type==="Feature"?geometry.geometry:geometry;
  if(!source||!["Polygon","MultiPolygon"].includes(source.type))throw new Error("Geographic shape requires a Polygon or MultiPolygon.");
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity,count=0;
  const walk=value=>{
    if(!Array.isArray(value))return;
    if(value.length>=2&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))){
      const lon=Number(value[0]),lat=Number(value[1]);
      if(Math.abs(lon)<=180&&Math.abs(lat)<=90){
        minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
        minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);count++;
      }
      return;
    }
    for(const child of value)walk(child);
  };
  walk(source.coordinates);
  if(!count)throw new Error("Geographic boundary contains no valid coordinates.");
  return {minLat,maxLat,minLon,maxLon};
}

export function productionBounds(route,shape={}){
  if(shape?.kind==="geographic"&&shape?.outlineGeometry){
    return expandBounds(geometryBounds(shape.outlineGeometry),.015);
  }
  const base=expandBounds(route,shape?.kind==="route-fit" ? .04 : .03);
  if(!shape?.kind||shape.kind==="route-fit")return base;
  const midLat=(base.minLat+base.maxLat)/2,midLon=(base.minLon+base.maxLon)/2;
  const lonScale=Math.max(.08,Math.cos(midLat*Math.PI/180));
  let geoWidth=(base.maxLon-base.minLon)*lonScale,geoHeight=base.maxLat-base.minLat;
  const targetAspect=shape.kind==="ellipse"?Math.max(.5,Math.min(2.5,Number(shape.aspect)||1.35)):1;
  const currentAspect=geoWidth/Math.max(1e-9,geoHeight);
  if(currentAspect>targetAspect)geoHeight=geoWidth/targetAspect;
  else geoWidth=geoHeight*targetAspect;
  const latHalf=geoHeight/2,lonHalf=geoWidth/(2*lonScale);
  return {
    minLat:Math.max(-85,midLat-latHalf),maxLat:Math.min(85,midLat+latHalf),
    minLon:Math.max(-180,midLon-lonHalf),maxLon:Math.min(180,midLon+lonHalf)
  };
}

function opaqueHex(value,fallback){
  const raw=String(value||fallback||"#808080").trim();
  if(/^#[0-9a-f]{8}$/i.test(raw))return raw;
  if(/^#[0-9a-f]{6}$/i.test(raw))return raw+"FF";
  return String(fallback||"#808080")+"FF";
}

export function productionMaterials(config={}){
  const colors={...defaultAdvancedConfig().colors,...(config.colors||{})};
  return [
    {name:"Land",color:opaqueHex(colors.land||colors.terrain,"#b7a77a")},
    {name:"Forest",color:opaqueHex(colors.forest,"#3f6b3a")},
    {name:"Mountain",color:opaqueHex(colors.mountain,"#8b8378")},
    {name:"Snow",color:opaqueHex(colors.snow,"#f4f7f8")},
    {name:"Water",color:opaqueHex(colors.water,"#2f86a6")},
    {name:"Route",color:opaqueHex(colors.route,"#ff6a1f"),emissive:opaqueHex(colors.route,"#ff6a1f")},
    {name:"Roads",color:opaqueHex(colors.roads,"#c9c1b5")},
    {name:"Trails",color:opaqueHex(colors.trails,"#3f6b3a")},
    {name:"Railways",color:opaqueHex(colors.railways,"#7e8791")},
    {name:"Buildings",color:opaqueHex(colors.buildings,"#d8d1c4")},
    {name:"Logo",color:opaqueHex(colors.logo,"#f2c14e")},
    {name:"Text",color:opaqueHex(colors.text,"#f2c14e"),emissive:opaqueHex(colors.text,"#f2c14e")}
  ];
}

function pointInLonLatRing(lat,lon,ring=[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],xi=Number(a?.lon),yi=Number(a?.lat),xj=Number(b?.lon),yj=Number(b?.lat);
    if(![xi,yi,xj,yj].every(Number.isFinite))continue;
    const hit=((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi+1e-12)+xi);
    if(hit)inside=!inside;
  }
  return inside;
}

export function prepareTerrainLandcover(landcover=[],bounds={}){
  const minLat=Number(bounds.minLat),maxLat=Number(bounds.maxLat),minLon=Number(bounds.minLon),maxLon=Number(bounds.maxLon);
  const cols=24,rows=24,cells=new Map(),entries=[];
  const latSpan=Math.max(1e-9,maxLat-minLat),lonSpan=Math.max(1e-9,maxLon-minLon);
  const key=(x,y)=>x+":"+y;
  for(const feature of landcover||[]){
    if(!["water","forest"].includes(feature?.kind))continue;
    for(const path of feature.paths||[]){
      if(!Array.isArray(path)||path.length<3)continue;
      let a=Infinity,b=-Infinity,l=Infinity,r=-Infinity;
      for(const p of path){const lat=Number(p?.lat),lon=Number(p?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;a=Math.min(a,lat);b=Math.max(b,lat);l=Math.min(l,lon);r=Math.max(r,lon);}
      if(!Number.isFinite(a))continue;
      const entry={kind:feature.kind,path,minLat:a,maxLat:b,minLon:l,maxLon:r};entries.push(entry);
      const x0=Math.max(0,Math.min(cols-1,Math.floor((l-minLon)/lonSpan*cols))),x1=Math.max(0,Math.min(cols-1,Math.floor((r-minLon)/lonSpan*cols)));
      const y0=Math.max(0,Math.min(rows-1,Math.floor((a-minLat)/latSpan*rows))),y1=Math.max(0,Math.min(rows-1,Math.floor((b-minLat)/latSpan*rows)));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=key(x,y);if(!cells.has(k))cells.set(k,[]);cells.get(k).push(entry);}
    }
  }
  return {
    entries,
    query(lat,lon){
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(minLat))return entries;
      const x=Math.max(0,Math.min(cols-1,Math.floor((lon-minLon)/lonSpan*cols))),y=Math.max(0,Math.min(rows-1,Math.floor((lat-minLat)/latSpan*rows)));
      return cells.get(key(x,y))||[];
    }
  };
}

export function classifyTerrainMaterial(sample={},thresholds={},landcover=[]){
  const lat=Number(sample.lat),lon=Number(sample.lon),elevation=Number(sample.elevation);
  if(Number.isFinite(lat)&&Number.isFinite(lon)){
    const candidates=typeof landcover?.query==="function"?landcover.query(lat,lon):null;
    if(candidates){
      for(const entry of candidates){
        if(entry.kind!=="water"||lat<entry.minLat||lat>entry.maxLat||lon<entry.minLon||lon>entry.maxLon)continue;
        if(pointInLonLatRing(lat,lon,entry.path))return 4;
      }
      for(const entry of candidates){
        if(entry.kind!=="forest"||lat<entry.minLat||lat>entry.maxLat||lon<entry.minLon||lon>entry.maxLon)continue;
        if(pointInLonLatRing(lat,lon,entry.path))return 1;
      }
    }else{
      for(const feature of landcover||[]){
        if(feature?.kind!=="water")continue;
        if((feature.paths||[]).some(path=>path.length>2&&pointInLonLatRing(lat,lon,path)))return 4;
      }
      for(const feature of landcover||[]){
        if(feature?.kind!=="forest")continue;
        if((feature.paths||[]).some(path=>path.length>2&&pointInLonLatRing(lat,lon,path)))return 1;
      }
    }
  }
  const mountainM=Number.isFinite(Number(thresholds.mountainM))?Number(thresholds.mountainM):1200;
  const snowM=Math.max(mountainM,Number.isFinite(Number(thresholds.snowM))?Number(thresholds.snowM):2600);
  if(Number.isFinite(elevation)&&elevation>=snowM)return 3;
  if(Number.isFinite(elevation)&&elevation>=mountainM)return 2;
  return 0;
}

export function buildRouteElevationCorrection(points,demSampler,projection,range,options={}){
  const mode=["dem","gpx","blend"].includes(options.mode)?options.mode:"dem";
  const reconciliation=reconcileGpxElevations(points,demSampler,{
    mode,
    blend:Number.isFinite(Number(options.blend))?Number(options.blend):.5,
    maxDeltaM:Number.isFinite(Number(options.maxDeltaM))?Number(options.maxDeltaM):150
  });
  const zero={at:()=>0,diagnostics:reconciliation.diagnostics};
  if(mode==="dem"||!projection||!range||!Number.isFinite(range.min)||!Number.isFinite(range.max)||range.max<=range.min)return zero;
  const reliefMm=Math.max(.1,Number(options.reliefMm)||8),routeWidthMm=Math.max(.2,Number(options.routeWidthMm)||1.6);
  const mmPerMeter=reliefMm/Math.max(1,range.max-range.min),maxCorrection=Math.max(.1,reliefMm*.35),corridor=Math.max(routeWidthMm*1.8,1.2);
  const source=reconciliation.points||[],stride=Math.max(1,Math.ceil(source.length/4000)),samples=[];
  for(let i=0;i<source.length;i+=stride){
    const point=source[i],dem=Number(point.demEle),target=Number(point.reconciledEle);
    if(!Number.isFinite(dem)||!Number.isFinite(target))continue;
    const projected=projection.project(point);
    if(!Number.isFinite(projected?.x)||!Number.isFinite(projected?.y))continue;
    const correction=Math.max(-maxCorrection,Math.min(maxCorrection,(target-dem)*mmPerMeter));
    if(Math.abs(correction)>1e-6)samples.push({x:projected.x,y:projected.y,correction});
  }
  if(!samples.length)return zero;
  const bucketSize=Math.max(corridor,2),buckets=new Map(),key=(x,y)=>Math.floor(x/bucketSize)+":"+Math.floor(y/bucketSize);
  for(const sample of samples){const k=key(sample.x,sample.y);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(sample);}
  const at=(x,y)=>{
    const bx=Math.floor(x/bucketSize),by=Math.floor(y/bucketSize),reach=Math.max(1,Math.ceil(corridor/bucketSize));
    let best=null,bestD=Infinity;
    for(let dy=-reach;dy<=reach;dy++)for(let dx=-reach;dx<=reach;dx++){
      const list=buckets.get((bx+dx)+":"+(by+dy));if(!list)continue;
      for(const sample of list){
        const d=Math.hypot(x-sample.x,y-sample.y);
        if(d<bestD){bestD=d;best=sample;}
      }
    }
    if(!best||bestD>corridor)return 0;
    return best.correction*(1-bestD/corridor);
  };
  return {at,diagnostics:reconciliation.diagnostics};
}

function longitudeToTileX(lon,zoom){return Math.floor((lon+180)/360*2**zoom)}
function latitudeToTileY(lat,zoom){
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat)),r=clamped*Math.PI/180;
  return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**zoom);
}
function tileFloatX(lon,zoom){return (lon+180)/360*2**zoom}
function tileFloatY(lat,zoom){
  const clamped=Math.max(-85.05112878,Math.min(85.05112878,lat)),r=clamped*Math.PI/180;
  return (1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*2**zoom;
}
function tilePlan(bounds,preferredZoom=9,budget=40,minZoom=4){
  let zoom=preferredZoom,range;
  do{
    const minX=longitudeToTileX(bounds.minLon,zoom),maxX=longitudeToTileX(bounds.maxLon,zoom);
    const minY=latitudeToTileY(bounds.maxLat,zoom),maxY=latitudeToTileY(bounds.minLat,zoom);
    range={minX,maxX,minY,maxY,tileCount:(maxX-minX+1)*(maxY-minY+1)};
    if(range.tileCount<=budget||zoom<=minZoom)break;
    zoom--;
  }while(true);
  if(range.tileCount>budget)throw new Error("Selected route is too large for one detailed map request; enable tiling or reduce the print area.");
  return {zoom,...range};
}

export async function loadOpenFreeMapCartography(bounds,options={}){
  if(typeof fetch!=="function")throw new Error("Map loading requires a browser.");
  const styleUrl=options.styleUrl||"https://tiles.openfreemap.org/styles/liberty";
  const styleResponse=await fetch(styleUrl);
  if(!styleResponse.ok)throw new Error("OpenFreeMap style could not be loaded.");
  const style=await styleResponse.json();
  const source=Object.values(style.sources||{}).find(item=>item&&item.type==="vector");
  if(!source)throw new Error("OpenFreeMap vector source was not found.");
  let templates=Array.isArray(source.tiles)?source.tiles.slice():[];
  if(!templates.length&&source.url){
    const tileJsonUrl=new URL(source.url,styleUrl).href;
    const response=await fetch(tileJsonUrl);
    if(!response.ok)throw new Error("OpenFreeMap TileJSON could not be loaded.");
    const tileJson=await response.json();
    templates=Array.isArray(tileJson.tiles)?tileJson.tiles:[];
  }
  if(!templates.length)throw new Error("OpenFreeMap did not provide a vector tile template.");
  const plan=tilePlan(bounds,options.preferredZoom||9,options.tileBudget||40,4),decoded=[];
  const template=templates[0],jobs=[];
  for(let y=plan.minY;y<=plan.maxY;y++)for(let x=plan.minX;x<=plan.maxX;x++)jobs.push({x,y});
  for(let start=0;start<jobs.length;start+=10){
    const batch=await Promise.all(jobs.slice(start,start+10).map(async tile=>{
      const url=template.replace("{z}",String(plan.zoom)).replace("{x}",String(tile.x)).replace("{y}",String(tile.y));
      const response=await fetch(url);
      if(!response.ok)throw new Error("Vector tile "+tile.x+"/"+tile.y+" failed.");
      return decodeCartographyTile(await response.arrayBuffer(),{z:plan.zoom,x:tile.x,y:tile.y});
    }));
    decoded.push(...batch);
  }
  const compiled=compileCartography(decoded,bounds,{
    tolerance:options.tolerance??.004,
    projectionSize:2,
    maxPlaces:80,maxRoads:700,maxTrails:700,maxRailways:450,maxBuildings:350,
    placeGrid:{columns:10,rows:7},roadGrid:{columns:8,rows:5}
  });
  return {...compiled,zoom:plan.zoom,tileCount:plan.tileCount,attribution:"OpenFreeMap © OpenMapTiles Data from OpenStreetMap"};
}

function canvas2d(){
  if(typeof OffscreenCanvas!=="undefined")return new OffscreenCanvas(256,256).getContext("2d",{willReadFrequently:true});
  if(typeof document!=="undefined"){
    const canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
    return canvas.getContext("2d",{willReadFrequently:true});
  }
  throw new Error("Terrain image decoding requires a browser canvas.");
}

function terrariumElevation(data,index){
  const o=index*4;
  return data[o]*256+data[o+1]+data[o+2]/256-32768;
}

export async function loadTerrariumSampler(bounds,options={}){
  if(typeof fetch!=="function"||typeof createImageBitmap!=="function")throw new Error("AWS Terrarium loading requires a modern browser.");
  const preferred=options.preferredZoom||11,plan=tilePlan(bounds,preferred,options.tileBudget||48,5),tiles=new Map(),jobs=[];
  for(let y=plan.minY;y<=plan.maxY;y++)for(let x=plan.minX;x<=plan.maxX;x++)jobs.push({x,y});
  for(let start=0;start<jobs.length;start+=8){
    await Promise.all(jobs.slice(start,start+8).map(async tile=>{
      const wrapped=((tile.x%2**plan.zoom)+2**plan.zoom)%2**plan.zoom;
      const url="https://s3.amazonaws.com/elevation-tiles-prod/terrarium/"+plan.zoom+"/"+wrapped+"/"+tile.y+".png";
      const response=await fetch(url);
      if(!response.ok)throw new Error("Elevation tile "+tile.x+"/"+tile.y+" failed.");
      const bitmap=await createImageBitmap(await response.blob()),ctx=canvas2d();
      ctx.clearRect(0,0,256,256);ctx.drawImage(bitmap,0,0);bitmap.close?.();
      tiles.set(tile.x+"/"+tile.y,ctx.getImageData(0,0,256,256));
    }));
  }
  const sample=(lat,lon)=>{
    const gx=tileFloatX(lon,plan.zoom),gy=tileFloatY(lat,plan.zoom),tx=Math.floor(gx),ty=Math.floor(gy);
    const image=tiles.get(tx+"/"+ty);
    if(!image)return null;
    const fx=Math.max(0,Math.min(255,(gx-tx)*256-.5)),fy=Math.max(0,Math.min(255,(gy-ty)*256-.5));
    const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(255,x0+1),y1=Math.min(255,y0+1),dx=fx-x0,dy=fy-y0;
    const a=terrariumElevation(image.data,y0*256+x0),b=terrariumElevation(image.data,y0*256+x1);
    const c=terrariumElevation(image.data,y1*256+x0),d=terrariumElevation(image.data,y1*256+x1);
    return (a*(1-dx)+b*dx)*(1-dy)+(c*(1-dx)+d*dx)*dy;
  };
  return {sample,zoom:plan.zoom,tileCount:plan.tileCount};
}

export async function loadGeoTiffFile(file,options={}){
  if(!file)throw new Error("Choose a GeoTIFF first.");
  return loadGeoTiffArrayBuffer(await file.arrayBuffer(),{
    crsOverride:options.crsOverride||"",
    fillNoData:options.fillNoData!==false,
    smoothingRadius:Number(options.smoothingRadius||0),
    vendorModuleUrl:"../vendor/geotiff-proj4.mjs"
  });
}

export async function loadArcAsciiFile(file){
  if(!file)throw new Error("Choose an Arc-ASCII grid first.");
  const grid=parseArcAsciiGrid(await file.text());
  return {grid,sample:(lat,lon)=>sampleArcAsciiGrid(grid,lat,lon)};
}

function makeProjection(bounds,modelWidthMm){
  const midLat=(bounds.minLat+bounds.maxLat)/2,midLon=(bounds.minLon+bounds.maxLon)/2,lonScale=Math.cos(midLat*Math.PI/180);
  const geoWidth=Math.max(1e-9,(bounds.maxLon-bounds.minLon)*lonScale),geoHeight=Math.max(1e-9,bounds.maxLat-bounds.minLat),extent=Math.max(geoWidth,geoHeight);
  const radius=modelWidthMm/2;
  return {
    bounds,midLat,midLon,lonScale,extent,radius,
    widthMm:modelWidthMm*geoWidth/extent,
    heightMm:modelWidthMm*geoHeight/extent,
    project(point){const p=projectLonLat(point,bounds,2);return {x:p.x*radius,y:p.y*radius,nx:p.x,ny:p.y};},
    unproject(nx,ny){return {lon:midLon+nx*extent/(2*lonScale),lat:midLat+ny*extent/2};}
  };
}

function sampleRange(demSampler,bounds,inside){
  let min=Infinity,max=-Infinity,count=0;
  for(let y=0;y<=28;y++)for(let x=0;x<=28;x++){
    const lon=bounds.minLon+(bounds.maxLon-bounds.minLon)*x/28,lat=bounds.minLat+(bounds.maxLat-bounds.minLat)*y/28;
    const p=projectLonLat({lon,lat},bounds,2);
    if(inside&&!inside(p.x,p.y))continue;
    const value=demSampler(lat,lon);
    if(Number.isFinite(value)){min=Math.min(min,value);max=Math.max(max,value);count++;}
  }
  if(!count)return {min:0,max:1,count:0};
  if(max<=min)max=min+1;
  return {min,max,count};
}

function segmentPrism(a,b,widthMm,riseMm,zA,zB,region){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(length<1e-6)return null;
  const nx=-dy/length*widthMm/2,ny=dx/length*widthMm/2;
  const vertices=[
    {x:a.x+nx,y:a.y+ny,z:zA},{x:a.x-nx,y:a.y-ny,z:zA},{x:b.x-nx,y:b.y-ny,z:zB},{x:b.x+nx,y:b.y+ny,z:zB},
    {x:a.x+nx,y:a.y+ny,z:zA+riseMm},{x:a.x-nx,y:a.y-ny,z:zA+riseMm},{x:b.x-nx,y:b.y-ny,z:zB+riseMm},{x:b.x+nx,y:b.y+ny,z:zB+riseMm}
  ];
  const q=(a,b,c,d,r)=>[{a,b,c,region:r},{a,b:c,c:d,region:r}];
  const triangles=[
    ...q(0,3,2,1,0),...q(4,5,6,7,region),
    ...q(0,1,5,4,region),...q(1,2,6,5,region),...q(2,3,7,6,region),...q(3,0,4,7,region)
  ];
  return {vertices,triangles};
}

function shifted(mesh,dx,dy){
  if(!mesh)return mesh;
  return {vertices:mesh.vertices.map(v=>({...v,x:v.x-dx,y:v.y-dy})),triangles:mesh.triangles.map(t=>({...t}))};
}

function inRect(x,y,rect){
  return !rect||(x>=rect.minX&&x<=rect.maxX&&y>=rect.minY&&y<=rect.maxY);
}

function featureMeshes({points,cartography,config,projection,terrainTopMm,insideNormalized,clipRect=null,offsetX=0,offsetY=0}){
  const meshes=[],radius=projection.radius,route=points.map(point=>projection.project(point));
  const addSegments=(segments,width,rise,region,maxSegments)=>{
    let used=0;
    for(const pair of segments){
      const list=pair.points||pair;
      for(let i=1;i<list.length&&used<maxSegments;i++){
        const toMm=point=>{
          if(point?.nx!==undefined&&point?.ny!==undefined)return {x:Number(point.x),y:Number(point.y)};
          if(point?.x!==undefined&&point?.lat===undefined)return {x:Number(point.x)*radius,y:Number(point.y)*radius};
          return projection.project(point);
        };
        const a=toMm(list[i-1]),b=toMm(list[i]);
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=mx/radius,ny=my/radius;
        if(!insideNormalized(nx,ny)||!inRect(mx,my,clipRect))continue;
        const zA=terrainTopMm(a.x,a.y),zB=terrainTopMm(b.x,b.y),mesh=segmentPrism(a,b,width,rise,zA,zB,region);
        if(mesh){meshes.push(shifted(mesh,offsetX,offsetY));used++;}
      }
    }
  };
  const stride=Math.max(1,Math.ceil(route.length/1600)),routeLite=[];
  for(let i=0;i<route.length;i+=stride)routeLite.push(route[i]);
  if(routeLite.at(-1)!==route.at(-1))routeLite.push(route.at(-1));
  addSegments([routeLite],config.fabrication.routeWidthMm,config.fabrication.routeRiseMm,5,1800);
  if(cartography&&config.map.roads)addSegments(cartography.roads,.45,.28,6,700);
  if(cartography&&config.map.trails)addSegments(cartography.trails,.32,.24,7,700);
  if(cartography&&config.map.railways)addSegments(cartography.railways,.40,.30,8,450);
  if(cartography&&config.map.buildings){
    let count=0;
    for(const building of cartography.buildings||[]){
      if(count>=300)break;
      const ring=building.rings?.[0];if(!ring||ring.length<3)continue;
      const pointsMm=ring.map(p=>({x:p.x*radius,y:p.y*radius}));
      const center=pointsMm.reduce((acc,p)=>({x:acc.x+p.x/pointsMm.length,y:acc.y+p.y/pointsMm.length}),{x:0,y:0});
      if(!insideNormalized(center.x/radius,center.y/radius)||!inRect(center.x,center.y,clipRect))continue;
      try{
        const height=Math.max(.6,Math.min(6,Number(building.renderHeight||3)*.06));
        const mesh=buildExtrudedPolygonMesh({points:pointsMm,baseZAt:(x,y)=>terrainTopMm(x,y),heightMm:height,region:9});
        meshes.push(shifted(mesh,offsetX,offsetY));count++;
      }catch{}
    }
  }
  return meshes;
}

function logoMeshes({logoImage,config,projection,terrainTopMm,insideNormalized,routePoints}){
  if(!config.shape.logoEnabled||!logoImage)return [];
  const radius=projection.radius,aspect=Math.max(.1,logoImage.width/logoImage.height),widthMm=Math.max(4,config.shape.logoWidthMm),rise=Math.max(.2,config.shape.logoRiseMm);
  let placement={x:.52,y:-.52};
  if(config.shape.logoAuto){
    const route=routePoints.map(point=>projection.project(point));
    const occupancy=(x,y)=>{
      let best=Infinity;
      for(let i=0;i<route.length;i+=Math.max(1,Math.floor(route.length/500)))best=Math.min(best,Math.hypot(x-route[i].nx,y-route[i].ny));
      return 1/Math.max(.01,best);
    };
    placement=findEmptyLogoPlacement({widthMm,aspect,diameterMm:projection.radius*2},insideNormalized,occupancy)||placement;
  }
  const polygons=maskPolygons(logoImage,{extent:1,threshold:.3}),meshes=[],scale=widthMm/(projection.radius*2),angle=0,c=Math.cos(angle),s=Math.sin(angle);
  for(const rings of polygons){
    const ring=rings?.[0];if(!ring||ring.length<3)continue;
    const transformed=ring.map(p=>{
      const lx=p.x*scale,ly=p.y*scale/aspect,nx=placement.x+lx*c-ly*s,ny=placement.y+lx*s+ly*c;
      return {x:nx*radius,y:ny*radius};
    });
    const center=transformed.reduce((acc,p)=>({x:acc.x+p.x/transformed.length,y:acc.y+p.y/transformed.length}),{x:0,y:0});
    if(!insideNormalized(center.x/radius,center.y/radius))continue;
    try{meshes.push(buildExtrudedPolygonMesh({points:transformed,baseZAt:(x,y)=>terrainTopMm(x,y),heightMm:rise,region:10}));}catch{}
  }
  return meshes;
}


const GLYPH_5X7={
  A:["01110","10001","10001","11111","10001","10001","10001"],B:["11110","10001","10001","11110","10001","10001","11110"],
  C:["01111","10000","10000","10000","10000","10000","01111"],D:["11110","10001","10001","10001","10001","10001","11110"],
  E:["11111","10000","10000","11110","10000","10000","11111"],F:["11111","10000","10000","11110","10000","10000","10000"],
  G:["01111","10000","10000","10111","10001","10001","01111"],H:["10001","10001","10001","11111","10001","10001","10001"],
  I:["11111","00100","00100","00100","00100","00100","11111"],J:["00111","00010","00010","00010","10010","10010","01100"],
  K:["10001","10010","10100","11000","10100","10010","10001"],L:["10000","10000","10000","10000","10000","10000","11111"],
  M:["10001","11011","10101","10101","10001","10001","10001"],N:["10001","11001","10101","10011","10001","10001","10001"],
  O:["01110","10001","10001","10001","10001","10001","01110"],P:["11110","10001","10001","11110","10000","10000","10000"],
  Q:["01110","10001","10001","10001","10101","10010","01101"],R:["11110","10001","10001","11110","10100","10010","10001"],
  S:["01111","10000","10000","01110","00001","00001","11110"],T:["11111","00100","00100","00100","00100","00100","00100"],
  U:["10001","10001","10001","10001","10001","10001","01110"],V:["10001","10001","10001","10001","10001","01010","00100"],
  W:["10001","10001","10001","10101","10101","10101","01010"],X:["10001","10001","01010","00100","01010","10001","10001"],
  Y:["10001","10001","01010","00100","00100","00100","00100"],Z:["11111","00001","00010","00100","01000","10000","11111"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],
  "2":["01110","10001","00001","00010","00100","01000","11111"],"3":["11110","00001","00001","01110","00001","00001","11110"],
  "4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","10000","11110","00001","00001","11110"],
  "6":["01110","10000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],
  "8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00001","01110"],
  "-":["00000","00000","00000","11111","00000","00000","00000"],"/":["00001","00010","00100","01000","10000","00000","00000"],
  ".":["00000","00000","00000","00000","00000","00110","00110"],":":["00000","00110","00110","00000","00110","00110","00000"],
  " ":["00000","00000","00000","00000","00000","00000","00000"]
};

function textLineMeshes(text,{centerX=0,centerY=0,maxWidth=120,cellMm=1.2,riseMm=.8,terrainTopMm=()=>0,inside=()=>true}={}){
  const value=String(text||"").toUpperCase().replace(/[^A-Z0-9 \-\/\.:]/g," ").trim();
  if(!value)return [];
  const nominalWidth=value.length*6-1;
  const cell=Math.max(.55,Math.min(cellMm,maxWidth/Math.max(1,nominalWidth)));
  const totalWidth=nominalWidth*cell,startX=centerX-totalWidth/2,meshes=[];
  for(let ci=0;ci<value.length;ci++){
    const glyph=GLYPH_5X7[value[ci]]||GLYPH_5X7[" "];
    for(let row=0;row<7;row++)for(let col=0;col<5;col++){
      if(glyph[row][col]!=="1")continue;
      const x0=startX+(ci*6+col)*cell,x1=x0+cell*.82;
      const y1=centerY+(3.5-row)*cell,y0=y1-cell*.82;
      const center={x:(x0+x1)/2,y:(y0+y1)/2};
      const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
      if(!corners.every(([x,y])=>inside(x,y)))continue;
      try{
        meshes.push(buildExtrudedPolygonMesh({
          points:corners.map(([x,y])=>({x,y})),
          baseZAt:(x,y)=>terrainTopMm(x,y),
          heightMm:Math.max(.3,riseMm),region:11
        }));
      }catch{}
    }
  }
  return meshes;
}

export function buildPersonalizationMeshes({customization={},extents,insideNormalized,radius,terrainTopMm,riseMm=.8}={}){
  if(!extents||!Number.isFinite(radius)||radius<=0||typeof terrainTopMm!=="function")return [];
  const meta=normalizeCustomization(customization);
  const identity=[meta.name,meta.date].filter(Boolean).join(" · ");
  const stats=[meta.distance,meta.elevation,meta.duration].filter(Boolean).join(" · ");
  if(!meta.event&&!identity&&!stats)return [];
  const width=Math.max(1,extents.maxX-extents.minX),height=Math.max(1,extents.maxY-extents.minY);
  const inside=(x,y)=>typeof insideNormalized==="function"?insideNormalized(x/radius,y/radius):true;
  const meshes=[],maxWidth=width*.82,baseCell=Math.max(.7,Math.min(2.4,width/105));
  if(meta.event)meshes.push(...textLineMeshes(meta.event,{
    centerX:0,centerY:extents.maxY-height*.10,maxWidth,cellMm:baseCell,
    riseMm:Math.max(.45,riseMm),terrainTopMm,inside
  }));
  if(identity)meshes.push(...textLineMeshes(identity,{
    centerX:0,centerY:extents.minY+height*.13,maxWidth,cellMm:baseCell*.78,
    riseMm:Math.max(.35,riseMm*.82),terrainTopMm,inside
  }));
  if(stats)meshes.push(...textLineMeshes(stats,{
    centerX:0,centerY:extents.minY+height*.065,maxWidth,cellMm:baseCell*.56,
    riseMm:Math.max(.3,riseMm*.68),terrainTopMm,inside
  }));
  return meshes;
}

export function buildPlaceLabelMeshes({cartography,projection,terrainTopMm,insideNormalized,maxLabels=18}={}){
  if(!cartography?.places?.length||!projection||typeof terrainTopMm!=="function")return [];
  const radius=projection.radius,meshes=[],occupied=[];
  const places=(cartography.places||[]).filter(p=>p?.name&&["city","town","village"].includes(p.class)).slice(0,Math.max(0,maxLabels));
  for(const place of places){
    const nx=Number(place.x),ny=Number(place.y);
    if(!Number.isFinite(nx)||!Number.isFinite(ny)||!insideNormalized(nx,ny))continue;
    if(ny>.56||ny<-.56)continue;
    const x=nx*radius,y=ny*radius;
    if(occupied.some(p=>Math.hypot(p.x-x,p.y-y)<radius*.18))continue;
    const cell=place.class==="city"?Math.max(.62,radius/82):place.class==="town"?Math.max(.56,radius/94):Math.max(.50,radius/108);
    const labels=textLineMeshes(String(place.name),{
      centerX:x,centerY:y,maxWidth:radius*.42,cellMm:cell,riseMm:.38,
      terrainTopMm,inside:(px,py)=>insideNormalized(px/radius,py/radius)
    });
    if(labels.length){meshes.push(...labels);occupied.push({x,y});}
  }
  return meshes;
}

function modelExtents(config,projection,outlinePolygons){
  const kind=config.shape.kind,radius=projection.radius;
  if(kind==="route-fit")return {minX:-projection.widthMm/2,maxX:projection.widthMm/2,minY:-projection.heightMm/2,maxY:projection.heightMm/2};
  if(kind==="geographic"&&outlinePolygons?.length){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const rings of outlinePolygons)for(const ring of rings)for(const p of ring){
      minX=Math.min(minX,p.x*radius);maxX=Math.max(maxX,p.x*radius);minY=Math.min(minY,p.y*radius);maxY=Math.max(maxY,p.y*radius);
    }
    return {minX,maxX,minY,maxY};
  }
  const aspect=config.shape.aspect||1.35;
  return {
    minX:-shapeBoundaryRadius(kind,Math.PI,{aspect})*radius,
    maxX: shapeBoundaryRadius(kind,0,{aspect})*radius,
    minY:-shapeBoundaryRadius(kind,3*Math.PI/2,{aspect})*radius,
    maxY: shapeBoundaryRadius(kind,Math.PI/2,{aspect})*radius
  };
}

function makePockets(config,extents){
  if(!config.fabrication.magnetEnabled)return [];
  const x=(extents.maxX-extents.minX)*.26,y=(extents.maxY-extents.minY)*.26;
  return [
    {xMm:-x,yMm:-y,diameterMm:config.fabrication.magnetDiameterMm,depthMm:config.fabrication.magnetDepthMm},
    {xMm:x,yMm:-y,diameterMm:config.fabrication.magnetDiameterMm,depthMm:config.fabrication.magnetDepthMm},
    {xMm:-x,yMm:y,diameterMm:config.fabrication.magnetDiameterMm,depthMm:config.fabrication.magnetDepthMm},
    {xMm:x,yMm:y,diameterMm:config.fabrication.magnetDiameterMm,depthMm:config.fabrication.magnetDepthMm}
  ];
}

function buildTileBundle({config,projection,insideNormalized,terrainHeightNormalized,terrainRegionNormalized,terrainTopMm,points,cartography,extents}){
  const widthMm=extents.maxX-extents.minX,heightMm=extents.maxY-extents.minY;
  const adaptive=adaptiveLargeFormatPlan({
    widthMm,heightMm,targetXyMm:config.fabrication.targetXyMm,maxVerticesPerTile:160000,maxTileMm:config.fabrication.maxTileMm
  });
  const connectors=planTiledMap({
    widthMm,heightMm,maxTileWidthMm:widthMm/adaptive.columns+.001,maxTileHeightMm:heightMm/adaptive.rows+.001,jointType:config.fabrication.jointType
  });
  const plan={...adaptive,connectors:connectors.connectors,jointType:connectors.jointType},files=[];
  for(const tile of plan.tiles){
    const centerX=extents.minX+tile.xMm+tile.widthMm/2,centerY=extents.minY+tile.yMm+tile.heightMm/2;
    const related=plan.connectors.filter(connector=>connector.tile===tile.id);
    let mesh=buildRectangularHeightfieldMesh({
      widthMm:tile.widthMm,heightMm:tile.heightMm,baseMm:config.fabrication.baseMm,
      columns:Math.max(2,tile.gridColumns-1),rows:Math.max(2,tile.gridRows-1),
      heightAt:(lx,ly)=>{
        const gx=centerX+lx,gy=centerY+ly,nx=gx/projection.radius,ny=gy/projection.radius;
        return insideNormalized(nx,ny)?terrainHeightNormalized(nx,ny):0;
      },
      bottomAt:(lx,ly)=>{
        let depth=0;
        for(const connector of related){
          if(config.fabrication.jointType==="dovetail")depth=Math.max(depth,dovetailSlotDepth(lx,ly,tile,connector,{lengthMm:16,headWidthMm:8,neckWidthMm:5,depthMm:Math.min(config.fabrication.baseMm-.4,2)}));
          if(config.fabrication.jointType==="pin")depth=Math.max(depth,alignmentSocketDepth(lx,ly,tile,connector,{diameterMm:8,depthMm:Math.min(config.fabrication.baseMm-.4,2)}));
        }
        return depth;
      },
      regionAt:(lx,ly)=>{
        const gx=centerX+lx,gy=centerY+ly;
        return terrainRegionNormalized(gx/projection.radius,gy/projection.radius);
      }
    });
    const clip={minX:centerX-tile.widthMm/2,maxX:centerX+tile.widthMm/2,minY:centerY-tile.heightMm/2,maxY:centerY+tile.heightMm/2};
    const overlays=featureMeshes({points,cartography,config,projection,terrainTopMm,insideNormalized,clipRect:clip,offsetX:centerX,offsetY:centerY});
    if(overlays.length)mesh=mergeMeshes([mesh,...overlays]);
    const validation=validateMesh(mesh);
    if(!validation.watertight)throw new Error("Tile "+tile.id+" failed watertight validation.");
    files.push({name:"tile-"+tile.id+".stl",data:encodeBinaryStl(mesh,{name:"TrailRelief tile "+tile.id})});
  }
  const jointPairs=Math.ceil(plan.connectors.length/2);
  if(config.fabrication.jointType==="dovetail"){
    const key=buildDovetailKeyMesh({lengthMm:16,headWidthMm:8,neckWidthMm:5,heightMm:2.4});
    files.push({name:"dovetail-key.stl",data:encodeBinaryStl(key,{name:"TrailRelief dovetail key"})});
  }else if(config.fabrication.jointType==="pin"){
    const puck=buildCylinderMesh({diameterMm:7.7,heightMm:2,segments:48,region:6});
    files.push({name:"alignment-puck.stl",data:encodeBinaryStl(puck,{name:"TrailRelief alignment puck"})});
  }
  files.push({name:"manifest.json",data:JSON.stringify({...plan,jointQuantity:config.fabrication.jointType==="flat"?0:jointPairs},null,2)});
  return {plan,bundle:encodeArtifactZip(files)};
}

export async function generateProductionModel({points,demSampler,cartography=null,landcover=[],config={},outlineGeometry=null,logoImage=null,title="TrailRelief"}={}){
  if(!Array.isArray(points)||points.length<2)throw new Error("Upload a GPX route first.");
  if(typeof demSampler!=="function")throw new Error("An elevation source is required.");
  const c=normalizeAdvancedConfig(config);
  const geometry=outlineGeometry||c.shape.outlineGeometry;
  if(c.shape.kind==="geographic"&&!geometry)throw new Error("Geographic shape requires a GeoJSON Polygon or MultiPolygon.");
  const shapeForBounds={...c.shape,outlineGeometry:geometry};
  const bounds=productionBounds(routeBounds(points),shapeForBounds),projection=makeProjection(bounds,c.fabrication.modelWidthMm);
  let outlinePolygons=null;
  if(c.shape.kind==="geographic")outlinePolygons=projectGeographicOutline(geometry,bounds,2);
  const insideNormalized=(nx,ny)=>{
    if(c.shape.kind==="route-fit")return Math.abs(nx*projection.radius)<=projection.widthMm/2+.001&&Math.abs(ny*projection.radius)<=projection.heightMm/2+.001;
    if(c.shape.kind==="geographic")return insidePolygons(nx,ny,outlinePolygons);
    return pointInsideShape(nx,ny,c.shape.kind,{aspect:c.shape.aspect});
  };
  const range=sampleRange(demSampler,bounds,insideNormalized);
  const routeCorrection=buildRouteElevationCorrection(points,demSampler,projection,range,{
    mode:c.dem.routeElevationMode,blend:c.dem.routeElevationBlend,maxDeltaM:c.dem.maxDeltaM,
    reliefMm:c.fabrication.reliefMm,routeWidthMm:c.fabrication.routeWidthMm
  });
  const terrainHeightNormalized=(nx,ny)=>{
    if(!insideNormalized(nx,ny))return 0;
    const geo=projection.unproject(nx,ny),elevation=demSampler(geo.lat,geo.lon);
    if(!Number.isFinite(elevation))return 0;
    const base=(elevation-range.min)/(range.max-range.min)*c.fabrication.reliefMm;
    const corrected=base+routeCorrection.at(nx*projection.radius,ny*projection.radius);
    return Math.max(0,Math.min(c.fabrication.reliefMm,corrected));
  };
  const terrainTopMm=(x,y)=>c.fabrication.baseMm+terrainHeightNormalized(x/projection.radius,y/projection.radius);
  const landcoverIndex=prepareTerrainLandcover(landcover,bounds);
  const terrainRegionNormalized=(nx,ny)=>{
    const geo=projection.unproject(nx,ny),elevation=demSampler(geo.lat,geo.lon);
    return classifyTerrainMaterial({lat:geo.lat,lon:geo.lon,elevation},c.terrainBands,landcoverIndex);
  };
  const extents=modelExtents(c,projection,outlinePolygons),pockets=makePockets(c,extents);
  let baseMesh;
  if(c.shape.kind==="route-fit"){
    baseMesh=buildRectangularHeightfieldMesh({
      widthMm:projection.widthMm,heightMm:projection.heightMm,baseMm:c.fabrication.baseMm,
      columns:Math.max(24,Math.ceil(projection.widthMm/c.fabrication.targetXyMm)),
      rows:Math.max(24,Math.ceil(projection.heightMm/c.fabrication.targetXyMm)),
      heightAt:(x,y)=>terrainHeightNormalized(x/projection.radius,y/projection.radius),
      bottomAt:(x,y)=>magnetPocketDepth(x,y,pockets),regionAt:(x,y)=>terrainRegionNormalized(x/projection.radius,y/projection.radius)
    });
  }else if(c.shape.kind==="geographic"){
    baseMesh=(await import("../engine/map-outline-core.mjs")).buildOutlineHeightfieldMesh({
      polygons:outlinePolygons,radiusMm:projection.radius,baseMm:c.fabrication.baseMm,stepMm:c.fabrication.targetXyMm,
      heightAt:(nx,ny)=>terrainHeightNormalized(nx,ny),
      bottomAt:(nx,ny)=>magnetPocketDepth(nx*projection.radius,ny*projection.radius,pockets),regionAt:terrainRegionNormalized
    });
  }else{
    baseMesh=buildRadialMedalMesh({
      diameterMm:c.fabrication.modelWidthMm,baseMm:c.fabrication.baseMm,
      rings:Math.max(48,Math.ceil(projection.radius/c.fabrication.targetXyMm)),
      segments:Math.max(192,Math.ceil(Math.PI*c.fabrication.modelWidthMm/c.fabrication.targetXyMm/4)*4),
      shape:c.shape.kind,aspect:c.shape.aspect,
      heightAt:(nx,ny)=>terrainHeightNormalized(nx,ny),
      bottomAt:(nx,ny)=>magnetPocketDepth(nx*projection.radius,ny*projection.radius,pockets),regionAt:terrainRegionNormalized
    });
  }
  const overlays=featureMeshes({points,cartography,config:c,projection,terrainTopMm,insideNormalized});
  const logos=logoMeshes({logoImage,config:c,projection,terrainTopMm,insideNormalized,routePoints:points});
  const placeLabels=buildPlaceLabelMeshes({cartography,projection,terrainTopMm,insideNormalized,maxLabels:c.shape.kind==="route-fit"?14:18});
  const textMeshes=buildPersonalizationMeshes({
    customization:c.customization,extents,insideNormalized,radius:projection.radius,terrainTopMm,
    riseMm:Math.max(.55,Math.min(1.4,c.fabrication.routeRiseMm*.7))
  });
  const meshes=[baseMesh,...overlays,...logos,...placeLabels,...textMeshes];
  if(c.fabrication.hangerEnabled){
    const outer=7,inner=3,centerY=extents.maxY+outer*.55;
    meshes.push(buildAnnulusMesh({outerRadiusMm:outer,innerRadiusMm:inner,heightMm:c.fabrication.baseMm+1.5,centerX:0,centerY,segments:64}));
  }
  const mesh=mergeMeshes(meshes),validation=validateMesh(mesh);
  if(!validation.watertight)throw new Error("Generated production mesh is not watertight (boundary "+validation.boundaryEdges+", non-manifold "+validation.nonManifoldEdges+").");
  const materials=productionMaterials(c);
  const stl=encodeBinaryStl(mesh,{name:title}),threeMf=encode3mf(mesh,{title,materials}),mtl=encodeMtl(materials),obj=encodeObj(mesh,{name:title,materials,mtlFile:"model.mtl"}),glb=encodeGlb(mesh,{title,materials});
  const objBundle=encodeArtifactZip([{name:"model.obj",data:obj},{name:"model.mtl",data:mtl}]);
  const coupon=buildPrintValidationCoupon({technology:"FDM",nozzleMm:.4,minFeatureMm:.8,minEmbossMm:.3});
  const manifest={title,validation,range,bounds,materials,vertices:mesh.vertices.length,triangles:mesh.triangles.length,cartographyStats:cartography?.stats||null,elevationDiagnostics:routeCorrection.diagnostics,customization:normalizeCustomization(config.customization||{}),config:c};
  const validationBundle=encodeArtifactZip([
    {name:"validation.json",data:JSON.stringify(manifest,null,2)},
    {name:"print-validation-coupon.stl",data:encodeBinaryStl(coupon.mesh,{name:"TrailRelief validation coupon"})},
    {name:"coupon-manifest.json",data:JSON.stringify(coupon.manifest,null,2)}
  ]);
  let tilePlan=null,tileBundle=null;
  if(c.fabrication.tiled){
    const tiled=buildTileBundle({config:c,projection,insideNormalized,terrainHeightNormalized,terrainRegionNormalized,terrainTopMm,points,cartography,extents});
    tilePlan=tiled.plan;tileBundle=tiled.bundle;
  }
  let standStl=null;
  if(c.fabrication.standEnabled){
    const stand=buildDisplayStandMesh({medalDiameterMm:c.fabrication.modelWidthMm,thicknessMm:4});
    standStl=encodeBinaryStl(stand,{name:"TrailRelief display stand"});
  }
  const workload=classifyTerrainWorkload({estimatedVertices:mesh.vertices.length,deviceMemoryGb:Number(globalThis.navigator?.deviceMemory||8)});
  return {mesh,materials,validation,range,bounds,config:c,projection,elevationDiagnostics:routeCorrection.diagnostics,stl,threeMf,obj,mtl,objBundle,glb,validationBundle,tilePlan,tileBundle,standStl,workload};
}
