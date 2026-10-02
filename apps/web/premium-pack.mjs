
/* ===== Premium memory, fonts, places, geography ===== */
const RIM_FONTS = [
  {id:"expedition", label:"Expedition (default)"},
  {id:"classic", label:"Classic serif spacing"},
  {id:"condensed", label:"Condensed"},
  {id:"wide", label:"Wide tracking"},
  {id:"mono", label:"Technical mono"},
  {id:"rounded", label:"Rounded modern"}
];

const WORLD_GEO = [
  "India","Nepal","Bhutan","Sri Lanka","Bangladesh","Pakistan","China","Japan","South Korea","Mongolia",
  "Thailand","Vietnam","Indonesia","Malaysia","Philippines","Singapore","Myanmar","Cambodia","Laos",
  "Australia","New Zealand","Papua New Guinea","Fiji",
  "United States of America","Canada","Mexico","Brazil","Argentina","Chile","Peru","Colombia","Ecuador",
  "United Kingdom","Ireland","France","Germany","Spain","Portugal","Italy","Switzerland","Austria","Netherlands",
  "Belgium","Sweden","Norway","Finland","Denmark","Poland","Czechia","Hungary","Greece","Turkey",
  "Russia","Ukraine","Romania","Bulgaria","Croatia","Serbia","Slovakia","Slovenia",
  "Kenya","Tanzania","Uganda","Ethiopia","South Africa","Morocco","Egypt","Nigeria","Ghana","Rwanda",
  "United Arab Emirates","Saudi Arabia","Israel","Jordan","Iran","Iraq","Oman","Qatar",
  "Himalayas","Alps","Andes","Rocky Mountains","Pyrenees","Carpathians","Caucasus","Atlas Mountains",
  "Western Ghats","Eastern Ghats","Nilgiris","Ladakh","Kashmir","Sikkim","Himachal Pradesh","Uttarakhand",
  "Scottish Highlands","Lake District","Patagonia","Tuscany","Provence","Bavaria",
  "California","Colorado","Utah","Alaska","British Columbia","Quebec",
  "Kilimanjaro","Mount Kenya","Serengeti","Sahara","Iceland","Greenland"
];

const MEM_KEY = "vyndi-merchandise-memory-v2";

function readMerchandiseMemory(){
  try{ return JSON.parse(localStorage.getItem(MEM_KEY)||"null"); }catch(e){ return null; }
}
function writeMerchandiseMemory(extra={}){
  try{
    const prev = readMerchandiseMemory()||{};
    const payload = {
      ...prev,
      savedAt: new Date().toISOString(),
      event: $("event")?.value||"",
      rider: $("rider")?.value||"",
      date: $("date")?.value||"",
      bib: $("bib")?.value||"",
      status: $("status")?.value||"",
      shape: $("shape")?.value||"",
      modelWidth: $("modelWidth")?.value||"",
      visualPreset: $("visualPreset")?.value||"",
      rendererMode: $("rendererMode")?.value||"",
      printerProfile: $("printerProfile")?.value||"",
      rimFont: $("rimFont")?.value||"expedition",
      waterDepth: $("waterDepth")?.value||"",
      routeWidth: $("routeWidth")?.value||"",
      routeStyle: $("routeStyle")?.value||"",
      placeLabelMode: $("placeLabelMode")?.value||"",
      selectedPlaces: [...document.querySelectorAll("#placeList input:checked")].map(el=>el.value),
      qrUrl: $("qrReverseUrl")?.value||"",
      bottomMark: $("bottomMark")?.value||"",
      whiteLabel: $("whiteLabelBrand")?.value||"",
      routeTitle: state.routeTitle||prev.routeTitle||"",
      pointsCount: state.points?.length||prev.pointsCount||0,
      geoName: state.geoMeta?.name||prev.geoName||"",
      ...extra
    };
    localStorage.setItem(MEM_KEY, JSON.stringify(payload));
    if($("memStatus")) $("memStatus").textContent = "Memory saved · "+new Date().toLocaleTimeString();
    return payload;
  }catch(e){
    if($("memStatus")) $("memStatus").textContent = "Memory save failed (private mode?)";
    return null;
  }
}
function restoreMerchandiseMemory(){
  const m = readMerchandiseMemory();
  if(!m){ if($("memStatus")) $("memStatus").textContent="No saved memory yet."; return; }
  const set = (id,v)=>{ if($(id)!=null && v!=null && v!=="") $(id).value = v; };
  set("event", m.event); set("rider", m.rider); set("date", m.date); set("bib", m.bib); set("status", m.status);
  set("shape", m.shape); set("modelWidth", m.modelWidth); set("visualPreset", m.visualPreset);
  set("rendererMode", m.rendererMode); set("printerProfile", m.printerProfile); set("rimFont", m.rimFont);
  set("waterDepth", m.waterDepth); set("routeWidth", m.routeWidth); set("routeStyle", m.routeStyle);
  set("placeLabelMode", m.placeLabelMode); set("qrReverseUrl", m.qrUrl); set("bottomMark", m.bottomMark);
  set("whiteLabelBrand", m.whiteLabel);
  if(m.rimFont) applyRimFont(m.rimFont);
  if(Array.isArray(m.selectedPlaces) && m.selectedPlaces.length){
    set("placeLabelMode", "selected");
    state.pendingSelectedPlaces = m.selectedPlaces;
  }
  try{ if(typeof syncOutputs==="function") syncOutputs(); }catch(e){}
  try{ if(typeof updateWorkFlow==="function") updateWorkFlow(); }catch(e){}
  if($("memStatus")) $("memStatus").textContent = "Restored memory from "+(m.savedAt||"");
}

function applyRimFont(id){
  const font = RIM_FONTS.find(f=>f.id===id) || RIM_FONTS[0];
  if($("rimFont")) $("rimFont").value = font.id;
  state.rimFont = font.id;
  if(font.id==="condensed") state.rimTextLayout = "compact";
  else if(font.id==="wide") state.rimTextLayout = "expedition";
  else if(font.id==="mono") state.rimTextLayout = "standard";
  else state.rimTextLayout = font.id==="classic" ? "standard" : "expedition";
  if($("industryStatus")) $("industryStatus").textContent = "Rim font: "+font.label;
  try{ resetGenerated("Font style changed · regenerate for production lettering."); }catch(e){}
}

function populateGeoButtons(){
  const host = $("geoGrid");
  if(!host || host.dataset.ready) return;
  host.dataset.ready = "1";
  WORLD_GEO.forEach(name=>{
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.title = "Load boundary: "+name;
    b.addEventListener("click", ()=>{
      if(typeof applyCountryBoundary==="function") applyCountryBoundary(name);
      else {
        for(const id of ["geoSearch","geoQuery","boundarySearch","placeSearch"]){
          const el=$(id); if(el){ el.value=name; el.dispatchEvent(new Event("input",{bubbles:true})); }
        }
      }
      writeMerchandiseMemory({geoName:name});
    });
    host.appendChild(b);
  });
}

function refreshPlaceList(){
  const host = $("placeList");
  if(!host) return;
  const places = state.cartography?.places || state.places || [];
  const selected = new Set((state.pendingSelectedPlaces||[]).map(s=>String(s).toLowerCase()));
  host.querySelectorAll("input:checked").forEach(el=>selected.add(el.value.toLowerCase()));
  host.innerHTML = "";
  if(!places.length){
    host.innerHTML = "<span class='hint'>Load cartography / generate preview to list places.</span>";
    return;
  }
  const sorted = [...places].filter(p=>p?.name).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  sorted.slice(0,80).forEach(p=>{
    const lab = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.value = p.name;
    cb.checked = selected.has(String(p.name).toLowerCase());
    cb.addEventListener("change", ()=>{
      const names = [...host.querySelectorAll("input:checked")].map(el=>el.value);
      state.pendingSelectedPlaces = names;
      if(names.length) try{ setControl("placeLabelMode","selected"); }catch(e){}
      try{ if($("placeLabelMode")) $("placeLabelMode").value = names.length ? "selected" : "none"; }catch(e){}
      writeMerchandiseMemory({selectedPlaces:names});
      try{ resetGenerated("Places updated · regenerate to emboss labels."); }catch(e){}
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(" "+p.name+(p.class? " ("+p.class+")":"")));
    host.appendChild(lab);
  });
}

function wirePremiumMemoryFontsPlaces(){
  if(document.body.dataset.memFonts) return;
  document.body.dataset.memFonts = "1";
  const fontSel = $("rimFont");
  if(fontSel && !fontSel.dataset.ready){
    fontSel.dataset.ready = "1";
    fontSel.innerHTML = RIM_FONTS.map(f=>'<option value="'+f.id+'">'+f.label+'</option>').join("");
    fontSel.addEventListener("change", ()=>applyRimFont(fontSel.value));
  }
  $("saveMemoryBtn")?.addEventListener("click", ()=>writeMerchandiseMemory());
  $("restoreMemoryBtn")?.addEventListener("click", restoreMerchandiseMemory);
  $("clearMemoryBtn")?.addEventListener("click", ()=>{ localStorage.removeItem(MEM_KEY); if($("memStatus")) $("memStatus").textContent="Memory cleared."; });
  $("refreshPlacesBtn")?.addEventListener("click", refreshPlaceList);
  $("placesNoneBtn")?.addEventListener("click", ()=>{
    document.querySelectorAll("#placeList input").forEach(el=>el.checked=false);
    state.pendingSelectedPlaces = [];
    try{ setControl("placeLabelMode","none"); }catch(e){}
    writeMerchandiseMemory({selectedPlaces:[]});
  });
  $("placesMajorBtn")?.addEventListener("click", ()=>{ try{ setControl("placeLabelMode","major"); }catch(e){} writeMerchandiseMemory(); });
  populateGeoButtons();
  ["event","rider","date","shape","printerProfile","visualPreset"].forEach(id=>{
    $(id)?.addEventListener("change", ()=>writeMerchandiseMemory());
  });
  setInterval(()=>{ if(state.cartography?.places?.length) refreshPlaceList(); }, 5000);
  setTimeout(restoreMerchandiseMemory, 400);
}

wirePremiumMemoryFontsPlaces();
