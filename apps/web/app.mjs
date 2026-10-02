import { parseGpxText } from "../../packages/gpx/gpx-core.mjs";
import { defaultAdvancedConfig, normalizeAdvancedConfig, productionDisplayTitle, productionBounds, loadTerrariumSampler, loadGeoTiffFile, loadArcAsciiFile, generateProductionModel } from "../../packages/toolkit/toolkit-core.mjs";
import { deriveRibbonMeta, normalizeTerrainPalette, terrainBandForElevation, DEFAULT_TERRAIN_PALETTE } from "../../packages/ui/ribbon-core.mjs";

const $=id=>document.getElementById(id);
const state={route:null,palette:{...DEFAULT_TERRAIN_PALETTE},production:null,glbUrl:null,yaw:-.35,pitch:.82,zoom:1,drag:false,last:[0,0],demFile:null,arcFile:null};

function readOverrides(){return {event:$("eventOverride").value,rider:$("riderName").value,date:$("eventDate").value}}
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
function projectPoints(points,w,h){
  if(!points?.length)return [];
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity;
  for(const p of points){minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon)}
  const sx=Math.max(1e-9,maxLon-minLon),sy=Math.max(1e-9,maxLat-minLat),pad=.1;
  return points.map(p=>({x:(pad+(p.lon-minLon)/sx*(1-2*pad))*w,y:(1-pad-(p.lat-minLat)/sy*(1-2*pad))*h,ele:Number(p.ele)||0}));
}
function render(){
  const canvas=$("terrainCanvas"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,p=readPalette();
  ctx.clearRect(0,0,w,h);
  const g=ctx.createLinearGradient(0,h,0,0);g.addColorStop(0,p.land);g.addColorStop(.58,p.mountain);g.addColorStop(1,p.snow);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  ctx.globalAlpha=.17;ctx.strokeStyle="#000";ctx.lineWidth=1;
  for(let y=0;y<h;y+=32){ctx.beginPath();for(let x=0;x<=w;x+=16){const wave=Math.sin((x+y)*.018+state.yaw)*8*state.zoom;const yy=y+wave;if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy)}ctx.stroke()}
  ctx.globalAlpha=1;
  if(!state.route?.points?.length){
    ctx.fillStyle="#071014aa";ctx.fillRect(w*.28,h*.39,w*.44,h*.18);ctx.fillStyle="#fff";ctx.font="700 28px Arial";ctx.textAlign="center";ctx.fillText("DROP A GPX INTO THE RIBBON",w/2,h*.48);return;
  }
  const pts=projectPoints(state.route.points,w,h);
  const mountain=Number($("mountainM").value),snow=Number($("snowM").value);
  ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=Math.max(3,Number($("routeWidth").value)*2.2);
  for(let i=1;i<pts.length;i++){
    const band=terrainBandForElevation((pts[i-1].ele+pts[i].ele)/2,{mountainM:mountain,snowM:snow});
    ctx.strokeStyle=band==="snow"?p.snow:band==="mountain"?p.mountain:p.route;
    ctx.beginPath();ctx.moveTo(pts[i-1].x,pts[i-1].y);ctx.lineTo(pts[i].x,pts[i].y);ctx.stroke();
  }
  ctx.fillStyle="#071014bb";ctx.fillRect(18,18,360,74);ctx.textAlign="left";ctx.fillStyle=p.labels;ctx.font="800 19px Arial";ctx.fillText($("ribbonEvent").textContent,34,48);ctx.fillStyle="#e8eeea";ctx.font="12px Arial";ctx.fillText($("ribbonDistance").textContent+" · "+$("ribbonElevation").textContent+" · "+$("ribbonDuration").textContent,34,72);
}
function download(data,name,type="application/octet-stream"){const blob=data instanceof Blob?data:new Blob([data],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function currentConfig(){
  const base=defaultAdvancedConfig(),palette=readPalette();
  return normalizeAdvancedConfig({...base,
    colors:{...base.colors,terrain:palette.land,route:palette.route,roads:palette.roads,text:palette.labels,logo:palette.labels},
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
    const title=productionDisplayTitle(state.route.name,config.customization);
    state.production=await generateProductionModel({points:state.route.points,demSampler,cartography:null,config,title});
    const p=state.production;
    $("productionStatus").textContent="READY · "+p.mesh.vertices.length.toLocaleString()+" vertices · "+p.mesh.triangles.length.toLocaleString()+" triangles";
    document.querySelectorAll("[data-export]").forEach(b=>b.disabled=false);$("downloadValidation").disabled=!p.validationBundle;
    await import("./vendor/model-viewer.min.js");
    if(state.glbUrl)URL.revokeObjectURL(state.glbUrl);state.glbUrl=URL.createObjectURL(new Blob([p.glb],{type:"model/gltf-binary"}));
    $("modelViewer").src=state.glbUrl;$("viewerStatus").textContent="Exact governed GLB · drag to orbit · AR where supported.";
    const prodTab=document.querySelector('[data-view="production"]');prodTab.disabled=false;prodTab.click();
  }catch(error){$("productionStatus").textContent=error.message||String(error)}
  finally{$("generate").disabled=false}
}
$("gpxInput").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{state.route=parseGpxText(await file.text(),file.name);updateRibbon();$("generate").disabled=false;$("productionStatus").textContent="Route loaded · ready to generate.";render()}catch(error){$("productionStatus").textContent=error.message||String(error)}});
["riderName","eventDate","eventOverride"].forEach(id=>$(id).addEventListener("input",()=>{updateRibbon();render()}));
document.querySelectorAll("[data-palette],#relief,#routeWidth,#mountainM,#snowM").forEach(el=>el.addEventListener("input",()=>{syncOutputs();render()}));
$("generate").addEventListener("click",()=>void generate());
$("openAdvanced").onclick=()=>{$("advancedDrawer").classList.add("open");$("advancedDrawer").setAttribute("aria-hidden","false")};
$("closeAdvanced").onclick=()=>{$("advancedDrawer").classList.remove("open");$("advancedDrawer").setAttribute("aria-hidden","true")};
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>{if(button.disabled)return;document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b===button));const production=button.dataset.view==="production";$("conceptStage").classList.toggle("active",!production);$("productionStage").classList.toggle("active",production);$("viewState").textContent=production?"PRODUCTION GLB":"CONCEPT"}));
document.querySelectorAll("[data-export]").forEach(button=>button.addEventListener("click",()=>{const p=state.production;if(!p)return;const stem=(state.route?.name||"vyndi-3rd-diamension").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase();if(button.dataset.export==="3mf")download(p.threeMf,stem+".3mf","model/3mf");if(button.dataset.export==="stl")download(p.stl,stem+".stl","model/stl");if(button.dataset.export==="obj")download(p.objBundle,stem+"-obj.zip","application/zip");if(button.dataset.export==="glb")download(p.glb,stem+".glb","model/gltf-binary")}));
$("downloadValidation").addEventListener("click",()=>state.production?.validationBundle&&download(state.production.validationBundle,"validation.zip","application/zip"));
$("resetView").onclick=()=>{state.yaw=-.35;state.pitch=.82;state.zoom=1;render()};
const canvas=$("terrainCanvas");canvas.addEventListener("pointerdown",e=>{state.drag=true;state.last=[e.clientX,e.clientY];canvas.setPointerCapture?.(e.pointerId)});canvas.addEventListener("pointermove",e=>{if(!state.drag)return;state.yaw+=(e.clientX-state.last[0])*.007;state.pitch+=(e.clientY-state.last[1])*.006;state.last=[e.clientX,e.clientY];render()});canvas.addEventListener("pointerup",()=>state.drag=false);canvas.addEventListener("wheel",e=>{e.preventDefault();state.zoom=Math.max(.5,Math.min(3,state.zoom*(e.deltaY>0?.92:1.08)));render()},{passive:false});
syncOutputs();updateRibbon();render();

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
