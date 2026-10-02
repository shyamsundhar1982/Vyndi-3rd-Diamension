
/* ===== QR reverse, shared-terrain batch, PDF order form ===== */
function loadQrLib(){
  return new Promise((resolve,reject)=>{
    if(window.qrcode) return resolve(window.qrcode);
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
    s.onload=()=>resolve(window.qrcode);
    s.onerror=()=>reject(new Error("QR library failed to load"));
    document.head.appendChild(s);
  });
}

async function makeQrDataUrl(text, cell=4){
  const qrcode = await loadQrLib();
  const qr = qrcode(0, "M");
  qr.addData(String(text||"https://vyndi.app"));
  qr.make();
  const n = qr.getModuleCount();
  const size = n * cell;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,size,size);
  ctx.fillStyle = "#000000";
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) ctx.fillRect(c*cell, r*cell, cell, cell);
  return {dataUrl: canvas.toDataURL("image/png"), modules:n, qr};
}

function qrModulesMatrix(qr){
  const n = qr.getModuleCount();
  const rows=[];
  for(let r=0;r<n;r++){
    const row=[];
    for(let c=0;c<n;c++) row.push(qr.isDark(r,c)?1:0);
    rows.push(row);
  }
  return rows;
}

async function applyQrReverse(){
  const url = ($("qrReverseUrl")?.value || "").trim();
  if(!url){ if($("industryStatus")) $("industryStatus").textContent="Set a QR URL first."; return null; }
  const {dataUrl, qr} = await makeQrDataUrl(url, 3);
  state.qrReverse = {url, dataUrl, modules: qrModulesMatrix(qr)};
  if($("qrOnReverse")?.checked && $("bottomMark")){
    const token = "QR "+url.replace(/^https?:\/\//,"").slice(0,28).toUpperCase();
    $("bottomMark").value = token;
  }
  if($("industryStatus")) $("industryStatus").textContent="QR ready (PNG download + reverse mark).";
  return state.qrReverse;
}

function buildMinimalPdf(lines){
  const esc = (s)=>String(s).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
  const content = [];
  let y = 800;
  content.push("BT /F1 11 Tf 50 "+y+" Td ("+esc(lines[0]||"VYNDI Order Form")+") Tj");
  for(let i=1;i<lines.length;i++){
    y -= 16;
    if(y < 50) break;
    content.push("0 -16 Td ("+esc(lines[i])+") Tj");
  }
  content.push("ET");
  const stream = content.join("\n");
  const objs = [];
  objs.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objs.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objs.push("3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n");
  objs.push("4 0 obj<< /Length "+stream.length+" >>stream\n"+stream+"\nendstream\nendobj\n");
  objs.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for(const o of objs){ offsets.push(pdf.length); pdf += o; }
  const xref = pdf.length;
  pdf += "xref\n0 "+(objs.length+1)+"\n";
  pdf += "0000000000 65535 f \n";
  for(let i=1;i<offsets.length;i++) pdf += String(offsets[i]).padStart(10,"0")+" 00000 n \n";
  pdf += "trailer<< /Size "+(objs.length+1)+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF";
  return new Blob([pdf], {type:"application/pdf"});
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2500);
}

function downloadPdfOrder(){
  const p = (typeof getPrinterProfileInfo==="function") ? getPrinterProfileInfo() : {id:$("printerProfile")?.value||"bambu-p1s", recommendedLayerMm:0.16, preferredFormat:"3mf", label:"printer"};
  const foot = (typeof modelFootprintMm==="function") ? modelFootprintMm() : {w:finite($("modelWidth")?.value,180), h:finite($("modelWidth")?.value,180)};
  const lines = [
    "VYNDI 3rd Diamension - Print Order Form",
    "----------------------------------------",
    "Event: "+($("event")?.value||""),
    "Athlete: "+($("rider")?.value||""),
    "Date: "+($("date")?.value||""),
    "Bib: "+($("bib")?.value||""),
    "Status: "+($("status")?.value||""),
    "",
    "Route points: "+(state.points?.length||0),
    "Model size mm: "+foot.w+" x "+foot.h,
    "Shape: "+($("shape")?.value||""),
    "Printer: "+(p.label||p.id),
    "Suggested layer mm: "+(p.recommendedLayerMm||""),
    "Preferred export: "+(p.preferredFormat||"3mf"),
    "QR: "+($("qrReverseUrl")?.value||"(none)"),
    "Bottom mark: "+($("bottomMark")?.value||""),
    "",
    "Notes: Slice 3MF with suggested layer height.",
    "Generated: "+new Date().toISOString()
  ];
  downloadBlob(buildMinimalPdf(lines), "vyndi-order-form.pdf");
  if($("industryStatus")) $("industryStatus").textContent="PDF order form downloaded.";
}

async function runSharedTerrainBatch(){
  const file = $("batchCsv")?.files?.[0];
  const status = $("batchSharedStatus") || $("batchStatus");
  if(!file){ if(status) status.textContent="Choose CSV (name,event,date,bib)."; return; }
  if(!state.points?.length){ if(status) status.textContent="Upload GPX first (shared terrain source)."; return; }
  const text = await file.text();
  const rows = (typeof parseBatchCsv==="function") ? parseBatchCsv(text) : [];
  if(!rows.length){ if(status) status.textContent="No CSV rows found."; return; }
  const max = Math.min(rows.length, finite($("batchLimit")?.value, 15));
  if(status) status.textContent="Shared terrain ready - "+max+" personalised medals...";
  try{ if($("qrReverseUrl")?.value) await applyQrReverse(); }catch(e){}
  state.sharedTerrain = { points: state.points, geoOutline: state.geoOutline, at: Date.now() };
  const results = [];
  for(let i=0;i<max;i++){
    const row = rows[i];
    if($("event")) $("event").value = row.event || $("event").value;
    if($("rider")) $("rider").value = row.name;
    if($("date")) $("date").value = row.date || $("date").value;
    if($("bib")) $("bib").value = row.bib || "";
    if($("status") && row.status) $("status").value = row.status;
    const baseQr = ($("qrReverseUrl")?.value||"").trim();
    if(baseQr && baseQr.includes("{name}")){
      $("qrReverseUrl").value = baseQr.replace(/\{name\}/gi, encodeURIComponent(row.name));
      try{ await applyQrReverse(); }catch(e){}
      $("qrReverseUrl").value = baseQr;
    }
    if(status) status.textContent="Shared batch "+(i+1)+"/"+max+": "+row.name;
    try{
      const gen = $("generate");
      if(gen && !gen.disabled){
        gen.click();
        await new Promise((resolve)=>{
          const t0=Date.now();
          const iv=setInterval(()=>{
            if(state.generated || Date.now()-t0>180000){ clearInterval(iv); resolve(); }
          }, 350);
        });
        results.push({name:row.name, ok:!!state.generated});
        try{
          const snap = {athlete: row, sharedTerrain: true, qr: state.qrReverse?.url || null, at: new Date().toISOString()};
          downloadText(JSON.stringify(snap,null,2), "vyndi-"+String(row.name).replace(/[^\w]+/g,"-").slice(0,40)+".json", "application/json");
        }catch(e){}
      } else results.push({name:row.name, ok:false, error:"generate disabled"});
    }catch(err){
      results.push({name:row.name, ok:false, error:String(err?.message||err)});
    }
  }
  if(typeof buildOrderSheet==="function"){
    downloadText(buildOrderSheet(rows.slice(0,max), results), "vyndi-shared-batch-order.csv", "text/csv");
  }
  const pdfLines = ["VYNDI Shared-Terrain Batch Summary", "Athletes: "+max, "OK: "+results.filter(r=>r.ok).length, ""].concat(results.map(r=>r.name+" - "+(r.ok?"OK":r.error||"fail")));
  downloadBlob(buildMinimalPdf(pdfLines), "vyndi-batch-summary.pdf");
  if(status) status.textContent="Shared batch done "+results.filter(r=>r.ok).length+"/"+max+" - CSV + PDF downloaded.";
}

function wireQrBatchPdf(){
  if(document.body.dataset.qrBatchPdf) return;
  document.body.dataset.qrBatchPdf = "1";
  $("downloadPdfOrder")?.addEventListener("click", downloadPdfOrder);
  $("batchSharedRun")?.addEventListener("click", ()=>runSharedTerrainBatch().catch(e=>{
    const s=$("batchSharedStatus")||$("batchStatus");
    if(s) s.textContent=String(e?.message||e);
  }));
  $("qrReverseUrl")?.addEventListener("change", ()=>{ applyQrReverse().catch(()=>{}); });
}
wireQrBatchPdf();
