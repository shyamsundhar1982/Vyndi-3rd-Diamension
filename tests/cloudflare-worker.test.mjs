import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.mjs";

const assets={
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/apps/web/index.html")return new Response("<!doctype html><title>V3D</title>",{headers:{"content-type":"text/html; charset=utf-8"}});
    return new Response("asset",{headers:{"content-type":"text/plain"}});
  }
};

test("health endpoint identifies the dedicated V3D worker and disables caching",async()=>{
  const response=await worker.fetch(new Request("https://example.test/health"),{ASSETS:assets});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(await response.json(),{ok:true,service:"vyndi-3rd-diamension",version:"0.1.0"});
});

test("root serves the studio entry without exposing repository files",async()=>{
  const response=await worker.fetch(new Request("https://example.test/"),{ASSETS:assets});
  assert.equal(response.status,200);
  assert.match(await response.text(),/V3D/);
});

test("HTML receives restrictive production security headers",async()=>{
  const response=await worker.fetch(new Request("https://example.test/"),{ASSETS:assets});
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(response.headers.get("x-frame-options"),"DENY");
  assert.equal(response.headers.get("cross-origin-opener-policy"),"same-origin");
  assert.match(response.headers.get("strict-transport-security"),/max-age=31536000/);
  const csp=response.headers.get("content-security-policy")||"";
  assert.match(csp,/default-src 'self'/);
  assert.match(csp,/object-src 'none'/);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.doesNotMatch(csp,/script-src[^;]*\*/);
});

test("non-HTML assets also receive baseline security headers",async()=>{
  const response=await worker.fetch(new Request("https://example.test/apps/web/app.mjs"),{ASSETS:assets});
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.equal(response.headers.get("referrer-policy"),"strict-origin-when-cross-origin");
});
