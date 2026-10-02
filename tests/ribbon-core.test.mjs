import test from "node:test";
import assert from "node:assert/strict";
import { deriveRibbonMeta, normalizeTerrainPalette, terrainBandForElevation, DEFAULT_TERRAIN_PALETTE } from "../packages/ui/ribbon-core.mjs";

test("event ribbon derives useful identity and ride metrics from GPX metadata",()=>{
  const route={
    name:"Paris Brest Paris 2023",
    sourcePointCount:6421,
    distanceKm:1219.4,
    elevationGainM:11420,
    elapsedTimeSeconds:131160,
    points:[
      {lat:48.1,lon:-4.2,ele:10,time:1692554400000},
      {lat:48.2,lon:-4.1,ele:210,time:1692685560000}
    ]
  };
  const meta=deriveRibbonMeta(route,{rider:"Shyam Sundhar",date:"20 Aug 2023"});
  assert.equal(meta.event,"Paris Brest Paris 2023");
  assert.equal(meta.rider,"Shyam Sundhar");
  assert.equal(meta.date,"20 Aug 2023");
  assert.equal(meta.distance,"1,219 KM");
  assert.equal(meta.elevation,"11,420 M");
  assert.equal(meta.duration,"36:26:00");
  assert.equal(meta.sourcePoints,"6,421 PTS");
});

test("terrain palette exposes distinct editable material classes",()=>{
  assert.deepEqual(Object.keys(DEFAULT_TERRAIN_PALETTE),[
    "land","forest","mountain","snow","water","route","roads","labels"
  ]);
  const palette=normalizeTerrainPalette({forest:"#123456",snow:"#ffffff"});
  assert.equal(palette.forest,"#123456");
  assert.equal(palette.snow,"#ffffff");
  assert.equal(palette.route,DEFAULT_TERRAIN_PALETTE.route);
});

test("terrain elevation bands classify land mountain and snow predictably",()=>{
  assert.equal(terrainBandForElevation(120,{mountainM:1200,snowM:2600}),"land");
  assert.equal(terrainBandForElevation(1800,{mountainM:1200,snowM:2600}),"mountain");
  assert.equal(terrainBandForElevation(3200,{mountainM:1200,snowM:2600}),"snow");
});
