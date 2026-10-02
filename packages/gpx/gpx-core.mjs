
function decodeXml(value=""){
  return String(value)
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'");
}

export function extractGpxName(source="",fallbackName="Route"){
  const text=String(source||"");
  const match=text.match(/<(?:trk|rte)>\s*<name>([^<]+)<\/name>/i)
    ||text.match(/<metadata>[\s\S]*?<name>([^<]+)<\/name>/i)
    ||text.match(/<name>([^<]+)<\/name>/i);
  const fallback=String(fallbackName||"Route").replace(/\.gpx$/i,"").trim()||"Route";
  return decodeXml(match?.[1]||fallback).trim()||fallback;
}

function boundedMaxPoints(value){
  const n=Math.floor(Number(value));
  return Number.isFinite(n)?Math.max(100,Math.min(100000,n)):20000;
}

function reducePoints(points,maxPoints){
  if(points.length<=maxPoints)return points;
  if(maxPoints<=2)return [points[0],points.at(-1)];
  const out=[points[0]],last=points.length-1;
  for(let i=1;i<maxPoints-1;i++){
    const index=Math.round(i*last/(maxPoints-1));
    if(index>0&&index<last&&points[index]!==out.at(-1))out.push(points[index]);
  }
  if(out.at(-1)!==points[last])out.push(points[last]);
  return out.slice(0,maxPoints);
}

export function parseGpxText(text="",fallbackName="Route",options={}){
  const source=String(text||""),maxPoints=boundedMaxPoints(options.maxPoints);
  const name=extractGpxName(source.slice(0,524288),fallbackName);
  let points=[],sourcePointCount=0,stride=1,finalPoint=null;
  let minLat=Infinity,maxLat=-Infinity,minLon=Infinity,maxLon=-Infinity,minEle=Infinity,maxEle=-Infinity;
  let lastDistancePoint=null,lastElevationPoint=null,lastTimedPoint=null,firstTimeMs=null,lastTimeMs=null;
  let distanceKm=0,elevationGainM=0,movingTimeSeconds=0,segment=0,previousEnd=0;

  const haversine=(a,b)=>{
    const toRad=value=>value*Math.PI/180,R=6371;
    const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);
    const aa=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;
    return 2*R*Math.atan2(Math.sqrt(aa),Math.sqrt(Math.max(0,1-aa)));
  };

  const re=/<(?:trkpt|rtept|wpt)\b([^>]*)>([\s\S]*?)<\/(?:trkpt|rtept|wpt)>/gi;
  let match;
  while((match=re.exec(source))){
    const between=source.slice(previousEnd,match.index),openings=between.match(/<(?:trkseg|rte)\b/gi);
    if(openings)segment+=openings.length;
    previousEnd=re.lastIndex;

    const attrs=match[1]||"",body=match[2]||"";
    const latMatch=attrs.match(/\blat\s*=\s*["']([^"']+)["']/i);
    const lonMatch=attrs.match(/\blon\s*=\s*["']([^"']+)["']/i);
    const lat=Number(latMatch?.[1]),lon=Number(lonMatch?.[1]);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;

    const eleMatch=body.match(/<ele>([^<]+)<\/ele>/i),timeMatch=body.match(/<time>([^<]+)<\/time>/i);
    const ele=eleMatch?Number(eleMatch[1]):null,timeMs=timeMatch?Date.parse(timeMatch[1]):NaN;
    const point={lat,lon,ele:Number.isFinite(ele)?ele:null,time:Number.isFinite(timeMs)?timeMs:null,segment};
    finalPoint=point;sourcePointCount++;

    minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
    if(Number.isFinite(ele)){minEle=Math.min(minEle,ele);maxEle=Math.max(maxEle,ele)}

    if(lastDistancePoint&&lastDistancePoint.segment===segment)distanceKm+=haversine(lastDistancePoint,point);
    if(Number.isFinite(ele)&&Number.isFinite(lastElevationPoint?.ele)&&lastElevationPoint.segment===segment)elevationGainM+=Math.max(0,ele-lastElevationPoint.ele);
    if(Number.isFinite(ele))lastElevationPoint=point;
    else if(lastElevationPoint?.segment!==segment)lastElevationPoint=null;

    if(Number.isFinite(timeMs)){
      if(firstTimeMs===null)firstTimeMs=timeMs;
      lastTimeMs=timeMs;
      if(lastTimedPoint&&lastTimedPoint.segment===segment&&Number.isFinite(lastTimedPoint.time)){
        const deltaSeconds=(timeMs-lastTimedPoint.time)/1000;
        if(deltaSeconds>0&&deltaSeconds<=21600){
          const legKm=haversine(lastTimedPoint,point),speedKmh=legKm/(deltaSeconds/3600);
          if(speedKmh>=.5&&speedKmh<=200)movingTimeSeconds+=deltaSeconds;
        }
      }
      lastTimedPoint=point;
    }

    lastDistancePoint=point;
    if((sourcePointCount-1)%stride===0)points.push(point);
    if(points.length>maxPoints*2){
      const thinned=[points[0]];
      for(let i=2;i<points.length-1;i+=2)thinned.push(points[i]);
      if(points.at(-1)!==thinned.at(-1))thinned.push(points.at(-1));
      points=thinned;stride*=2;
    }
  }

  if(sourcePointCount<2)throw new Error("GPX needs at least two track, route or waypoint records.");
  if(finalPoint&&points.at(-1)!==finalPoint)points.push(finalPoint);
  points=reducePoints(points,maxPoints);
  const elapsedTimeSeconds=firstTimeMs!==null&&lastTimeMs!==null&&lastTimeMs>=firstTimeMs?Math.round((lastTimeMs-firstTimeMs)/1000):0;

  return {
    name,points,sourcePointCount,simplified:points.length<sourcePointCount,
    distanceKm:Number(distanceKm.toFixed(2)),elevationGainM:Number(elevationGainM.toFixed(1)),
    movingTimeSeconds:Math.round(movingTimeSeconds),elapsedTimeSeconds,
    bounds:{minLat,maxLat,minLon,maxLon,minEle:Number.isFinite(minEle)?minEle:0,maxEle:Number.isFinite(maxEle)?maxEle:0}
  };
}

function encodeXml(value=""){
  return String(value)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

export function shouldPreprocessLiveGpx(sizeBytes){
  return Number(sizeBytes||0)>8*1024*1024;
}

export function serializeGpxRoute(route={}){
  const name=encodeXml(route.name||"TrailRelief route");
  const points=Array.isArray(route.points)?route.points:[];
  if(points.length<2)throw new Error("A live GPX copy needs at least two points.");
  const body=points.map(point=>{
    const lat=Number(point.lat),lon=Number(point.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon))return "";
    const ele=Number.isFinite(Number(point.ele))?("<ele>"+Number(point.ele)+"</ele>"):"";
    const time=Number.isFinite(Number(point.time))?("<time>"+new Date(Number(point.time)).toISOString()+"</time>"):"";
    return '<trkpt lat="'+lat+'" lon="'+lon+'">'+ele+time+'</trkpt>';
  }).join("");
  return '<?xml version="1.0" encoding="UTF-8"?>'
    +'<gpx version="1.1" creator="TrailRelief" xmlns="http://www.topografix.com/GPX/1/1">'
    +'<metadata><name>'+name+'</name></metadata>'
    +'<trk><name>'+name+'</name><trkseg>'+body+'</trkseg></trk></gpx>';
}


export function processGpxTextJob(text,payload={}){
  const {fallbackName="Route",maxPoints=20000,serialize=false}=payload||{};
  const route=parseGpxText(text,fallbackName,{maxPoints});
  return {route,liveText:serialize?serializeGpxRoute(route):null};
}
