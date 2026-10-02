const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

export function buildLandcoverQuery(bounds={}){
  const minLat=finite(bounds.minLat),minLon=finite(bounds.minLon),maxLat=finite(bounds.maxLat),maxLon=finite(bounds.maxLon);
  const bbox=`${minLat},${minLon},${maxLat},${maxLon}`;
  return `[out:json][timeout:90][maxsize:200000000];(
way["natural"="wood"](${bbox});
way["landuse"="forest"](${bbox});
relation["natural"="wood"](${bbox});
relation["landuse"="forest"](${bbox});
way["natural"="water"](${bbox});
relation["natural"="water"](${bbox});
way["waterway"~"^(river|canal)$"](${bbox});
);out geom qt;`;
}

function geometryPath(geometry=[]){
  return geometry
    .filter(point=>Number.isFinite(Number(point?.lat))&&Number.isFinite(Number(point?.lon)))
    .map(point=>({lat:Number(point.lat),lon:Number(point.lon)}));
}

export function decodeLandcoverElements(elements=[]){
  const features=[];
  for(const element of elements||[]){
    const tags=element?.tags||{};
    const kind=tags.waterway?"river":tags.natural==="water"?"water":(tags.natural==="wood"||tags.landuse==="forest")?"forest":null;
    if(!kind)continue;
    const paths=[];
    const own=geometryPath(element.geometry);
    if(own.length>1)paths.push(own);
    for(const member of element.members||[]){
      const path=geometryPath(member?.geometry);
      if(path.length>1)paths.push(path);
    }
    if(paths.length)features.push({kind,paths});
  }
  return features;
}

export async function fetchLandcover(bounds,{fetchImpl=globalThis.fetch,endpoints=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"]}={}){
  if(typeof fetchImpl!=="function")return {ok:false,error:"Fetch API unavailable.",features:[]};
  const query=buildLandcoverQuery(bounds);
  let error="No endpoint attempted.";
  for(const endpoint of endpoints){
    try{
      const response=await fetchImpl(endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:"data="+encodeURIComponent(query)});
      if(!response.ok){error="HTTP "+response.status;continue}
      const json=await response.json();
      return {ok:true,error:"",features:decodeLandcoverElements(json?.elements||[])};
    }catch(cause){error=String(cause?.message||cause)}
  }
  return {ok:false,error:"Map landcover unavailable ("+error+")",features:[]};
}
