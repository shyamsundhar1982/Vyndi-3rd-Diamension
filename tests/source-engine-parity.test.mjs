import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

function gitBlobSha(path){
  const data=readFileSync(new URL("../"+path,import.meta.url));
  return createHash("sha1").update(Buffer.from("blob "+data.length+"\0")).update(data).digest("hex");
}

const html=readFileSync(new URL("../apps/web/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../apps/web/app.mjs",import.meta.url),"utf8");

test("live source renderer vendors the exact TrailRelief production bundle",()=>{
  const workspace="apps/trailrelief-exact/assets/Workspace-B3Rbosop.js";
  assert.ok(existsSync(new URL("../"+workspace,import.meta.url)),"exact TrailRelief renderer bundle must be vendored");
  assert.equal(gitBlobSha(workspace),"54cbc68bc7077e5d038f45a3378e1c5089d9b95c","TrailRelief renderer bundle must remain byte-identical to source repo");
});

test("V3D can display and synchronize the exact TrailRelief source renderer",()=>{
  assert.match(html,/id="sourceEngineFrame"/);
  assert.match(html,/TRAILRELIEF EXACT/);
  assert.match(app,/serializeGpxRoute/);
  assert.match(app,/postMessage\(\{type:"v3d-load-gpx"/);
  assert.match(app,/sourceEngineFrame/);
});

test("source bridge accepts parent GPX without replacing TrailRelief rendering logic",()=>{
  const bridge=readFileSync(new URL("../apps/trailrelief-exact/v3d-bridge.mjs",import.meta.url),"utf8");
  assert.match(bridge,/v3d-load-gpx/);
  assert.match(bridge,/DataTransfer/);
  assert.match(bridge,/input\[type="file"\]/);
  assert.doesNotMatch(bridge,/WebGLRenderer|BufferGeometry|MeshStandardMaterial/);
});
