#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/app.mjs")
t = p.read_text()
if "function applyIndustryPremium" in t:
    print("app already has applyIndustryPremium")
    raise SystemExit(0)

t = t.replace(
    'setControl("forestRaise",.22);setControl("waterDepth",1.1);setControl("waveHeight",.4);setControl("waveSpacing",2.4);',
    'setControl("forestRaise",.28);setControl("waterDepth",1.2);setControl("waveHeight",.45);setControl("waveSpacing",2.4);',
    1,
)
t = t.replace(
    'setControl("routeWidth",width<=90?1.1:width<=120?1.3:1.6);setControl("routeRise",width<=90?.8:1);',
    'setControl("routeWidth",width<=90?1.2:width<=120?1.5:1.8);setControl("routeRise",width<=90?.9:1.2);',
    1,
)
t = t.replace(
    'water:"#155b8a",route:"#ff2f24",rim:"#22201f"',
    'water:"#0e4f7a",route:"#ff2f24",rim:"#1a1816"',
    1,
)

fn = r"""

/** One-click industry premium: renderer + presentation + shape + materials + fabrication */
function applyIndustryPremium(){
  setControl("rendererMode","v3d-unified");
  if($("visualPreset"))$("visualPreset").value="premium-medal";
  applyVisualPreset("premium-medal");
  if(state.geoOutline)setControl("shape","geo-medallion");
  setControl("printerProfile","bambu-p1s");
  setControl("surfaceLettering","full");
  setControl("waterMode","procedural-waves");
  setControl("waterDepth",1.2);
  setControl("waveHeight",.45);
  setControl("routeStyle","raised");
  setControl("placeLabelMode","none");
  setPalette({land:"#6f9f46",forest:"#2f6c31",mountain:"#8b5a31",snow:"#f7f7f3",water:"#0e4f7a",route:"#ff2f24",rim:"#1a1816",labels:"#f3c56a"});
  syncOutputs();
  if($("qualityBadge"))$("qualityBadge").textContent="INDUSTRY PREMIUM · READY TO GENERATE";
  if($("productionStatus"))$("productionStatus").textContent="Premium preset applied · generate print model for governed 3MF/STL.";
  try{resetGenerated("Premium preset applied · regenerate for production mesh.");}catch(e){}
  try{schedulePreview(80);}catch(e){}
  try{const waterChip=document.querySelector('.mat-chip[data-mat="water"]');if(waterChip)waterChip.click();}catch(e){}
}

function wirePremiumButtons(){
  for(const id of ["premiumPreset","premiumPresetRail"]){
    const btn=$(id);
    if(!btn||btn.dataset.wired)continue;
    btn.dataset.wired="1";
    btn.addEventListener("click",()=>{applyIndustryPremium();});
  }
}
wirePremiumButtons();
"""

t = t.rstrip() + "\n" + fn + "\n"
p.write_text(t)
print("app patched", len(t))
