const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;

export const FABRICATION_SHAPES=Object.freeze({
  circle:{label:"Circle"},
  square:{label:"Square"},
  triangle:{label:"Triangle"},
  ellipse:{label:"Ellipse"},
  hexagon:{label:"Hexagon"},
  octagon:{label:"Octagon"},
  heart:{label:"Heart"}
});

export function shapeBoundaryRadius(shape="circle",angle=0,options={}){
  const a=finite(angle,0),kind=FABRICATION_SHAPES[shape]?shape:"circle";
  if(kind==="circle")return 1;
  if(kind==="square"){
    const d=Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)),1e-9);
    return 1/d;
  }
  if(kind==="ellipse"){
    const aspect=clamp(finite(options.aspect,1.35),.5,2.5);
    return 1/Math.sqrt(Math.cos(a)**2+(Math.sin(a)*aspect)**2);
  }
  if(kind==="triangle"||kind==="hexagon"||kind==="octagon"){
    const n=kind==="triangle"?3:kind==="hexagon"?6:8,sector=TAU/n;
    let local=((a+sector/2)%sector+sector)%sector-sector/2;
    return Math.cos(Math.PI/n)/Math.max(1e-9,Math.cos(local));
  }
  // Smooth, star-shaped heart suitable for radial meshing.
  const r=.80-.16*Math.sin(a)+.08*Math.sin(2*a)-.03*Math.cos(3*a);
  return clamp(r,.52,1.08);
}

export function shapeMaxRadius(shape="circle",options={}){
  let max=0;
  for(let i=0;i<360;i++)max=Math.max(max,shapeBoundaryRadius(shape,i/360*TAU,options));
  return max||1;
}

export function pointInsideShape(x,y,shape="circle",options={}){
  const radius=Math.hypot(finite(x),finite(y));
  if(radius<1e-9)return true;
  return radius<=shapeBoundaryRadius(shape,Math.atan2(finite(y),finite(x)),options)+1e-9;
}

export function contourEmbossHeight(reliefMm,options={}){
  if(!options.enabled)return 0;
  const interval=Math.max(.05,finite(options.intervalMm,1));
  const width=Math.max(.001,finite(options.widthMm,.08));
  const rise=Math.max(0,finite(options.riseMm,.2));
  const value=Math.max(0,finite(reliefMm,0));
  const remainder=((value%interval)+interval)%interval;
  const distance=Math.min(remainder,interval-remainder);
  if(distance>width)return 0;
  return rise*(1-distance/Math.max(width,1e-9));
}

export function magnetPocketDepth(xMm,yMm,pockets=[]){
  let depth=0;
  for(const pocket of pockets||[]){
    const radius=Math.max(0,finite(pocket.diameterMm,0)/2);
    const dx=finite(xMm)-finite(pocket.xMm),dy=finite(yMm)-finite(pocket.yMm);
    if(radius>0&&Math.hypot(dx,dy)<=radius)depth=Math.max(depth,Math.max(0,finite(pocket.depthMm,0)));
  }
  return depth;
}

export function rasterSampler(image,options={}){
  const width=Math.max(1,Math.floor(finite(image?.width,1))),height=Math.max(1,Math.floor(finite(image?.height,1)));
  const data=image?.data||new Uint8ClampedArray(width*height*4);
  const channel=options.channel||"alpha";
  const read=(ix,iy)=>{
    const x=clamp(ix,0,width-1),y=clamp(iy,0,height-1),o=(y*width+x)*4;
    if(channel==="luminance")return clamp((data[o]*.2126+data[o+1]*.7152+data[o+2]*.0722)/255,0,1);
    if(channel==="red")return clamp(data[o]/255,0,1);
    return clamp(data[o+3]/255,0,1);
  };
  return (nx,ny)=>{
    const fx=clamp((finite(nx)+1)*.5*(width-1),0,width-1);
    const fy=clamp((1-finite(ny))*.5*(height-1),0,height-1);
    const x0=Math.floor(fx),y0=Math.floor(fy),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),tx=fx-x0,ty=fy-y0;
    const a=read(x0,y0)*(1-tx)+read(x1,y0)*tx;
    const b=read(x0,y1)*(1-tx)+read(x1,y1)*tx;
    return a*(1-ty)+b*ty;
  };
}

export function parseArcAsciiGrid(text=""){
  const lines=String(text).replace(/\r/g,"").split("\n").map(line=>line.trim()).filter(Boolean);
  const header={};let dataStart=0;
  for(let i=0;i<Math.min(lines.length,12);i++){
    const parts=lines[i].split(/\s+/),key=parts[0]?.toLowerCase();
    if(["ncols","nrows","xllcorner","xllcenter","yllcorner","yllcenter","cellsize","nodata_value"].includes(key)){
      header[key]=Number(parts[1]);dataStart=i+1;
    }else break;
  }
  const ncols=Math.floor(header.ncols),nrows=Math.floor(header.nrows),cellsize=finite(header.cellsize,0);
  if(!(ncols>0&&nrows>0&&cellsize>0))throw new Error("Invalid Arc ASCII Grid header.");
  const values=[];
  for(const line of lines.slice(dataStart))for(const token of line.split(/\s+/))if(token!=="")values.push(Number(token));
  if(values.length<ncols*nrows)throw new Error("Arc ASCII Grid contains fewer samples than declared.");
  const nodata=Number.isFinite(header.nodata_value)?header.nodata_value:-9999;
  return {
    ncols,nrows,cellsize,nodata,
    xllcorner:Number.isFinite(header.xllcorner)?header.xllcorner:header.xllcenter-cellsize/2,
    yllcorner:Number.isFinite(header.yllcorner)?header.yllcorner:header.yllcenter-cellsize/2,
    values:values.slice(0,ncols*nrows)
  };
}

export function sampleArcAsciiGrid(grid,lat,lon){
  if(!grid)return null;
  const fx=(finite(lon)-grid.xllcorner)/grid.cellsize-.5;
  const fromSouth=(finite(lat)-grid.yllcorner)/grid.cellsize-.5;
  const fy=(grid.nrows-1)-fromSouth;
  const x=clamp(fx,0,grid.ncols-1),y=clamp(fy,0,grid.nrows-1);
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(grid.ncols-1,x0+1),y1=Math.min(grid.nrows-1,y0+1),tx=x-x0,ty=y-y0;
  const get=(ix,iy)=>{
    const value=grid.values[iy*grid.ncols+ix];
    return value===grid.nodata||!Number.isFinite(value)?null:value;
  };
  const q=[get(x0,y0),get(x1,y0),get(x0,y1),get(x1,y1)];
  if(q.every(v=>v===null))return null;
  const fallback=q.find(v=>v!==null)??0;
  const [a,b,c,d]=q.map(v=>v===null?fallback:v);
  const top=a*(1-tx)+b*tx,bottom=c*(1-tx)+d*tx;
  return top*(1-ty)+bottom*ty;
}

export function dovetailKeyProfile(options={}){
  const neck=Math.max(.5,finite(options.neckMm,5)),head=Math.max(neck+.2,finite(options.headMm,8)),depth=Math.max(.5,finite(options.depthMm,4));
  return [
    {x:-head/2,y:depth},
    {x:-neck/2,y:0},
    {x:neck/2,y:0},
    {x:head/2,y:depth}
  ];
}

export function dovetailSlotDepth(xMm,yMm,tile={},connector={},options={}){
  const length=Math.max(4,finite(options.lengthMm,16)),head=Math.max(2,finite(options.headWidthMm,8)),neck=clamp(finite(options.neckWidthMm,5),1,head-.2),depth=Math.max(.2,finite(options.depthMm,2));
  const halfLength=length/2,halfW=finite(tile.widthMm,0)/2,halfH=finite(tile.heightMm,0)/2,side=connector.side;
  let inward=null,cross=0;
  if(side==="right"){inward=halfW-finite(xMm);cross=finite(yMm)}
  else if(side==="left"){inward=finite(xMm)+halfW;cross=finite(yMm)}
  else if(side==="top"){inward=halfH-finite(yMm);cross=finite(xMm)}
  else if(side==="bottom"){inward=finite(yMm)+halfH;cross=finite(xMm)}
  else return 0;
  if(inward<0||inward>halfLength)return 0;
  const width=neck+(head-neck)*(inward/halfLength);
  return Math.abs(cross)<=width/2?depth:0;
}

export function alignmentSocketDepth(xMm,yMm,tile={},connector={},options={}){
  const radius=Math.max(.5,finite(options.diameterMm,8)/2),depth=Math.max(.2,finite(options.depthMm,2));
  const halfW=finite(tile.widthMm,0)/2,halfH=finite(tile.heightMm,0)/2,side=connector.side;
  let inward=null,cross=0;
  if(side==="right"){inward=halfW-finite(xMm);cross=finite(yMm)}
  else if(side==="left"){inward=finite(xMm)+halfW;cross=finite(yMm)}
  else if(side==="top"){inward=halfH-finite(yMm);cross=finite(xMm)}
  else if(side==="bottom"){inward=finite(yMm)+halfH;cross=finite(xMm)}
  else return 0;
  if(inward<0||inward>radius)return 0;
  return Math.hypot(inward,cross)<=radius?depth:0;
}

export function planTiledMap(options={}){
  const width=Math.max(1,finite(options.widthMm,100)),height=Math.max(1,finite(options.heightMm,100));
  const maxW=Math.max(1,finite(options.maxTileWidthMm,width)),maxH=Math.max(1,finite(options.maxTileHeightMm,height));
  const columns=Math.max(1,Math.ceil(width/maxW)),rows=Math.max(1,Math.ceil(height/maxH));
  const tileW=width/columns,tileH=height/rows,tiles=[],connectors=[];
  const jointType=String(options.jointType||(options.dovetail?"dovetail":"flat"));
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const id=`${row+1}-${col+1}`;
    tiles.push({id,row,col,xMm:col*tileW,yMm:row*tileH,widthMm:tileW,heightMm:tileH});
  }
  if(jointType!=="flat"){
    const pushPair=(a,b,axis,index,sideA,sideB)=>{
      if(jointType==="pin"){
        connectors.push({tile:a,neighbor:b,axis,side:sideA,kind:"socket"});
        connectors.push({tile:b,neighbor:a,axis,side:sideB,kind:"socket"});
        return;
      }
      const maleFirst=index%2===0;
      connectors.push({tile:a,neighbor:b,axis,side:sideA,kind:maleFirst?"male":"female"});
      connectors.push({tile:b,neighbor:a,axis,side:sideB,kind:maleFirst?"female":"male"});
    };
    let index=0;
    for(let row=0;row<rows;row++)for(let col=0;col<columns-1;col++){
      pushPair(`${row+1}-${col+1}`,`${row+1}-${col+2}`,"x",index++,"right","left");
    }
    for(let row=0;row<rows-1;row++)for(let col=0;col<columns;col++){
      pushPair(`${row+1}-${col+1}`,`${row+2}-${col+1}`,"y",index++,"top","bottom");
    }
  }
  return {widthMm:width,heightMm:height,columns,rows,tiles,connectors,jointType};
}
