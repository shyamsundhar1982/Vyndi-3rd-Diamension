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
      "script-src 'self' https://cdn.jsdelivr.net","script-src-attr 'none'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://images.pexels.com https://tile.openstreetmap.org https://*.wikimedia.org",
      "media-src 'self' blob: https://videos.pexels.com",
      "connect-src 'self' blob: https://s3.amazonaws.com https://tiles.openfreemap.org https://overpass-api.de https://overpass.kumi.systems https://nominatim.openstreetmap.org https://tile.openstreetmap.org https://www.wikidata.org https://en.wikipedia.org https://*.wikimedia.org",
      "frame-src https://www.openstreetmap.org",
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
const NOMINATIM_ORIGIN="https://nominatim.openstreetmap.org";
const NOMINATIM_HEADERS={
  "accept":"application/json",
  "accept-language":"en",
  "user-agent":"VYNDI-3rd-Diamension/0.3 (terrain medal geography lookup; https://vayushastr.com)"
};
function coordinateQuery(value){
  const match=String(value||"").match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if(!match)return null;
  const lat=Number(match[1]),lon=Number(match[2]);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
}
function normalizeGeoResult(item){
  if(!item||typeof item!=="object")return null;
  const osmType=String(item.osm_type||"").toLowerCase(),osmId=Number(item.osm_id);
  if(!["node","way","relation"].includes(osmType)||!Number.isFinite(osmId)||osmId<=0)return null;
  const displayName=String(item.display_name||item.name||"").trim();
  const name=String(item.name||displayName.split(",")[0]||"Place").trim();
  const lat=Number(item.lat),lon=Number(item.lon);
  return {
    name,displayName,
    type:String(item.addresstype||item.type||osmType),
    osmType,osmId,
    lat:Number.isFinite(lat)?lat:null,
    lon:Number.isFinite(lon)?lon:null,
    boundingBox:Array.isArray(item.boundingbox)?item.boundingbox.map(String):null
  };
}
async function fetchNominatimJson(target){
  const response=await fetch(target,{headers:NOMINATIM_HEADERS});
  const raw=await response.text();
  if(!response.ok)throw new Error("Nominatim HTTP "+response.status);
  if(!raw.trim())throw new Error("Nominatim returned an empty response");
  try{return JSON.parse(raw)}catch{throw new Error("Nominatim returned invalid JSON")}
}
async function handleGeoSearch(url){
  const query=String(url.searchParams.get("city")||url.searchParams.get("q")||"").trim();
  if(!query)return json({error:"Enter a country, region, continent, place, or route location."},400);
  if(query.length>160)return json({error:"Geography search is too long."},400);
  const coords=coordinateQuery(query);
  let payload;
  if(coords){
    const target=new URL("/reverse",NOMINATIM_ORIGIN);
    target.searchParams.set("format","jsonv2");
    target.searchParams.set("lat",String(coords.lat));
    target.searchParams.set("lon",String(coords.lon));
    target.searchParams.set("zoom","5");
    target.searchParams.set("addressdetails","1");
    payload=await fetchNominatimJson(target);
    payload=payload&&typeof payload==="object"?[payload]:[];
  }else{
    const target=new URL("/search",NOMINATIM_ORIGIN);
    target.searchParams.set("format","jsonv2");
    target.searchParams.set("q",query);
    target.searchParams.set("addressdetails","1");
    target.searchParams.set("polygon_geojson","0");
    target.searchParams.set("dedupe","1");
    target.searchParams.set("limit","8");
    payload=await fetchNominatimJson(target);
  }
  const results=(Array.isArray(payload)?payload:[]).map(normalizeGeoResult).filter(Boolean).slice(0,8);
  return json({results});
}
function osmLookupCode(type){
  const value=String(type||"").toLowerCase();
  return value==="relation"||value==="r"?"R":value==="way"||value==="w"?"W":value==="node"||value==="n"?"N":null;
}
async function handleGeoOutline(url){
  const type=String(url.searchParams.get("type")||""),id=String(url.searchParams.get("id")||"").trim(),code=osmLookupCode(type);
  if(!code||!/^\d+$/.test(id))return json({error:"Invalid OpenStreetMap boundary identifier."},400);
  const target=new URL("/lookup",NOMINATIM_ORIGIN);
  target.searchParams.set("format","jsonv2");
  target.searchParams.set("osm_ids",code+id);
  target.searchParams.set("polygon_geojson","1");
  target.searchParams.set("polygon_threshold","0.001");
  target.searchParams.set("addressdetails","1");
  const payload=await fetchNominatimJson(target),item=Array.isArray(payload)?payload[0]:null,geometry=item?.geojson;
  if(!geometry||!["Polygon","MultiPolygon"].includes(geometry.type)){
    return json({error:"This place has no printable polygon boundary. Choose a country, state, region, or other mapped area."},422);
  }
  const normalized=normalizeGeoResult(item)||{name:"Geography",displayName:"Geography",type:String(item?.type||"boundary"),osmType:String(type).toLowerCase(),osmId:Number(id),lat:null,lon:null,boundingBox:null};
  return json({...normalized,geometry,source:"OpenStreetMap Nominatim"});
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")&&!trusted(request))return json({error:"Cross-site API access is not permitted."},403);
    if(url.pathname==="/api/geo/search"){
      try{return await handleGeoSearch(url)}catch(error){return json({error:"Geography service unavailable. Please retry.",detail:String(error?.message||error)},502)}
    }
    if(url.pathname==="/api/geo/outline"){
      try{return await handleGeoOutline(url)}catch(error){return json({error:"Geography service unavailable. Please retry.",detail:String(error?.message||error)},502)}
    }
    if(url.pathname==="/health")return json({ok:true,service:"vyndi-3rd-diamension",version:"0.3.0",merch:"ride-stories"});
    if(url.pathname==="/workbench"||url.pathname==="/studio"||url.pathname==="/terrain-medal"){
      const target=new URL(request.url);target.pathname="/apps/web/";return secure(Response.redirect(target.toString(),302));
    }
    if(url.pathname==="/merch"||url.pathname==="/merchandise"){
      const target=new URL(request.url);target.pathname="/";return secure(Response.redirect(target.toString(),302));
    }
    return secure(await env.ASSETS.fetch(request));
  }
};
