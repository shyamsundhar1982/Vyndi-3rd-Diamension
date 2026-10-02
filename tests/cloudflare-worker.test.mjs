import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.mjs";

const assets={
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/apps/web/"||url.pathname==="/apps/web/index.html"||url.pathname==="/apps/trailrelief-exact/"||url.pathname==="/apps/ride-stories-exact/")return new Response("<!doctype html><title>V3D</title>",{headers:{"content-type":"text/html; charset=utf-8"}});
    if(url.pathname==="/apps/web/vendor/model-viewer.min.js")return new Response("model-viewer",{headers:{"content-type":"text/javascript"}});
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


test("directory route does not request index.html from Cloudflare Static Assets",async()=>{
  const seen=[];
  const canonicalAssets={
    async fetch(request){
      const url=new URL(request.url);
      seen.push(url.pathname);
      if(url.pathname==="/apps/web/index.html"){
        return new Response(null,{status:308,headers:{location:"/apps/web/"}});
      }
      if(url.pathname==="/apps/web/"){
        return new Response("<!doctype html><title>V3D</title>",{headers:{"content-type":"text/html; charset=utf-8"}});
      }
      return new Response("not found",{status:404});
    }
  };
  const response=await worker.fetch(new Request("https://example.test/apps/web/"),{ASSETS:canonicalAssets});
  assert.equal(response.status,200);
  assert.deepEqual(seen,["/apps/web/"]);
});

test("exact source-renderer HTML is frameable only by the same V3D origin",async()=>{
  const response=await worker.fetch(new Request("https://example.test/apps/trailrelief-exact/"),{ASSETS:assets});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("x-frame-options"),"SAMEORIGIN");
  const csp=response.headers.get("content-security-policy")||"";
  assert.match(csp,/frame-ancestors 'self'/);
  assert.match(csp,/fonts\.googleapis\.com/);
  assert.match(csp,/raw\.githack\.com/);
});

test("Ride Stories model-viewer absolute path resolves to the V3D vendored runtime",async()=>{
  const response=await worker.fetch(new Request("https://example.test/vendor/model-viewer.min.js"),{ASSETS:assets});
  assert.equal(response.status,200);
  assert.equal(await response.text(),"model-viewer");
});
