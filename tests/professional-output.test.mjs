import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  planProfessionalPlaceLabels,
  professionalHangerPlacement,
  surfaceLetteringAllowed
} from "../packages/toolkit/toolkit-core.mjs";
import { filterPrintableOutlinePolygons } from "../packages/engine/map-outline-core.mjs";

const html=readFileSync(new URL("../apps/web/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");

test("small geographic medals automatically suppress top-surface personalization",()=>{
  assert.equal(surfaceLetteringAllowed({shapeKind:"geographic",modelWidthMm:76.2,mode:"auto"}),false);
  assert.equal(surfaceLetteringAllowed({shapeKind:"geographic",modelWidthMm:180,mode:"auto"}),true);
  assert.equal(surfaceLetteringAllowed({shapeKind:"geographic",modelWidthMm:76.2,mode:"full"}),true);
  assert.equal(surfaceLetteringAllowed({shapeKind:"circle",modelWidthMm:76.2,mode:"auto"}),true);
});

test("professional geographic label planning limits country-scale clutter",()=>{
  const places=[
    {name:"Delhi",class:"city",x:0,y:.2},
    {name:"Mumbai",class:"city",x:-.35,y:-.1},
    {name:"Chennai",class:"city",x:.28,y:-.35},
    {name:"Kolkata",class:"city",x:.42,y:.05},
    {name:"Bengaluru",class:"city",x:.12,y:-.28},
    {name:"Hyderabad",class:"city",x:.08,y:-.12},
    {name:"Pune",class:"town",x:-.25,y:-.05},
    {name:"Mysuru",class:"town",x:.05,y:-.38}
  ];
  const plan=planProfessionalPlaceLabels({
    places,mode:"major",selectedNames:[],maxLabels:18,shapeKind:"geographic",modelWidthMm:76.2,
    radius:38.1,insideNormalized:()=>true
  });
  assert.ok(plan.length<=4,"3-inch country medal must not carry a dense label field");
  assert.ok(plan.every(item=>item.place.class==="city"),"small geographic major mode should keep city-level hierarchy");
  assert.ok(plan.every(item=>item.cellMm>=.48),"print labels need a fabrication-aware minimum stroke");
});

test("professional outline filter removes sub-print slivers but preserves significant islands",()=>{
  const square=(x,y,s)=>[[{x,y},{x:x+s,y},{x:x+s,y:y+s},{x,y:y+s}]];
  const polygons=[
    square(-.8,-.8,1.4),
    square(.65,-.7,.12),
    square(.92,.92,.01)
  ];
  const result=filterPrintableOutlinePolygons(polygons,{radiusMm:38.1,minSpanMm:1.2,minAreaMm2:1.4});
  assert.equal(result.kept.length,2);
  assert.equal(result.removed.length,1);
});

test("geographic hanger placement anchors to the actual top outline and includes an overlap bridge",()=>{
  const polygons=[[[{x:-.7,y:-.8},{x:.65,y:-.8},{x:.25,y:.85},{x:-.1,y:.7}]]];
  const placement=professionalHangerPlacement({outlinePolygons:polygons,radiusMm:38.1,innerRadiusMm:3,wallMm:3,baseMm:3});
  assert.ok(Math.abs(placement.centerX-9.525)<1.0,"hanger should follow the top outline x position, not global x=0");
  assert.ok(placement.bridge.maxY>=placement.centerY-placement.outerRadiusMm);
  assert.ok(placement.bridge.minY<placement.anchorY);
});

test("professional viewport exposes compact camera presets and a quality status HUD",()=>{
  for(const id of ["cameraIso","cameraTop","cameraFit","qualityBadge"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/applyCameraPreset/);
  assert.match(app,/qualityBadge/);
});
