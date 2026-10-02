import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultAdvancedConfig, generateProductionModel } from "../packages/toolkit/toolkit-core.mjs";
import { mergeGpxRoutes } from "../packages/gpx/gpx-core.mjs";

const html=readFileSync(new URL("../apps/web/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");

test("full-union workbench exposes TrailRelief simple tabs plus VYNDI production depth",()=>{
  for(const label of ["Terrain","Colours","Plate","Print"]) assert.match(html,new RegExp(">"+label+"<","i"));
  for(const id of [
    "demoRoute","gpxInput","routeStyle","routeRise","forestRaise","waterDepth","waterMode","waveHeight","waveSpacing",
    "printerProfile","medalSize","contourEnabled","contourInterval","contourRise","magnetEnabled","magnetDiameter","magnetDepth",
    "hangerEnabled","loopInnerDiameter","loopWall","bottomMark","logoInput","heightmapInput","heightmapStrength",
    "tileEnabled","tileMaxWidth","tileMaxHeight","tileJointType","placeLabelMode","geoJsonInput",
    "downloadStand","downloadTiles","downloadPrintPackage","downloadJob","issueAuthenticity"
  ]) assert.match(html,new RegExp('id="'+id+'"'),id+" missing");
  assert.match(html,/id="gpxInput"[^>]*multiple/);
});

test("full-union controls are wired to canonical model generation rather than decorative UI",()=>{
  for(const term of [
    "mergeGpxRoutes","routeStyle","routeRise","forestRaise","waterDepth","waterMode","contourEnabled",
    "magnetDiameter","hangerEnabled","logoInput","heightmapInput","tileMaxWidth","placeLabelMode",
    "downloadPrintPackage","issueAuthenticity"
  ]) assert.match(app,new RegExp(term),term+" not wired");
});

test("advanced defaults carry both TrailRelief surface controls and VYNDI fabrication controls",()=>{
  const c=defaultAdvancedConfig();
  assert.equal(c.fabrication.routeStyle,"raised");
  assert.equal(c.surface.forestRaiseMm,.4);
  assert.equal(c.surface.waterDepthMm,.6);
  assert.equal(c.surface.waterMode,"procedural-waves");
  assert.equal(c.contours.enabled,false);
  assert.equal(c.placeLabels.mode,"major");
  assert.equal(c.production.printerProfile,"bambu-p1s");
});

test("multiple GPX routes merge without drawing artificial connector legs",()=>{
  const a={name:"A",points:[{lat:10,lon:76,ele:10,time:0,segment:1},{lat:10.01,lon:76.01,ele:20,time:60000,segment:1}],sourcePointCount:2,distanceKm:2,elevationGainM:10,movingTimeSeconds:60,elapsedTimeSeconds:60,bounds:{minLat:10,maxLat:10.01,minLon:76,maxLon:76.01,minEle:10,maxEle:20}};
  const b={name:"B",points:[{lat:11,lon:77,ele:30,time:120000,segment:1},{lat:11.01,lon:77.01,ele:50,time:180000,segment:1}],sourcePointCount:2,distanceKm:3,elevationGainM:20,movingTimeSeconds:60,elapsedTimeSeconds:60,bounds:{minLat:11,maxLat:11.01,minLon:77,maxLon:77.01,minEle:30,maxEle:50}};
  const m=mergeGpxRoutes([a,b],"Union");
  assert.equal(m.points.length,4);
  assert.notEqual(m.points[1].segment,m.points[2].segment);
  assert.equal(m.distanceKm,5);
  assert.equal(m.elevationGainM,30);
  assert.equal(m.name,"Union");
});

test("route style none removes the physical route while raised retains it and print package is emitted",async()=>{
  const points=[{lat:10,lon:76,ele:100,time:0,segment:1},{lat:10.01,lon:76.01,ele:300,time:60000,segment:1},{lat:10.02,lon:76.02,ele:180,time:120000,segment:1}];
  const base={shape:{kind:"circle"},fabrication:{modelWidthMm:60,baseMm:2.5,reliefMm:5,targetXyMm:4,routeWidthMm:1.2,routeRiseMm:.8,rimWidthMm:4,rimHeightMm:2}};
  const none=await generateProductionModel({points,demSampler:(lat)=>100+(lat-10)*10000,config:{...base,fabrication:{...base.fabrication,routeStyle:"none"}},title:"None"});
  assert.equal(none.mesh.triangles.some(t=>t.region===5),false);
  const raised=await generateProductionModel({points,demSampler:(lat)=>100+(lat-10)*10000,config:{...base,fabrication:{...base.fabrication,routeStyle:"raised"}},title:"Raised"});
  assert.equal(raised.mesh.triangles.some(t=>t.region===5),true);
  assert.ok(raised.printPackage instanceof Uint8Array);
  assert.ok(raised.printPackage.length>100);
});
