import { parseGpxText } from "../../packages/gpx/gpx-core.mjs";
import { defaultAdvancedConfig, normalizeAdvancedConfig, productionDisplayTitle, productionBounds, loadTerrariumSampler, loadGeoTiffFile, loadArcAsciiFile, loadOpenFreeMapCartography, generateProductionModel } from "../../packages/toolkit/toolkit-core.mjs";
import { deriveRibbonMeta, formatDuration, normalizeTerrainPalette, terrainBandForElevation, DEFAULT_TERRAIN_PALETTE } from "../../packages/ui/ribbon-core.mjs";
import { fetchLandcover } from "../../packages/map/landcover-core.mjs";

const $=id=>document.getElementById(id);
const state={route:null,palette:{...DEFAULT_TERRAIN_PALETTE},production:null,glbUrl:null,previewUrl:null,previewTimer:null,previewGeneration:0,liveDemSampler:null,liveDemPromise:null,liveDemInfo:null,demFile:null,arcFile:null,landcover:[]};

function readOverrides(){
  const route=state.route||{};
  return {
    event:$("eventOverride").value,
    name:$("riderName").value,
    date:$("eventDate").value,
    distance:Number(route.distanceKm)>0?Math.round(Number(route.distanceKm)).toLocaleString("en-US")+" KM":"",
    elevation:Number(route.elevationGainM)>0?Math.round(Number(route.elevationGainM)).toLocaleString("en-US")+" M":"",
    duration:Number(route.elapsedTimeSeconds)>0?formatDuration(Number(route.elapsedTimeSeconds)):""
  };
}
function updateRibbon(){
  const meta=deriveRibbonMeta(state.route||{},readOverrides());
  $("ribbonEvent").textContent=meta.event;
  $("ribbonRider").textContent=[meta.rider,meta.date].filter(Boolean).join(" · ")||"RIDER · DATE";
  $("ribbonDistance").textContent=meta.distance;$("ribbonElevation").textContent=meta.elevation;$("ribbonDuration").textContent=meta.duration;$("ribbonPoints").textContent=meta.sourcePoints;
}
function readPalette(){const input={};document.querySelectorAll("[data-palette]").forEach(el=>input[el.dataset.palette]=el.value);state.palette=normalizeTerrainPalette(input);return state.palette}
function syncOutputs(){
  $("reliefOut").value=Number($("relief").value).toFixed(1)+" mm";
  $("routeWidthOut").value=Number($("routeWidth").value).toFixed(1)+" mm";
  $("mountainOut").value=$("mountainM").value+" m";$("snowOut").value=$("snowM").value+" m";
}
function previewBounds(points=[]){
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
  for(const p of points){minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon)}
  return {minLat,maxLat,minLon,maxLon};
}
function gpxPreviewSampler(points=[]){
  const valid=(points||[]).filter(p=>Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lon)));
  const stride=Math.max(1,Math.ceil(valid.length/320)),sample=[];
  for(let i=0;i<valid.length;i+=stride)sample.push(valid[i]);
  if(valid.length&&sample.at(-1)!==valid.at(-1))sample.push(valid.at(-1));
  const bounds=previewBounds(sample),latScale=1/Math.max(1e-9,bounds.maxLat-bounds.minLat),lonScale=1/Math.max(1e-9,bounds.maxLon-bounds.minLon);
  return (lat,lon)=>{
    const nearest=[];
    for(const p of sample){
      const dx=(Number(lon)-Number(p.lon))*lonScale,dy=(Number(lat)-Number(p.lat))*latScale,d2=dx*dx+dy*dy;
      const ele=Number(p.ele)||0;
      if(d2<1e-12)return ele;
      let at=nearest.findIndex(item=>d2<item.d2);
      if(at<0)at=nearest.length;
      nearest.splice(at,0,{d2,ele});
      if(nearest.length>4)nearest.pop();
    }
    if(!nearest.length)return 0;
    let weighted=0,total=0;
    for(const item of nearest){const w=1/(item.d2+1e-6);weighted+=item.ele*w;total+=w;}
    return total?weighted/total:nearest[0].ele;
  };
}

let modelViewerReady=null;
function ensureModelViewer(){return modelViewerReady||(modelViewerReady=import("./vendor/model-viewer.min.js"));}

function previewConfig(){
  const base=currentConfig();
  return normalizeAdvancedConfig({...base,
    map:{roads:false,trails:false,railways:false,buildings:false},
    fabrication:{...base.fabrication,targetXyMm:Math.max(3,Number(base.fabrication.targetXyMm)||3),tiled:false,magnetEnabled:false,standEnabled:false}
  });
}

async function installLiveModel(model,label){
  if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
  state.previewUrl=URL.createObjectURL(new Blob([model.glb],{type:"model/gltf-binary"}));
  await ensureModelViewer();
  $("liveModelViewer").src=state.previewUrl;
  $("liveEmpty").hidden=true;
  $("livePreviewStatus").textContent=label+" · "+model.mesh.vertices.length.toLocaleString()+" vertices · "+model.materials.length+" materials";
}

async function generateLivePreview({preferDem=true}={}){
  if(!state.route?.points?.length)return;
  const generation=++state.previewGeneration,route=state.route,config=previewConfig();
  $("livePreviewStatus").textContent=state.liveDemSampler?"REFINING LIVE 3D · TERRAIN DEM":"BUILDING LIVE 3D · GPX ELEVATION";
  try{
    const demSampler=state.liveDemSampler||gpxPreviewSampler(route.points);
    const title=productionDisplayTitle(route.name,config.customization);
    const model=await generateProductionModel({points:route.points,demSampler,cartography:null,landcover:state.landcover,config,title});
    if(generation!==state.previewGeneration||route!==state.route)return;
    await installLiveModel(model,state.liveDemSampler?"LIVE 3D READY · TERRAIN DEM":"LIVE 3D READY · GPX ELEVATION");
    if(preferDem&&!state.liveDemSampler&&!state.liveDemPromise)void enhanceLivePreviewWithTerrain(route);
  }catch(error){
    if(generation===state.previewGeneration)$("livePreviewStatus").textContent="LIVE 3D ERROR · "+(error.message||String(error));
  }
}

async function enhanceLivePreviewWithTerrain(route){
  if(!route?.points?.length||route!==state.route||state.liveDemSampler||state.liveDemPromise)return;
  const config=previewConfig(),bounds=productionBounds(previewBounds(route.points),config.shape);
  $("livePreviewStatus").textContent="LIVE 3D READY · GPX ELEVATION · loading real terrain…";
  state.liveDemPromise=loadTerrariumSampler(bounds,{preferredZoom:9,tileBudget:16});
  try{
    const terrain=await state.liveDemPromise;
    if(route!==state.route)return;
    state.liveDemSampler=terrain.sample;state.liveDemInfo=terrain;
    $("livePreviewStatus").textContent="REFINING LIVE 3D · TERRARIUM "+terrain.tileCount+" tiles";
    await generateLivePreview({preferDem:false});
  }catch(error){
    if(route===state.route)$("livePreviewStatus").textContent="LIVE 3D READY · GPX ELEVATION · terrain refinement unavailable";
  }finally{
    state.liveDemPromise=null;
  }
}

function schedulePreview(delay=180){
  clearTimeout(state.previewTimer);
  state.previewTimer=setTimeout(()=>void generateLivePreview(),delay);
}

function download(data,name,type="application/octet-stream"){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function currentConfig(){
  const base=defaultAdvancedConfig(),palette=readPalette();
  return normalizeAdvancedConfig({...base,
    colors:{
      ...base.colors,
      land:palette.land,terrain:palette.land,forest:palette.forest,mountain:palette.mountain,
      snow:palette.snow,water:palette.water,route:palette.route,roads:palette.roads,
      trails:palette.forest,text:palette.labels,logo:palette.labels
    },
    terrainBands:{mountainM:Number($("mountainM").value),snowM:Number($("snowM").value)},
    customization:readOverrides(),
    map:{roads:$("roads").checked,trails:$("trails").checked,railways:$("railways").checked,buildings:$("buildings").checked},
    shape:{...base.shape,kind:$("shape").value},
    fabrication:{...base.fabrication,modelWidthMm:Number($("modelWidth").value),baseMm:Number($("baseMm").value),reliefMm:Number($("relief").value),targetXyMm:Number($("xyDetail").value),routeWidthMm:Number($("routeWidth").value),tiled:$("tiled").checked,magnetEnabled:$("magnets").checked,standEnabled:$("stand").checked},
    dem:{...base.dem,source:$("demSource").value,routeElevationMode:$("elevationMode").value}
  });
}
async function generate(){
  if(!state.route)return;
  $("generate").disabled=true;$("productionStatus").textContent="Loading terrain and building governed mesh…";
  try{
    const config=currentConfig(),bounds=productionBounds({minLat:Math.min(...state.route.points.map(p=>p.lat)),maxLat:Math.max(...state.route.points.map(p=>p.lat)),minLon:Math.min(...state.route.points.map(p=>p.lon)),maxLon:Math.max(...state.route.points.map(p=>p.lon))},config.shape);
    let demSampler;
    if(config.dem.source==="terrarium"){
      $("demStatus").textContent="Loading AWS Terrarium elevation…";
      const terrain=await loadTerrariumSampler(bounds,{preferredZoom:11,tileBudget:48});
      demSampler=terrain.sample;
      $("demStatus").textContent="Terrarium ready · zoom "+terrain.zoom+" · "+terrain.tileCount+" tiles";
    }else if(config.dem.source==="geotiff"){
      if(!state.demFile)throw new Error("Choose a GeoTIFF DEM in Advanced → DEM & elevation.");
      $("demStatus").textContent="Reading GeoTIFF…";
      const raster=await loadGeoTiffFile(state.demFile,{fillNoData:true,smoothingRadius:0});
      demSampler=raster.sampleLatLon;
      $("demStatus").textContent="GeoTIFF ready · "+raster.width+"×"+raster.height+" · "+raster.sourceCrs;
    }else{
      if(!state.arcFile)throw new Error("Choose an Arc-ASCII DEM in Advanced → DEM & elevation.");
      $("demStatus").textContent="Reading Arc-ASCII…";
      const raster=await loadArcAsciiFile(state.arcFile);
      demSampler=raster.sample;
      $("demStatus").textContent="Arc-ASCII ready · "+raster.grid.ncols+"×"+raster.grid.nrows;
    }
    const mapEnabled=config.map.roads||config.map.trails||config.map.railways||config.map.buildings;
    let cartography=null;
    if(mapEnabled){
      $("productionStatus").textContent="Loading OpenFreeMap roads / trails / railways / buildings…";
      cartography=await loadOpenFreeMapCartography(bounds,{preferredZoom:9,tileBudget:40});
    }
    const title=productionDisplayTitle(state.route.name,config.customization);
    state.production=await generateProductionModel({points:state.route.points,demSampler,cartography,landcover:state.landcover,config,title});
    const p=state.production;
    $("productionStatus").textContent="READY · "+p.mesh.vertices.length.toLocaleString()+" vertices · "+p.mesh.triangles.length.toLocaleString()+" triangles · "+p.materials.length+" governed materials";
    document.querySelectorAll("[data-export]").forEach(b=>b.disabled=false);$("downloadValidation").disabled=!p.validationBundle;
    await ensureModelViewer();
    if(state.glbUrl)URL.revokeObjectURL(state.glbUrl);state.glbUrl=URL.createObjectURL(new Blob([p.glb],{type:"model/gltf-binary"}));
    $("modelViewer").src=state.glbUrl;$("viewerStatus").textContent="Exact governed GLB · drag to orbit · AR where supported.";
    const prodTab=document.querySelector('[data-view="production"]');prodTab.disabled=false;prodTab.click();
  }catch(error){$("productionStatus").textContent=error.message||String(error)}
  finally{$("generate").disabled=false}
}
async function loadLandcover(){
  if(!state.route?.points?.length)return;
  $("landcoverStatus").textContent="loading forest + water…";
  const result=await fetchLandcover(previewBounds(state.route.points));
  state.landcover=result.features||[];
  $("landcoverStatus").textContent=result.ok?state.landcover.length+" landcover features":"palette ready · landcover unavailable";
  schedulePreview(0);
}
$("gpxInput").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{
  state.route=parseGpxText(await file.text(),file.name);state.landcover=[];state.liveDemSampler=null;state.liveDemPromise=null;state.liveDemInfo=null;state.previewGeneration++;
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null;}
  $("liveModelViewer").removeAttribute("src");$("liveEmpty").hidden=false;$("livePreviewStatus").textContent="BUILDING LIVE 3D · GPX ELEVATION";
  updateRibbon();$("generate").disabled=false;$("productionStatus").textContent="Route loaded · live 3D building · production ready.";
  void generateLivePreview();void loadLandcover();
}catch(error){$("productionStatus").textContent=error.message||String(error);$("livePreviewStatus").textContent="LIVE 3D ERROR · "+(error.message||String(error))}});
["riderName","eventDate","eventOverride"].forEach(id=>$(id).addEventListener("input",()=>{updateRibbon();schedulePreview(260)}));
document.querySelectorAll("[data-palette],#relief,#routeWidth,#mountainM,#snowM").forEach(el=>el.addEventListener("input",()=>{syncOutputs();schedulePreview()}));
$("generate").addEventListener("click",()=>void generate());
$("openAdvanced").onclick=()=>{$("advancedDrawer").classList.add("open");$("advancedDrawer").setAttribute("aria-hidden","false")};
$("closeAdvanced").onclick=()=>{$("advancedDrawer").classList.remove("open");$("advancedDrawer").setAttribute("aria-hidden","true")};
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{if(button.disabled)return;document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b===button));const production=button.dataset.view==="production";$("liveStage").classList.toggle("active",!production);$("productionStage").classList.toggle("active",production);$("viewState").textContent=production?"PRODUCTION QUALITY":"LIVE 3D"}));
document.querySelectorAll("[data-export]").forEach(button=>button.addEventListener("click",()=>{const p=state.production;if(!p)return;const stem=(state.route?.name||"vyndi-3rd-diamension").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();if(button.dataset.export==="3mf")download(p.threeMf,stem+".3mf","model/3mf");if(button.dataset.export==="stl")download(p.stl,stem+".stl","model/stl");if(button.dataset.export==="obj")download(p.objBundle,stem+"-obj.zip","application/zip");if(button.dataset.export==="glb")download(p.glb,stem+".glb","model/gltf-binary")}));
$("downloadValidation").addEventListener("click",()=>state.production?.validationBundle&&download(state.production.validationBundle,"validation.zip","application/zip"));
$("resetView").onclick=()=>{for(const id of ["liveModelViewer","modelViewer"]){const viewer=$(id);if(viewer){viewer.cameraOrbit="0deg 62deg auto";viewer.fieldOfView="30deg";viewer.jumpCameraToGoal?.();}}};
syncOutputs();updateRibbon();

function syncDemSource(){
  const source=$("demSource").value;
  $("geoTiffRow").hidden=source!=="geotiff";
  $("arcRow").hidden=source!=="arc";
  if(source==="terrarium")$("demStatus").textContent="Terrarium will load automatically during production.";
}
$("demSource").addEventListener("change",syncDemSource);
$("geoTiffInput").addEventListener("change",event=>{state.demFile=event.target.files?.[0]||null;$("demStatus").textContent=state.demFile?"GeoTIFF selected · "+state.demFile.name:"Choose a GeoTIFF DEM.";});
$("arcInput").addEventListener("change",event=>{state.arcFile=event.target.files?.[0]||null;$("demStatus").textContent=state.arcFile?"Arc-ASCII selected · "+state.arcFile.name:"Choose an Arc-ASCII DEM.";});
syncDemSource();
