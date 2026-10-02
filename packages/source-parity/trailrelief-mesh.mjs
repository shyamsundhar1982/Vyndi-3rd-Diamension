const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const rad=Math.PI/180;

function pointInRing(x,y,ring=[]){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j],yi=a.y,yj=b.y,xi=a.x,xj=b.x;
    const hit=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi+1e-12)+xi);
    if(hit)inside=!inside;
  }
  return inside;
}
function segDist(x,y,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
  if(d2<1e-12)return Math.hypot(x-a.x,y-a.y);
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/d2));
  return Math.hypot(x-(a.x+t*dx),y-(a.y+t*dy));
}
function prepLandcover(features,lat0,lon0,cos){
  const out=[];
  for(const feature of features||[])for(const path of feature.paths||[]){
    const pts=path.map(p=>({x:(finite(p.lon)-lon0)*111320*cos,y:(finite(p.lat)-lat0)*110540}));
    if(pts.length<2)continue;
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of pts){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}
    out.push({kind:feature.kind,pts,minX,maxX,minY,maxY});
  }
  return out;
}
function landcoverAt(x,y,index){
  let forest=false,water=false;
  for(const item of index){
    if(x<item.minX-50||x>item.maxX+50||y<item.minY-50||y>item.maxY+50)continue;
    if(item.kind==="river"){
      for(let i=1;i<item.pts.length;i++)if(segDist(x,y,item.pts[i-1],item.pts[i])<=40){water=true;break}
    }else if(pointInRing(x,y,item.pts)){
      if(item.kind==="forest")forest=true;else water=true;
    }
    if(water)break;
  }
  return {forest,water};
}
function addTri(mesh,a,b,c,region){
  const base=mesh.vertices.length;
  mesh.vertices.push(a,b,c);mesh.triangles.push({a:base,b:base+1,c:base+2,region});
}
function addQuad(mesh,a,b,c,d,region){addTri(mesh,a,b,c,region);addTri(mesh,a,c,d,region)}
function addDisc(mesh,radius,z0,z1,segments,region){
  const centerTop={x:0,y:0,z:z1},centerBottom={x:0,y:0,z:z0};
  for(let i=0;i<segments;i++){
    const a0=i/segments*Math.PI*2,a1=(i+1)/segments*Math.PI*2,p0={x:Math.cos(a0)*radius,y:Math.sin(a0)*radius},p1={x:Math.cos(a1)*radius,y:Math.sin(a1)*radius};
    addTri(mesh,centerTop,{...p0,z:z1},{...p1,z:z1},region);
    addTri(mesh,centerBottom,{...p1,z:z0},{...p0,z:z0},region);
    addQuad(mesh,{...p0,z:z0},{...p1,z:z0},{...p1,z:z1},{...p0,z:z1},region);
  }
}
function addAnnulus(mesh,outer,inner,z0,z1,segments,region){
  for(let i=0;i<segments;i++){
    const a0=i/segments*Math.PI*2,a1=(i+1)/segments*Math.PI*2;
    const o0={x:Math.cos(a0)*outer,y:Math.sin(a0)*outer},o1={x:Math.cos(a1)*outer,y:Math.sin(a1)*outer},i0={x:Math.cos(a0)*inner,y:Math.sin(a0)*inner},i1={x:Math.cos(a1)*inner,y:Math.sin(a1)*inner};
    addQuad(mesh,{...i0,z:z1},{...i1,z:z1},{...o1,z:z1},{...o0,z:z1},region);
    addQuad(mesh,{...o0,z:z0},{...o1,z:z0},{...o1,z:z1},{...o0,z:z1},region);
    addQuad(mesh,{...i1,z:z0},{...i0,z:z0},{...i0,z:z1},{...i1,z:z1},region);
  }
}
function resampleRoute(points,toXY,maxStep){
  const out=[];let last=null;
  for(const point of points||[]){
    const p=toXY(point);
    if(!last){out.push({...p,segment:point.segment});last=p;continue}
    const dist=Math.hypot(p.x-last.x,p.y-last.y);if(dist<maxStep)continue;
    const steps=Math.max(1,Math.ceil(dist/maxStep));
    for(let k=1;k<=steps;k++)out.push({x:last.x+(p.x-last.x)*k/steps,y:last.y+(p.y-last.y)*k/steps,segment:point.segment});
    last=p;
  }
  return out;
}

export function buildTrailReliefSourceModel({points=[],routeBounds,demSampler,landcover=[],config={}}={}){
  if(points.length<2||typeof demSampler!=="function")throw new Error("TrailRelief source mesh needs route points and a DEM sampler.");
  const b=routeBounds||{
    minLat:Math.min(...points.map(p=>finite(p.lat))),maxLat:Math.max(...points.map(p=>finite(p.lat))),
    minLon:Math.min(...points.map(p=>finite(p.lon))),maxLon:Math.max(...points.map(p=>finite(p.lon)))
  };
  const lat0=(b.minLat+b.maxLat)/2,lon0=(b.minLon+b.maxLon)/2,cos=Math.max(.08,Math.cos(lat0*rad));
  const toMeters=point=>({x:(finite(point.lon)-lon0)*111320*cos,y:(finite(point.lat)-lat0)*110540});
  let groundR=0;for(const point of points){const p=toMeters(point);groundR=Math.max(groundR,Math.hypot(p.x,p.y))}
  groundR+=Math.max(0,finite(config.shape?.routeBufferKm,3))*1000;groundR=Math.max(1,groundR);
  const modelSize=Math.max(20,finite(config.fabrication?.modelWidthMm,180)),outer=modelSize/2,rimWidth=Math.max(0,Math.min(finite(config.fabrication?.rimWidthMm,12),outer*.4)),terrainR=outer-rimWidth;
  const n=Math.max(8,Math.min(400,Math.round(finite(config.production?.trailReliefResolution,220)))),cell=2*terrainR/n,mmPerM=terrainR/groundR,base=finite(config.fabrication?.baseMm,3),exaggeration=Math.max(.05,finite(config.production?.trailReliefExaggeration,2));
  const elev=new Float32Array((n+1)*(n+1));let minElev=Infinity,maxElev=-Infinity;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const xMm=-terrainR+i*cell,yMm=-terrainR+j*cell,xM=xMm/mmPerM,yM=yMm/mmPerM,lat=lat0+yM/110540,lon=lon0+xM/(111320*cos),value=finite(demSampler(lat,lon));
    elev[j*(n+1)+i]=value;if(xMm*xMm+yMm*yMm<=(terrainR+cell)*(terrainR+cell)){minElev=Math.min(minElev,Math.max(value,0));maxElev=Math.max(maxElev,Math.max(value,0))}
  }
  if(!Number.isFinite(minElev))minElev=0;if(!Number.isFinite(maxElev))maxElev=minElev+1;
  const height=new Float32Array(elev.length);for(let i=0;i<elev.length;i++)height[i]=base+1+(Math.max(elev[i],0)-minElev)*mmPerM*exaggeration;
  const cover=prepLandcover(landcover,lat0,lon0,cos),classGrid=new Int16Array(n*n);
  const regionOffset=region=>region===1?finite(config.surface?.forestRaiseMm,.4):(region===4||region===14)?-finite(config.surface?.waterDepthMm,.6):0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const xMm=-terrainR+(i+.5)*cell,yMm=-terrainR+(j+.5)*cell;if(xMm*xMm+yMm*yMm>(terrainR+cell*.7)**2){classGrid[j*n+i]=-1;continue}
    const ids=[j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i,(j+1)*(n+1)+i+1],avg=ids.reduce((s,id)=>s+elev[id],0)/4,xM=xMm/mmPerM,yM=yMm/mmPerM,lc=landcoverAt(xM,yM,cover);
    let region=0;if(lc.water)region=4;else if(maxElev>0&&avg<=.5)region=14;else if(avg>=finite(config.terrainBands?.snowM,2600))region=3;else{if(lc.forest)region=1;if(avg>=finite(config.terrainBands?.mountainM,1200))region=2}
    classGrid[j*n+i]=region;
  }
  const mesh={vertices:[],triangles:[]};
  addDisc(mesh,outer,0,base,128,13);
  if(rimWidth>=1)addAnnulus(mesh,outer,terrainR,base,base+finite(config.fabrication?.rimHeightMm,5),128,12);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const region=classGrid[j*n+i];if(region<0)continue;
    const x0=-terrainR+i*cell,x1=x0+cell,y0=-terrainR+j*cell,y1=y0+cell,off=regionOffset(region);
    const ids=[j*(n+1)+i,j*(n+1)+i+1,(j+1)*(n+1)+i+1,(j+1)*(n+1)+i];
    const z=ids.map(id=>Math.max(base+.2,height[id]+off));
    addQuad(mesh,{x:x0,y:y0,z:z[0]},{x:x1,y:y0,z:z[1]},{x:x1,y:y1,z:z[2]},{x:x0,y:y1,z:z[3]},region);
  }
  const sampleSurface=(x,y)=>{
    const gx=Math.max(0,Math.min(n-.001,(x+terrainR)/cell)),gy=Math.max(0,Math.min(n-.001,(y+terrainR)/cell)),ix=Math.floor(gx),iy=Math.floor(gy),tx=gx-ix,ty=gy-iy,p=(row,col)=>height[row*(n+1)+col];
    const h0=(p(iy,ix)*(1-tx)+p(iy,ix+1)*tx)*(1-ty)+(p(iy+1,ix)*(1-tx)+p(iy+1,ix+1)*tx)*ty,region=classGrid[Math.max(0,Math.min(n*n-1,iy*n+ix))];
    return h0+Math.max(0,regionOffset(region));
  };
  const route=resampleRoute(points,point=>{const p=toMeters(point);return{x:p.x*mmPerM,y:p.y*mmPerM}},Math.max(.25,cell/2));
  const width=Math.max(.1,finite(config.fabrication?.routeWidthMm,1.6))/2,rise=Math.max(.05,finite(config.fabrication?.routeRiseMm,1.2)),mode=config.fabrication?.routeStyle||"raised";
  if((mode==="raised"||mode==="inlay")&&route.length>1){
    const top=[],bottom=[];
    for(let i=0;i<route.length;i++){
      const prev=route[Math.max(0,i-1)],next=route[Math.min(route.length-1,i+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,surf=sampleSurface(route[i].x,route[i].y),topZ=surf+rise,bottomZ=mode==="inlay"?base:surf-.6;
      top.push([{x:route[i].x+nx*width,y:route[i].y+ny*width,z:topZ},{x:route[i].x-nx*width,y:route[i].y-ny*width,z:topZ}]);
      bottom.push([{x:route[i].x+nx*width,y:route[i].y+ny*width,z:bottomZ},{x:route[i].x-nx*width,y:route[i].y-ny*width,z:bottomZ}]);
    }
    for(let i=0;i<route.length-1;i++){
      if(route[i].segment!==route[i+1].segment)continue;
      addQuad(mesh,top[i][0],top[i+1][0],top[i+1][1],top[i][1],5);
      addQuad(mesh,bottom[i][1],bottom[i+1][1],bottom[i+1][0],bottom[i][0],5);
      addQuad(mesh,top[i][0],bottom[i][0],bottom[i+1][0],top[i+1][0],5);
      addQuad(mesh,top[i+1][1],bottom[i+1][1],bottom[i][1],top[i][1],5);
    }
  }
  return {source:"trailrelief-original",mesh,resolution:n,sizeMm:[modelSize,modelSize],mmPerKm:mmPerM*1000,groundR,minElev,maxElev,terrainRadiusMm:terrainR,outerRadiusMm:outer};
}
