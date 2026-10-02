import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TRAILRELIEF_SOURCE_DEFAULTS,
  trailReliefSourceConfig,
  VYNDI_SOURCE_VIEW,
  sourceProfileOptions
} from "../packages/source-parity/source-contracts.mjs";

const html=readFileSync(new URL("../apps/web/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");
const vendor=readFileSync(new URL("../scripts/build-vendor.mjs",import.meta.url),"utf8");

test("source renderer selector exposes both original repo contracts plus unified V3D",()=>{
  assert.match(html,/id="sourceRenderer"/);
  assert.match(html,/TrailRelief Original/);
  assert.match(html,/VYNDI Terrain Medal Original/);
  assert.match(html,/V3D Unified/);
  assert.deepEqual(sourceProfileOptions().map(x=>x.id),["trailrelief-original","vyndi-original","v3d-unified"]);
});

test("TrailRelief source defaults are copied exactly from the compiled source-of-truth bundle",()=>{
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.paddingKm,3);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.resolution,220);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.modelSize,180);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.exaggeration,2);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.plateThickness,3);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.snowLine,2600);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.mountainLine,1200);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.forestRaise,.4);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.waterDepth,.6);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.routeMode,"raised");
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.routeWidth,1.6);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.routeHeight,1.2);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.rimWidth,12);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.rimHeight,5);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.textSize,6);
  assert.equal(TRAILRELIEF_SOURCE_DEFAULTS.textDepth,.8);
  assert.deepEqual(TRAILRELIEF_SOURCE_DEFAULTS.colors,{
    base:"#2b2622",land:"#b7a77a",mountain:"#8a7a68",snow:"#f4f3ee",forest:"#3f6b3a",
    water:"#3d86b8",sea:"#1f4f7a",route:"#ff6a1f",rim:"#23201d",text:"#f2c14e"
  });
});

test("TrailRelief source profile disables invented premium geography and restores route-centred round model",()=>{
  const c=trailReliefSourceConfig({event:"PARVATHA 600",date:"14 JUL 2026"});
  assert.equal(c.shape.kind,"circle");
  assert.equal(c.shape.routeBufferKm,3);
  assert.equal(c.fabrication.modelWidthMm,180);
  assert.equal(c.fabrication.baseMm,3);
  assert.equal(c.fabrication.routeStyle,"raised");
  assert.equal(c.fabrication.routeWidthMm,1.6);
  assert.equal(c.fabrication.routeRiseMm,1.2);
  assert.equal(c.fabrication.rimWidthMm,12);
  assert.equal(c.fabrication.rimHeightMm,5);
  assert.equal(c.placeLabels.mode,"none");
  assert.equal(c.map.roads,false);
  assert.equal(c.production.sourceRenderer,"trailrelief-original");
});

test("VYNDI source view preserves the actual canvas projection contract",()=>{
  assert.equal(VYNDI_SOURCE_VIEW.yaw,-.42);
  assert.equal(VYNDI_SOURCE_VIEW.pitch,.92);
  assert.equal(VYNDI_SOURCE_VIEW.zoom,1);
  assert.equal(VYNDI_SOURCE_VIEW.perspectiveDepth,.0024);
  assert.match(app,/renderVyndiSourcePreview/);
  assert.match(app,/surfaceHeightVyndiSource/);
  assert.match(html,/id="sourcePreviewCanvas"/);
});

test("TrailRelief source viewport uses the exact scene contract rather than model-viewer approximation",()=>{
  assert.match(vendor,/trailrelief-source-renderer-entry/);
  assert.match(app,/renderTrailReliefSource/);
  assert.match(app,/cameraFov:40/);
  assert.match(app,/hemisphereIntensity:\.6/);
  assert.match(app,/directionalIntensity:2\.2/);
  assert.match(app,/roughness:\.82/);
  assert.match(app,/metalness:\.02/);
});

test("source parity profiles bypass the invented premium hillshade path",()=>{
  assert.match(app,/sourceRenderer/);
  assert.match(app,/v3d-unified/);
  assert.match(app,/premium-medal/);
  assert.match(app,/sourceMode!==\"v3d-unified\"/);
});

test("authenticity manifest records the renderer source",()=>{
  assert.match(app,/sourceRenderer:state\.production\.config\.production\.sourceRenderer/);
});
