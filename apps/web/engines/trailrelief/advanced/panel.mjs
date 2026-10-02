import {
  PRODUCTION_FORMATS,
  defaultAdvancedConfig,
  parseGpxText,
  extractGpxName,
  shouldPreprocessLiveGpx,
  routeBounds,
  expandBounds,
  productionBounds,
  loadTerrariumSampler,
  loadGeoTiffFile,
  loadArcAsciiFile,
  loadOpenFreeMapCartography,
  reconcileRouteElevations,
  generateProductionModel,
  productionDisplayTitle
} from "./toolkit-core.mjs";

const state={
  route:null,
  routeMeta:null,
  gpxFile:null,
  routePromise:null,
  routeWorker:null,
  demFile:null,
  arcFile:null,
  demSampler:null,
  demInfo:null,
  cartography:null,
  outlineGeometry:null,
  logoImage:null,
  production:null,
  glbUrl:null,
  displayTitle:""
};

const qs=(selector,root=document)=>root.querySelector(selector);
const qsa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));

function filenameStem(value){
  return String(value||"trailrelief").replace(/\.[^.]+$/,"").replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toLowerCase()||"trailrelief";
}

function setText(id,text){
  const el=document.getElementById(id);
  if(el)el.textContent=text;
}

function setBusy(busy){
  qsa("[data-tr-export]").forEach(button=>button.disabled=busy||!state.production);
  const generate=document.getElementById("tr-generate");
  if(generate){generate.disabled=busy;generate.textContent=busy?"Generating…":"Generate production model";}
}

function routeSummary(){
  if(!state.route){
    if(state.routeMeta){
      const mb=(state.routeMeta.sizeBytes/1048576).toFixed(1);
      return state.routeMeta.name+" · "+mb+" MB · Advanced parse deferred";
    }
    return "GPX not captured yet";
  }
  const p=state.route.points,b=state.route.bounds,source=state.route.sourcePointCount||p.length;
  const density=state.route.simplified?(" · "+p.length.toLocaleString()+" used"):"";
  return state.route.name+" · "+source.toLocaleString()+" source points"+density+" · "+b.minLat.toFixed(3)+","+b.minLon.toFixed(3)+" → "+b.maxLat.toFixed(3)+","+b.maxLon.toFixed(3);
}


function customizationFromUi(){
  return {
    event:value("tr-custom-event",state.route?.name||state.routeMeta?.name||""),
    name:value("tr-custom-name",""),
    date:value("tr-custom-date","")
  };
}

function borderTitle(){
  const custom=customizationFromUi(),parts=[];
  for(const candidate of [custom.event||state.route?.name||state.routeMeta?.name||"",custom.name]){
    const clean=String(candidate||"").trim();
    if(clean&&!parts.some(item=>item.toLocaleLowerCase()===clean.toLocaleLowerCase()))parts.push(clean);
  }
  return parts.join(" · ");
}

function setNativeInputValue(input,next){
  if(!(input instanceof HTMLInputElement))return;
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;
  if(setter)setter.call(input,next);else input.value=next;
  input.dispatchEvent(new Event("input",{bubbles:true}));
  input.dispatchEvent(new Event("change",{bubbles:true}));
}

function originalFieldByCaption(caption){
  const sidebar=qs("aside");
  if(!sidebar)return null;
  for(const span of qsa("span",sidebar)){
    if(span.textContent?.trim()!==caption)continue;
    const field=span.parentElement?.parentElement?.querySelector("input");
    if(field instanceof HTMLInputElement)return field;
  }
  return null;
}


function originalDisplayNumber(caption){
  const sidebar=qs("aside");
  if(!sidebar)return null;
  for(const span of qsa("span",sidebar)){
    if(span.textContent?.trim()!==caption)continue;
    const container=span.parentElement;
    const text=String(container?.textContent||"").replace(caption," ");
    const match=text.match(/-?\d+(?:\.\d+)?/);
    if(match)return Number(match[0]);
  }
  return null;
}

function originalColor(label){
  const sidebar=qs("aside");
  if(!sidebar)return null;
  for(const span of qsa("span",sidebar)){
    if(span.textContent?.trim()!==label)continue;
    let node=span.parentElement;
    for(let depth=0;node&&depth<4;depth++,node=node.parentElement){
      const input=node.querySelector?.('input[type="color"]');
      if(input instanceof HTMLInputElement&&/^#[0-9a-f]{6}$/i.test(input.value))return input.value;
    }
  }
  return null;
}

function originalPlateShape(){
  const sidebar=qs("aside");if(!sidebar)return null;
  const map={rou:"circle",squ:"square",hex:"hexagon",tri:"triangle"};
  const candidates=qsa("button",sidebar).filter(button=>map[button.textContent?.trim().toLowerCase()]);
  const selected=candidates.find(button=>String(button.className).includes("bg-primary")||button.getAttribute("data-state")==="active");
  return selected?map[selected.textContent.trim().toLowerCase()]:null;
}

function readSimpleWorkbench(){
  return {
    shape:originalPlateShape(),
    modelWidth:originalDisplayNumber("Model width"),
    base:originalDisplayNumber("Base thickness"),
    routeWidth:originalDisplayNumber("Route width"),
    routeRise:originalDisplayNumber("Route height"),
    colors:{
      terrain:originalColor("Lowland"),
      route:originalColor("Route"),
      trails:originalColor("Forest"),
      text:originalColor("Border text")
    }
  };
}

function syncCustomizationToOriginal(){
  const titleInput=originalFieldByCaption("Title");
  const dateInput=originalFieldByCaption("Date (optional)");
  const title=borderTitle(),date=customizationFromUi().date;
  if(titleInput&&titleInput.value!==title)setNativeInputValue(titleInput,title);
  if(dateInput&&dateInput.value!==date)setNativeInputValue(dateInput,date);
  updateCustomizationSummary();
}

function updateCustomizationSummary(){
  const summary=document.getElementById("tr-custom-summary");
  if(!summary)return;
  const custom=customizationFromUi(),parts=[custom.event||state.route?.name||state.routeMeta?.name||"",custom.name,custom.date].filter(Boolean);
  summary.textContent=parts.length?parts.join(" · "):"Event, name & date";
}

function seedCustomizationFromRoute(){
  const eventInput=document.getElementById("tr-custom-event");
  const routeName=state.route?.name||state.routeMeta?.name||"";
  if(eventInput&&!eventInput.value.trim()&&routeName)eventInput.value=routeName;
  updateCustomizationSummary();
  setTimeout(syncCustomizationToOriginal,0);
}

function customizationMarkup(){
  return '<details class="tr-customise">'+
    '<summary><span>Personalise</span><small id="tr-custom-summary">Event, name & date</small></summary>'+
    '<div class="tr-customise-body">'+
      '<label>Event<input id="tr-custom-event" placeholder="e.g. Paris Brest Paris 2023"></label>'+
      '<div class="tr-customise-pair">'+
        '<label>Name<input id="tr-custom-name" placeholder="Rider / athlete name"></label>'+
        '<label>Date<input id="tr-custom-date" placeholder="e.g. 20 AUG 2023"></label>'+
      '</div>'+
      '<p>Mirrors TrailRelief border Title/Date when those controls are available.</p>'+
    '</div>'+
  '</details>';
}

function mountCustomization(sidebar,header){
  if(document.getElementById("tr-customise-wrap"))return;
  const uploadBlock=header?.nextElementSibling;
  if(!uploadBlock)return;
  const wrap=document.createElement("div");
  wrap.id="tr-customise-wrap";
  wrap.innerHTML=customizationMarkup();
  uploadBlock.insertAdjacentElement("afterend",wrap);
  ["tr-custom-event","tr-custom-name","tr-custom-date"].forEach(id=>{
    document.getElementById(id)?.addEventListener("input",()=>{
      state.production=null;
      syncCustomizationToOriginal();
      setText("tr-production-status","Customization changed · regenerate production model.");
      document.querySelector('[data-tr-view="production"]')?.setAttribute("disabled","");
    });
  });
}

async function captureGpxFile(file){
  if(!file)return;
  state.routeWorker?.terminate?.();
  state.routeWorker=null;state.routePromise=null;state.route=null;state.gpxFile=file;
  state.production=null;state.cartography=null;state.demSampler=null;state.demInfo=null;
  const fallback=file.name.replace(/\.gpx$/i,"")||"Route";
  state.routeMeta={name:fallback,sizeBytes:file.size};
  setText("tr-route-status",routeSummary());
  setText("tr-production-status","Advanced route parsing is deferred until Generate.");
  try{
    const prefix=await file.slice(0,262144).text();
    state.routeMeta.name=extractGpxName(prefix,fallback);
  }catch{}
  setText("tr-route-status",routeSummary());
  seedCustomizationFromRoute();
}

function ensureAdvancedRoute(){
  if(state.route)return Promise.resolve(state.route);
  if(state.routePromise)return state.routePromise;
  if(!state.gpxFile)return Promise.reject(new Error("Upload a GPX route first."));
  if(typeof Worker==="undefined")return Promise.reject(new Error("This browser does not support background GPX parsing."));
  setText("tr-route-status",(state.routeMeta?.name||"Route")+" · preparing Advanced route in background…");
  state.routePromise=new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./gpx-worker.mjs",import.meta.url),{type:"module"});
    state.routeWorker=worker;
    worker.onmessage=event=>{
      const payload=event.data||{};
      worker.terminate();state.routeWorker=null;
      if(!payload.ok){reject(new Error(payload.error||"GPX parsing failed."));return;}
      state.route=payload.route;
      state.routeMeta={name:state.route.name,sizeBytes:state.gpxFile?.size||0};
      setText("tr-route-status",routeSummary());
      seedCustomizationFromRoute();
      resolve(state.route);
    };
    worker.onerror=event=>{
      worker.terminate();state.routeWorker=null;
      reject(new Error(event.message||"Background GPX parser failed."));
    };
    worker.postMessage({
      file:state.gpxFile,
      fallbackName:state.routeMeta?.name||state.gpxFile.name.replace(/\.gpx$/i,""),
      maxPoints:20000
    });
  }).finally(()=>{state.routePromise=null;});
  return state.routePromise;
}

async function captureDemo(){
  try{
    const response=await fetch("./demo-zermatt.gpx");
    if(!response.ok)return;
    state.route=parseGpxText(await response.text(),"Zermatt loop",{maxPoints:20000});
    state.gpxFile=null;state.routeMeta={name:state.route.name,sizeBytes:0};
    state.production=null;state.cartography=null;state.demSampler=null;state.demInfo=null;
    setText("tr-route-status",routeSummary());
    seedCustomizationFromRoute();
  }catch{}
}

function showUploadToast(message){
  let toast=document.getElementById("tr-large-gpx-toast");
  if(!toast){
    toast=document.createElement("div");
    toast.id="tr-large-gpx-toast";
    toast.className="tr-large-gpx-toast";
    document.body.appendChild(toast);
  }
  toast.textContent=message;
  toast.classList.add("tr-show");
  return toast;
}

function hideUploadToast(delay=1200){
  const toast=document.getElementById("tr-large-gpx-toast");
  if(!toast)return;
  setTimeout(()=>toast.classList.remove("tr-show"),delay);
}

async function preprocessLargeLiveUpload(input,file){
  try{
    await captureGpxFile(file);
    const toast=showUploadToast("Preparing large GPX for smooth Live view…");
    const fallback=state.routeMeta?.name||file.name.replace(/\.gpx$/i,"")||"Route";
    const result=await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL("./gpx-worker.mjs",import.meta.url),{type:"module"});
      worker.onmessage=event=>{
        const payload=event.data||{};
        worker.terminate();
        if(!payload.ok){reject(new Error(payload.error||"Large GPX preprocessing failed."));return;}
        resolve(payload);
      };
      worker.onerror=event=>{worker.terminate();reject(new Error(event.message||"Large GPX preprocessing worker failed."));};
      worker.postMessage({file,fallbackName:fallback,maxPoints:30000,serialize:true});
    });
    state.route=result.route;
    state.routeMeta={name:state.route.name,sizeBytes:file.size};
    setText("tr-route-status",routeSummary());
    seedCustomizationFromRoute();

    const compactFile=new File([result.liveText],file.name,{
      type:file.type||"application/gpx+xml",
      lastModified:file.lastModified||Date.now()
    });
    const transfer=new DataTransfer();
    transfer.items.add(compactFile);
    input.dataset.trPreprocessed="1";
    input.files=transfer.files;
    toast.textContent="Large GPX optimised · loading Live view…";
    input.dispatchEvent(new Event("change",{bubbles:true}));
    hideUploadToast(1600);
  }catch(error){
    showUploadToast(error.message||String(error));
    hideUploadToast(3500);
    setText("tr-route-status",error.message||String(error));
  }
}

document.addEventListener("change",event=>{
  const input=event.target;
  if(!(input instanceof HTMLInputElement)||input.type!=="file")return;
  const file=input.files?.[0];
  if(!file||!(/\.gpx$/i.test(file.name)||String(input.accept||"").includes(".gpx")))return;

  if(input.dataset.trPreprocessed==="1"){
    delete input.dataset.trPreprocessed;
    return;
  }

  if(shouldPreprocessLiveGpx(file.size)){
    event.preventDefault();
    event.stopImmediatePropagation();
    void preprocessLargeLiveUpload(input,file);
    return;
  }

  void captureGpxFile(file);
},true);

document.addEventListener("click",event=>{
  const button=event.target instanceof Element?event.target.closest("button"):null;
  if(button&&button.textContent?.trim()==="Demo")setTimeout(()=>void captureDemo(),0);
},true);

function readControl(id){
  return document.getElementById(id);
}

function checked(id){return Boolean(readControl(id)?.checked)}
function number(id,fallback){const value=Number(readControl(id)?.value);return Number.isFinite(value)?value:fallback}
function value(id,fallback=""){return readControl(id)?.value??fallback}

function configFromUi(){
  const c=defaultAdvancedConfig(),simple=readSimpleWorkbench();
  c.dem.source=value("tr-dem-source","terrarium");
  c.dem.fillNoData=checked("tr-dem-fill");
  c.dem.smoothingRadius=number("tr-dem-smooth",0);
  c.dem.crsOverride=value("tr-dem-crs","");
  c.dem.routeElevationMode=value("tr-route-elevation-mode","dem");
  c.dem.routeElevationBlend=number("tr-route-elevation-blend",.5);

  c.map.roads=checked("tr-layer-roads");
  c.map.trails=checked("tr-layer-trails");
  c.map.railways=checked("tr-layer-railways");
  c.map.buildings=checked("tr-layer-buildings");

  c.shape.kind=value("tr-shape","route-fit");
  if(c.shape.kind==="route-fit"&&simple.shape)c.shape.kind=simple.shape;
  c.shape.aspect=number("tr-shape-aspect",1.35);
  c.shape.logoEnabled=checked("tr-logo-enabled");
  c.shape.logoAuto=checked("tr-logo-auto");
  c.shape.logoWidthMm=number("tr-logo-width",18);
  c.shape.logoRiseMm=number("tr-logo-rise",.8);

  c.fabrication.modelWidthMm=Number.isFinite(simple.modelWidth)?simple.modelWidth:number("tr-model-width",180);
  c.fabrication.baseMm=Number.isFinite(simple.base)?simple.base:number("tr-base",3);
  c.fabrication.reliefMm=number("tr-relief",8);
  c.fabrication.targetXyMm=number("tr-detail",1);
  c.fabrication.routeWidthMm=Number.isFinite(simple.routeWidth)?simple.routeWidth:number("tr-route-width",1.6);
  c.fabrication.routeRiseMm=Number.isFinite(simple.routeRise)?simple.routeRise:number("tr-route-rise",1.2);
  c.fabrication.tiled=checked("tr-tiled");
  c.fabrication.maxTileMm=number("tr-max-tile",200);
  c.fabrication.jointType=value("tr-joint","dovetail");
  c.fabrication.magnetEnabled=checked("tr-magnets");
  c.fabrication.magnetDiameterMm=number("tr-magnet-diameter",8);
  c.fabrication.magnetDepthMm=number("tr-magnet-depth",2);
  c.fabrication.hangerEnabled=checked("tr-hanger");
  c.fabrication.standEnabled=checked("tr-stand");
  c.customization=customizationFromUi();
  for(const [key,color] of Object.entries(simple.colors||{}))if(color)c.colors[key]=color;
  return c;
}

function updateVisibility(){
  const source=value("tr-dem-source","terrarium");
  document.getElementById("tr-geotiff-row")?.classList.toggle("tr-hidden",source!=="geotiff");
  document.getElementById("tr-arc-row")?.classList.toggle("tr-hidden",source!=="arc");
  document.getElementById("tr-geographic-row")?.classList.toggle("tr-hidden",value("tr-shape")!=="geographic");
  document.getElementById("tr-logo-row")?.classList.toggle("tr-hidden",!checked("tr-logo-enabled"));
  document.getElementById("tr-tile-options")?.classList.toggle("tr-hidden",!checked("tr-tiled"));
  document.getElementById("tr-magnet-options")?.classList.toggle("tr-hidden",!checked("tr-magnets"));
}

async function readImageData(file){
  const bitmap=await createImageBitmap(file);
  const max=320,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  let canvas,ctx;
  if(typeof OffscreenCanvas!=="undefined"){canvas=new OffscreenCanvas(width,height);ctx=canvas.getContext("2d",{willReadFrequently:true});}
  else{canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;ctx=canvas.getContext("2d",{willReadFrequently:true});}
  ctx.drawImage(bitmap,0,0,width,height);bitmap.close?.();
  return ctx.getImageData(0,0,width,height);
}

async function resolveDem(config){
  if(!state.route)await ensureAdvancedRoute();
  const bounds=productionBounds(routeBounds(state.route.points),{...config.shape,outlineGeometry:state.outlineGeometry||config.shape.outlineGeometry});
  if(config.dem.source==="geotiff"){
    if(!state.demFile)throw new Error("Choose a GeoTIFF DEM.");
    setText("tr-dem-status","Reading GeoTIFF…");
    const raster=await loadGeoTiffFile(state.demFile,{crsOverride:config.dem.crsOverride,fillNoData:config.dem.fillNoData,smoothingRadius:config.dem.smoothingRadius});
    state.demSampler=raster.sampleLatLon;state.demInfo=raster;
    setText("tr-dem-status","GeoTIFF "+raster.width+"×"+raster.height+" · "+raster.sourceCrs+" · "+Math.round(raster.stats.min)+"–"+Math.round(raster.stats.max)+" m");
    return state.demSampler;
  }
  if(config.dem.source==="arc"){
    if(!state.arcFile)throw new Error("Choose an Arc-ASCII DEM.");
    setText("tr-dem-status","Reading Arc-ASCII grid…");
    const loaded=await loadArcAsciiFile(state.arcFile);
    state.demSampler=loaded.sample;state.demInfo=loaded.grid;
    setText("tr-dem-status","Arc-ASCII "+loaded.grid.ncols+"×"+loaded.grid.nrows+" · cell "+loaded.grid.cellsize);
    return state.demSampler;
  }
  setText("tr-dem-status","Loading AWS Terrarium elevation…");
  const loaded=await loadTerrariumSampler(bounds,{preferredZoom:11,tileBudget:48});
  state.demSampler=loaded.sample;state.demInfo=loaded;
  setText("tr-dem-status","AWS Terrarium · zoom "+loaded.zoom+" · "+loaded.tileCount+" tiles");
  return state.demSampler;
}

async function loadMapLayers(){
  if(!state.route&&!state.gpxFile){setText("tr-map-status","Upload a GPX route first.");return;}
  try{
    if(!state.route)await ensureAdvancedRoute();
    const c=configFromUi();
    if(!c.map.roads&&!c.map.trails&&!c.map.railways&&!c.map.buildings){
      state.cartography=null;setText("tr-map-status","All optional map layers are off.");return;
    }
    setText("tr-map-status","Loading OpenFreeMap vector layers…");
    const bounds=productionBounds(routeBounds(state.route.points),{...c.shape,outlineGeometry:state.outlineGeometry||c.shape.outlineGeometry});
    state.cartography=await loadOpenFreeMapCartography(bounds,{preferredZoom:9,tileBudget:40});
    const s=state.cartography.stats;
    setText("tr-map-status","Loaded · "+s.roads+" roads · "+s.trails+" trails · "+s.railways+" railways · "+s.buildings+" buildings");
  }catch(error){
    state.cartography=null;setText("tr-map-status",error.message||String(error));
  }
}

async function generate(){
  if(!state.route&&!state.gpxFile){setText("tr-production-status","Upload a GPX route first.");return;}
  setBusy(true);state.production=null;
  try{
    if(!state.route)await ensureAdvancedRoute();
    const config=configFromUi(),sampler=await resolveDem(config);
    const reconciled=reconcileRouteElevations(state.route.points,sampler,{
      mode:config.dem.routeElevationMode,blend:config.dem.routeElevationBlend,maxDeltaM:config.dem.maxDeltaM
    });
    setText("tr-elevation-diagnostics","Elevation check · "+reconciled.diagnostics.paired+" paired · mean Δ "+reconciled.diagnostics.meanAbsDeltaM+" m · max Δ "+reconciled.diagnostics.maxAbsDeltaM+" m");
    if((config.map.roads||config.map.trails||config.map.railways||config.map.buildings)&&!state.cartography)await loadMapLayers();
    setText("tr-production-status","Building exact production mesh…");
    state.displayTitle=productionDisplayTitle(state.route?.name||state.routeMeta?.name||"TrailRelief",config.customization);
    state.production=await generateProductionModel({
      points:state.route.points,demSampler:sampler,cartography:state.cartography,config,
      outlineGeometry:state.outlineGeometry,logoImage:state.logoImage,title:state.displayTitle
    });
    const p=state.production,v=p.validation;
    setText("tr-production-status","READY · "+p.mesh.vertices.length.toLocaleString()+" vertices · "+p.mesh.triangles.length.toLocaleString()+" triangles");
    setText("tr-validation-status",(v.watertight?"PASS":"FAIL")+" · boundary "+v.boundaryEdges+" · non-manifold "+v.nonManifoldEdges+" · workload "+p.workload.action.toUpperCase());
    setText("tr-tile-status",p.tilePlan?(p.tilePlan.columns+"×"+p.tilePlan.rows+" tiles · "+p.tilePlan.jointType+" joints"):"Single-piece model");
    qsa("[data-tr-export]").forEach(button=>button.disabled=false);
    document.getElementById("tr-tile-download").disabled=!p.tileBundle;
    document.getElementById("tr-stand-download").disabled=!p.standStl;
    const showButton=document.getElementById("tr-show-production");
    if(showButton)showButton.disabled=false;
    await previewGlb(p.glb);
    showView("production");
  }catch(error){
    state.production=null;
    setText("tr-production-status",error.message||String(error));
    setText("tr-validation-status","Not validated.");
  }finally{setBusy(false);}
}

function download(data,name,type){
  const blob=data instanceof Blob?data:new Blob([data],{type:type||"application/octet-stream"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
}

function showView(mode){
  const stage=document.getElementById("tr-production-stage");
  const liveButton=document.querySelector('[data-tr-view="live"]');
  const productionButton=document.querySelector('[data-tr-view="production"]');
  const production=mode==="production"&&Boolean(state.production);
  stage?.classList.toggle("tr-stage-visible",production);
  liveButton?.classList.toggle("tr-active",!production);
  productionButton?.classList.toggle("tr-active",production);
}

function mountSharedViewer(main){
  if(!main||document.getElementById("tr-view-switch"))return;
  const switcher=document.createElement("div");
  switcher.id="tr-view-switch";switcher.className="tr-view-switch";
  switcher.innerHTML='<button class="tr-active" data-tr-view="live">Live</button><button data-tr-view="production" disabled>Production</button>';
  main.appendChild(switcher);
  const stage=document.createElement("div");
  stage.id="tr-production-stage";stage.className="tr-production-stage";
  stage.innerHTML='<model-viewer id="tr-model-viewer" camera-controls ar shadow-intensity=".7" exposure="1.15" camera-orbit="0deg 62deg auto" interaction-prompt="none"></model-viewer><div class="tr-stage-caption"><strong id="tr-stage-title">Production model</strong><span id="tr-viewer-status">Generate the advanced production model to inspect the exact export.</span></div>';
  main.appendChild(stage);
  switcher.addEventListener("click",event=>{
    const button=event.target.closest("[data-tr-view]");
    if(!button||button.disabled)return;
    showView(button.dataset.trView);
  });
}

async function previewGlb(bytes){
  if(!bytes)return;
  try{
    await import("../vendor/model-viewer.min.js");
    if(state.glbUrl)URL.revokeObjectURL(state.glbUrl);
    state.glbUrl=URL.createObjectURL(new Blob([bytes],{type:"model/gltf-binary"}));
    const viewer=document.getElementById("tr-model-viewer");
    viewer.src=state.glbUrl;
    const productionButton=document.querySelector('[data-tr-view="production"]');
    if(productionButton)productionButton.disabled=false;
    setText("tr-stage-title",state.displayTitle||state.route?.name||"Production model");
    setText("tr-viewer-status","Exact exported GLB · drag to orbit, wheel/pinch to zoom.");
  }catch(error){
    setText("tr-viewer-status","GLB created; embedded viewer unavailable: "+(error.message||error));
  }
}

function handleExport(kind){
  const p=state.production;if(!p)return;
  const stem=filenameStem(state.displayTitle||state.route?.name);
  if(kind==="3mf")download(p.threeMf,stem+".3mf","model/3mf");
  if(kind==="stl")download(p.stl,stem+".stl","model/stl");
  if(kind==="obj")download(p.objBundle,stem+"-obj-mtl.zip","application/zip");
  if(kind==="glb")download(p.glb,stem+".glb","model/gltf-binary");
  if(kind==="validation")download(p.validationBundle,stem+"-validation.zip","application/zip");
  if(kind==="tiles"&&p.tileBundle)download(p.tileBundle,stem+"-tiles.zip","application/zip");
  if(kind==="stand"&&p.standStl)download(p.standStl,stem+"-stand.stl","model/stl");
}

function drawerMarkup(){
  return [
    '<div class="tr-advanced-head"><div><strong>Advanced</strong><span>Terrain Medal tools</span></div><button id="tr-advanced-close" aria-label="Close advanced tools">×</button></div>',
    '<div class="tr-advanced-route" id="tr-route-status">GPX not captured yet</div>',
    '<div class="tr-advanced-scroll">',
    '<details><summary>DEM & elevation</summary><div class="tr-section">',
      '<label>Elevation source<select id="tr-dem-source"><option value="terrarium">AWS Terrarium</option><option value="geotiff">Local GeoTIFF</option><option value="arc">Local Arc-ASCII</option></select></label>',
      '<div id="tr-geotiff-row" class="tr-hidden"><label class="tr-file">GeoTIFF<input id="tr-geotiff" type="file" accept=".tif,.tiff,image/tiff"></label><label>CRS / WKT override<input id="tr-dem-crs" placeholder="e.g. EPSG:32643"></label><div class="tr-pair"><label class="tr-check"><input id="tr-dem-fill" type="checkbox" checked> Fill NoData</label><label>Smoothing<select id="tr-dem-smooth"><option value="0">Off</option><option value="1">1 cell</option><option value="2">2 cells</option></select></label></div></div>',
      '<div id="tr-arc-row" class="tr-hidden"><label class="tr-file">Arc-ASCII<input id="tr-arc" type="file" accept=".asc,.txt,text/plain"></label></div>',
      '<div class="tr-pair"><label>Route elevation<select id="tr-route-elevation-mode"><option value="dem">DEM</option><option value="blend">Blend</option><option value="gpx">GPX</option></select></label><label>Blend<input id="tr-route-elevation-blend" type="number" min="0" max="1" step=".1" value=".5"></label></div>',
      '<p id="tr-dem-status" class="tr-note">Terrarium will load when you generate.</p><p id="tr-elevation-diagnostics" class="tr-note"></p>',
    '</div></details>',
    '<details><summary>Map layers</summary><div class="tr-section">',
      '<div class="tr-grid-check"><label><input id="tr-layer-roads" type="checkbox" checked> Roads</label><label><input id="tr-layer-trails" type="checkbox" checked> Trails</label><label><input id="tr-layer-railways" type="checkbox" checked> Railways</label><label><input id="tr-layer-buildings" type="checkbox"> 3D buildings</label></div>',
      '<button class="tr-btn tr-secondary" id="tr-load-map">Load map layers</button><p id="tr-map-status" class="tr-note">Optional. Uses OpenFreeMap / OpenStreetMap data.</p>',
    '</div></details>',
    '<details><summary>Shape & branding</summary><div class="tr-section">',
      '<label>Production shape<select id="tr-shape"><option value="route-fit">Route-fit rectangle</option><option value="circle">Circle</option><option value="square">Square</option><option value="ellipse">Ellipse</option><option value="hexagon">Hexagon</option><option value="octagon">Octagon</option><option value="heart">Heart</option><option value="geographic">GeoJSON country / region</option></select></label>',
      '<label>Shape aspect<input id="tr-shape-aspect" type="number" min=".5" max="2.5" step=".05" value="1.35"></label>',
      '<div id="tr-geographic-row" class="tr-hidden"><label class="tr-file">Boundary GeoJSON<input id="tr-outline" type="file" accept=".json,.geojson,application/geo+json,application/json"></label><p id="tr-outline-status" class="tr-note">Load a Polygon or MultiPolygon boundary.</p></div>',
      '<label class="tr-check"><input id="tr-logo-enabled" type="checkbox"> Emboss uploaded logo</label>',
      '<div id="tr-logo-row" class="tr-hidden"><label class="tr-file">Logo image<input id="tr-logo" type="file" accept="image/png,image/jpeg,image/webp"></label><label class="tr-check"><input id="tr-logo-auto" type="checkbox" checked> Auto-place away from route</label><div class="tr-pair"><label>Width mm<input id="tr-logo-width" type="number" min="6" max="60" step="1" value="18"></label><label>Rise mm<input id="tr-logo-rise" type="number" min=".2" max="3" step=".1" value=".8"></label></div><p id="tr-logo-status" class="tr-note">No logo loaded.</p></div>',
    '</div></details>',
    '<details><summary>Fabrication</summary><div class="tr-section">',
      '<div class="tr-pair"><label>Model width mm<input id="tr-model-width" type="number" min="60" max="800" step="5" value="180"></label><label>XY detail mm<input id="tr-detail" type="number" min=".25" max="3" step=".05" value="1"></label></div>',
      '<div class="tr-pair"><label>Base mm<input id="tr-base" type="number" min=".8" max="10" step=".2" value="3"></label><label>Relief mm<input id="tr-relief" type="number" min="1" max="30" step=".5" value="8"></label></div>',
      '<div class="tr-pair"><label>Route width mm<input id="tr-route-width" type="number" min=".4" max="6" step=".1" value="1.6"></label><label>Route rise mm<input id="tr-route-rise" type="number" min=".2" max="5" step=".1" value="1.2"></label></div>',
      '<p class="tr-note">Production inherits Live shape, model width, base thickness, route dimensions and core colours when those controls are available.</p>',
      '<label class="tr-check"><input id="tr-tiled" type="checkbox"> Split large model into printable tiles</label>',
      '<div id="tr-tile-options" class="tr-hidden tr-pair"><label>Max tile mm<input id="tr-max-tile" type="number" min="60" max="500" step="5" value="200"></label><label>Joint<select id="tr-joint"><option value="dovetail">Dovetail</option><option value="pin">Alignment pin</option><option value="flat">Flat seam</option></select></label></div>',
      '<label class="tr-check"><input id="tr-magnets" type="checkbox"> Underside magnet pockets</label>',
      '<div id="tr-magnet-options" class="tr-hidden tr-pair"><label>Diameter mm<input id="tr-magnet-diameter" type="number" min="3" max="20" step=".5" value="8"></label><label>Depth mm<input id="tr-magnet-depth" type="number" min=".5" max="5" step=".1" value="2"></label></div>',
      '<div class="tr-grid-check"><label><input id="tr-hanger" type="checkbox"> Hanging loop</label><label><input id="tr-stand" type="checkbox"> Separate stand STL</label></div>',
    '</div></details>',
    '<details><summary>Export & validation</summary><div class="tr-section">',
      '<button class="tr-btn" id="tr-generate">Generate production model</button>',
      '<p id="tr-production-status" class="tr-note">Advanced model not generated.</p>',
      '<div class="tr-validation"><strong>Mesh validation</strong><span id="tr-validation-status">Not validated.</span><span id="tr-tile-status">Single-piece model</span></div>',
      '<div class="tr-export-grid">',
        '<button data-tr-export="3mf" disabled>3MF</button><button data-tr-export="stl" disabled>STL</button><button data-tr-export="obj" disabled>OBJ + MTL</button><button data-tr-export="glb" disabled>GLB</button>',
        '<button data-tr-export="validation" disabled>Validation ZIP</button><button id="tr-tile-download" data-tr-export="tiles" disabled>Tile ZIP</button><button id="tr-stand-download" data-tr-export="stand" disabled>Stand STL</button>',
      '</div>',
      '<button class="tr-btn tr-secondary" id="tr-show-production" disabled>Show in centre viewer</button>',
    '</div></details>',
    '</div>'
  ].join("");
}

function mount(){
  if(document.getElementById("tr-advanced-launch"))return;
  const header=qs("aside header");
  if(!header)return;
  const sidebar=header.closest("aside");
  mountCustomization(sidebar,header);
  const launch=document.createElement("button");
  launch.id="tr-advanced-launch";launch.className="tr-advanced-launch";launch.type="button";launch.textContent="Advanced";
  header.appendChild(launch);

  const drawer=document.createElement("aside");
  drawer.id="tr-advanced-drawer";drawer.className="tr-advanced-drawer";drawer.setAttribute("aria-hidden","true");drawer.innerHTML=drawerMarkup();
  document.body.appendChild(drawer);

  const open=()=>{drawer.classList.add("tr-open");drawer.setAttribute("aria-hidden","false");setText("tr-route-status",routeSummary());};
  const close=()=>{drawer.classList.remove("tr-open");drawer.setAttribute("aria-hidden","true");};
  launch.addEventListener("click",()=>drawer.classList.contains("tr-open")?close():open());
  document.getElementById("tr-advanced-close").addEventListener("click",close);

  ["tr-dem-source","tr-shape","tr-logo-enabled","tr-tiled","tr-magnets"].forEach(id=>document.getElementById(id)?.addEventListener("change",updateVisibility));
  document.getElementById("tr-geotiff")?.addEventListener("change",event=>{state.demFile=event.target.files?.[0]||null;state.demSampler=null;setText("tr-dem-status",state.demFile?"GeoTIFF selected · generate to load it.":"No GeoTIFF selected.");});
  document.getElementById("tr-arc")?.addEventListener("change",event=>{state.arcFile=event.target.files?.[0]||null;state.demSampler=null;setText("tr-dem-status",state.arcFile?"Arc-ASCII selected · generate to load it.":"No Arc-ASCII selected.");});
  document.getElementById("tr-outline")?.addEventListener("change",async event=>{
    try{
      const file=event.target.files?.[0];if(!file)return;
      const json=JSON.parse(await file.text());
      let geometry=json.type==="Feature"?json.geometry:json.type==="FeatureCollection"?json.features?.find(f=>["Polygon","MultiPolygon"].includes(f.geometry?.type))?.geometry:json;
      if(!["Polygon","MultiPolygon"].includes(geometry?.type))throw new Error("Boundary must be a Polygon or MultiPolygon.");
      state.outlineGeometry=geometry;setText("tr-outline-status","Boundary loaded · "+geometry.type);
    }catch(error){state.outlineGeometry=null;setText("tr-outline-status",error.message||String(error));}
  });
  document.getElementById("tr-logo")?.addEventListener("change",async event=>{
    try{const file=event.target.files?.[0];if(!file)return;state.logoImage=await readImageData(file);setText("tr-logo-status","Logo loaded · "+state.logoImage.width+"×"+state.logoImage.height+" · auto-placement ready.");}
    catch(error){state.logoImage=null;setText("tr-logo-status",error.message||String(error));}
  });
  document.getElementById("tr-load-map")?.addEventListener("click",()=>void loadMapLayers());
  document.getElementById("tr-generate")?.addEventListener("click",()=>void generate());
  document.getElementById("tr-show-production")?.addEventListener("click",()=>showView("production"));
  qsa("[data-tr-export]",drawer).forEach(button=>button.addEventListener("click",()=>handleExport(button.dataset.trExport)));
  mountSharedViewer(qs("main"));
  document.addEventListener("click",event=>{
    const button=event.target instanceof Element?event.target.closest("button"):null;
    if(button&&button.textContent?.trim()==="Plate")setTimeout(syncCustomizationToOriginal,0);
  });
  updateVisibility();
  updateCustomizationSummary();
}

const observer=new MutationObserver(()=>{mount();if(document.getElementById("tr-advanced-launch"))observer.disconnect();});
observer.observe(document.documentElement,{childList:true,subtree:true});
mount();
