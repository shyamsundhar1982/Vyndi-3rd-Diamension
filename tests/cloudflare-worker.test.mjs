import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.mjs";

const assets={
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/apps/web/"||url.pathname==="/apps/web/index.html")return new Response("<!doctype html><title>V3D</title>",{headers:{"content-type":"text/html; charset=utf-8"}});
    return new Response("asset",{headers:{"content-type":"text/plain"}});
  }
};

test("health endpoint identifies the dedicated V3D worker and disables caching",async()=>{
  const response=await worker.fetch(new Request("https://example.test/health"),{ASSETS:assets});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(await response.json(),{ok:true,service:"vyndi-3rd-diamension",version:"0.3.0",merch:"ride-stories"});
});

test("root serves the synced merchandise landing while Workbench aliases redirect to the studio",async()=>{
  const root=await worker.fetch(new Request("https://example.test/"),{ASSETS:assets});
  assert.equal(root.status,200);
  const response=await worker.fetch(new Request("https://example.test/workbench"),{ASSETS:assets});
  assert.equal(response.status,302);
  assert.equal(response.headers.get("location"),"https://example.test/apps/web/");
});

test("HTML receives restrictive production security headers",async()=>{
  const response=await worker.fetch(new Request("https://example.test/apps/web/"),{ASSETS:assets});
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


test("geography search returns stable JSON results for the medal boundary picker",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async request=>{
    const url=new URL(typeof request==="string"?request:request.url);
    assert.equal(url.origin,"https://nominatim.openstreetmap.org");
    assert.equal(url.pathname,"/search");
    assert.equal(url.searchParams.get("q"),"India");
    return new Response(JSON.stringify([{
      osm_type:"relation",osm_id:304716,name:"India",display_name:"India",
      addresstype:"country",type:"administrative",lat:"22.3511148",lon:"78.6677428",
      boundingbox:["6.5546079","35.6745457","68.1113787","97.395561"]
    }]),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    const response=await worker.fetch(new Request("https://example.test/api/geo/search?city=India",{headers:{"sec-fetch-site":"same-origin"}}),{ASSETS:assets});
    assert.equal(response.status,200);
    assert.match(response.headers.get("content-type")||"",/application\/json/);
    assert.deepEqual(await response.json(),{results:[{
      name:"India",displayName:"India",type:"country",osmType:"relation",osmId:304716,
      lat:22.3511148,lon:78.6677428,boundingBox:["6.5546079","35.6745457","68.1113787","97.395561"]
    }]});
  }finally{globalThis.fetch=originalFetch}
});

test("geography outline returns a polygon usable as a medal shape",async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async request=>{
    const url=new URL(typeof request==="string"?request:request.url);
    assert.equal(url.origin,"https://nominatim.openstreetmap.org");
    assert.equal(url.pathname,"/lookup");
    assert.equal(url.searchParams.get("osm_ids"),"R304716");
    return new Response(JSON.stringify([{
      osm_type:"relation",osm_id:304716,name:"India",display_name:"India",
      geojson:{type:"Polygon",coordinates:[[[68,8],[97,8],[97,35],[68,35],[68,8]]]}
    }]),{status:200,headers:{"content-type":"application/json"}});
  };
  try{
    const response=await worker.fetch(new Request("https://example.test/api/geo/outline?type=relation&id=304716",{headers:{"sec-fetch-site":"same-origin"}}),{ASSETS:assets});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.name,"India");
    assert.equal(data.osmType,"relation");
    assert.equal(data.osmId,304716);
    assert.equal(data.geometry.type,"Polygon");
    assert.equal(data.source,"OpenStreetMap Nominatim");
  }finally{globalThis.fetch=originalFetch}
});
