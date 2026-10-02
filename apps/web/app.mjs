import { parseGpxText, mergeGpxRoutes } from "../../packages/gpx/gpx-core.mjs";
import {
  defaultAdvancedConfig, normalizeAdvancedConfig, productionDisplayTitle, productionBounds,
  loadTerrariumSampler, loadGeoTiffFile, loadArcAsciiFile, loadOpenFreeMapCartography,
  generateProductionModel, PRINTER_PROFILES
} from "../../packages/toolkit/toolkit-core.mjs";
import { deriveRibbonMeta, formatDuration, DEFAULT_TERRAIN_PALETTE } from "../../packages/ui/ribbon-core.mjs";
import { fetchLandcover } from "../../packages/map/landcover-core.mjs";
import { encodeGlb, encodeArtifactZip } from "../../packages/engine/print-model-core.mjs";
import { TRAILRELIEF_SOURCE_DEFAULTS, TRAILRELIEF_SOURCE_SCENE, VYNDI_SOURCE_DEFAULTS, VYNDI_SOURCE_VIEW, trailReliefSourceConfig } from "../../packages/source-parity/source-contracts.mjs";

const $=id=>document.getElementById(id);
const state={
  route:null,routes:[],palette:{...DEFAULT_TERRAIN_PALETTE,rim:"#23201d",trails:"#3f6b3a",railways:"#7e8791",buildings:"#d8d1c4"},
  production:null,glbUrl:null,previewUrl:null,previewTimer:null,previewGeneration:0,
  liveDemSampler:null,liveDemPromise:null,liveDemInfo:null,demFile:null,arcFile:null,openTopoSampler:null,openTopoInfo:null,
  landcover:[],logoImage:null,heightmapImage:null,geoOutline:null,geoMeta:null,
  authenticity:null,
  trailRenderer:null,sourceRenderGeneration:0,vyndiView:{yaw:VYNDI_SOURCE_VIEW.yaw,pitch:VYNDI_SOURCE_VIEW.pitch,zoom:VYNDI_SOURCE_VIEW.zoom}
};

function finite(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function clean(v=""){return String(v??"").trim()}
function stem(value){return String(value||"vyndi-3rd-diamension").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"vyndi-3rd-diamension"}
function previewBounds(points=[]){
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
  for(const p of points){if(!Number.isFinite(Number(p?.lat))||!Number.isFinite(Number(p?.lon)))continue;minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon)}
  return {minLat,maxLat,minLon,maxLon};
}
function download(data,name,type="application/octet-stream"){
  const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function resetGenerated(message="Configuration changed · regenerate production model."){
  state.production=null;state.authenticity=null;
  document.querySelectorAll("[data-export]").forEach(b=>b.disabled=true);
  for(const id of ["downloadStand","downloadTiles","downloadValidation","downloadPrintPackage","downloadJob","issueAuthenticity","downloadAuthenticity"])if($(id))$(id).disabled=true;
  if($("verifyAuthenticityLink")){$("verifyAuthenticityLink").hidden=true;$("verifyAuthenticityLink").removeAttribute("href")}
  if(state.glbUrl){URL.revokeObjectURL(state.glbUrl);state.glbUrl=null}
  $("modelViewer")?.removeAttribute("src");
  if(state.route)$("productionStatus").textContent=message;
}
function readPalette(){
  const out={...state.palette};
  document.querySelectorAll("[data-palette]").forEach(el=>{
    const value=clean(el.value).toLowerCase();
    if(/^#[0-9a-f]{6}$/.test(value))out[el.dataset.palette]=value;
  });
  state.palette=out;return out;
}
function readOverrides(){
  const route=state.route||{};
  return {
    event:$("eventOverride").value,name:$("riderName").value,date:$("eventDate").value,
    distance:finite(route.distanceKm)>0?Math.round(route.distanceKm).toLocaleString("en-US")+" KM":"",
    elevation:finite(route.elevationGainM)>0?Math.round(route.elevationGainM).toLocaleString("en-US")+" M":"",
    duration:finite(route.elapsedTimeSeconds)>0?formatDuration(route.elapsedTimeSeconds):""
  };
}
function updateRibbon(){
  const meta=deriveRibbonMeta(state.route||{},readOverrides());
  $("ribbonEvent").textContent=meta.event;
  $("ribbonRider").textContent=[meta.rider,meta.date].filter(Boolean).join(" · ")||"RIDER · DATE";
  $("ribbonDistance").textContent=meta.distance;$("ribbonElevation").textContent=meta.elevation;
  $("ribbonDuration").textContent=meta.duration;$("ribbonPoints").textContent=meta.sourcePoints;
  $("personaliseSummary").textContent=[clean($("eventOverride").value)||state.route?.name,clean($("riderName").value),clean($("eventDate").value)].filter(Boolean).join(" · ")||"event · rider · date";
  if(state.route){
    $("routeBrief").textContent=(state.routes.length>1?state.routes.length+" GPX ROUTES · ":"")+state.route.name;
    $("routeDetail").textContent=Math.round(finite(state.route.distanceKm))+" km · +"+Math.round(finite(state.route.elevationGainM)).toLocaleString("en-US")+" m · "+finite(state.route.sourcePointCount).toLocaleString("en-US")+" source points";
  }
}
function syncOutputs(){
  $("routeBufferOut").value=finite($("routeBufferKm").value).toFixed(1)+" km";
  $("xyDetailOut").value=finite($("xyDetail").value).toFixed(2)+" mm";
  $("reliefOut").value=finite($("relief").value).toFixed(1)+" mm";
  $("mountainOut").value=$("mountainM").value+" m";$("snowOut").value=$("snowM").value+" m";
  $("forestRaiseOut").value=finite($("forestRaise").value).toFixed(1)+" mm";
  $("waterDepthOut").value=finite($("waterDepth").value).toFixed(1)+" mm";
  $("routeWidthOut").value=finite($("routeWidth").value).toFixed(1)+" mm";
  $("routeRiseOut").value=finite($("routeRise").value).toFixed(1)+" mm";
  $("elevationBlendOut").value=Math.round(finite($("elevationBlend").value)*100)+"%";
}
function syncPrinterProfile(){
  const profile=PRINTER_PROFILES[$("printerProfile").value]||PRINTER_PROFILES["bambu-p1s"];
  $("printerProfileNote").textContent=profile.label+" · "+profile.preferredFormat.toUpperCase()+" preferred · "+profile.slicers.join(" / ")+" · safe feature ≥ "+profile.minFeatureMm+" mm · emboss ≥ "+profile.minEmbossMm+" mm.";
}
function syncMedalSize(){
  if($("medalSize").value!=="custom")$("modelWidth").value=$("medalSize").value;
}
function setControl(id,value){
  const el=$(id);if(!el)return;
  if(el.type==="checkbox")el.checked=Boolean(value);else el.value=String(value);
}
function setPalette(values={}){
  for(const [key,value] of Object.entries(values))document.querySelectorAll('[data-palette="'+key+'"]').forEach(el=>{el.value=value});
  readPalette();
}
function applyVisualPreset(name=$("visualPreset")?.value||"premium-medal",{initial=false}={}){
  const width=finite($("modelWidth")?.value,180);
  if(name==="premium-medal"){
    setPalette({land:"#6f9f46",forest:"#2f6c31",mountain:"#8b5a31",snow:"#f7f7f3",water:"#155b8a",route:"#ff2f24",rim:"#22201f",labels:"#f3c56a"});
    setControl("roads",false);setControl("trails",false);setControl("railways",false);setControl("buildings",false);setControl("placeLabelMode","none");
    setControl("contourEnabled",false);setControl("magnetEnabled",false);setControl("hangerEnabled",false);setControl("tileEnabled",false);
    setControl("routeStyle","raised");setControl("surfaceLettering","full");setControl("waterMode","procedural-waves");
    setControl("mountainM",900);setControl("snowM",2800);setControl("forestRaise",.18);setControl("waterDepth",.25);setControl("waveHeight",.12);setControl("waveSpacing",2.8);
    setControl("routeWidth",width<=90?1.1:width<=120?1.3:1.6);setControl("routeRise",width<=90?.8:1);
    setControl("relief",width<=90?6.5:width<=120?8:12);setControl("rimWidthMm",width<=90?5.5:width<=120?7.5:12);setControl("rimHeightMm",width<=90?3:width<=120?4:5);
    if(state.geoOutline)setControl("shape","geo-medallion");
    $("qualityBadge").textContent="PREMIUM MEDAL · TERRAIN FIRST";
  }else if(name==="detailed-map"){
    setControl("roads",true);setControl("trails",true);setControl("railways",true);setControl("buildings",false);setControl("placeLabelMode","major");
    setControl("surfaceLettering","auto");if(state.geoOutline&&$("shape").value==="geo-medallion")setControl("shape","geographic");
    $("qualityBadge").textContent="DETAILED MAP";
  }else{
    setControl("roads",false);setControl("trails",false);setControl("railways",false);setControl("buildings",false);setControl("placeLabelMode","none");
    setControl("surfaceLettering","none");setControl("waterMode","flat");setControl("contourEnabled",false);
    setPalette({land:"#b7a77a",forest:"#6f795f",mountain:"#8a7a68",snow:"#f4f3ee",water:"#62869a",route:"#ff6a1f",rim:"#23201d",labels:"#f2c14e"});
    $("qualityBadge").textContent="FABRICATION PROOF";
  }
  syncOutputs();
  if(!initial){resetGenerated("Presentation preset changed · regenerate production model.");schedulePreview(0)}
}


function sourceMode(){return $("sourceRenderer")?.value||"trailrelief-original"}
function trailReliefLabel(route=state.route,customization=readOverrides()){
  const d=TRAILRELIEF_SOURCE_DEFAULTS,bits=[];
  const title=clean(customization.event)||clean(route?.name);if(title)bits.push(title.toUpperCase());
  if(clean(customization.date))bits.push(clean(customization.date).toUpperCase());
  const distance=finite(route?.distanceKm);if(distance>0)bits.push((distance<100?distance.toFixed(1):distance.toFixed(0))+" km");
  const gain=finite(route?.elevationGainM);if(gain>0)bits.push("+"+Math.round(gain).toLocaleString("en-US")+" m");
  const seconds=finite(route?.movingTimeSeconds)||finite(route?.elapsedTimeSeconds);
  if(seconds>0){const h=Math.floor(seconds/3600),m=Math.round(seconds%3600/60);bits.push(h?h+"h "+m+"m":m+"m")}
  return bits.join("  -  ");
}
function setSourceSurface(mode){
  const trail=$("trailReliefSourceCanvas"),vyndi=$("sourcePreviewCanvas"),viewer=$("liveModelViewer");
  if(trail)trail.hidden=mode!=="trailrelief-original";
  if(vyndi)vyndi.hidden=mode!=="vyndi-original";
  if(viewer)viewer.hidden=mode!=="v3d-unified";
}
function configureReliefControl(mode){
  const input=$("relief"),label=input?.closest("label");if(!input||!label)return;
  const first=label.childNodes[0];
  if(mode==="trailrelief-original"){
    if(first)first.textContent="Elevation amplification ";
    input.min=".5";input.max="10";input.step=".1";
  }else if(mode==="vyndi-original"){
    if(first)first.textContent="Elevation exaggeration ";
    input.min="1";input.max="10";input.step=".5";
  }else{
    if(first)first.textContent="Elevation relief ";
    input.min="1";input.max="30";input.step=".5";
  }
}
function applySourceRenderer(mode=sourceMode(),{initial=false}={}){
  state.trailRenderer?.dispose?.();state.trailRenderer=null;
  setSourceSurface(mode);configureReliefControl(mode);
  $("visualPresetRow").hidden=mode!=="v3d-unified";
  if(mode==="trailrelief-original"){
    const d=TRAILRELIEF_SOURCE_DEFAULTS;
    setPalette({land:d.colors.land,forest:d.colors.forest,mountain:d.colors.mountain,snow:d.colors.snow,water:d.colors.water,route:d.colors.route,rim:d.colors.rim,labels:d.colors.text});
    setControl("routeBufferKm",d.paddingKm);setControl("xyDetail",(d.modelSize/d.resolution).toFixed(2));setControl("relief",d.exaggeration);
    setControl("mountainM",d.mountainLine);setControl("snowM",d.snowLine);setControl("forestRaise",d.forestRaise);setControl("waterDepth",d.waterDepth);setControl("waterMode","flat");
    setControl("routeStyle",d.routeMode);setControl("routeWidth",d.routeWidth);setControl("routeRise",d.routeHeight);
    setControl("shape","circle");setControl("modelWidth",d.modelSize);setControl("baseMm",d.plateThickness);setControl("rimWidthMm",d.rimWidth);setControl("rimHeightMm",d.rimHeight);
    setControl("surfaceLettering","full");setControl("placeLabelMode","none");setControl("roads",false);setControl("trails",false);setControl("railways",false);setControl("buildings",false);
    $("qualityBadge").textContent="SOURCE · TRAILRELIEF ORIGINAL";$("livePreviewStatus").textContent="TRAILRELIEF SOURCE RENDERER";
  }else if(mode==="vyndi-original"){
    const d=VYNDI_SOURCE_DEFAULTS;
    setPalette({land:d.terrainColor,forest:d.terrainColor,mountain:d.terrainColor,snow:"#f4f6f2",water:d.waterColor,route:d.routeColor,rim:"#202326",labels:d.labelsColor,roads:d.roadsColor});
    setControl("relief",d.exaggeration);setControl("waterMode",d.waterMode);setControl("waveHeight",d.waveHeightMm);setControl("waveSpacing",d.wavelengthMm);
    setControl("baseMm",d.baseMm);setControl("routeStyle",d.routeStyle);setControl("routeWidth",d.routeWidthMm);setControl("routeRise",d.routeRiseMm);setControl("shape",d.shape);
    $("qualityBadge").textContent="SOURCE · VYNDI TERRAIN MEDAL ORIGINAL";$("livePreviewStatus").textContent="VYNDI SOURCE CANVAS";
  }else{
    applyVisualPreset($("visualPreset").value,{initial:true});
    $("qualityBadge").textContent="V3D UNIFIED";$("livePreviewStatus").textContent="V3D CANONICAL GLB";
  }
  syncOutputs();
  if(!initial){resetGenerated("Renderer source changed · regenerate production model.");schedulePreview(0)}
}
function trailReliefSourceRelief(route,demSampler,config){
  if(!route?.points?.length||typeof demSampler!=="function")return Math.max(.2,finite(config.fabrication.reliefMm,2));
  const b=route.bounds||previewBounds(route.points),lat0=(b.minLat+b.maxLat)/2,lon0=(b.minLon+b.maxLon)/2,cos=Math.max(.08,Math.cos(lat0*Math.PI/180));
  let groundR=0,min=Infinity,max=-Infinity;
  const stride=Math.max(1,Math.ceil(route.points.length/800));
  for(let i=0;i<route.points.length;i+=stride){
    const p=route.points[i],x=(finite(p.lon)-lon0)*111320*cos,y=(finite(p.lat)-lat0)*110540;groundR=Math.max(groundR,Math.hypot(x,y));
    const e=Number(demSampler(p.lat,p.lon));if(Number.isFinite(e)){min=Math.min(min,Math.max(0,e));max=Math.max(max,Math.max(0,e))}
  }
  groundR+=finite(config.shape.routeBufferKm,TRAILRELIEF_SOURCE_DEFAULTS.paddingKm)*1000;
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min||groundR<=0)return .25;
  const terrainRadius=Math.max(1,finite(config.fabrication.modelWidthMm,180)/2-finite(config.fabrication.rimWidthMm,12));
  const mmPerM=terrainRadius/groundR,exaggeration=finite($("relief").value,TRAILRELIEF_SOURCE_DEFAULTS.exaggeration);
  return Math.max(.16,(max-min)*mmPerM*exaggeration);
}
let trailRendererModule=null;
async function renderTrailReliefSource(model,config){
  trailRendererModule||=import("./vendor/trailrelief-source-renderer.mjs");
  const runtime=await trailRendererModule;
  state.trailRenderer?.dispose?.();state.trailRenderer=null;
  setSourceSurface("trailrelief-original");
  state.trailRenderer=runtime.renderTrailReliefSource({
    canvas:$("trailReliefSourceCanvas"),model,colors:config.colors,label:trailReliefLabel(),modelWidthMm:config.fabrication.modelWidthMm,
    rimWidthMm:config.fabrication.rimWidthMm,rimHeightMm:config.fabrication.rimHeightMm,baseMm:config.fabrication.baseMm,
    textSize:TRAILRELIEF_SOURCE_DEFAULTS.textSize,textDepth:TRAILRELIEF_SOURCE_DEFAULTS.textDepth,
    cameraFov:40,hemisphereIntensity:.6,directionalIntensity:2.2,roughness:.82,metalness:.02
  });
  $("liveEmpty").hidden=true;
  $("livePreviewStatus").textContent="TRAILRELIEF ORIGINAL · "+model.mesh.vertices.length.toLocaleString()+" vertices · exact source scene";
  $("qualityBadge").textContent="SOURCE · TRAILRELIEF · 40° CAMERA · ORIGINAL LIGHTING";
}
function vyndiFrame(route){
  const b=route?.bounds||previewBounds(route?.points||[]),midLat=(b.minLat+b.maxLat)/2,midLon=(b.minLon+b.maxLon)/2,lonScale=Math.max(.08,Math.cos(midLat*Math.PI/180));
  const extent=Math.max((b.maxLon-b.minLon)*lonScale,b.maxLat-b.minLat)*1.18||1;
  return {midLat,midLon,lonScale,extent,frameSize:1.45};
}
function vyndiXY(point,frame){
  return {x:(finite(point.lon)-frame.midLon)*frame.lonScale/frame.extent*frame.frameSize,y:(finite(point.lat)-frame.midLat)/frame.extent*frame.frameSize,segment:point.segment};
}
function projectVyndiSource(x,y,z,cx,cy,scale){
  const {yaw,pitch}=state.vyndiView,cyaw=Math.cos(yaw),syaw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  const rx=x*cyaw-z*syaw,rz=x*syaw+z*cyaw,ry=y*cp-rz*sp,depth=y*sp+rz*cp,perspective=1/(1+depth*VYNDI_SOURCE_VIEW.perspectiveDepth);
  return [cx+rx*scale*perspective,cy+ry*scale*perspective,depth,perspective];
}
function surfaceHeightVyndiSource(x,y,{demSampler,frame,range,config,waterOverride=null}={}){
  const lat=frame.midLat+(y/frame.frameSize)*frame.extent,lon=frame.midLon+(x/frame.frameSize)*frame.extent/frame.lonScale,elevation=Number(demSampler(lat,lon));
  const water=waterOverride===null?(Number.isFinite(elevation)&&elevation<=.5):Boolean(waterOverride);
  if(water){
    if(config.surface.waterMode==="flat")return VYNDI_SOURCE_VIEW.waterBase;
    const frequency=20/Math.max(1.6,finite(config.surface.waveSpacingMm,VYNDI_SOURCE_DEFAULTS.wavelengthMm));
    return VYNDI_SOURCE_VIEW.waterBase+(finite(config.surface.waveHeightMm,.3)/.3)*.018*(Math.sin((x+y*.32)*frequency)+.45*Math.sin((y-x*.18)*frequency*1.7));
  }
  if(Number.isFinite(elevation)&&range.max>range.min){
    const normalized=Math.max(0,Math.min(1,(elevation-range.min)/(range.max-range.min)));
    return VYNDI_SOURCE_VIEW.landBase+normalized*(VYNDI_SOURCE_VIEW.landReliefBase+finite($("relief").value,VYNDI_SOURCE_DEFAULTS.exaggeration)*VYNDI_SOURCE_VIEW.exaggerationRelief);
  }
  return VYNDI_SOURCE_VIEW.landBase;
}
function renderVyndiSourcePreview({route=state.route,demSampler,config=currentConfig()}={}){
  const canvas=$("sourcePreviewCanvas");if(!canvas||!route?.points?.length||typeof demSampler!=="function")return;
  state.trailRenderer?.dispose?.();state.trailRenderer=null;setSourceSurface("vyndi-original");$("liveEmpty").hidden=true;
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,globalThis.devicePixelRatio||1),width=Math.max(2,Math.floor(rect.width*dpr)),height=Math.max(2,Math.floor(rect.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,cx=w/2,cy=h*.51,scale=Math.min(w,h)*.34*state.vyndiView.zoom,frame=vyndiFrame(route);
  let min=Infinity,max=-Infinity;const samples=18;
  for(let j=0;j<=samples;j++)for(let i=0;i<=samples;i++){const x=-frame.frameSize+2*frame.frameSize*i/samples,y=-frame.frameSize+2*frame.frameSize*j/samples,lat=frame.midLat+(y/frame.frameSize)*frame.extent,lon=frame.midLon+(x/frame.frameSize)*frame.extent/frame.lonScale,e=Number(demSampler(lat,lon));if(Number.isFinite(e)&&e>.5){min=Math.min(min,e);max=Math.max(max,e)}}
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min){min=0;max=1}
  const range={min,max},n=81,cells=[];
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
    const x0=-1+2*i/(n-1),x1=-1+2*(i+1)/(n-1),y0=-1+2*j/(n-1),y1=-1+2*(j+1)/(n-1),mx=(x0+x1)/2,my=(y0+y1)/2;
    if(mx*mx+my*my>1)continue;
    const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>({x,y,z:surfaceHeightVyndiSource(x,y,{demSampler,frame,range,config})}));
    const pts=corners.map(p=>projectVyndiSource(p.x,-p.z,p.y,cx,cy,scale)),depth=pts.reduce((sum,p)=>sum+p[2],0)/pts.length;
    const lat=frame.midLat+(my/frame.frameSize)*frame.extent,lon=frame.midLon+(mx/frame.frameSize)*frame.extent/frame.lonScale,e=Number(demSampler(lat,lon)),water=Number.isFinite(e)&&e<=.5;
    cells.push({pts,depth,water});
  }
  cells.sort((a,b)=>a.depth-b.depth);ctx.clearRect(0,0,w,h);ctx.fillStyle="#091014";ctx.fillRect(0,0,w,h);
  for(const cell of cells){
    const shade=Math.max(VYNDI_SOURCE_VIEW.shadeMin,Math.min(VYNDI_SOURCE_VIEW.shadeMax,VYNDI_SOURCE_VIEW.shadeBase-cell.depth*VYNDI_SOURCE_VIEW.shadeDepth));
    ctx.beginPath();cell.pts.forEach((p,k)=>k?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
    ctx.fillStyle=cell.water?`rgb(${shade*.34},${shade*.92},${shade*1.22})`:`rgb(${shade*.72},${shade*.84},${shade*.88})`;ctx.fill();
    ctx.strokeStyle=cell.water?"#8dd9eb28":"#91a2a518";ctx.lineWidth=.7*dpr;ctx.stroke();
  }
  const routePts=route.points.filter((_,i)=>i%Math.max(1,Math.ceil(route.points.length/700))===0||i===route.points.length-1).map(p=>({...vyndiXY(p,frame),raw:p}));
  if(routePts.length){
    ctx.beginPath();routePts.forEach((p,i)=>{const z=surfaceHeightVyndiSource(p.x,p.y,{demSampler,frame,range,config})+.012,screen=projectVyndiSource(p.x,-z,p.y,cx,cy,scale);if(!i||p.segment!==routePts[i-1].segment)ctx.moveTo(screen[0],screen[1]);else ctx.lineTo(screen[0],screen[1])});
    ctx.strokeStyle="#15151566";ctx.lineWidth=5*dpr;ctx.stroke();ctx.strokeStyle=VYNDI_SOURCE_DEFAULTS.routeColor;ctx.lineWidth=Math.max(2*dpr,finite(config.fabrication.routeWidthMm,1.2)*2.1*dpr);ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
  }
  const meta=readOverrides(),hasMeta=Boolean(meta.distance||meta.elevation||meta.duration),titleY=hasMeta?h-154*dpr:h-82*dpr,participantY=hasMeta?h-124*dpr:h-48*dpr;
  ctx.textAlign="center";ctx.fillStyle=VYNDI_SOURCE_DEFAULTS.labelsColor;ctx.font=`700 ${28*dpr}px Arial`;ctx.fillText((clean(meta.event)||route.name).toUpperCase().slice(0,34),cx,titleY);
  ctx.fillStyle="#f4f6f2";ctx.font=`700 ${22*dpr}px Arial`;ctx.fillText(clean(meta.name).toUpperCase(),cx,participantY);
  if(hasMeta){ctx.font=`700 ${12*dpr}px Arial`;ctx.fillStyle="#cbd6d2";[meta.distance,meta.elevation,meta.duration].filter(Boolean).slice(0,3).forEach((line,index)=>ctx.fillText(String(line).toUpperCase(),cx,h-(96-index*18)*dpr))}
  $("livePreviewStatus").textContent="VYNDI TERRAIN MEDAL ORIGINAL · canvas projection yaw -0.42 · pitch 0.92";
  $("qualityBadge").textContent="SOURCE · VYNDI ORIGINAL CANVAS";
}

function syncDemSource(){
  const source=$("demSource").value;
  $("geoTiffRow").hidden=source!=="geotiff";$("arcRow").hidden=source!=="arc";$("openTopoRow").hidden=source!=="opentopography";
  if(source==="terrarium")$("demStatus").textContent="AWS Terrarium · no key · automatic during generation.";
}
function gpxPreviewSampler(points=[]){
  const valid=(points||[]).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lon)));
  const stride=Math.max(1,Math.ceil(valid.length/360)),sample=[];
  for(let i=0;i<valid.length;i+=stride)sample.push(valid[i]);
  if(valid.length&&sample.at(-1)!==valid.at(-1))sample.push(valid.at(-1));
  const bounds=previewBounds(sample),latScale=1/Math.max(1e-9,bounds.maxLat-bounds.minLat),lonScale=1/Math.max(1e-9,bounds.maxLon-bounds.minLon);
  return (lat,lon)=>{
    const nearest=[];
    for(const p of sample){
      const dx=(Number(lon)-Number(p.lon))*lonScale,dy=(Number(lat)-Number(p.lat))*latScale,d2=dx*dx+dy*dy,ele=finite(p.ele);
      if(d2<1e-12)return ele;
      let at=nearest.findIndex(item=>d2<item.d2);if(at<0)at=nearest.length;nearest.splice(at,0,{d2,ele});if(nearest.length>4)nearest.pop();
    }
    let weighted=0,total=0;for(const item of nearest){const w=1/(item.d2+1e-6);weighted+=item.ele*w;total+=w}
    return total?weighted/total:0;
  };
}
async function readImageData(file){
  const bitmap=await createImageBitmap(file),max=512,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();
  return ctx.getImageData(0,0,width,height);
}
function clamp01(value){return Math.max(0,Math.min(1,Number(value)||0))}
function mixRgb(a,b,t){const x=clamp01(t);return a.map((v,i)=>Math.round(v+(b[i]-v)*x))}
function hypsometricColor(elevation,config){
  const e=Number.isFinite(Number(elevation))?Number(elevation):0;
  const mountain=Math.max(300,finite(config?.terrainBands?.mountainM,900)),snow=Math.max(mountain+500,finite(config?.terrainBands?.snowM,2800));
  const green=[104,156,70],bright=[132,174,78],dry=[166,148,78],brown=[139,88,48],rock=[118,103,88],white=[246,246,241];
  if(e<=120)return mixRgb(green,bright,e/120);
  if(e<mountain*.7)return mixRgb(bright,dry,(e-120)/Math.max(1,mountain*.7-120));
  if(e<mountain*1.45)return mixRgb(dry,brown,(e-mountain*.7)/Math.max(1,mountain*.75));
  if(e<snow)return mixRgb(brown,rock,(e-mountain*1.45)/Math.max(1,snow-mountain*1.45));
  return mixRgb(rock,white,Math.min(1,(e-snow)/Math.max(500,snow*.35)));
}
function geometryPolygons(geometry){
  const source=geometry?.type==="Feature"?geometry.geometry:geometry;
  if(source?.type==="Polygon")return [source.coordinates];
  if(source?.type==="MultiPolygon")return source.coordinates;
  return [];
}
function paintGeographyMask(ctx,geometry,projection,size){
  const polygons=geometryPolygons(geometry);ctx.clearRect(0,0,size,size);ctx.fillStyle="#fff";ctx.beginPath();
  for(const rings of polygons)for(const ring of rings){
    let started=false;
    for(const pair of ring||[]){
      if(!Array.isArray(pair)||pair.length<2)continue;
      const p=projection.project({lon:Number(pair[0]),lat:Number(pair[1])}),x=(p.nx+1)*.5*size,y=(1-(p.ny+1)*.5)*size;
      if(!Number.isFinite(x)||!Number.isFinite(y))continue;
      if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y);
    }
    if(started)ctx.closePath();
  }
  ctx.fill("evenodd");
}
async function canvasPngBytes(canvas){
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!blob)throw new Error("PNG texture encoding unavailable.");
  return new Uint8Array(await blob.arrayBuffer());
}
async function buildPremiumTerrainTexture({projection,demSampler,geometry,config,resolution=384}={}){
  if(!projection||typeof demSampler!=="function"||!geometry)throw new Error("Premium terrain texture needs projection, DEM and geography.");
  const size=Math.max(128,Math.min(512,Math.round(resolution)||384)),maskCanvas=document.createElement("canvas"),canvas=document.createElement("canvas");
  maskCanvas.width=maskCanvas.height=canvas.width=canvas.height=size;
  const maskCtx=maskCanvas.getContext("2d",{willReadFrequently:true}),ctx=canvas.getContext("2d",{willReadFrequently:true});
  paintGeographyMask(maskCtx,geometry,projection,size);
  const mask=maskCtx.getImageData(0,0,size,size).data,elev=new Float32Array(size*size),land=new Uint8Array(size*size);
  let min=Infinity,max=-Infinity;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,isLand=mask[i*4+3]>127;land[i]=isLand?1:0;
    if(!isLand){elev[i]=0;continue}
    const nx=x/(size-1)*2-1,ny=1-y/(size-1)*2,geo=projection.unproject(nx,ny),value=Number(demSampler(geo.lat,geo.lon));
    elev[i]=Number.isFinite(value)?value:0;if(Number.isFinite(value)){min=Math.min(min,value);max=Math.max(max,value)}
  }
  const image=ctx.createImageData(size,size),data=image.data,light=[-.44,-.54,.72],lightLen=Math.hypot(...light),lx=light[0]/lightLen,ly=light[1]/lightLen,lz=light[2]/lightLen;
  const water=[18,78,126];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,o=i*4;
    if(!land[i]){
      const wave=.035*Math.sin(x*.19+y*.07)+.02*Math.sin(y*.31-x*.05),shade=.92+wave;
      data[o]=Math.round(water[0]*shade);data[o+1]=Math.round(water[1]*shade);data[o+2]=Math.round(water[2]*shade);data[o+3]=255;continue;
    }
    const left=elev[y*size+Math.max(0,x-1)],right=elev[y*size+Math.min(size-1,x+1)],up=elev[Math.max(0,y-1)*size+x],down=elev[Math.min(size-1,y+1)*size+x];
    const gx=(right-left)/320,gy=(down-up)/320,nx=-gx,ny=gy,nz=1,nlen=Math.hypot(nx,ny,nz)||1,dot=(nx/nlen)*lx+(ny/nlen)*ly+(nz/nlen)*lz;
    const shade=Math.max(.58,Math.min(1.18,.83+dot*.28)),grain=1+.018*Math.sin(x*.37+y*.23)+.012*Math.sin(x*.11-y*.29),base=hypsometricColor(elev[i],config);
    data[o]=Math.max(0,Math.min(255,Math.round(base[0]*shade*grain)));data[o+1]=Math.max(0,Math.min(255,Math.round(base[1]*shade*grain)));data[o+2]=Math.max(0,Math.min(255,Math.round(base[2]*shade*grain)));data[o+3]=255;
  }
  ctx.putImageData(image,0,0);
  return {png:await canvasPngBytes(canvas),width:size,height:size,minElevation:Number.isFinite(min)?min:0,maxElevation:Number.isFinite(max)?max:0};
}
function premiumTextureUv(projection){
  const radius=Math.max(1,finite(projection?.radius,1));
  return vertex=>({u:clamp01((finite(vertex?.x)/radius+1)/2),v:clamp01(1-(finite(vertex?.y)/radius+1)/2)});
}
function rebuildPrintPackage(model){
  const manifest={...(model.packageManifest||{}),render:{mode:"premium-hypsometric-hillshade",terrainTexture:true}};
  model.packageManifest=manifest;
  const files=[
    {name:"model.3mf",data:model.threeMf},{name:"model.stl",data:model.stl},{name:"model.glb",data:model.glb},
    {name:"model-obj.zip",data:model.objBundle},{name:"validation.zip",data:model.validationBundle},
    {name:"production.json",data:JSON.stringify(manifest,null,2)}
  ];
  if(model.standStl)files.push({name:"display-stand.stl",data:model.standStl});
  if(model.tileBundle)files.push({name:"tiled-map.zip",data:model.tileBundle});
  model.printPackage=encodeArtifactZip(files);
}

let modelViewerReady=null;
function ensureModelViewer(){return modelViewerReady||(modelViewerReady=import("./vendor/model-viewer.min.js"));}

function currentConfig(){
  const base=defaultAdvancedConfig(),p=readPalette(),shapeKind=$("shape").value;
  return normalizeAdvancedConfig({...base,
    colors:{
      ...base.colors,land:p.land,terrain:p.land,forest:p.forest,mountain:p.mountain,snow:p.snow,water:p.water,route:p.route,
      roads:p.roads,trails:p.trails||p.forest,railways:p.railways||"#7e8791",buildings:p.buildings||"#d8d1c4",
      text:p.labels,logo:p.labels,rim:p.rim||"#23201d"
    },
    terrainBands:{mountainM:finite($("mountainM").value,1200),snowM:finite($("snowM").value,2600)},
    surface:{
      forestRaiseMm:finite($("forestRaise").value,.4),waterDepthMm:finite($("waterDepth").value,.6),waterMode:$("waterMode").value,
      waveHeightMm:finite($("waveHeight").value,.3),waveSpacingMm:finite($("waveSpacing").value,2.6)
    },
    contours:{enabled:$("contourEnabled").checked,intervalMm:finite($("contourInterval").value,1),widthMm:.08,riseMm:finite($("contourRise").value,.2)},
    placeLabels:{mode:$("placeLabelMode").value,selectedNames:[],maxCount:$("placeLabelMode").value==="all"?60:18},
    production:{printerProfile:$("printerProfile").value,medalSize:$("medalSize").value,surfaceLettering:$("surfaceLettering").value,rimTextLayout:$("visualPreset").value==="premium-medal"?"expedition":"standard",bottomMark:$("bottomMark").value,bottomEngraveDepthMm:finite($("bottomEngraveDepth").value,.35)},
    customization:{...readOverrides(),location:$("eventLocation").value,bib:$("bib").value,status:$("resultStatus").value,start:$("startDetail").value,finish:$("finishDetail").value,placing:$("placing").value},
    map:{roads:$("roads").checked,trails:$("trails").checked,railways:$("railways").checked,buildings:$("buildings").checked},
    shape:{
      ...base.shape,kind:shapeKind,aspect:finite($("shapeAspect").value,1.35),routeBufferKm:finite($("routeBufferKm").value,5),
      outlineGeometry:(shapeKind==="geographic"||shapeKind==="geo-medallion")?state.geoOutline:null,
      logoEnabled:Boolean(state.logoImage),logoAuto:$("logoAuto").checked,logoWidthMm:finite($("logoWidth").value,18),logoRiseMm:finite($("logoRise").value,.8)
    },
    fabrication:{
      ...base.fabrication,modelWidthMm:finite($("modelWidth").value,180),baseMm:finite($("baseMm").value,3),reliefMm:finite($("relief").value,12),targetXyMm:finite($("xyDetail").value,1),
      routeStyle:$("routeStyle").value,routeWidthMm:finite($("routeWidth").value,1.6),routeRiseMm:finite($("routeRise").value,1.2),
      rimWidthMm:finite($("rimWidthMm").value,12),rimHeightMm:finite($("rimHeightMm").value,5),
      magnetEnabled:$("magnetEnabled").checked,magnetDiameterMm:finite($("magnetDiameter").value,8),magnetDepthMm:finite($("magnetDepth").value,2),magnetSpacingMm:finite($("magnetSpacing").value,30),
      hangerEnabled:$("hangerEnabled").checked,hangerInnerDiameterMm:finite($("loopInnerDiameter").value,6),hangerWallMm:finite($("loopWall").value,3),
      standEnabled:$("standEnabled").checked,heightmapStrengthMm:finite($("heightmapStrength").value,0),
      tiled:$("tileEnabled").checked,maxTileMm:Math.min(finite($("tileMaxWidth").value,200),finite($("tileMaxHeight").value,200)),
      maxTileWidthMm:finite($("tileMaxWidth").value,200),maxTileHeightMm:finite($("tileMaxHeight").value,200),
      jointType:$("tileJointType").value,jointDiameterMm:finite($("tileJointDiameter").value,8),jointDepthMm:finite($("tileJointDepth").value,2),jointClearanceMm:finite($("tileJointClearance").value,.2)
    },
    dem:{...base.dem,source:$("demSource").value,routeElevationMode:$("elevationMode").value,routeElevationBlend:finite($("elevationBlend").value,.5)}
  });
}
function previewConfig(){
  const base=currentConfig();
  return normalizeAdvancedConfig({...base,
    map:{roads:false,trails:false,railways:false,buildings:false},
    placeLabels:{...base.placeLabels,mode:"none"},
    fabrication:{...base.fabrication,targetXyMm:Math.max(3,finite(base.fabrication.targetXyMm,3)),tiled:false,magnetEnabled:false,standEnabled:false}
  });
}
function updateQualityBadge(model,prefix="QUALITY"){
  const q=model?.quality||{},bits=[];
  if(q.surfaceLetteringSuppressed)bits.push("CLEAN SURFACE");
  if(Number(q.outlineComponentsRemoved)>0)bits.push(q.outlineComponentsRemoved+" MICRO PART"+(q.outlineComponentsRemoved===1?"":"S")+" REMOVED");
  if(Number.isFinite(Number(q.placeLabelsPlanned))&&Number(q.placeLabelsRequested)>0&&Number(q.placeLabelsPlanned)<Number(q.placeLabelsRequested))bits.push(q.placeLabelsPlanned+" LABELS");
  if(q.hangerAnchored)bits.push("HANGER ANCHORED");
  if(q.geographicMedallion)bits.push("GEO MEDALLION");
  if(q.premiumTexture)bits.push("HILLSHADE");
  $("qualityBadge").textContent=bits.length?prefix+" · "+bits.join(" · "):prefix+" · PASS";
  $("qualityBadge").classList.toggle("active",bits.length>0);
}
function applyCameraPreset(kind){
  const viewers=[$("liveModelViewer"),$("modelViewer")].filter(Boolean);
  for(const viewer of viewers){
    viewer.cameraTarget="auto auto auto";
    if(kind==="top"){viewer.cameraOrbit="0deg 0deg auto";viewer.fieldOfView="24deg"}
    else if(kind==="iso"){viewer.cameraOrbit="-28deg 56deg auto";viewer.fieldOfView="30deg"}
    else{viewer.cameraOrbit="auto auto auto";viewer.fieldOfView="30deg";viewer.updateFraming?.()}
    viewer.jumpCameraToGoal?.();
  }
}

async function installLiveModel(model,label){
  if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
  state.previewUrl=URL.createObjectURL(new Blob([model.glb],{type:"model/gltf-binary"}));
  await ensureModelViewer();$("liveModelViewer").src=state.previewUrl;$("liveEmpty").hidden=true;
  $("livePreviewStatus").textContent=label+" · "+model.mesh.vertices.length.toLocaleString()+" vertices · "+model.materials.length+" materials";
}
async function generateLivePreview({preferDem=true}={}){
  if(!state.route?.points?.length)return;
  const generation=++state.previewGeneration,route=state.route,config=previewConfig();
  if((config.shape.kind==="geographic"||config.shape.kind==="geo-medallion")&&!state.geoOutline){$("livePreviewStatus").textContent="Select / upload a geographic boundary.";return}
  $("livePreviewStatus").textContent=state.liveDemSampler?"REFINING LIVE 3D · TERRAIN DEM":"BUILDING LIVE 3D · GPX ELEVATION";
  try{
    const demSampler=state.liveDemSampler||gpxPreviewSampler(route.points),title=productionDisplayTitle(route.name,config.customization);
    const model=await generateProductionModel({points:route.points,demSampler,cartography:null,landcover:state.landcover,config,logoImage:state.logoImage,heightmapImage:state.heightmapImage,title});
    if(generation!==state.previewGeneration||route!==state.route)return;
    if($("visualPreset").value==="premium-medal"&&config.shape.kind==="geo-medallion"&&state.geoOutline){
      try{
        const terrainTexture=await buildPremiumTerrainTexture({projection:model.projection,demSampler,geometry:state.geoOutline,config,resolution:256});
        model.glb=encodeGlb(model.mesh,{title,materials:model.materials,texture:{png:terrainTexture.png,regions:[0,1,2,3,4],uv:premiumTextureUv(model.projection)}});
        model.quality={...(model.quality||{}),premiumTexture:true};
      }catch{}
    }
    await installLiveModel(model,state.liveDemSampler?"LIVE 3D READY · TERRAIN DEM":"LIVE 3D READY · GPX ELEVATION");
    if(preferDem&&!state.liveDemSampler&&!state.liveDemPromise)void enhanceLivePreviewWithTerrain(route);
  }catch(error){if(generation===state.previewGeneration)$("livePreviewStatus").textContent="LIVE 3D ERROR · "+(error.message||String(error))}
}
async function enhanceLivePreviewWithTerrain(route){
  if(!route?.points?.length||route!==state.route||state.liveDemSampler||state.liveDemPromise)return;
  try{
    const config=previewConfig(),bounds=productionBounds(route.bounds||previewBounds(route.points),config.shape);
    $("livePreviewStatus").textContent="LIVE 3D READY · GPX ELEVATION · loading real terrain…";
    state.liveDemPromise=loadTerrariumSampler(bounds,{preferredZoom:9,tileBudget:18});
    const terrain=await state.liveDemPromise;if(route!==state.route)return;
    state.liveDemSampler=terrain.sample;state.liveDemInfo=terrain;
    $("livePreviewStatus").textContent="REFINING LIVE 3D · TERRARIUM "+terrain.tileCount+" tiles";
    await generateLivePreview({preferDem:false});
  }catch{$("livePreviewStatus").textContent="LIVE 3D READY · GPX ELEVATION · terrain refinement unavailable"}
  finally{state.liveDemPromise=null}
}
function schedulePreview(delay=180){clearTimeout(state.previewTimer);state.previewTimer=setTimeout(()=>void generateLivePreview(),delay)}
async function loadLandcover(){
  if(!state.route?.points?.length)return;
  $("landcoverStatus").textContent="loading forest + water…";
  try{
    const result=await fetchLandcover(previewBounds(state.route.points));state.landcover=result.features||[];
    $("landcoverStatus").textContent=result.ok?state.landcover.length+" forest/water features":"terrain palette · landcover unavailable";
  }catch{state.landcover=[];$("landcoverStatus").textContent="terrain palette · landcover unavailable"}
  schedulePreview(0);
}
async function loadRoutes(files){
  const list=[...(files||[])];if(!list.length)return;
  $("productionStatus").textContent="Reading "+list.length+" GPX file"+(list.length>1?"s":"")+"…";
  const routes=[];
  for(const file of list)routes.push(parseGpxText(await file.text(),file.name,{maxPoints:30000}));
  state.routes=routes;state.route=mergeGpxRoutes(routes,routes.length===1?routes[0].name:routes.map(r=>r.name).join(" + "));
  state.landcover=[];state.liveDemSampler=null;state.liveDemPromise=null;state.liveDemInfo=null;state.previewGeneration++;
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null}
  $("liveModelViewer").removeAttribute("src");$("liveEmpty").hidden=false;$("livePreviewStatus").textContent="BUILDING LIVE 3D · GPX ELEVATION";
  resetGenerated("Route loaded · production model not generated.");
  updateRibbon();$("generate").disabled=false;$("downloadJob").disabled=false;
  void generateLivePreview();void loadLandcover();
}
function demoRoute(){
  const pts=[];const start=Date.parse("2026-08-20T06:00:00Z");
  for(let i=0;i<=140;i++){
    const t=i/140,a=t*Math.PI*2.15,lat=46.02+.23*Math.sin(a)*(.72+.28*Math.sin(t*Math.PI)),lon=7.35+.42*Math.cos(a)*(.7+.3*Math.cos(t*Math.PI*2));
    const ele=1550+1450*Math.max(0,Math.sin(a*.75))+460*Math.sin(a*2.2);
    pts.push({lat,lon,ele,time:start+i*7*60*1000,segment:1});
  }
  let distance=0,gain=0;const hav=(a,b)=>{const r=Math.PI/180,R=6371,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r,q=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))};
  for(let i=1;i<pts.length;i++){distance+=hav(pts[i-1],pts[i]);gain+=Math.max(0,pts[i].ele-pts[i-1].ele)}
  const bounds=previewBounds(pts);state.routes=[{name:"Alpine Super Randonnee Demo",points:pts,sourcePointCount:pts.length,distanceKm:distance,elevationGainM:gain,elapsedTimeSeconds:(pts.at(-1).time-pts[0].time)/1000,bounds}];
  state.route=state.routes[0];state.landcover=[];state.liveDemSampler=null;state.liveDemPromise=null;state.previewGeneration++;
  resetGenerated("Demo loaded · production model not generated.");updateRibbon();$("generate").disabled=false;$("downloadJob").disabled=false;
  void generateLivePreview();void loadLandcover();
}
async function loadOpenTopography(bounds){
  const apiKey=clean($("openTopoKey").value);if(!apiKey)throw new Error("OpenTopography API key is required for this optional source.");
  $("demStatus").textContent="Requesting "+$("openTopoDataset").value+" from OpenTopography…";
  const response=await fetch("/api/terrain/opentopography",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dataset:$("openTopoDataset").value,apiKey,bounds})});
  if(!response.ok){let message="OpenTopography returned "+response.status;try{message=(await response.json()).error||message}catch{}throw new Error(message)}
  const text=await response.text(),file=new File([text],"opentopography.asc",{type:"text/plain"}),raster=await loadArcAsciiFile(file);
  state.openTopoSampler=raster.sample;state.openTopoInfo={dataset:$("openTopoDataset").value,grid:raster.grid};
  $("demStatus").textContent="OpenTopography ready · "+$("openTopoDataset").value+" · "+raster.grid.ncols+"×"+raster.grid.nrows;
  return raster.sample;
}
async function resolveDem(config,bounds){
  if(config.dem.source==="terrarium"){
    $("demStatus").textContent="Loading AWS Terrarium elevation…";const terrain=await loadTerrariumSampler(bounds,{preferredZoom:11,tileBudget:48});
    $("demStatus").textContent="Terrarium ready · z"+terrain.zoom+" · "+terrain.tileCount+" tiles";return terrain.sample;
  }
  if(config.dem.source==="geotiff"){
    if(!state.demFile)throw new Error("Choose a GeoTIFF DEM.");$("demStatus").textContent="Reading GeoTIFF…";
    const raster=await loadGeoTiffFile(state.demFile,{fillNoData:true,smoothingRadius:0});$("demStatus").textContent="GeoTIFF ready · "+raster.width+"×"+raster.height+" · "+raster.sourceCrs;return raster.sampleLatLon;
  }
  if(config.dem.source==="opentopography")return state.openTopoSampler||loadOpenTopography(bounds);
  if(!state.arcFile)throw new Error("Choose an Arc-ASCII DEM.");$("demStatus").textContent="Reading Arc-ASCII…";
  const raster=await loadArcAsciiFile(state.arcFile);$("demStatus").textContent="Arc-ASCII ready · "+raster.grid.ncols+"×"+raster.grid.nrows;return raster.sample;
}
async function generate(){
  if(!state.route)return;
  const config=currentConfig();if((config.shape.kind==="geographic"||config.shape.kind==="geo-medallion")&&!state.geoOutline){$("productionStatus").textContent="Geographic terrain requires a selected or uploaded boundary.";return}
  $("generate").disabled=true;$("productionStatus").textContent="Loading DEM and building governed production mesh…";
  try{
    const bounds=productionBounds(state.route.bounds||previewBounds(state.route.points),config.shape),demSampler=await resolveDem(config,bounds);
    const mapEnabled=config.map.roads||config.map.trails||config.map.railways||config.map.buildings||config.placeLabels.mode!=="none";
    let cartography=null;
    if(mapEnabled){$("productionStatus").textContent="Loading roads / trails / railways / buildings / places…";cartography=await loadOpenFreeMapCartography(bounds,{preferredZoom:9,tileBudget:40})}
    const title=productionDisplayTitle(state.route.name,config.customization);
    state.production=await generateProductionModel({points:state.route.points,demSampler,cartography,landcover:state.landcover,config,logoImage:state.logoImage,heightmapImage:state.heightmapImage,title});
    const p=state.production;
    if($("visualPreset").value==="premium-medal"&&config.shape.kind==="geo-medallion"&&state.geoOutline){
      try{
        $("productionStatus").textContent="Baking premium hypsometric hillshade…";
        const terrainTexture=await buildPremiumTerrainTexture({projection:p.projection,demSampler,geometry:state.geoOutline,config,resolution:384});
        p.glb=encodeGlb(p.mesh,{title,materials:p.materials,texture:{png:terrainTexture.png,regions:[0,1,2,3,4],uv:premiumTextureUv(p.projection)}});
        p.quality={...(p.quality||{}),premiumTexture:true,textureResolution:terrainTexture.width};
        rebuildPrintPackage(p);
      }catch(error){p.quality={...(p.quality||{}),premiumTexture:false,textureError:String(error?.message||error)}}
    }
    $("productionStatus").textContent="READY · "+p.mesh.vertices.length.toLocaleString()+" vertices · "+p.mesh.triangles.length.toLocaleString()+" triangles · "+p.materials.length+" materials · "+p.profile.label;
    updateQualityBadge(p,"PRODUCTION");
    $("modelDiagnostics").textContent=[
      "Watertight: "+(p.validation.watertight?"YES":"NO"),
      "Quality guard: "+(p.quality?.surfaceLetteringSuppressed?"clean surface · ":"")+(p.quality?.outlineComponentsRemoved||0)+" micro parts removed · "+(p.quality?.placeLabelsPlanned||0)+" labels",
      "Route: "+config.fabrication.routeStyle+" · "+config.fabrication.routeWidthMm+" mm",
      "Shape: "+config.shape.kind+" · "+config.fabrication.modelWidthMm+" mm",
      "DEM: "+config.dem.source+" · XY "+config.fabrication.targetXyMm+" mm",
      "Layers: "+Object.entries(config.map).filter(([,v])=>v).map(([k])=>k).join(", "),
      "Extras: "+[config.contours.enabled&&"contours",config.fabrication.magnetEnabled&&"magnets",config.fabrication.hangerEnabled&&"hanger",state.logoImage&&"logo",state.heightmapImage&&"heightmap",config.fabrication.tiled&&"tiled",config.fabrication.standEnabled&&"stand"].filter(Boolean).join(", ")
    ].join("\n");
    document.querySelectorAll("[data-export]").forEach(b=>b.disabled=false);
    $("downloadValidation").disabled=!p.validationBundle;$("downloadPrintPackage").disabled=!p.printPackage;$("downloadStand").disabled=!p.standStl;$("downloadTiles").disabled=!p.tileBundle;$("downloadJob").disabled=false;$("issueAuthenticity").disabled=false;
    await ensureModelViewer();if(state.glbUrl)URL.revokeObjectURL(state.glbUrl);state.glbUrl=URL.createObjectURL(new Blob([p.glb],{type:"model/gltf-binary"}));
    $("modelViewer").src=state.glbUrl;$("viewerStatus").textContent="Exact governed GLB · orbit / zoom · AR where supported.";
    const prodTab=document.querySelector('[data-view="production"]');prodTab.disabled=false;prodTab.click();
  }catch(error){$("productionStatus").textContent=error.message||String(error)}
  finally{$("generate").disabled=false}
}
async function sha256Hex(bytes){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),digest=await crypto.subtle.digest("SHA-256",data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
async function issueAuthenticity(){
  if(!state.production)return;
  $("authenticityStatus").textContent="Hashing canonical exports and requesting signed receipt…";
  try{
    const p=state.production,files=[
      {name:"model.3mf",bytes:p.threeMf},{name:"model.stl",bytes:p.stl},{name:"model.glb",bytes:p.glb},{name:"model-obj.zip",bytes:p.objBundle}
    ],manifestFiles=[];
    for(const file of files){const bytes=file.bytes instanceof Uint8Array?file.bytes:new Uint8Array(file.bytes);manifestFiles.push({name:file.name,sha256:await sha256Hex(bytes),size:bytes.byteLength})}
    const manifest={artifactType:"terrain-medal",stem:stem(state.route?.name),files:manifestFiles,governed:{service:"VYNDI 3rd Diamension",shape:state.production.config.shape.kind,routeStyle:state.production.config.fabrication.routeStyle,printerProfile:state.production.config.production.printerProfile}};
    const response=await fetch("/api/authenticity/issue",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({manifest})}),data=await response.json();
    if(!response.ok)throw new Error(data.error||"Authenticity signing failed.");
    state.authenticity=data;$("authenticityStatus").textContent="SIGNED · "+data.claim.artifactId+" · manifest "+data.claim.manifestHash.slice(0,12)+"…";
    $("downloadAuthenticity").disabled=false;$("verifyAuthenticityLink").href=data.verificationUrl;$("verifyAuthenticityLink").hidden=false;
  }catch(error){$("authenticityStatus").textContent=error.message||String(error)}
}
async function searchGeography(){
  const q=clean($("geoSearch").value);if(!q)return;
  $("geoSearchStatus").textContent="Searching OpenStreetMap geography…";$("geoResults").replaceChildren();
  try{
    const response=await fetch("/api/geo/search?city="+encodeURIComponent(q)),data=await response.json();if(!response.ok)throw new Error(data.error||"Search failed.");
    const results=data.results||[];$("geoSearchStatus").textContent=results.length?results.length+" matches · choose exact boundary.":"No matching geography.";
    for(const item of results.slice(0,8)){
      const row=document.createElement("div");row.className="geo-result";const copy=document.createElement("div"),button=document.createElement("button");
      copy.innerHTML="<strong></strong><small></small>";copy.querySelector("strong").textContent=item.name||item.displayName||item.label||"Place";copy.querySelector("small").textContent=item.type||item.osmType||"OpenStreetMap";
      button.textContent="Use";button.addEventListener("click",()=>void selectGeography(item));row.append(copy,button);$("geoResults").append(row);
    }
  }catch(error){$("geoSearchStatus").textContent=error.message||String(error)}
}
async function selectGeography(item){
  const type=item.osmType||item.type,id=item.osmId||item.id;if(!type||!id){$("geoSearchStatus").textContent="This result has no polygon identifier.";return}
  $("geoSearchStatus").textContent="Loading boundary…";
  try{
    const response=await fetch("/api/geo/outline?type="+encodeURIComponent(type)+"&id="+encodeURIComponent(id)),data=await response.json();if(!response.ok)throw new Error(data.error||"Boundary failed.");
    state.geoOutline=data.geometry;state.geoMeta=data;$("shape").value=$("visualPreset").value==="premium-medal"?"geo-medallion":"geographic";$("geoSearchStatus").textContent="Boundary ready · "+data.name+" · "+($("shape").value==="geo-medallion"?"round premium medallion":"geographic cut-out");resetGenerated();schedulePreview(0);
  }catch(error){$("geoSearchStatus").textContent=error.message||String(error)}
}
function exportJob(){
  const config=currentConfig(),job={schema:"vyndi-3rd-diamension/job-v1",generatedAt:new Date().toISOString(),route:{name:state.route?.name,sourcePointCount:state.route?.sourcePointCount,distanceKm:state.route?.distanceKm,elevationGainM:state.route?.elevationGainM,routeCount:state.routes.length},geography:state.geoMeta,config};
  if(state.production)job.production={vertices:state.production.mesh.vertices.length,triangles:state.production.mesh.triangles.length,validation:state.production.validation,profile:state.production.profile};
  download(JSON.stringify(job,null,2),stem(state.route?.name)+"-production.json","application/json");
}

$("gpxInput").addEventListener("change",event=>void loadRoutes(event.target.files).catch(error=>{$("productionStatus").textContent=error.message||String(error)}));
$("demoRoute").addEventListener("click",demoRoute);
$("generate").addEventListener("click",()=>void generate());
$("issueAuthenticity").addEventListener("click",()=>void issueAuthenticity());
$("downloadAuthenticity").addEventListener("click",()=>state.authenticity&&download(JSON.stringify(state.authenticity,null,2),stem(state.route?.name)+"-authenticity.json","application/json"));
$("geoSearchButton").addEventListener("click",()=>void searchGeography());$("geoSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();void searchGeography()}});
$("geoJsonInput").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const geometry=JSON.parse(await file.text());state.geoOutline=geometry;state.geoMeta={name:file.name,source:"local GeoJSON"};$("shape").value=$("visualPreset").value==="premium-medal"?"geo-medallion":"geographic";$("geoSearchStatus").textContent="Local boundary ready · "+file.name;resetGenerated();schedulePreview(0)}catch(error){$("geoSearchStatus").textContent="Invalid GeoJSON · "+error.message}});
$("logoInput").addEventListener("change",async event=>{const file=event.target.files?.[0];state.logoImage=file?await readImageData(file):null;resetGenerated();schedulePreview(0)});
$("heightmapInput").addEventListener("change",async event=>{const file=event.target.files?.[0];state.heightmapImage=file?await readImageData(file):null;resetGenerated();schedulePreview(0)});
$("geoTiffInput").addEventListener("change",event=>{state.demFile=event.target.files?.[0]||null;$("demStatus").textContent=state.demFile?"GeoTIFF selected · "+state.demFile.name:"Choose a GeoTIFF DEM.";resetGenerated()});
$("arcInput").addEventListener("change",event=>{state.arcFile=event.target.files?.[0]||null;$("demStatus").textContent=state.arcFile?"Arc-ASCII selected · "+state.arcFile.name:"Choose an Arc-ASCII DEM.";resetGenerated()});
$("demSource").addEventListener("change",()=>{state.openTopoSampler=null;state.openTopoInfo=null;syncDemSource();resetGenerated()});
$("loadHighResDem").addEventListener("click",async()=>{if(!state.route)return void($("demStatus").textContent="Load a GPX route first.");try{const config=currentConfig(),bounds=productionBounds(state.route.bounds||previewBounds(state.route.points),config.shape);await loadOpenTopography(bounds);resetGenerated("OpenTopography DEM loaded · generate production model.")}catch(error){$("demStatus").textContent=error.message||String(error)}});
$("medalSize").addEventListener("change",()=>{syncMedalSize();resetGenerated();schedulePreview()});
$("printerProfile").addEventListener("change",()=>{syncPrinterProfile();resetGenerated()});
$("visualPreset").addEventListener("change",()=>applyVisualPreset($("visualPreset").value));

for(const id of ["riderName","eventDate","eventOverride","eventLocation","bib","resultStatus","startDetail","finishDetail","placing"])$(id).addEventListener("input",()=>{updateRibbon();resetGenerated();schedulePreview(260)});
document.querySelectorAll("[data-palette]").forEach(el=>el.addEventListener("input",event=>{
  document.querySelectorAll('[data-palette="'+event.target.dataset.palette+'"]').forEach(peer=>{if(peer!==event.target)peer.value=event.target.value});
  resetGenerated();schedulePreview();
}));
for(const id of ["routeBufferKm","relief","routeWidth","routeRise","mountainM","snowM","forestRaise","waterDepth","waterMode","waveHeight","waveSpacing","routeStyle","xyDetail","rimWidthMm","rimHeightMm","modelWidth","baseMm","shape","shapeAspect","surfaceLettering","contourEnabled","contourInterval","contourRise","magnetEnabled","magnetDiameter","magnetDepth","magnetSpacing","hangerEnabled","loopInnerDiameter","loopWall","bottomMark","logoWidth","logoRise","logoAuto","heightmapStrength","roads","trails","railways","buildings","elevationMode","elevationBlend","tileEnabled","tileMaxWidth","tileMaxHeight","tileJointType","tileJointDiameter","tileJointDepth","tileJointClearance","standEnabled","placeLabelMode"]){
  const el=$(id);if(!el)continue;el.addEventListener("input",()=>{syncOutputs();resetGenerated();schedulePreview()});el.addEventListener("change",()=>{syncOutputs();resetGenerated();schedulePreview()});
}
document.querySelectorAll("[data-panel-tab]").forEach(button=>button.addEventListener("click",()=>{
  document.querySelectorAll("[data-panel-tab]").forEach(b=>b.classList.toggle("active",b===button));
  document.querySelectorAll("[data-panel]").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===button.dataset.panelTab));
}));
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{
  if(button.disabled)return;document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b===button));
  const production=button.dataset.view==="production";$("liveStage").classList.toggle("active",!production);$("productionStage").classList.toggle("active",production);$("viewState").textContent=production?"PRODUCTION QUALITY":"LIVE 3D";
}));
document.querySelectorAll("[data-export]").forEach(button=>button.addEventListener("click",()=>{
  const p=state.production;if(!p)return;const s=stem(state.route?.name);
  if(button.dataset.export==="3mf")download(p.threeMf,s+".3mf","model/3mf");
  if(button.dataset.export==="stl")download(p.stl,s+".stl","model/stl");
  if(button.dataset.export==="obj")download(p.objBundle,s+"-obj.zip","application/zip");
  if(button.dataset.export==="glb")download(p.glb,s+".glb","model/gltf-binary");
}));
$("downloadValidation").addEventListener("click",()=>state.production?.validationBundle&&download(state.production.validationBundle,stem(state.route?.name)+"-validation.zip","application/zip"));
$("downloadStand").addEventListener("click",()=>state.production?.standStl&&download(state.production.standStl,stem(state.route?.name)+"-stand.stl","model/stl"));
$("downloadTiles").addEventListener("click",()=>state.production?.tileBundle&&download(state.production.tileBundle,stem(state.route?.name)+"-tiled.zip","application/zip"));
$("downloadPrintPackage").addEventListener("click",()=>state.production?.printPackage&&download(state.production.printPackage,stem(state.route?.name)+"-print-package.zip","application/zip"));
$("downloadJob").addEventListener("click",exportJob);
$("openAdvanced").onclick=()=>{$("advancedDrawer").classList.add("open");$("advancedDrawer").setAttribute("aria-hidden","false")};
$("closeAdvanced").onclick=()=>{$("advancedDrawer").classList.remove("open");$("advancedDrawer").setAttribute("aria-hidden","true")};
$("cameraIso").addEventListener("click",()=>applyCameraPreset("iso"));
$("cameraTop").addEventListener("click",()=>applyCameraPreset("top"));
$("cameraFit").addEventListener("click",()=>applyCameraPreset("fit"));
$("resetView").onclick=()=>applyCameraPreset("iso");

applyVisualPreset($("visualPreset").value,{initial:true});syncOutputs();syncPrinterProfile();syncDemSource();updateRibbon();
