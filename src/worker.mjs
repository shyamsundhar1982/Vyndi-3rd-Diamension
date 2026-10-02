const OPEN_TOPO_DATASETS=new Set(["COP30","COP90","NASADEM","SRTM_GL1","AW3D30","EU_DTM"]);
const BASE_HEADERS={
  "strict-transport-security":"max-age=31536000; includeSubDomains",
  "x-content-type-options":"nosniff",
  "x-frame-options":"DENY",
  "referrer-policy":"strict-origin-when-cross-origin",
  "cross-origin-opener-policy":"same-origin",
  "cross-origin-resource-policy":"same-origin",
  "origin-agent-cluster":"?1",
  "x-permitted-cross-domain-policies":"none",
  "permissions-policy":"camera=(self), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), display-capture=(), accelerometer=(self), gyroscope=(self), xr-spatial-tracking=(self), browsing-topics=()"
};
function secure(response){
  const headers=new Headers(response.headers);
  for(const [name,value] of Object.entries(BASE_HEADERS))headers.set(name,value);
  const type=String(headers.get("content-type")||"").toLowerCase();
  if(type.includes("text/html")){
    headers.set("content-security-policy",[
      "default-src 'self'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'","form-action 'self'",
      "script-src 'self'","script-src-attr 'none'","style-src 'self' 'unsafe-inline'","img-src 'self' data: blob:",
      "media-src 'self' blob:","connect-src 'self' blob: https://s3.amazonaws.com https://tiles.openfreemap.org https://overpass-api.de https://overpass.kumi.systems",
      "worker-src 'self' blob:","manifest-src 'self'"
    ].join("; "));
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function json(body,status=200){return secure(new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}}))}
function trusted(request){
  const url=new URL(request.url),origin=request.headers.get("origin"),site=String(request.headers.get("sec-fetch-site")||"").toLowerCase();
  return (!origin||origin===url.origin)&&site!=="cross-site";
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")&&!trusted(request))return json({error:"Cross-site API access is not permitted."},403);
    if(url.pathname==="/health")return json({ok:true,service:"vyndi-3rd-diamension",version:"0.2.0"});
    if(url.pathname==="/"||url.pathname==="/merch"||url.pathname==="/merch.html"||url.pathname==="/apps/web/merch"||url.pathname==="/apps/web/merch/"){
      const assetUrl=new URL(request.url);
      assetUrl.pathname="/apps/web/merch/";
      return secure(await env.ASSETS.fetch(new Request(assetUrl.toString(), request)));
    }
    if(url.pathname==="/workbench"||url.pathname==="/studio"){
      const target=new URL(request.url);target.pathname="/apps/web/";return secure(Response.redirect(target.toString(),302));
    }
    return secure(await env.ASSETS.fetch(request));
  }
};
