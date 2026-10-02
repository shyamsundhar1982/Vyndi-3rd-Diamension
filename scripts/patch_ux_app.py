#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/app.mjs")
t = p.read_text()
if "function updateWorkFlow" in t:
    print("workflow helpers already present")
    raise SystemExit(0)
snippet = r"""

function updateWorkFlow(){
  const hasRoute = !!(state.points && state.points.length > 1);
  const hasShape = !!($("shape")?.value);
  const hasPremium = ($("visualPreset")?.value === "premium-medal") || document.body.dataset.premiumApplied === "1";
  const hasGen = !!state.generated;
  document.querySelectorAll(".work-flow .step").forEach(el=>{
    const n = Number(el.dataset.flow);
    el.classList.toggle("done", (n===1&&hasRoute)||(n===2&&hasRoute&&hasShape)||(n===3&&hasPremium)||(n===4&&hasGen)||(n===5&&hasGen));
    let active = 1;
    if(hasGen) active = 5;
    else if(hasPremium) active = 4;
    else if(hasRoute && hasShape) active = 3;
    else if(hasRoute) active = 2;
    el.classList.toggle("active", n === active);
  });
  const hint = $("prodHint");
  if(hint){
    if(!hasRoute) hint.innerHTML = "<strong>Start:</strong> Upload GPX or press DEMO.";
    else if(!hasGen) hint.innerHTML = "<strong>Next:</strong> Premium (optional) then GENERATE PRINT MODEL, then export 3MF.";
    else hint.innerHTML = "<strong>Ready:</strong> Download 3MF/STL. Check Print readiness before slicing.";
  }
}
try{
  const _prevPremium = applyIndustryPremium;
  applyIndustryPremium = function(){
    document.body.dataset.premiumApplied = "1";
    _prevPremium();
    updateWorkFlow();
  };
}catch(e){}
["gpxInput","demoRoute","shape","visualPreset","generate"].forEach(id=>{
  const el=$(id);
  if(!el) return;
  el.addEventListener("change", ()=>setTimeout(updateWorkFlow, 50));
  el.addEventListener("click", ()=>setTimeout(updateWorkFlow, 200));
});
setInterval(updateWorkFlow, 2500);
updateWorkFlow();
"""
t = t.rstrip() + "\n" + snippet + "\n"
p.write_text(t)
print("app UX flow helpers appended", len(t))
