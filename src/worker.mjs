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
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' blob: https://s3.amazonaws.com https://tiles.openfreemap.org https://overpass-api.de https://overpass.kumi.systems",
      "worker-src 'self' blob:",
      "manifest-src 'self'"
    ].join("; "));
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==="/health"){
      return new Response(JSON.stringify({ok:true,service:"vyndi-3rd-diamension",version:"0.1.0"}),{
        status:200,
        headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...BASE_HEADERS}
      });
    }
    if(url.pathname==="/"){
      const target=new URL(request.url);
      target.pathname="/apps/web/";
      return secure(await env.ASSETS.fetch(new Request(target,request)));
    }
    return secure(await env.ASSETS.fetch(request));
  }
};
