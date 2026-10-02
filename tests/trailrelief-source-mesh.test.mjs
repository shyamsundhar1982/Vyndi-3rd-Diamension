import test from "node:test";
import assert from "node:assert/strict";
import { buildTrailReliefSourceModel } from "../packages/source-parity/trailrelief-mesh.mjs";
import { trailReliefSourceConfig } from "../packages/source-parity/source-contracts.mjs";

test("TrailRelief source mesh uses route-centred radial scaling and source material regions",()=>{
  const points=[
    {lat:10,lon:76,ele:100,segment:1},
    {lat:10.05,lon:76.05,ele:450,segment:1},
    {lat:10.1,lon:76.1,ele:1200,segment:1}
  ];
  const bounds={minLat:10,maxLat:10.1,minLon:76,maxLon:76.1};
  const config=trailReliefSourceConfig({event:"SOURCE PARITY"});
  config.production.trailReliefResolution=24;
  const model=buildTrailReliefSourceModel({
    points,routeBounds:bounds,demSampler:(lat,lon)=>Math.max(0,(lat-10)*8000+(lon-76)*1200),landcover:[],config
  });
  assert.equal(model.source,"trailrelief-original");
  assert.equal(model.resolution,24);
  assert.equal(model.sizeMm[0],180);
  assert.ok(model.mmPerKm>0);
  assert.ok(model.mesh.vertices.length>100);
  const regions=new Set(model.mesh.triangles.map(t=>t.region));
  assert.ok(regions.has(0),"lowland material should exist");
  assert.ok(regions.has(5),"raised route should exist");
  assert.ok(regions.has(12),"border rim should exist");
  assert.ok(regions.has(13),"base plate should exist");
  assert.ok(Math.max(...model.mesh.vertices.map(v=>Math.hypot(v.x,v.y)))<=90.001);
});
