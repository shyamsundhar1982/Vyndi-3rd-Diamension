
const HELP_SECTIONS = {
start:`<h3>1. Quick start</h3>
<p>Turn a GPX into a print-ready 3D terrain medal in five steps.</p>
<ol>
<li><strong>Route</strong> - Upload GPX or Demo.</li>
<li><strong>Shape</strong> - Round, geo-medallion, plaque...</li>
<li><strong>Style</strong> - PREMIUM PRESET.</li>
<li><strong>Generate</strong> - PRODUCTION then GENERATE PRINT MODEL.</li>
<li><strong>Export</strong> - 3MF, STL, OBJ, GLB.</li>
</ol>
<p>LIVE is preview. Full relief after Generate in PRODUCTION.</p>`,
premium:`<h3>2. Premium medal</h3>
<ul><li>PREMIUM sets water, coastline, continuous route.</li>
<li>Material chips adjust one layer at a time.</li>
<li>Regenerate after shape, font, places, geography changes.</li></ul>`,
fonts:`<h3>3. Fonts and rim</h3>
<p>Real TTF families via FontFace (Oswald, Libre Baskerville, Roboto Condensed, Raleway, Share Tech Mono, Nunito). Lettering baked to heightmap for emboss. Change font then regenerate.</p>`,
places:`<h3>4. Places and geography</h3>
<ul><li>Checkbox place list - Major only / Deselect all.</li>
<li>Geography grid - countries and ranges.</li></ul>`,
coast:`<h3>5. Vector coastline emboss</h3>
<p>Boundary polyline sampled as raised ridge along land-water edge. Set strength, Apply, regenerate. Best with geographic medal shapes.</p>`,
batch:`<h3>6. Batch, shared mesh, memory</h3>
<ul><li>Merchandise memory Save/Restore in browser.</li>
<li>Shared terrain batch - one GPX, many athletes.</li>
<li>Fast regen reuses terrain fingerprint when only text changes.</li></ul>`,
print:`<h3>7. Printers and formats</h3>
<table><tr><th>Format</th><th>Use</th></tr>
<tr><td>3MF</td><td>Bambu / Orca / PrusaSlicer</td></tr>
<tr><td>STL</td><td>Any FDM resin SLS</td></tr>
<tr><td>OBJ+MTL</td><td>Blender MeshLab</td></tr>
<tr><td>GLB</td><td>Web AR</td></tr></table>
<p>Industry standard is slicer files. Printer package JSON carries nozzle, layer, bed metadata - not a vendor cloud driver.</p>`,
stories:`<h3>8. Ride Stories</h3>
<p>Second surface narrative: chapters with title, body, photo URL. Export Stories PDF for order package and QR-linked race reports.</p>`,
tools:`<h3>9. Pro tools matrix</h3>
<table><tr><th>Feature</th><th>Top tools</th><th>VYNDI</th></tr>
<tr><td>DEM to mesh</td><td>TouchTerrain</td><td>Yes</td></tr>
<tr><td>GPX route</td><td>Rare</td><td>Yes densified</td></tr>
<tr><td>Rim text TTF</td><td>Rare</td><td>Yes</td></tr>
<tr><td>Geo medal</td><td>Rare</td><td>Yes</td></tr>
<tr><td>Tiling</td><td>TouchTerrain</td><td>Tiled ZIP</td></tr>
<tr><td>Print tips</td><td>TouchTerrain</td><td>Profiles + readiness</td></tr>
<tr><td>City buildings</td><td>Map2Model</td><td>Not primary</td></tr>
<tr><td>Blender</td><td>Manual</td><td>Addon</td></tr></table>
<p>No direct Bambu/Prusa cloud login - use 3MF + package JSON.</p>`
};

function openHelp(section="start"){
  const ov = $("helpOverlay");
  if(!ov) return;
  ov.hidden = false;
  document.querySelectorAll(".help-toc button").forEach(b=>{
    b.classList.toggle("active", b.dataset.help===section);
  });
  const c = $("helpContent");
  if(c) c.innerHTML = HELP_SECTIONS[section] || HELP_SECTIONS.start;
}
function closeHelp(){ const ov=$("helpOverlay"); if(ov) ov.hidden=true; }

const TTF_CATALOG = [
  {id:"expedition", family:"Oswald", url:"https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHNAI94t0qcLNwsj4.woff2", layout:"expedition"},
  {id:"classic", family:"Libre Baskerville", url:"https://fonts.gstatic.com/s/librebaskerville/v14/kmKnZrc3Hgbbcjq75U4uslyuy4kn0qNXaxM.woff2", layout:"standard"},
  {id:"condensed", family:"Roboto Condensed", url:"https://fonts.gstatic.com/s/robotocondensed/v27/ieVl2ZhZI2eCN5jzbjEETS9weq8-19y7Dw.woff2", layout:"compact"},
  {id:"wide", family:"Raleway", url:"https://fonts.gstatic.com/s/raleway/v34/1Ptxg8zYS_SKggPN4iEgvn5P.woff2", layout:"expedition"},
  {id:"mono", family:"Share Tech Mono", url:"https://fonts.gstatic.com/s/sharetechmono/v15/J7aHnp1uDWRBEqV98dVQztYldFcLowEFA.woff2", layout:"standard"},
  {id:"rounded", family:"Nunito", url:"https://fonts.gstatic.com/s/nunito/v26/XRXI3I6Li01BKofiOc5wtlZ2.woff2", layout:"standard"}
];

async function loadRimTtf(id){
  const entry = TTF_CATALOG.find(f=>f.id===id) || TTF_CATALOG[0];
  if(document.fonts && ![...document.fonts].some(f=>f.family===entry.family)){
    try{
      const face = new FontFace(entry.family, "url("+entry.url+")", {style:"normal", weight:"400"});
      await face.load();
      document.fonts.add(face);
    }catch(e){ console.warn("Font load", entry.family, e); }
  }
  state.rimFont = entry.id;
  state.rimFontFamily = entry.family;
  state.rimTextLayout = entry.layout;
  return entry;
}

async function bakeRimTextHeightmap(text, width=1024, height=128){
  await loadRimTtf(state.rimFont||$("rimFont")?.value||"expedition");
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000"; ctx.fillRect(0,0,width,height);
  ctx.fillStyle = "#fff";
  ctx.font = "600 "+Math.floor(height*0.55)+"px \""+(state.rimFontFamily||"sans-serif")+"\"";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(text||"").slice(0,48), width/2, height/2);
  state.rimTextBake = {dataUrl: canvas.toDataURL("image/png"), text, font: state.rimFontFamily};
  return state.rimTextBake;
}

function embossCoastlineFromOutline(outline, strengthMm){
  if(!outline || !Array.isArray(outline) || outline.length<4) return null;
  const s = Math.max(0.05, Math.min(1.2, Number(strengthMm)||0.35));
  const segs = [];
  for(let i=0;i<outline.length-1;i++){
    const a=outline[i], b=outline[i+1];
    if(!a||!b) continue;
    segs.push({a,b, strength:s});
  }
  state.coastlineEmboss = {segments: segs.length, strengthMm:s, at:Date.now()};
  state.coastlineBoost = s;
  return state.coastlineEmboss;
}

function applyTrueCoastlineEmboss(){
  const outline = state.geoOutline || state.geoMeta?.outline || state.boundaryRing;
  const strength = finite($("coastStrength")?.value, 0.4);
  const r = embossCoastlineFromOutline(outline, strength);
  if($("industryStatus")){
    $("industryStatus").textContent = r
      ? ("Coastline emboss: "+r.segments+" edges @ "+r.strengthMm+" mm - regenerate")
      : "Load a country/region boundary first.";
  }
  try{ resetGenerated("Coastline emboss updated."); }catch(e){}
  return r;
}

function terrainFingerprint(){
  return JSON.stringify({
    n: state.points?.length||0,
    shape: $("shape")?.value,
    w: $("modelWidth")?.value,
    geo: state.geoMeta?.name||"",
    water: $("waterDepth")?.value,
    routeW: $("routeWidth")?.value,
    visual: $("visualPreset")?.value
  });
}
function personalizationFingerprint(){
  return JSON.stringify({
    event:$("event")?.value, rider:$("rider")?.value, date:$("date")?.value,
    bib:$("bib")?.value, font:state.rimFont, bottom:$("bottomMark")?.value,
    places: state.pendingSelectedPlaces||[]
  });
}

async function generateWithSharedMesh(){
  const tf = terrainFingerprint();
  const pf = personalizationFingerprint();
  const canReuse = state.sharedBase && state.sharedBase.tf===tf && state.generated;
  if(canReuse && state.sharedBase.pf!==pf){
    if($("industryStatus")) $("industryStatus").textContent="Text-only regen (shared terrain mesh)...";
    state.textOnlyRegen = true;
    await bakeRimTextHeightmap([$("event")?.value,$("rider")?.value,$("date")?.value].filter(Boolean).join(" · "));
  } else {
    state.textOnlyRegen = false;
  }
  const gen = $("generate");
  if(gen && !gen.disabled) gen.click();
  const watch = setInterval(()=>{
    if(state.generated){
      clearInterval(watch);
      state.sharedBase = { tf, pf: personalizationFingerprint(), at: Date.now() };
      if($("industryStatus") && state.textOnlyRegen) $("industryStatus").textContent="Shared mesh path used · lettering refreshed.";
    }
  }, 400);
  setTimeout(()=>clearInterval(watch), 120000);
}

function ensureStories(){
  if(!Array.isArray(state.rideStories)) state.rideStories = [];
  return state.rideStories;
}
function renderStories(){
  const host = $("storiesList");
  if(!host) return;
  const stories = ensureStories();
  host.innerHTML = "";
  stories.forEach((s,i)=>{
    const div = document.createElement("div");
    div.className = "story-card";
    div.innerHTML = "<strong>Chapter "+(i+1)+"</strong>";
    const t = document.createElement("input"); t.placeholder="Title"; t.value=s.title||"";
    t.addEventListener("change",()=>{ s.title=t.value; });
    const b = document.createElement("textarea"); b.rows=2; b.placeholder="Story body"; b.value=s.body||"";
    b.addEventListener("change",()=>{ s.body=b.value; });
    const p = document.createElement("input"); p.placeholder="Photo URL (optional)"; p.value=s.photo||"";
    p.addEventListener("change",()=>{ s.photo=p.value; });
    const rm = document.createElement("button"); rm.type="button"; rm.textContent="Remove";
    rm.addEventListener("click",()=>{ state.rideStories.splice(i,1); renderStories(); });
    div.appendChild(t); div.appendChild(b); div.appendChild(p); div.appendChild(rm);
    host.appendChild(div);
  });
}
function addStoryChapter(){
  ensureStories().push({title:"", body:"", photo:""});
  renderStories();
}
function exportStoriesPdf(){
  const stories = ensureStories();
  const lines = ["VYNDI Ride Stories", "Event: "+($("event")?.value||""), "Athlete: "+($("rider")?.value||""), ""];
  stories.forEach((s,i)=>{
    lines.push("Chapter "+(i+1)+": "+(s.title||"(untitled)"));
    lines.push(s.body||"");
    if(s.photo) lines.push("Photo: "+s.photo);
    lines.push("");
  });
  if(typeof buildMinimalPdf==="function"){
    downloadBlob(buildMinimalPdf(lines), "vyndi-ride-stories.pdf");
  } else if(typeof downloadText==="function"){
    downloadText(lines.join("\n"), "vyndi-ride-stories.txt", "text/plain");
  }
}

function exportPrinterPackage(){
  const p = (typeof getPrinterProfileInfo==="function") ? getPrinterProfileInfo() : {id:$("printerProfile")?.value};
  const foot = (typeof modelFootprintMm==="function") ? modelFootprintMm() : {};
  const pkg = {
    schema: "vyndi-printer-package-v1",
    note: "Import mesh in slicer. JSON is hand-off metadata - not a vendor cloud driver.",
    preferredFormat: p.preferredFormat||"3mf",
    printer: p,
    footprintMm: foot,
    suggested: {
      layerHeightMm: p.recommendedLayerMm||0.16,
      nozzleMm: p.nozzleMm||0.4,
      bedMm: p.bedMm||[256,256]
    },
    athlete: {name:$("rider")?.value, event:$("event")?.value, date:$("date")?.value},
    qr: $("qrReverseUrl")?.value||null,
    stories: ensureStories(),
    at: new Date().toISOString()
  };
  if(typeof downloadText==="function") downloadText(JSON.stringify(pkg,null,2), "vyndi-printer-package.json", "application/json");
  if($("industryStatus")) $("industryStatus").textContent="Printer package JSON downloaded (slicer hand-off).";
}

function wireAdvancedFeatures(){
  if(document.body.dataset.advFeat) return;
  document.body.dataset.advFeat = "1";
  $("helpOpenBtn")?.addEventListener("click", ()=>openHelp("start"));
  $("helpClose")?.addEventListener("click", closeHelp);
  document.querySelectorAll(".help-toc button").forEach(b=>{
    b.addEventListener("click", ()=>openHelp(b.dataset.help));
  });
  $("helpOverlay")?.addEventListener("click", (e)=>{ if(e.target.id==="helpOverlay") closeHelp(); });
  const fontSel = $("rimFont");
  if(fontSel){
    fontSel.addEventListener("change", async ()=>{
      await loadRimTtf(fontSel.value);
      await bakeRimTextHeightmap([$("event")?.value,$("rider")?.value].filter(Boolean).join(" · "));
      try{ if(typeof applyRimFont==="function") applyRimFont(fontSel.value); }catch(e){}
    });
  }
  $("applyCoastBtn")?.addEventListener("click", applyTrueCoastlineEmboss);
  $("textOnlyRegenBtn")?.addEventListener("click", ()=>generateWithSharedMesh().catch(e=>alert(e.message||e)));
  $("addStoryBtn")?.addEventListener("click", addStoryChapter);
  $("exportStoriesBtn")?.addEventListener("click", exportStoriesPdf);
  $("printerPackageBtn")?.addEventListener("click", exportPrinterPackage);
  renderStories();
}
wireAdvancedFeatures();
