#!/usr/bin/env python3
"""Generate apps/web/industry-studio.mjs in CI (full industry features)."""
from pathlib import Path
js = r"""
/* ========== INDUSTRY STUDIO: readiness, batch, design, data, ops, UX ========== */

function getPrinterProfileInfo(){
  const id = $("printerProfile")?.value || "bambu-p1s";
  const profiles = (typeof PRINTER_PROFILES !== "undefined" && PRINTER_PROFILES) ? PRINTER_PROFILES : {
    "bambu-p1s":{label:"Bambu Lab P1S / AMS",technology:"FDM",nozzleMm:.4,minFeatureMm:.8,minEmbossMm:.3,recommendedLayerMm:.16,bed:[256,256,256],slicers:["Bambu Studio","OrcaSlicer"],preferredFormat:"3mf"},
    "generic-fdm":{label:"Generic FDM",technology:"FDM",nozzleMm:.4,minFeatureMm:.8,minEmbossMm:.3,recommendedLayerMm:.2,bed:[220,220,250],slicers:["PrusaSlicer","Cura"],preferredFormat:"3mf"},
    "fine-fdm":{label:"Fine FDM 0.25",technology:"FDM",nozzleMm:.25,minFeatureMm:.5,minEmbossMm:.2,recommendedLayerMm:.12,bed:[180,180,180],slicers:["OrcaSlicer"],preferredFormat:"3mf"},
    "resin":{label:"MSLA resin",technology:"MSLA",nozzleMm:.25,minFeatureMm:.35,minEmbossMm:.18,recommendedLayerMm:.05,bed:[130,80,160],slicers:["Lychee","Chitubox"],preferredFormat:"stl"},
    "sls":{label:"SLS / MJF",technology:"SLS",nozzleMm:.4,minFeatureMm:.6,minEmbossMm:.25,recommendedLayerMm:.1,bed:[250,250,250],slicers:["Service bureau"],preferredFormat:"stl"}
  };
  return {id, ...(profiles[id]||profiles["bambu-p1s"])};
}

function modelFootprintMm(){
  const w = finite($("modelWidth")?.value, 180);
  const shape = $("shape")?.value || "circle";
  const aspect = finite($("shapeAspect")?.value, 1.35);
  if(shape === "route-fit" || shape === "ellipse") return {w, h: w/Math.max(.5,aspect)};
  return {w, h: w};
}

function updatePrintReadiness(){
  const el = $("printReadiness");
  if(!el) return;
  const p = getPrinterProfileInfo();
  const foot = modelFootprintMm();
  const bed = p.bed || [220,220,250];
  const fitsXY = foot.w <= bed[0] && foot.h <= bed[1];
  const rim = finite($("rimWidthMm")?.value, 12);
  const routeW = finite($("routeWidth")?.value, 1.6);
  const minF = p.minFeatureMm || .8;
  const warnings = [];
  if(!fitsXY) warnings.push("Model larger than bed ("+bed[0]+"x"+bed[1]+" mm) — enable tiling or reduce size.");
  if(routeW < minF) warnings.push("Route width below printer min feature ("+minF+" mm).");
  if(rim < minF*2) warnings.push("Rim may be thin for "+p.technology+".");
  if(state.generated?.validation && state.generated.validation.watertight === false)
    warnings.push("Mesh not watertight — re-generate before printing.");
  const ok = warnings.length === 0;
  el.innerHTML = '<div class="ready-row '+(ok?"ok":"warn")+'">'+(ok?"Print-ready for "+p.label:"Check before slicing")+'</div><ul class="ready-list"><li>Technology: <strong>'+p.technology+'</strong> · nozzle '+p.nozzleMm+' mm</li><li>Suggested layer: <strong>'+p.recommendedLayerMm+' mm</strong></li><li>Bed: '+bed[0]+'×'+bed[1]+' mm · model ~'+foot.w.toFixed(0)+'×'+foot.h.toFixed(0)+' mm · <strong>'+(fitsXY?"FITS":"OVERSIZE")+'</strong></li><li>Preferred export: <strong>'+(p.preferredFormat||"3mf").toUpperCase()+'</strong> · '+(p.slicers||[]).join(", ")+'</li><li>Min feature / emboss: '+minF+' / '+(p.minEmbossMm||.3)+' mm</li>'+warnings.map(w=>"<li class='warn-item'>"+w+"</li>").join("")+"</ul>";
}

function parseBatchCsv(text){
  const lines = String(text||"").trim().split(/\r?\n/).filter(Boolean);
  if(lines.length < 2) return [];
  const split = (row)=>{
    const out=[]; let cur="", q=false;
    for(let i=0;i<row.length;i++){
      const c=row[i];
      if(c=='"'){q=!q;continue;}
      if(c===','&&!q){out.push(cur.trim());cur="";continue;}
      cur+=c;
    }
    out.push(cur.trim()); return out;
  };
  const headers = split(lines[0]).map(h=>h.toLowerCase());
  const idx = (names)=>{ for(const n of names){ const i=headers.indexOf(n); if(i>=0) return i; } return -1; };
  const iName = idx(["name","rider","athlete","participant"]);
  const iEvent = idx(["event","race","title"]);
  const iDate = idx(["date","when"]);
  const iBib = idx(["bib","number","no"]);
  const iStatus = idx(["status","result"]);
  const rows=[];
  for(let r=1;r<lines.length;r++){
    const cols=split(lines[r]);
    if(!cols.length) continue;
    const name = iName>=0?cols[iName]:cols[0];
    if(!name) continue;
    rows.push({name, event: iEvent>=0?cols[iEvent]:($("event")?.value||""), date: iDate>=0?cols[iDate]:($("date")?.value||""), bib: iBib>=0?cols[iBib]:"", status: iStatus>=0?cols[iStatus]:""});
  }
  return rows;
}

function buildOrderSheet(rows, results=[]){
  const p = getPrinterProfileInfo();
  const foot = modelFootprintMm();
  const lines = ["name,event,date,bib,status,model_mm,printer,layer_mm,export,result"];
  rows.forEach((row,i)=>{
    const res = results[i]||{};
    lines.push([row.name,row.event,row.date,row.bib,row.status,foot.w+"x"+foot.h,p.id,p.recommendedLayerMm,p.preferredFormat,res.ok?"ok":(res.error||"pending")].map(c=>'"'+String(c??"").replace(/"/g,'""')+'"').join(","));
  });
  return lines.join("\n");
}

function downloadText(text, filename, mime="text/plain"){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

async function runBatchCsv(){
  const file = $("batchCsv")?.files?.[0];
  const status = $("batchStatus");
  if(!file){ if(status) status.textContent="Choose a CSV first (name,event,date,bib)."; return; }
  if(!state.points?.length){ if(status) status.textContent="Upload a GPX route before batch."; return; }
  const text = await file.text();
  const rows = parseBatchCsv(text);
  if(!rows.length){ if(status) status.textContent="No rows found. Need header + name column."; return; }
  const max = Math.min(rows.length, finite($("batchLimit")?.value, 25));
  if(status) status.textContent="Batch: "+rows.length+" athletes · running "+max+"…";
  const results=[];
  for(let i=0;i<max;i++){
    const row=rows[i];
    if($("event")) $("event").value = row.event || $("event").value;
    if($("rider")) $("rider").value = row.name;
    if($("date")) $("date").value = row.date || $("date").value;
    if($("bib")) $("bib").value = row.bib || "";
    if($("status") && row.status) $("status").value = row.status;
    if(status) status.textContent="Batch "+(i+1)+"/"+max+": "+row.name+" · generating…";
    try{
      const gen = $("generate");
      if(gen && !gen.disabled){
        gen.click();
        await new Promise((resolve)=>{
          const t0=Date.now();
          const iv=setInterval(()=>{ if(state.generated?.artifacts || state.generated?.glb || Date.now()-t0>180000){ clearInterval(iv); resolve(); } }, 400);
        });
        results.push({name:row.name, ok:!!state.generated});
      } else results.push({name:row.name, ok:false, error:"generate disabled"});
    }catch(err){ results.push({name:row.name, ok:false, error:String(err?.message||err)}); }
  }
  downloadText(buildOrderSheet(rows.slice(0,max), results), "vyndi-batch-order-sheet.csv", "text/csv");
  if(status) status.textContent="Batch done "+results.filter(r=>r.ok).length+"/"+max+" · order sheet downloaded.";
}

function downloadOrderSheet(){
  const row = {name:$("rider")?.value||"", event:$("event")?.value||"", date:$("date")?.value||"", bib:$("bib")?.value||"", status:$("status")?.value||""};
  downloadText(buildOrderSheet([row], [{ok:!!state.generated}]), "vyndi-order-sheet.csv", "text/csv");
  downloadText(JSON.stringify({product:"VYNDI 3rd Diamension terrain medal", premium:true, athlete:row, footprint_mm:modelFootprintMm(), printer:getPrinterProfileInfo(), generated:!!state.generated, authenticity:state.authenticity||null, route:{points:state.points?.length||0, title:state.routeTitle||""}}, null, 2), "vyndi-order-sheet.json", "application/json");
  if($("industryStatus")) $("industryStatus").textContent="Order sheet CSV + JSON downloaded.";
}

function applyFinishPreset(kind){
  if(kind==="resin"){ setControl("printerProfile","resin"); setControl("xyDetail",.55); setControl("routeWidth",1.0); setControl("waterDepth",.9); }
  else if(kind==="fdm-draft"){ setControl("printerProfile","generic-fdm"); setControl("xyDetail",1.2); setControl("routeWidth",1.8); }
  else if(kind==="ams"){ setControl("printerProfile","bambu-p1s"); setControl("xyDetail",1); setControl("routeWidth",1.6); }
  else if(kind==="fine-fdm"){ setControl("printerProfile","fine-fdm"); setControl("xyDetail",.7); setControl("routeWidth",1.2); }
  updatePrintReadiness();
  try{resetGenerated("Finish preset changed · regenerate.");}catch(e){}
  if($("industryStatus")) $("industryStatus").textContent="Finish preset: "+kind;
}

function applyCountryBoundary(q){
  for(const id of ["geoSearch","geoQuery","boundarySearch","placeSearch"]){
    const el=$(id);
    if(el){ el.value=q; el.dispatchEvent(new Event("input",{bubbles:true})); el.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true})); }
  }
  const searchBtn = $("searchGeo") || $("geoLookup") || $("geoSearchBtn");
  if(searchBtn) searchBtn.click();
  if($("industryStatus")) $("industryStatus").textContent="Boundary: "+q+" · confirm in Plate geo search if needed.";
}

function enableCoastlinePremium(){
  setControl("waterDepth",1.25); setControl("waterMode","procedural-waves"); setControl("waveHeight",.5);
  setControl("contourEnabled",true); setControl("placeLabelMode","none");
  if(state.geoOutline) setControl("shape","geo-medallion");
  try{resetGenerated("Coastline premium · regenerate.");}catch(e){}
  if($("industryStatus")) $("industryStatus").textContent="Coastline mode: deeper sea, contours on, geo-medallion.";
}

function setWizardStep(n){
  document.querySelectorAll("[data-wiz-panel]").forEach(el=>{ el.hidden = Number(el.dataset.wizPanel)!==n; });
  const fill = $("wizProgressFill");
  if(fill) fill.style.width = ((n/5)*100)+"%";
}

function wireIndustryStudio(){
  if(document.body.dataset.industryWired) return;
  document.body.dataset.industryWired="1";
  $("batchRun")?.addEventListener("click", ()=>runBatchCsv().catch(e=>{ if($("batchStatus")) $("batchStatus").textContent=String(e?.message||e); }));
  $("orderSheetBtn")?.addEventListener("click", downloadOrderSheet);
  $("coastlinePremiumBtn")?.addEventListener("click", enableCoastlinePremium);
  $("refreshReadiness")?.addEventListener("click", updatePrintReadiness);
  document.querySelectorAll("[data-finish]").forEach(btn=>btn.addEventListener("click", ()=>applyFinishPreset(btn.dataset.finish)));
  document.querySelectorAll("[data-country]").forEach(btn=>btn.addEventListener("click", ()=>applyCountryBoundary(btn.dataset.country)));
  document.querySelectorAll("[data-wiz-go]").forEach(btn=>btn.addEventListener("click", ()=>setWizardStep(Number(btn.dataset.wizGo))));
  $("wizStart")?.addEventListener("click", ()=>{ if($("wizardOverlay")) $("wizardOverlay").hidden=false; setWizardStep(1); });
  $("wizClose")?.addEventListener("click", ()=>{ if($("wizardOverlay")) $("wizardOverlay").hidden=true; });
  $("wizClose2")?.addEventListener("click", ()=>{ if($("wizardOverlay")) $("wizardOverlay").hidden=true; });
  $("enableMagnetQuick")?.addEventListener("click", ()=>{ setControl("magnetEnabled", true); if($("industryStatus")) $("industryStatus").textContent="Magnet pocket enabled."; });
  $("enableStandQuick")?.addEventListener("click", ()=>{ setControl("standEnabled", true); if($("industryStatus")) $("industryStatus").textContent="Display stand enabled."; });
  $("applyWhiteLabel")?.addEventListener("click", ()=>{
    const brand = $("whiteLabelBrand")?.value||"";
    if(brand && $("bottomMark")) $("bottomMark").value = brand;
    if($("industryStatus")) $("industryStatus").textContent="White-label mark set on reverse.";
  });
  ["printerProfile","modelWidth","shape","routeWidth","rimWidthMm"].forEach(id=>{
    $(id)?.addEventListener("change", updatePrintReadiness);
    $(id)?.addEventListener("input", updatePrintReadiness);
  });
  updatePrintReadiness();
  setInterval(updatePrintReadiness, 4000);
}

wireIndustryStudio();
"""
Path("apps/web/industry-studio.mjs").write_text(js)
print("wrote industry-studio.mjs", len(js))
