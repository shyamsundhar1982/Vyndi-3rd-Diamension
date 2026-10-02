import earcut from "../vendor/earcut.mjs";
import { projectLonLat } from "./vector-map-core.mjs";

const area=ring=>ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p.x*q.y-q.x*p.y},0)/2;
const ringIndices=new WeakMap();
export function insideRing(x,y,ring){
  let index=ringIndices.get(ring);
  if(!index){
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of ring){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}
    const span=Math.max(1e-9,maxY-minY),rows=Array.from({length:64},()=>[]),row=y=>Math.max(0,Math.min(63,Math.floor((y-minY)/span*64)));
    for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];for(let r=row(Math.min(a.y,b.y));r<=row(Math.max(a.y,b.y));r++)rows[r].push([a,b])}
    index={minX,maxX,minY,maxY,span,rows};ringIndices.set(ring,index);
  }
  if(x<index.minX-1e-9||x>index.maxX+1e-9||y<index.minY-1e-9||y>index.maxY+1e-9)return false;
  let inside=false;
  const row=Math.max(0,Math.min(63,Math.floor((y-index.minY)/index.span*64)));
  for(const [a,b] of index.rows[row]){
    const cross=(x-a.x)*(b.y-a.y)-(y-a.y)*(b.x-a.x);
    if(Math.abs(cross)<1e-9&&x>=Math.min(a.x,b.x)-1e-9&&x<=Math.max(a.x,b.x)+1e-9&&y>=Math.min(a.y,b.y)-1e-9&&y<=Math.max(a.y,b.y)+1e-9)return true;
    if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function insidePolygons(x,y,polygons){
  return polygons.some(rings=>insideRing(x,y,rings[0])&&!rings.slice(1).some(ring=>insideRing(x,y,ring)));
}

export function projectGeographicOutline(geometry,bounds,size=1.8){
  const source=geometry?.type==="Polygon"?[geometry.coordinates]:geometry?.type==="MultiPolygon"?geometry.coordinates:null;
  if(!source?.length)throw new Error("This place has no polygon boundary. Choose a country or region with an outline.");
  let count=0;
  const polygons=source.map(rings=>rings.map(ring=>{
    const points=ring.map(pair=>{
      if(!Array.isArray(pair)||pair.length<2||!pair.slice(0,2).every(Number.isFinite)||Math.abs(pair[1])>90||Math.abs(pair[0])>180)throw new Error("Invalid geographic boundary coordinates.");
      if(++count>20000)throw new Error("Boundary is too detailed. Request a simplified boundary.");
      return projectLonLat({lon:pair[0],lat:pair[1]},bounds,size);
    });
    if(points.length>1&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-9)points.pop();
    if(points.length<3||Math.abs(area(points))<1e-12)throw new Error("Boundary contains a degenerate ring.");
    return points;
  }));
  if(polygons.some(rings=>rings.some(ring=>ring.some(p=>Math.abs(p.x)>1.05||Math.abs(p.y)>1.05))))throw new Error("The selected print area cuts the geographic outline. Use the full selected geography.");
  return polygons;
}

// Trace filled pixels as oriented boundary loops. Counters become holes, not filled triangles.
export function maskPolygons(image,{extent=1,threshold=.5,accept=()=>true}={}){
  const {width,height,data}=image,filled=new Uint8Array(width*height),edges=[],starts=new Map();
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const nx=((x+.5)/width*2-1)*extent,ny=(1-(y+.5)/height*2)*extent;
    filled[y*width+x]=data[(y*width+x)*4+3]>=threshold*255&&accept(nx,ny)?1:0;
  }
  const on=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&filled[y*width+x];
  const key=(x,y)=>y*(width+1)+x;
  const add=(x,y,xx,yy,dir)=>{
    const edge={x,y,xx,yy,dir,used:false};edges.push(edge);const k=key(x,y);if(!starts.has(k))starts.set(k,[]);starts.get(k).push(edge);
  };
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(on(x,y)){
    if(!on(x,y-1))add(x,y,x+1,y,0);
    if(!on(x+1,y))add(x+1,y,x+1,y+1,1);
    if(!on(x,y+1))add(x+1,y+1,x,y+1,2);
    if(!on(x-1,y))add(x,y+1,x,y,3);
  }
  const loops=[];
  for(const first of edges){
    if(first.used)continue;
    let current=first;const loop=[];
    while(current&&!current.used){
      current.used=true;loop.push({x:current.x,y:current.y});
      const choices=(starts.get(key(current.xx,current.yy))||[]).filter(e=>!e.used);
      // At diagonal contacts follow the right turn to keep independent solids independent.
      choices.sort((a,b)=>[1,0,3,2].indexOf((a.dir-current.dir+4)%4)-[1,0,3,2].indexOf((b.dir-current.dir+4)%4));
      current=choices[0];
    }
    if(loop.length<4)continue;
    const clean=loop.filter((p,i)=>{const a=loop[(i+loop.length-1)%loop.length],b=loop[(i+1)%loop.length];return (p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x)}).map(p=>({x:(p.x/width*2-1)*extent,y:(1-p.y/height*2)*extent}));
    if(clean.length>=3)loops.push(clean);
  }
  const outers=loops.filter(r=>area(r)<0).map(r=>[r]);
  for(const hole of loops.filter(r=>area(r)>0)){
    const candidates=outers.filter(p=>insideRing(hole[0].x,hole[0].y,p[0])).sort((a,b)=>Math.abs(area(a[0]))-Math.abs(area(b[0])));
    if(candidates[0])candidates[0].push(hole);
  }
  return outers;
}

// Conforming edge refinement: neighbours always share the same midpoint, avoiding T-junctions.
export function buildOutlineHeightfieldMesh({polygons,radiusMm=50,baseMm=3,heightAt=()=>0,bottomAt=()=>0,regionAt=()=>0,stepMm=.7,maxTriangles=700000}={}){
  const vertices=[],faces=[],edgeKey=(a,b)=>a<b?a+":"+b:b+":"+a;
  for(const rings of polygons||[]){
    const flat=[],holes=[];const start=vertices.length;
    for(let r=0;r<rings.length;r++){
      if(r)holes.push(flat.length/2);
      for(const p of rings[r]){flat.push(p.x*radiusMm,p.y*radiusMm);vertices.push({x:p.x*radiusMm,y:p.y*radiusMm})}
    }
    const indices=earcut(flat,holes,2);
    for(let i=0;i<indices.length;i+=3){
      const ids=indices.slice(i,i+3).map(id=>id+start),[a,b,c]=ids.map(id=>vertices[id]);
      if((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)<0)[ids[1],ids[2]]=[ids[2],ids[1]];
      faces.push(ids);
    }
  }
  if(!faces.length)throw new Error("Outline could not be triangulated.");
  let refined=faces;
  for(let pass=0;pass<20;pass++){
    const mid=new Map();
    for(const f of refined)for(let i=0;i<3;i++){
      const a=f[i],b=f[(i+1)%3],k=edgeKey(a,b),u=vertices[a],v=vertices[b];
      if(!mid.has(k)&&Math.hypot(u.x-v.x,u.y-v.y)>stepMm*1.01){mid.set(k,vertices.length);vertices.push({x:(u.x+v.x)/2,y:(u.y+v.y)/2})}
    }
    if(!mid.size)break;
    const next=[];
    for(const [a,b,c] of refined){
      const ab=mid.get(edgeKey(a,b)),bc=mid.get(edgeKey(b,c)),ca=mid.get(edgeKey(c,a)),mask=(ab!==undefined?1:0)|(bc!==undefined?2:0)|(ca!==undefined?4:0);
      if(mask===0)next.push([a,b,c]);
      else if(mask===1)next.push([a,ab,c],[ab,b,c]);
      else if(mask===2)next.push([b,bc,a],[bc,c,a]);
      else if(mask===4)next.push([c,ca,b],[ca,a,b]);
      else if(mask===3)next.push([b,bc,ab],[a,ab,c],[ab,bc,c]);
      else if(mask===6)next.push([c,ca,bc],[b,bc,a],[bc,ca,a]);
      else if(mask===5)next.push([a,ab,ca],[c,ca,b],[ca,ab,b]);
      else next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);
    }
    if(next.length>maxTriangles)throw new Error("Outline mesh exceeds the browser detail budget. Reduce map detail or size.");
    refined=next;
  }
  const count=vertices.length,top=vertices.map(p=>({...p,z:baseMm+heightAt(p.x/radiusMm,p.y/radiusMm)})),bottom=vertices.map(p=>({...p,z:bottomAt(p.x/radiusMm,p.y/radiusMm)})),triangles=[],edges=new Map();
  for(const [a,b,c] of refined){
    const p=vertices[a],q=vertices[b],r=vertices[c],region=regionAt((p.x+q.x+r.x)/(3*radiusMm),(p.y+q.y+r.y)/(3*radiusMm));
    triangles.push({a,b,c,region},{a:a+count,b:c+count,c:b+count,region});
    for(const [u,v] of [[a,b],[b,c],[c,a]]){const k=edgeKey(u,v);if(edges.has(k))edges.delete(k);else edges.set(k,[u,v])}
  }
  for(const [a,b] of edges.values())triangles.push({a,b:a+count,c:b+count,region:regionAt(vertices[a].x/radiusMm,vertices[a].y/radiusMm)},{a,b:b+count,c:b,region:regionAt(vertices[b].x/radiusMm,vertices[b].y/radiusMm)});
  return {vertices:[...top,...bottom],triangles};
}

export function logoFootprint({x=0,y=0,widthMm=16,rotation=0,aspect=1,diameterMm=100}={}){
  const half=widthMm/diameterMm,height=half/Math.max(.1,aspect),angle=rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  return [[-half,-height],[half,-height],[half,height],[-half,height]].map(([u,v])=>({x:x+u*c-v*s,y:y+u*s+v*c}));
}
export function footprintFits(points,inside){
  if(!points.every(p=>inside(p.x,p.y)))return false;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];for(let t=0;t<=1;t+=.1)if(!inside(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t))return false}
  // Interior samples protect against holes/enclaves and narrow concave notches.
  const [a,b,,d]=points;
  for(let u=0;u<=1;u+=.1)for(let v=0;v<=1;v+=.1)if(!inside(a.x+(b.x-a.x)*u+(d.x-a.x)*v,a.y+(b.y-a.y)*u+(d.y-a.y)*v))return false;
  return true;
}
export function findEmptyLogoPlacement(options,inside,occupancy){
  let best=null;
  for(let y=-.85;y<=.85;y+=.085)for(let x=-.85;x<=.85;x+=.085){
    const points=logoFootprint({...options,x,y});if(!footprintFits(points,inside))continue;
    const [a,b,,d]=points;let score=0;
    for(let u=0;u<=1;u+=.125)for(let v=0;v<=1;v+=.125)score+=occupancy(a.x+(b.x-a.x)*u+(d.x-a.x)*v,a.y+(b.y-a.y)*u+(d.y-a.y)*v);
    score+=Math.hypot(x,y)*.001;
    if(!best||score<best.score)best={x,y,score};
  }
  return best;
}
