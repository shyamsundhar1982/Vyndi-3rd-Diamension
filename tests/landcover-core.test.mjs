import test from "node:test";
import assert from "node:assert/strict";
import { buildLandcoverQuery, decodeLandcoverElements } from "../packages/map/landcover-core.mjs";

test("landcover query requests real forest water and waterways",()=>{
  const q=buildLandcoverQuery({minLat:10,minLon:20,maxLat:11,maxLon:21});
  assert.match(q,/natural"="wood/);
  assert.match(q,/landuse"="forest/);
  assert.match(q,/natural"="water/);
  assert.match(q,/waterway/);
});

test("Overpass landcover decoder preserves forest and water geometry",()=>{
  const features=decodeLandcoverElements([
    {tags:{landuse:"forest"},geometry:[{lat:10,lon:20},{lat:10.1,lon:20.1},{lat:10,lon:20}]},
    {tags:{natural:"water"},geometry:[{lat:10.2,lon:20.2},{lat:10.3,lon:20.3},{lat:10.2,lon:20.2}]}
  ]);
  assert.equal(features.length,2);
  assert.equal(features[0].kind,"forest");
  assert.equal(features[1].kind,"water");
  assert.equal(features[0].paths[0].length,3);
});
