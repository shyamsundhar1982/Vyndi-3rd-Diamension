import test from "node:test";
import assert from "node:assert/strict";
import { productionMaterials, classifyTerrainMaterial } from "../packages/toolkit/toolkit-core.mjs";
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
