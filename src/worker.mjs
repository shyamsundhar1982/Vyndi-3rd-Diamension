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
function utf8(value){return new TextEncoder().encode(String(value))}
function b64url(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function fromB64url(value){const s=String(value).replace(/-/g,"+").replace(/_/g,"/")+"===".slice((String(value).length+3)%4);const raw=atob(s),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
function stableJson(value){if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return "["+value.map(stableJson).join(",")+"]";return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stableJson(value[k])).join(",")+"}"}
async function sha256Hex(value){const digest=await crypto.subtle.digest("SHA-256",typeof value==="string"?utf8(value):value);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("")}
async function hmac(value,secret){const key=await crypto.subtle.importKey("raw",utf8(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);return new Uint8Array(await crypto.subtle.sign("HMAC",key,utf8(value)))}
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0}
function normalizeManifest(input={}){
  const artifactType=String(input.artifactType||"");if(artifactType!=="terrain-medal")throw new Error("Unsupported artifact type.");
  const stem=String(input.stem||"").replace(/[^a-z0-9._-]+/gi,"-").slice(0,120)||"vyndi-terrain";
  const files=(input.files||[]).map(file=>{
    const name=String(file.name||"").slice(0,160),sha256=String(file.sha256||"").toLowerCase(),size=Number(file.size);
    if(!name||name.includes("/")||name.includes("\\"))throw new Error("Invalid authenticity file name.");
    if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error("Invalid SHA-256.");
    if(!Number.isFinite(size)||size<1||size>536870912)throw new Error("Invalid file size.");
    return {name,sha256,size};
  });
  if(!files.length||files.length>10)throw new Error("Authenticity manifest needs 1 to 10 files.");
  const governed={};for(const [k,v] of Object.entries(input.governed||{})){if(v===undefined||v===null)continue;governed[k]=typeof v==="string"?v.slice(0,100):typeof v==="boolean"?v:Number.isFinite(Number(v))?Number(v):String(v).slice(0,100)}
  return {artifactType,stem,files,governed};
}
async function issueReceipt(input,secret,origin){
  if(typeof secret!=="string"||secret.length<32)throw new Error("Authenticity signing is not configured on this Worker.");
  const manifest=normalizeManifest(input),manifestHash=await sha256Hex(stableJson(manifest)),issuedAt=new Date().toISOString(),artifactId="V3D-"+issuedAt.slice(0,10).replace(/-/g,"")+"-"+crypto.randomUUID().slice(0,8).toUpperCase();
  const claim={v:1,issuer:"VYNDI 3rd Diamension",artifactId,artifactType:manifest.artifactType,issuedAt,manifestHash,service:new URL(origin).host};
  const encoded=b64url(utf8(stableJson(claim))),sig=b64url(await hmac(encoded,secret));
  return {claim,manifest,token:encoded+"."+sig,verificationUrl:origin+"/verify?receipt="+encodeURIComponent(encoded+"."+sig)};
}
async function verifyToken(token,secret){
  try{
    if(typeof secret!=="string"||secret.length<32)return {verified:false,error:"Signing secret unavailable."};
    const parts=String(token||"").split(".");if(parts.length!==2)return {verified:false,error:"Malformed receipt."};
    const expected=await hmac(parts[0],secret),actual=fromB64url(parts[1]);if(!equal(expected,actual))return {verified:false,error:"Signature mismatch."};
    const claim=JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    if(claim?.v!==1||claim?.issuer!=="VYNDI 3rd Diamension"||claim?.artifactType!=="terrain-medal"||!/^[a-f0-9]{64}$/.test(String(claim?.manifestHash||"")))return {verified:false,error:"Invalid claim."};
    return {verified:true,claim};
  }catch{return {verified:false,error:"Invalid receipt."}}
}
function esc(value=""){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function verifyPage(url,secret){
  const result=await verifyToken(url.searchParams.get("receipt")||"",secret),claim=result.claim||{},ok=result.verified;
  const html='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>VYNDI authenticity</title><style>body{background:#100d0b;color:#f4efe7;font-family:Arial;margin:0}main{max-width:760px;margin:auto;padding:70px 28px}.card{border:1px solid #4b392c;background:#171310;padding:24px;line-height:1.8}.ok{color:#c9ff38}.bad{color:#ff6a1f}code{word-break:break-all}</style></head><body><main><p>VYNDI 3rd Diamension</p><h1 class="'+(ok?"ok":"bad")+'">'+(ok?"AUTHENTIC RECEIPT":"NOT VERIFIED")+'</h1><div class="card">'+(ok?'Artifact <strong>'+esc(claim.artifactId)+'</strong><br>Issued '+esc(claim.issuedAt)+'<br>Manifest <code>'+esc(claim.manifestHash)+'</code>':esc(result.error))+'</div></main></body></html>';
  return secure(new Response(html,{status:ok?200:400,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}}));
}
async function geoSearch(url){
  const q=String(url.searchParams.get("city")||url.searchParams.get("q")||"").trim();if(!q||q.length>180)throw new Error("Enter a valid place name.");
  const upstream=new URL("https://nominatim.openstreetmap.org/search");upstream.searchParams.set("q",q);upstream.searchParams.set("format","jsonv2");upstream.searchParams.set("addressdetails","1");upstream.searchParams.set("limit","8");
  const response=await fetch(upstream,{headers:{"user-agent":"VYNDI-3rd-Diamension/1.0 (+https://vayushastr.com)","accept":"application/json"}});if(!response.ok)throw new Error("Geography source returned "+response.status+".");
  const rows=await response.json();return rows.map(item=>({id:item.place_id,name:item.display_name,osmId:String(item.osm_id||""),osmType:item.osm_type,type:item.type,class:item.class,bounds:item.boundingbox?.map(Number)||null}));
}
async function geoOutline(url){
  const rawType=String(url.searchParams.get("type")||"").toLowerCase(),id=String(url.searchParams.get("id")||"");const prefix={relation:"R",way:"W",node:"N",r:"R",w:"W",n:"N"}[rawType];
  if(!prefix||!/^[0-9]{1,14}$/.test(id))throw new Error("Select a valid geography result.");
  const upstream=new URL("https://nominatim.openstreetmap.org/lookup");upstream.searchParams.set("osm_ids",prefix+id);upstream.searchParams.set("format","jsonv2");upstream.searchParams.set("polygon_geojson","1");upstream.searchParams.set("polygon_threshold","0.002");
  const response=await fetch(upstream,{headers:{"user-agent":"VYNDI-3rd-Diamension/1.0 (+https://vayushastr.com)","accept":"application/json"}});if(!response.ok)throw new Error("Boundary source returned "+response.status+".");
  const item=(await response.json())?.[0];if(!["Polygon","MultiPolygon"].includes(item?.geojson?.type))throw new Error("This place does not provide a printable polygon boundary.");
  if(JSON.stringify(item.geojson).length>1500000)throw new Error("Boundary exceeds browser geometry budget.");
  return {geometry:item.geojson,name:item.display_name,source:"OpenStreetMap / Nominatim",osmId:id,osmType:rawType};
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")&&!trusted(request))return json({error:"Cross-site API access is not permitted."},403);
    if(url.pathname==="/health")return json({ok:true,service:"vyndi-3rd-diamension",version:"0.1.0"});
    if(url.pathname==="/api/geo/search"&&request.method==="GET"){try{return json({results:await geoSearch(url)})}catch(error){return json({error:error.message},400)}}
    if(url.pathname==="/api/geo/outline"&&request.method==="GET"){try{return json(await geoOutline(url))}catch(error){return json({error:error.message},400)}}
    if(url.pathname==="/api/terrain/opentopography"&&request.method==="POST"){
      if(Number(request.headers.get("content-length")||0)>16384)return json({error:"DEM request is too large."},413);
      try{
        const input=await request.json(),dataset=String(input.dataset||"COP30"),apiKey=String(input.apiKey||"").trim(),b=input.bounds||{};
        const south=Number(b.minLat),north=Number(b.maxLat),west=Number(b.minLon),east=Number(b.maxLon);
        if(!OPEN_TOPO_DATASETS.has(dataset))return json({error:"Unsupported OpenTopography dataset."},400);
        if(!apiKey)return json({error:"OpenTopography API key is required."},400);
        if(![south,north,west,east].every(Number.isFinite)||south>=north||west>=east)return json({error:"Valid terrain bounds are required."},400);
        const upstreamUrl=new URL("https://portal.opentopography.org/API/globaldem");
        upstreamUrl.searchParams.set("demtype",dataset);upstreamUrl.searchParams.set("south",String(south));upstreamUrl.searchParams.set("north",String(north));upstreamUrl.searchParams.set("west",String(west));upstreamUrl.searchParams.set("east",String(east));upstreamUrl.searchParams.set("outputFormat","AAIGrid");upstreamUrl.searchParams.set("API_Key",apiKey);
        const upstream=await fetch(upstreamUrl,{headers:{"user-agent":"VYNDI-3rd-Diamension/1.0 (+https://vayushastr.com)","accept":"text/plain,*/*"}});
        if(!upstream.ok)return json({error:"OpenTopography returned "+upstream.status+"."},502);
        const text=await upstream.text();if(text.length>12000000)return json({error:"OpenTopography grid is too large for browser processing."},413);
        return secure(new Response(text,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"no-store","x-terrain-source":"opentopography-"+dataset}}));
      }catch(error){return json({error:error.message||"OpenTopography request failed."},400)}
    }
    if(url.pathname==="/api/authenticity/status"&&request.method==="GET")return json({configured:typeof env.VYNDI_AUTH_SECRET==="string"&&env.VYNDI_AUTH_SECRET.length>=32,version:1});
    if(url.pathname==="/api/authenticity/issue"&&request.method==="POST"){
      if(Number(request.headers.get("content-length")||0)>65536)return json({error:"Authenticity request is too large."},413);
      try{const body=await request.json();return json(await issueReceipt(body.manifest||body,env.VYNDI_AUTH_SECRET,url.origin))}catch(error){return json({error:error.message},typeof env.VYNDI_AUTH_SECRET==="string"?400:503)}
    }
    if(url.pathname==="/api/authenticity/verify"&&request.method==="GET"){const result=await verifyToken(url.searchParams.get("receipt")||"",env.VYNDI_AUTH_SECRET);return json(result,result.verified?200:400)}
    if(url.pathname==="/verify"&&request.method==="GET")return verifyPage(url,env.VYNDI_AUTH_SECRET);
    if(url.pathname==="/"){
      const target=new URL(request.url);target.pathname="/apps/web/";return secure(await env.ASSETS.fetch(new Request(target,request)));
    }
    return secure(await env.ASSETS.fetch(request));
  }
};