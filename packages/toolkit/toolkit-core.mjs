import { parseGpxText, extractGpxName, serializeGpxRoute, shouldPreprocessLiveGpx, processGpxTextJob, mergeGpxRoutes } from "../gpx/gpx-core.mjs";
export { parseGpxText, extractGpxName, serializeGpxRoute, shouldPreprocessLiveGpx, processGpxTextJob, mergeGpxRoutes } from "../gpx/gpx-core.mjs";
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
  alignmentSocketDepth,
  contourEmbossHeight,
  rasterSampler
} from "../engine/fabrication-extras-core.mjs";
import {
  projectGeographicOutline,
  filterPrintableOutlinePolygons,
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
export const PRINTER_PROFILES=Object.freeze({
  "bambu-p1s":{label:"Bambu Lab P1S / AMS",technology:"FDM",nozzleMm:.4,minFeatureMm:.8,minEmbossMm:.3,recommendedLayerMm:.16,bed:[256,256,256],slicers:["Bambu Studio","OrcaSlicer"],preferredFormat:"3mf"},
  "generic-fdm":{label:"Generic FDM · 0.4 mm nozzle",technology:"FDM",nozzleMm:.4,minFeatureMm:.8,minEmbossMm:.3,recommendedLayerMm:.2,bed:[220,220,250],slicers:["PrusaSlicer","Cura"],preferredFormat:"3mf"},
  "fine-fdm":{label:"Fine FDM · 0.25 mm nozzle",technology:"FDM",nozzleMm:.25,minFeatureMm:.5,minEmbossMm:.2,recommendedLayerMm:.12,bed:[180,180,180],slicers:["Bambu Studio","OrcaSlicer","PrusaSlicer"],preferredFormat:"3mf"},
  "resin":{label:"MSLA / SLA resin",technology:"MSLA",nozzleMm:.25,minFeatureMm:.35,minEmbossMm:.18,recommendedLayerMm:.05,bed:[130,80,160],slicers:["Lychee","Chitubox"],preferredFormat:"stl"},
  "sls":{label:"SLS / MJF service",technology:"SLS",nozzleMm:.4,minFeatureMm:.6,minEmbossMm:.25,recommendedLayerMm:.1,bed:[250,250,250],slicers:["Service bureau"],preferredFormat:"stl"}
});


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

export function premiumRimTextCopy(customization={}){
  const meta=normalizeCustomization(customization);
  const elevation=meta.elevation?(meta.elevation.trim().startsWith("+")?meta.elevation:"+"+meta.elevation):"";
  return {event:meta.event,stats:[meta.distance,elevation,meta.duration].filter(Boolean).join(" - ")};
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
    colors:{land:"#b7a77a",forest:"#3f6b3a",mountain:"#8a7a68",snow:"#f4f3ee",water:"#3d86b8",terrain:"#b7a77a",route:"#ff6a1f",roads:"#c9c1b5",trails:"#3f6b3a",railways:"#7e8791",buildings:"#d8d1c4",logo:"#f2c14e",text:"#f2c14e",rim:"#23201d"},
    terrainBands:{mountainM:1200,snowM:2600,seaLevelM:1.5},
    surface:{forestRaiseMm:.4,waterDepthMm:1.1,waterMode:"procedural-waves",waveHeightMm:.45,waveSpacingMm:2.4},
    contours:{enabled:false,intervalMm:1,widthMm:.08,riseMm:.2},
    placeLabels:{mode:"major",selectedNames:[],maxCount:18},
    production:{printerProfile:"bambu-p1s",medalSize:"custom",surfaceLettering:"auto",rimTextLayout:"standard",bottomMark:"",bottomEngraveDepthMm:.35},
    customization:{event:"",name:"",date:"",distance:"",elevation:"",duration:""},
    fabrication:{
      modelWidthMm:180,baseMm:3,reliefMm:12,targetXyMm:1,
      routeStyle:"raised",routeWidthMm:1.6,routeRiseMm:1.2,
      rimWidthMm:12,rimHeightMm:5,
      tiled:false,maxTileMm:200,maxTileWidthMm:200,maxTileHeightMm:200,jointType:"dovetail",jointDiameterMm:8,jointDepthMm:2,jointClearanceMm:.2,
      magnetEnabled:false,magnetDiameterMm:8,magnetDepthMm:2,magnetSpacingMm:30,
      hangerEnabled:false,hangerInnerDiameterMm:6,hangerWallMm:3,
      standEnabled:false,heightmapStrengthMm:0
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

export function surfaceLetteringAllowed({shapeKind="circle",modelWidthMm=180,mode="auto"}={}){
  const policy=String(mode||"auto");
  if(policy==="none")return false;
  if(policy==="full")return true;
  return !(shapeKind==="geographic"&&Number(modelWidthMm)<140);
}

export function professionalHangerPlacement({outlinePolygons=null,extents=null,radiusMm=50,innerRadiusMm=3,wallMm=3,baseMm=3}={}){
  const radius=Math.max(1,Number(radiusMm)||50),inner=Math.max(1,Number(innerRadiusMm)||3),wall=Math.max(1,Number(wallMm)||3),outer=inner+wall;
  let anchorX=0,anchorY=Number(extents?.maxY)||radius;
  if(Array.isArray(outlinePolygons)&&outlinePolygons.length){
    const ranked=outlinePolygons.map(rings=>{
      const ring=rings?.[0]||[];let signed=0;
      for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];signed+=a.x*b.y-b.x*a.y}
      return {rings,area:Math.abs(signed)/2};
    }).sort((a,b)=>b.area-a.area);
    const ring=ranked[0]?.rings?.[0]||[];
    let top=null;
    for(const p of ring)if(!top||p.y>top.y)top=p;
    if(top){anchorX=top.x*radius;anchorY=top.y*radius}
  }
  const overlap=Math.max(wall*1.15,outer*.34),centerY=anchorY+outer*.64;
  const bridgeHalf=Math.max(wall*.72,1.4);
  return {
    anchorX,anchorY,centerX:anchorX,centerY,innerRadiusMm:inner,outerRadiusMm:outer,
    heightMm:Math.max(.8,Number(baseMm)||3)+1.5,
    bridge:{minX:anchorX-bridgeHalf,maxX:anchorX+bridgeHalf,minY:anchorY-overlap,maxY:centerY-inner*.35}
  };
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

export function expandBoundsKm(bounds,distanceKm=0){
  const km=Math.max(0,Number(distanceKm)||0);
  if(!km)return {...bounds};
  const midLat=(Number(bounds.minLat)+Number(bounds.maxLat))/2;
  const latPad=km/111.32,lonPad=km/(111.32*Math.max(.08,Math.cos(midLat*Math.PI/180)));
  return {
    minLat:Math.max(-85,Number(bounds.minLat)-latPad),maxLat:Math.min(85,Number(bounds.maxLat)+latPad),
    minLon:Math.max(-180,Number(bounds.minLon)-lonPad),maxLon:Math.min(180,Number(bounds.maxLon)+lonPad)
  };
}

export function productionBounds(route,shape={}){
  if((shape?.kind==="geographic"||shape?.kind==="geo-medallion")&&shape?.outlineGeometry){
    const geo=geometryBounds(shape.outlineGeometry);
    if(shape.kind==="geographic")return expandBounds(geo,.015);
    const base=expandBounds(geo,.12),midLat=(base.minLat+base.maxLat)/2,midLon=(base.minLon+base.maxLon)/2;
    const lonScale=Math.max(.08,Math.cos(midLat*Math.PI/180)),geoWidth=(base.maxLon-base.minLon)*lonScale,geoHeight=base.maxLat-base.minLat,extent=Math.max(geoWidth,geoHeight)*1.08;
    return {
      minLat:Math.max(-85,midLat-extent/2),maxLat:Math.min(85,midLat+extent/2),
      minLon:Math.max(-180,midLon-extent/(2*lonScale)),maxLon:Math.min(180,midLon+extent/(2*lonScale))
    };
  }
  const requestedKm=Math.max(0,Number(shape?.routeBufferKm)||0);
  const padded=requestedKm?expandBoundsKm(route,requestedKm):route;
  const base=requestedKm?{...padded}:expandBounds(padded,shape?.kind==="route-fit" ? .04 : .03);
  if(!shape?.kind||shape.kind==="route-fit")return base;
  const midLat=(base.minLat+base.maxLat)/2,midLon=(base.minLon+base.maxLon)/2;
  const lonScale=Math.max(.08,Math.cos(midLat*Math.PI/180));
  let geoWidth=(base.maxLon-base.minLon)*lonScale,geoHeight=base.maxLat-base.minLat;
  const targetAspect=shape.kind==="ellipse"?Math.max(.5,Math.min(2.5,Number(shape.aspect)||1.35)):1;
  const currentAspect=geoWidth/Math.max(1e-9,geoHeight);
  if(currentAspect>targetAspect)geoHeight=geoWidth/targetAspect;
  else geoWidth=geoHeight*targetAspect;
  // A route bbox fitted directly into a circle places its corners outside the printable disk.
  // TrailRelief instead reserves radial padding around the furthest route point.
  if(shape.kind==="circle"){const radialSafety=Math.SQRT2*1.15;geoWidth*=radialSafety;geoHeight*=radialSafety;}
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
    {name:"Land",color:opaqueHex(colors.land||colors.terrain,"#b7a77a"),roughness:.82},
    {name:"Forest",color:opaqueHex(colors.forest,"#3f6b3a"),roughness:.86},
    {name:"Mountain",color:opaqueHex(colors.mountain,"#8b8378"),roughness:.78},
    {name:"Snow",color:opaqueHex(colors.snow,"#f4f7f8"),roughness:.62},
    {name:"Water",color:opaqueHex(colors.water,"#2f86a6"),roughness:.42,metallic:.05},
    {name:"Route",color:opaqueHex(colors.route,"#ff6a1f"),emissive:opaqueHex(colors.route,"#ff6a1f"),roughness:.38},
    {name:"Roads",color:opaqueHex(colors.roads,"#c9c1b5"),roughness:.8},
    {name:"Trails",color:opaqueHex(colors.trails,"#3f6b3a"),roughness:.82},
    {name:"Railways",color:opaqueHex(colors.railways,"#7e8791"),roughness:.7,metallic:.08},
    {name:"Buildings",color:opaqueHex(colors.buildings,"#d8d1c4"),roughness:.74},
    {name:"Logo",color:opaqueHex(colors.logo,"#f2c14e"),roughness:.42,metallic:.16},
    {name:"Text",color:opaqueHex(colors.text,"#f2c14e"),emissive:opaqueHex(colors.text,"#f2c14e"),roughness:.4,metallic:.18},
    {name:"Rim",color:opaqueHex(colors.rim,"#23201d"),roughness:.34,metallic:.08}
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
  const seaLevelM=Number.isFinite(Number(thresholds.seaLevelM))?Number(thresholds.seaLevelM):1.5;
  if(Number.isFinite(elevation)&&elevation<=seaLevelM)return 4;
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

function buildRouteChannelField(points,projection,config){
  const style=String(config?.fabrication?.routeStyle||"raised");
  if(!["engraved","inlay"].includes(style))return ()=>0;
  const width=Math.max(.2,Number(config.fabrication.routeWidthMm)||1.2),depth=Math.max(.05,Number(config.fabrication.routeRiseMm)||.8);
  const projected=(points||[]).map(point=>projection.project(point));
  const stride=Math.max(1,Math.ceil(projected.length/1400)),route=[];
  for(let i=0;i<projected.length;i+=stride)route.push(projected[i]);
  if(projected.length&&route.at(-1)!==projected.at(-1))route.push(projected.at(-1));
  const pointSegmentDistance=(x,y,a,b)=>{
    const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
    if(d2<1e-12)return Math.hypot(x-a.x,y-a.y);
    const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/d2));
    return Math.hypot(x-(a.x+t*dx),y-(a.y+t*dy));
  };
  return (x,y)=>{
    let best=Infinity;
    for(let i=1;i<route.length;i++)best=Math.min(best,pointSegmentDistance(x,y,route[i-1],route[i]));
    if(best>=width*.62)return 0;
    const edge=Math.max(0,Math.min(1,1-best/(width*.62)));
    return depth*edge;
  };
}

function featureMeshes({points,cartography,config,projection,terrainTopMm,insideNormalized,clipRect=null,offsetX=0,offsetY=0}){
  const meshes=[],radius=projection.radius,route=points.map(point=>projection.project(point));
  const densifyProjectedRoute=(route,maxStepMm=.55,maxPoints=5200)=>{
    if(!route.length)return route;
    const out=[route[0]];
    for(let i=1;i<route.length;i++){
      const a=out.at(-1),b=route[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len>maxStepMm){const n=Math.min(24,Math.ceil(len/maxStepMm));for(let k=1;k<n;k++){if(out.length>=maxPoints-1)break;out.push({x:a.x+dx*k/n,y:a.y+dy*k/n});}}
      if(out.length>=maxPoints)break;
      out.push(b);
    }
    if(out.at(-1)!==route.at(-1)&&out.length<maxPoints)out.push(route.at(-1));
    return out;
  };
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
        let a=toMm(list[i-1]),b=toMm(list[i]);
        const clipPoint=(point)=>{
          if(insideNormalized(point.x/radius,point.y/radius))return point;
          let lo=0,hi=1,best=null;
          const anchor=insideNormalized(a.x/radius,a.y/radius)?a:insideNormalized(b.x/radius,b.y/radius)?b:null;
          if(!anchor)return null;
          const outside=anchor===a?b:a;
          for(let step=0;step<18;step++){const t=(lo+hi)/2,p={x:anchor.x+(outside.x-anchor.x)*t,y:anchor.y+(outside.y-anchor.y)*t};if(insideNormalized(p.x/radius,p.y/radius)){best=p;lo=t}else hi=t}
          return best||anchor;
        };
        const aIn=insideNormalized(a.x/radius,a.y/radius),bIn=insideNormalized(b.x/radius,b.y/radius);
        if(!aIn&&!bIn){
          const steps=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/Math.max(.5,width))),samples=[];
          for(let k=0;k<=steps;k++){const t=k/steps,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(insideNormalized(p.x/radius,p.y/radius))samples.push(p)}
          if(samples.length<2)continue;
          a=samples[0];b=samples.at(-1);
        }else{
          if(!aIn)a=clipPoint(a);if(!bIn)b=clipPoint(b);if(!a||!b)continue;
        }
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=mx/radius,ny=my/radius;
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        if(!insideNormalized(nx,ny)||!inRect(mx,my,clipRect)||len>5.5)continue;
        const zA=terrainTopMm(a.x,a.y),zB=terrainTopMm(b.x,b.y),mesh=segmentPrism(a,b,width,rise,zA,zB,region);
        if(mesh){meshes.push(shifted(mesh,offsetX,offsetY));used++;}
      }
    }
  };
  const stride=Math.max(1,Math.ceil(route.length/3200));
  let routeLite=[];
  for(let i=0;i<route.length;i+=stride)routeLite.push(route[i]);
  if(route.length&&routeLite.at(-1)!==route.at(-1))routeLite.push(route.at(-1));
  routeLite=densifyProjectedRoute(routeLite,.7,5200);
  const routeStyle=String(config.fabrication.routeStyle||"raised");
  const routeWidth=Math.max(.8,Number(config.fabrication.routeWidthMm)||1.6);
  const routeRise=Math.max(.5,Number(config.fabrication.routeRiseMm)||1.2);
  if(routeStyle==="raised")addSegments([routeLite],routeWidth,routeRise,5,4200);
  else if(routeStyle==="inlay")addSegments([routeLite],routeWidth,Math.max(.05,routeRise),5,4200);
  else if(routeStyle==="color")addSegments([routeLite],routeWidth,.1,5,4200);
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
  "+":["00000","00100","00100","11111","00100","00100","00000"],",":["00000","00000","00000","00000","00110","00100","01000"],
  " ":["00000","00000","00000","00000","00000","00000","00000"]
};

function textLineMeshes(text,{centerX=0,centerY=0,maxWidth=120,cellMm=1.2,minCellMm=.55,riseMm=.8,terrainTopMm=()=>0,inside=()=>true}={}){
  const value=String(text||"").toUpperCase().replace(/[^A-Z0-9 +,\-\/\.:]/g," ").trim();
  if(!value)return [];
  const nominalWidth=value.length*6-1;
  const cell=Math.max(Math.max(.3,Number(minCellMm)||.55),Math.min(cellMm,maxWidth/Math.max(1,nominalWidth)));
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


function curvedRimTextMeshes(text,{radiusMm,rimWidthMm,centerAngle=Math.PI/2,flipRadial=false,maxArcRad=2.7,cellMm=1.2,riseMm=.8,terrainTopMm=()=>0}={}){
  const value=String(text||"").toUpperCase().replace(/[^A-Z0-9 +,\-\/\.:]/g," ").trim();
  const outer=Math.max(1,Number(radiusMm)||0),rim=Math.max(0,Number(rimWidthMm)||0);
  if(!value||rim<2||outer<=rim)return [];
  const arcRadius=outer-rim/2,nominalWidth=value.length*6-1;
  const cell=Math.max(.45,Math.min(Number(cellMm)||1.2,arcRadius*Math.max(.5,maxArcRad)/Math.max(1,nominalWidth),rim/8));
  const totalWidth=nominalWidth*cell,startU=-totalWidth/2,meshes=[];
  const map=(u,v)=>{
    const theta=flipRadial?centerAngle+u/arcRadius:centerAngle-u/arcRadius;
    const radial=flipRadial?arcRadius-v:arcRadius+v;
    return {x:radial*Math.cos(theta),y:radial*Math.sin(theta)};
  };
  for(let ci=0;ci<value.length;ci++){
    const glyph=GLYPH_5X7[value[ci]]||GLYPH_5X7[" "];
    for(let row=0;row<7;row++)for(let col=0;col<5;col++){
      if(glyph[row][col]!=="1")continue;
      const u0=startU+(ci*6+col)*cell,u1=u0+cell*.82;
      const v1=(3.5-row)*cell,v0=v1-cell*.82;
      const points=[map(u0,v0),map(u1,v0),map(u1,v1),map(u0,v1)];
      if(points.some(p=>Math.hypot(p.x,p.y)>outer+.001||Math.hypot(p.x,p.y)<outer-rim-.001))continue;
      try{
        meshes.push(buildExtrudedPolygonMesh({
          points,
          baseZAt:(x,y)=>terrainTopMm(x,y),
          heightMm:Math.max(.3,riseMm),
          region:11
        }));
      }catch{}
    }
  }
  return meshes;
}

export function buildPersonalizationMeshes({customization={},extents,insideNormalized,radius,terrainTopMm,riseMm=.8,rimWidthMm=0,shape="",layout="standard"}={}){
  if(!extents||!Number.isFinite(radius)||radius<=0||typeof terrainTopMm!=="function")return [];
  const meta=normalizeCustomization(customization);
  const identity=[meta.name,meta.date].filter(Boolean).join(" · ");
  const stats=[meta.distance,meta.elevation,meta.duration].filter(Boolean).join(" · ");
  if(!meta.event&&!identity&&!stats)return [];
  const width=Math.max(1,extents.maxX-extents.minX),height=Math.max(1,extents.maxY-extents.minY);
  const inside=(x,y)=>typeof insideNormalized==="function"?insideNormalized(x/radius,y/radius):true;
  const meshes=[],maxWidth=width*.82,baseCell=Math.max(.7,Math.min(2.4,width/105));
  if(shape==="circle"&&Number(rimWidthMm)>=2){
    if(layout==="expedition"){
      const copy=premiumRimTextCopy(meta);
      if(copy.event)meshes.push(...curvedRimTextMeshes(copy.event,{
        radiusMm:radius,rimWidthMm,centerAngle:Math.PI,maxArcRad:2.18,cellMm:baseCell*.82,
        riseMm:Math.max(.42,riseMm*.88),terrainTopMm
      }));
      if(copy.stats)meshes.push(...curvedRimTextMeshes(copy.stats,{
        radiusMm:radius,rimWidthMm,centerAngle:-Math.PI/4,flipRadial:true,maxArcRad:2.0,cellMm:baseCell*.72,
        riseMm:Math.max(.34,riseMm*.74),terrainTopMm
      }));
      return meshes;
    }
    if(meta.event)meshes.push(...curvedRimTextMeshes(meta.event,{
      radiusMm:radius,rimWidthMm,centerAngle:Math.PI/2,maxArcRad:2.65,cellMm:baseCell,
      riseMm:Math.max(.45,riseMm),terrainTopMm
    }));
    const lower=[identity,stats].filter(Boolean).join(" - ");
    if(lower)meshes.push(...curvedRimTextMeshes(lower,{
      radiusMm:radius,rimWidthMm,centerAngle:-Math.PI/2,flipRadial:true,maxArcRad:2.8,cellMm:baseCell*.72,
      riseMm:Math.max(.35,riseMm*.78),terrainTopMm
    }));
    return meshes;
  }
  if(meta.event)meshes.push(...textLineMeshes(meta.event,{
    centerX:0,centerY:extents.maxY-height*.17,maxWidth,cellMm:baseCell,
    riseMm:Math.max(.45,riseMm),terrainTopMm,inside
  }));
  if(identity)meshes.push(...textLineMeshes(identity,{
    centerX:0,centerY:extents.minY+height*.18,maxWidth,cellMm:baseCell*.78,
    riseMm:Math.max(.35,riseMm*.82),terrainTopMm,inside
  }));
  if(stats)meshes.push(...textLineMeshes(stats,{
    centerX:0,centerY:extents.minY+height*.105,maxWidth,cellMm:baseCell*.56,
    riseMm:Math.max(.3,riseMm*.68),terrainTopMm,inside
  }));
  return meshes;
}

export function planProfessionalPlaceLabels({places=[],mode="major",selectedNames=[],maxLabels=18,shapeKind="route-fit",modelWidthMm=180,radius=90,insideNormalized=()=>true}={}){
  if(mode==="none")return [];
  const selected=new Set((selectedNames||[]).map(name=>String(name).toLowerCase()));
  let candidates=(places||[]).filter(p=>p?.name&&["city","town","village"].includes(p.class));
  const smallGeo=shapeKind==="geographic"&&Number(modelWidthMm)<120;
  const mediumGeo=shapeKind==="geographic"&&Number(modelWidthMm)<180;
  if(mode==="selected")candidates=candidates.filter(p=>selected.has(String(p.name).toLowerCase()));
  else if(mode==="major")candidates=candidates.filter(p=>smallGeo?p.class==="city":p.class==="city"||p.class==="town");
  const physicalLimit=smallGeo?Math.max(2,Math.min(4,Math.floor(Number(modelWidthMm)/19))):mediumGeo?Math.min(8,maxLabels):maxLabels;
  const limit=Math.max(0,Math.min(maxLabels,physicalLimit)),occupied=[],plan=[];
  const collision=radius*(smallGeo ? .30 : (mediumGeo ? .24 : .18));
  for(const place of candidates){
    if(plan.length>=limit)break;
    const nx=Number(place.x),ny=Number(place.y);
    if(!Number.isFinite(nx)||!Number.isFinite(ny)||!insideNormalized(nx,ny))continue;
    if(shapeKind!=="geographic"&&(ny>.56||ny<-.56))continue;
    const x=nx*radius,y=ny*radius;
    if(occupied.some(p=>Math.hypot(p.x-x,p.y-y)<collision))continue;
    const cellMm=smallGeo?Math.max(.48,radius/110):place.class==="city"?Math.max(.56,radius/92):place.class==="town"?Math.max(.52,radius/104):Math.max(.48,radius/116);
    plan.push({place,x,y,cellMm,maxWidthMm:radius*(smallGeo ? .34 : (mediumGeo ? .38 : .42)),riseMm:smallGeo ? .34 : .38,minCellMm:smallGeo ? .48 : .5});
    occupied.push({x,y});
  }
  return plan;
}

export function buildPlaceLabelMeshes({cartography,projection,terrainTopMm,insideNormalized,maxLabels=18,mode="major",selectedNames=[],shapeKind="route-fit",modelWidthMm=180,plan=null}={}){
  if(mode==="none"||!projection||typeof terrainTopMm!=="function")return [];
  const radius=projection.radius,meshes=[];
  const planned=plan||planProfessionalPlaceLabels({places:cartography?.places||[],mode,selectedNames,maxLabels,shapeKind,modelWidthMm,radius,insideNormalized});
  for(const item of planned){
    const labels=textLineMeshes(String(item.place.name),{
      centerX:item.x,centerY:item.y,maxWidth:item.maxWidthMm,cellMm:item.cellMm,minCellMm:item.minCellMm,riseMm:item.riseMm,
      terrainTopMm,inside:(px,py)=>insideNormalized(px/radius,py/radius)
    });
    meshes.push(...labels);
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

function bottomTextDepthAt(x,y,config,extents){
  const value=String(config?.production?.bottomMark||"").toUpperCase().replace(/[^A-Z0-9 +,\-\/\.:]/g," ").trim();
  const depth=Math.max(0,Math.min(Math.max(.05,Number(config?.fabrication?.baseMm)||3)-.2,Number(config?.production?.bottomEngraveDepthMm)||0));
  if(!value||depth<=0||!extents)return 0;
  const width=Math.max(1,extents.maxX-extents.minX),maxWidth=width*.72,nominal=Math.max(1,value.length*6-1);
  const cell=Math.max(.55,Math.min(1.55,maxWidth/nominal));
  const total=nominal*cell,startX=-total/2,topY=3.5*cell;
  const u=(x-startX)/cell,v=(topY-y)/cell;
  if(u<0||v<0)return 0;
  const ci=Math.floor(u/6),col=Math.floor(u-ci*6),row=Math.floor(v);
  if(ci<0||ci>=value.length||col<0||col>4||row<0||row>6)return 0;
  const fracX=u-Math.floor(u),fracY=v-Math.floor(v);
  if(fracX>.84||fracY>.84)return 0;
  const glyph=GLYPH_5X7[value[ci]]||GLYPH_5X7[" "];
  return glyph[row]?.[col]==="1"?depth:0;
}

function makePockets(config,extents){
  if(!config.fabrication.magnetEnabled)return [];
  const maxX=(extents.maxX-extents.minX)*.32,maxY=(extents.maxY-extents.minY)*.32;
  const halfSpacing=Math.max(4,(Number(config.fabrication.magnetSpacingMm)||30)/2);
  const x=Math.min(maxX,halfSpacing),y=Math.min(maxY,halfSpacing);
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
    widthMm,heightMm,targetXyMm:config.fabrication.targetXyMm,maxVerticesPerTile:160000,maxTileMm:Math.min(Number(config.fabrication.maxTileWidthMm)||config.fabrication.maxTileMm,Number(config.fabrication.maxTileHeightMm)||config.fabrication.maxTileMm)
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
          if(config.fabrication.jointType==="dovetail")depth=Math.max(depth,dovetailSlotDepth(lx,ly,tile,connector,{lengthMm:16,headWidthMm:8,neckWidthMm:5,depthMm:Math.min(config.fabrication.baseMm-.4,Number(config.fabrication.jointDepthMm)||2)}));
          if(config.fabrication.jointType==="pin")depth=Math.max(depth,alignmentSocketDepth(lx,ly,tile,connector,{diameterMm:Number(config.fabrication.jointDiameterMm)||8,depthMm:Math.min(config.fabrication.baseMm-.4,Number(config.fabrication.jointDepthMm)||2)}));
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
    const clearance=Math.max(0,Number(config.fabrication.jointClearanceMm)||0);const puck=buildCylinderMesh({diameterMm:Math.max(1,(Number(config.fabrication.jointDiameterMm)||8)-clearance),heightMm:Math.max(.5,Number(config.fabrication.jointDepthMm)||2),segments:48,region:6});
    files.push({name:"alignment-puck.stl",data:encodeBinaryStl(puck,{name:"TrailRelief alignment puck"})});
  }
  files.push({name:"manifest.json",data:JSON.stringify({...plan,jointQuantity:config.fabrication.jointType==="flat"?0:jointPairs},null,2)});
  return {plan,bundle:encodeArtifactZip(files)};
}

export async function generateProductionModel({points,demSampler,cartography=null,landcover=[],config={},outlineGeometry=null,logoImage=null,heightmapImage=null,title="TrailRelief"}={}){
  if(!Array.isArray(points)||points.length<2)throw new Error("Upload a GPX route first.");
  if(typeof demSampler!=="function")throw new Error("An elevation source is required.");
  const c=normalizeAdvancedConfig(config);
  const profile=PRINTER_PROFILES[c.production.printerProfile]||PRINTER_PROFILES["bambu-p1s"];
  const geometry=outlineGeometry||c.shape.outlineGeometry;
  const geographicMode=c.shape.kind==="geographic"||c.shape.kind==="geo-medallion";
  const medallionMode=c.shape.kind==="geo-medallion";
  if(geographicMode&&!geometry)throw new Error("Geographic terrain requires a GeoJSON Polygon or MultiPolygon.");
  const shapeForBounds={...c.shape,outlineGeometry:geometry};
  const bounds=productionBounds(routeBounds(points),shapeForBounds),projection=makeProjection(bounds,c.fabrication.modelWidthMm);
  let outlinePolygons=null,outlineFilter={kept:[],removed:[],metrics:{kept:[],removed:[]}};
  if(geographicMode){
    const projected=projectGeographicOutline(geometry,bounds,2);
    outlineFilter=filterPrintableOutlinePolygons(projected,{radiusMm:projection.radius,minSpanMm:Math.max(1.2,profile.minFeatureMm*1.5),minAreaMm2:Math.max(1.4,profile.minFeatureMm*profile.minFeatureMm*2.2),maxComponents:24});
    outlinePolygons=outlineFilter.kept;
  }
  const insideNormalized=(nx,ny)=>{
    if(c.shape.kind==="route-fit")return Math.abs(nx*projection.radius)<=projection.widthMm/2+.001&&Math.abs(ny*projection.radius)<=projection.heightMm/2+.001;
    if(c.shape.kind==="geographic")return insidePolygons(nx,ny,outlinePolygons);
    if(medallionMode)return pointInsideShape(nx,ny,"circle",{aspect:1});
    return pointInsideShape(nx,ny,c.shape.kind,{aspect:c.shape.aspect});
  };
  // TrailRelief's 12 mm rim is ~13% of a 180 mm object's radius; preserve that proportion on smaller medals.
  const rimWidthMm=Math.max(0,Math.min(projection.radius*.14,Number(c.fabrication.rimWidthMm)||0));
  const rimHeightMm=Math.max(0,Number(c.fabrication.rimHeightMm)||0);
  const rimScale=Math.max(.45,1-rimWidthMm/projection.radius);
  const contentInsideNormalized=(nx,ny)=>{
    if(!insideNormalized(nx,ny))return false;
    if(!rimWidthMm||c.shape.kind==="geographic")return true;
    if(c.shape.kind==="route-fit"){
      const halfW=projection.widthMm/2-rimWidthMm,halfH=projection.heightMm/2-rimWidthMm;
      return halfW>0&&halfH>0&&Math.abs(nx*projection.radius)<=halfW&&Math.abs(ny*projection.radius)<=halfH;
    }
    return pointInsideShape(nx/rimScale,ny/rimScale,c.shape.kind,{aspect:c.shape.aspect});
  };
  const isRimNormalized=(nx,ny)=>rimWidthMm>0&&insideNormalized(nx,ny)&&!contentInsideNormalized(nx,ny);
  const landInsideNormalized=(nx,ny)=>medallionMode?insidePolygons(nx,ny,outlinePolygons):contentInsideNormalized(nx,ny);
  const range=sampleRange(demSampler,bounds,(nx,ny)=>contentInsideNormalized(nx,ny)&&landInsideNormalized(nx,ny));
  const landcoverIndex=prepareTerrainLandcover(landcover,bounds);
  const heightmapSampler=heightmapImage?rasterSampler(heightmapImage,{channel:"luminance"}):null;
  const routeChannelAt=buildRouteChannelField(points,projection,c);
  const routeCorrection=buildRouteElevationCorrection(points,demSampler,projection,range,{
    mode:c.dem.routeElevationMode,blend:c.dem.routeElevationBlend,maxDeltaM:c.dem.maxDeltaM,
    reliefMm:c.fabrication.reliefMm,routeWidthMm:c.fabrication.routeWidthMm
  });
  const terrainHeightNormalized=(nx,ny)=>{
    if(!insideNormalized(nx,ny))return 0;
    if(isRimNormalized(nx,ny))return rimHeightMm;
    if(!contentInsideNormalized(nx,ny))return 0;
    if(medallionMode&&!landInsideNormalized(nx,ny)){
      if(c.surface.waterMode==="none")return 0;
      const spacing=Math.max(.6,Number(c.surface.waveSpacingMm)||2.4),amp=Math.max(0,Number(c.surface.waveHeightMm)||.45);
      const x=nx*projection.radius,y=ny*projection.radius;
      const wave=c.surface.waterMode==="procedural-waves"?amp*(.55*Math.sin((x+y*.28)/spacing*Math.PI*2)+.28*Math.sin((y-x*.16)/spacing*Math.PI*2.7)):0;
      const waterDepth=Math.max(.35,Number(c.surface.waterDepthMm)||1.1);
      return Math.max(.06,Math.max(.18,.55-waterDepth*.35)+wave);
    }
    const geo=projection.unproject(nx,ny),elevation=demSampler(geo.lat,geo.lon);
    if(!Number.isFinite(elevation))return 0;
    const material=classifyTerrainMaterial({lat:geo.lat,lon:geo.lon,elevation},c.terrainBands,landcoverIndex);
    const span=Math.max(1e-9,range.max-range.min);
    let relief=(elevation-range.min)/span*c.fabrication.reliefMm;
    relief+=routeCorrection.at(nx*projection.radius,ny*projection.radius);
    if(material===1)relief+=Math.max(0,Number(c.surface.forestRaiseMm)||0);
    if(material===4&&c.surface.waterMode!=="none"){
      relief-=Math.max(.45,Number(c.surface.waterDepthMm)||1.1);
      if(c.surface.waterMode==="procedural-waves"){
        const spacing=Math.max(.4,Number(c.surface.waveSpacingMm)||2.4),amp=Math.max(0,Number(c.surface.waveHeightMm)||.45);
        const x=nx*projection.radius,y=ny*projection.radius;
        relief+=amp*(.58*Math.sin((x+y*.31)/spacing*Math.PI*2)+.28*Math.sin((y-x*.17)/spacing*Math.PI*3.1));
      }
    }else if(material!==4&&Number.isFinite(elevation)&&elevation<=(Number(c.terrainBands?.seaLevelM)||1.5)+35){
      const coastlineBoost=Math.max(0,Number(c.surface.coastlineBoostMm)||.35);
      relief+=coastlineBoost*(1-Math.min(1,Math.max(0,(elevation-(Number(c.terrainBands?.seaLevelM)||1.5))/35)));
    }
    if(heightmapSampler)relief+=heightmapSampler(nx,ny)*Math.max(0,Number(c.fabrication.heightmapStrengthMm)||0);
    relief+=contourEmbossHeight(relief,c.contours);
    relief-=routeChannelAt(nx*projection.radius,ny*projection.radius);
    const extra=Math.max(0,Number(c.surface.forestRaiseMm)||0,Number(c.contours.riseMm)||0,Number(c.fabrication.heightmapStrengthMm)||0,Number(c.surface.waveHeightMm)||0);
    return Math.max(0,Math.min(c.fabrication.reliefMm+extra,relief));
  };
  const terrainTopMm=(x,y)=>c.fabrication.baseMm+terrainHeightNormalized(x/projection.radius,y/projection.radius);
  const terrainRegionNormalized=(nx,ny)=>{
    if(isRimNormalized(nx,ny))return 12;
    if(medallionMode&&!landInsideNormalized(nx,ny))return 4;
    const geo=projection.unproject(nx,ny),elevation=demSampler(geo.lat,geo.lon);
    const material=classifyTerrainMaterial({lat:geo.lat,lon:geo.lon,elevation},c.terrainBands,landcoverIndex);
    return material===4&&c.surface.waterMode==="none"?0:material;
  };
  const extents=modelExtents(c,projection,outlinePolygons),pockets=makePockets(c,extents);
  let baseMesh;
  if(c.shape.kind==="route-fit"){
    baseMesh=buildRectangularHeightfieldMesh({
      widthMm:projection.widthMm,heightMm:projection.heightMm,baseMm:c.fabrication.baseMm,
      columns:Math.max(24,Math.ceil(projection.widthMm/c.fabrication.targetXyMm)),
      rows:Math.max(24,Math.ceil(projection.heightMm/c.fabrication.targetXyMm)),
      heightAt:(x,y)=>terrainHeightNormalized(x/projection.radius,y/projection.radius),
      bottomAt:(x,y)=>Math.max(magnetPocketDepth(x,y,pockets),bottomTextDepthAt(x,y,c,extents)),regionAt:(x,y)=>terrainRegionNormalized(x/projection.radius,y/projection.radius)
    });
  }else if(c.shape.kind==="geographic"){
    baseMesh=(await import("../engine/map-outline-core.mjs")).buildOutlineHeightfieldMesh({
      polygons:outlinePolygons,radiusMm:projection.radius,baseMm:c.fabrication.baseMm,stepMm:c.fabrication.targetXyMm,
      heightAt:(nx,ny)=>terrainHeightNormalized(nx,ny),
      bottomAt:(nx,ny)=>Math.max(magnetPocketDepth(nx*projection.radius,ny*projection.radius,pockets),bottomTextDepthAt(nx*projection.radius,ny*projection.radius,c,extents)),regionAt:terrainRegionNormalized
    });
  }else{
    baseMesh=buildRadialMedalMesh({
      diameterMm:c.fabrication.modelWidthMm,baseMm:c.fabrication.baseMm,
      rings:Math.max(48,Math.ceil(projection.radius/c.fabrication.targetXyMm)),
      segments:Math.max(192,Math.ceil(Math.PI*c.fabrication.modelWidthMm/c.fabrication.targetXyMm/4)*4),
      shape:c.shape.kind,aspect:c.shape.aspect,
      heightAt:(nx,ny)=>terrainHeightNormalized(nx,ny),
      bottomAt:(nx,ny)=>Math.max(magnetPocketDepth(nx*projection.radius,ny*projection.radius,pockets),bottomTextDepthAt(nx*projection.radius,ny*projection.radius,c,extents)),regionAt:terrainRegionNormalized
    });
  }
  const routeInsideNormalized=medallionMode
    ? (nx,ny)=>insideNormalized(nx,ny)&&landInsideNormalized(nx,ny)
    : contentInsideNormalized;
  const overlays=featureMeshes({points,cartography,config:c,projection,terrainTopMm,insideNormalized:routeInsideNormalized});
  const logos=logoMeshes({logoImage,config:c,projection,terrainTopMm,insideNormalized:contentInsideNormalized,routePoints:points});
  const requestedLabelCount=Number(c.placeLabels.maxCount)||(c.shape.kind==="route-fit"?14:18);
  const labelInsideNormalized=medallionMode?(nx,ny)=>contentInsideNormalized(nx,ny)&&landInsideNormalized(nx,ny):contentInsideNormalized;
  const placePlan=planProfessionalPlaceLabels({places:cartography?.places||[],mode:c.placeLabels.mode,selectedNames:c.placeLabels.selectedNames,maxLabels:requestedLabelCount,shapeKind:c.shape.kind,modelWidthMm:c.fabrication.modelWidthMm,radius:projection.radius,insideNormalized:labelInsideNormalized});
  const placeLabels=buildPlaceLabelMeshes({cartography,projection,terrainTopMm,insideNormalized:labelInsideNormalized,maxLabels:requestedLabelCount,mode:c.placeLabels.mode,selectedNames:c.placeLabels.selectedNames,shapeKind:c.shape.kind,modelWidthMm:c.fabrication.modelWidthMm,plan:placePlan});
  const allowSurfaceLettering=surfaceLetteringAllowed({shapeKind:c.shape.kind,modelWidthMm:c.fabrication.modelWidthMm,mode:c.production.surfaceLettering});
  const textMeshes=allowSurfaceLettering?buildPersonalizationMeshes({
    customization:c.customization,extents,insideNormalized,radius:projection.radius,terrainTopMm,
    riseMm:Math.max(.55,Math.min(1.4,c.fabrication.routeRiseMm*.7)),
    rimWidthMm:c.fabrication.rimWidthMm,shape:medallionMode?"circle":c.shape.kind,layout:c.production.rimTextLayout
  }):[];
  const meshes=[baseMesh,...overlays,...logos,...placeLabels,...textMeshes];
  let hangerPlacement=null;
  if(c.fabrication.hangerEnabled){
    hangerPlacement=professionalHangerPlacement({outlinePolygons:c.shape.kind==="geographic"?outlinePolygons:null,extents,radiusMm:projection.radius,innerRadiusMm:(Number(c.fabrication.hangerInnerDiameterMm)||6)/2,wallMm:Number(c.fabrication.hangerWallMm)||3,baseMm:c.fabrication.baseMm});
    const b=hangerPlacement.bridge;
    meshes.push(buildExtrudedPolygonMesh({
      points:[{x:b.minX,y:b.minY},{x:b.maxX,y:b.minY},{x:b.maxX,y:b.maxY},{x:b.minX,y:b.maxY}],
      baseZAt:()=>0,heightMm:hangerPlacement.heightMm,region:12
    }));
    meshes.push(buildAnnulusMesh({outerRadiusMm:hangerPlacement.outerRadiusMm,innerRadiusMm:hangerPlacement.innerRadiusMm,heightMm:hangerPlacement.heightMm,centerX:hangerPlacement.centerX,centerY:hangerPlacement.centerY,segments:64}));
  }
  const mesh=mergeMeshes(meshes),validation=validateMesh(mesh);
  if(!validation.watertight)throw new Error("Generated production mesh is not watertight (boundary "+validation.boundaryEdges+", non-manifold "+validation.nonManifoldEdges+").");
  const materials=productionMaterials(c);
  const stl=encodeBinaryStl(mesh,{name:title}),threeMf=encode3mf(mesh,{title,materials}),mtl=encodeMtl(materials),obj=encodeObj(mesh,{name:title,materials,mtlFile:"model.mtl"}),glb=encodeGlb(mesh,{title,materials});
  const objBundle=encodeArtifactZip([{name:"model.obj",data:obj},{name:"model.mtl",data:mtl}]);
  const coupon=buildPrintValidationCoupon({technology:profile.technology,nozzleMm:profile.nozzleMm,minFeatureMm:profile.minFeatureMm,minEmbossMm:profile.minEmbossMm});
  const quality={outlineComponentsRemoved:outlineFilter.removed.length,outlineComponentsKept:outlineFilter.kept.length,placeLabelsPlanned:placePlan.length,placeLabelsRequested:requestedLabelCount,surfaceLetteringSuppressed:!allowSurfaceLettering,hangerAnchored:Boolean(hangerPlacement),geographicMedallion:medallionMode,printerProfile:profile.label};
  const manifest={title,validation,range,bounds,materials,vertices:mesh.vertices.length,triangles:mesh.triangles.length,cartographyStats:cartography?.stats||null,elevationDiagnostics:routeCorrection.diagnostics,customization:normalizeCustomization(config.customization||{}),quality,config:c};
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
  const packageManifest={schema:"vyndi-3rd-diamension/print-package-v1",title,generatedAt:new Date().toISOString(),printerProfile:c.production.printerProfile,preferredFormat:profile.preferredFormat,routeStyle:c.fabrication.routeStyle,shape:c.shape.kind,vertices:mesh.vertices.length,triangles:mesh.triangles.length,materials:materials.map(item=>item.name),validation,elevationDiagnostics:routeCorrection.diagnostics,quality,config:c};
  const packageFiles=[
    {name:"model.3mf",data:threeMf},{name:"model.stl",data:stl},{name:"model.glb",data:glb},
    {name:"model-obj.zip",data:objBundle},{name:"validation.zip",data:validationBundle},
    {name:"production.json",data:JSON.stringify(packageManifest,null,2)}
  ];
  if(standStl)packageFiles.push({name:"display-stand.stl",data:standStl});
  if(tileBundle)packageFiles.push({name:"tiled-map.zip",data:tileBundle});
  const printPackage=encodeArtifactZip(packageFiles);
  return {mesh,materials,validation,range,bounds,config:c,projection,elevationDiagnostics:routeCorrection.diagnostics,stl,threeMf,obj,mtl,objBundle,glb,validationBundle,tilePlan,tileBundle,standStl,printPackage,packageManifest,profile,quality,hangerPlacement,workload};
}
