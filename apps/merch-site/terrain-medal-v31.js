import { EVENTS, MAPS, PRINTERS, VIEWER_LIMITS, adaptivePlaceLabelBudget, adaptiveRoadRenderBudget, adaptiveWaterCells, balanceBoundsForMapContext, eventNameFromGpxFilename, expandBoundsByMargin, formatRouteDistance, inferEventPresetFromFilename, makeJob, mapContextBounds, mapContextLabel, mapFrameSize, medalCoverageBounds, medalDiameterMm, nextViewerZoom, normalizeElevationRange, parseGpxText, mergeGpxRoutes, sampleTerrariumBilinear, physicalReliefMm, placeLabelFontSize, projectGpxPoints, routePreviewLift, routeShadowWidthForExaggeration, routeWidthMultiplierForExaggeration, roadPrintPolicy, selectPrintPlaces, validateLocalFileMeta, validateDesign, viewerBoundsFromZoom } from "./terrain-medal-core.mjs?v=16";
import { compileCartography, decodeCartographyTile, isPointInWater, selectScreenPlacesSpatially } from "./vector-map-core.mjs?v=8";
import { CONTINENTS, buildMedalMetaLines } from "./event-discovery-core.mjs?v=4";
import { buildAnnulusMesh, buildDisplayStandMesh, buildDovetailKeyMesh, buildExtrudedPolygonMesh, buildPrintValidationCoupon, buildRadialMedalMesh, buildRectangularHeightfieldMesh, encodeArtifactZip, encodeBinaryStl, encodeGlb, encodeMtl, encodeObj, encode3mf, mergeMeshes, meshEdgeUse, productionResolution, validateProductionProfile } from "./print-model-core.mjs?v=8";
import { contourEmbossHeight, dovetailKeyProfile, dovetailSlotDepth, magnetPocketDepth, parseArcAsciiGrid, planTiledMap, pointInsideShape, rasterSampler, sampleArcAsciiGrid, shapeBoundaryRadius, shapeMaxRadius } from "./fabrication-extras-core.mjs?v=2";
import { adaptiveLargeFormatPlan, classifyTerrainWorkload, clipPolygonToRect, loadGeoTiffArrayBuffer, reconcileGpxElevations, rasterStats } from "./pro-dem-core.mjs?v=2";
import { projectGeographicOutline, insidePolygons, maskPolygons, buildOutlineHeightfieldMesh, logoFootprint, footprintFits, findEmptyLogoPlacement } from "./map-outline-core.mjs?v=1";

const $ = (id) => document.getElementById(id);
const fields = { event: $("eventSelect"), eventName: $("eventName"), eventDate:$("eventDate"), eventLocation:$("eventLocation"), participant: $("participant"), bib: $("bib"), distance: $("distance"), startDetail:$("startDetail"), finishDetail:$("finishDetail"), elapsedTime:$("elapsedTime"), resultStatus:$("resultStatus"), placing:$("placing"), map: $("mapSelect"), printer: $("printerSelect"), exaggeration: $("exaggeration"), reliefLimit: $("reliefLimit"), waterMode: $("waterMode"), waveHeight: $("waveHeight"), wavelength: $("wavelength"), base: $("base"), routeWidth: $("routeWidth"), routeRise: $("routeRise") };
const framingSelect=$("framingSelect"),printMargin=$("printMargin"),printMarginOut=$("printMarginOut"),printAreaState=$("printAreaState");
const geoContinent=$("geoContinent"),geoCountry=$("geoCountry"),geoRegion=$("geoRegion"),geoCity=$("geoCity"),terrainEnvironment=$("terrainEnvironment"),geoSearchButton=$("geoSearchButton"),geoSearchStatus=$("geoSearchStatus"),geoResults=$("geoResults");
const eventWebSearch=$("eventWebSearch"),eventWebCategory=$("eventWebCategory"),eventWebSearchButton=$("eventWebSearchButton"),eventWebStatus=$("eventWebStatus"),eventWebResults=$("eventWebResults"),publicResultUrl=$("publicResultUrl"),importPublicResult=$("importPublicResult"),publicResultStatus=$("publicResultStatus"),participantMatches=$("participantMatches");
const generatePrintModel=$("generatePrintModel"),download3mf=$("download3mf"),downloadStl=$("downloadStl"),downloadObj=$("downloadObj"),downloadGlb=$("downloadGlb"),downloadValidationBundle=$("downloadValidationBundle"),downloadStandStl=$("downloadStandStl"),downloadTilePlan=$("downloadTilePlan"),productionStatus=$("productionStatus"),printerProfileNote=$("printerProfileNote"),printerProfileSource=$("printerProfileSource"),glbViewer=$("glbViewer"),glbViewerStatus=$("glbViewerStatus"),issueAuthenticity=$("issueAuthenticity"),downloadAuthenticity=$("downloadAuthenticity"),authenticityStatus=$("authenticityStatus"),verifyAuthenticityLink=$("verifyAuthenticityLink");
const shapeSelect=$("shapeSelect"),shapeAspect=$("shapeAspect"),contourEnabled=$("contourEnabled"),contourInterval=$("contourInterval"),contourRise=$("contourRise"),magnetEnabled=$("magnetEnabled"),magnetDiameter=$("magnetDiameter"),magnetDepth=$("magnetDepth"),magnetSpacing=$("magnetSpacing"),hangingLoopEnabled=$("hangingLoopEnabled"),loopInnerDiameter=$("loopInnerDiameter"),loopWall=$("loopWall"),bottomMark=$("bottomMark"),bottomEngraveDepth=$("bottomEngraveDepth"),logoInput=$("logoInput"),logoRise=$("logoRise"),heightmapInput=$("heightmapInput"),heightmapStrength=$("heightmapStrength"),standEnabled=$("standEnabled"),tileEnabled=$("tileEnabled"),tileMaxWidth=$("tileMaxWidth"),tileMaxHeight=$("tileMaxHeight"),elevationSource=$("elevationSource"),openTopoDataset=$("openTopoDataset"),openTopoKey=$("openTopoKey"),loadHighResDem=$("loadHighResDem"),fabricationStatus=$("fabricationStatus");
const placeLabelMode=$("placeLabelMode"),placeSelectionList=$("placeSelectionList");
const localDemInput=$("localDemInput"),geoTiffInput=$("geoTiffInput"),geoTiffCrs=$("geoTiffCrs"),demFillNoData=$("demFillNoData"),demSmoothRadius=$("demSmoothRadius"),meshTargetXy=$("meshTargetXy"),routeElevationMode=$("routeElevationMode"),routeElevationBlend=$("routeElevationBlend"),routeElevationBlendOut=$("routeElevationBlendOut"),trailsEnabled=$("trailsEnabled"),railwaysEnabled=$("railwaysEnabled"),buildingsEnabled=$("buildingsEnabled"),terrainColor=$("terrainColor"),waterColor=$("waterColor"),routeColor=$("routeColor"),roadsColor=$("roadsColor"),labelsColor=$("labelsColor"),trailsColor=$("trailsColor"),railwaysColor=$("railwaysColor"),buildingsColor=$("buildingsColor");
let gpx = null; let terrain = null; let cartography = null; let frameBounds = null; let contextBounds = null; let frameSize = 1.45; let printAreaMode = "event-focus"; let yaw = -0.42; let pitch = 0.92; let zoom = 1; let dragging = false; let last = [0,0];
let selectedGeo=null,eventSource=null,participantSource=null;const selectedPlaceNames=new Set();
const terrainTileCache=new Map(),vectorTileCache=new Map();
let terrainRevision=0,cartographyRevision=0;
let terrainMeshCache=null,productionModel=null,glbViewerUrl=null,authenticityReceipt=null;
const fabricationState={logoMask:null,heightmapMask:null,permanentLogoBitmap:null,highResGrid:null,highResRange:null,highResSource:"",gridSource:"",geoRaster:null,geoRasterSource:"",elevationDiagnostics:null,standStl:null,tilePlan:null};
const officialLogoEnabled=$("officialLogoEnabled"),officialLogoX=$("officialLogoX"),officialLogoY=$("officialLogoY"),officialLogoWidth=$("officialLogoWidth"),officialLogoRotation=$("officialLogoRotation"),officialLogoStatus=$("officialLogoStatus"),outlineStatus=$("outlineStatus");
let outlineCache=null,shapeRequestRevision=0;
function geographyPolygons(){
  if(!selectedGeo?.geometry||!frameBounds)return [];
  const key=JSON.stringify([selectedGeo.id,frameBounds,frameSize]);
  if(outlineCache?.key===key)return outlineCache.polygons;
  const polygons=projectGeographicOutline(selectedGeo.geometry,frameBounds,frameSize);
  outlineCache={key,polygons};return polygons;
}
function mapInside(x,y,c){return c.shape==="geographic"?insidePolygons(x,y,geographyPolygons()):pointInsideShape(x,y,c.shape,{aspect:c.shapeAspect})}
function readOfficialLogo(){return {enabled:officialLogoEnabled.checked,x:Number(officialLogoX.value)/100,y:Number(officialLogoY.value)/100,widthMm:Number(officialLogoWidth.value),rotation:Number(officialLogoRotation.value),aspect:fabricationState.permanentLogoBitmap?fabricationState.permanentLogoBitmap.width/fabricationState.permanentLogoBitmap.height:1}}
function logoOptions(c){return {...c.officialLogo,diameterMm:medalDiameterMm(c.diameter)}}
function logoUv(x,y,c){
  const o=logoOptions(c),a=o.rotation*Math.PI/180,dx=x-o.x,dy=y-o.y,half=o.widthMm/o.diameterMm;
  return {u:.5+(dx*Math.cos(a)+dy*Math.sin(a))/(2*half),v:.5-(-dx*Math.sin(a)+dy*Math.cos(a))*o.aspect/(2*half)};
}
const MODEL_VIEWER_LOCAL="/vendor/model-viewer.min.js?v=4.3.1";
let glbViewerRuntime=null;

async function ensureGlbViewerComponent(){
  if(customElements.get("model-viewer"))return "registered";
  if(glbViewerRuntime)return glbViewerRuntime;
  glbViewerRuntime=(async()=>{
    try{
      await import(MODEL_VIEWER_LOCAL);
      await customElements.whenDefined("model-viewer");
      return MODEL_VIEWER_LOCAL;
    }catch(error){
      glbViewerRuntime=null;
      throw new Error(`Local model-viewer runtime could not be loaded: ${error?.message||error}`);
    }
  })();
  return glbViewerRuntime;
}

let glbViewerQualifying=false;

function waitForGlbPaint(){
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}

function glbViewerHasScreenHit(){
  if(!glbViewer?.modelIsVisible||typeof glbViewer.positionAndNormalFromPoint!=="function")return false;
  const rect=glbViewer.getBoundingClientRect();
  if(rect.width<=0||rect.height<=0)return false;
  const samples=[[.5,.5],[.35,.5],[.65,.5],[.5,.35],[.5,.65],[.3,.3],[.7,.3],[.3,.7],[.7,.7]];
  for(const [x,y] of samples){
    try{
      if(glbViewer.positionAndNormalFromPoint(rect.left+rect.width*x,rect.top+rect.height*y))return true;
    }catch{}
  }
  return false;
}

async function qualifyVisibleGlb(){
  if(glbViewerQualifying||!glbViewer?.loaded)return false;
  glbViewerQualifying=true;
  try{
    const dimensions=glbViewer.getDimensions();
    const values=[Number(dimensions?.x),Number(dimensions?.y),Number(dimensions?.z)];
    if(!values.every(Number.isFinite)||Math.max(...values)<=0)throw new Error("viewer returned invalid model dimensions");
    const expectedWidthM=Number(productionModel?.modelWidthMm)/1000;
    const widest=Math.max(...values);
    if(Number.isFinite(expectedWidthM)&&expectedWidthM>0){
      const ratio=widest/expectedWidthM;
      if(ratio<.45||ratio>1.75)throw new Error(`unexpected model bounds ${widest.toFixed(4)} m for expected ${expectedWidthM.toFixed(4)} m width`);
    }
    glbViewer.dismissPoster?.();
    await glbViewer.updateFraming();
    glbViewer.jumpCameraToGoal?.();
    await waitForGlbPaint();

    if(!glbViewer.modelIsVisible){
      glbViewerStatus.textContent=`GLB loaded · bounds ${values.map(value=>value.toFixed(4)).join(" × ")} m · waiting for viewer visibility before render qualification.`;
      return false;
    }

    let visibleHit=glbViewerHasScreenHit();
    if(!visibleHit){
      glbViewer.cameraOrbit="0deg 65deg 120%";
      await glbViewer.updateFraming();
      glbViewer.jumpCameraToGoal?.();
      await waitForGlbPaint();
      visibleHit=glbViewerHasScreenHit();
    }
    if(!visibleHit){
      glbViewerStatus.textContent=`GLB loaded · bounds ${values.map(value=>value.toFixed(4)).join(" × ")} m · no on-screen geometry detected after framing recovery. Downloadable GLB retained for diagnosis.`;
      return false;
    }

    glbViewerStatus.textContent=`GLB rendered · visible geometry confirmed · bounds ${values.map(value=>value.toFixed(4)).join(" × ")} m. Drag to orbit, wheel/pinch to zoom; AR is available where supported.`;
    return true;
  }catch(error){
    glbViewerStatus.textContent=`GLB loaded but render qualification failed · ${error.message}. Regenerate before using the GLB or AR export.`;
    return false;
  }finally{
    glbViewerQualifying=false;
  }
}

if(glbViewer){
  glbViewer.addEventListener("load",()=>void qualifyVisibleGlb());
  glbViewer.addEventListener("model-visibility",event=>{if(event?.detail?.visible)void qualifyVisibleGlb()});
  glbViewer.addEventListener("error",event=>{
    const detail=event?.detail?.type||event?.detail?.message||"model load error";
    glbViewerStatus.textContent=`GLB viewer failed · ${detail}. The downloadable GLB remains available.`;
  });
}

function printPlaceBudget(c,mode=placeLabelMode?.value||"major"){
  if(mode==="none")return 0;
  if(mode==="major")return Number(c?.diameter)<=3?6:8;
  if(mode==="selected")return Math.max(1,selectedPlaceNames.size);
  return 240;
}

function governedPlaces(c,places=cartography?.places||[]){
  return selectPrintPlaces(places,{mode:c?.placeLabels?.mode||placeLabelMode?.value||"major",selectedNames:c?.placeLabels?.selectedNames||[...selectedPlaceNames],maxCount:printPlaceBudget(c,c?.placeLabels?.mode),routePoints:routePoints()});
}

function renderPlaceSelectionList(){
  if(!placeSelectionList)return;
  placeSelectionList.replaceChildren();
  const places=[...(cartography?.places||[])].sort((a,b)=>({city:0,town:1,village:2}[a.class]??9)-({city:0,town:1,village:2}[b.class]??9)||(a.rank??99)-(b.rank??99)||String(a.name).localeCompare(String(b.name)));
  if(!places.length){const small=document.createElement("small");small.textContent="Load a map to choose places.";placeSelectionList.append(small);return}
  for(const place of places.slice(0,80)){
    const label=document.createElement("label"),input=document.createElement("input"),span=document.createElement("span");
    input.type="checkbox";input.value=place.name;input.checked=selectedPlaceNames.has(String(place.name).toLowerCase());
    input.addEventListener("change",()=>{const key=String(place.name).toLowerCase();if(input.checked)selectedPlaceNames.add(key);else selectedPlaceNames.delete(key);if(placeLabelMode.value!=="selected")placeLabelMode.value="selected";invalidateProductionModel();update()});
    span.textContent=`${place.name} · ${place.class}`;
    label.append(input,span);placeSelectionList.append(label);
  }
}

async function ensurePermanentVayuLogo(){
  if(fabricationState.permanentLogoBitmap)return fabricationState.permanentLogoBitmap;
  const response=await fetch("./assets/vayu-official.png",{cache:"force-cache"});
  if(!response.ok)throw new Error("Permanent provenance watermark asset is unavailable.");
  fabricationState.permanentLogoBytes=new Uint8Array(await response.arrayBuffer());
  fabricationState.permanentLogoBitmap=await createImageBitmap(new Blob([fabricationState.permanentLogoBytes],{type:"image/png"}));
  return fabricationState.permanentLogoBitmap;
}


function options(select, records){ for(const [value,item] of Object.entries(records)){ const option=document.createElement("option"); option.value=value; option.textContent=item.label||item.name; select.append(option); } }
options(fields.event, EVENTS); options(fields.map, MAPS); options(fields.printer, PRINTERS);
for(const name of CONTINENTS){const option=document.createElement("option");option.value=name;option.textContent=name;geoContinent.append(option)}
geoContinent.value="Worldwide";
fields.event.value="custom"; fields.map.value="uploaded"; fields.printer.value="bambu-p1s-ams";

function invalidateProductionModel(message="Print model changed. Generate again before downloading."){
  productionModel=null;authenticityReceipt=null;
  if(download3mf)download3mf.disabled=true;
  if(downloadStl)downloadStl.disabled=true;
  if(downloadObj)downloadObj.disabled=true;
  if(downloadGlb)downloadGlb.disabled=true;
  if(downloadStandStl)downloadStandStl.disabled=true;
  if(downloadTilePlan)downloadTilePlan.disabled=true;
  if(issueAuthenticity)issueAuthenticity.disabled=true;
  if(downloadAuthenticity)downloadAuthenticity.disabled=true;
  if(verifyAuthenticityLink){verifyAuthenticityLink.hidden=true;verifyAuthenticityLink.removeAttribute("href")}
  if(authenticityStatus)authenticityStatus.textContent="Generate a print model, then issue a signed receipt to prove that its export manifest came from the canonical VYNDI service.";
  if(glbViewerUrl){URL.revokeObjectURL(glbViewerUrl);glbViewerUrl=null}
  if(glbViewer){glbViewer.removeAttribute("src");glbViewerStatus.textContent="Generate a print model to inspect the exact exported GLB."}
  if(productionStatus&&terrain&&frameBounds)productionStatus.textContent=message;
}

function readConfig(){
  const relief=physicalReliefMm({exaggeration:fields.exaggeration.value,reliefLimit:fields.reliefLimit.value});
  const base=Number(fields.base.value); const routeRise=Number(fields.routeRise.value); const extraRise=Math.max(Number(heightmapStrength.value)||0,Number(contourRise.value)||0,Number(logoRise.value)||0);
  return { event:fields.event.value,eventName:fields.eventName.value,eventDate:fields.eventDate.value,eventLocation:fields.eventLocation.value,participant:fields.participant.value,bib:fields.bib.value,distance:fields.distance.value,startDetail:fields.startDetail.value,finishDetail:fields.finishDetail.value,elapsedTime:fields.elapsedTime.value,resultStatus:fields.resultStatus.value,placing:fields.placing.value,terrainEnvironment:terrainEnvironment.value,geography:selectedGeo?{continent:geoContinent.value,country:geoCountry.value,region:geoRegion.value,city:geoCity.value,source:selectedGeo.source||"",name:selectedGeo.name||"",bounds:selectedGeo.bounds||null}: {continent:geoContinent.value,country:geoCountry.value,region:geoRegion.value,city:geoCity.value},eventSource,participantSource,map:fields.map.value,printer:fields.printer.value,diameter:document.querySelector('[name="diameter"]:checked').value,exaggeration:Number(fields.exaggeration.value),reliefLimit:Number(fields.reliefLimit.value),waterMode:fields.waterMode.value,waveHeight:Number(fields.waveHeight.value),wavelength:Number(fields.wavelength.value),base,routeWidth:Number(fields.routeWidth.value),routeRise,totalHeight:Number((base+relief+routeRise+extraRise).toFixed(2)),shape:shapeSelect.value,shapeAspect:Number(shapeAspect.value),officialLogo:readOfficialLogo(),contours:{enabled:contourEnabled.checked,intervalMm:Number(contourInterval.value),widthMm:.08,riseMm:Number(contourRise.value)},magnets:{enabled:magnetEnabled.checked,diameterMm:Number(magnetDiameter.value),depthMm:Number(magnetDepth.value),spacingMm:Number(magnetSpacing.value)},hangingLoop:{enabled:hangingLoopEnabled.checked,innerDiameterMm:Number(loopInnerDiameter.value),wallMm:Number(loopWall.value)},bottomMark:bottomMark.value,bottomEngraveDepth:Number(bottomEngraveDepth.value),logoRise:Number(logoRise.value),heightmapStrength:Number(heightmapStrength.value),standEnabled:standEnabled.checked,tileEnabled:tileEnabled.checked,tileMaxWidth:Number(tileMaxWidth.value),tileMaxHeight:Number(tileMaxHeight.value),elevationSource:elevationSource.value,openTopoDataset:openTopoDataset.value,geoTiffCrs:geoTiffCrs.value.trim(),demFillNoData:demFillNoData.checked,demSmoothRadius:Number(demSmoothRadius.value)||0,meshTargetXy:Number(meshTargetXy.value)||0.5,routeElevationMode:routeElevationMode.value,routeElevationBlend:Number(routeElevationBlend.value)||0,placeLabels:{mode:placeLabelMode?.value||"major",selectedNames:[...selectedPlaceNames]},mapLayers:{trails:trailsEnabled.checked,railways:railwaysEnabled.checked,buildings:buildingsEnabled.checked},colors:{terrain:terrainColor.value,water:waterColor.value,route:routeColor.value,roads:roadsColor.value,labels:labelsColor.value,trails:trailsColor.value,railways:railwaysColor.value,buildings:buildingsColor.value} };
}

function applyEvent(){ const item=EVENTS[fields.event.value]; fields.eventName.value=item.name; fields.distance.value=item.distance; if(item.date)fields.eventDate.value=item.date; if(item.location)fields.eventLocation.value=item.location; if(item.sourceUrl)eventSource={source:item.source||"Saved event preset",sourceUrl:item.sourceUrl}; publicResultUrl.value=item.resultUrl||""; if(gpx){if(selectedGeo&&printAreaMode==="regional-context")void resetRegionalContext();else{contextBounds=mapContextBounds(fields.event.value,gpx.bounds); if(printAreaMode==="regional-context")void applyPrintableFrame(contextBounds,"regional-context",mapFrameSize(fields.event.value)); else void autoFitPrintableArea();}} update(); }
function update(){
  invalidateProductionModel();
  const c=readConfig(); const v=validateDesign(c); $("exaggerationOut").value=`${c.exaggeration}×`; $("reliefOut").value=`${c.reliefLimit.toFixed(1)} mm`; $("waveHeightOut").value=`${c.waveHeight.toFixed(2)} mm`; $("wavelengthOut").value=`${c.wavelength.toFixed(1)} mm`; printMarginOut.value=`${Number(printMargin.value)}%`; const terrainSummary=terrain?` · real DEM z${terrain.zoom} ${Math.round(terrain.landMin)}–${Math.round(terrain.landMax)} m`:""; const contextSummary=frameBounds?(printAreaMode==="event-focus"?` · event focus ${Number(printMargin.value)}% · balanced context`:printAreaMode==="view-crop"?" · committed zoom crop":" · regional context"):""; const mapSummary=cartography?` · vector map z${cartography.zoom}: ${cartography.stats.roads} roads, ${cartography.stats.trails||0} trails, ${cartography.stats.railways||0} railways, ${cartography.stats.buildings||0} buildings, ${cartography.stats.places} places`:""; const routeSummary=gpx?` · ${gpx.sourcePointCount.toLocaleString()} GPX points · ${gpx.points.length.toLocaleString()} preview points`:frameBounds?" · selected global terrain · no GPX overlay":" · search geography or upload a GPX"; $("terrainSource").textContent=MAPS[c.map].terrain+routeSummary+contextSummary+terrainSummary+mapSummary+(c.waterMode==="procedural-waves"?" · generated sea waves":""); $("dimensions").textContent=`Ø ${medalDiameterMm(c.diameter)} × ${c.totalHeight} mm`;
  const contextLabel=selectedGeo?"Selected geography":mapContextLabel(fields.event.value);$("resetMapContext").textContent=`Reset to ${contextLabel.charAt(0).toLowerCase()+contextLabel.slice(1)}`;if(frameBounds){const modeLabel=printAreaMode==="event-focus"?`EVENT FOCUS · ${Number(printMargin.value)}% margin · BALANCED CONTEXT`:printAreaMode==="view-crop"?"CURRENT ZOOM CROP":contextLabel.toUpperCase();printAreaState.textContent=`Printable area · ${modeLabel} · ${frameBounds.minLat.toFixed(2)}–${frameBounds.maxLat.toFixed(2)}°N · ${frameBounds.minLon.toFixed(2)}–${frameBounds.maxLon.toFixed(2)}°E`;}else{printAreaState.textContent="Search a geography or upload a GPX to define the printable terrain.";} const card=$("statusCard"); card.className=`status-card ${v.status}`; $("statusTitle").textContent=v.status==="ready"?"PROFILE CHECK · READY":v.status==="review"?"PROFILE CHECK · REVIEW":"PROFILE CHECK · BLOCKED"; $("statusText").textContent=v.warnings.length?v.warnings.join(" "): `${PRINTERS[c.printer].label}: ${PRINTERS[c.printer].formats.join(" / ")} output profile, ${PRINTERS[c.printer].colours} colour channel(s).`; const profile=PRINTERS[c.printer]; if(printerProfileNote)printerProfileNote.textContent=profile.productionKind==="3d"?`${profile.label} · build ${profile.bed.join(" × ")} mm · safe feature ≥ ${profile.minFeature} mm · emboss ≥ ${profile.minEmboss} mm · recommended layer ${profile.recommendedLayer} mm · prefer ${profile.preferredFormat}.`:`${profile.label} is a 2D production profile; STL/3MF generation is disabled.`; if(printerProfileSource){printerProfileSource.href=profile.sourceUrl||"#";printerProfileSource.style.display=profile.sourceUrl?"inline":"none";}
  draw();
}

function project(x,y,z,cx,cy,scale){ const cyaw=Math.cos(yaw),syaw=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch); const rx=x*cyaw-z*syaw; const rz=x*syaw+z*cyaw; const ry=y*cp-rz*sp; const depth=y*sp+rz*cp; const perspective=1/(1+depth*.0024); return [cx+rx*scale*perspective,cy+ry*scale*perspective,depth,perspective]; }
function height(x,y,ex){ const radial=Math.sqrt(x*x+y*y); const rim=Math.max(0,(radial-.72)/.28); return ((Math.sin(x*8+Math.cos(y*4))*0.22+Math.cos(y*10-x*2)*0.16+Math.sin((x+y)*13)*0.07)*(1-rim)+0.32)*(0.34+ex*.105); }
function tileY(latitude,zoom){const radians=Math.max(-85.05112878,Math.min(85.05112878,latitude))*Math.PI/180;return(1-Math.asinh(Math.tan(radians))/Math.PI)/2*2**zoom;}
function lonLatAt(x,y){
  if(!frameBounds&&!gpx)return null;const b=frameBounds||gpx.bounds,midLat=(b.minLat+b.maxLat)/2,midLon=(b.minLon+b.maxLon)/2,lonScale=Math.cos(midLat*Math.PI/180),extent=Math.max((b.maxLon-b.minLon)*lonScale,b.maxLat-b.minLat);
  return {lon:midLon+(x/frameSize)*extent/lonScale,lat:midLat+(y/frameSize)*extent};
}
function elevationAtLatLon(lat,lon){
  const source=elevationSource?.value||"terrarium";
  if(source==="geotiff"&&fabricationState.geoRaster?.sampleLatLon){
    const value=fabricationState.geoRaster.sampleLatLon(lat,lon);if(Number.isFinite(value))return value;
  }
  if((source==="local"||source==="opentopography")&&fabricationState.highResGrid){
    const value=sampleArcAsciiGrid(fabricationState.highResGrid,lat,lon);if(Number.isFinite(value))return value;
  }
  if(!terrain)return null;
  const world=2**terrain.zoom,tx=((lon+180)/360)*world,ty=tileY(lat,terrain.zoom),ix=Math.floor(tx),iy=Math.floor(ty),image=terrain.tiles.get(`${ix}/${iy}`);if(!image)return null;
  const px=Math.max(0,Math.min(255,(tx-ix)*255)),py=Math.max(0,Math.min(255,(ty-iy)*255));
  return sampleTerrariumBilinear(image.data,256,256,px,py);
}
function terrainSample(x,y){
  if(!frameBounds&&!gpx)return null;
  const geographic=lonLatAt(x,y);return geographic?elevationAtLatLon(geographic.lat,geographic.lon):null;
}
function syncGpxState(extra=""){if(!gpx)return;const bits=[`${gpx.filename} · ${gpx.sourcePointCount.toLocaleString()} source points · ${formatRouteDistance(gpx.distanceKm)}`];if(terrain)bits.push(`${terrain.tileCount} real DEM tiles at z${terrain.zoom}`);if(cartography)bits.push(`${cartography.tileCount} vector map tiles`);if(extra)bits.push(extra);$("gpxState").textContent=bits.join(" · ");}
function discoveryEscape(value=""){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}

function renderGeoResults(results){
  geoResults.dataset.results=JSON.stringify(results||[]);
  geoResults.innerHTML=(results||[]).map((item,index)=>`<article class="discovery-result"><strong>${discoveryEscape(item.name)}</strong><small>${discoveryEscape([item.type,item.address?.state||item.address?.region,item.address?.country].filter(Boolean).join(" · "))}</small><span class="source">${discoveryEscape(item.source||"OpenStreetMap")}</span><button type="button" data-use-geo="${index}">Use this terrain</button></article>`).join("");
}

async function searchGlobalGeography(){
  const params=new URLSearchParams({continent:geoContinent.value,country:geoCountry.value.trim(),region:geoRegion.value.trim(),city:geoCity.value.trim()});
  if(geoContinent.value==="Worldwide"&&!geoCountry.value.trim()&&!geoRegion.value.trim()&&!geoCity.value.trim()){geoSearchStatus.textContent="Choose a continent or enter a country, state/region, city, lake, mountain, island, or other named area.";geoCity.focus();return}
  geoSearchStatus.textContent="Searching global geography…";geoSearchStatus.classList.add("loading");geoResults.innerHTML="";
  try{
    const response=await fetch(`/api/geo/search?${params.toString()}`);
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Geography search failed.");
    renderGeoResults(data.results||[]);
    geoSearchStatus.textContent=data.results?.length?`${data.results.length} geographic matches found. Select the exact printable terrain.`:"No geographic match found. Try a broader place name.";
  }catch(error){geoSearchStatus.textContent=error.message}
  finally{geoSearchStatus.classList.remove("loading")}
}

async function useGeographyResult(item){
  if(!item?.bounds)return;
  selectedGeo=item;outlineCache=null;
  if(shapeSelect.value==="geographic"){await refreshShapeCoverage();return;}
  const address=item.address||{};
  if(address.country)geoCountry.value=address.country;
  if(address.state||address.region)geoRegion.value=address.state||address.region;
  if(address.city||address.town||address.village||address.municipality)geoCity.value=address.city||address.town||address.village||address.municipality;
  if(!fields.eventLocation.value.trim())fields.eventLocation.value=[geoCity.value,geoRegion.value,geoCountry.value].filter(Boolean).join(", ");
  fields.map.value="uploaded";
  const bounds=balanceBoundsForMapContext(expandBoundsByMargin(item.bounds,15),1.8);
  contextBounds=bounds;
  await applyPrintableFrame(bounds,"regional-context",1.45);
  geoSearchStatus.textContent=`Terrain loaded: ${item.name}`;
}

function renderWebEventResults(events){
  eventWebResults.dataset.events=JSON.stringify(events||[]);
  eventWebResults.innerHTML=(events||[]).slice(0,8).map((event,index)=>{const sourceUrl=event.provenance?.sourceUrl||event.sourceUrl||"";return `<article class="discovery-result"><strong>${discoveryEscape(event.name)}</strong><small>${discoveryEscape(event.description||"Public event result")}</small><span class="source">${discoveryEscape(event.provenance?.source||event.source||"Public web")}</span><div class="discovery-result-actions"><button type="button" data-use-web-event="${index}">Use event</button>${sourceUrl?`<a href="${discoveryEscape(sourceUrl)}" target="_blank" rel="noopener">Source ↗</a>`:""}</div></article>`}).join("");
}

async function searchGlobalEvents(){
  const query=eventWebSearch.value.trim();
  if(!query){eventWebStatus.textContent="Enter an event name or event search term.";eventWebSearch.focus();return}
  const params=new URLSearchParams({q:query,category:eventWebCategory.value,continent:geoContinent.value,country:geoCountry.value.trim(),region:geoRegion.value.trim(),city:geoCity.value.trim()});
  eventWebStatus.textContent="Searching public event sources…";eventWebStatus.classList.add("loading");eventWebResults.innerHTML="";
  try{
    const response=await fetch(`/api/events/search?${params.toString()}`);
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Event search failed.");
    renderWebEventResults(data.events||[]);
    eventWebStatus.textContent=data.events?.length?`${data.events.length} likely matches found. Select an event and confirm its exact edition details.`:"No useful public match found. Keep the event fields editable and enter the known details manually.";
  }catch(error){eventWebStatus.textContent=error.message}
  finally{eventWebStatus.classList.remove("loading")}
}

function useWebEvent(event){
  if(!event)return;
  const canonicalPbp=/paris.*brest.*paris/i.test(event.name);
  fields.event.value=canonicalPbp?"pbp2023":"custom";
  if(canonicalPbp){
    const preset=EVENTS.pbp2023;
    fields.eventName.value=preset.name;
    fields.eventDate.value=preset.date||"";
    fields.eventLocation.value=preset.location||"";
    fields.distance.value=preset.distance||"";
    publicResultUrl.value=preset.resultUrl||publicResultUrl.value;
    eventSource={source:preset.source||"Saved event preset",sourceUrl:preset.sourceUrl||""};
  }else{
    fields.eventName.value=event.name||fields.eventName.value;
    if(event.editionDate)fields.eventDate.value=String(event.editionDate).slice(0,10);
    if(event.location){fields.eventLocation.value=event.location;if(!geoCity.value.trim())geoCity.value=event.location;}
    if(event.distance)fields.distance.value=event.distance;
    eventSource=event.provenance||{source:"Public event discovery",sourceUrl:""};
  }
  try{localStorage.setItem("vyndiSelectedEvent",JSON.stringify({...event,source:eventSource.source,sourceUrl:eventSource.sourceUrl}))}catch{}
  eventWebStatus.textContent=canonicalPbp?"Paris–Brest–Paris 2023 selected. Official result source loaded; enter name or bib to auto-populate the rider result.":`Selected ${event.name}. Confirm edition date, location and distance before production.`;
  
  update();
}

function renderParticipantMatches(matches){
  const rows=(matches||[]).slice(0,12);
  participantMatches.dataset.matches=JSON.stringify(rows);
  participantMatches.innerHTML=rows.map((facts,index)=>`<article class="discovery-result participant-result"><strong>${discoveryEscape(facts.participant||"Unnamed participant")}</strong><small>${discoveryEscape([facts.bib?`BIB ${facts.bib}`:"",facts.elapsed?`TIME ${facts.elapsed}`:"",facts.status||""].filter(Boolean).join(" · "))}</small><button type="button" data-use-participant="${index}">Use rider</button></article>`).join("");
}

function applyParticipantFacts(facts){
  if(!facts)return;
  const url=publicResultUrl.value.trim();
  if(facts.eventPreset)fields.event.value=facts.eventPreset;
  if(facts.eventName)fields.eventName.value=facts.eventName;
  if(facts.editionDate)fields.eventDate.value=facts.editionDate;
  if(facts.location)fields.eventLocation.value=facts.location;
  if(facts.participant)fields.participant.value=facts.participant;
  if(facts.bib)fields.bib.value=facts.bib;
  if(facts.distance)fields.distance.value=facts.distance;
  fields.startDetail.value=facts.start||"";
  fields.finishDetail.value=facts.finish||"";
  fields.elapsedTime.value=facts.elapsed||"";
  fields.resultStatus.value=facts.status||"";
  fields.placing.value=facts.placing||"";
  participantSource={source:"Public participant/results page",sourceUrl:facts.sourceUrl||url,confidence:facts.confidence||""};
  if(facts.eventPreset&&EVENTS[facts.eventPreset]?.sourceUrl)eventSource={source:EVENTS[facts.eventPreset].source||"Saved event preset",sourceUrl:EVENTS[facts.eventPreset].sourceUrl};
  else if(!eventSource&&facts.sourceUrl)eventSource={source:"Public result page",sourceUrl:facts.sourceUrl};
  publicResultStatus.textContent=`Selected ${facts.participant||facts.bib||"participant"}. Event and result fields populated from the chosen result row.`;
  participantMatches.innerHTML="";
  participantMatches.dataset.matches="[]";
  update();
}

async function importParticipantFacts(){
  const url=publicResultUrl.value.trim(),participant=fields.participant.value.trim(),bib=fields.bib.value.trim();
  if(!url){publicResultStatus.textContent="Select an event with an official results source, or paste a public results URL.";publicResultUrl.focus();return}
  if(participant.length<2&&!bib){publicResultStatus.textContent="Type at least two letters of the participant name or enter a bib/rider number.";fields.participant.focus();return}
  publicResultStatus.textContent="Searching the selected results source…";publicResultStatus.classList.add("loading");participantMatches.innerHTML="";
  try{
    const response=await fetch("/api/events/import-result",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url,participant,bib,eventName:fields.eventName.value.trim()})});
    const data=await response.json();
    if(!response.ok)throw new Error(data.error||"Participant search failed.");
    let matches=Array.isArray(data.candidates)?data.candidates:[];
    if(!matches.length&&data.facts&&(data.facts.participant||data.facts.bib)&&(data.facts.elapsed||data.facts.status||data.facts.start||data.facts.finish))matches=[data.facts];
    renderParticipantMatches(matches);
    publicResultStatus.textContent=matches.length===1?"1 matching rider found. Check the row and click Use rider.":matches.length>1?`${matches.length} matching riders found. Choose the correct rider.`:"No matching rider was found. Refine the name/bib and search again.";
  }catch(error){publicResultStatus.textContent=error.message;renderParticipantMatches([])}
  finally{publicResultStatus.classList.remove("loading")}
}

function markParticipantSearchDirty(){
  participantMatches.innerHTML="";
  participantMatches.dataset.matches="[]";
  publicResultStatus.textContent="Rider details changed. Press Find participant when ready.";
}


async function applyPrintableFrame(bounds,mode,size=1.45){
  frameBounds={...bounds};frameSize=size;printAreaMode=mode;framingSelect.value=mode;const shapeRadius=shapeMaxRadius(shapeSelect.value,{aspect:Number(shapeAspect.value)}),coverage=medalCoverageBounds(frameBounds,frameSize,shapeRadius*1.03);if(gpx)gpx.coverageBounds=coverage;terrain=null;cartography=null;zoom=1;update();if(gpx)syncGpxState("loading printable area…");else geoSearchStatus.textContent="Loading selected terrain and map…";
  const results=await Promise.allSettled([loadTerrain(coverage),loadCartography(coverage,frameBounds,frameSize)]),failures=results.filter(result=>result.status==="rejected");
  if(gpx)syncGpxState(failures.length?failures.map(result=>result.reason.message).join(" · "):"");else geoSearchStatus.textContent=failures.length?failures.map(result=>result.reason.message).join(" · "):"Selected geography loaded as printable terrain.";
  update();
}

async function autoFitPrintableArea(){
  if(shapeSelect.value==="geographic"){await refreshShapeCoverage();return;}
  if(!gpx)return;
  const expanded=expandBoundsByMargin(gpx.bounds,Number(printMargin.value));
  const bounds=balanceBoundsForMapContext(expanded,1.8);
  await applyPrintableFrame(bounds,"event-focus",1.45);
}

async function useCurrentZoomAsPrintArea(){
  if(shapeSelect.value==="geographic"){outlineStatus.textContent="Geographic shapes use the complete selected outline. Change shape before cropping.";return;}
  if(!frameBounds)return;
  const cropped=viewerBoundsFromZoom(frameBounds,zoom);
  await applyPrintableFrame(cropped,"view-crop",1.45);
}

async function resetRegionalContext(){
  if(shapeSelect.value==="geographic"){await refreshShapeCoverage();return;}
  if(selectedGeo?.bounds){contextBounds=balanceBoundsForMapContext(expandBoundsByMargin(selectedGeo.bounds,20),1.8);await applyPrintableFrame(contextBounds,"regional-context",1.45);return}
  if(gpx){contextBounds=mapContextBounds(fields.event.value,gpx.bounds);await applyPrintableFrame(contextBounds,"regional-context",mapFrameSize(fields.event.value));}
}

function invalidateTerrainMesh(){terrainMeshCache=null;}

async function cachedTerrainTile(plan,x,y){
  const key=`${plan.zoom}/${x}/${y}`;
  if(!terrainTileCache.has(key))terrainTileCache.set(key,(async()=>{const tileResponse=await fetch(plan.terrainTemplate.replace("{z}",plan.zoom).replace("{x}",x).replace("{y}",y));if(!tileResponse.ok)throw new Error(`Elevation tile ${x}/${y} failed.`);const bitmap=await createImageBitmap(await tileResponse.blob()),canvas=new OffscreenCanvas(256,256),context=canvas.getContext("2d",{willReadFrequently:true});context.drawImage(bitmap,0,0);const image=context.getImageData(0,0,256,256),data=image.data;let min=Infinity,max=-Infinity;for(let i=0;i<data.length;i+=16){const elevation=data[i]*256+data[i+1]+data[i+2]/256-32768;if(elevation>.5&&elevation<9000){min=Math.min(min,elevation);max=Math.max(max,elevation);}}bitmap.close();return {image,min,max};})().catch(error=>{terrainTileCache.delete(key);throw error}));
  return terrainTileCache.get(key);
}

async function cachedVectorTile(plan,x,y){
  const key=`${plan.zoom}/${x}/${y}`;
  if(!vectorTileCache.has(key))vectorTileCache.set(key,(async()=>{const tileResponse=await fetch(plan.vectorTemplate.replace("{z}",plan.zoom).replace("{x}",x).replace("{y}",y));if(!tileResponse.ok)throw new Error(`Vector map tile ${x}/${y} failed.`);return decodeCartographyTile(await tileResponse.arrayBuffer(),{z:plan.zoom,x,y});})().catch(error=>{vectorTileCache.delete(key);throw error}));
  return vectorTileCache.get(key);
}

async function loadTerrain(bounds){
  terrain=null;invalidateTerrainMesh();$("terrainSource").textContent="Requesting real elevation tiles for the full medal footprint…";const response=await fetch("/api/terrain/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bounds,detail:"preview"})});if(!response.ok)throw new Error("Terrain service is unavailable on this deployment.");const plan=await response.json(),tiles=new Map(),jobs=[];let landMin=Infinity,landMax=-Infinity;
  for(let y=plan.tileRange.minY;y<=plan.tileRange.maxY;y++)for(let x=plan.tileRange.minX;x<=plan.tileRange.maxX;x++)jobs.push({x,y});
  for(let start=0;start<jobs.length;start+=16)await Promise.all(jobs.slice(start,start+16).map(async({x,y})=>{const tile=await cachedTerrainTile(plan,x,y);tiles.set(`${x}/${y}`,tile.image);if(Number.isFinite(tile.min))landMin=Math.min(landMin,tile.min);if(Number.isFinite(tile.max))landMax=Math.max(landMax,tile.max);}));
  if(!Number.isFinite(landMin)||!Number.isFinite(landMax)||landMax<=landMin){landMin=0;landMax=1;}
  terrain={zoom:plan.zoom,preferredZoom:plan.preferredZoom,tileCount:plan.tileCount,tiles,landMin,landMax};terrainRevision+=1;invalidateTerrainMesh();syncGpxState();update();
}

async function loadCartography(fetchBounds,projectionBounds,projectionSize){
  cartography=null;invalidateTerrainMesh();const detailMode=selectedGeo||printAreaMode!=="regional-context"?"high":"preview";const response=await fetch("/api/map/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({bounds:fetchBounds,detail:detailMode})});if(!response.ok)throw new Error("Vector map service is unavailable on this deployment.");const plan=await response.json(),jobs=[],decoded=[];
  for(let y=plan.tileRange.minY;y<=plan.tileRange.maxY;y++)for(let x=plan.tileRange.minX;x<=plan.tileRange.maxX;x++)jobs.push({x,y});
  for(let start=0;start<jobs.length;start+=16){const batch=await Promise.all(jobs.slice(start,start+16).map(({x,y})=>cachedVectorTile(plan,x,y)));decoded.push(...batch);}
  cartography={...compileCartography(decoded,projectionBounds,{tolerance:detailMode==="high"?.0032:.006,maxPlaces:240,maxRoads:650,maxTrails:700,maxRailways:500,maxBuildings:600,placeGrid:{columns:14,rows:10},roadGrid:{columns:8,rows:5},country:selectedGeo?.address?.country||geoCountry.value||(fields.event.value==="pbp2023"?"France":""),projectionSize}),zoom:plan.zoom,tileCount:plan.tileCount,attribution:plan.attribution};renderPlaceSelectionList();cartographyRevision+=1;invalidateTerrainMesh();syncGpxState();update();
}
function showsAtlantic(c){if(c.waterMode==="none")return false;if(c.map==="pbp")return true;if(!gpx)return false;const b=gpx.bounds;return b.minLon < -3 && b.maxLon > 1 && b.minLat > 46 && b.maxLat < 51;}
function shorelineX(y){return -.62+.10*Math.sin(y*2.7)+.045*Math.sin(y*8.2);}
function isWater(x,y,c){if(c.waterMode==="none")return false;const elevation=terrainSample(x,y);if(cartography&&(frameBounds||gpx)){const geographic=lonLatAt(x,y);if(geographic&&isPointInWater(geographic.lon,geographic.lat,cartography.waterPolygons))return true;if(elevation!==null)return elevation<=.5;return false;}if(elevation!==null)return elevation<=.5;return showsAtlantic(c)&&x<shorelineX(y);}
function surfaceHeight(x,y,c,waterOverride=null){const elevation=terrainSample(x,y),water=waterOverride===null?isWater(x,y,c):Boolean(waterOverride);if(water){if(c.waterMode==="flat")return .13;const frequency=20/Math.max(1.6,c.wavelength);return .13+(c.waveHeight/.3)*.018*(Math.sin((x+y*.32)*frequency)+.45*Math.sin((y-x*.18)*frequency*1.7));}const range=fabricationState.highResRange||(terrain?{min:terrain.landMin,max:terrain.landMax}:null);if(elevation!==null&&range){const normalized=normalizeElevationRange(elevation,range.min,range.max);return .16+normalized*(.18+c.exaggeration*.055);}if(terrain||fabricationState.highResGrid)return .16;return height(x,y,c.exaggeration);}
function routePoints(){
  if(gpx){ const stride=Math.max(1,Math.ceil(gpx.points.length/700)); return projectGpxPoints(gpx,frameSize,frameBounds).filter((_,i)=>i%stride===0||i===gpx.points.length-1); }
  if(!gpx)return [];
}
function shapeEdgeRatio(x,y,c){
  const angle=Math.atan2(y,x),boundary=Math.max(.0001,shapeBoundaryRadius(c.shape,angle,{aspect:c.shapeAspect}));
  return Math.hypot(x,y)/boundary;
}
function drawFeatureLines(ctx,features,c,cx,cy,scale,strokeStyle,lineWidth,dash=[],landOnly=false,pointAllowed=null){
  ctx.save();ctx.strokeStyle=strokeStyle;ctx.lineWidth=lineWidth;ctx.lineCap="round";ctx.lineJoin="round";ctx.setLineDash(dash);
  for(const feature of features||[]){ctx.beginPath();let drawing=false;for(const {x,y} of feature.points){if(!mapInside(x,y,c)||(landOnly&&isWater(x,y,c))||(pointAllowed&&!pointAllowed(x,y,feature))){drawing=false;continue;}const z=surfaceHeight(x,y,c)+.026,p=project(x,-z,y,cx,cy,scale);if(drawing)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);drawing=true;}ctx.stroke();}
  ctx.restore();
}
function drawBuildings(ctx,buildings,c,cx,cy,scale){
  if(!c.mapLayers.buildings)return;
  ctx.save();ctx.fillStyle=`${c.colors.buildings}88`;ctx.strokeStyle=`${c.colors.buildings}cc`;ctx.lineWidth=.45;
  for(const building of buildings||[]){
    ctx.beginPath();let any=false;
    for(const ring of building.rings||[]){
      let started=false;
      for(const point of ring){
        if(!mapInside(point.x,point.y,c))continue;
        const z=surfaceHeight(point.x,point.y,c)+.018+Math.min(.08,(building.renderHeight||3)/1000),p=project(point.x,-z,point.y,cx,cy,scale);
        if(!started){ctx.moveTo(p[0],p[1]);started=true;any=true}else ctx.lineTo(p[0],p[1]);
      }
      if(started)ctx.closePath();
    }
    if(any){ctx.fill("evenodd");ctx.stroke();}
  }
  ctx.restore();
}

function drawRoadHierarchy(ctx,roads,c,cx,cy,scale){
  const widths={motorway:1.28,trunk:1.08,primary:.84},budget=adaptiveRoadRenderBudget(c.diameter),majorRoads=(roads||[]).filter(road=>road.class==="motorway"||road.class==="trunk"||road.class==="primary").slice(0,budget);
  for(const roadClass of ["primary","trunk","motorway"]){
    const features=majorRoads.filter(feature=>feature.class===roadClass);
    if(features.length)drawFeatureLines(ctx,features,c,cx,cy,scale,c.colors.roads,widths[roadClass],[],false,(x,y,feature)=>roadPrintPolicy(feature.class,shapeEdgeRatio(x,y,c)));
  }
}
function drawPlaceLabels(ctx,places,c,cx,cy,scale){
  const occupied=[],maxVisiblePlaceLabels=adaptivePlaceLabelBudget(c.diameter,zoom,pitch);
  const candidates=(places||[]).filter(place=>mapInside(place.x,place.y,c)).map(place=>{
    const z=surfaceHeight(place.x,place.y,c)+.05,p=project(place.x,-z,place.y,cx,cy,scale);
    return {...place,screenX:p[0],screenY:p[1],projected:p};
  });
  const ordered=selectScreenPlacesSpatially(candidates,maxVisiblePlaceLabels,{columns:12,rows:9,width:ctx.canvas.width,height:ctx.canvas.height});
  ctx.save();ctx.textAlign="center";ctx.textBaseline="middle";
  for(const place of ordered){
    const p=place.projected,fontSize=placeLabelFontSize(place.class,zoom,pitch),label=place.name.toUpperCase();
    ctx.font=`700 ${fontSize}px Arial`;
    const padding=place.class==="city"?8:place.class==="town"?5:3,width=ctx.measureText(label).width+padding;
    const box={left:p[0]-width/2,right:p[0]+width/2,top:p[1]-fontSize*.68,bottom:p[1]+fontSize*.68};
    if(occupied.some(other=>!(box.right<other.left||box.left>other.right||box.bottom<other.top||box.top>other.bottom)))continue;
    occupied.push(box);
    ctx.lineWidth=place.class==="city"?2.8:2.1;ctx.strokeStyle="#071014d9";ctx.strokeText(label,p[0],p[1]);
    ctx.fillStyle=c.colors.labels;ctx.fillText(label,p[0],p[1]);
  }
  ctx.restore();
}
function buildTerrainMesh(c){
  const extent=shapeMaxRadius(c.shape,{aspect:c.shapeAspect});
  const key=[terrainRevision,cartographyRevision,c.exaggeration,c.waterMode,c.waveHeight,c.wavelength,frameSize,c.shape,c.shapeAspect,extent].join("|");
  if(terrainMeshCache?.key===key)return terrainMeshCache.cells;
  const n=81,cells=[],maxDepth=3,waterMemo=new Map(),inside=(x,y)=>mapInside(x,y,c),classify=(x,y)=>{const k=`${x.toFixed(6)},${y.toFixed(6)}`;if(!waterMemo.has(k))waterMemo.set(k,isWater(x,y,c));return waterMemo.get(k);};
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
    const x0=-extent+2*extent*i/(n-1),x1=-extent+2*extent*(i+1)/(n-1),y0=-extent+2*extent*j/(n-1),y1=-extent+2*extent*(j+1)/(n-1),centerX=(x0+x1)/2,centerY=(y0+y1)/2;
    if(!inside(centerX,centerY))continue;
    const refined=adaptiveWaterCells({x0,y0,x1,y1},classify,maxDepth);
    for(const cell of refined){
      const leafCenterX=(cell.x0+cell.x1)/2,leafCenterY=(cell.y0+cell.y1)/2;if(!inside(leafCenterX,leafCenterY))continue;
      const corners=[{x:cell.x0,y:cell.y0},{x:cell.x1,y:cell.y0},{x:cell.x1,y:cell.y1},{x:cell.x0,y:cell.y1}].map(({x,y})=>({x,y,z:surfaceHeight(x,y,c,cell.water)}));
      cells.push({corners,water:cell.water,boundary:cell.boundary});
    }
  }
  terrainMeshCache={key,cells};return cells;
}

function productionPixel(x,y,size,extent=1){
  return {x:(x/extent+1)*.5*size,y:(1-y/extent)*.5*size};
}

function productionMaskSampler(imageData,size,extent=1){
  const data=imageData.data;
  return (x,y)=>{
    if(Math.abs(x)>extent||Math.abs(y)>extent)return 0;
    const px=Math.max(0,Math.min(size-1,(x/extent+1)*.5*size-.5)),py=Math.max(0,Math.min(size-1,(1-y/extent)*.5*size-.5));
    const x0=Math.floor(px),y0=Math.floor(py),x1=Math.min(size-1,x0+1),y1=Math.min(size-1,y0+1),tx=px-x0,ty=py-y0,alpha=(ix,iy)=>data[(iy*size+ix)*4+3]/255;
    return (alpha(x0,y0)*(1-tx)+alpha(x1,y0)*tx)*(1-ty)+(alpha(x0,y1)*(1-tx)+alpha(x1,y1)*tx)*ty;
  };
}

function productionLogoMaskSampler(imageData,size,extent=1){
  const data=imageData.data;
  return (x,y)=>{
    const px=Math.max(0,Math.min(size-1,Math.round((x/extent+1)*.5*(size-1))));
    const py=Math.max(0,Math.min(size-1,Math.round((1-y/extent)*.5*(size-1))));
    const i=(py*size+px)*4,alpha=data[i+3]/255;
    if(alpha<=.02)return 0;
    const luma=(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])/255;
    return Math.max(0,Math.min(1,(luma-.36)/.42))*alpha;
  };
}

function drawProductionLine(ctx,points,size,lineWidthPx,extent,inside,pointAllowed=null){
  if(!points?.length)return;
  ctx.beginPath();let drawing=false,lastSegment=null;
  for(const point of points){
    if(!inside(point.x,point.y)||(pointAllowed&&!pointAllowed(point))){drawing=false;lastSegment=point.segment;continue}
    const p=productionPixel(point.x,point.y,size,extent);
    if(!drawing||lastSegment!==null&&point.segment!==lastSegment){ctx.moveTo(p.x,p.y);drawing=true}
    else ctx.lineTo(p.x,p.y);
    lastSegment=point.segment;
  }
  ctx.lineWidth=Math.max(1,lineWidthPx);ctx.stroke();
}

function drawProductionPolygon(ctx,rings,size,extent,inside,alpha=1){
  ctx.save();ctx.fillStyle=`rgba(255,255,255,${Math.max(0,Math.min(1,alpha))})`;ctx.beginPath();
  for(const ring of rings||[]){
    let started=false;
    for(const point of ring){
      if(!inside(point.x,point.y))continue;
      const p=productionPixel(point.x,point.y,size,extent);
      if(!started){ctx.moveTo(p.x,p.y);started=true}else ctx.lineTo(p.x,p.y);
    }
    if(started)ctx.closePath();
  }
  ctx.fill("evenodd");ctx.restore();
}

function fitProductionText(ctx,text,fontPx,maxWidthPx,minPx){
  let size=Math.max(minPx,fontPx);
  do{ctx.font=`700 ${size}px Arial`;if(ctx.measureText(text).width<=maxWidthPx||size<=minPx)break;size-=1}while(size>minPx);
  return size;
}

function buildProductionMasks(c,profile,size=1024){
  const create=()=>{const canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;return {canvas,ctx:canvas.getContext("2d",{willReadFrequently:true})}};
  const routeLayer=create(),roadLayer=create(),trailLayer=create(),railLayer=create(),buildingLayer=create(),textLayer=create(),officialLayer=create(),customLayer=create(),bottomLayer=create(),watermarkLayer=create(),diameterMm=medalDiameterMm(c.diameter),extent=shapeMaxRadius(c.shape,{aspect:c.shapeAspect}),pxPerMm=size/(diameterMm*extent),inside=(x,y)=>mapInside(x,y,c);
  for(const layer of [routeLayer,roadLayer,trailLayer,railLayer,buildingLayer,textLayer,officialLayer,customLayer,bottomLayer,watermarkLayer]){layer.ctx.lineCap="round";layer.ctx.lineJoin="round";layer.ctx.strokeStyle="#fff";layer.ctx.fillStyle="#fff"}

  if(cartography?.roads?.length){
    const roadWidths={motorway:1.15,trunk:1.0,primary:.82},budget=adaptiveRoadRenderBudget(c.diameter);
    const majorRoads=cartography.roads.filter(road=>road.class==="motorway"||road.class==="trunk"||road.class==="primary").slice(0,budget);
    for(const road of majorRoads){
      const widthMm=Math.max(profile.minFeature,roadWidths[road.class]);
      drawProductionLine(roadLayer.ctx,road.points,size,widthMm*pxPerMm,extent,inside,point=>roadPrintPolicy(road.class,shapeEdgeRatio(point.x,point.y,c)));
    }
  }
  if(c.mapLayers.trails&&cartography?.trails?.length){
    for(const trail of cartography.trails.slice(0,700))drawProductionLine(trailLayer.ctx,trail.points,size,Math.max(profile.minFeature*.8,.55)*pxPerMm,extent,inside);
  }
  if(c.mapLayers.railways&&cartography?.railways?.length){
    for(const rail of cartography.railways.slice(0,500))drawProductionLine(railLayer.ctx,rail.points,size,Math.max(profile.minFeature,.75)*pxPerMm,extent,inside);
  }
  if(c.mapLayers.buildings&&cartography?.buildings?.length){
    for(const building of cartography.buildings.slice(0,600))drawProductionPolygon(buildingLayer.ctx,building.rings,size,extent,inside,Math.max(.28,Math.min(1,building.renderHeight/40)));
  }

  const route=routePoints();
  if(route.length)drawProductionLine(routeLayer.ctx,route,size,Math.max(c.routeWidth,profile.minFeature)*pxPerMm,extent,inside);

  const tctx=textLayer.ctx,occupied=[],routeSampler=productionMaskSampler(routeLayer.ctx.getImageData(0,0,size,size),size,extent);
  const drawText=(text,nx,ny,fontMm,maxWidthNorm)=>{
    const value=String(text||"").trim();if(!value)return;
    let p=productionPixel(nx,ny,size,extent);const maxWidth=Math.min(size*.92,maxWidthNorm*size/extent),fontPx=fontMm*pxPerMm,minPx=Math.max(8,1.2*pxPerMm);
    const finalSize=fitProductionText(tctx,value.toUpperCase(),fontPx,maxWidth,minPx);
    tctx.textAlign="center";tctx.textBaseline="middle";tctx.lineWidth=Math.max(1,profile.minFeature*.72*pxPerMm);
    const width=Math.min(maxWidth,tctx.measureText(value.toUpperCase()).width+tctx.lineWidth*2),height=finalSize*1.1;
    const fits=(cx,cy)=>footprintFits(logoFootprint({x:cx,y:cy,widthMm:width/pxPerMm,aspect:width/height,diameterMm}),inside);
    if(!fits(nx,ny)){
      const location=findEmptyLogoPlacement({widthMm:width/pxPerMm,aspect:width/height,diameterMm},inside,(x,y)=>{
        const q=productionPixel(x,y,size,extent);
        return occupied.some(b=>q.x>=b.left-3&&q.x<=b.right+3&&q.y>=b.top-3&&q.y<=b.bottom+3)?50:routeSampler(x,y)*10;
      });
      if(!location)return;p=productionPixel(location.x,location.y,size,extent);
    }
    tctx.fillText(value.toUpperCase(),p.x,p.y,maxWidth);
    occupied.push({left:p.x-width/2,right:p.x+width/2,top:p.y-height/2,bottom:p.y+height/2});
  };

  drawText(c.eventName,0,.79,2.55,1.18);
  drawText(c.participant,0,-.66,2.25,1.08);
  const meta=buildMedalMetaLines(c).slice(0,3);
  meta.forEach((line,index)=>drawText(line,0,-.76-index*.085,1.45,1.02));

  const candidates=governedPlaces(c).filter(place=>inside(place.x,place.y)).map(place=>{
    const p=productionPixel(place.x,place.y,size,extent);return {...place,screenX:p.x,screenY:p.y};
  });
  const placeBudget=Math.min(printPlaceBudget(c,c.placeLabels?.mode),adaptivePlaceLabelBudget(c.diameter,1,0));
  const places=selectScreenPlacesSpatially(candidates,placeBudget,{columns:12,rows:9,width:size,height:size});
  let placeCount=0;
  for(const place of places){
    let p=productionPixel(place.x,place.y,size,extent);const fontMm=place.class==="city"?2.25:place.class==="town"?1.85:1.55;
    let fontPx=fontMm*pxPerMm;tctx.font=`700 ${fontPx}px Arial`;tctx.textAlign="center";tctx.textBaseline="middle";
    tctx.lineWidth=Math.max(1,profile.minFeature*.68*pxPerMm);
    const label=String(place.name||"").toUpperCase(),width=tctx.measureText(label).width+tctx.lineWidth*2,height=fontPx*1.05;
    let box=null;
    for(const shift of [.045,.08,-.045,-.08,.12,-.12,0]){
      const ny=place.y+shift,candidate=productionPixel(place.x,ny,size,extent),b={left:candidate.x-width/2,right:candidate.x+width/2,top:candidate.y-height/2,bottom:candidate.y+height/2};
      if(b.left<8||b.right>size-8||b.top<8||b.bottom>size-8)continue;
      if(occupied.some(other=>!(b.right<other.left||b.left>other.right||b.bottom<other.top||b.top>other.bottom)))continue;
      const footprint=logoFootprint({x:place.x,y:ny,widthMm:width/pxPerMm,aspect:width/height,diameterMm});
      if(!footprintFits(footprint,inside))continue;
      let collision=false;
      for(let xx=b.left;xx<=b.right;xx+=3)for(let yy=b.top;yy<=b.bottom;yy+=3)if(routeSampler((xx/size*2-1)*extent,(1-yy/size*2)*extent)>.2)collision=true;
      if(collision)continue;
      box=b;p=candidate;break;
    }
    if(!box)continue;
    occupied.push(box);tctx.fillText(label,p.x,p.y);placeCount++;
  }

  if(String(c.bottomMark||"").trim()){
    const bctx=bottomLayer.ctx,p=productionPixel(0,0,size,extent),fontPx=Math.max(12,1.8*pxPerMm),maxWidth=size*.72;
    fitProductionText(bctx,String(c.bottomMark).toUpperCase(),fontPx,maxWidth,10);
    bctx.textAlign="center";bctx.textBaseline="middle";bctx.lineWidth=Math.max(1,profile.minFeature*.65*pxPerMm);
    bctx.strokeText(String(c.bottomMark).toUpperCase(),p.x,p.y,maxWidth);bctx.fillText(String(c.bottomMark).toUpperCase(),p.x,p.y,maxWidth);
  }

  const wctx=watermarkLayer.ctx,logo=fabricationState.permanentLogoBitmap;
  if(logo){
    const ratio=logo.width/Math.max(1,logo.height),maxW=Math.min(size*.28,22*pxPerMm),maxH=12*pxPerMm;
    let targetW=maxW,targetH=targetW/Math.max(.2,ratio);
    if(targetH>maxH){targetH=maxH;targetW=targetH*ratio}
    wctx.drawImage(logo,(size-targetW)/2,size*.37-targetH/2,targetW,targetH);
  }
  const copyright="© 2026 VYNDI RIDE STORIES",copyrightY=size*.59,copyrightMax=size*.66,copyrightFont=Math.max(10,1.55*pxPerMm);
  fitProductionText(wctx,copyright,copyrightFont,copyrightMax,9);wctx.textAlign="center";wctx.textBaseline="middle";wctx.lineWidth=Math.max(1,profile.minFeature*.62*pxPerMm);
  wctx.strokeText(copyright,size/2,copyrightY,copyrightMax);wctx.fillText(copyright,size/2,copyrightY,copyrightMax);

  if(c.officialLogo.enabled&&logo){
    const o=c.officialLogo,p=productionPixel(o.x,o.y,size,extent),w=o.widthMm*pxPerMm,h=w/o.aspect,ctx=officialLayer.ctx;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-o.rotation*Math.PI/180);ctx.drawImage(logo,-w/2,-h/2,w,h);ctx.restore();
  }
  if(fabricationState.logoMask){
    const data=customLayer.ctx.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)data.data[(y*size+x)*4+3]=Math.round(255*fabricationState.logoMask(x/size*2-1,1-y/size*2));
    customLayer.ctx.putImageData(data,0,0);
  }
  const images={route:routeLayer.ctx.getImageData(0,0,size,size),roads:roadLayer.ctx.getImageData(0,0,size,size),trails:trailLayer.ctx.getImageData(0,0,size,size),rails:railLayer.ctx.getImageData(0,0,size,size),text:textLayer.ctx.getImageData(0,0,size,size),official:officialLayer.ctx.getImageData(0,0,size,size),custom:customLayer.ctx.getImageData(0,0,size,size)};
  return {images,
    routeMask:productionMaskSampler(routeLayer.ctx.getImageData(0,0,size,size),size,extent),
    roadMask:productionMaskSampler(roadLayer.ctx.getImageData(0,0,size,size),size,extent),
    trailMask:productionMaskSampler(trailLayer.ctx.getImageData(0,0,size,size),size,extent),
    railMask:productionMaskSampler(railLayer.ctx.getImageData(0,0,size,size),size,extent),
    buildingMask:productionMaskSampler(buildingLayer.ctx.getImageData(0,0,size,size),size,extent),
    textMask:productionMaskSampler(textLayer.ctx.getImageData(0,0,size,size),size,extent),
    bottomMask:productionMaskSampler(bottomLayer.ctx.getImageData(0,0,size,size),size,extent),
    permanentWatermarkMask:productionLogoMaskSampler(watermarkLayer.ctx.getImageData(0,0,size,size),size,extent),
    officialMask:productionMaskSampler(images.official,size,extent),customMask:productionMaskSampler(images.custom,size,extent),placeCount,maskSize:size,extent
  };
}

function productionTerrainRange(c){
  let min=Infinity,max=-Infinity;
  const steps=56,extent=shapeMaxRadius(c.shape,{aspect:c.shapeAspect});
  for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
    const x=-extent+2*extent*i/steps,y=-extent+2*extent*j/steps;if(!mapInside(x,y,c))continue;
    const value=surfaceHeight(x,y,c);if(Number.isFinite(value)){min=Math.min(min,value);max=Math.max(max,value)}
  }
  if(!Number.isFinite(min)||!Number.isFinite(max)||max-min<1e-6)return {min:0,max:1};
  return {min,max};
}

function productionFileStem(c){
  return String(c.eventName||"vyndi-terrain-medal").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)||"vyndi-terrain-medal";
}

function downloadProductionBytes(bytes,filename,type){
  const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function byteView(value){
  if(value instanceof Uint8Array)return value;
  if(value instanceof ArrayBuffer)return new Uint8Array(value);
  if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
  throw new Error("Unsupported export byte container.");
}
async function sha256ExportHex(value){
  const view=byteView(value),copy=view.byteOffset===0&&view.byteLength===view.buffer.byteLength?view:view.slice();
  const digest=await crypto.subtle.digest("SHA-256",copy);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
async function buildAuthenticityManifest(model){
  const candidates=[
    {name:`${model.stem}.3mf`,data:model.threeMf},
    {name:`${model.stem}.stl`,data:model.stl},
    {name:`${model.stem}-obj.zip`,data:model.objBundle},
    {name:`${model.stem}.glb`,data:model.glb},
    model.standStl?{name:`${model.stem}-stand.stl`,data:model.standStl}:null,
    model.tileBundle?{name:`${model.stem}-tiled-map.zip`,data:model.tileBundle}:null
  ].filter(Boolean);
  const files=[];
  for(const entry of candidates){
    const bytes=byteView(entry.data);
    files.push({name:entry.name,sha256:await sha256ExportHex(bytes),size:bytes.byteLength});
  }
  return {
    artifactType:"terrain-medal",
    stem:model.stem,
    files,
    governed:{
      profileId:model.profileId,shape:model.shape,triangles:model.triangles,vertices:model.vertices,
      resolutionStepMm:model.resolution?.stepMm,placeLabels:model.placeCount,watermarkMandatory:true
    }
  };
}
async function refreshAuthenticityServiceStatus(){
  if(!authenticityStatus)return;
  try{
    const response=await fetch("/api/authenticity/status",{headers:{accept:"application/json"}});
    const payload=await response.json().catch(()=>({}));
    if(response.ok&&payload.configured){
      authenticityStatus.textContent="Signing service ready · generate a print model, then issue its signed VYNDI authenticity receipt.";
      issueAuthenticity.dataset.serviceReady="true";
    }else{
      authenticityStatus.textContent="Signing service not activated · one-time activation required before signed receipts can be issued.";
      issueAuthenticity.dataset.serviceReady="false";
    }
  }catch{
    authenticityStatus.textContent="Authenticity service status unavailable · exports remain usable, but signed receipt state is unknown.";
    issueAuthenticity.dataset.serviceReady="unknown";
  }
}

async function requestAuthenticityReceipt(){
  if(!productionModel)return null;
  issueAuthenticity.disabled=true;downloadAuthenticity.disabled=true;
  verifyAuthenticityLink.hidden=true;
  authenticityStatus.textContent="Hashing governed exports and requesting VYNDI signature…";
  try{
    const manifest=await buildAuthenticityManifest(productionModel);
    const response=await fetch("/api/authenticity/issue",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({manifest})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Signing service returned ${response.status}`);
    authenticityReceipt=payload;
    downloadAuthenticity.disabled=false;
    verifyAuthenticityLink.href=payload.verificationUrl;
    verifyAuthenticityLink.hidden=false;
    authenticityStatus.textContent=`SIGNED · ${payload.claim.artifactId} · manifest ${payload.claim.manifestHash.slice(0,16)}…`;
    return payload;
  }catch(error){
    authenticityReceipt=null;
    authenticityStatus.textContent=`Unsigned · ${error.message}`;
    return null;
  }finally{issueAuthenticity.disabled=false}
}

function buildValidationBundle(c,profile){
  const coupon=buildPrintValidationCoupon({technology:profile.technology,nozzleMm:profile.nozzle||.4,minFeatureMm:profile.minFeature,minEmbossMm:profile.minEmboss}),stem="vyndi-validation-"+c.printer,materials=[
    {name:"Base",color:"#343A3EFF"},{name:"Water",color:"#2F9BC1FF"},{name:"BelowLimit",color:"#FF5C35FF"},{name:"Road",color:"#E7ECE9FF"},{name:"AtLimit",color:"#B8F229FF"},{name:"Emboss",color:"#A58CFFFF"},{name:"Raised",color:"#D29B49FF"},{name:"Building",color:"#D8D1C4FF"}
  ],manifest={...coupon.manifest,printerProfile:c.printer,printerLabel:profile.label,generatedAt:new Date().toISOString(),slicers:[
    {name:"Bambu Studio",status:"NOT RUN"},{name:"OrcaSlicer",status:"NOT RUN"},{name:"PrusaSlicer",status:"NOT RUN"},{name:"UltiMaker Cura",status:"NOT RUN"}
  ],physicalPrint:{status:"NOT RUN",checks:["feature legibility","emboss survival","material separation","dimensional tolerance","warping","first-layer adhesion"]}};
  const stl=encodeBinaryStl(coupon.mesh,{name:stem}),threeMf=encode3mf(coupon.mesh,{title:stem,materials}),glb=encodeGlb(coupon.mesh,{title:stem,materials});
  const readme="VYNDI PRINT VALIDATION\n\nThis bundle is a test harness, not proof of slicer or physical-print success.\n1. Import the coupon into each target slicer.\n2. Record import errors, scale, manifold repair, thin-feature warnings and material-region behavior.\n3. Print the coupon with the selected production profile.\n4. Measure the graded line widths and emboss heights.\n5. Update validation-manifest.json with actual evidence before declaring PASS.\n";
  return encodeArtifactZip([{name:stem+".stl",data:stl},{name:stem+".3mf",data:threeMf},{name:stem+".glb",data:glb},{name:"validation-manifest.json",data:JSON.stringify(manifest,null,2)},{name:"README.txt",data:readme}]);
}

async function imageFileSampler(file,channel){
  if(!file)return null;
  const bitmap=await createImageBitmap(file),size=768,canvas=document.createElement("canvas");canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.clearRect(0,0,size,size);
  const scale=Math.min(size/bitmap.width,size/bitmap.height),w=bitmap.width*scale,h=bitmap.height*scale;
  ctx.drawImage(bitmap,(size-w)/2,(size-h)/2,w,h);bitmap.close();
  return rasterSampler(ctx.getImageData(0,0,size,size),{channel});
}

function elevationGridStats(grid){
  const values=(grid?.values||[]).filter(value=>Number.isFinite(value)&&value!==grid.nodata);
  if(!values.length)return {min:0,max:1,count:0};
  let min=Infinity,max=-Infinity;for(const value of values){min=Math.min(min,value);max=Math.max(max,value)}
  return {min,max,count:values.length};
}

async function loadHighResolutionDem(){
  if(!frameBounds){fabricationStatus.textContent="Define the printable geography first.";return}
  if(elevationSource.value!=="opentopography"){fabricationState.highResGrid=null;fabricationState.highResRange=null;fabricationState.highResSource="";fabricationStatus.textContent="AWS Terrarium remains the active elevation source.";terrainRevision++;invalidateTerrainMesh();update();return}
  const apiKey=openTopoKey.value.trim();if(!apiKey){fabricationStatus.textContent="Enter your OpenTopography API key in this field. It is used for this request only and is not stored.";return}
  const radius=shapeMaxRadius(shapeSelect.value,{aspect:Number(shapeAspect.value)}),bounds=medalCoverageBounds(frameBounds,frameSize,radius*1.03),started=performance.now();
  fabricationStatus.textContent=`Testing OpenTopography and downloading ${openTopoDataset.value}…`;
  try{
    const response=await fetch("/api/terrain/opentopography",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dataset:openTopoDataset.value,apiKey,bounds})});
    const source=response.headers.get("x-terrain-source")||`opentopography-${openTopoDataset.value}`,text=await response.text();
    if(!response.ok){let message=text;try{message=JSON.parse(text).error||text}catch{}throw new Error(message)}
    const grid=parseArcAsciiGrid(text),stats=elevationGridStats(grid),elapsed=Math.round(performance.now()-started);
    fabricationState.geoRaster=null;fabricationState.highResGrid=grid;fabricationState.highResRange={min:stats.min,max:stats.max};fabricationState.gridSource=`OpenTopography ${openTopoDataset.value}`;fabricationState.highResSource=fabricationState.gridSource;
    terrainRevision++;invalidateTerrainMesh();invalidateProductionModel();fabricationStatus.textContent=`OpenTopography E2E PASS · ${source} · ${grid.ncols} × ${grid.nrows} grid · ${stats.count.toLocaleString()} valid cells · ${Math.round(stats.min)}–${Math.round(stats.max)} m · ${elapsed} ms. High-resolution DEM now overrides Terrarium.`;update();
  }catch(error){fabricationStatus.textContent=`OpenTopography E2E FAIL · ${error.message}`}
}

function fabricationMagnetPockets(c,diameterMm){
  if(!c.magnets.enabled)return [];
  const half=Math.max(0,c.magnets.spacingMm/2);
  return [{xMm:-half,yMm:0,diameterMm:c.magnets.diameterMm,depthMm:c.magnets.depthMm},{xMm:half,yMm:0,diameterMm:c.magnets.diameterMm,depthMm:c.magnets.depthMm}];
}

function downloadJsonArtifact(data,filename){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function buildRouteElevationCorrectionField(c,radiusMm,profile){
  if(!gpx?.points?.length){
    fabricationState.elevationDiagnostics={mode:c.routeElevationMode,paired:0,withGpxElevation:0,withDemElevation:0,maxAbsDeltaM:0,meanAbsDeltaM:0};
    return ()=>0;
  }
  const reconciliation=reconcileGpxElevations(gpx.points,elevationAtLatLon,{mode:c.routeElevationMode,blend:c.routeElevationBlend,maxDeltaM:150});
  fabricationState.elevationDiagnostics=reconciliation.diagnostics;
  if(c.routeElevationMode==="dem")return ()=>0;
  const projected=projectGpxPoints({...gpx,points:reconciliation.points},frameSize,frameBounds),extent=shapeMaxRadius(c.shape,{aspect:c.shapeAspect}),gridN=72,cellSize=2*extent/gridN,buckets=new Map();
  const sourceRange=fabricationState.highResRange||(terrain?{min:terrain.landMin,max:terrain.landMax}:{min:0,max:1000}),span=Math.max(1,sourceRange.max-sourceRange.min),mmPerMeter=c.reliefLimit/span,corridor=Math.max(c.routeWidth,profile?.minFeature||.6)/radiusMm*1.8,maxCorrection=Math.max(.1,c.reliefLimit*.35);
  const key=(ix,iy)=>ix+":"+iy,cell=(value)=>Math.max(0,Math.min(gridN-1,Math.floor((value+extent)/(2*extent)*gridN)));
  projected.forEach((point,index)=>{
    const reconciled=reconciliation.points[index],dem=Number(reconciled?.demEle),target=Number(reconciled?.reconciledEle);
    if(!Number.isFinite(dem)||!Number.isFinite(target))return;
    const correction=Math.max(-maxCorrection,Math.min(maxCorrection,(target-dem)*mmPerMeter));
    if(Math.abs(correction)<1e-5)return;
    const k=key(cell(point.x),cell(point.y));if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push({x:point.x,y:point.y,correction});
  });
  const radiusCells=Math.max(1,Math.ceil(corridor/cellSize));
  return (x,y)=>{
    const cx=cell(x),cy=cell(y);let best=null,bestD=Infinity;
    for(let dy=-radiusCells;dy<=radiusCells;dy++)for(let dx=-radiusCells;dx<=radiusCells;dx++){
      const entries=buckets.get(key(cx+dx,cy+dy));if(!entries)continue;
      for(const sample of entries){const d=Math.hypot(x-sample.x,y-sample.y);if(d<bestD){bestD=d;best=sample}}
    }
    if(!best||bestD>corridor)return 0;
    return best.correction*(1-bestD/corridor);
  };
}

function buildVolumetricBuildingMeshes(c,radiusMm,terrainHeightAt,profile){
  if(!c.mapLayers.buildings||!cartography?.buildings?.length)return [];
  const meshes=[],minFootprint=Math.max(profile.minFeature*1.2,.7);
  for(const building of cartography.buildings.slice(0,350)){
    const ring=building.rings?.[0];if(!ring||ring.length<4)continue;
    const normalized=ring.filter(point=>mapInside(point.x,point.y,c));
    if(normalized.length<3)continue;
    const points=normalized.map(point=>({x:point.x*radiusMm,y:point.y*radiusMm}));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...ys)-Math.min(...ys);
    if(Math.min(width,depth)<minFootprint)continue;
    const heightMm=Math.max(profile.minEmboss*2,.55,Math.min(8,(Number(building.renderHeight)||3)*.12));
    try{
      meshes.push(buildExtrudedPolygonMesh({points,heightMm,region:7,baseZAt:(x,y)=>c.base+terrainHeightAt(x/radiusMm,y/radiusMm)}));
    }catch{}
  }
  return meshes;
}

async function generateProductionModel(){
  const c=readConfig(),profile=PRINTERS[c.printer],diameterMm=medalDiameterMm(c.diameter),radiusMm=diameterMm/2;
  if(!profile||profile.productionKind!=="3d"){productionStatus.textContent="Choose a 3D FDM/FFF/SLA/MSLA/SLS production profile.";return}
  if((!terrain&&!fabricationState.highResGrid&&!fabricationState.geoRaster)||!frameBounds){productionStatus.textContent="Load real terrain and define the printable area before generating the print model.";return}
  if(!cartography){productionStatus.textContent="Vector cartography is still loading. Generate after roads and place names are available.";return}
  const warnings=validateProductionProfile(profile,{diameterMm,routeWidthMm:c.routeWidth,routeRiseMm:c.routeRise,totalHeightMm:c.totalHeight});
  if(warnings.length){productionStatus.textContent=warnings.join(" ");return}
  const preflightResolution=productionResolution({diameterMm,minFeatureMm:profile.minFeature,technology:profile.technology});
  const rasterWidth=fabricationState.geoRaster?.width||fabricationState.highResGrid?.ncols||(terrain?Math.ceil(Math.sqrt(Math.max(1,terrain.tileCount)))*256:0);
  const rasterHeight=fabricationState.geoRaster?.height||fabricationState.highResGrid?.nrows||(terrain?Math.ceil(Math.sqrt(Math.max(1,terrain.tileCount)))*256:0);
  const estimatedVertices=Math.max(1,(preflightResolution.rings+1)*preflightResolution.segments);
  const workload=classifyTerrainWorkload({rasterWidth,rasterHeight,estimatedVertices,deviceMemoryGb:Number(navigator.deviceMemory)||8});
  if(workload.action==="refuse"){productionStatus.textContent=`Generation refused safely · ${workload.reason} Raster ${rasterWidth} × ${rasterHeight}; estimated peak ${(workload.estimatedPeakBytes/1073741824).toFixed(2)} GB.`;return}
  if(workload.action==="tile"&&!c.tileEnabled){productionStatus.textContent=`Large-job guard · ${workload.reason} Enable tiled-map output or reduce raster/model resolution before generating.`;return}
  const workloadNote=workload.action==="warn"||workload.action==="tile"?` · PQ1 ${workload.action.toUpperCase()}: ${workload.reason}`:"";

  generatePrintModel.disabled=true;download3mf.disabled=true;downloadStl.disabled=true;downloadObj.disabled=true;downloadGlb.disabled=true;downloadStandStl.disabled=true;downloadTilePlan.disabled=true;productionStatus.textContent="Generating shaped watertight mesh, professional DEM reconciliation, volumetric buildings and export formats…";
  await new Promise(resolve=>requestAnimationFrame(()=>resolve()));
  try{
    await ensurePermanentVayuLogo();
    if(c.shape==="geographic"&&!geographyPolygons().length)throw new Error("Select and load a geographic boundary before exporting.");
    if(c.shape==="geographic"&&(c.hangingLoop.enabled||c.tileEnabled))throw new Error("Geographic outlines currently export as separate country/region pieces. Disable the hanging loop and tiled plan for this shape.");
    if(c.officialLogo.enabled&&!footprintFits(logoFootprint(logoOptions(c)),(x,y)=>mapInside(x,y,c)))throw new Error("The official logo extends outside the map. Move it, reduce its size, or use Find empty space.");
    const masks=buildProductionMasks(c,profile,1024),range=productionTerrainRange(c),resolution=productionResolution({diameterMm,minFeatureMm:profile.minFeature,technology:profile.technology}),extent=masks.extent,routeElevationCorrection=buildRouteElevationCorrectionField(c,radiusMm,profile);
    const routeRise=Math.max(c.routeRise,profile.minEmboss),roadRise=Math.min(routeRise,Math.max(profile.minEmboss,Math.min(.45,routeRise*.45))),trailRise=Math.min(routeRise,Math.max(profile.minEmboss,.28)),railRise=Math.min(routeRise,Math.max(profile.minEmboss,.36)),buildingRise=Math.min(1.4,Math.max(profile.minEmboss,.45)),textRise=Math.min(routeRise,Math.max(profile.minEmboss,/SLA|MSLA/.test(profile.technology) ? .20 : .38));
    const terrainRelief=(x,y)=>{
      const raw=surfaceHeight(x,y,c),normalized=Math.max(0,Math.min(1,(raw-range.min)/(range.max-range.min)));
      return normalized*c.reliefLimit;
    };
    const terrainHeightAt=(x,y)=>{
      const relief=terrainRelief(x,y),image=fabricationState.heightmapMask?fabricationState.heightmapMask(x/extent,y/extent)*Math.max(0,c.heightmapStrength):0;
      return Math.max(0,relief+routeElevationCorrection(x,y)+image+contourEmbossHeight(relief,c.contours));
    };
    const pockets=fabricationMagnetPockets(c,diameterMm);
    const bottomAt=(x,y)=>{
      const magnets=magnetPocketDepth(x*radiusMm,y*radiusMm,pockets);
      const engraving=masks.bottomMask(x,y)*Math.max(0,c.bottomEngraveDepth);
      const permanentWatermark=masks.permanentWatermarkMask(x,y)*Math.max(.30,profile.minEmboss);
      return Math.max(magnets,engraving,permanentWatermark);
    };
    const terrainRegion=(x,y)=>isWater(x,y,c)?1:0;
    let mesh=c.shape==="geographic"
      ?buildOutlineHeightfieldMesh({polygons:geographyPolygons(),radiusMm,baseMm:c.base,heightAt:terrainHeightAt,bottomAt,regionAt:terrainRegion,stepMm:Math.max(.45,resolution.stepMm)})
      :buildRadialMedalMesh({diameterMm,baseMm:c.base,rings:resolution.rings,segments:resolution.segments,heightAt:terrainHeightAt,bottomAt,regionAt:terrainRegion,shape:c.shape,aspect:c.shapeAspect});
    const buildOverlays=(extraInside=()=>true)=>{
    const overlayMeshes=[];
    const layers=[{key:"roads",region:3,rise:roadRise},{key:"trails",region:5,rise:trailRise},{key:"rails",region:6,rise:railRise},{key:"custom",region:4,rise:Math.max(profile.minEmboss,c.logoRise)},{key:"official",region:8,rise:Math.max(profile.minEmboss,c.logoRise)},{key:"route",region:2,rise:routeRise},{key:"text",region:4,rise:textRise}];
    const samplers={roads:masks.roadMask,trails:masks.trailMask,rails:masks.railMask,text:masks.textMask,custom:masks.customMask,official:masks.officialMask,route:masks.routeMask};
    for(let index=0;index<layers.length;index++){
      const layer=layers[index],higher=layers.slice(index+1),accept=(x,y)=>mapInside(x,y,c)&&extraInside(x,y)&&!higher.some(other=>samplers[other.key](x,y)>.5);
      const polygons=maskPolygons(masks.images[layer.key],{extent,accept});
      if(!polygons.length)continue;
      const overlay=buildOutlineHeightfieldMesh({polygons,radiusMm,baseMm:c.base,heightAt:(x,y)=>terrainHeightAt(x,y)+layer.rise,bottomAt:(x,y)=>Math.max(0,c.base+terrainHeightAt(x,y)-.08),regionAt:()=>layer.region,stepMm:.65,maxTriangles:350000});
      overlayMeshes.push(overlay);
    }
    return overlayMeshes;
    };
    const overlayMeshes=buildOverlays();
    if(overlayMeshes.length)mesh=mergeMeshes([mesh,...overlayMeshes]);
    if(c.hangingLoop.enabled){
      const inner=Math.max(1.5,c.hangingLoop.innerDiameterMm/2),outer=inner+Math.max(1.2,c.hangingLoop.wallMm),topRadius=shapeBoundaryRadius(c.shape,Math.PI/2,{aspect:c.shapeAspect})*radiusMm;
      const loop=buildAnnulusMesh({outerRadiusMm:outer,innerRadiusMm:inner,heightMm:c.base,centerX:0,centerY:topRadius+outer*.55,segments:Math.max(64,Math.floor(resolution.segments/4))});
      mesh=mergeMeshes([mesh,loop]);
    }
    const buildingMeshes=buildVolumetricBuildingMeshes(c,radiusMm,terrainHeightAt,profile);
    if(buildingMeshes.length)mesh=mergeMeshes([mesh,...buildingMeshes]);
    const edges=meshEdgeUse(mesh);
    if(edges.boundaryEdges||edges.nonManifoldEdges)throw new Error(`Generated mesh is not watertight (boundary ${edges.boundaryEdges}, non-manifold ${edges.nonManifoldEdges}).`);
    const materialColor=value=>/^#[0-9a-f]{6}$/i.test(String(value||""))?`${String(value).toUpperCase()}FF`:"#808080FF";
    const title=`${c.eventName||"VYNDI Terrain Medal"} · ${c.participant||""}`.trim(),materials=[
      {name:"Terrain",color:materialColor(c.colors.terrain)},
      {name:"Water",color:materialColor(c.colors.water)},
      {name:"Route",color:materialColor(c.colors.route)},
      {name:"Roads",color:materialColor(c.colors.roads)},
      {name:"Labels",color:materialColor(c.colors.labels)},
      {name:"Trails",color:materialColor(c.colors.trails)},
      {name:"Railways",color:materialColor(c.colors.railways)},
      {name:"Buildings",color:materialColor(c.colors.buildings)},
      {name:"Official Vāyú logo",color:"#FFFFFFFF"}
    ];
    const stem=productionFileStem(c),stl=encodeBinaryStl(mesh,{name:title}),threeMf=encode3mf(mesh,{title,materials}),mtl=encodeMtl(materials),obj=encodeObj(mesh,{name:title,materials,mtlFile:`${stem}.mtl`}),objBundle=encodeArtifactZip([{name:`${stem}.obj`,data:obj},{name:`${stem}.mtl`,data:mtl}]),glb=encodeGlb(mesh,{title,materials,texture:c.officialLogo.enabled?{region:8,png: fabricationState.permanentLogoBytes,uv:vertex=>logoUv(vertex.x/radiusMm,vertex.y/radiusMm,c)}:null});
    let standStl=null,tilePlan=null,tileBundle=null;
    if(c.standEnabled){
      const standWidth=Math.max(45,diameterMm*.62),standDepth=Math.max(32,diameterMm*.34),wmDepth=Math.max(.30,profile.minEmboss);
      const stand=buildDisplayStandMesh({
        medalDiameterMm:diameterMm,thicknessMm:Math.max(3,profile.minFeature*4),
        bottomAt:(x,y)=>{
          const watermarkRadius=Math.min(standWidth*.34,standDepth*.38);
          if(Math.abs(x)>watermarkRadius||Math.abs(y)>watermarkRadius)return 0;
          const nx=x/watermarkRadius*extent,ny=y/watermarkRadius*extent;
          return masks.permanentWatermarkMask(nx,ny)*wmDepth;
        }
      });
      const standEdges=meshEdgeUse(stand);if(standEdges.boundaryEdges||standEdges.nonManifoldEdges)throw new Error("Display stand mesh failed watertight validation.");
      standStl=encodeBinaryStl(stand,{name:`${title} stand · © 2026 VYNDI RIDE STORIES`});
    }
    if(c.tileEnabled){
      const right=shapeBoundaryRadius(c.shape,0,{aspect:c.shapeAspect})*radiusMm,left=shapeBoundaryRadius(c.shape,Math.PI,{aspect:c.shapeAspect})*radiusMm,top=shapeBoundaryRadius(c.shape,Math.PI/2,{aspect:c.shapeAspect})*radiusMm,bottom=shapeBoundaryRadius(c.shape,3*Math.PI/2,{aspect:c.shapeAspect})*radiusMm;
      const widthMm=left+right,heightMm=top+bottom,xMin=-left,yMin=-bottom;
      const adaptivePlan=adaptiveLargeFormatPlan({widthMm,heightMm,targetXyMm:c.meshTargetXy,maxVerticesPerTile:160000,maxTileMm:Math.min(c.tileMaxWidth,c.tileMaxHeight)}),connectorPlan=planTiledMap({widthMm,heightMm,maxTileWidthMm:widthMm/adaptivePlan.columns+.001,maxTileHeightMm:heightMm/adaptivePlan.rows+.001,dovetail:true});
      tilePlan={...adaptivePlan,connectors:connectorPlan.connectors,dovetailProfile:dovetailKeyProfile({neckMm:5,headMm:8,depthMm:4})};
      const tileFiles=[];
      for(const tile of tilePlan.tiles){
        const centerX=xMin+tile.xMm+tile.widthMm/2,centerY=yMin+tile.yMm+tile.heightMm/2,columns=Math.max(2,tile.gridColumns-1),rows=Math.max(2,tile.gridRows-1);
        let tileMesh=buildRectangularHeightfieldMesh({
          widthMm:tile.widthMm,heightMm:tile.heightMm,baseMm:c.base,columns,rows,
          heightAt:(lx,ly)=>{const nx=(centerX+lx)/radiusMm,ny=(centerY+ly)/radiusMm;return pointInsideShape(nx,ny,c.shape,{aspect:c.shapeAspect})?terrainHeightAt(nx,ny):0},
          bottomAt:(lx,ly)=>{const nx=(centerX+lx)/radiusMm,ny=(centerY+ly)/radiusMm,baseDepth=bottomAt(nx,ny),slots=(tilePlan.connectors||[]).filter(connector=>connector.tile===tile.id).reduce((maxDepth,connector)=>Math.max(maxDepth,dovetailSlotDepth(lx,ly,tile,connector,{lengthMm:16,headWidthMm:8,neckWidthMm:5,depthMm:Math.min(c.base-.4,Math.max(1.2,profile.minEmboss*5))})),0);return Math.max(baseDepth,slots)},
          regionAt:(lx,ly)=>{const nx=(centerX+lx)/radiusMm,ny=(centerY+ly)/radiusMm;return pointInsideShape(nx,ny,c.shape,{aspect:c.shapeAspect})?terrainRegion(nx,ny):0}
        });
        const tileOverlays=buildOverlays((x,y)=>Math.abs(x*radiusMm-centerX)<=tile.widthMm/2&&Math.abs(y*radiusMm-centerY)<=tile.heightMm/2);
        for(const overlay of tileOverlays)for(const vertex of overlay.vertices){vertex.x-=centerX;vertex.y-=centerY;}
        if(tileOverlays.length)tileMesh=mergeMeshes([tileMesh,...tileOverlays]);
        if(c.mapLayers.buildings&&cartography?.buildings?.length){
          const rect={minX:centerX-tile.widthMm/2,maxX:centerX+tile.widthMm/2,minY:centerY-tile.heightMm/2,maxY:centerY+tile.heightMm/2},tileBuildings=[];
          for(const building of cartography.buildings.slice(0,350)){
            const ring=building.rings?.[0];if(!ring||ring.length<4)continue;
            const global=ring.map(point=>({x:point.x*radiusMm,y:point.y*radiusMm})),clipped=clipPolygonToRect(global,rect);
            if(clipped.length<3)continue;
            const local=clipped.map(point=>({x:point.x-centerX,y:point.y-centerY})),xs=local.map(p=>p.x),ys=local.map(p=>p.y);
            if(Math.min(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))<Math.max(profile.minFeature*1.2,.7))continue;
            const heightMm=Math.max(profile.minEmboss*2,.55,Math.min(8,(Number(building.renderHeight)||3)*.12));
            try{tileBuildings.push(buildExtrudedPolygonMesh({points:local,heightMm,region:7,baseZAt:(lx,ly)=>c.base+terrainHeightAt((centerX+lx)/radiusMm,(centerY+ly)/radiusMm)}))}catch{}
          }
          if(tileBuildings.length)tileMesh=mergeMeshes([tileMesh,...tileBuildings]);
        }
        const tileEdges=meshEdgeUse(tileMesh);if(tileEdges.boundaryEdges||tileEdges.nonManifoldEdges)throw new Error(`Tile ${tile.id} failed watertight validation.`);
        tileFiles.push({name:`tile-${tile.id}.stl`,data:encodeBinaryStl(tileMesh,{name:`${title} tile ${tile.id}`})});
      }
      const keyMesh=buildDovetailKeyMesh({lengthMm:16,headWidthMm:8,neckWidthMm:5,heightMm:Math.max(2,profile.minEmboss*6)});
      const keyEdges=meshEdgeUse(keyMesh);if(keyEdges.boundaryEdges||keyEdges.nonManifoldEdges)throw new Error("Dovetail key failed watertight validation.");
      const joints=Math.ceil(tilePlan.connectors.length/2);
      const manifest={...tilePlan,keyFile:"dovetail-key.stl",keyQuantity:joints,note:"Print the stated number of keys; align tile seams according to connector assignments."};
      tileBundle=encodeArtifactZip([...tileFiles,{name:"dovetail-key.stl",data:encodeBinaryStl(keyMesh,{name:"VYNDI dovetail key"})},{name:"manifest.json",data:JSON.stringify(manifest,null,2)}]);
    }
    productionModel={stl,threeMf,objBundle,glb,standStl,tilePlan,tileBundle,stem,triangles:mesh.triangles.length,vertices:mesh.vertices.length,resolution,placeCount:masks.placeCount,placeLabelMode:c.placeLabels.mode,volumetricBuildings:buildingMeshes.length,profileId:c.printer,shape:c.shape,elevationSource:fabricationState.highResSource||"AWS Terrarium",elevationDiagnostics:fabricationState.elevationDiagnostics,meshTargetXy:c.meshTargetXy,mapLayers:c.mapLayers,watermark:{asset:"assets/vayu-official.png",text:"© 2026 VYNDI RIDE STORIES",mandatory:true},colors:c.colors,workload};
    download3mf.disabled=false;downloadStl.disabled=false;downloadObj.disabled=false;downloadGlb.disabled=false;downloadStandStl.disabled=!standStl;downloadTilePlan.disabled=!tileBundle;
    issueAuthenticity.disabled=false;authenticityReceipt=null;downloadAuthenticity.disabled=true;verifyAuthenticityLink.hidden=true;authenticityStatus.textContent="Model ready · issue a signed VYNDI authenticity receipt to bind these export hashes to the canonical service.";
    if(glbViewerUrl)URL.revokeObjectURL(glbViewerUrl);
    glbViewerUrl=URL.createObjectURL(new Blob([glb],{type:"model/gltf-binary"}));
    if(glbViewer){
      try{
        const viewerSource=await ensureGlbViewerComponent();
        glbViewerStatus.textContent=`Rendering governed GLB · viewer ${viewerSource===MODEL_VIEWER_LOCAL?"local":"pinned fallback"}…`;
        glbViewer.src=glbViewerUrl;
      }catch(error){
        glbViewerStatus.textContent=`GLB viewer failed · ${error.message} The downloadable GLB remains available.`;
      }
    }
    const extras=[c.shape,c.contours.enabled?"contours":null,c.magnets.enabled?"magnet pockets":null,c.hangingLoop.enabled?"hanger":null,buildingMeshes.length?`${buildingMeshes.length} buildings`:null,`labels:${c.placeLabels.mode}`,"provenance watermark",fabricationState.logoMask?"custom logo":null,fabricationState.heightmapMask?"heightmap":null].filter(Boolean).join(", "),elev=fabricationState.elevationDiagnostics;
    productionStatus.textContent=`Ready · ${mesh.triangles.length.toLocaleString()} triangles · ${masks.placeCount} place labels · ${resolution.stepMm} mm medal mesh · ${extras||"standard"} · ${productionModel.elevationSource}${elev&&elev.paired?` · GPX/DEM paired ${elev.paired}, mean Δ ${elev.meanAbsDeltaM} m`:""} · STL / 3MF / OBJ / GLB ready${workloadNote}.`;
  }catch(error){
    productionModel=null;
    download3mf.disabled=true;downloadStl.disabled=true;downloadObj.disabled=true;downloadGlb.disabled=true;downloadStandStl.disabled=true;downloadTilePlan.disabled=true;
    productionStatus.textContent=`Generation failed: ${error.message}. Main exports remain disabled until the print model completes successfully.`;
  }finally{generatePrintModel.disabled=false}
}

function traceMedalBoundary(ctx,c,cx,cy,scale){
  const samples=240,boundaryZ=.145;
  if(c.shape==="geographic"){
    ctx.beginPath();
    for(const rings of geographyPolygons())for(const ring of rings){
      ring.forEach((point,i)=>{const p=project(point.x,-surfaceHeight(point.x,point.y,c),point.y,cx,cy,scale);if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1])});ctx.closePath();
    }
    return;
  }
  ctx.beginPath();
  for(let i=0;i<=samples;i++){
    const angle=i/samples*Math.PI*2,r=shapeBoundaryRadius(c.shape,angle,{aspect:c.shapeAspect}),x=Math.cos(angle)*r,y=Math.sin(angle)*r,p=project(x,-boundaryZ,y,cx,cy,scale);
    if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);
  }
  ctx.closePath();
}
function drawOfficialLogo(ctx,c,cx,cy,scale){
  const bitmap=fabricationState.permanentLogoBitmap;if(!c.officialLogo.enabled||!bitmap)return;
  const points=logoFootprint(logoOptions(c)).map(p=>project(p.x,-(surfaceHeight(p.x,p.y,c)+.025),p.y,cx,cy,scale));
  const uv=[[0,bitmap.height],[bitmap.width,bitmap.height],[bitmap.width,0],[0,0]];
  for(const ids of [[0,1,2],[0,2,3]]){
    const [[u0,v0],[u1,v1],[u2,v2]]=ids.map(i=>uv[i]),[[x0,y0],[x1,y1],[x2,y2]]=ids.map(i=>points[i]),det=(u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);
    const a=((x1-x0)*(v2-v0)-(x2-x0)*(v1-v0))/det,b=((y1-y0)*(v2-v0)-(y2-y0)*(v1-v0))/det,cc=((x2-x0)*(u1-u0)-(x1-x0)*(u2-u0))/det,d=((y2-y0)*(u1-u0)-(y1-y0)*(u2-u0))/det;
    ctx.save();ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.lineTo(x2,y2);ctx.closePath();ctx.clip();ctx.transform(a,b,cc,d,x0-a*u0-cc*v0,y0-b*u0-d*v0);ctx.drawImage(bitmap,0,0);ctx.restore();
  }
}
function draw(){
  const canvas=$("medalCanvas"),ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,cx=w/2,cy=h*.51,scale=Math.min(w,h)*VIEWER_LIMITS.baseScale*zoom,c=readConfig(); ctx.clearRect(0,0,w,h);
  ctx.save();traceMedalBoundary(ctx,c,cx,cy,scale);ctx.clip("evenodd");
  const cells=buildTerrainMesh(c).map(cell=>{const pts=cell.corners.map(({x,y,z})=>project(x,-z,y,cx,cy,scale));return {...cell,pts,depth:pts.reduce((sum,p)=>sum+p[2],0)/pts.length}}).sort((a,b)=>a.depth-b.depth);
  for(const cell of cells){const shade=Math.max(38,Math.min(112,72-cell.depth*.35));ctx.beginPath();cell.pts.forEach((p,k)=>k?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=cell.water?`rgb(${shade*.34},${shade*.92},${shade*1.22})`:`rgb(${shade*.72},${shade*.84},${shade*.88})`;ctx.fill();ctx.strokeStyle=cell.water?"#8dd9eb28":"#91a2a518";ctx.lineWidth=.7;ctx.stroke();}
  if(cartography){drawFeatureLines(ctx,cartography.boundaries,c,cx,cy,scale,"#9aa8ad30",.65,[3,4]);drawBuildings(ctx,cartography.buildings,c,cx,cy,scale);if(c.mapLayers.trails)drawFeatureLines(ctx,cartography.trails,c,cx,cy,scale,c.colors.trails,.9,[2,2]);if(c.mapLayers.railways)drawFeatureLines(ctx,cartography.railways,c,cx,cy,scale,c.colors.railways,1.0,[5,2]);drawRoadHierarchy(ctx,cartography.roads,c,cx,cy,scale);drawFeatureLines(ctx,cartography.waterways,c,cx,cy,scale,c.colors.water,1.08);drawFeatureLines(ctx,cartography.countryBoundaries,c,cx,cy,scale,"#f4f6f2e8",2.4);}
  drawOfficialLogo(ctx,c,cx,cy,scale);
  const route=routePoints(),routeLift=routePreviewLift(c.routeRise,c.exaggeration),routeShadowWidth=routeShadowWidthForExaggeration(c.exaggeration),routeWidthMultiplier=routeWidthMultiplierForExaggeration(c.exaggeration);ctx.beginPath();route.forEach(({x,y,segment},i)=>{const z=surfaceHeight(x,y,c)+routeLift;const p=project(x,-z,y,cx,cy,scale);if(!i||segment!==route[i-1].segment)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);});ctx.strokeStyle="#15151566";ctx.lineWidth=routeShadowWidth;ctx.stroke();ctx.strokeStyle=c.colors.route;ctx.lineWidth=Math.max(VIEWER_LIMITS.minRouteWidthPx,c.routeWidth*routeWidthMultiplier);ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();if(cartography)drawPlaceLabels(ctx,governedPlaces(c),c,cx,cy,scale);ctx.restore();
  const metaLines=buildMedalMetaLines(c),hasMeta=metaLines.length>0,titleY=hasMeta?h-154:h-82,participantY=hasMeta?h-124:h-48;ctx.textAlign="center";ctx.fillStyle="#b8f229";ctx.font="700 28px Arial";ctx.fillText(c.eventName.toUpperCase().slice(0,34),cx,titleY);ctx.fillStyle="#f4f6f2";ctx.font="700 22px Arial";ctx.fillText(c.participant.toUpperCase(),cx,participantY);if(hasMeta){ctx.font="700 12px Arial";ctx.fillStyle="#cbd6d2";metaLines.slice(0,4).forEach((line,index)=>ctx.fillText(line.toUpperCase(),cx,h-96+index*18));}
}

$("medalCanvas").addEventListener("pointerdown",e=>{dragging=true;last=[e.clientX,e.clientY];e.currentTarget.setPointerCapture(e.pointerId)}); $("medalCanvas").addEventListener("pointermove",e=>{if(!dragging)return;yaw+=(e.clientX-last[0])*.008;pitch=Math.max(.28,Math.min(1.45,pitch+(e.clientY-last[1])*.006));last=[e.clientX,e.clientY];draw()}); $("medalCanvas").addEventListener("pointerup",()=>dragging=false); $("medalCanvas").addEventListener("wheel",e=>{e.preventDefault();zoom=nextViewerZoom(zoom,e.deltaY);draw()},{passive:false});
$("resetView").addEventListener("click",()=>{yaw=-.42;pitch=.92;zoom=1;draw()}); $("autoFitRoute").addEventListener("click",()=>void autoFitPrintableArea()); $("useViewAsPrint").addEventListener("click",()=>void useCurrentZoomAsPrintArea()); $("resetMapContext").addEventListener("click",()=>void resetRegionalContext()); framingSelect.addEventListener("change",()=>{if(framingSelect.value==="event-focus"){if(gpx)void autoFitPrintableArea();else if(selectedGeo)void resetRegionalContext();}else if(framingSelect.value==="regional-context")void resetRegionalContext();else void useCurrentZoomAsPrintArea();}); printMargin.addEventListener("input",()=>{printMarginOut.value=`${Number(printMargin.value)}%`;update()}); printMargin.addEventListener("change",()=>{if(gpx&&printAreaMode==="event-focus")void autoFitPrintableArea()}); geoSearchButton.addEventListener("click",()=>void searchGlobalGeography()); geoCity.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void searchGlobalGeography()}}); geoResults.addEventListener("click",event=>{const button=event.target.closest("[data-use-geo]");if(!button)return;try{const results=JSON.parse(geoResults.dataset.results||"[]");void useGeographyResult(results[Number(button.dataset.useGeo)])}catch{}}); eventWebSearchButton.addEventListener("click",()=>void searchGlobalEvents()); eventWebSearch.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();void searchGlobalEvents()}}); eventWebResults.addEventListener("click",event=>{const button=event.target.closest("[data-use-web-event]");if(!button)return;try{const events=JSON.parse(eventWebResults.dataset.events||"[]");useWebEvent(events[Number(button.dataset.useWebEvent)])}catch{}}); importPublicResult.addEventListener("click",()=>void importParticipantFacts()); fields.participant.addEventListener("input",markParticipantSearchDirty); fields.bib.addEventListener("input",markParticipantSearchDirty); publicResultUrl.addEventListener("change",markParticipantSearchDirty); participantMatches.addEventListener("click",event=>{const button=event.target.closest("[data-use-participant]");if(!button)return;try{const matches=JSON.parse(participantMatches.dataset.matches||"[]");applyParticipantFacts(matches[Number(button.dataset.useParticipant)])}catch{}}); fields.event.addEventListener("change",()=>{applyEvent();markParticipantSearchDirty()}); const terrainAffectingFields=new Set([fields.exaggeration,fields.waterMode,fields.waveHeight,fields.wavelength]); Object.values(fields).forEach(el=>el.addEventListener("input",()=>{if(terrainAffectingFields.has(el))invalidateTerrainMesh();update()})); document.querySelectorAll('[name="diameter"]').forEach(el=>el.addEventListener("change",update));
$("gpxInput").addEventListener("change",async(e)=>{
  const files=[...(e.target.files||[])];if(!files.length)return;
  $("gpxState").textContent=`Reading ${files.length} GPX file${files.length===1?"":"s"}…`;
  try{
    for(const file of files)validateLocalFileMeta(file,{maxBytes:96*1024*1024,extensions:[".gpx"]});
    if(files.reduce((sum,file)=>sum+file.size,0)>192*1024*1024)throw new Error("Combined GPX files exceed the 192 MB browser safety limit.");
    const previousPreset=fields.event.value,previousDefaultName=EVENTS[previousPreset]?.name||"",existingName=fields.eventName.value.trim(),preserveTypedName=existingName&&existingName!==previousDefaultName;
    const parsed=[];for(const file of files)parsed.push(parseGpxText(await file.text(),file.name));
    gpx=mergeGpxRoutes(parsed);
    const first=files[0],inferredPreset=inferEventPresetFromFilename(first.name);fields.event.value=inferredPreset;
    if(!preserveTypedName)fields.eventName.value=inferredPreset==="custom"?eventNameFromGpxFilename(first.name):EVENTS[inferredPreset].name;
    fields.distance.value=formatRouteDistance(gpx.distanceKm);contextBounds=mapContextBounds(inferredPreset,gpx.bounds);fields.map.value="uploaded";framingSelect.value="event-focus";printAreaMode="event-focus";terrain=null;cartography=null;syncGpxState(`${gpx.routeCount} route${gpx.routeCount===1?"":"s"}`);update();await autoFitPrintableArea();
  }catch(error){$("gpxState").textContent=error.message;terrain=null;cartography=null;frameBounds=null;contextBounds=null;frameSize=1.45;printAreaMode="event-focus";update()}
});
async function refreshShapeCoverage(){
  const revision=++shapeRequestRevision;
  if(shapeSelect.value==="geographic"){
    if(!selectedGeo?.osmId){outlineStatus.textContent="Search and select a country or region first. No geographic boundary is selected.";invalidateTerrainMesh();update();return;}
    outlineStatus.textContent="Loading the selected geographic boundary…";
    try{
      if(!selectedGeo.geometry){
        const selected=selectedGeo,response=await fetch(`/api/geo/outline?type=${encodeURIComponent(selected.osmType)}&id=${encodeURIComponent(selected.osmId)}`),data=await response.json();
        if(!response.ok)throw new Error(data.error||"Boundary lookup failed.");
        if(revision!==shapeRequestRevision||selected!==selectedGeo)return;
        selected.geometry=data.geometry;
      }
      outlineCache=null;
      projectGeographicOutline(selectedGeo.geometry,selectedGeo.bounds,1.8);
      outlineStatus.textContent=`Selected outline · ${selectedGeo.name}. Islands are separate printable pieces.`;
      await applyPrintableFrame({...selectedGeo.bounds},"regional-context",1.8);
    }catch(error){outlineStatus.textContent=error.message;invalidateProductionModel();}
    return;
  }
  outlineStatus.textContent="Standard medal shape selected.";
  fabricationState.highResGrid=null;fabricationState.highResSource="";invalidateTerrainMesh();invalidateProductionModel();
  if(frameBounds)await applyPrintableFrame({...frameBounds},printAreaMode,frameSize);else update();
}
shapeSelect.addEventListener("change",()=>void refreshShapeCoverage());
shapeAspect.addEventListener("change",()=>void refreshShapeCoverage());
officialLogoEnabled.addEventListener("change",async()=>{
  try{if(officialLogoEnabled.checked)await ensurePermanentVayuLogo();update();officialLogoStatus.textContent=officialLogoEnabled.checked?"Official logo enabled. Adjust its position, size and rotation or find empty space.":"Front logo disabled."}catch(error){officialLogoStatus.textContent=error.message;officialLogoEnabled.checked=false;update()}
});
for(const control of [officialLogoX,officialLogoY,officialLogoWidth,officialLogoRotation])control.addEventListener("input",()=>{
  update();const c=readConfig(),fits=footprintFits(logoFootprint(logoOptions(c)),(x,y)=>mapInside(x,y,c));
  officialLogoStatus.textContent=fits?`Logo position ${officialLogoX.value}% / ${officialLogoY.value}% · ${officialLogoWidth.value} mm · ${officialLogoRotation.value}°`:"Logo extends outside the map. Move it or reduce its width before exporting.";
});
$("findLogoSpace").addEventListener("click",async()=>{
  try{
    await ensurePermanentVayuLogo();const c=readConfig(),profile=PRINTERS[c.printer],masks=buildProductionMasks({...c,officialLogo:{...c.officialLogo,enabled:false}},profile,512);
    const choice=findEmptyLogoPlacement(logoOptions(c),(x,y)=>mapInside(x,y,c),(x,y)=>masks.routeMask(x,y)*20+masks.textMask(x,y)*12+masks.roadMask(x,y)*3+masks.railMask(x,y)*3+masks.trailMask(x,y)*2+(isWater(x,y,c)?0:.1));
    if(!choice)throw new Error("No space fits this logo width within the map. Reduce the width and try again.");
    officialLogoX.value=String(Math.round(choice.x*100));officialLogoY.value=String(Math.round(choice.y*100));officialLogoEnabled.checked=true;update();
    officialLogoStatus.textContent=`Logo placed at ${officialLogoX.value}% / ${officialLogoY.value}% in a low-clutter area. Adjust manually if needed.`;
  }catch(error){officialLogoStatus.textContent=error.message}
});
logoInput.addEventListener("change",async event=>{
  const file=event.target.files?.[0];
  try{
    if(file)validateLocalFileMeta(file,{maxBytes:16*1024*1024,extensions:[".svg",".png",".webp"]});
    fabricationState.logoMask=file?await imageFileSampler(file,"alpha"):null;
    fabricationStatus.textContent=file?`Logo loaded locally: ${file.name}`:"Logo emboss cleared.";invalidateProductionModel();update();
  }catch(error){fabricationState.logoMask=null;fabricationStatus.textContent=`Logo rejected: ${error.message}`}
});
heightmapInput.addEventListener("change",async event=>{
  const file=event.target.files?.[0];
  try{
    if(file)validateLocalFileMeta(file,{maxBytes:32*1024*1024,extensions:[".png",".jpg",".jpeg",".webp"]});
    fabricationState.heightmapMask=file?await imageFileSampler(file,"luminance"):null;
    fabricationStatus.textContent=file?`Heightmap loaded locally: ${file.name}`:"Heightmap cleared.";invalidateProductionModel();update();
  }catch(error){fabricationState.heightmapMask=null;fabricationStatus.textContent=`Heightmap rejected: ${error.message}`}
});
localDemInput.addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    validateLocalFileMeta(file,{maxBytes:256*1024*1024,extensions:[".asc",".txt"]});
    const grid=parseArcAsciiGrid(await file.text()),stats=elevationGridStats(grid);
    fabricationState.geoRaster=null;fabricationState.highResGrid=grid;fabricationState.highResRange={min:stats.min,max:stats.max};fabricationState.gridSource=`Local Arc-ASCII · ${file.name}`;fabricationState.highResSource=fabricationState.gridSource;elevationSource.value="local";
    terrainRevision++;invalidateTerrainMesh();invalidateProductionModel();fabricationStatus.textContent=`Local DEM loaded · ${grid.ncols} × ${grid.nrows} · ${stats.count.toLocaleString()} valid cells · ${Math.round(stats.min)}–${Math.round(stats.max)} m.`;update();
  }catch(error){fabricationStatus.textContent=`Local DEM failed: ${error.message}`}
});
geoTiffInput.addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  fabricationStatus.textContent=`Loading GeoTIFF ${file.name}…`;
  try{
    validateLocalFileMeta(file,{maxBytes:768*1024*1024,extensions:[".tif",".tiff"]});
    const dem=await loadGeoTiffArrayBuffer(await file.arrayBuffer(),{crsOverride:geoTiffCrs.value.trim(),fillNoData:demFillNoData.checked,smoothingRadius:Number(demSmoothRadius.value)||0,fillPasses:8});
    fabricationState.highResGrid=null;fabricationState.geoRaster=dem;fabricationState.highResRange={min:dem.stats.min,max:dem.stats.max};fabricationState.geoRasterSource=`GeoTIFF · ${file.name} · ${dem.sourceCrs}`;fabricationState.highResSource=fabricationState.geoRasterSource;elevationSource.value="geotiff";
    terrainRevision++;invalidateTerrainMesh();invalidateProductionModel();
    fabricationStatus.textContent=`GeoTIFF loaded · ${dem.width} × ${dem.height} · ${dem.sourceCrs} · ${dem.stats.count.toLocaleString()} valid cells · ${Math.round(dem.stats.min)}–${Math.round(dem.stats.max)} m · NoData ${dem.stats.noData}.`;update();
  }catch(error){fabricationStatus.textContent=`GeoTIFF failed: ${error.message}`}
});
loadHighResDem.addEventListener("click",()=>void loadHighResolutionDem());
elevationSource.addEventListener("change",()=>{if(elevationSource.value==="terrarium"){fabricationState.highResRange=null;fabricationState.highResSource="";fabricationStatus.textContent="AWS Terrarium selected."}else if(elevationSource.value==="geotiff"){if(!fabricationState.geoRaster)fabricationStatus.textContent="Choose a GeoTIFF file to activate the professional raster DEM source.";else{fabricationState.highResRange={min:fabricationState.geoRaster.stats.min,max:fabricationState.geoRaster.stats.max};fabricationState.highResSource=fabricationState.geoRasterSource;fabricationStatus.textContent=`GeoTIFF selected · ${fabricationState.geoRasterSource}`}}else if(elevationSource.value==="local"||elevationSource.value==="opentopography"){if(!fabricationState.highResGrid)fabricationStatus.textContent=elevationSource.value==="local"?"Choose a local Arc-ASCII DEM file.":"Enter the OpenTopography key and use Test & load OpenTopography DEM.";else{const stats=elevationGridStats(fabricationState.highResGrid);fabricationState.highResRange={min:stats.min,max:stats.max};fabricationState.highResSource=fabricationState.gridSource;fabricationStatus.textContent=`${fabricationState.gridSource} selected.`}}terrainRevision++;invalidateTerrainMesh();invalidateProductionModel();update()});
for(const control of [contourEnabled,contourInterval,contourRise,magnetEnabled,magnetDiameter,magnetDepth,magnetSpacing,hangingLoopEnabled,loopInnerDiameter,loopWall,bottomMark,bottomEngraveDepth,logoRise,heightmapStrength,standEnabled,tileEnabled,tileMaxWidth,tileMaxHeight,meshTargetXy,routeElevationMode,routeElevationBlend,geoTiffCrs,demFillNoData,demSmoothRadius,trailsEnabled,railwaysEnabled,buildingsEnabled,terrainColor,waterColor,routeColor,roadsColor,labelsColor,trailsColor,railwaysColor,buildingsColor]){
  control.addEventListener("input",()=>{invalidateProductionModel();update()});
  control.addEventListener("change",()=>{invalidateProductionModel();update()});
}
placeLabelMode.addEventListener("change",()=>{invalidateProductionModel();update()});
routeElevationBlend.addEventListener("input",()=>{routeElevationBlendOut.value=`${Math.round(Number(routeElevationBlend.value)*100)}%`;});
generatePrintModel.addEventListener("click",()=>void generateProductionModel());
issueAuthenticity.addEventListener("click",()=>void requestAuthenticityReceipt());
downloadAuthenticity.addEventListener("click",()=>{if(!authenticityReceipt)return;downloadProductionBytes(JSON.stringify(authenticityReceipt,null,2),`${productionModel?.stem||"vyndi-artifact"}.vyndi-auth.json`,"application/json")});
download3mf.addEventListener("click",()=>{if(!productionModel)return;downloadProductionBytes(productionModel.threeMf,`${productionModel.stem}.3mf`,"model/3mf")});
downloadStl.addEventListener("click",()=>{if(!productionModel)return;downloadProductionBytes(productionModel.stl,`${productionModel.stem}.stl`,"model/stl")});
downloadObj.addEventListener("click",()=>{if(!productionModel?.objBundle)return;downloadProductionBytes(productionModel.objBundle,`${productionModel.stem}-obj.zip`,"application/zip")});
downloadGlb.addEventListener("click",()=>{if(!productionModel?.glb)return;downloadProductionBytes(productionModel.glb,`${productionModel.stem}.glb`,"model/gltf-binary")});
downloadValidationBundle.addEventListener("click",()=>{const c=readConfig(),profile=PRINTERS[c.printer];if(!profile||profile.productionKind!=="3d"){productionStatus.textContent="Choose a 3D printer profile before generating a validation bundle.";return}downloadProductionBytes(buildValidationBundle(c,profile),`vyndi-validation-${c.printer}.zip`,"application/zip")});
downloadStandStl.addEventListener("click",()=>{if(!productionModel?.standStl)return;downloadProductionBytes(productionModel.standStl,`${productionModel.stem}-stand.stl`,"model/stl")});
downloadTilePlan.addEventListener("click",()=>{if(!productionModel?.tileBundle)return;downloadProductionBytes(productionModel.tileBundle,`${productionModel.stem}-tiled-map.zip`,"application/zip")});
$("downloadJob").addEventListener("click",()=>{const config=readConfig();config.printArea=frameBounds?{mode:printAreaMode,marginPercent:Number(printMargin.value),bounds:{...frameBounds},frameSize}:null;const job=makeJob(config,gpx);job.fabrication={shape:config.shape,shapeAspect:config.shapeAspect,contours:config.contours,magnets:config.magnets,hangingLoop:config.hangingLoop,bottomMark:config.bottomMark,bottomEngraveDepth:config.bottomEngraveDepth,logo:Boolean(fabricationState.logoMask),officialLogo:config.officialLogo,geographicOutline:config.shape==="geographic"?{geometry:selectedGeo?.geometry,source:selectedGeo?.source,osmId:selectedGeo?.osmId,osmType:selectedGeo?.osmType}:null,logoRise:config.logoRise,heightmap:Boolean(fabricationState.heightmapMask),heightmapStrength:config.heightmapStrength,standEnabled:config.standEnabled,tileEnabled:config.tileEnabled,tileMaxWidth:config.tileMaxWidth,tileMaxHeight:config.tileMaxHeight,meshTargetXy:config.meshTargetXy,elevationSource:fabricationState.highResSource||"AWS Terrarium",geoTiffCrs:config.geoTiffCrs,demFillNoData:config.demFillNoData,demSmoothRadius:config.demSmoothRadius,routeElevationMode:config.routeElevationMode,routeElevationBlend:config.routeElevationBlend,elevationDiagnostics:fabricationState.elevationDiagnostics,mapLayers:config.mapLayers,placeLabels:config.placeLabels,watermark:{asset:"assets/vayu-official.png",text:"© 2026 VYNDI RIDE STORIES",mandatory:true},colors:config.colors};if(productionModel)job.generatedModel={triangles:productionModel.triangles,vertices:productionModel.vertices,resolution:productionModel.resolution,placeLabels:productionModel.placeCount,volumetricBuildings:productionModel.volumetricBuildings,profile:productionModel.profileId,shape:productionModel.shape,elevationSource:productionModel.elevationSource,elevationDiagnostics:productionModel.elevationDiagnostics,meshTargetXy:productionModel.meshTargetXy,files:[`${productionModel.stem}.3mf`,`${productionModel.stem}.stl`,`${productionModel.stem}-obj.zip`,`${productionModel.stem}.glb`,productionModel.standStl?`${productionModel.stem}-stand.stl`:null,productionModel.tileBundle?`${productionModel.stem}-tiled-map.zip`:null].filter(Boolean)};const blob=new Blob([JSON.stringify(job,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`vyndi-terrain-medal-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)});
function loadSharedSelectedEvent(){try{const saved=JSON.parse(localStorage.getItem("vyndiSelectedEvent")||"null");if(!saved?.name)return;fields.event.value="custom";fields.eventName.value=saved.name;if(saved.editionDate)fields.eventDate.value=String(saved.editionDate).slice(0,10);if(saved.location)fields.eventLocation.value=saved.location;if(saved.distance)fields.distance.value=saved.distance;eventSource={source:saved.source||saved.provenance?.source||"Ride Stories Event Finder",sourceUrl:saved.sourceUrl||saved.provenance?.sourceUrl||""};eventWebStatus.textContent=`Loaded saved event: ${saved.name}`;update()}catch{}}
applyEvent();loadSharedSelectedEvent();void refreshAuthenticityServiceStatus();
