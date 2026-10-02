const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;

export function rasterStats(raster={}){
  const data=raster.data||[],values=[];
  let sum=0,noData=0,min=Infinity,max=-Infinity;
  for(const raw of data){
    const value=Number(raw);
    if(!Number.isFinite(value)){noData++;continue}
    values.push(value);sum+=value;min=Math.min(min,value);max=Math.max(max,value);
  }
  const count=values.length;
  return {count,noData,min:count?min:0,max:count?max:0,mean:count?Number((sum/count).toFixed(6)):0};
}

export function fillNoData(raster={},options={}){
  const width=Math.max(1,Math.floor(finite(raster.width,1))),height=Math.max(1,Math.floor(finite(raster.height,1)));
  let data=Float64Array.from(raster.data||[]);
  if(data.length!==width*height)throw new Error("Raster dimensions do not match data length.");
  const passes=Math.max(1,Math.floor(finite(options.passes,4)));
  const offsets=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
  for(let pass=0;pass<passes;pass++){
    const next=Float64Array.from(data);let changed=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const idx=y*width+x;if(Number.isFinite(data[idx]))continue;
      let sum=0,count=0;
      for(const [dx,dy] of offsets){const xx=x+dx,yy=y+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;const v=data[yy*width+xx];if(Number.isFinite(v)){sum+=v;count++}}
      if(count){next[idx]=sum/count;changed++}
    }
    data=next;if(!changed)break;
  }
  let remainingNoData=0;for(const value of data)if(!Number.isFinite(value))remainingNoData++;
  return {...raster,width,height,data,remainingNoData};
}

export function smoothRaster(raster={},options={}){
  const width=Math.max(1,Math.floor(finite(raster.width,1))),height=Math.max(1,Math.floor(finite(raster.height,1)));
  let data=Float64Array.from(raster.data||[]);
  if(data.length!==width*height)throw new Error("Raster dimensions do not match data length.");
  const radius=Math.max(0,Math.floor(finite(options.radius,1))),passes=Math.max(1,Math.floor(finite(options.passes,1)));
  if(!radius)return {...raster,width,height,data};
  for(let pass=0;pass<passes;pass++){
    const next=new Float64Array(data.length);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let sum=0,weight=0;
      for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
        const xx=x+dx,yy=y+dy;if(xx<0||xx>=width||yy<0||yy>=height)continue;
        const value=data[yy*width+xx];if(!Number.isFinite(value))continue;
        const w=1/(1+Math.hypot(dx,dy));sum+=value*w;weight+=w;
      }
      next[y*width+x]=weight?sum/weight:NaN;
    }
    data=next;
  }
  return {...raster,width,height,data};
}

export function sampleRasterBilinear(raster={},px=0,py=0){
  const width=Math.max(1,Math.floor(finite(raster.width,1))),height=Math.max(1,Math.floor(finite(raster.height,1))),data=raster.data||[];
  const x=clamp(finite(px),0,width-1),y=clamp(finite(py),0,height-1);
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),tx=x-x0,ty=y-y0;
  const values=[data[y0*width+x0],data[y0*width+x1],data[y1*width+x0],data[y1*width+x1]].map(Number);
  const finiteValues=values.filter(Number.isFinite);
  if(!finiteValues.length)return null;
  const fallback=finiteValues[0],[a,b,c,d]=values.map(v=>Number.isFinite(v)?v:fallback);
  return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty;
}

export function resampleRasterBilinear(raster={},targetWidth,targetHeight){
  const width=Math.max(1,Math.floor(finite(targetWidth,1))),height=Math.max(1,Math.floor(finite(targetHeight,1)));
  const out=new Float64Array(width*height);
  const srcW=Math.max(1,Math.floor(finite(raster.width,1))),srcH=Math.max(1,Math.floor(finite(raster.height,1)));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=width===1?0:x/(width-1)*(srcW-1),sy=height===1?0:y/(height-1)*(srcH-1);
    const value=sampleRasterBilinear(raster,sx,sy);out[y*width+x]=value===null?NaN:value;
  }
  return {...raster,width,height,data:out};
}

export function createProjectedRasterSampler(raster={},options={}){
  const bbox=options.bbox||raster.bbox;
  if(!Array.isArray(bbox)||bbox.length<4)throw new Error("Projected raster bounding box is required.");
  const transform=typeof options.fromWgs84==="function"?options.fromWgs84:(lon,lat)=>[lon,lat];
  const [minX,minY,maxX,maxY]=bbox.map(Number);
  if(![minX,minY,maxX,maxY].every(Number.isFinite)||minX===maxX||minY===maxY)throw new Error("Invalid projected raster bounds.");
  return (lat,lon)=>{
    const [x,y]=transform(Number(lon),Number(lat));
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<Math.min(minX,maxX)||x>Math.max(minX,maxX)||y<Math.min(minY,maxY)||y>Math.max(minY,maxY))return null;
    const px=(x-minX)/(maxX-minX)*(raster.width-1),py=(maxY-y)/(maxY-minY)*(raster.height-1);
    return sampleRasterBilinear(raster,px,py);
  };
}

function inferGeoTiffCrs(geoKeys={},override=""){
  const explicit=String(override||"").trim();if(explicit)return explicit;
  const geographic=Number(geoKeys.GeographicTypeGeoKey),projected=Number(geoKeys.ProjectedCSTypeGeoKey);
  if(Number.isFinite(projected)&&projected>0&&projected!==32767)return `EPSG:${projected}`;
  if(Number.isFinite(geographic)&&geographic>0&&geographic!==32767)return `EPSG:${geographic}`;
  return "";
}

export function normalizeProjectionDefinition(crs=""){
  const value=String(crs||"").trim();
  if(!value)return "";
  const match=/^EPSG:(\d+)$/i.exec(value);
  if(!match)return value;
  const code=Number(match[1]);
  if(code===4326||code===3857)return `EPSG:${code}`;
  if(code>=32601&&code<=32660)return `+proj=utm +zone=${code-32600} +datum=WGS84 +units=m +no_defs`;
  if(code>=32701&&code<=32760)return `+proj=utm +zone=${code-32700} +south +datum=WGS84 +units=m +no_defs`;
  return value;
}

export async function loadGeoTiffArrayBuffer(buffer,options={}){
  const vendorModuleUrl=options.vendorModuleUrl||"../vendor/geotiff-proj4.mjs";
  const vendor=await import(vendorModuleUrl);
  const fromArrayBuffer=vendor.fromArrayBuffer,proj4=vendor.proj4?.default||vendor.proj4;
  if(typeof fromArrayBuffer!=="function"||typeof proj4!=="function")throw new Error("Local GeoTIFF/proj4 vendor bundle is unavailable or invalid.");
  const tiff=await fromArrayBuffer(buffer),image=await tiff.getImage();
  const width=image.getWidth(),height=image.getHeight(),bbox=image.getBoundingBox(),geoKeys=image.getGeoKeys?.()||{};
  const sourceCrs=inferGeoTiffCrs(geoKeys,options.crsOverride),projectionDefinition=normalizeProjectionDefinition(sourceCrs);
  if(!sourceCrs)throw new Error("GeoTIFF CRS could not be determined. Supply a CRS/WKT override.");
  const raw=await image.readRasters({samples:[Math.max(0,Math.floor(finite(options.sample,0)))],interleave:true});
  const noDataRaw=image.getGDALNoData?.(),noData=Number(noDataRaw);
  let data=Float64Array.from(raw,value=>Number.isFinite(noData)&&Number(value)===noData?NaN:Number(value));
  let raster={width,height,data,bbox,sourceCrs,geoKeys,noData:Number.isFinite(noData)?noData:null};
  if(options.fillNoData!==false)raster=fillNoData(raster,{passes:Math.max(1,Math.floor(finite(options.fillPasses,6)))});
  if(finite(options.smoothingRadius,0)>0)raster=smoothRaster(raster,{radius:Math.floor(options.smoothingRadius),passes:Math.max(1,Math.floor(finite(options.smoothingPasses,1)))});
  if(options.targetWidth&&options.targetHeight)raster=resampleRasterBilinear(raster,options.targetWidth,options.targetHeight);
  let fromWgs84;
  if(/^EPSG:4326$/i.test(sourceCrs))fromWgs84=(lon,lat)=>[lon,lat];
  else fromWgs84=(lon,lat)=>proj4("EPSG:4326",projectionDefinition,[lon,lat]);
  const sampleLatLon=createProjectedRasterSampler(raster,{bbox:raster.bbox,fromWgs84});
  return {...raster,projectionDefinition,stats:rasterStats(raster),sampleLatLon};
}

export function reconcileGpxElevations(points=[],demSampler,options={}){
  const mode=["dem","gpx","blend"].includes(options.mode)?options.mode:"dem",blend=clamp(finite(options.blend,.5),0,1),maxDelta=Math.max(0,finite(options.maxDeltaM,150));
  let withGpxElevation=0,withDemElevation=0,maxAbsDeltaM=0,sumAbsDeltaM=0,paired=0;
  const reconciled=(points||[]).map(point=>{
    const dem=typeof demSampler==="function"?demSampler(point.lat,point.lon):null,hasDem=Number.isFinite(dem),rawGpx=point.ele,hasGpx=rawGpx!==null&&rawGpx!==undefined&&rawGpx!==""&&Number.isFinite(Number(rawGpx)),gpx=hasGpx?Number(rawGpx):null;
    if(hasDem)withDemElevation++;if(hasGpx)withGpxElevation++;
    if(hasDem&&hasGpx){const delta=gpx-dem;maxAbsDeltaM=Math.max(maxAbsDeltaM,Math.abs(delta));sumAbsDeltaM+=Math.abs(delta);paired++}
    let value;
    if(mode==="dem")value=hasDem?dem:(hasGpx?gpx:null);
    else if(mode==="gpx")value=hasGpx?gpx:(hasDem?dem:null);
    else if(hasDem&&hasGpx){
      const bounded=clamp(gpx-dem,-maxDelta,maxDelta);value=dem+bounded*blend;
    }else value=hasGpx?gpx:(hasDem?dem:null);
    return {...point,reconciledEle:Number.isFinite(value)?value:null,demEle:hasDem?dem:null,gpxEle:hasGpx?gpx:null};
  });
  return {points:reconciled,diagnostics:{mode,blend,withGpxElevation,withDemElevation,paired,maxAbsDeltaM:Number(maxAbsDeltaM.toFixed(3)),meanAbsDeltaM:paired?Number((sumAbsDeltaM/paired).toFixed(3)):0}};
}

export function clipPolygonToRect(points=[],rect={}){
  const bounds={minX:Number(rect.minX),maxX:Number(rect.maxX),minY:Number(rect.minY),maxY:Number(rect.maxY)};
  if(!Object.values(bounds).every(Number.isFinite)||bounds.minX>bounds.maxX||bounds.minY>bounds.maxY)throw new Error("Valid clipping bounds are required.");
  let polygon=(points||[]).map(p=>({x:Number(p.x),y:Number(p.y)})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(polygon.length<3)return [];
  const clip=(input,inside,intersect)=>{
    const output=[];if(!input.length)return output;
    let previous=input[input.length-1],previousInside=inside(previous);
    for(const current of input){const currentInside=inside(current);
      if(currentInside){if(!previousInside)output.push(intersect(previous,current));output.push(current)}
      else if(previousInside)output.push(intersect(previous,current));
      previous=current;previousInside=currentInside;
    }
    return output;
  };
  const vertical=(xConst)=>(a,b)=>{const t=(xConst-a.x)/((b.x-a.x)||1e-12);return {x:xConst,y:a.y+(b.y-a.y)*t}};
  const horizontal=(yConst)=>(a,b)=>{const t=(yConst-a.y)/((b.y-a.y)||1e-12);return {x:a.x+(b.x-a.x)*t,y:yConst}};
  polygon=clip(polygon,p=>p.x>=bounds.minX,vertical(bounds.minX));
  polygon=clip(polygon,p=>p.x<=bounds.maxX,vertical(bounds.maxX));
  polygon=clip(polygon,p=>p.y>=bounds.minY,horizontal(bounds.minY));
  polygon=clip(polygon,p=>p.y<=bounds.maxY,horizontal(bounds.maxY));
  return polygon;
}

export function adaptiveLargeFormatPlan(options={}){
  const width=Math.max(1,finite(options.widthMm,100)),height=Math.max(1,finite(options.heightMm,100)),target=Math.max(.08,finite(options.targetXyMm,.5)),maxVertices=Math.max(10000,Math.floor(finite(options.maxVerticesPerTile,160000))),maxTile=Math.max(20,finite(options.maxTileMm,300));
  let columns=Math.max(1,Math.ceil(width/maxTile)),rows=Math.max(1,Math.ceil(height/maxTile));
  const perTile=()=>{
    const tileW=width/columns,tileH=height/rows,gridColumns=Math.ceil(tileW/target)+1,gridRows=Math.ceil(tileH/target)+1;
    return {tileW,tileH,gridColumns,gridRows,vertices:gridColumns*gridRows};
  };
  let guard=0;
  while(perTile().vertices>maxVertices&&guard++<1000){
    const p=perTile();
    if(p.tileW/target>=p.tileH/target)columns++;else rows++;
  }
  const p=perTile(),tiles=[];
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const x0=col*p.tileW,y0=row*p.tileH,w=col===columns-1?width-x0:p.tileW,h=row===rows-1?height-y0:p.tileH;
    const gridColumns=Math.ceil(w/target)+1,gridRows=Math.ceil(h/target)+1;
    tiles.push({id:`${row+1}-${col+1}`,row,col,xMm:x0,yMm:y0,widthMm:w,heightMm:h,gridColumns,gridRows,stepXmm:w/(gridColumns-1),stepYmm:h/(gridRows-1),estimatedVertices:gridColumns*gridRows});
  }
  return {widthMm:width,heightMm:height,targetXyMm:target,maxVerticesPerTile:maxVertices,columns,rows,tiles,totalEstimatedVertices:tiles.reduce((sum,tile)=>sum+tile.estimatedVertices,0)};
}


export function classifyTerrainWorkload(options={}){
  const rasterWidth=Math.max(0,Math.floor(finite(options.rasterWidth,0))),rasterHeight=Math.max(0,Math.floor(finite(options.rasterHeight,0))),rasterPixels=rasterWidth*rasterHeight;
  const estimatedVertices=Math.max(0,Math.floor(finite(options.estimatedVertices,0))),deviceMemoryGb=Math.max(2,finite(options.deviceMemoryGb,8));
  // Conservative browser-side working-set model: decoded raster + processing copies + mesh/index/export buffers.
  const rasterBytes=rasterPixels*32,meshBytes=estimatedVertices*96,estimatedPeakBytes=rasterBytes+meshBytes;
  const deviceBytes=deviceMemoryGb*1024*1024*1024,safeBudget=deviceBytes*.35,hardBudget=deviceBytes*.72;
  let action="allow",reason="Within the qualified browser working-set envelope.";
  if(rasterPixels>250_000_000||estimatedPeakBytes>hardBudget){action="refuse";reason="Estimated working set exceeds the controlled browser memory ceiling."}
  else if(rasterPixels>80_000_000||estimatedPeakBytes>safeBudget){action="tile";reason="Large job requires tiling/decimation before production generation."}
  else if(rasterPixels>16_000_000||estimatedVertices>1_000_000||estimatedPeakBytes>safeBudget*.45){action="warn";reason="Large job is inside the provisional envelope but should be monitored."}
  return {action,reason,rasterWidth,rasterHeight,rasterPixels,estimatedVertices,deviceMemoryGb,estimatedPeakBytes,safeBudgetBytes:safeBudget,hardBudgetBytes:hardBudget};
}
