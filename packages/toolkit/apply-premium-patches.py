#!/usr/bin/env python3
"""Surgical premium-quality patches for toolkit-core.mjs"""
from pathlib import Path

p = Path("packages/toolkit/toolkit-core.mjs")
t = p.read_text()
if "densifyProjectedRoute" in t:
    print("already patched")
    raise SystemExit(0)

old = """  const mountainM=Number.isFinite(Number(thresholds.mountainM))?Number(thresholds.mountainM):1200;
  const snowM=Math.max(mountainM,Number.isFinite(Number(thresholds.snowM))?Number(thresholds.snowM):2600);
  if(Number.isFinite(elevation)&&elevation>=snowM)return 3;
  if(Number.isFinite(elevation)&&elevation>=mountainM)return 2;
  return 0;
}"""
new = """  const mountainM=Number.isFinite(Number(thresholds.mountainM))?Number(thresholds.mountainM):1200;
  const snowM=Math.max(mountainM,Number.isFinite(Number(thresholds.snowM))?Number(thresholds.snowM):2600);
  const seaLevelM=Number.isFinite(Number(thresholds.seaLevelM))?Number(thresholds.seaLevelM):1.5;
  if(Number.isFinite(elevation)&&elevation<=seaLevelM)return 4;
  if(Number.isFinite(elevation)&&elevation>=snowM)return 3;
  if(Number.isFinite(elevation)&&elevation>=mountainM)return 2;
  return 0;
}"""
if old not in t:
    raise SystemExit("classify block missing")
t = t.replace(old, new, 1)

t = t.replace(
    'terrainBands:{mountainM:1200,snowM:2600},',
    'terrainBands:{mountainM:1200,snowM:2600,seaLevelM:1.5},',
    1,
)
t = t.replace(
    'surface:{forestRaiseMm:.4,waterDepthMm:.6,waterMode:"procedural-waves",waveHeightMm:.3,waveSpacingMm:2.6},',
    'surface:{forestRaiseMm:.4,waterDepthMm:1.1,waterMode:"procedural-waves",waveHeightMm:.45,waveSpacingMm:2.4},',
    1,
)

old_fm = """  const addSegments=(segments,width,rise,region,maxSegments)=>{
    let used=0;
    for(const pair of segments){
      const list=pair.points||pair;
      for(let i=1;i<list.length&&used<maxSegments;i++){
        const toMm=point=>{
          if(point?.nx!==undefined&&point?.ny!==undefined)return {x:Number(point.x),y:Number(point.y)};
          if(point?.x!==undefined&&point?.lat===undefined)return {x:Number(point.x)*radius,y:Number(point.y)*radius};
          return projection.project(point);
        };
        const a=toMm(list[i-1]),b=toMm(list[i]);
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=mx/radius,ny=my/radius;
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ox=-dy/len*width/2,oy=dx/len*width/2;
        const footprint=[[a.x+ox,a.y+oy],[a.x-ox,a.y-oy],[b.x+ox,b.y+oy],[b.x-ox,b.y-oy]];
        if(!insideNormalized(nx,ny)||!footprint.every(([x,y])=>insideNormalized(x/radius,y/radius))||!inRect(mx,my,clipRect))continue;
        const zA=terrainTopMm(a.x,a.y),zB=terrainTopMm(b.x,b.y),mesh=segmentPrism(a,b,width,rise,zA,zB,region);
        if(mesh){meshes.push(shifted(mesh,offsetX,offsetY));used++;}
      }
    }
  };
  const stride=Math.max(1,Math.ceil(route.length/1600)),routeLite=[];
  for(let i=0;i<route.length;i+=stride)routeLite.push(route[i]);
  if(routeLite.at(-1)!==route.at(-1))routeLite.push(route.at(-1));
  const routeStyle=String(config.fabrication.routeStyle||"raised");
  if(routeStyle==="raised")addSegments([routeLite],config.fabrication.routeWidthMm,config.fabrication.routeRiseMm,5,1800);
  else if(routeStyle==="inlay")addSegments([routeLite],config.fabrication.routeWidthMm,Math.max(.05,config.fabrication.routeRiseMm),5,1800);
  else if(routeStyle==="color")addSegments([routeLite],config.fabrication.routeWidthMm,.08,5,1800);"""

new_fm = """  const densifyProjectedRoute=(route,maxStepMm=.7,maxPoints=5200)=>{
    if(!route.length)return route;
    const out=[route[0]];
    for(let i=1;i<route.length;i++){
      const a=out.at(-1),b=route[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len>maxStepMm){const n=Math.min(24,Math.ceil(len/maxStepMm));for(let k=1;k<n;k++){if(out.length>=maxPoints-1)break;out.push({x:a.x+dx*k/n,y:a.y+dy*k/n});}}
      if(out.length>=maxPoints)break;
      out.push(b);
    }
    if(out.at(-1)!==route.at(-1)&&out.length<maxPoints)out.push(route.at(-1));
    return out;
  };
  const addSegments=(segments,width,rise,region,maxSegments)=>{
    let used=0;
    for(const pair of segments){
      const list=pair.points||pair;
      for(let i=1;i<list.length&&used<maxSegments;i++){
        const toMm=point=>{
          if(point?.nx!==undefined&&point?.ny!==undefined)return {x:Number(point.x),y:Number(point.y)};
          if(point?.x!==undefined&&point?.lat===undefined)return {x:Number(point.x)*radius,y:Number(point.y)*radius};
          return projection.project(point);
        };
        const a=toMm(list[i-1]),b=toMm(list[i]);
        const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=mx/radius,ny=my/radius;
        const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
        if(!insideNormalized(nx,ny)||!inRect(mx,my,clipRect)||len>8)continue;
        const zA=terrainTopMm(a.x,a.y),zB=terrainTopMm(b.x,b.y),mesh=segmentPrism(a,b,width,rise,zA,zB,region);
        if(mesh){meshes.push(shifted(mesh,offsetX,offsetY));used++;}
      }
    }
  };
  const stride=Math.max(1,Math.ceil(route.length/3200));
  let routeLite=[];
  for(let i=0;i<route.length;i+=stride)routeLite.push(route[i]);
  if(route.length&&routeLite.at(-1)!==route.at(-1))routeLite.push(route.at(-1));
  routeLite=densifyProjectedRoute(routeLite,.7,5200);
  const routeStyle=String(config.fabrication.routeStyle||"raised");
  const routeWidth=Math.max(.8,Number(config.fabrication.routeWidthMm)||1.6);
  const routeRise=Math.max(.5,Number(config.fabrication.routeRiseMm)||1.2);
  if(routeStyle==="raised")addSegments([routeLite],routeWidth,routeRise,5,4200);
  else if(routeStyle==="inlay")addSegments([routeLite],routeWidth,Math.max(.05,routeRise),5,4200);
  else if(routeStyle==="color")addSegments([routeLite],routeWidth,.1,5,4200);"""

if old_fm not in t:
    raise SystemExit("featureMeshes block missing")
t = t.replace(old_fm, new_fm, 1)

old_wd = """    if(material===4&&c.surface.waterMode!=="none"){
      relief-=Math.max(0,Number(c.surface.waterDepthMm)||0);
      if(c.surface.waterMode==="procedural-waves"){
        const spacing=Math.max(.4,Number(c.surface.waveSpacingMm)||2.6),amp=Math.max(0,Number(c.surface.waveHeightMm)||.3);
        const x=nx*projection.radius,y=ny*projection.radius;
        relief+=amp*(.58*Math.sin((x+y*.31)/spacing*Math.PI*2)+.28*Math.sin((y-x*.17)/spacing*Math.PI*3.1));
      }
    }"""
new_wd = """    if(material===4&&c.surface.waterMode!=="none"){
      relief-=Math.max(.45,Number(c.surface.waterDepthMm)||1.1);
      if(c.surface.waterMode==="procedural-waves"){
        const spacing=Math.max(.4,Number(c.surface.waveSpacingMm)||2.4),amp=Math.max(0,Number(c.surface.waveHeightMm)||.45);
        const x=nx*projection.radius,y=ny*projection.radius;
        relief+=amp*(.58*Math.sin((x+y*.31)/spacing*Math.PI*2)+.28*Math.sin((y-x*.17)/spacing*Math.PI*3.1));
      }
    }"""
if old_wd not in t:
    raise SystemExit("water depth block missing")
t = t.replace(old_wd, new_wd, 1)

old_med = """    if(medallionMode&&!landInsideNormalized(nx,ny)){
      if(c.surface.waterMode==="none")return 0;
      const spacing=Math.max(.6,Number(c.surface.waveSpacingMm)||2.8),amp=Math.max(0,Number(c.surface.waveHeightMm)||.12);
      const x=nx*projection.radius,y=ny*projection.radius;
      const wave=c.surface.waterMode==="procedural-waves"?amp*(.48*Math.sin((x+y*.28)/spacing*Math.PI*2)+.22*Math.sin((y-x*.16)/spacing*Math.PI*2.7)):0;
      return Math.max(.08,.22+wave);
    }"""
new_med = """    if(medallionMode&&!landInsideNormalized(nx,ny)){
      if(c.surface.waterMode==="none")return 0;
      const spacing=Math.max(.6,Number(c.surface.waveSpacingMm)||2.4),amp=Math.max(0,Number(c.surface.waveHeightMm)||.45);
      const x=nx*projection.radius,y=ny*projection.radius;
      const wave=c.surface.waterMode==="procedural-waves"?amp*(.55*Math.sin((x+y*.28)/spacing*Math.PI*2)+.28*Math.sin((y-x*.16)/spacing*Math.PI*2.7)):0;
      const waterDepth=Math.max(.35,Number(c.surface.waterDepthMm)||1.1);
      return Math.max(.06,Math.max(.18,.55-waterDepth*.35)+wave);
    }"""
if old_med not in t:
    raise SystemExit("medallion water block missing")
t = t.replace(old_med, new_med, 1)

p.write_text(t)
print("patched", p, "bytes", len(t))
