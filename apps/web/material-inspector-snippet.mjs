/* —— Material inspector: top chips drive related settings —— */
(function materialInspector(){
  const $=id=>document.getElementById(id);
  const finite=(v,f=0)=>{const n=Number(v);return Number.isFinite(n)?n:f};
  const chips=[...document.querySelectorAll(".mat-chip")];
  const title=$("matInspectorTitle"), hint=$("matInspectorHint"), body=$("matInspectorBody");
  if(!chips.length||!body)return;

  const panels={
    land:{
      title:"Land", hint:"Base terrain colour · overall relief strength",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="land" type="color"></label>
        <label class="stack">Relief <output id="miReliefOut"></output><input id="miRelief" type="range" min="1" max="30" step=".5"></label>
        <label class="stack">Grid detail <output id="miXyOut"></output><input id="miXy" type="range" min=".25" max="3" step=".05"></label>`
    },
    forest:{
      title:"Forest", hint:"Woodland colour · raised canopy height on the medal",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="forest" type="color"></label>
        <label class="stack">Forest raise <output id="miForestOut"></output><input id="miForest" type="range" min="0" max="2" step=".1"></label>`
    },
    mountain:{
      title:"Mountain", hint:"Rock band starts above this elevation",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="mountain" type="color"></label>
        <label class="stack">Mountain from <output id="miMtnOut"></output><input id="miMtn" type="range" min="100" max="3500" step="50"></label>`
    },
    snow:{
      title:"Snow", hint:"Snow cap starts above this elevation",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="snow" type="color"></label>
        <label class="stack">Snow line <output id="miSnowOut"></output><input id="miSnow" type="range" min="500" max="6000" step="50"></label>`
    },
    water:{
      title:"Water", hint:"Seas & lakes · depth and waves (premium medals)",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="water" type="color"></label>
        <label class="stack">Depth <output id="miWaterOut"></output><input id="miWater" type="range" min="0" max="3" step=".1"></label>
        <label class="stack">Wave height<input id="miWaveH" type="number" min="0" max="1.5" step=".05"></label>
        <label class="stack">Surface<select id="miWaterMode"><option value="procedural-waves">Waves</option><option value="flat">Flat</option><option value="none">Off</option></select></label>`
    },
    route:{
      title:"Route", hint:"Your GPX path on the landscape",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="route" type="color"></label>
        <label class="stack">Style<select id="miRouteStyle"><option value="raised">Raised</option><option value="engraved">Engraved</option><option value="inlay">Inlay</option><option value="color">Colour only</option><option value="none">None</option></select></label>
        <label class="stack">Width <output id="miRwOut"></output><input id="miRw" type="range" min=".3" max="6" step=".1"></label>
        <label class="stack">Height <output id="miRrOut"></output><input id="miRr" type="range" min=".1" max="3" step=".1"></label>`
    },
    rim:{
      title:"Rim", hint:"Medal border · width, height, lettering colour",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="rim" type="color"></label>
        <label class="stack">Width mm<input id="miRimW" type="number" min="0" max="40" step=".5"></label>
        <label class="stack">Height mm<input id="miRimH" type="number" min="0" max="20" step=".5"></label>`
    },
    labels:{
      title:"Labels", hint:"City / place names on the production mesh",
      html:`<label class="stack">Colour<input class="mat-swatch" data-palette="labels" type="color"></label>
        <label class="stack">Places<select id="miLabels"><option value="none">None · premium</option><option value="major">Major only</option><option value="all">All (limited)</option></select></label>`
    }
  };

  function syncFromMain(){
    const map=[
      ["miRelief","relief"],["miXy","xyDetail"],["miForest","forestRaise"],["miMtn","mountainM"],["miSnow","snowM"],
      ["miWater","waterDepth"],["miWaveH","waveHeight"],["miWaterMode","waterMode"],
      ["miRouteStyle","routeStyle"],["miRw","routeWidth"],["miRr","routeRise"],
      ["miRimW","rimWidthMm"],["miRimH","rimHeightMm"],["miLabels","placeLabelMode"]
    ];
    for(const [a,b] of map){
      const src=$(b), dst=$(a);
      if(src&&dst)dst.value=src.type==="checkbox"?src.checked:src.value;
    }
    if($("miReliefOut")&&$("relief"))$("miReliefOut").value=finite($("relief").value).toFixed(1)+" mm";
    if($("miXyOut")&&$("xyDetail"))$("miXyOut").value=finite($("xyDetail").value).toFixed(2)+" mm";
    if($("miForestOut")&&$("forestRaise"))$("miForestOut").value=finite($("forestRaise").value).toFixed(1)+" mm";
    if($("miMtnOut")&&$("mountainM"))$("miMtnOut").value=$("mountainM").value+" m";
    if($("miSnowOut")&&$("snowM"))$("miSnowOut").value=$("snowM").value+" m";
    if($("miWaterOut")&&$("waterDepth"))$("miWaterOut").value=finite($("waterDepth").value).toFixed(1)+" mm";
    if($("miRwOut")&&$("routeWidth"))$("miRwOut").value=finite($("routeWidth").value).toFixed(1)+" mm";
    if($("miRrOut")&&$("routeRise"))$("miRrOut").value=finite($("routeRise").value).toFixed(1)+" mm";
    body.querySelectorAll("[data-palette]").forEach(el=>{
      const main=document.querySelector('.mat-chip [data-palette="'+el.dataset.palette+'"]')||document.querySelector('[data-palette="'+el.dataset.palette+'"]');
      if(main)el.value=main.value;
    });
  }

  function wireToMain(){
    const bind=(a,b,ev="input")=>{
      const src=$(a), dst=$(b);
      if(!src||!dst)return;
      src.addEventListener(ev,()=>{
        dst.value=src.value;
        dst.dispatchEvent(new Event("input",{bubbles:true}));
        dst.dispatchEvent(new Event("change",{bubbles:true}));
        syncFromMain();
      });
    };
    bind("miRelief","relief");bind("miXy","xyDetail");bind("miForest","forestRaise");
    bind("miMtn","mountainM");bind("miSnow","snowM");bind("miWater","waterDepth");
    bind("miWaveH","waveHeight");bind("miWaterMode","waterMode","change");
    bind("miRouteStyle","routeStyle","change");bind("miRw","routeWidth");bind("miRr","routeRise");
    bind("miRimW","rimWidthMm");bind("miRimH","rimHeightMm");bind("miLabels","placeLabelMode","change");
    body.querySelectorAll("[data-palette]").forEach(el=>{
      el.addEventListener("input",()=>{
        document.querySelectorAll('[data-palette="'+el.dataset.palette+'"]').forEach(n=>{if(n!==el)n.value=el.value;});
        try{readPalette();schedulePreview(120);resetGenerated("Material colour changed · regenerate for production.");}catch(e){}
      });
    });
  }

  function selectMat(id){
    const spec=panels[id]||panels.land;
    chips.forEach(c=>c.classList.toggle("active",c.dataset.mat===id));
    title.textContent=spec.title;
    hint.textContent=spec.hint;
    body.innerHTML=spec.html;
    syncFromMain();
    wireToMain();
  }

  chips.forEach(chip=>{
    chip.addEventListener("click",e=>{
      if(e.target && e.target.matches("input[type=color]"))return;
      selectMat(chip.dataset.mat);
    });
    const color=chip.querySelector("input[type=color]");
    if(color)color.addEventListener("input",()=>{
      document.querySelectorAll('[data-palette="'+color.dataset.palette+'"]').forEach(n=>{if(n!==color)n.value=color.value;});
      try{readPalette();schedulePreview(120);resetGenerated("Material colour changed · regenerate for production.");}catch(e){}
      if(chip.classList.contains("active"))syncFromMain();
    });
  });

  selectMat("land");
})();
