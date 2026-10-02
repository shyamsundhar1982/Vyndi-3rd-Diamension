import test from "node:test";
import assert from "node:assert/strict";
import { productionMaterials, classifyTerrainMaterial, buildPersonalizationMeshes, generateProductionModel } from "../packages/toolkit/toolkit-core.mjs";
import { encodeGlb } from "../packages/engine/print-model-core.mjs";

function glbJson(bytes){
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const dv=new DataView(view.buffer,view.byteOffset,view.byteLength);
  assert.equal(dv.getUint32(0,true),0x46546c67);
  const jsonLen=dv.getUint32(12,true);
  return JSON.parse(new TextDecoder().decode(view.slice(20,20+jsonLen)).trim());
}

test("production palette carries terrain classes and fabrication overlays",()=>{
  const materials=productionMaterials({colors:{
    land:"#aa9966",forest:"#228833",mountain:"#775522",snow:"#ffffff",water:"#2288aa",
    route:"#ff5500",roads:"#bbbbbb",trails:"#55aa55",railways:"#777777",buildings:"#dddddd",
    logo:"#ffee33",text:"#ffee33"
  }});
  assert.deepEqual(materials.map(m=>m.name),[
    "Land","Forest","Mountain","Snow","Water","Route","Roads","Trails","Railways","Buildings","Logo","Text"
  ]);
  assert.equal(materials[1].color,"#228833FF");
  assert.equal(materials[4].color,"#2288aaFF");
  assert.equal(materials[5].emissive,"#ff5500FF");
});

test("terrain material precedence is water then forest then elevation bands",()=>{
  const water=[{kind:"water",paths:[[
    {lat:10,lon:10},{lat:10,lon:11},{lat:11,lon:11},{lat:11,lon:10},{lat:10,lon:10}
  ]]}];
  const forest=[{kind:"forest",paths:[[
    {lat:20,lon:20},{lat:20,lon:21},{lat:21,lon:21},{lat:21,lon:20},{lat:20,lon:20}
  ]]}];
  assert.equal(classifyTerrainMaterial({lat:10.5,lon:10.5,elevation:3000},{mountainM:1200,snowM:2600},water),4);
  assert.equal(classifyTerrainMaterial({lat:20.5,lon:20.5,elevation:3000},{mountainM:1200,snowM:2600},forest),1);
  assert.equal(classifyTerrainMaterial({lat:30,lon:30,elevation:3000},{mountainM:1200,snowM:2600},[]),3);
  assert.equal(classifyTerrainMaterial({lat:30,lon:30,elevation:1600},{mountainM:1200,snowM:2600},[]),2);
  assert.equal(classifyTerrainMaterial({lat:30,lon:30,elevation:300},{mountainM:1200,snowM:2600},[]),0);
});

test("GLB converts Z-up production geometry to model-viewer Y-up and preserves emissive route material",()=>{
  const mesh={
    vertices:[{x:0,y:0,z:0},{x:10,y:0,z:0},{x:0,y:10,z:2}],
    triangles:[{a:0,b:1,c:2,region:1}]
  };
  const glb=encodeGlb(mesh,{title:"Visual parity",materials:[
    {name:"Land",color:"#998866FF"},
    {name:"Route",color:"#FF5500FF",emissive:"#FF5500FF"}
  ]});
  const json=glbJson(glb);
  assert.deepEqual(json.nodes[0].rotation.map(v=>Number(v.toFixed(6))),[-0.707107,0,0,0.707107]);
  assert.deepEqual(json.materials[1].emissiveFactor.map(v=>Number(v.toFixed(3))),[0.35,0.117,0]);
});


test("physical model retains rider date and ride statistics",()=>{
  const meshes=buildPersonalizationMeshes({
    customization:{
      event:"Parvatha 600",
      rider:"Shyam",
      date:"09 Nov 2024",
      distance:"609 KM",
      elevation:"9,274 M",
      duration:"39:36:19"
    },
    extents:{minX:-50,maxX:50,minY:-50,maxY:50},
    radius:50,
    terrainTopMm:()=>5,
    insideNormalized:(x,y)=>Math.hypot(x,y)<=1,
    riseMm:.8
  });
  assert.ok(meshes.length>20,"expected printable event/rider/stat geometry");
  assert.ok(meshes.every(mesh=>mesh.triangles.some(t=>t.region===11)));
});


test("generated production object contains terrain bands, route and text material regions",async()=>{
  const points=[
    {lat:0.10,lon:0.10,ele:300,time:0},
    {lat:0.50,lon:0.50,ele:1500,time:600000},
    {lat:0.90,lon:0.90,ele:2900,time:1200000}
  ];
  const model=await generateProductionModel({
    points,
    demSampler:(lat)=>lat*3200,
    landcover:[],
    config:{
      shape:{kind:"circle"},
      terrainBands:{mountainM:900,snowM:2200},
      customization:{event:"TEST 300",name:"RIDER",date:"02 OCT 2026",distance:"300 KM",elevation:"3000 M",duration:"12:00:00"},
      fabrication:{modelWidthMm:48,baseMm:2.4,reliefMm:5,targetXyMm:4,routeWidthMm:1.2,routeRiseMm:.8}
    },
    title:"Visual parity"
  });
  const regions=new Set(model.mesh.triangles.map(t=>t.region));
  assert.ok(regions.has(0),"land material missing");
  assert.ok(regions.has(2),"mountain material missing");
  assert.ok(regions.has(3),"snow material missing");
  assert.ok(regions.has(5),"route material missing");
  assert.ok(regions.has(11),"text material missing");
  assert.equal(model.materials.length,12);
});
