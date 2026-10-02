const TAU=Math.PI*2;

function finite(value,fallback=0){const number=Number(value);return Number.isFinite(number)?number:fallback}
function clamp(value,min,max){return Math.max(min,Math.min(max,value))}
function nextMultiple(value,multiple){return Math.ceil(value/multiple)*multiple}

function triangleNormal(a,b,c){
  const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z;
  const vx=c.x-a.x,vy=c.y-a.y,vz=c.z-a.z;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
  const length=Math.hypot(nx,ny,nz)||1;
  return {x:nx/length,y:ny/length,z:nz/length};
}

function topRegion(vertices,indices,regionAt,radius){
  if(typeof regionAt!=="function")return 0;
  let cx=0,cy=0;
  for(const index of indices){
    const vertex=vertices[index];
    cx+=vertex.x;cy+=vertex.y;
  }
  return Math.max(0,Math.floor(finite(regionAt(cx/(indices.length*radius),cy/(indices.length*radius)),0)));
}

function meshShapeRadius(shape,angle,aspect=1.35){
  if(shape==="square")return 1/Math.max(Math.abs(Math.cos(angle)),Math.abs(Math.sin(angle)),1e-9);
  if(shape==="ellipse")return 1/Math.sqrt(Math.cos(angle)**2+(Math.sin(angle)*clamp(finite(aspect,1.35),.5,2.5))**2);
  if(shape==="hexagon"||shape==="octagon"){
    const n=shape==="hexagon"?6:8,sector=TAU/n;
    const local=((angle+sector/2)%sector+sector)%sector-sector/2;
    return Math.cos(Math.PI/n)/Math.max(1e-9,Math.cos(local));
  }
  if(shape==="heart")return clamp(.80-.16*Math.sin(angle)+.08*Math.sin(2*angle)-.03*Math.cos(3*angle),.52,1.08);
  return 1;
}

export function buildRadialMedalMesh(options={}){
  const diameterMm=Math.max(1,finite(options.diameterMm,100));
  const radius=diameterMm/2;
  const baseMm=Math.max(.2,finite(options.baseMm,3));
  const rings=Math.max(2,Math.floor(finite(options.rings,96)));
  const segments=Math.max(16,Math.floor(finite(options.segments,384)));
  const heightAt=typeof options.heightAt==="function"?options.heightAt:()=>0;
  const bottomAt=typeof options.bottomAt==="function"?options.bottomAt:()=>0;
  const regionAt=typeof options.regionAt==="function"?options.regionAt:()=>0;
  const shape=String(options.shape||"circle").toLowerCase(),aspect=finite(options.aspect,1.35);
  const vertices=[],triangles=[],topRings=[],bottomRings=[];

  const addVertex=(x,y,z)=>{vertices.push({x,y,z});return vertices.length-1};
  const addTopTriangle=(a,b,c)=>triangles.push({a,b,c,region:topRegion(vertices,[a,b,c],regionAt,radius)});
  const addBottomTriangle=(a,b,c)=>triangles.push({a,b,c,region:0});

  const centerTop=addVertex(0,0,baseMm+Math.max(0,finite(heightAt(0,0),0)));
  const centerBottom=addVertex(0,0,clamp(finite(bottomAt(0,0),0),0,Math.max(0,baseMm-.2)));
  for(let ring=1;ring<=rings;ring++){
    const topIndices=[],bottomIndices=[],fraction=ring/rings;
    for(let segment=0;segment<segments;segment++){
      const angle=TAU*segment/segments,boundary=meshShapeRadius(shape,angle,aspect);
      const rr=radius*fraction*boundary,x=rr*Math.cos(angle),y=rr*Math.sin(angle);
      const nx=x/radius,ny=y/radius;
      const topZ=baseMm+Math.max(0,finite(heightAt(nx,ny),0));
      const bottomZ=clamp(finite(bottomAt(nx,ny),0),0,Math.max(0,baseMm-.2));
      topIndices.push(addVertex(x,y,topZ));
      bottomIndices.push(addVertex(x,y,bottomZ));
    }
    topRings.push(topIndices);bottomRings.push(bottomIndices);
  }

  const firstTop=topRings[0],firstBottom=bottomRings[0];
  for(let s=0;s<segments;s++){
    const next=(s+1)%segments;
    addTopTriangle(centerTop,firstTop[s],firstTop[next]);
    addBottomTriangle(centerBottom,firstBottom[next],firstBottom[s]);
  }
  for(let ring=1;ring<rings;ring++){
    const innerTop=topRings[ring-1],outerTop=topRings[ring],innerBottom=bottomRings[ring-1],outerBottom=bottomRings[ring];
    for(let s=0;s<segments;s++){
      const next=(s+1)%segments;
      addTopTriangle(innerTop[s],outerTop[s],outerTop[next]);
      addTopTriangle(innerTop[s],outerTop[next],innerTop[next]);
      addBottomTriangle(innerBottom[s],outerBottom[next],outerBottom[s]);
      addBottomTriangle(innerBottom[s],innerBottom[next],outerBottom[next]);
    }
  }

  const topOuter=topRings[topRings.length-1],bottomOuter=bottomRings[bottomRings.length-1];
  for(let s=0;s<segments;s++){
    const next=(s+1)%segments;
    triangles.push({a:topOuter[s],b:bottomOuter[s],c:bottomOuter[next],region:0});
    triangles.push({a:topOuter[s],b:bottomOuter[next],c:topOuter[next],region:0});
  }

  return {vertices,triangles,diameterMm,baseMm,rings,segments,shape,aspect};
}

export function mergeMeshes(meshes=[]){
  const vertices=[],triangles=[];
  for(const mesh of meshes||[]){
    if(!mesh?.vertices?.length||!mesh?.triangles?.length)continue;
    const offset=vertices.length;
    for(const v of mesh.vertices)vertices.push({...v});
    for(const t of mesh.triangles)triangles.push({...t,a:t.a+offset,b:t.b+offset,c:t.c+offset});
  }
  return {vertices,triangles};
}

export function buildAnnulusMesh(options={}){
  const outer=Math.max(.5,finite(options.outerRadiusMm,7)),inner=clamp(finite(options.innerRadiusMm,3),.1,outer-.1);
  const height=Math.max(.2,finite(options.heightMm,3)),cx=finite(options.centerX,0),cy=finite(options.centerY,0);
  const segments=Math.max(16,Math.floor(finite(options.segments,64))),vertices=[],triangles=[];
  const add=(r,z,s)=>{const a=TAU*s/segments;vertices.push({x:cx+r*Math.cos(a),y:cy+r*Math.sin(a),z});return vertices.length-1};
  const ob=[],ot=[],ib=[],it=[];
  for(let s=0;s<segments;s++){ob.push(add(outer,0,s));ot.push(add(outer,height,s));ib.push(add(inner,0,s));it.push(add(inner,height,s));}
  for(let s=0;s<segments;s++){
    const n=(s+1)%segments;
    triangles.push(
      {a:ot[s],b:ot[n],c:it[n],region:3},{a:ot[s],b:it[n],c:it[s],region:3},
      {a:ob[s],b:ib[n],c:ob[n],region:0},{a:ob[s],b:ib[s],c:ib[n],region:0},
      {a:ob[s],b:ob[n],c:ot[n],region:0},{a:ob[s],b:ot[n],c:ot[s],region:0},
      {a:ib[s],b:it[n],c:ib[n],region:0},{a:ib[s],b:it[s],c:it[n],region:0}
    );
  }
  return {vertices,triangles};
}

function buildBoxMesh({width=10,depth=10,height=2,cx=0,cy=0,cz=0,region=0}={}){
  const hx=width/2,hy=depth/2,z0=cz,z1=cz+height;
  const vertices=[
    {x:cx-hx,y:cy-hy,z:z0},{x:cx+hx,y:cy-hy,z:z0},{x:cx+hx,y:cy+hy,z:z0},{x:cx-hx,y:cy+hy,z:z0},
    {x:cx-hx,y:cy-hy,z:z1},{x:cx+hx,y:cy-hy,z:z1},{x:cx+hx,y:cy+hy,z:z1},{x:cx-hx,y:cy+hy,z:z1}
  ];
  const q=(a,b,c,d,r=region)=>[{a,b,c,region:r},{a,b:c,c:d,region:r}];
  const triangles=[
    ...q(0,3,2,1,0),...q(4,5,6,7,region),
    ...q(0,1,5,4,0),...q(1,2,6,5,0),...q(2,3,7,6,0),...q(3,0,4,7,0)
  ];
  return {vertices,triangles};
}

export function buildDisplayStandMesh(options={}){
  const diameter=Math.max(30,finite(options.medalDiameterMm,100)),thickness=Math.max(2,finite(options.thicknessMm,4));
  const width=Math.max(45,diameter*.62),baseDepth=Math.max(32,diameter*.34),lipHeight=Math.max(5,diameter*.06);
  const bottomAt=typeof options.bottomAt==="function"?options.bottomAt:()=>0;
  const base=buildRectangularHeightfieldMesh({
    widthMm:width,heightMm:baseDepth,baseMm:thickness,
    columns:Math.max(40,Math.round(width/.8)),rows:Math.max(24,Math.round(baseDepth/.8)),
    heightAt:()=>0,bottomAt,regionAt:()=>0
  });
  const lip=buildBoxMesh({width:width*.9,depth:thickness*1.8,height:lipHeight,cx:0,cy:-baseDepth*.34,cz:thickness,region:3});
  const back=buildBoxMesh({width:width*.82,depth:thickness*1.8,height:diameter*.42,cx:0,cy:baseDepth*.24,cz:thickness,region:3});
  return mergeMeshes([base,lip,back]);
}

export function buildRectangularHeightfieldMesh(options={}){
  const width=Math.max(1,finite(options.widthMm,100)),height=Math.max(1,finite(options.heightMm,100)),base=Math.max(.2,finite(options.baseMm,3));
  const columns=Math.max(2,Math.floor(finite(options.columns,80))),rows=Math.max(2,Math.floor(finite(options.rows,80)));
  const heightAt=typeof options.heightAt==="function"?options.heightAt:()=>0,bottomAt=typeof options.bottomAt==="function"?options.bottomAt:()=>0,regionAt=typeof options.regionAt==="function"?options.regionAt:()=>0;
  const vertices=[],triangles=[],top=[],bottom=[];
  const addVertex=(x,y,z)=>{vertices.push({x,y,z});return vertices.length-1};
  for(let row=0;row<=rows;row++){
    const ty=row/rows,y=-height/2+height*ty,topRow=[],bottomRow=[];
    for(let col=0;col<=columns;col++){
      const tx=col/columns,x=-width/2+width*tx;
      topRow.push(addVertex(x,y,base+Math.max(0,finite(heightAt(x,y),0))));
      bottomRow.push(addVertex(x,y,clamp(finite(bottomAt(x,y),0),0,Math.max(0,base-.2))));
    }
    top.push(topRow);bottom.push(bottomRow);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=top[row][col],b=top[row][col+1],c=top[row+1][col+1],d=top[row+1][col];
    const cx=(-width/2+width*(col+.5)/columns),cy=(-height/2+height*(row+.5)/rows),region=Math.max(0,Math.floor(finite(regionAt(cx,cy),0)));
    triangles.push({a,b,c,region},{a,b:c,c:d,region});
    const ba=bottom[row][col],bb=bottom[row][col+1],bc=bottom[row+1][col+1],bd=bottom[row+1][col];
    triangles.push({a:ba,b:bc,c:bb,region:0},{a:ba,b:bd,c:bc,region:0});
  }
  const addSide=(ta,tb,ba,bb)=>{triangles.push({a:ta,b:ba,c:bb,region:0},{a:ta,b:bb,c:tb,region:0})};
  for(let col=0;col<columns;col++){
    addSide(top[0][col],top[0][col+1],bottom[0][col],bottom[0][col+1]);
    addSide(top[rows][col+1],top[rows][col],bottom[rows][col+1],bottom[rows][col]);
  }
  for(let row=0;row<rows;row++){
    addSide(top[row+1][0],top[row][0],bottom[row+1][0],bottom[row][0]);
    addSide(top[row][columns],top[row+1][columns],bottom[row][columns],bottom[row+1][columns]);
  }
  return {vertices,triangles,widthMm:width,heightMm:height,baseMm:base,columns,rows};
}

function buildPolygonPrism(points=[],heightMm=2,region=0){
  const polygon=(points||[]).map(p=>({x:finite(p.x),y:finite(p.y)}));
  if(polygon.length<3)throw new Error("At least three polygon points are required.");
  const h=Math.max(.2,finite(heightMm,2)),vertices=[],triangles=[],bottom=[],top=[];
  for(const p of polygon)bottom.push(vertices.push({x:p.x,y:p.y,z:0})-1);
  for(const p of polygon)top.push(vertices.push({x:p.x,y:p.y,z:h})-1);
  for(let i=1;i<polygon.length-1;i++){
    triangles.push({a:bottom[0],b:bottom[i+1],c:bottom[i],region:0});
    triangles.push({a:top[0],b:top[i],c:top[i+1],region});
  }
  for(let i=0;i<polygon.length;i++){
    const n=(i+1)%polygon.length;
    triangles.push({a:bottom[i],b:bottom[n],c:top[n],region:0},{a:bottom[i],b:top[n],c:top[i],region:0});
  }
  return {vertices,triangles};
}

export function buildDovetailKeyMesh(options={}){
  const length=Math.max(4,finite(options.lengthMm,16)),head=Math.max(2,finite(options.headWidthMm,8)),neck=clamp(finite(options.neckWidthMm,5),1,head-.2),height=Math.max(.6,finite(options.heightMm,2.4));
  const half=length/2;
  const points=[
    {x:-head/2,y:-half},{x:head/2,y:-half},{x:neck/2,y:-length*.12},{x:head/2,y:half},{x:-head/2,y:half},{x:-neck/2,y:length*.12}
  ];
  return buildPolygonPrism(points,height,3);
}

export function buildCylinderMesh(options={}){
  const diameter=Math.max(.5,finite(options.diameterMm,8)),height=Math.max(.2,finite(options.heightMm,2));
  const segments=Math.max(12,Math.floor(finite(options.segments,48))),radius=diameter/2;
  const points=Array.from({length:segments},(_,index)=>{
    const angle=TAU*index/segments;
    return {x:Math.cos(angle)*radius,y:Math.sin(angle)*radius};
  });
  return buildPolygonPrism(points,height,Math.max(0,Math.floor(finite(options.region,3))));
}


function polygonArea(points=[]){
  let area=0;for(let i=0,j=points.length-1;i<points.length;j=i++)area+=(points[j].x*points[i].y-points[i].x*points[j].y);
  return area/2;
}
function pointInTriangle2d(p,a,b,c){
  const area=(u,v,w)=>(u.x*(v.y-w.y)+v.x*(w.y-u.y)+w.x*(u.y-v.y));
  const s1=area(p,a,b),s2=area(p,b,c),s3=area(p,c,a),hasNeg=s1<0||s2<0||s3<0,hasPos=s1>0||s2>0||s3>0;
  return !(hasNeg&&hasPos);
}
function triangulatePolygon(points=[]){
  const pts=points.map((p,index)=>({x:finite(p.x),y:finite(p.y),index}));
  if(pts.length<3)return [];
  const ccw=polygonArea(pts)>0,indices=pts.map((_,i)=>i),triangles=[];
  let guard=0;
  while(indices.length>3&&guard++<10000){
    let clipped=false;
    for(let i=0;i<indices.length;i++){
      const ia=indices[(i-1+indices.length)%indices.length],ib=indices[i],ic=indices[(i+1)%indices.length],a=pts[ia],b=pts[ib],c=pts[ic];
      const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
      if(ccw?cross<=1e-10:cross>=-1e-10)continue;
      let contains=false;
      for(const id of indices){if(id===ia||id===ib||id===ic)continue;if(pointInTriangle2d(pts[id],a,b,c)){contains=true;break}}
      if(contains)continue;
      triangles.push(ccw?[ia,ib,ic]:[ic,ib,ia]);indices.splice(i,1);clipped=true;break;
    }
    if(!clipped)break;
  }
  if(indices.length===3)triangles.push(ccw?[indices[0],indices[1],indices[2]]:[indices[2],indices[1],indices[0]]);
  if(!triangles.length&&pts.length>=3)for(let i=1;i<pts.length-1;i++)triangles.push(ccw?[0,i,i+1]:[i+1,i,0]);
  return triangles;
}

export function buildExtrudedPolygonMesh(options={}){
  let points=(options.points||[]).map(p=>({x:finite(p.x),y:finite(p.y)}));
  if(points.length>2&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<1e-9)points=points.slice(0,-1);
  if(points.length<3)throw new Error("Building footprint needs at least three unique points.");
  const baseZAt=typeof options.baseZAt==="function"?options.baseZAt:()=>finite(options.baseZ,0),height=Math.max(.1,finite(options.heightMm,3)),region=Math.max(0,Math.floor(finite(options.region,7)));
  const bases=points.map(p=>finite(baseZAt(p.x,p.y),0));let highestBase=-Infinity;
  for(const base of bases)if(base>highestBase)highestBase=base;
  const topZ=(bases.length?highestBase:0)+height,vertices=[];
  const bottom=points.map((p,i)=>vertices.push({x:p.x,y:p.y,z:bases[i]})-1),top=points.map(p=>vertices.push({x:p.x,y:p.y,z:topZ})-1),triangles=[];
  const faces=triangulatePolygon(points);
  for(const [a,b,c] of faces){triangles.push({a:top[a],b:top[b],c:top[c],region});triangles.push({a:bottom[c],b:bottom[b],c:bottom[a],region:0})}
  for(let i=0;i<points.length;i++){const n=(i+1)%points.length;triangles.push({a:bottom[i],b:bottom[n],c:top[n],region},{a:bottom[i],b:top[n],c:top[i],region})}
  return {vertices,triangles};
}

function parseHexColor(value){
  const raw=String(value||"#808080").replace("#",""),hex=raw.length>=6?raw.slice(0,6):"808080";
  return [parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255];
}

export function encodeMtl(materials=[]){
  return (materials||[]).map((material,index)=>{
    const rgb=parseHexColor(material.color),name=String(material.name||("Material_"+index)).replace(/\s+/g,"_");
    return "newmtl "+name+"\nKd "+rgb[0].toFixed(6)+" "+rgb[1].toFixed(6)+" "+rgb[2].toFixed(6)+"\nKa 0 0 0\nKs 0 0 0\nd 1.0\nillum 1\n";
  }).join("\n");
}

export function encodeObj(mesh,options={}){
  const materials=options.materials||[],lines=["# "+String(options.name||"VYNDI Terrain")];
  if(options.mtlFile)lines.push("mtllib "+options.mtlFile);
  for(const v of mesh?.vertices||[])lines.push("v "+finite(v.x).toFixed(6)+" "+finite(v.y).toFixed(6)+" "+finite(v.z).toFixed(6));
  let current=null;
  for(const t of mesh?.triangles||[]){
    const region=clamp(Math.floor(finite(t.region,0)),0,Math.max(0,materials.length-1));
    if(region!==current){
      const material=materials[region],name=String(material?.name||("Material_"+region)).replace(/\s+/g,"_");
      lines.push("usemtl "+name);current=region;
    }
    lines.push("f "+(t.a+1)+" "+(t.b+1)+" "+(t.c+1));
  }
  return lines.join("\n")+"\n";
}

function align4(value){return (value+3)&~3}
function writeU32(view,offset,value){view.setUint32(offset,value>>>0,true)}
export function encodeGlb(mesh,options={}){
  const vertices=mesh?.vertices||[],triangles=mesh?.triangles||[],materials=(options.materials?.length?options.materials:[{name:"Terrain",color:"#808080FF"}]);
  const encoder=new TextEncoder(),positionBytes=vertices.length*12,regions=new Map();
  for(const t of triangles){const region=clamp(Math.floor(finite(t.region,0)),0,materials.length-1);if(!regions.has(region))regions.set(region,[]);regions.get(region).push(t.a,t.b,t.c)}
  const texture=options.texture?.png?.length&&typeof options.texture.uv==="function"?options.texture:null;
  const uvOffset=align4(positionBytes),uvBytes=texture?vertices.length*8:0;
  let binaryLength=align4(uvOffset+uvBytes),offset=binaryLength;const regionOffsets=new Map();
  for(const [region,indices] of regions){regionOffsets.set(region,{offset,count:indices.length});binaryLength=align4(offset+indices.length*4);offset=binaryLength}
  const imageOffset=binaryLength;
  if(texture)binaryLength=align4(binaryLength+texture.png.length);
  const binary=new Uint8Array(binaryLength),view=new DataView(binary.buffer);
  vertices.forEach((v,i)=>{view.setFloat32(i*12,finite(v.x),true);view.setFloat32(i*12+4,finite(v.y),true);view.setFloat32(i*12+8,finite(v.z),true)});
  if(texture){vertices.forEach((v,i)=>{const uv=texture.uv(v);view.setFloat32(uvOffset+i*8,finite(uv.u),true);view.setFloat32(uvOffset+i*8+4,finite(uv.v),true)});binary.set(texture.png,imageOffset);}
  for(const [region,indices] of regions){const info=regionOffsets.get(region);indices.forEach((value,i)=>view.setUint32(info.offset+i*4,value,true))}
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  for(const vertex of vertices){
    const x=finite(vertex.x),y=finite(vertex.y),z=finite(vertex.z);
    if(x<minX)minX=x;if(x>maxX)maxX=x;
    if(y<minY)minY=y;if(y>maxY)maxY=y;
    if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;
  }
  const min=vertices.length?[minX,minY,minZ]:[0,0,0],max=vertices.length?[maxX,maxY,maxZ]:[0,0,0];
  const bufferViews=[{buffer:0,byteOffset:0,byteLength:positionBytes,target:34962}],accessors=[{bufferView:0,componentType:5126,count:vertices.length,type:"VEC3",min,max}],primitives=[];
  let uvAccessor=null,imageView=null;
  if(texture){
    const uvView=bufferViews.length;bufferViews.push({buffer:0,byteOffset:uvOffset,byteLength:uvBytes,target:34962});
    uvAccessor=accessors.length;accessors.push({bufferView:uvView,componentType:5126,count:vertices.length,type:"VEC2"});
    imageView=bufferViews.length;bufferViews.push({buffer:0,byteOffset:imageOffset,byteLength:texture.png.length});
  }
  for(const [region,indices] of regions){
    const info=regionOffsets.get(region),bufferView=bufferViews.length;bufferViews.push({buffer:0,byteOffset:info.offset,byteLength:indices.length*4,target:34963});
    const accessor=accessors.length;accessors.push({bufferView,componentType:5125,count:indices.length,type:"SCALAR"});
    primitives.push({attributes:{POSITION:0,...(texture&&region===texture.region?{TEXCOORD_0:uvAccessor}:{})},indices:accessor,material:region,mode:4});
  }
  const gltf={
    asset:{version:"2.0",generator:"VYNDI 3rd Diamension"},scene:0,scenes:[{nodes:[0]}],nodes:[{
      mesh:0,
      name:String(options.title||"VYNDI Terrain"),
      rotation:[-0.7071067811865476,0,0,0.7071067811865476]
    }],
    meshes:[{primitives}],
    materials:materials.map(material=>{
      const rgb=parseHexColor(material.color),raw=String(material.color||"").replace("#",""),alpha=raw.length>=8?parseInt(raw.slice(6,8),16)/255:1;
      const out={name:String(material.name||"Material"),pbrMetallicRoughness:{baseColorFactor:[rgb[0],rgb[1],rgb[2],alpha],metallicFactor:0,roughnessFactor:.88}};
      if(material.emissive){
        const e=parseHexColor(material.emissive);
        out.emissiveFactor=[Math.min(.35,e[0]*.35),Math.min(.35,e[1]*.35),Math.min(.35,e[2]*.35)];
      }
      return out;
    }),
    buffers:[{byteLength:binary.length}],bufferViews,accessors
  };
  if(texture){
    gltf.images=[{bufferView:imageView,mimeType:"image/png"}];gltf.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}];gltf.textures=[{source:0,sampler:0}];
    gltf.materials[texture.region].pbrMetallicRoughness.baseColorTexture={index:0};
  }
  const jsonBytes=encoder.encode(JSON.stringify(gltf)),jsonPadded=align4(jsonBytes.length),binPadded=align4(binary.length),total=12+8+jsonPadded+8+binPadded;
  const out=new Uint8Array(total),outView=new DataView(out.buffer);writeU32(outView,0,0x46546c67);writeU32(outView,4,2);writeU32(outView,8,total);writeU32(outView,12,jsonPadded);writeU32(outView,16,0x4e4f534a);out.fill(0x20,20,20+jsonPadded);out.set(jsonBytes,20);
  const binHeader=20+jsonPadded;writeU32(outView,binHeader,binPadded);writeU32(outView,binHeader+4,0x004e4942);out.set(binary,binHeader+8);
  return out;
}

export function buildPrintValidationCoupon(options={}){
  const technology=String(options.technology||"FDM"),nozzle=Math.max(.1,finite(options.nozzleMm,.4)),minFeature=Math.max(.1,finite(options.minFeatureMm,.8)),minEmboss=Math.max(.05,finite(options.minEmbossMm,.3));
  const base=buildBoxMesh({width:80,depth:40,height:2.4,cx:0,cy:0,cz:0,region:0}),meshes=[base],features=[];
  const widths=[minFeature*.6,minFeature*.8,minFeature,minFeature*1.2].map(v=>Number(v.toFixed(3)));
  widths.forEach((width,i)=>{meshes.push(buildBoxMesh({width,depth:28,height:Math.max(minEmboss,.3),cx:-30+i*10,cy:0,cz:2.4,region:i<2?2:4}));features.push({kind:"raised-line",widthMm:width,heightMm:Math.max(minEmboss,.3)})});
  const heights=[minEmboss*.6,minEmboss,minEmboss*1.5].map(v=>Number(v.toFixed(3)));
  heights.forEach((height,i)=>{meshes.push(buildBoxMesh({width:8,depth:8,height,cx:15+i*12,cy:0,cz:2.4,region:5+i%2}));features.push({kind:"emboss",widthMm:8,heightMm:height})});
  const mesh=mergeMeshes(meshes),manifest={schema:"vyndi.print-validation/v1",technology,nozzleMm:nozzle,minFeatureMm:minFeature,minEmbossMm:minEmboss,features,requiredChecks:["watertight","thin-feature","emboss-height","material-region","first-layer","dimensional-tolerance"],result:"UNVALIDATED — requires slicer inspection and physical print evidence"};
  return {mesh,features,manifest};
}

export function meshEdgeUse(mesh){
  const counts=new Map();
  const add=(a,b)=>{
    const key=a<b?`${a}:${b}`:`${b}:${a}`;
    counts.set(key,(counts.get(key)||0)+1);
  };
  for(const triangle of mesh?.triangles||[]){
    add(triangle.a,triangle.b);add(triangle.b,triangle.c);add(triangle.c,triangle.a);
  }
  let boundaryEdges=0,nonManifoldEdges=0;
  for(const count of counts.values()){
    if(count===1)boundaryEdges++;
    else if(count!==2)nonManifoldEdges++;
  }
  return {edges:counts.size,boundaryEdges,nonManifoldEdges};
}

export function encodeBinaryStl(mesh,metadata={}){
  const triangles=mesh?.triangles||[],vertices=mesh?.vertices||[];
  const bytes=new Uint8Array(84+triangles.length*50);
  const header=new TextEncoder().encode(String(metadata.name||"VYNDI Terrain Medal").slice(0,80));
  bytes.set(header.slice(0,80),0);
  const view=new DataView(bytes.buffer);
  view.setUint32(80,triangles.length,true);
  let offset=84;
  for(const triangle of triangles){
    const a=vertices[triangle.a],b=vertices[triangle.b],c=vertices[triangle.c];
    const normal=triangleNormal(a,b,c);
    for(const value of [normal.x,normal.y,normal.z,a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z]){
      view.setFloat32(offset,value,true);offset+=4;
    }
    view.setUint16(offset,0,true);offset+=2;
  }
  return bytes;
}

function xmlEscape(value=""){
  return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]));
}

function crc32(bytes){
  let crc=0xffffffff;
  for(const byte of bytes){
    crc^=byte;
    for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}

function u16(value){return [value&255,(value>>>8)&255]}
function u32(value){return [value&255,(value>>>8)&255,(value>>>16)&255,(value>>>24)&255]}

function zipStore(files){
  const encoder=new TextEncoder(),locals=[],centrals=[];
  let localOffset=0;
  for(const file of files){
    const nameBytes=encoder.encode(file.name),data=file.data instanceof Uint8Array?file.data:encoder.encode(String(file.data));
    const crc=crc32(data);
    const local=new Uint8Array(30+nameBytes.length+data.length);
    let p=0;
    const push=(values)=>{local.set(values,p);p+=values.length};
    push([0x50,0x4b,0x03,0x04]);push(u16(20));push(u16(0));push(u16(0));push(u16(0));push(u16(0));push(u32(crc));push(u32(data.length));push(u32(data.length));push(u16(nameBytes.length));push(u16(0));push(nameBytes);push(data);
    locals.push(local);

    const central=new Uint8Array(46+nameBytes.length);p=0;
    const cpush=(values)=>{central.set(values,p);p+=values.length};
    cpush([0x50,0x4b,0x01,0x02]);cpush(u16(20));cpush(u16(20));cpush(u16(0));cpush(u16(0));cpush(u16(0));cpush(u16(0));cpush(u32(crc));cpush(u32(data.length));cpush(u32(data.length));cpush(u16(nameBytes.length));cpush(u16(0));cpush(u16(0));cpush(u16(0));cpush(u16(0));cpush(u32(0));cpush(u32(localOffset));cpush(nameBytes);
    centrals.push(central);
    localOffset+=local.length;
  }
  const centralSize=centrals.reduce((sum,item)=>sum+item.length,0),centralOffset=localOffset;
  const end=new Uint8Array(22);let p=0;
  const epush=(values)=>{end.set(values,p);p+=values.length};
  epush([0x50,0x4b,0x05,0x06]);epush(u16(0));epush(u16(0));epush(u16(files.length));epush(u16(files.length));epush(u32(centralSize));epush(u32(centralOffset));epush(u16(0));
  const total=locals.reduce((sum,item)=>sum+item.length,0)+centralSize+end.length;
  const output=new Uint8Array(total);let offset=0;
  for(const item of locals){output.set(item,offset);offset+=item.length}
  for(const item of centrals){output.set(item,offset);offset+=item.length}
  output.set(end,offset);
  return output;
}

export function encodeArtifactZip(files=[]){ return zipStore(files); }

export function encode3mf(mesh,options={}){
  const materials=(options.materials?.length?options.materials:[
    {name:"Terrain",color:"#343A3EFF"},
    {name:"Water",color:"#2F9BC1FF"},
    {name:"Route",color:"#FF5C35FF"},
    {name:"Annotations",color:"#B8F229FF"}
  ]).map(material=>({
    name:String(material.name||"Material"),
    color:/^#[0-9A-F]{8}$/i.test(String(material.color||""))?String(material.color).toUpperCase():"#808080FF"
  }));
  const verticesXml=(mesh?.vertices||[]).map(vertex=>`<vertex x="${finite(vertex.x).toFixed(5)}" y="${finite(vertex.y).toFixed(5)}" z="${finite(vertex.z).toFixed(5)}"/>`).join("");
  const trianglesXml=(mesh?.triangles||[]).map(triangle=>{
    const region=clamp(Math.floor(finite(triangle.region,0)),0,materials.length-1);
    return `<triangle v1="${triangle.a}" v2="${triangle.b}" v3="${triangle.c}" pid="1" p1="${region}"/>`;
  }).join("");
  const materialXml=materials.map(material=>`<base name="${xmlEscape(material.name)}" displaycolor="${material.color}"/>`).join("");
  const title=xmlEscape(options.title||"VYNDI Terrain Medal");
  const model=`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${title}</metadata><resources><basematerials id="1">${materialXml}</basematerials><object id="2" type="model"><mesh><vertices>${verticesXml}</vertices><triangles>${trianglesXml}</triangles></mesh></object></resources><build><item objectid="2"/></build></model>`;
  const contentTypes=`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipStore([
    {name:"[Content_Types].xml",data:contentTypes},
    {name:"_rels/.rels",data:rels},
    {name:"3D/3dmodel.model",data:model}
  ]);
}

export function productionResolution({diameterMm=101.6,minFeatureMm=.8,technology="FDM"}={}){
  const radius=Math.max(1,finite(diameterMm,101.6)/2);
  const feature=Math.max(.1,finite(minFeatureMm,.8));
  const tech=String(technology||"").toUpperCase();
  const minimumStep=(tech.includes("SLA")||tech.includes("MSLA")) ? .22 : .26;
  const step=clamp(feature*.45,minimumStep,.45);
  const rings=clamp(Math.ceil(radius/step),64,180);
  const segments=clamp(nextMultiple(Math.max(192,rings*4),8),192,720);
  return {rings,segments,stepMm:Number((radius/rings).toFixed(3))};
}

export function validateProductionProfile(profile,medal={}){
  const warnings=[];
  if(!profile)return ["Select a supported production profile."];
  const diameter=Math.max(0,finite(medal.diameterMm,0));
  const routeWidth=Math.max(0,finite(medal.routeWidthMm,0));
  const routeRise=Math.max(0,finite(medal.routeRiseMm,0));
  const routeStyle=String(medal.routeStyle||"raised");
  const totalHeight=Math.max(0,finite(medal.totalHeightMm,0));
  const bed=Array.isArray(profile.bed)?profile.bed.map(value=>finite(value,0)):[0,0,0];
  const shortSide=Math.min(...bed.slice(0,2).filter(value=>value>0));
  if(shortSide&&diameter>shortSide&&!medal.allowOversize)warnings.push(`Model width ${diameter.toFixed(1)} mm exceeds the ${profile.label||"printer"} short build dimension of ${shortSide} mm.`);
  if(bed[2]&&totalHeight>bed[2])warnings.push(`Model height ${totalHeight.toFixed(1)} mm exceeds build height ${bed[2]} mm.`);
  if(profile.minFeature&&routeStyle!=="none"&&routeWidth<profile.minFeature)warnings.push(`Route width should be at least ${profile.minFeature} mm for ${profile.label||"this profile"}.`);
  if(profile.minEmboss&&!["none","color"].includes(routeStyle)&&routeRise<profile.minEmboss)warnings.push(`Route height/depth should be at least ${profile.minEmboss} mm for ${profile.label||"this profile"}.`);
  return warnings;
}
