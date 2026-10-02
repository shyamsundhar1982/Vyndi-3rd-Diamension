export const PRINTERS = Object.freeze({
  "generic-fdm": {
    label:"Generic budget FDM · 0.4 mm", technology:"FDM", productionKind:"3d",
    bed:[220,220,250], colours:1, nozzle:0.4, minFeature:0.9, minEmboss:0.35,
    layerRange:[0.12,0.32], recommendedLayer:0.20, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://reprap.org/wiki/RepRap"
  },
  "creality-ender3-v3": {
    label:"Creality Ender-3 V3", technology:"FDM", productionKind:"3d",
    bed:[220,220,250], colours:1, nozzle:0.4, minFeature:0.85, minEmboss:0.32,
    layerRange:[0.10,0.35], recommendedLayer:0.20, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://www.creality.com/products/creality-ender-3-v3"
  },
  "bambu-a1-mini": {
    label:"Bambu Lab A1 mini", technology:"FDM", productionKind:"3d",
    bed:[180,180,180], colours:4, nozzle:0.4, minFeature:0.8, minEmboss:0.30,
    layerRange:[0.08,0.28], recommendedLayer:0.16, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://cdn1.bambulab.com/documentation/quick-start-f507128172bdf/Quick%20start%20guide%20-%20A1%20mini-EN.pdf"
  },
  "bambu-p1s-ams": {
    label:"Bambu Lab P1S Combo", technology:"FDM", productionKind:"3d",
    bed:[256,256,256], colours:4, nozzle:0.4, minFeature:0.8, minEmboss:0.30,
    layerRange:[0.08,0.28], recommendedLayer:0.16, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://cdn1.bambulab.com/documentation/quick-start-59b0cefdc0fc4/P1S/English%20version-Quick%20Start%20Guide%20for%20P1S.pdf"
  },
  "bambu-x1c-ams": {
    label:"Bambu Lab X1 Carbon + AMS", technology:"FDM", productionKind:"3d",
    bed:[256,256,256], colours:4, nozzle:0.4, minFeature:0.75, minEmboss:0.28,
    layerRange:[0.08,0.28], recommendedLayer:0.16, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://bambulab.com/en/x1"
  },
  "prusa-mk4s-mmu3": {
    label:"Original Prusa MK4S + MMU3", technology:"FDM", productionKind:"3d",
    bed:[250,210,220], colours:5, nozzle:0.4, minFeature:0.75, minEmboss:0.28,
    layerRange:[0.05,0.30], recommendedLayer:0.15, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://www.prusa3d.com/product/original-prusa-mk4s-kit/"
  },
  "prusa-core-one": {
    label:"Prusa CORE One+ (Gen 2)", technology:"FDM", productionKind:"3d",
    bed:[250,220,270], colours:1, nozzle:0.4, minFeature:0.72, minEmboss:0.26,
    layerRange:[0.05,0.30], recommendedLayer:0.15, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://www.prusa3d.com/product/prusa-core-one/"
  },
  "prusa-core-one-indx": {
    label:"Prusa CORE One+ INDX", technology:"FDM", productionKind:"3d",
    bed:[248,205,270], colours:8, nozzle:0.4, minFeature:0.70, minEmboss:0.25,
    layerRange:[0.05,0.30], recommendedLayer:0.15, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://www.prusa3d.com/product/prusa-core-one-gen-2-indx-4-tool/"
  },
  "prusa-xl-5t": {
    label:"Original Prusa XL · 5 toolheads", technology:"FDM", productionKind:"3d",
    bed:[360,360,360], colours:5, nozzle:0.4, minFeature:0.72, minEmboss:0.26,
    layerRange:[0.05,0.30], recommendedLayer:0.15, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://www.prusa3d.com/product/original-prusa-xl-5-tool-head-assembled-critical-infrastructure-edition/"
  },
  "ultimaker-s7": {
    label:"UltiMaker S7", technology:"FDM", productionKind:"3d",
    bed:[330,240,300], colours:2, nozzle:0.4, minFeature:0.75, minEmboss:0.28,
    layerRange:[0.06,0.40], recommendedLayer:0.15, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://ultimaker.com/3d-printers/s-series/ultimaker-s7/"
  },
  "raise3d-pro3-plus": {
    label:"Raise3D Pro3 Plus · dual", technology:"FFF", productionKind:"3d",
    bed:[255,300,605], colours:2, nozzle:0.4, minFeature:0.8, minEmboss:0.30,
    layerRange:[0.10,0.30], recommendedLayer:0.16, formats:["STL","3MF"], preferredFormat:"3MF",
    sourceUrl:"https://www.raise3d.com/products/raise3d-pro3-plus-3d-printer/"
  },
  "generic-resin": {
    label:"Generic desktop MSLA/SLA", technology:"MSLA", productionKind:"3d",
    bed:[143,89,175], colours:1, nozzle:null, minFeature:0.35, minEmboss:0.15,
    layerRange:[0.025,0.10], recommendedLayer:0.05, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://formlabs.com/blog/sla-3d-printing/"
  },
  "elegoo-saturn4-ultra16k": {
    label:"ELEGOO Saturn 4 Ultra 16K", technology:"MSLA", productionKind:"3d",
    bed:[211.68,118.37,220], colours:1, nozzle:null, minFeature:0.25, minEmboss:0.12,
    layerRange:[0.01,0.20], recommendedLayer:0.05, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://www.elegoo.com/products/saturn-4-ultra-16k-10inch-monochrome-lcd-resin-3d-printer"
  },
  "anycubic-m7-pro": {
    label:"Anycubic Photon Mono M7 Pro", technology:"MSLA", productionKind:"3d",
    bed:[223,126,230], colours:1, nozzle:null, minFeature:0.25, minEmboss:0.12,
    layerRange:[0.01,0.15], recommendedLayer:0.05, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://store.anycubic.com/products/photon-mono-m7-pro"
  },
  "formlabs-form4": {
    label:"Formlabs Form 4", technology:"MSLA", productionKind:"3d",
    bed:[200,125,210], colours:1, nozzle:null, minFeature:0.30, minEmboss:0.15,
    layerRange:[0.025,0.20], recommendedLayer:0.05, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://formlabs.com/products/form-4-basic-package/"
  },
  "formlabs-form4l": {
    label:"Formlabs Form 4L", technology:"MSLA", productionKind:"3d",
    bed:[353,196,350], colours:1, nozzle:null, minFeature:0.30, minEmboss:0.15,
    layerRange:[0.025,0.20], recommendedLayer:0.05, formats:["STL","3MF"], preferredFormat:"STL",
    sourceUrl:"https://formlabs.com/global/products/form-4l-basic-package/"
  },
  "formlabs-fuse1-plus": {
    label:"Formlabs Fuse 1+ 30W", technology:"SLS", productionKind:"3d",
    bed:[165,165,300], colours:1, nozzle:null, minFeature:0.60, minEmboss:0.30,
    layerRange:[0.11,0.11], recommendedLayer:0.11, formats:["3MF","STL"], preferredFormat:"3MF",
    sourceUrl:"https://formlabs.com/3d-printers/fuse-1/tech-specs/"
  },
  "paper-a4": {
    label:"A4 photo/inkjet printer", technology:"2D print", productionKind:"2d",
    bed:[210,297], colours:4, nozzle:null, minFeature:0.25, minEmboss:0,
    formats:["PDF","PNG"], preferredFormat:"PDF", sourceUrl:"https://www.iso.org/standard/36631.html"
  },
  "laser-generic": {
    label:"Laser engraver/cutter", technology:"Laser", productionKind:"2d",
    bed:[300,300], colours:1, nozzle:null, minFeature:0.4, minEmboss:0,
    formats:["SVG","DXF"], preferredFormat:"SVG", sourceUrl:"https://www.iso.org/standard/72933.html"
  }
});

export const EVENTS = Object.freeze({
  custom: { name: "Custom event", distance: "", detail: "" },
  pbp2023: { name: "Paris–Brest–Paris 2023", distance: "1,219 km", detail: "Rambouillet · Brest · Rambouillet", date: "2023-08-20", endDate: "2023-08-24", location: "Rambouillet, Île-de-France, France", source: "Paris-Brest-Paris official presentation", sourceUrl: "https://www.paris-brest-paris.org/en/download/PBP-BROCHURE-PRESENTATION-EN.pdf", resultUrl: "https://www.audax-club-parisien.com/palmares-du-paris-brest-paris/palmares-paris-brest-paris-randonneur-2023/" },
  k2k2025: { name: "K2K 2025", distance: "4,230 km", detail: "Kashmir to Kanyakumari" },
  marathon: { name: "Marathon", distance: "42.195 km", detail: "Custom marathon course" }
});

export function inferEventPresetFromFilename(filename = "") {
  const name = String(filename).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").toLowerCase();
  if (/\bparis\b.*\bbrest\b.*\bparis\b|\bpbp\b/.test(name)) return "pbp2023";
  if (/\bk2k\b|\bkashmir\b.*\bkanyakumari\b/.test(name)) return "k2k2025";
  if (/\bmarathon\b/.test(name)) return "marathon";
  return "custom";
}

export function eventNameFromGpxFilename(filename = "") {
  let name = String(filename).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  name = name.replace(/\s+\d+(?:\.\d+)?\s*meters?\s*elevation\b.*$/i, "").trim();
  return name || EVENTS.custom.name;
}

export function formatRouteDistance(distanceKm) {
  const distance = Math.max(0, Number(distanceKm) || 0);
  const digits = distance < 100 ? 1 : 0;
  return `${distance.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} km`;
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatElevationGain(elevationGainM) {
  const value = Math.max(0, Math.round(Number(elevationGainM) || 0));
  return `${value.toLocaleString("en-US")} m`;
}

export function gpxStatsLine(gpx = null) {
  if (!gpx) return "";
  const parts = [];
  if (Number.isFinite(Number(gpx.distanceKm))) parts.push(formatRouteDistance(gpx.distanceKm).toUpperCase());
  if (Number(gpx.elevationGainM) > 0) parts.push(formatElevationGain(gpx.elevationGainM).toUpperCase());
  if (Number(gpx.movingTimeSeconds) > 0) parts.push(formatDuration(gpx.movingTimeSeconds));
  else if (Number(gpx.elapsedTimeSeconds) > 0) parts.push(formatDuration(gpx.elapsedTimeSeconds));
  return parts.join(" · ");
}

export const MAPS = Object.freeze({
  uploaded: { name: "Uploaded GPX", terrain: "GPX + best available DEM" },
  pbp: { name: "Paris–Brest–Paris", terrain: "Regional terrain · 30 m DEM target" },
  k2k: { name: "Kashmir–Kanyakumari", terrain: "Continental terrain · generalised DEM" },
  marathon: { name: "Marathon course", terrain: "Local terrain · 1–10 m DEM target" }
});

export const WATER_MODES = Object.freeze({
  "procedural-waves": { name: "Procedural waves", storesElevation: false },
  flat: { name: "Flat water", storesElevation: false },
  none: { name: "No water", storesElevation: false }
});

export const ROUTE_STYLES = Object.freeze({
  raised: { name: "Raised route" },
  engraved: { name: "Engraved route" },
  inlay: { name: "Flush inlay" },
  color: { name: "Colour only" },
  none: { name: "No route" }
});

export function routeStyleGeometry(style = "raised", amountMm = 1, minEmbossMm = 0.3) {
  const kind = ROUTE_STYLES[style] ? style : "raised";
  const amount = Math.max(0, Number(amountMm) || 0);
  const minimum = Math.max(0, Number(minEmbossMm) || 0);
  const printable = Math.max(amount, minimum);
  if (kind === "engraved") return { style: kind, visible: true, channelDepthMm: printable, overlayRiseMm: 0, colorRegion: false };
  if (kind === "inlay") return { style: kind, visible: true, channelDepthMm: printable, overlayRiseMm: printable, colorRegion: false };
  if (kind === "color") return { style: kind, visible: true, channelDepthMm: 0, overlayRiseMm: 0, colorRegion: true };
  if (kind === "none") return { style: kind, visible: false, channelDepthMm: 0, overlayRiseMm: 0, colorRegion: false };
  return { style: "raised", visible: true, channelDepthMm: 0, overlayRiseMm: printable, colorRegion: false };
}

export function medalDiameterMm(inches) {
  return Number((Number(inches) * 25.4).toFixed(1));
}

export function productionDiameterMm(config = {}) {
  const override = Number(config.modelWidthMm);
  if (Number.isFinite(override) && override > 0) return Number(Math.max(60, Math.min(600, override)).toFixed(1));
  return medalDiameterMm(config.diameter);
}

export const VIEWER_LIMITS = Object.freeze({
  minZoom: 0.65,
  maxZoom: 2.8,
  zoomSensitivity: 0.0015,
  baseScale: 0.41,
  routeShadowWidth: 6,
  routeWidthMultiplier: 3.2,
  minRouteWidthPx: 3
});

export function adaptivePlaceLabelBudget(diameterInches = 4, viewerZoom = 1, viewerPitch = 0) {
  const diameter = Number(diameterInches) || 4;
  const zoomValue = Math.max(VIEWER_LIMITS.minZoom, Math.min(VIEWER_LIMITS.maxZoom, Number(viewerZoom) || 1));
  const pitchValue = Math.max(0, Math.min(Math.PI / 2, Number(viewerPitch) || 0));
  const base = diameter >= 4 ? 180 : 135;
  const zoomFactor = Math.max(0.88, Math.min(1.3, 1 + (zoomValue - 1) * 0.2));
  const tiltPenalty = 1 - Math.min(0.12, (pitchValue / (Math.PI / 2)) * 0.12);
  return Math.round(Math.max(100, Math.min(240, base * zoomFactor * tiltPenalty)));
}

export function adaptiveRoadRenderBudget(diameterInches = 4) {
  return Number(diameterInches) >= 4 ? 320 : 220;
}

export function roadPrintPolicy(roadClass, edgeRatio = 0) {
  const cls = String(roadClass || "");
  const ratio = Number.isFinite(Number(edgeRatio)) ? Number(edgeRatio) : 0;
  if (ratio < 0 || ratio > 1) return false;
  if (cls === "motorway" || cls === "trunk") return ratio <= 0.985;
  if (cls === "primary") return ratio <= 0.92;
  return false;
}


export function validateLocalFileMeta(file={},policy={}){
  const name=String(file?.name||"").trim(),size=Number(file?.size||0);
  const maxBytes=Math.max(1,Number(policy.maxBytes||1));
  const extensions=(policy.extensions||[]).map(ext=>String(ext).toLowerCase());
  if(!name)throw new Error("File name is required.");
  if(!Number.isFinite(size)||size<1)throw new Error("File is empty or invalid.");
  if(size>maxBytes)throw new Error(`File too large. Maximum allowed size is ${Math.round(maxBytes/1024/1024)} MB.`);
  if(extensions.length&&!extensions.some(ext=>name.toLowerCase().endsWith(ext)))throw new Error("Unsupported file type.");
  return true;
}

export function selectPrintPlaces(places=[],options={}){
  const mode=String(options.mode||"major");
  const maxCount=Math.max(0,Math.floor(Number(options.maxCount??8)));
  const selectedNames=new Set((options.selectedNames||[]).map(name=>String(name||"").trim().toLowerCase()).filter(Boolean));
  if(mode==="none"||maxCount===0)return [];
  const classPriority={city:0,town:1,village:2},route=(options.routePoints||[]).filter(point=>Number.isFinite(point?.x)&&Number.isFinite(point?.y));
  const routeDistance=place=>{
    if(!route.length||!Number.isFinite(place?.x)||!Number.isFinite(place?.y))return Infinity;
    let best=Infinity,stride=Math.max(1,Math.floor(route.length/500));
    for(let i=0;i<route.length;i+=stride){const dx=place.x-route[i].x,dy=place.y-route[i].y,d=dx*dx+dy*dy;if(d<best)best=d}
    const last=route.at(-1);if(last){const dx=place.x-last.x,dy=place.y-last.y;best=Math.min(best,dx*dx+dy*dy)}
    return Math.sqrt(best);
  };
  let pool=[...(places||[])].filter(place=>place?.name);
  if(mode==="selected")pool=pool.filter(place=>selectedNames.has(String(place.name).trim().toLowerCase()));
  else if(mode==="major")pool=pool.filter(place=>place.class==="city"||(place.class==="town"&&Number(place.rank??99)<=8));
  pool=pool.map(place=>({...place,_printRouteDistance:routeDistance(place)}));
  pool.sort((a,b)=>{
    if(mode==="major"&&route.length){
      const routeScoreA=(Number.isFinite(a._printRouteDistance)?a._printRouteDistance:9)*500+(classPriority[a.class]??9)*20+Number(a.rank??99);
      const routeScoreB=(Number.isFinite(b._printRouteDistance)?b._printRouteDistance:9)*500+(classPriority[b.class]??9)*20+Number(b.rank??99);
      if(routeScoreA!==routeScoreB)return routeScoreA-routeScoreB;
    }
    return (classPriority[a.class]??9)-(classPriority[b.class]??9)||(Number(a.rank??99)-Number(b.rank??99))||String(a.name).localeCompare(String(b.name));
  });
  const seen=new Set(),result=[];
  for(const place of pool){
    const key=String(place.name).trim().toLowerCase();
    if(!key||seen.has(key))continue;
    seen.add(key);const {_printRouteDistance,...clean}=place;result.push(clean);
    if(result.length>=maxCount)break;
  }
  return result;
}

export function placeLabelFontSize(placeClass, viewerZoom = 1, viewerPitch = 0) {
  const base = placeClass === "city" ? 12 : placeClass === "town" ? 10 : 8;
  const zoomValue = Math.max(VIEWER_LIMITS.minZoom, Number(viewerZoom) || 1);
  const pitchValue = Math.max(0, Math.min(Math.PI / 2, Number(viewerPitch) || 0));
  const zoomFactor = Math.max(0.9, Math.min(1.25, 1 / Math.sqrt(zoomValue)));
  const tiltFactor = 1 + Math.min(0.3, (1 - Math.abs(Math.cos(pitchValue))) * 0.35);
  const cap = placeClass === "city" ? 17 : placeClass === "town" ? 15 : 12;
  return Math.round(Math.min(cap, base * zoomFactor * tiltFactor) * 2) / 2;
}

export function nextViewerZoom(currentZoom, wheelDeltaY) {
  const current = Number(currentZoom) || 1;
  const delta = Number(wheelDeltaY) || 0;
  return Number(Math.max(VIEWER_LIMITS.minZoom, Math.min(VIEWER_LIMITS.maxZoom, current - delta * VIEWER_LIMITS.zoomSensitivity)).toFixed(3));
}

export function cellWaterState(flags) {
  const values = Array.isArray(flags) ? flags : [];
  if (!values.length) return false;
  return values.filter(Boolean).length > values.length / 2;
}

export function adaptiveWaterCells(rect, classifyWater, maxDepth = 3, depth = 0) {
  const x0 = Number(rect?.x0), y0 = Number(rect?.y0), x1 = Number(rect?.x1), y1 = Number(rect?.y1);
  if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) throw new Error("Valid adaptive-cell bounds are required.");
  if (typeof classifyWater !== "function") throw new Error("A water-classification function is required.");
  const xm = (x0 + x1) / 2;
  const ym = (y0 + y1) / 2;
  const samples = [
    Boolean(classifyWater(x0, y0)),
    Boolean(classifyWater(xm, y0)),
    Boolean(classifyWater(x1, y0)),
    Boolean(classifyWater(x1, ym)),
    Boolean(classifyWater(x1, y1)),
    Boolean(classifyWater(xm, y1)),
    Boolean(classifyWater(x0, y1)),
    Boolean(classifyWater(x0, ym)),
    Boolean(classifyWater(xm, ym))
  ];
  const mixed = samples.some(value => value !== samples[0]);
  const water = samples[8];
  if (!mixed || depth >= Math.max(0, Number(maxDepth) || 0)) {
    return [{ x0, y0, x1, y1, water, boundary: mixed, depth }];
  }
  const children = [
    { x0, y0, x1: xm, y1: ym },
    { x0: xm, y0, x1, y1: ym },
    { x0: xm, y0: ym, x1, y1 },
    { x0, y0: ym, x1: xm, y1 }
  ];
  return children.flatMap(child => adaptiveWaterCells(child, classifyWater, maxDepth, depth + 1));
}

export function clampPointToRadius(point, radius = 1) {
  const x = Number(point?.x) || 0;
  const y = Number(point?.y) || 0;
  const r = Math.max(0.000001, Number(radius) || 1);
  const magnitude = Math.hypot(x, y);
  if (magnitude <= r) return { x, y };
  const scale = r / magnitude;
  return { x: x * scale, y: y * scale };
}

export function routePreviewLift(routeRiseMm, terrainExaggeration = 1) {
  const rise = Math.max(0, Number(routeRiseMm) || 0);
  const exaggeration = Math.max(1, Number(terrainExaggeration) || 1);
  const baseLift = Math.max(0.004, Math.min(0.014, rise * 0.012));
  const exaggerationPenalty = 1 / (1 + (exaggeration - 1) * 0.18);
  return Number(Math.max(0.004, baseLift * exaggerationPenalty).toFixed(3));
}

export function routeShadowWidthForExaggeration(terrainExaggeration = 1) {
  const exaggeration = Math.max(1, Number(terrainExaggeration) || 1);
  return Number(Math.max(3.5, 6 - (exaggeration - 1) * 0.18).toFixed(2));
}

export function routeWidthMultiplierForExaggeration(terrainExaggeration = 1) {
  const exaggeration = Math.max(1, Number(terrainExaggeration) || 1);
  return Number(Math.max(2.5, 3.2 - (exaggeration - 1) * 0.06).toFixed(2));
}

export function physicalReliefMm({ exaggeration, reliefLimit }) {
  const visual = Math.max(1, Number(exaggeration) || 1);
  const limit = Math.max(0.5, Number(reliefLimit) || 0.5);
  return Number(Math.min(limit, 0.8 + visual * 0.64).toFixed(2));
}

export function validateDesign(config) {
  const printer = PRINTERS[config.printer];
  const diameter = productionDiameterMm(config);
  const warnings = [];
  const routeStyle = ROUTE_STYLES[config.routeStyle] ? config.routeStyle : "raised";
  if (!printer) return { status: "blocked", warnings: ["Select a supported production profile."] };
  if (diameter > Math.min(...printer.bed) && !config.tileEnabled) warnings.push(`Model width ${diameter} mm exceeds the ${printer.label} printable short side; enable tiling or reduce the physical width.`);
  if (printer.productionKind === "3d" && routeStyle !== "none" && Number(config.routeWidth) < printer.minFeature) warnings.push(`Route width should be at least ${printer.minFeature} mm for this profile.`);
  if (printer.productionKind === "3d" && !["none","color"].includes(routeStyle) && Number(config.routeRise) < printer.minEmboss) warnings.push(`Route rise / depth should be at least ${printer.minEmboss} mm for this profile.`);
  if (Number(config.totalHeight) > 12 && /FDM|FFF/.test(printer.technology)) warnings.push("Total height above 12 mm is unnecessarily heavy for a medal.");
  if (!String(config.participant || "").trim()) warnings.push("Participant name is empty.");
  return { status: warnings.length ? "review" : "ready", warnings };
}

export function makeJob(config, gpx = null) {
  const printer = PRINTERS[config.printer];
  const event = EVENTS[config.event] || EVENTS.custom;
  const map = MAPS[config.map] || MAPS.uploaded;
  const validation = validateDesign(config);
  return {
    schema: "vyndi.terrain-medal-job/v1",
    createdAt: new Date().toISOString(),
    event: { preset: config.event, name: config.eventName || event.name, editionDate: config.eventDate || "", location: config.eventLocation || "", distance: config.distance || event.distance, participant: config.participant, bib: config.bib || "", start: config.startDetail || "", finish: config.finishDetail || "" },
    result: { elapsed: config.elapsedTime || "", status: config.resultStatus || "", placing: config.placing || "" },
    geography: { ...(config.geography || {}), terrainEnvironment: config.terrainEnvironment || "auto" },
    provenance: { event: config.eventSource || null, participant: config.participantSource || null, geography: config.geography?.source ? { source: config.geography.source } : null },
    map: { preset: config.map, name: map.name, source: map.terrain, printArea: config.printArea ? { ...config.printArea, bounds: config.printArea.bounds ? { ...config.printArea.bounds } : null } : null, cartography: { provider: "OpenFreeMap", schema: "OpenMapTiles", data: "OpenStreetMap", attribution: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" }, gpx: gpx ? { filename: gpx.filename, pointCount: gpx.sourcePointCount || gpx.points.length, previewPointCount: gpx.points.length, bounds: gpx.bounds, distanceKm: gpx.distanceKm || 0, elevationGainM: gpx.elevationGainM || 0, movingTimeSeconds: gpx.movingTimeSeconds || 0, elapsedTimeSeconds: gpx.elapsedTimeSeconds || 0 } : null },
    water: { mode: config.waterMode || "procedural-waves", shoreline: "geographic-vector-mask", storesOceanElevation: false, waveHeightMm: Number(config.waveHeight ?? 0.3), wavelengthMm: Number(config.wavelength ?? 2.6), separatePaintRegion: true },
    medal: { diameterMm: productionDiameterMm(config), presetDiameterMm: medalDiameterMm(config.diameter), baseMm: Number(config.base), reliefLimitMm: Number(config.reliefLimit), exaggeration: Number(config.exaggeration), routeWidthMm: Number(config.routeWidth), routeRiseMm: Number(config.routeRise), routeStyle: config.routeStyle || "raised", totalHeightMm: Number(config.totalHeight) },
    production: { preset: config.printer, ...printer },
    validation
  };
}

const PBP_FRANCE_CONTEXT = Object.freeze({ minLat: 41.15, maxLat: 51.35, minLon: -5.75, maxLon: 9.75 });

export function mapContextBounds(eventPreset, routeBounds) {
  if (eventPreset === "pbp2023") return { ...PBP_FRANCE_CONTEXT };
  if (eventPreset === "k2k2025") return expandBoundsByMargin(routeBounds, 12);
  if (eventPreset === "marathon") return expandBoundsByMargin(routeBounds, 50);
  return expandBoundsByMargin(routeBounds, 65);
}

export function mapContextLabel(eventPreset) {
  return eventPreset === "pbp2023" ? "France context" : "Regional context";
}

export function mapFrameSize(eventPreset) {
  return eventPreset === "pbp2023" ? 1.85 : 1.45;
}

export function expandBoundsByMargin(bounds, marginPercent = 18) {
  const minLat = Number(bounds?.minLat), maxLat = Number(bounds?.maxLat), minLon = Number(bounds?.minLon), maxLon = Number(bounds?.maxLon);
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || minLat >= maxLat || minLon >= maxLon) throw new Error("Valid geographic bounds are required.");
  const margin = Math.max(0, Math.min(100, Number(marginPercent) || 0)) / 100;
  const latPad = (maxLat - minLat) * margin;
  const lonPad = (maxLon - minLon) * margin;
  return {
    minLat: Number(Math.max(-85, minLat - latPad).toFixed(6)),
    maxLat: Number(Math.min(85, maxLat + latPad).toFixed(6)),
    minLon: Number(Math.max(-180, minLon - lonPad).toFixed(6)),
    maxLon: Number(Math.min(180, maxLon + lonPad).toFixed(6))
  };
}

export function expandBoundsByDistanceKm(bounds, bufferKm = 5) {
  const minLat = Number(bounds?.minLat), maxLat = Number(bounds?.maxLat), minLon = Number(bounds?.minLon), maxLon = Number(bounds?.maxLon);
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || minLat >= maxLat || minLon >= maxLon) throw new Error("Valid geographic bounds are required.");
  const km = Math.max(0, Math.min(250, Number(bufferKm) || 0));
  const midLat = (minLat + maxLat) / 2;
  const latPad = km / 111.32;
  const lonScale = Math.max(0.05, Math.cos(midLat * Math.PI / 180));
  const lonPad = km / (111.32 * lonScale);
  return {
    minLat: Number(Math.max(-85, minLat - latPad).toFixed(6)),
    maxLat: Number(Math.min(85, maxLat + latPad).toFixed(6)),
    minLon: Number(Math.max(-180, minLon - lonPad).toFixed(6)),
    maxLon: Number(Math.min(180, maxLon + lonPad).toFixed(6))
  };
}

export function balanceBoundsForMapContext(bounds, maxAspect = 1.8) {
  const minLat = Number(bounds?.minLat), maxLat = Number(bounds?.maxLat), minLon = Number(bounds?.minLon), maxLon = Number(bounds?.maxLon);
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || minLat >= maxLat || minLon >= maxLon) throw new Error("Valid geographic bounds are required.");
  const aspectLimit = Math.max(1, Number(maxAspect) || 1.8);
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const lonScale = Math.max(0.05, Math.cos(midLat * Math.PI / 180));
  let latSpan = maxLat - minLat;
  let lonSpan = maxLon - minLon;
  const projectedWidth = lonSpan * lonScale;
  const projectedHeight = latSpan;
  if (projectedWidth / projectedHeight > aspectLimit) {
    latSpan = projectedWidth / aspectLimit;
  } else if (projectedHeight / projectedWidth > aspectLimit) {
    lonSpan = (projectedHeight / aspectLimit) / lonScale;
  }
  return {
    minLat: Number(Math.max(-85, midLat - latSpan / 2).toFixed(6)),
    maxLat: Number(Math.min(85, midLat + latSpan / 2).toFixed(6)),
    minLon: Number(Math.max(-180, midLon - lonSpan / 2).toFixed(6)),
    maxLon: Number(Math.min(180, midLon + lonSpan / 2).toFixed(6))
  };
}

export function viewerBoundsFromZoom(bounds, zoom) {
  const minLat = Number(bounds?.minLat), maxLat = Number(bounds?.maxLat), minLon = Number(bounds?.minLon), maxLon = Number(bounds?.maxLon);
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || minLat >= maxLat || minLon >= maxLon) throw new Error("Valid geographic bounds are required.");
  const factor = Math.max(0.25, Math.min(1, 1 / Math.max(1, Number(zoom) || 1)));
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const halfLat = (maxLat - minLat) * factor / 2;
  const halfLon = (maxLon - minLon) * factor / 2;
  return {
    minLat: Number((midLat - halfLat).toFixed(6)),
    maxLat: Number((midLat + halfLat).toFixed(6)),
    minLon: Number((midLon - halfLon).toFixed(6)),
    maxLon: Number((midLon + halfLon).toFixed(6))
  };
}

export function medalCoverageBounds(bounds, routeSize = 1.45, radius = 1.02) {
  const minLat = Number(bounds?.minLat), maxLat = Number(bounds?.maxLat), minLon = Number(bounds?.minLon), maxLon = Number(bounds?.maxLon);
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite) || minLat >= maxLat || minLon >= maxLon) throw new Error("Valid GPX bounds are required.");
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;
  const lonScale = Math.max(0.05, Math.cos(midLat * Math.PI / 180));
  const projectedWidth = (maxLon - minLon) * lonScale;
  const projectedHeight = maxLat - minLat;
  const routeExtent = Math.max(projectedWidth, projectedHeight, 0.000001);
  const halfProjectedCoverage = routeExtent * Math.max(1, Number(radius) || 1) / Math.max(0.1, Number(routeSize) || 1.45);
  return {
    minLat: Math.max(-85, midLat - halfProjectedCoverage),
    maxLat: Math.min(85, midLat + halfProjectedCoverage),
    minLon: Math.max(-180, midLon - halfProjectedCoverage / lonScale),
    maxLon: Math.min(180, midLon + halfProjectedCoverage / lonScale)
  };
}

export function normalizeElevationRange(elevation, minElevation, maxElevation) {
  const elevationValue = Number(elevation), minimum = Number(minElevation), maximum = Number(maxElevation);
  if (![elevationValue, minimum, maximum].every(Number.isFinite) || maximum <= minimum) return 0;
  return Math.max(0, Math.min(1, (elevationValue - minimum) / (maximum - minimum)));
}

export function projectGpxPoints(gpx, size = 1.45, frameBounds = null) {
  if (!gpx?.points?.length) return [];
  const b = frameBounds || gpx.bounds;
  const midLat = (b.minLat + b.maxLat) / 2;
  const lonScale = Math.cos(midLat * Math.PI / 180);
  const width = Math.max(0.000001, (b.maxLon - b.minLon) * lonScale);
  const height = Math.max(0.000001, b.maxLat - b.minLat);
  const extent = Math.max(width, height);
  const midLon = (b.minLon + b.maxLon) / 2;
  return gpx.points.map(point => ({
    x: ((point.lon - midLon) * lonScale / extent) * size,
    y: ((point.lat - midLat) / extent) * size,
    segment: point.segment || 0
  }));
}

function haversineDistanceKm(a, b) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export function sampleTerrariumBilinear(data,width,height,px,py){
  const w=Math.max(1,Math.floor(Number(width)||1)),h=Math.max(1,Math.floor(Number(height)||1));
  const x=Math.max(0,Math.min(w-1,Number(px)||0)),y=Math.max(0,Math.min(h-1,Number(py)||0));
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=x-x0,ty=y-y0;
  const read=(ix,iy)=>{
    const o=(iy*w+ix)*4;
    return data[o]*256+data[o+1]+data[o+2]/256-32768;
  };
  const a=read(x0,y0)*(1-tx)+read(x1,y0)*tx;
  const b=read(x0,y1)*(1-tx)+read(x1,y1)*tx;
  return a*(1-ty)+b*ty;
}

export function mergeGpxRoutes(routes=[]){
  const valid=(routes||[]).filter(route=>route?.points?.length>=2);
  if(!valid.length)throw new Error("At least one parsed GPX route is required.");
  if(valid.length===1)return {...valid[0],routeCount:1,filenames:[valid[0].filename]};
  const points=[],bounds={minLat:Infinity,maxLat:-Infinity,minLon:Infinity,maxLon:-Infinity,minEle:Infinity,maxEle:-Infinity};
  let sourcePointCount=0,distanceKm=0,elevationGainM=0,movingTimeSeconds=0,elapsedTimeSeconds=0,segmentOffset=0,previewStride=1;
  for(const route of valid){
    const routeSegments=Math.max(1,Number(route.segmentCount)||1);
    for(const point of route.points)points.push({...point,segment:(Number(point.segment)||1)+segmentOffset});
    segmentOffset+=routeSegments;
    sourcePointCount+=Number(route.sourcePointCount)||route.points.length;
    distanceKm+=Number(route.distanceKm)||0;
    elevationGainM+=Number(route.elevationGainM)||0;
    movingTimeSeconds+=Number(route.movingTimeSeconds)||0;
    elapsedTimeSeconds+=Number(route.elapsedTimeSeconds)||0;
    previewStride=Math.max(previewStride,Number(route.previewStride)||1);
    bounds.minLat=Math.min(bounds.minLat,route.bounds.minLat);bounds.maxLat=Math.max(bounds.maxLat,route.bounds.maxLat);
    bounds.minLon=Math.min(bounds.minLon,route.bounds.minLon);bounds.maxLon=Math.max(bounds.maxLon,route.bounds.maxLon);
    bounds.minEle=Math.min(bounds.minEle,route.bounds.minEle);bounds.maxEle=Math.max(bounds.maxEle,route.bounds.maxEle);
  }
  return {
    filename:`${valid.length} GPX routes`,filenames:valid.map(route=>route.filename),routeCount:valid.length,
    points,sourcePointCount,previewStride,segmentCount:segmentOffset,distanceKm:Number(distanceKm.toFixed(2)),
    elevationGainM:Number(elevationGainM.toFixed(1)),movingTimeSeconds:Math.round(movingTimeSeconds),elapsedTimeSeconds:Math.round(elapsedTimeSeconds),bounds
  };
}

export function parseGpxText(text, filename = "route.gpx") {
  const maximumPreviewPoints = 20000;
  const source = String(text);
  const pointType = /<trkpt\b/i.test(source) ? "trkpt" : "rtept";
  const pattern = new RegExp(`<${pointType}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${pointType}>)`, "gi");
  const points = [];
  const bounds = { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity, minEle: Infinity, maxEle: -Infinity };
  let sourcePointCount = 0;
  let previewStride = 1;
  let lastPoint = null;
  let lastDistancePoint = null;
  let lastElevationPoint = null;
  let lastTimedPoint = null;
  let firstTimeMs = null;
  let lastTimeMs = null;
  let distanceKm = 0;
  let elevationGainM = 0;
  let movingTimeSeconds = 0;
  let segment = 0;
  let previousEnd = 0;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const between = source.slice(previousEnd, match.index);
    const openings = between.match(/<(?:trkseg|rte)\b/gi);
    if (openings) segment += openings.length;
    previousEnd = pattern.lastIndex;
    const lat = (match[1].match(/\blat=["']([^"']+)["']/i) || [])[1];
    const lon = (match[1].match(/\blon=["']([^"']+)["']/i) || [])[1];
    const body = match[2] || "";
    const eleMatch = body.match(/<ele>([^<]+)<\/ele>/i);
    const timeMatch = body.match(/<time>([^<]+)<\/time>/i);
    const ele = eleMatch ? Number(eleMatch[1]) : null;
    const timeMs = timeMatch ? Date.parse(timeMatch[1]) : NaN;
    const point = { lat: Number(lat), lon: Number(lon), ele: Number.isFinite(ele) ? ele : 0, hasElevation: Number.isFinite(ele), time: Number.isFinite(timeMs) ? new Date(timeMs).toISOString() : "", segment };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
    sourcePointCount += 1;
    if (lastDistancePoint && lastDistancePoint.segment === point.segment) distanceKm += haversineDistanceKm(lastDistancePoint, point);
    if (point.hasElevation && lastElevationPoint?.hasElevation && lastElevationPoint.segment === point.segment) elevationGainM += Math.max(0, point.ele - lastElevationPoint.ele);
    if (point.hasElevation) lastElevationPoint = point;
    else if (lastElevationPoint?.segment !== point.segment) lastElevationPoint = null;
    if (Number.isFinite(timeMs)) {
      if (firstTimeMs === null) firstTimeMs = timeMs;
      lastTimeMs = timeMs;
      if (lastTimedPoint && lastTimedPoint.segment === point.segment && Number.isFinite(lastTimedPoint.timeMs)) {
        const deltaSeconds = (timeMs - lastTimedPoint.timeMs) / 1000;
        if (deltaSeconds > 0 && deltaSeconds <= 21600) {
          const legKm = haversineDistanceKm(lastTimedPoint, point);
          const speedKmh = legKm / (deltaSeconds / 3600);
          if (speedKmh >= 0.5 && speedKmh <= 200) movingTimeSeconds += deltaSeconds;
        }
      }
      lastTimedPoint = { ...point, timeMs };
    }
    lastDistancePoint = point;
    lastPoint = point;
    bounds.minLat = Math.min(bounds.minLat, point.lat); bounds.maxLat = Math.max(bounds.maxLat, point.lat);
    bounds.minLon = Math.min(bounds.minLon, point.lon); bounds.maxLon = Math.max(bounds.maxLon, point.lon);
    if (point.hasElevation) {
      bounds.minEle = Math.min(bounds.minEle, point.ele); bounds.maxEle = Math.max(bounds.maxEle, point.ele);
    }
    if ((sourcePointCount - 1) % previewStride === 0) points.push(point);
    if (points.length > maximumPreviewPoints) {
      const reduced = points.filter((_, index) => index % 2 === 0);
      points.length = 0;
      points.push(...reduced);
      previewStride *= 2;
    }
  }
  if (sourcePointCount < 2) throw new Error("The GPX must contain at least two track or route points.");
  if (lastPoint && points.at(-1) !== lastPoint) {
    if (points.length >= maximumPreviewPoints) points.pop();
    points.push(lastPoint);
  }
  if (!Number.isFinite(bounds.minEle)) bounds.minEle = 0;
  if (!Number.isFinite(bounds.maxEle)) bounds.maxEle = 0;
  const elapsedTimeSeconds = firstTimeMs !== null && lastTimeMs !== null && lastTimeMs >= firstTimeMs ? Math.round((lastTimeMs - firstTimeMs) / 1000) : 0;
  return {
    filename, points, sourcePointCount, previewStride, segmentCount: Math.max(1, segment),
    distanceKm: Number(distanceKm.toFixed(2)), elevationGainM: Number(elevationGainM.toFixed(1)),
    movingTimeSeconds: Math.round(movingTimeSeconds), elapsedTimeSeconds, bounds
  };
}
