import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const html=readFileSync(new URL("../apps/web/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");

test("V3D exposes exact source-fidelity TrailRelief and VYNDI engines",()=>{
  for(const id of ["engineUnified","engineTrailRelief","engineVyndi","sourceEngineFrame"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/engines\/trailrelief\/index\.html/);
  assert.match(html,/engines\/vyndi-medal\/terrain-medal\.html/);
  assert.match(app,/switchEngineMode/);
  assert.match(app,/trailrelief-source/);
  assert.match(app,/vyndi-source/);
});

test("source engine provenance is explicit and immutable in the bundle",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../apps/web/engines/source-manifest.json",import.meta.url),"utf8"));
  assert.equal(manifest.trailrelief.repository,"shyamsundhar1982/trailrelief");
  assert.match(manifest.trailrelief.bundleSha,/^[a-f0-9]{40}$/);
  assert.equal(manifest.vyndi.repository,"vayu-shastr/vyndi-ride-stories");
  assert.match(manifest.vyndi.terrainMedalSha,/^[a-f0-9]{40}$/);
});

test("vendored source engines include their original entrypoints",()=>{
  assert.equal(existsSync(new URL("../apps/web/engines/trailrelief/index.html",import.meta.url)),true);
  assert.equal(existsSync(new URL("../apps/web/engines/trailrelief/assets/index-NHlygkOy.js",import.meta.url)),true);
  assert.equal(existsSync(new URL("../apps/web/engines/vyndi-medal/terrain-medal.html",import.meta.url)),true);
  assert.equal(existsSync(new URL("../apps/web/engines/vyndi-medal/terrain-medal.js",import.meta.url)),true);
});
