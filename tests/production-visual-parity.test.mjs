import test from "node:test";
import assert from "node:assert/strict";
import { defaultAdvancedConfig, productionBounds, productionMaterials, classifyTerrainMaterial, buildPersonalizationMeshes, generateProductionModel } from "../packages/toolkit/toolkit-core.mjs";
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


test("TrailRelief parity reserves a dark raised rim in the canonical defaults",()=>{
  const config=defaultAdvancedConfig();
  assert.equal(config.fabrication.rimWidthMm,12);
  assert.equal(config.fabrication.rimHeightMm,5);
  assert.equal(config.fabrication.reliefMm,12);
  const materials=productionMaterials(config);
  assert.equal(materials[12].name,"Rim");
  assert.equal(materials[12].color,"#23201dFF");
});

test("circular production bounds circumscribe the route rectangle instead of cutting its corners",()=>{
  const route={minLat:10,maxLat:10.02,minLon:76,maxLon:76.02};
  const bounds=productionBounds(route,{kind:"circle"});
  const midLat=(bounds.minLat+bounds.maxLat)/2;
  const lonScale=Math.cos(midLat*Math.PI/180);
  const rx=(route.maxLon-route.minLon)*lonScale/((bounds.maxLon-bounds.minLon)*lonScale);
  const ry=(route.maxLat-route.minLat)/(bounds.maxLat-bounds.minLat);
  assert.ok(Math.hypot(rx,ry)<.94,"route corners need a safe circular inset");
});

test("circular production keeps route geometry inside the object and emits a governed rim",async()=>{
  const points=[
    {lat:10,lon:76,ele:100,time:0},
    {lat:10.01,lon:76.01,ele:500,time:600000},
    {lat:10.02,lon:76.02,ele:200,time:1200000}
  ];
  const model=await generateProductionModel({
    points,
    demSampler:(lat,lon)=>100+(lat-10)*18000+(lon-76)*7000,
    landcover:[],
    config:{
      shape:{kind:"circle"},
      fabrication:{modelWidthMm:48,baseMm:2.4,reliefMm:7,targetXyMm:3,routeWidthMm:1.2,routeRiseMm:.8,rimWidthMm:4,rimHeightMm:2.5},
      customization:{event:"DIAGONAL TEST",name:"RIDER"}
    },
    title:"Circular containment"
  });
  const routeVertexIds=new Set();
  for(const tri of model.mesh.triangles)if(tri.region===5){routeVertexIds.add(tri.a);routeVertexIds.add(tri.b);routeVertexIds.add(tri.c);}
  assert.ok(routeVertexIds.size>0,"route material missing");
  const routeRadius=Math.max(...[...routeVertexIds].map(i=>Math.hypot(model.mesh.vertices[i].x,model.mesh.vertices[i].y)));
  assert.ok(routeRadius<=24.001,"route protrudes beyond circular object");
  assert.ok(model.mesh.triangles.some(tri=>tri.region===12),"dark raised rim material missing");
});
