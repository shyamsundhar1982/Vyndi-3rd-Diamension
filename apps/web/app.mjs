import { parseGpxText, mergeGpxRoutes } from "../../packages/gpx/gpx-core.mjs";
import {
  defaultAdvancedConfig, normalizeAdvancedConfig, productionDisplayTitle, productionBounds,
  loadTerrariumSampler, loadGeoTiffFile, loadArcAsciiFile, loadOpenFreeMapCartography,
  generateProductionModel, PRINTER_PROFILES
} from "../../packages/toolkit/toolkit-core.mjs";
import { deriveRibbonMeta, formatDuration, DEFAULT_TERRAIN_PALETTE } from "../../packages/ui/ribbon-core.mjs";
import { fetchLandcover } from "../../packages/map/landcover-core.mjs";

const $=id=>document.getElementById(id);
const state={
  route:null,routes:[],palette:{...DEFAULT_TERRAIN_PALETTE,rim:"#23201d",trails:"#3f6b3a",railways:"#7e8791",buildings:"#d8d1c4"},
  production:null,glbUrl:null,previewUrl:null,previewTimer:null,previewGeneration:0,
  liveDemSampler:null,liveDemPromise:null,liveDemInfo:null,demFile:null,arcFile:null,
  landcover:[],logoImage:null,heightmapImage:null,geoOutline:null,geoMeta:null,
  authenticity:null
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
function syncDemSource(){
  const source=$("demSource").value;
  $("geoTiffRow").hidden=source!=="geotiff";$("arcRow").hidden=source!=="arc";
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
    production:{printerProfile:$("printerProfile").value,medalSize:$("medalSize").value,bottomMark:$("bottomMark").value,bottomEngraveDepthMm:finite($("bottomEngraveDepth").value,.35)},
    customization:{...readOverrides(),location:$("eventLocation").value,bib:$("bib").value,status:$("resultStatus").value,start:$("startDetail").value,finish:$("finishDetail").value,placing:$("placing").value},
    map:{roads:$("roads").checked,trails:$("trails").checked,railways:$("railways").checked,buildings:$("buildings").checked},
    shape:{
      ...base.shape,kind:shapeKind,aspect:finite($("shapeAspect").value,1.35),
      outlineGeometry:shapeKind==="geographic"?state.geoOutline:null,
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
async function installLiveModel(model,label){
  if(state.previewUrl)URL.revokeObjectURL(state.previewUrl);
  state.previewUrl=URL.createObjectURL(new Blob([model.glb],{type:"model/gltf-binary"}));
  await ensureModelViewer();$("liveModelViewer").src=state.previewUrl;$("liveEmpty").hidden=true;
  $("livePreviewStatus").textContent=label+" · "+model.mesh.vertices.length.toLocaleString()+" vertices · "+model.materials.length+" materials";
}
async function generateLivePreview({preferDem=true}={}){
  if(!state.route?.points?.length)return;
  const generation=++state.previewGeneration,route=state.route,config=previewConfig();
  if(config.shape.kind==="geographic"&&!state.geoOutline){$("livePreviewStatus").textContent="Select / upload a geographic boundary.";return}
  $("livePreviewStatus").textContent=state.liveDemSampler?"REFINING LIVE 3D · TERRAIN DEM":"BUILDING LIVE 3D · GPX ELEVATION";
  try{
    const demSampler=state.liveDemSampler||gpxPreviewSampler(route.points),title=productionDisplayTitle(route.name,config.customization);
    const model=await generateProductionModel({points:route.points,demSampler,cartography:null,landcover:state.landcover,config,logoImage:state.logoImage,heightmapImage:state.heightmapImage,title});
    if(generation!==state.previewGeneration||route!==state.route)return;
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
async function resolveDem(config,bounds){
  if(config.dem.source==="terrarium"){
    $("demStatus").textContent="Loading AWS Terrarium elevation…";const terrain=await loadTerrariumSampler(bounds,{preferredZoom:11,tileBudget:48});
    $("demStatus").textContent="Terrarium ready · z"+terrain.zoom+" · "+terrain.tileCount+" tiles";return terrain.sample;
  }
  if(config.dem.source==="geotiff"){
    if(!state.demFile)throw new Error("Choose a GeoTIFF DEM.");$("demStatus").textContent="Reading GeoTIFF…";
    const raster=await loadGeoTiffFile(state.demFile,{fillNoData:true,smoothingRadius:0});$("demStatus").textContent="GeoTIFF ready · "+raster.width+"×"+raster.height+" · "+raster.sourceCrs;return raster.sampleLatLon;
  }
  if(!state.arcFile)throw new Error("Choose an Arc-ASCII DEM.");$("demStatus").textContent="Reading Arc-ASCII…";
  const raster=await loadArcAsciiFile(state.arcFile);$("demStatus").textContent="Arc-ASCII ready · "+raster.grid.ncols+"×"+raster.grid.nrows;return raster.sample;
}
async function generate(){
  if(!state.route)return;
  const config=currentConfig();if(config.shape.kind==="geographic"&&!state.geoOutline){$("productionStatus").textContent="Geographic shape requires a selected or uploaded boundary.";return}
  $("generate").disabled=true;$("productionStatus").textContent="Loading DEM and building governed production mesh…";
  try{
    const bounds=productionBounds(state.route.bounds||previewBounds(state.route.points),config.shape),demSampler=await resolveDem(config,bounds);
    const mapEnabled=config.map.roads||config.map.trails||config.map.railways||config.map.buildings||config.placeLabels.mode!=="none";
    let cartography=null;
    if(mapEnabled){$("productionStatus").textContent="Loading roads / trails / railways / buildings / places…";cartography=await loadOpenFreeMapCartography(bounds,{preferredZoom:9,tileBudget:40})}
    const title=productionDisplayTitle(state.route.name,config.customization);
    state.production=await generateProductionModel({points:state.route.points,demSampler,cartography,landcover:state.landcover,config,logoImage:state.logoImage,heightmapImage:state.heightmapImage,title});
    const p=state.production;
    $("productionStatus").textContent="READY · "+p.mesh.vertices.length.toLocaleString()+" vertices · "+p.mesh.triangles.length.toLocaleString()+" triangles · "+p.materials.length+" materials · "+p.profile.label;
    $("modelDiagnostics").textContent=[
      "Watertight: "+(p.validation.watertight?"YES":"NO"),
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
    state.geoOutline=data.geometry;state.geoMeta=data;$("shape").value="geographic";$("geoSearchStatus").textContent="Boundary ready · "+data.name;resetGenerated();schedulePreview(0);
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
$("geoJsonInput").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{const geometry=JSON.parse(await file.text());state.geoOutline=geometry;state.geoMeta={name:file.name,source:"local GeoJSON"};$("shape").value="geographic";$("geoSearchStatus").textContent="Local boundary ready · "+file.name;resetGenerated();schedulePreview(0)}catch(error){$("geoSearchStatus").textContent="Invalid GeoJSON · "+error.message}});
$("logoInput").addEventListener("change",async event=>{const file=event.target.files?.[0];state.logoImage=file?await readImageData(file):null;resetGenerated();schedulePreview(0)});
$("heightmapInput").addEventListener("change",async event=>{const file=event.target.files?.[0];state.heightmapImage=file?await readImageData(file):null;resetGenerated();schedulePreview(0)});
$("geoTiffInput").addEventListener("change",event=>{state.demFile=event.target.files?.[0]||null;$("demStatus").textContent=state.demFile?"GeoTIFF selected · "+state.demFile.name:"Choose a GeoTIFF DEM.";resetGenerated()});
$("arcInput").addEventListener("change",event=>{state.arcFile=event.target.files?.[0]||null;$("demStatus").textContent=state.arcFile?"Arc-ASCII selected · "+state.arcFile.name:"Choose an Arc-ASCII DEM.";resetGenerated()});
$("demSource").addEventListener("change",()=>{syncDemSource();resetGenerated()});
$("medalSize").addEventListener("change",()=>{syncMedalSize();resetGenerated();schedulePreview()});
$("printerProfile").addEventListener("change",()=>{syncPrinterProfile();resetGenerated()});

for(const id of ["riderName","eventDate","eventOverride","eventLocation","bib","resultStatus","startDetail","finishDetail","placing"])$(id).addEventListener("input",()=>{updateRibbon();resetGenerated();schedulePreview(260)});
document.querySelectorAll("[data-palette]").forEach(el=>el.addEventListener("input",event=>{
  document.querySelectorAll('[data-palette="'+event.target.dataset.palette+'"]').forEach(peer=>{if(peer!==event.target)peer.value=event.target.value});
  resetGenerated();schedulePreview();
}));
for(const id of ["relief","routeWidth","routeRise","mountainM","snowM","forestRaise","waterDepth","waterMode","waveHeight","waveSpacing","routeStyle","xyDetail","rimWidthMm","rimHeightMm","modelWidth","baseMm","shape","shapeAspect","contourEnabled","contourInterval","contourRise","magnetEnabled","magnetDiameter","magnetDepth","magnetSpacing","hangerEnabled","loopInnerDiameter","loopWall","bottomMark","logoWidth","logoRise","logoAuto","heightmapStrength","roads","trails","railways","buildings","elevationMode","elevationBlend","tileEnabled","tileMaxWidth","tileMaxHeight","tileJointType","tileJointDiameter","tileJointDepth","tileJointClearance","standEnabled","placeLabelMode"]){
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
$("resetView").onclick=()=>{for(const id of ["liveModelViewer","modelViewer"]){const viewer=$(id);if(viewer){viewer.cameraOrbit="-25deg 50deg auto";viewer.fieldOfView="30deg";viewer.jumpCameraToGoal?.()}}};

syncOutputs();syncPrinterProfile();syncDemSource();updateRibbon();
