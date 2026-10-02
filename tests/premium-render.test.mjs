import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { encodeGlb } from "../packages/engine/print-model-core.mjs";

function glbJson(bytes){
  const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  const dv=new DataView(view.buffer,view.byteOffset,view.byteLength);
  assert.equal(dv.getUint32(0,true),0x46546c67);
  const jsonLen=dv.getUint32(12,true);
  return JSON.parse(new TextDecoder().decode(view.slice(20,20+jsonLen)).trim());
}

const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");

test("premium GLB texture can span all terrain material regions without colouring route or rim",()=>{
  const mesh={
    vertices:[
      {x:-1,y:-1,z:0},{x:1,y:-1,z:0},{x:-1,y:1,z:1},
      {x:1,y:1,z:2},{x:0,y:0,z:3},{x:0,y:1,z:4}
    ],
    triangles:[
      {a:0,b:1,c:2,region:0},
      {a:1,b:3,c:2,region:2},
      {a:2,b:3,c:4,region:3},
      {a:0,b:2,c:4,region:4},
      {a:0,b:4,c:5,region:5},
      {a:1,b:5,c:3,region:12}
    ]
  };
  const materials=Array.from({length:13},(_,i)=>({name:"M"+i,color:"#808080FF"}));
  const png=new Uint8Array([137,80,78,71,13,10,26,10]);
  const glb=encodeGlb(mesh,{
    materials,
    texture:{png,regions:[0,1,2,3,4],uv:v=>({u:(v.x+1)/2,v:(v.y+1)/2})}
  });
  const json=glbJson(glb);
  for(const region of [0,2,3,4]){
    const primitive=json.meshes[0].primitives.find(p=>p.material===region);
    assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_0),"terrain primitive should carry UVs");
    assert.ok(json.materials[region].pbrMetallicRoughness.baseColorTexture,"terrain material should use premium texture");
    assert.deepEqual(json.materials[region].pbrMetallicRoughness.baseColorFactor,[1,1,1,1]);
  }
  for(const region of [5,12]){
    const primitive=json.meshes[0].primitives.find(p=>p.material===region);
    assert.equal(primitive.attributes.TEXCOORD_0,undefined,"route/rim should stay material-coloured");
    assert.equal(json.materials[region].pbrMetallicRoughness.baseColorTexture,undefined);
  }
});

test("web production pipeline bakes hypsometric hillshade for premium medal previews",()=>{
  assert.match(app,/buildPremiumTerrainTexture/);
  assert.match(app,/hypsometricColor/);
  assert.match(app,/terrainTexture/);
  assert.match(app,/encodeGlb/);
  assert.match(app,/texture:\{png:terrainTexture\.png,regions:\[0,1,2,3,4\]/);
});
