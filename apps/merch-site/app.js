const $=s=>document.querySelector(s);const $$=s=>[...document.querySelectorAll(s)];
const input=$('#gpxInput'),drop=$('#dropZone'),route=$('#routeLine'),shadow=$('#routeShadow'),start=$('#routeStart'),end=$('#routeEnd');
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function setCopy(){const title=$('#rideTitle').value.trim()||'Your Ride Story';const detail=$('#rideDetail').value.trim()||'DISTANCE · PLACE · YEAR';$('#previewTitle').textContent=title;$('#previewDetail').textContent=detail}
$('#rideTitle').addEventListener('input',setCopy);$('#rideDetail').addEventListener('input',setCopy);
$$('input[name="palette"]').forEach(el=>el.addEventListener('change',e=>{
  document.documentElement.style.setProperty('--route',e.target.value);
  pulseStudioPreview();
}));
$('#uploadButton').addEventListener('click',()=>input.click());
['dragenter','dragover'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('dragging')}));
['dragleave','drop'].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('dragging')}));
drop.addEventListener('drop',e=>{const file=e.dataTransfer.files[0];if(file)readGpx(file)});input.addEventListener('change',()=>input.files[0]&&readGpx(input.files[0]));
function readGpx(file){const reader=new FileReader();reader.onload=()=>{try{const xml=new DOMParser().parseFromString(reader.result,'application/xml');const nodes=[...xml.querySelectorAll('trkpt,rtept')];if(nodes.length<2)throw new Error('No route');const pts=nodes.map(n=>[+n.getAttribute('lon'),+n.getAttribute('lat')]).filter(p=>p.every(Number.isFinite));if(pts.length<2)throw new Error('No route');drawRoute(pts);renderStudioMapRoute(pts);$('#fileState').textContent=`${file.name} · ${pts.length.toLocaleString()} route points loaded`;toast('Ride loaded on the real map preview')}catch{$('#fileState').textContent='That file has no readable GPX route. Try another export.'}};reader.readAsText(file)}
function drawRoute(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const w=maxX-minX||1,h=maxY-minY||1;const scale=Math.min(380/w,410/h);const ox=(500-w*scale)/2,oy=(500-h*scale)/2;const step=Math.max(1,Math.floor(points.length/350));const mapped=points.filter((_,i)=>i%step===0||i===points.length-1).map(([x,y])=>`${(ox+(x-minX)*scale).toFixed(1)},${(490-(oy+(y-minY)*scale)).toFixed(1)}`);const str=mapped.join(' ');route.setAttribute('points',str);shadow.setAttribute('points',str);const first=mapped[0].split(','),last=mapped.at(-1).split(',');start.setAttribute('cx',first[0]);start.setAttribute('cy',first[1]);end.setAttribute('cx',last[0]);end.setAttribute('cy',last[1])}
async function collectArtworkMedia(){
  const keys=['photo','photo2','medal','medal2','bib'];
  const result={};
  for(const key of keys){
    const source=studioAssetUrls?.[key]||'';
    result[key]=source?await urlToDataUrl(source):'';
  }
  return result;
}
function artworkSvg(snapshot,media={}){
  const colour=getComputedStyle(document.documentElement).getPropertyValue('--route').trim()||'#ffb000';
  const title=escapeXml($('#previewTitle').textContent);
  const detail=escapeXml($('#previewDetail').textContent);
  const logo=escapeXml(new URL('assets/vayu-official.png',location.href).href);
  const eventMark=escapeXml(window.vyndiEventMarkExportHref||'');
  const mapImage=escapeXml(snapshot?.mapDataUrl||'');
  const points=escapeXml(snapshot?.routePoints||'');
  const startPoint=snapshot?.startPoint||[0,0],endPoint=snapshot?.endPoint||[0,0];
  const layout=document.querySelector('[data-studio-layout].active')?.dataset.studioLayout||'route';
  const withMedia=layout!=='route';
  const mapWidth=withMedia?330:500;
  const xScale=mapWidth/500;
  const eventMarkSvg=eventMark?`<image href="${eventMark}" x="438" y="0" width="62" height="38" preserveAspectRatio="xMaxYMid meet"/>`:'';
  const routeTransform=`translate(0 45) scale(${xScale.toFixed(4)} 1)`;
  const mapSvg=`<image href="${mapImage}" x="0" y="45" width="${mapWidth}" height="520" preserveAspectRatio="none"/><polyline points="${points}" transform="${routeTransform}" fill="none" stroke="#0008" stroke-width="11" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${points}" transform="${routeTransform}" fill="none" stroke="${colour}" stroke-width="6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${(startPoint[0]*xScale).toFixed(1)}" cy="${startPoint[1]+45}" r="6" fill="#f7f5ef" stroke="${colour}" stroke-width="4"/><circle cx="${(endPoint[0]*xScale).toFixed(1)}" cy="${endPoint[1]+45}" r="6" fill="#f7f5ef" stroke="${colour}" stroke-width="4"/>`;

  const mediaByLayout={
    photo:[['photo','RIDE PHOTO']],
    medal:[['medal','MEDAL / BREVET']],
    'photo-medal':[['photo','RIDE PHOTO'],['medal','MEDAL / BREVET']],
    complete:[['photo','RIDE PHOTO'],['medal','MEDAL / BREVET'],['bib','BIB / CARD']],
    'double-photo':[['photo','RIDE PHOTO 01'],['photo2','RIDE PHOTO 02']],
    'double-medal':[['medal','MEDAL / BREVET 01'],['medal2','MEDAL / BREVET 02']]
  };
  const slots=mediaByLayout[layout]||[];
  const panelX=342,panelW=158,gap=10;
  const panelH=slots.length<=1?520:slots.length===2?255:Math.floor((520-gap*2)/3);
  const mediaSvg=slots.map(([key,label],index)=>{
    const y=45+index*(panelH+gap);
    const href=escapeXml(media[key]||'');
    if(href){
      return `<rect x="${panelX}" y="${y}" width="${panelW}" height="${panelH}" fill="#ddd8cf"/><image href="${href}" x="${panelX}" y="${y}" width="${panelW}" height="${panelH}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    return `<rect x="${panelX}" y="${y}" width="${panelW}" height="${panelH}" fill="#e3ded5" stroke="#c6c0b6"/><text x="${panelX+panelW/2}" y="${y+panelH/2}" text-anchor="middle" dominant-baseline="middle" font-family="Arial" font-size="10" letter-spacing="1" fill="#666">${escapeXml(label)}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 600 750"><rect width="600" height="750" fill="#f7f5ef"/><g transform="translate(50 50)"><image href="${logo}" x="0" y="0" width="52" height="34" preserveAspectRatio="xMinYMid meet"/>${eventMarkSvg}${mapSvg}${mediaSvg}<line x1="0" y1="580" x2="500" y2="580" stroke="#222"/><text x="0" y="625" font-family="Arial" font-weight="700" font-size="26">${title}</text><text x="0" y="654" font-family="Arial" font-size="13" letter-spacing="1.5" fill="#666">${detail}</text></g></svg>`;
}
function escapeXml(v){return v.replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]))}
function download(name,data,type='image/svg+xml'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$('#downloadButton').addEventListener('click',async()=>{const button=$('#downloadButton');if(!studioLastPoints?.length){toast('Upload a GPX first so the geographic map can be included');return}const original=button.textContent;button.disabled=true;button.textContent='Building current artwork…';try{const [snapshot,media]=await Promise.all([buildExportMapSnapshot(studioLastPoints),collectArtworkMedia()]);if(!snapshot?.mapDataUrl)throw new Error('Map unavailable');const title=$('#previewTitle')?.textContent||'ride-memento';download(`${safeFileSlug(title)}-vyndi-memento-artwork.svg`,artworkSvg(snapshot,media));toast('Current VYNDI memento artwork downloaded')}catch(error){console.error(error);toast('Current artwork could not be built. Check the GPX/map and try again.')}finally{button.disabled=false;button.textContent=original}});
function safeFileSlug(value='vyndi-ride-memento'){
  return value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,56)||'vyndi-ride-memento';
}
function currentConfigurationSnapshot(){
  const base=typeof activeStudioConfig==='function'?activeStudioConfig():{};
  return {
    schema:'VYNDI_RIDE_MEMENTO_CONFIGURATION',
    schema_version:'1.0',
    saved_at:new Date().toISOString(),
    brand:'My Road — My Glory / Powered by VYNDI Ride Stories',
    title:$('#previewTitle')?.textContent||base.title||'',
    ride_detail:$('#previewDetail')?.textContent||base.detail||'',
    gpx:{
      loaded:!!studioLastPoints?.length,
      point_count:studioLastPoints?.length||0,
      source:$('#fileState')?.textContent||'No GPX loaded'
    },
    configuration:base,
    event:typeof eventOrderSnapshot==='function'?eventOrderSnapshot():null,
    artwork_status:studioLastPoints?.length?'MAP + GPX ROUTE READY':'GPX REQUIRED FOR FINAL MAP ARTWORK',
    note:'Local VYNDI Ride Memento configuration. Saving this file does not create an order or payment.'
  };
}
const saveConfigButton=$('#saveConfigButton');
saveConfigButton?.addEventListener('click',()=>{
  const snapshot=currentConfigurationSnapshot();
  const name=`${safeFileSlug(snapshot.title)}-vyndi-configuration.json`;
  download(name,JSON.stringify(snapshot,null,2),'application/json');
  toast('Current VYNDI memento configuration saved');
});
const studioHowButton=$('#studioHowButton');
const studioHowPanel=$('#studioHowPanel');
studioHowButton?.addEventListener('click',()=>{
  const opening=studioHowPanel.hidden;
  studioHowPanel.hidden=!opening;
  studioHowButton.setAttribute('aria-expanded',String(opening));
  studioHowButton.textContent=opening?'Close VYNDI Memento guide':'How VYNDI Memento works';
  if(opening)studioHowPanel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
});


// Third-section Ride Memento studio — self-contained geographic renderer
const studioFrame=$('#studioFrame');
const studioMount=studioFrame?.querySelector('.mount');
const studioMapEl=$('#studioMap');
const studioMapEmbed=$('#studioMapEmbed');
const studioMapTiles=$('#studioMapTiles');
const studioMapPanel=$('.studio-map-panel');
const studioMediaPanel=$('#studioMediaPanel');
const studioPhotoPreview=$('#studioPhotoPreview');
const studioPhoto2Preview=$('#studioPhoto2Preview');
const studioMedalPreview=$('#studioMedalPreview');
const studioMedal2Preview=$('#studioMedal2Preview');
const studioBibPreview=$('#studioBibPreview');
const studioPhotoInput=$('#studioPhotoInput');
const studioPhoto2Input=$('#studioPhoto2Input');
const studioMedalInput=$('#studioMedalInput');
const studioMedal2Input=$('#studioMedal2Input');
const studioBibInput=$('#studioBibInput');
const studioEventMarkInput=$('#studioEventMarkInput');
const studioPhotoState=$('#studioPhotoState');
const studioPhoto2State=$('#studioPhoto2State');
const studioMedalState=$('#studioMedalState');
const studioMedal2State=$('#studioMedal2State');
const studioBibState=$('#studioBibState');
const studioEventMarkState=$('#studioEventMarkState');
const studioEventSignature=$('#studioEventSignature');
const studioEventMark=$('#studioEventMark');
const studioEventName=$('#studioEventName');
const studioEventMeta=$('#studioEventMeta');
const studioMapLoading=$('#studioMapLoading');
const studioMapAttribution=$('#studioMapAttribution');
const studioAssetUrls={photo:'',photo2:'',medal:'',medal2:'',bib:'',eventMark:''};
const mapTileTemplate=document.querySelector('meta[name="vyndi-map-tile-url"]')?.content?.trim()||'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const mapAttributionText=document.querySelector('meta[name="vyndi-map-attribution"]')?.content?.trim()||'© OpenStreetMap contributors';
let studioLastPoints=null;
let studioViewport=null;
let studioMapFallbackTimer=0;
let studioResizeTimer=0;
function mapTileUrl(z,x,y){return mapTileTemplate.replace('{z}',String(z)).replace('{x}',String(x)).replace('{y}',String(y))}
function mercatorLonLat(x,y,zoom){
  const world=256*Math.pow(2,zoom);
  const lon=x/world*360-180;
  const n=Math.PI-2*Math.PI*y/world;
  const lat=180/Math.PI*Math.atan(Math.sinh(n));
  return [lon,lat];
}
function setStudioEmbedViewport(left,top,width,height,zoom){
  if(!studioMapEmbed)return;
  const [west,north]=mercatorLonLat(left,top,zoom);
  const [east,south]=mercatorLonLat(left+width,top+height,zoom);
  const bbox=[west,south,east,north].map(v=>v.toFixed(6)).join(',');
  studioMapEmbed.src=`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
}
function showStudioMapFallback(){
  if(!studioMapEl||!studioMapEmbed)return;
  studioMapEmbed.hidden=false;
  studioMapEl.classList.add('use-embed');
  if(studioMapLoading)studioMapLoading.hidden=true;
  studioMapPanel?.classList.add('map-has-tiles');
}
function activeMapStyle(){return document.querySelector('[data-map-style].active')?.dataset.mapStyle||'standard'}

function mercatorPixel(lon,lat,zoom){
  const safeLat=Math.max(-85.05112878,Math.min(85.05112878,lat));
  const world=256*Math.pow(2,zoom);
  const x=(lon+180)/360*world;
  const sin=Math.sin(safeLat*Math.PI/180);
  const y=(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*world;
  return [x,y];
}
function chooseStudioZoom(points,width,height){
  for(let zoom=16;zoom>=2;zoom--){
    const projected=points.map(([lon,lat])=>mercatorPixel(lon,lat,zoom));
    const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
    const routeW=Math.max(...xs)-Math.min(...xs);
    const routeH=Math.max(...ys)-Math.min(...ys);
    if(routeW<=width*.72&&routeH<=height*.72)return zoom;
  }
  return 2;
}
function renderStudioTiles(centerX,centerY,zoom,width,height){
  if(!studioMapTiles)return;
  studioMapTiles.innerHTML='';
  studioMapPanel?.classList.remove('map-has-tiles');
  if(studioMapLoading)studioMapLoading.hidden=false;
  const tile=256,n=Math.pow(2,zoom);
  const left=centerX-width/2,top=centerY-height/2;
  const minTX=Math.floor(left/tile)-1,maxTX=Math.floor((left+width)/tile)+1;
  const minTY=Math.floor(top/tile)-1,maxTY=Math.floor((top+height)/tile)+1;
  let loaded=0;
  for(let tx=minTX;tx<=maxTX;tx++){
    for(let ty=minTY;ty<=maxTY;ty++){
      if(ty<0||ty>=n)continue;
      const wrapped=((tx%n)+n)%n;
      const img=document.createElement('img');
      img.alt='';
      img.loading='eager';
      img.decoding='async';
      img.referrerPolicy='strict-origin-when-cross-origin';
      img.onload=()=>{loaded+=1;if(loaded===1){clearTimeout(studioMapFallbackTimer);studioMapPanel?.classList.add('map-has-tiles');studioMapEl?.classList.remove('use-embed');if(studioMapEmbed)studioMapEmbed.hidden=true;if(studioMapLoading)studioMapLoading.hidden=true}};
      img.src=mapTileUrl(zoom,wrapped,ty);
      img.style.left=`${tx*tile-left}px`;
      img.style.top=`${ty*tile-top}px`;
      studioMapTiles.appendChild(img);
    }
  }
  return {left,top};
}
function panelSize(){
  if(!studioMapPanel)return {width:520,height:520};
  const rect=studioMapPanel.getBoundingClientRect();
  return {
    width:Math.max(1,Math.round(rect.width||studioMapPanel.clientWidth||520)),
    height:Math.max(1,Math.round(rect.height||studioMapPanel.clientHeight||520))
  };
}
function buildStudioViewport(points){
  const {width,height}=panelSize();
  const zoom=chooseStudioZoom(points,width,height);
  const projected=points.map(([lon,lat])=>mercatorPixel(lon,lat,zoom));
  const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  return {
    width,height,zoom,projected,centerX,centerY,
    left:centerX-width/2,
    top:centerY-height/2
  };
}
function applyRouteToViewport(viewport){
  const {width,height,projected,left,top}=viewport;
  const step=Math.max(1,Math.ceil(projected.length/1000));
  const simplified=projected.filter((_,i)=>i%step===0||i===projected.length-1);
  const mapped=simplified.map(([x,y])=>[
    Math.round((x-left)*10)/10,
    Math.round((y-top)*10)/10
  ]);
  const svg=$('#routeSvg');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  svg.setAttribute('width',String(width));
  svg.setAttribute('height',String(height));
  svg.setAttribute('preserveAspectRatio','none');
  route.setAttribute('points',mapped.map(p=>p.join(',')).join(' '));
  shadow.setAttribute('points',mapped.map(p=>p.join(',')).join(' '));
  const first=mapped[0],last=mapped.at(-1);
  start.setAttribute('cx',first[0]);start.setAttribute('cy',first[1]);
  end.setAttribute('cx',last[0]);end.setAttribute('cy',last[1]);
}
function renderStudioBase(){
  if(!studioMapPanel||!studioMapTiles)return;
  const {width,height}=panelSize();
  const zoom=4;
  const [cx,cy]=mercatorPixel(78.9629,20.5937,zoom);
  renderStudioTiles(cx,cy,zoom,width,height);
  studioMapPanel.classList.add('map-ready');
  studioMapPanel.classList.remove('map-live');
}
function renderStudioMapRoute(points){
  studioLastPoints=points;
  if(!studioMapPanel)return;
  studioMapPanel.classList.add('map-ready','map-live');
  studioMapPanel.classList.remove('map-has-tiles');
  if(studioMapLoading)studioMapLoading.hidden=false;
  if(studioMapAttribution)studioMapAttribution.textContent=mapAttributionText;

  studioViewport=buildStudioViewport(points);
  const {width,height,zoom,centerX,centerY,left,top}=studioViewport;
  renderStudioTiles(centerX,centerY,zoom,width,height);
  setStudioEmbedViewport(left,top,width,height,zoom);
  applyRouteToViewport(studioViewport);

  clearTimeout(studioMapFallbackTimer);
  studioMapFallbackTimer=setTimeout(()=>{if(!studioMapPanel.classList.contains('map-has-tiles'))showStudioMapFallback()},1800);
  studioMapPanel.classList.add('map-ready','map-live');
}
function canvasMapFilter(style){
  if(style==='standard')return 'none';
  if(style==='paper')return 'saturate(.72) contrast(.96) brightness(1.06)';
  if(style==='night')return 'saturate(.7) invert(.86) hue-rotate(170deg) contrast(1.08) brightness(.72)';
  return 'grayscale(.9) contrast(1.18) brightness(.78)';
}
function canvasMapBackground(style){
  if(style==='standard')return '#dfe9ef';
  if(style==='paper')return '#eeeae1';
  if(style==='night')return '#111618';
  return '#424649';
}
async function loadMapTileDrawable(url){
  const response=await fetch(url,{mode:'cors',cache:'force-cache'});
  if(!response.ok)throw new Error(`Tile HTTP ${response.status}`);
  const blob=await response.blob();
  if('createImageBitmap' in window)return await createImageBitmap(blob);
  return await new Promise((resolve,reject)=>{
    const objectUrl=URL.createObjectURL(blob);
    const image=new Image();
    image.onload=()=>{URL.revokeObjectURL(objectUrl);resolve(image)};
    image.onerror=()=>{URL.revokeObjectURL(objectUrl);reject(new Error('Tile decode failed'))};
    image.src=objectUrl;
  });
}
async function buildExportMapSnapshot(points){
  if(!points?.length)throw new Error('No GPX route loaded');
  const sourceWidth=768,sourceHeight=800,tile=256;
  const zoom=chooseStudioZoom(points,sourceWidth,sourceHeight);
  const projected=points.map(([lon,lat])=>mercatorPixel(lon,lat,zoom));
  const xs=projected.map(p=>p[0]),ys=projected.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  const left=centerX-sourceWidth/2,top=centerY-sourceHeight/2;
  const canvas=document.createElement('canvas');
  canvas.width=sourceWidth;canvas.height=sourceHeight;
  const ctx=canvas.getContext('2d',{alpha:false});
  const style=activeMapStyle();
  ctx.fillStyle=canvasMapBackground(style);
  ctx.fillRect(0,0,sourceWidth,sourceHeight);
  const n=Math.pow(2,zoom);
  const minTX=Math.floor(left/tile)-1,maxTX=Math.floor((left+sourceWidth)/tile)+1;
  const minTY=Math.floor(top/tile)-1,maxTY=Math.floor((top+sourceHeight)/tile)+1;
  const jobs=[];
  for(let tx=minTX;tx<=maxTX;tx++){
    for(let ty=minTY;ty<=maxTY;ty++){
      if(ty<0||ty>=n)continue;
      const wrapped=((tx%n)+n)%n;
      jobs.push((async()=>{
        const drawable=await loadMapTileDrawable(mapTileUrl(zoom,wrapped,ty));
        return {drawable,x:tx*tile-left,y:ty*tile-top};
      })());
    }
  }
  const settled=await Promise.allSettled(jobs);
  const tiles=settled.filter(item=>item.status==='fulfilled').map(item=>item.value);
  if(!tiles.length)throw new Error('No geographic map tiles could be loaded');
  ctx.save();
  ctx.filter=canvasMapFilter(style);
  tiles.forEach(({drawable,x,y})=>ctx.drawImage(drawable,x,y,tile,tile));
  ctx.restore();
  tiles.forEach(({drawable})=>{if(drawable?.close)drawable.close()});

  const badgeText=mapAttributionText;
  ctx.font='13px Arial, sans-serif';
  const badgeWidth=Math.ceil(ctx.measureText(badgeText).width)+14;
  ctx.fillStyle=style==='paper'?'rgba(255,255,255,.82)':'rgba(10,14,16,.78)';
  ctx.fillRect(sourceWidth-badgeWidth-6,sourceHeight-24,badgeWidth,18);
  ctx.fillStyle=style==='paper'?'#202326':'#f5f3ed';
  ctx.textBaseline='middle';
  ctx.fillText(badgeText,sourceWidth-badgeWidth+1,sourceHeight-15);

  const scaleX=500/sourceWidth,scaleY=520/sourceHeight;
  const step=Math.max(1,Math.ceil(projected.length/1400));
  const mapped=projected.filter((_,i)=>i%step===0||i===projected.length-1).map(([x,y])=>[
    Number(((x-left)*scaleX).toFixed(1)),
    Number(((y-top)*scaleY).toFixed(1))
  ]);
  return {
    mapDataUrl:canvas.toDataURL('image/png',.96),
    routePoints:mapped.map(point=>point.join(',')).join(' '),
    startPoint:mapped[0],
    endPoint:mapped.at(-1),
    zoom,
    attribution:mapAttributionText
  };
}

function rerenderStudioMap(){
  requestAnimationFrame(()=>requestAnimationFrame(()=>studioLastPoints?renderStudioMapRoute(studioLastPoints):renderStudioBase()));
}
function pulseStudioPreview(){
  if(!studioFrame)return;
  studioFrame.classList.remove('preview-change');
  void studioFrame.offsetWidth;
  studioFrame.classList.add('preview-change');
  setTimeout(()=>studioFrame.classList.remove('preview-change'),380);
}

const studioHoverPreview=$('#studioHoverPreview');
window.__VYNDI_STUDIO_CONTROLLER__='20261001-ui-audit-4';
const studioHoverPreviewTitle=$('#studioHoverPreviewTitle');
const studioHoverPreviewDescription=$('#studioHoverPreviewDescription');

function syncStudioDropdownLabel(kind,value){
  const root=document.querySelector(`[data-studio-dropdown="${kind}"]`);
  if(!root)return;
  const option=[...root.querySelectorAll('.studio-select-option')].find(item=>item.dataset.choiceValue===String(value));
  if(!option)return;
  const label=root.querySelector('[data-studio-selected-label]');
  if(label)label.textContent=option.dataset.choiceLabel||option.querySelector('strong')?.textContent||String(value);
  root.querySelectorAll('.studio-select-option').forEach(item=>item.classList.toggle('active',item===option));
}
function showStudioOptionPreview(option){
  if(!studioHoverPreview||!option)return;
  studioHoverPreview.dataset.kind=option.dataset.previewKind||'generic';
  studioHoverPreview.style.setProperty('--preview-accent',option.dataset.previewColour||getComputedStyle(document.documentElement).getPropertyValue('--route').trim()||'#ff7a1a');
  if(studioHoverPreviewTitle)studioHoverPreviewTitle.textContent=option.dataset.previewTitle||option.dataset.choiceLabel||'Preview';
  if(studioHoverPreviewDescription)studioHoverPreviewDescription.textContent=option.dataset.previewDescription||'Preview this option before selecting it.';
  studioHoverPreview.hidden=false;
}
function hideStudioOptionPreview(){
  if(studioHoverPreview)studioHoverPreview.hidden=true;
}
function setStudioRouteColour(colour){
  document.documentElement.style.setProperty('--route',colour);
  document.body.dataset.studioRouteColour=colour;
  studioMapEmpty?.style.setProperty("--route-preview",colour);
  syncStudioDropdownLabel('colour',colour);
  pulseStudioPreview();
}
function commitStudioDropdownChoice(option){
  const dropdown=option.closest('[data-studio-dropdown]');
  if(option.dataset.studioLayout)setStudioLayout(option.dataset.studioLayout);
  else if(option.dataset.mapStyle)setStudioMapStyle(option.dataset.mapStyle);
  else if(option.dataset.studioFrame)setStudioFrame(option.dataset.studioFrame);
  else if(option.dataset.studioMount)setStudioMount(option.dataset.studioMount);
  else if(option.dataset.studioSize)setStudioSize(option.dataset.studioSize);
  else if(option.dataset.studioColour)setStudioRouteColour(option.dataset.studioColour);
  if(dropdown)syncStudioDropdownLabel(dropdown.dataset.studioDropdown,option.dataset.choiceValue||'');
  if(dropdown?.tagName==='DETAILS')dropdown.open=false;
  hideStudioOptionPreview();
}
$$('.studio-select').forEach(dropdown=>dropdown.addEventListener('toggle',()=>{
  if(!dropdown.open)return;
  $$('.studio-select').forEach(other=>{if(other!==dropdown)other.open=false});
}));
$$('.studio-select-option').forEach(option=>{
  option.addEventListener('mouseenter',()=>showStudioOptionPreview(option));
  option.addEventListener('focus',()=>showStudioOptionPreview(option));
  option.addEventListener('mouseleave',hideStudioOptionPreview);
  option.addEventListener('blur',hideStudioOptionPreview);
  option.addEventListener('click',()=>commitStudioDropdownChoice(option));
});
document.addEventListener('click',event=>{
  if(!event.target.closest('.studio-select')){
    $$('.studio-select').forEach(dropdown=>dropdown.open=false);
    hideStudioOptionPreview();
  }
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    $$('.studio-select').forEach(dropdown=>dropdown.open=false);
    hideStudioOptionPreview();
  }
});
const STUDIO_LAYOUT_MEDIA={route:[],photo:['photo'],medal:['medal'],'photo-medal':['photo','medal'],complete:['photo','medal','bib'],'double-photo':['photo','photo2'],'double-medal':['medal','medal2']};
function setStudioLayout(layout){
  $$('[data-studio-layout]').forEach(button=>button.classList.toggle('active',button.dataset.studioLayout===layout));
  syncStudioDropdownLabel('layout',layout);
  studioFrame.classList.remove('layout-route','layout-photo','layout-medal','layout-photo-medal','layout-complete','layout-double-photo','layout-double-medal','layout-all');
  studioFrame.classList.add(`layout-${layout}`);
  const visible=new Set(STUDIO_LAYOUT_MEDIA[layout]||[]);
  studioMediaPanel.hidden=visible.size===0;
  studioPhotoPreview.hidden=!visible.has('photo');
  studioPhoto2Preview.hidden=!visible.has('photo2');
  studioMedalPreview.hidden=!visible.has('medal');
  studioMedal2Preview.hidden=!visible.has('medal2');
  studioBibPreview.hidden=!visible.has('bib');
  setTimeout(rerenderStudioMap,80);
  pulseStudioPreview();
}


function setStudioMapStyle(style){
  $$('[data-map-style]').forEach(button=>button.classList.toggle('active',button.dataset.mapStyle===style));
  syncStudioDropdownLabel('map',style);
  studioMapEl.classList.remove('map-standard','map-graphite','map-paper','map-night');
  studioMapEl.classList.add(`map-${style}`);
  if(studioLastPoints)rerenderStudioMap();
  pulseStudioPreview();
}


function setStudioFrame(frame){
  $$('[data-studio-frame]').forEach(button=>button.classList.toggle('active',button.dataset.studioFrame===frame));
  syncStudioDropdownLabel('frame',frame);
  studioFrame.classList.remove('frame-black','frame-white','frame-oak');
  studioFrame.classList.add(`frame-${frame}`);
  pulseStudioPreview();
}
function setStudioMount(mount){
  $$('[data-studio-mount]').forEach(button=>button.classList.toggle('active',button.dataset.studioMount===mount));
  syncStudioDropdownLabel('mount',mount);
  studioMount.classList.remove('mount-white','mount-black');
  studioMount.classList.add(`mount-${mount}`);
  pulseStudioPreview();
}
function setStudioSize(size){
  $$('[data-studio-size]').forEach(button=>button.classList.toggle('active',button.dataset.studioSize===size));
  syncStudioDropdownLabel('format',size);
  studioFrame.classList.remove('size-portrait','size-landscape');
  studioFrame.classList.add(`size-${size}`);
  setTimeout(rerenderStudioMap,100);
  pulseStudioPreview();
}




function bindStudioMedia(input,state,preview,key,autoLayout){
  input.addEventListener('change',()=>{
    const selectedFile=input.files[0];
    if(!selectedFile)return;
    if(studioAssetUrls[key])URL.revokeObjectURL(studioAssetUrls[key]);
    studioAssetUrls[key]=URL.createObjectURL(selectedFile);
    preview.style.backgroundImage=`url("${studioAssetUrls[key]}")`;
    preview.style.backgroundSize='cover';
    preview.style.backgroundPosition='center';
    preview.classList.add('has-image');
    state.textContent=selectedFile.name;
    state.title=selectedFile.name;
    const current=document.querySelector('[data-studio-layout].active')?.dataset.studioLayout||'route';
    const required=new Set([...(STUDIO_LAYOUT_MEDIA[current]||[]),key]);
    const compatible=Object.entries(STUDIO_LAYOUT_MEDIA).find(([,slots])=>[...required].every(item=>slots.includes(item)));
    setStudioLayout((STUDIO_LAYOUT_MEDIA[current]||[]).includes(key)?current:compatible?.[0]||autoLayout);
    pulseStudioPreview();
    toast(`${selectedFile.name} added to the memento preview`);
  });
}
bindStudioMedia(studioPhotoInput,studioPhotoState,studioPhotoPreview,'photo','photo');
bindStudioMedia(studioPhoto2Input,studioPhoto2State,studioPhoto2Preview,'photo2','double-photo');
bindStudioMedia(studioMedalInput,studioMedalState,studioMedalPreview,'medal','medal');
bindStudioMedia(studioMedal2Input,studioMedal2State,studioMedal2Preview,'medal2','double-medal');
bindStudioMedia(studioBibInput,studioBibState,studioBibPreview,'bib','complete');


if('ResizeObserver' in window&&studioMapPanel){
  const studioMapResizeObserver=new ResizeObserver(()=>{
    clearTimeout(studioResizeTimer);
    studioResizeTimer=setTimeout(()=>{if(studioLastPoints)rerenderStudioMap()},60);
  });
  studioMapResizeObserver.observe(studioMapPanel);
}
addEventListener('pagehide',()=>Object.values(studioAssetUrls).forEach(url=>{if(url)URL.revokeObjectURL(url)}));
setStudioLayout('route');
setStudioMapStyle('standard');
setStudioFrame('black');
setStudioMount('white');
setStudioSize('portrait');
setStudioRouteColour('#ff7a1a');
requestAnimationFrame(renderStudioBase);

const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroVideo=$('.hero-video'),header=$('#siteHeader');
let ticking=false;
function renderScroll(){
  const y=scrollY;
  header.classList.toggle('compact',y>60);
  if(!reduceMotion&&heroVideo)heroVideo.style.transform=`translate3d(0,${Math.min(y*.18,100)}px,0) scale(1.03)`;
  if(!reduceMotion){
    $$('.parallax-panel img').forEach(img=>{
      const rect=img.parentElement.getBoundingClientRect();
      const offset=Math.max(-110,Math.min(110,(innerHeight/2-(rect.top+rect.height/2))*.12));
      img.style.transform=`translate3d(0,${offset}px,0) scale(1.04)`;
    });
    $$('.parallax-section').forEach(section=>{
      const rect=section.getBoundingClientRect();
      if(rect.bottom<0||rect.top>innerHeight)return;
      const center=rect.top+rect.height/2;
      const delta=Math.max(-1,Math.min(1,(innerHeight/2-center)/innerHeight));
      const copy=section.querySelector('[data-parallax-copy]');
      const visual=section.querySelector('[data-parallax-visual]');
      if(copy)copy.style.transform=`translate3d(0,${delta*34}px,0)`;
      if(visual)visual.style.transform=`translate3d(0,${delta*-52}px,0) scale(1.035)`;
    });
  }
  ticking=false;
}
addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(renderScroll);ticking=true}},{passive:true});renderScroll();

if(!reduceMotion&&matchMedia('(pointer:fine)').matches){$$('[data-tilt]').forEach(card=>{card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;card.style.transform=`perspective(1100px) rotateX(${-y*6}deg) rotateY(${x*8}deg) translateZ(0)`});card.addEventListener('pointerleave',()=>card.style.transform='')})}

const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('in');revealObserver.unobserve(entry.target)}}),{threshold:.15});$$('.reveal').forEach(el=>revealObserver.observe(el));


// Homepage chapter 02 — full-depth Ride Memento
const rideStorySection=$('#ride-story');
const rideStoryFilm=$('#rideStoryFilm');
const rideStoryEmblem=$('.ride-story-emblem');
const rideStoryRoute=$('#rideStoryRoute');
const rideStoryRoad=$('.ride-story-road');
const rideStoryDepthA=$('.ride-story-depth-a');
const rideStoryDepthB=$('.ride-story-depth-b');
const rideStoryProgress=$('#rideStoryProgress');
const rideStoryBeats=$$('.ride-story-beat');
const mementoPreviewWrap=$('#mementoPreviewWrap');
const storyNarrationButton=$('#storyNarrationButton');
const storyNarrationLabel=$('#storyNarrationLabel');
let rideStoryFrame=false;
let activeStoryBeat=-1;
let storySpeaking=false;

function clampStory(value,min=0,max=1){return Math.min(max,Math.max(min,value))}
function renderRideStory(){
  if(!rideStorySection)return;
  const rect=rideStorySection.getBoundingClientRect();
  const travel=Math.max(1,rect.height-innerHeight);
  const progress=clampStory(-rect.top/travel);
  const visible=rect.bottom>0&&rect.top<innerHeight;
  if(!visible)return;

  rideStoryProgress.style.width=`${(progress*100).toFixed(2)}%`;
  rideStoryRoute.style.strokeDashoffset=(1-progress).toFixed(3);

  const beat=progress<.24?0:progress<.49?1:progress<.74?2:3;
  if(beat!==activeStoryBeat){
    rideStoryBeats.forEach((el,index)=>el.classList.toggle('active',index===beat));
    activeStoryBeat=beat;
  }

  const previewProgress=clampStory((progress-.43)/.34);
  mementoPreviewWrap.style.opacity=previewProgress.toFixed(3);

  if(!reduceMotion){
    const drift=progress-.5;
    rideStoryFilm.style.transform=`translate3d(${-progress*3.5}%,${-12+progress*27}%,0) scale(${1.16+progress*.13})`;
    rideStoryFilm.style.filter=`saturate(${.84-progress*.28}) contrast(${1.1+progress*.08}) brightness(${.76-progress*.1})`;
    rideStoryDepthA.style.transform=`translate3d(${progress*30}vw,${-progress*7}vh,0) scale(${1+progress*.08})`;
    rideStoryDepthB.style.transform=`translate3d(${-progress*52}vw,${progress*9}vh,0) scale(${1.08-progress*.05})`;
    rideStoryEmblem.style.transform=`translate3d(${-progress*15}vw,calc(-50% + ${drift*150}px),0) rotate(${-8+progress*18}deg) scale(${1+progress*.22})`;
    rideStoryEmblem.style.opacity=(.3-progress*.14).toFixed(2);
    rideStoryRoute.style.transform=`translate3d(${-progress*5}vw,${-8+progress*17}vh,0) rotate(${-5+progress*13}deg) scale(${1+progress*.13})`;
    rideStoryRoad.style.transform=`translate3d(0,${progress*-48}vh,0) rotate(${-8+progress*7}deg) scale(${1+progress*.28})`;
    mementoPreviewWrap.style.transform=`translate3d(${(1-previewProgress)*30}vw,${-30-previewProgress*20}%,0) rotateY(${-25+previewProgress*17}deg) rotateX(${6-previewProgress*4}deg) scale(${.76+previewProgress*.2})`;
  }else if(previewProgress>.1){
    mementoPreviewWrap.style.opacity='1';
  }
}
function requestRideStory(){
  if(rideStoryFrame)return;
  rideStoryFrame=true;
  requestAnimationFrame(()=>{renderRideStory();rideStoryFrame=false});
}
addEventListener('scroll',requestRideStory,{passive:true});
addEventListener('resize',requestRideStory,{passive:true});
addEventListener('resize',()=>{clearTimeout(window.studioMapResizeTimer);window.studioMapResizeTimer=setTimeout(rerenderStudioMap,120)},{passive:true});
renderRideStory();

const rideBeatNarrations=[
  'My Road — My Glory begins with the road you actually rode. Every kilometre can carry effort, weather, checkpoints, setbacks, finishes and memories. Powered by VYNDI Ride Stories, that real journey can become a personal memento built from your GPX, photographs, bib, brevet and medal.'
];
const rideNarrationText=rideBeatNarrations[0];

let activeNarrationButton=null;
function speakNarration(text,button){
  if(!('speechSynthesis' in window)){toast('Narration is not supported in this browser');return}
  speechSynthesis.cancel();
  if(activeNarrationButton)activeNarrationButton.classList.remove('speaking');
  activeNarrationButton=button||null;
  if(activeNarrationButton)activeNarrationButton.classList.add('speaking');
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='en-IN';
  utterance.rate=.88;
  utterance.pitch=.92;
  const voices=speechSynthesis.getVoices();
  const preferred=voices.find(v=>/^en-IN$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));
  if(preferred)utterance.voice=preferred;
  utterance.onend=utterance.onerror=()=>{
    if(activeNarrationButton)activeNarrationButton.classList.remove('speaking');
    activeNarrationButton=null;
  };
  speechSynthesis.speak(utterance);
}
$$('[data-narrate-beat]').forEach(button=>button.addEventListener('click',()=>{
  const index=Number(button.dataset.narrateBeat);
  speakNarration(rideBeatNarrations[index]||rideNarrationText,button);
}));

const sectionNarrations={
  club:'My Road — My Glory is powered by VYNDI Ride Stories. Follow @VYNDIRIDES, join VYNDI Endurance India on Strava, or contact the Ride Stories team to stay connected with the community.'
};
$$('[data-section-narration]').forEach(button=>button.addEventListener('click',()=>{
  speakNarration(sectionNarrations[button.dataset.sectionNarration]||'',button);
}));

function stopRideNarration(){
  if('speechSynthesis' in window)speechSynthesis.cancel();
  storySpeaking=false;
  if(storyNarrationButton)storyNarrationButton.setAttribute('aria-pressed','false');
  if(storyNarrationLabel)storyNarrationLabel.textContent='Listen to the ride';
  $$('[data-narrate-beat]').forEach(button=>button.classList.remove('speaking'));
  $$('[data-section-narration]').forEach(button=>button.classList.remove('speaking'));
  if(studioNarrationButton)studioNarrationButton.classList.remove('speaking');
  if(activeNarrationButton)activeNarrationButton.classList.remove('speaking');
  activeNarrationButton=null;
}
if(storyNarrationButton){
  storyNarrationButton.addEventListener('click',()=>{
    if(!('speechSynthesis' in window)){toast('Narration is not supported in this browser');return}
    if(storySpeaking){stopRideNarration();return}
    speechSynthesis.cancel();
    if(activeNarrationButton)activeNarrationButton.classList.remove('speaking');
    activeNarrationButton=null;
    const utterance=new SpeechSynthesisUtterance(rideNarrationText);
    utterance.lang='en-IN';
    utterance.rate=.88;
    utterance.pitch=.92;
    const voices=speechSynthesis.getVoices();
    const preferred=voices.find(v=>/^en-IN$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));
    if(preferred)utterance.voice=preferred;
    utterance.onend=stopRideNarration;
    utterance.onerror=stopRideNarration;
    storySpeaking=true;
    storyNarrationButton.setAttribute('aria-pressed','true');
    storyNarrationLabel.textContent='Stop narration';
    speechSynthesis.speak(utterance);
  });
}
addEventListener('pagehide',stopRideNarration);

// Live Ride Memento controls
const mementoFrame=$('#mementoFrame');
const mementoMount=$('#mementoMount');
const mementoPrint=$('.memento-print');
const mementoMediaGrid=$('#mementoMediaGrid');
const mementoPhoto=$('#mementoPhoto');
const mementoPhoto2=$('#mementoPhoto2');
const mementoBib=$('#mementoBib');
const mementoMedal=$('#mementoMedal');
const mementoMedal2=$('#mementoMedal2');
const mementoTitle=$('#mementoTitle');
const mementoDetail=$('#mementoDetail');
const mementoLine=$('#mementoLine');
const mementoPreviewTitle=$('#mementoPreviewTitle');
const mementoPreviewDetail=$('#mementoPreviewDetail');
const mementoPreviewLine=$('#mementoPreviewLine');
const mementoGpxInput=$('#mementoGpxInput');
const mementoPhotoInput=$('#mementoPhotoInput');
const mementoPhoto2Input=$('#mementoPhoto2Input');
const mementoMedalInput=$('#mementoMedalInput');
const mementoMedal2Input=$('#mementoMedal2Input');
const mementoBibInput=$('#mementoBibInput');
const mementoGpxState=$('#mementoGpxState');
const mementoPhotoState=$('#mementoPhotoState');
const mementoPhoto2State=$('#mementoPhoto2State');
const mementoMedalState=$('#mementoMedalState');
const mementoMedal2State=$('#mementoMedal2State');
const mementoBibState=$('#mementoBibState');
const mementoRouteLine=$('#mementoRouteLine');
const mementoRouteShadow=$('#mementoRouteShadow');
const mementoRouteStart=$('#mementoRouteStart');
const mementoRouteEnd=$('#mementoRouteEnd');
const mementoAssetUrls={photo1:'',photo2:'',medal1:'',medal2:'',bib:''};
let activeMementoStyle='route';

function showAsset(el,show){el.hidden=!show}
function setMementoStyle(style){
  activeMementoStyle=style;
  $$('[data-memento-style]').forEach(button=>button.classList.toggle('active',button.dataset.mementoStyle===style));
  [...mementoPreviewWrap.classList].filter(name=>name.startsWith('style-')).forEach(name=>mementoPreviewWrap.classList.remove(name));
  mementoPreviewWrap.classList.add(`style-${style}`);

  const showPhoto1=['photo','photo-medal','complete','double-photo','bespoke'].includes(style);
  const showPhoto2=['double-photo','bespoke'].includes(style);
  const showBib=['bib','complete','bespoke'].includes(style);
  const showMedal1=['medal','photo-medal','complete','double-medal','bespoke'].includes(style);
  const showMedal2=['double-medal','bespoke'].includes(style);
  const mediaVisible=showPhoto1||showPhoto2||showBib;

  mementoMediaGrid.hidden=!mediaVisible;
  showAsset(mementoPhoto,showPhoto1);
  showAsset(mementoPhoto2,showPhoto2);
  showAsset(mementoBib,showBib);
  showAsset(mementoMedal,showMedal1);
  showAsset(mementoMedal2,showMedal2);
  mementoMediaGrid.classList.toggle('single',mediaVisible&&[showPhoto1,showPhoto2,showBib].filter(Boolean).length===1);
}
$$('[data-memento-style]').forEach(button=>button.addEventListener('click',()=>setMementoStyle(button.dataset.mementoStyle)));

$$('[data-frame]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-frame]').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  mementoFrame.classList.remove('frame-black','frame-white','frame-oak');
  mementoFrame.classList.add(`frame-${button.dataset.frame}`);
}));

$$('[data-mount]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-mount]').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  mementoMount.classList.remove('mount-warm','mount-charcoal');
  mementoMount.classList.add(`mount-${button.dataset.mount}`);
}));

$$('[data-size]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-size]').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');
  mementoFrame.classList.remove('size-a4','size-a3','size-15x10','size-20x10');
  mementoFrame.classList.add(`size-${button.dataset.size}`);
}));

function setMementoColour(colour){
  mementoPrint.style.setProperty('--memento-route',colour);
  document.documentElement.style.setProperty('--route',colour);
  $$('[data-route-colour]').forEach(item=>item.classList.toggle('active',item.dataset.routeColour.toLowerCase()===colour.toLowerCase()));
}
$$('[data-route-colour]').forEach(button=>button.addEventListener('click',()=>{
  $('#mementoColour').value=button.dataset.routeColour;
  setMementoColour(button.dataset.routeColour);
}));
$('#mementoColour').addEventListener('input',event=>setMementoColour(event.target.value));

function syncMementoCopy(){
  const title=mementoTitle.value.trim()||'YOUR RIDE';
  const detail=mementoDetail.value.trim()||'DISTANCE · PLACE · DATE';
  const line=mementoLine.value.trim()||'YOUR ROAD. YOUR MEMORY.';
  mementoPreviewTitle.textContent=title;
  mementoPreviewDetail.textContent=detail;
  mementoPreviewLine.textContent=line;
  const fullTitle=$('#rideTitle');
  const fullDetail=$('#rideDetail');
  if(fullTitle){fullTitle.value=title;$('#previewTitle').textContent=title}
  if(fullDetail){fullDetail.value=detail;$('#previewDetail').textContent=detail}
}
[mementoTitle,mementoDetail,mementoLine].forEach(input=>input.addEventListener('input',syncMementoCopy));

function fitMementoPoints(points){
  const width=390,height=430,originX=55,originY=60;
  const lats=points.map(point=>point.lat),lons=points.map(point=>point.lon);
  const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
  const rawW=Math.max(maxLon-minLon,.000001),rawH=Math.max(maxLat-minLat,.000001);
  const scale=Math.min(width/rawW,height/rawH);
  const drawnW=rawW*scale,drawnH=rawH*scale;
  const ox=originX+(width-drawnW)/2,oy=originY+(height-drawnH)/2;
  return points.map(point=>({x:ox+(point.lon-minLon)*scale,y:oy+(maxLat-point.lat)*scale}));
}
function renderMementoRoute(points){
  const fitted=fitMementoPoints(points);
  const step=Math.max(1,Math.ceil(fitted.length/800));
  const simplified=fitted.filter((_,index)=>index%step===0||index===fitted.length-1);
  const value=simplified.map(point=>`${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  mementoRouteLine.setAttribute('points',value);
  mementoRouteShadow.setAttribute('points',value);
  const first=simplified[0],last=simplified[simplified.length-1];
  mementoRouteStart.setAttribute('cx',first.x);mementoRouteStart.setAttribute('cy',first.y);
  mementoRouteEnd.setAttribute('cx',last.x);mementoRouteEnd.setAttribute('cy',last.y);
}
mementoGpxInput.addEventListener('change',async()=>{
  const file=mementoGpxInput.files[0];
  if(!file)return;
  try{
    const xml=new DOMParser().parseFromString(await file.text(),'application/xml');
    if(xml.querySelector('parsererror'))throw new Error('Invalid GPX');
    const points=[...xml.querySelectorAll('trkpt,rtept')].map(node=>({
      lat:Number(node.getAttribute('lat')),
      lon:Number(node.getAttribute('lon'))
    })).filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lon));
    if(points.length<2)throw new Error('No route');
    renderMementoRoute(points);
    if(typeof drawRoute==='function')drawRoute(points.map(point=>[point.lon,point.lat]));
    mementoGpxState.textContent=`${file.name} · ${points.length.toLocaleString('en-IN')} pts`;
    mementoGpxState.title=file.name;
    toast('GPX loaded into your Ride Memento');
  }catch{
    mementoGpxState.textContent='Choose another GPX';
    toast('This GPX has no readable route');
  }
});

function bindMementoImageInput(input,state,element,key,autoStyle){
  input.addEventListener('change',()=>{
    const file=input.files[0];
    if(!file)return;
    if(mementoAssetUrls[key])URL.revokeObjectURL(mementoAssetUrls[key]);
    mementoAssetUrls[key]=URL.createObjectURL(file);
    element.style.backgroundImage=`url("${mementoAssetUrls[key]}")`;
    element.classList.add('has-image');
    state.textContent=file.name;
    state.title=file.name;
    if(autoStyle)setMementoStyle(autoStyle);
    toast(`${file.name} added to the Ride Memento`);
  });
}
bindMementoImageInput(mementoPhotoInput,mementoPhotoState,mementoPhoto,'photo1','photo');
bindMementoImageInput(mementoPhoto2Input,mementoPhoto2State,mementoPhoto2,'photo2','double-photo');
bindMementoImageInput(mementoMedalInput,mementoMedalState,mementoMedal,'medal1','medal');
bindMementoImageInput(mementoMedal2Input,mementoMedal2State,mementoMedal2,'medal2','double-medal');
bindMementoImageInput(mementoBibInput,mementoBibState,mementoBib,'bib','bib');

addEventListener('pagehide',()=>Object.values(mementoAssetUrls).forEach(url=>{if(url)URL.revokeObjectURL(url)}));
setMementoColour('#ffb000');
syncMementoCopy();
mementoFrame.classList.add('size-a4');
setMementoStyle('route');


// Global Event Finder — worldwide event discovery + original VYNDI treatment
const eventSearchInput=$('#eventSearchInput');
const eventCategoryFilter=$('#eventCategoryFilter');
const eventLocationFilter=$('#eventLocationFilter');
const eventSort=$('#eventSort');
const eventSearchButton=$('#eventSearchButton');
const eventSearchStatus=$('#eventSearchStatus');
const eventResults=$('#eventResults');
const selectedEventPanel=$('#selectedEventPanel');
const selectedEventMark=$('#selectedEventMark');
const selectedEventName=$('#selectedEventName');
const selectedEventDescription=$('#selectedEventDescription');
const selectedEventDate=$('#selectedEventDate');
const selectedEventLocation=$('#selectedEventLocation');
const selectedEventDistance=$('#selectedEventDistance');
const selectedEventRouteRequest=$('#selectedEventRouteRequest');
const useSelectedEvent=$('#useSelectedEvent');
const clearSelectedEvent=$('#clearSelectedEvent');
const customEventForm=$('#customEventForm');
const eventLogoCandidate=$('#eventLogoCandidate');
const eventLogoCandidateImage=$('#eventLogoCandidateImage');
const eventLogoCandidateTitle=$('#eventLogoCandidateTitle');
const eventLogoCandidateMeta=$('#eventLogoCandidateMeta');
const eventLogoCandidateSource=$('#eventLogoCandidateSource');
const eventLogoStatus=$('#eventLogoStatus');
const eventLogoDiscoveredOption=$('#eventLogoDiscoveredOption');
const eventLogoPermissionWrap=$('#eventLogoPermissionWrap');
const eventLogoPermission=$('#eventLogoPermission');
const eventLogoUploadWrap=$('#eventLogoUploadWrap');
const selectedEventLogoUpload=$('#selectedEventLogoUpload');
const selectedEventLogoUploadState=$('#selectedEventLogoUploadState');
const externalEventApi=document.querySelector('meta[name="vyndi-event-api-url"]')?.content?.trim()||'';
let selectedEvent=null;
try{
  const savedEvent=JSON.parse(localStorage.getItem('vyndiSelectedEvent')||'null');
  if(savedEvent&&savedEvent.name)selectedEvent=savedEvent;
}catch{}

const eventCategoryPalette={
  cycling:'#ffb000',
  marathon:'#ff5c35',
  ultra:'#c77dff',
  triathlon:'#35d0ba',
  trail:'#8dbd58',
  swimming:'#36b9d6',
  rowing:'#65c3a5',
  sailing:'#4f9bd9',
  motorsport:'#ff7b45',
  winter:'#b9d9ef',
  adventure:'#d6b665',
  other:'#9da7ad'
};
function eventInitials(name='Event'){
  const parts=name.replace(/[^\p{L}\p{N} ]/gu,' ').trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0,2).map(part=>part[0]).join('')||'EV').toUpperCase();
}
function inferEventCategory(text=''){
  const value=text.toLowerCase();
  if(/triathlon|ironman|duathlon/.test(value))return 'triathlon';
  if(/open.?water|swimming|swim race|aquathlon/.test(value))return 'swimming';
  if(/rowing|kayak|canoe|paddl/.test(value))return 'rowing';
  if(/sailing|yacht|regatta/.test(value))return 'sailing';
  if(/motorsport|motor race|rally|enduro|motocross|formula|kart/.test(value))return 'motorsport';
  if(/ski|snow|winter race|cross.?country ski|skimo/.test(value))return 'winter';
  if(/hiking|trek|adventure race|orienteering/.test(value))return 'adventure';
  if(/ultra|100 mile|100km|endurance run/.test(value))return 'ultra';
  if(/trail|cross.country|cross country|xc|fell run/.test(value))return 'trail';
  if(/marathon|half marathon|road running|10k|5k|running race/.test(value))return 'marathon';
  if(/cycling|bicycle|bike|tour de|brevet|randon|gran fondo|criterium|road race/.test(value))return 'cycling';
  return 'other';
}
function eventAccent(event){
  return eventCategoryPalette[event?.category]||eventCategoryPalette.other;
}
function setEventTheme(event){
  const accent=eventAccent(event);
  document.documentElement.style.setProperty('--event-accent',accent);
  if(studioEventSignature)studioEventSignature.style.setProperty('--event-accent',accent);
  if(selectedEventPanel)selectedEventPanel.style.setProperty('--event-accent',accent);
  if(studioEventMark&&!window.vyndiEventMarkExportHref){
    setEventMarkElement(studioEventMark,'',eventInitials(event?.name));
  }
}
function safeHttpUrl(value=''){
  try{
    const url=new URL(value);
    return /^https?:$/.test(url.protocol)?url.toString():'';
  }catch{return ''}
}
function normalizeEventResult(item){
  const text=`${item.label||''} ${item.description||''}`;
  return {
    id:item.id||`CUSTOM-${Date.now()}`,
    name:item.label||'Unnamed event',
    description:item.description||'Named event discovered from the global event search.',
    category:inferEventCategory(text),
    source:'Wikidata',
    sourceUrl:safeHttpUrl(item.concepturi||item.url||''),
    location:'',
    editionDate:'',
    distance:''
  };
}
function renderEventResults(results){
  if(!eventResults)return;
  const desired=eventCategoryFilter?.value||'all';
  let list=[...results];
  if(desired!=='all'){
    list.sort((a,b)=>(a.category===desired?0:1)-(b.category===desired?0:1));
  }
  if(eventSort?.value==='az')list.sort((a,b)=>a.name.localeCompare(b.name));
  if(eventSort?.value==='za')list.sort((a,b)=>b.name.localeCompare(a.name));
  eventResults.innerHTML=list.map((event,index)=>{
    const accent=eventAccent(event);
    return `<article class="event-result" style="--event-accent:${accent}">
      <div class="event-result-top"><div class="event-result-mark">${eventInitials(event.name)}</div><div><h3>${escapeXml(event.name)}</h3><p>${escapeXml(event.description)}</p></div></div>
      <div class="event-result-meta"><span>${escapeXml(event.category)}</span><span>${escapeXml(event.source)}</span></div>
      <div class="event-result-actions"><button type="button" data-select-event="${index}">Select event</button>${event.sourceUrl?`<a href="${event.sourceUrl}" target="_blank" rel="noopener">Source ↗</a>`:''}</div>
    </article>`;
  }).join('');
  eventResults.dataset.events=JSON.stringify(list);
}
function stripSearchMarkup(value=''){
  return String(value||'')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<')
    .replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"')
    .replace(/&#(?:39|x27);/gi,"'")
    .replace(/\s+/g,' ')
    .trim();
}
async function searchWikidataEntities(term){
  const url=new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action','wbsearchentities');
  url.searchParams.set('search',term);
  url.searchParams.set('language','en');
  url.searchParams.set('uselang','en');
  url.searchParams.set('limit','12');
  url.searchParams.set('format','json');
  url.searchParams.set('origin','*');
  const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Wikidata search unavailable');
  const data=await response.json();
  return (data.search||[]).map(normalizeEventResult);
}
async function searchWikipediaEvents(term){
  const url=new URL('https://en.wikipedia.org/w/api.php');
  url.searchParams.set('action','query');
  url.searchParams.set('list','search');
  url.searchParams.set('srsearch',term);
  url.searchParams.set('srlimit','12');
  url.searchParams.set('format','json');
  url.searchParams.set('origin','*');
  const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Wikipedia search unavailable');
  const data=await response.json();
  return (data.query?.search||[]).map(item=>{
    const description=stripSearchMarkup(item.snippet||'');
    const name=item.title||'Unnamed event';
    return {
      id:`WP-${item.pageid}`,
      name,
      description:description||'Event or event-related page discovered from Wikipedia.',
      category:inferEventCategory(`${name} ${description}`),
      source:'Wikipedia',
      sourceUrl:`https://en.wikipedia.org/?curid=${item.pageid}`,
      location:'',
      editionDate:'',
      distance:''
    };
  });
}
function eventSearchScore(event,query,category,location){
  const name=(event.name||'').toLowerCase();
  const description=(event.description||'').toLowerCase();
  const haystack=`${name} ${description}`;
  const q=query.toLowerCase().trim();
  const tokens=q.split(/\s+/).filter(Boolean);
  let score=0;
  if(name===q)score+=40;
  if(name.startsWith(q))score+=24;
  if(name.includes(q))score+=20;
  tokens.forEach(token=>{if(name.includes(token))score+=7;else if(description.includes(token))score+=3});
  if(category!=='all'&&event.category===category)score+=18;
  if(location){
    const loc=location.toLowerCase().trim();
    if(haystack.includes(loc))score+=10;
  }
  if(/marathon|triathlon|ultra|trail|cycling|bicycle|brevet|randon|race|championship|tour|run/.test(haystack))score+=4;
  return score;
}
function mergeEventResults(groups,query,category,location){
  const merged=new Map();
  groups.flat().forEach(event=>{
    if(!event?.name)return;
    const key=event.name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const current=merged.get(key);
    if(!current||event.source==='Wikidata')merged.set(key,event);
  });
  return [...merged.values()]
    .map(event=>({...event,_score:eventSearchScore(event,query,category,location)}))
    .sort((a,b)=>b._score-a._score||a.name.localeCompare(b.name))
    .slice(0,20)
    .map(({_score,...event})=>event);
}
async function searchEvents(){
  const query=eventSearchInput?.value.trim()||'';
  if(!query){toast('Enter an event name');eventSearchInput?.focus();return}
  const locationFilter=eventLocationFilter?.value.trim()||'';
  const category=eventCategoryFilter?.value||'all';
  const categoryTerms={cycling:'cycling bicycle brevet race',marathon:'marathon running race',ultra:'ultramarathon ultra running',triathlon:'triathlon ironman',trail:'trail running cross country',swimming:'open water swimming race',rowing:'rowing kayak canoe paddling race',sailing:'sailing yacht regatta',motorsport:'motorsport rally enduro race',winter:'ski snow winter race',adventure:'hiking trek adventure orienteering',other:'event'};
  const categoryTerm=category!=='all'?categoryTerms[category]:'';
  const variants=[query,`${query} ${categoryTerm}`,`${query} ${locationFilter}`,`${query} ${categoryTerm} ${locationFilter}`]
    .map(value=>value.replace(/\s+/g,' ').trim())
    .filter((value,index,array)=>value&&array.indexOf(value)===index);

  eventSearchStatus.textContent='Searching global event sources…';
  eventSearchStatus.classList.add('loading');
  eventResults.innerHTML='';
  try{
    let providerResults=[];
    if(externalEventApi){
      try{
        const providerUrl=new URL(externalEventApi,window.location.href);
        providerUrl.searchParams.set('q',query);
        if(locationFilter)providerUrl.searchParams.set('location',locationFilter);
        if(category!=='all')providerUrl.searchParams.set('category',category);
        const providerResponse=await fetch(providerUrl.toString(),{headers:{Accept:'application/json'}});
        if(providerResponse.ok){
          const providerData=await providerResponse.json();
          providerResults=(providerData.events||providerData.results||[]).map(item=>({
            id:item.id||item.event_id||`EVENT-${Date.now()}`,
            name:item.name||item.title||'Unnamed event',
            description:item.description||item.summary||'Live event result',
            category:item.category||inferEventCategory(`${item.name||''} ${item.description||''}`),
            source:item.source||'VYNDI live event provider',
            sourceUrl:safeHttpUrl(item.sourceUrl||item.url||''),
            location:item.location||item.venue||'',
            editionDate:item.editionDate||item.date||item.startDate||'',
            distance:item.distance||''
          }));
        }
      }catch{}
    }

    const searches=variants.flatMap(term=>[
      searchWikidataEntities(term),
      searchWikipediaEvents(term)
    ]);
    const settled=await Promise.allSettled(searches);
    const publicGroups=settled.filter(result=>result.status==='fulfilled').map(result=>result.value);
    const results=mergeEventResults([providerResults,...publicGroups],query,category,locationFilter);

    renderEventResults(results);
    eventSearchStatus.textContent=results.length
      ? `${results.length} likely matches found. Results are ranked by event name, sport and location—select one and confirm the exact edition.`
      : 'No useful match found. Try only the event name, or create the event request below.';
  }catch(error){
    eventSearchStatus.textContent='Live event search is temporarily unavailable. You can still create the event manually below.';
    toast('Live event search unavailable — use the custom event form');
  }finally{
    eventSearchStatus.classList.remove('loading');
  }
}

async function resolveEventWikidataId(event){
  if(!event)return '';
  if(/^Q\d+$/.test(event.wikidataId||''))return event.wikidataId;
  if(event.source==='Wikidata'&&/^Q\d+$/.test(event.id||''))return event.id;
  const match=String(event.id||'').match(/^WP-(\d+)$/);
  if(!match)return '';
  try{
    const url=new URL('https://en.wikipedia.org/w/api.php');
    url.searchParams.set('action','query');
    url.searchParams.set('pageids',match[1]);
    url.searchParams.set('prop','pageprops');
    url.searchParams.set('ppprop','wikibase_item');
    url.searchParams.set('format','json');
    url.searchParams.set('origin','*');
    const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
    if(!response.ok)return '';
    const data=await response.json();
    return data.query?.pages?.[match[1]]?.pageprops?.wikibase_item||'';
  }catch{return ''}
}
async function fetchCommonsLogoCandidate(filename){
  if(!filename)return null;
  try{
    const url=new URL('https://commons.wikimedia.org/w/api.php');
    url.searchParams.set('action','query');
    url.searchParams.set('titles',`File:${filename}`);
    url.searchParams.set('prop','imageinfo');
    url.searchParams.set('iiprop','url|extmetadata');
    url.searchParams.set('iiurlwidth','360');
    url.searchParams.set('format','json');
    url.searchParams.set('origin','*');
    const response=await fetch(url.toString(),{headers:{Accept:'application/json'}});
    if(!response.ok)return null;
    const data=await response.json();
    const page=Object.values(data.query?.pages||{})[0];
    const info=page?.imageinfo?.[0];
    if(!info)return null;
    const meta=info.extmetadata||{};
    const licenseName=stripSearchMarkup(meta.LicenseShortName?.value||meta.UsageTerms?.value||'Licence details on Commons');
    const licenseUrl=safeHttpUrl(meta.LicenseUrl?.value||info.descriptionurl||'');
    const attribution=stripSearchMarkup(meta.Artist?.value||meta.Credit?.value||'');
    return {
      filename,
      thumbUrl:safeHttpUrl(info.thumburl||info.url||''),
      originalUrl:safeHttpUrl(info.url||''),
      sourceUrl:safeHttpUrl(info.descriptionurl||licenseUrl||''),
      licenseName,
      licenseUrl,
      attribution,
      source:'Wikimedia Commons'
    };
  }catch{return null}
}
async function enrichWikidataEvent(event){
  if(!event)return event;
  const wikidataId=await resolveEventWikidataId(event);
  if(!wikidataId)return event;
  try{
    const entityUrl=new URL('https://www.wikidata.org/w/api.php');
    entityUrl.searchParams.set('action','wbgetentities');
    entityUrl.searchParams.set('ids',wikidataId);
    entityUrl.searchParams.set('props','claims|labels|descriptions');
    entityUrl.searchParams.set('languages','en');
    entityUrl.searchParams.set('format','json');
    entityUrl.searchParams.set('origin','*');
    const response=await fetch(entityUrl.toString(),{headers:{Accept:'application/json'}});
    if(!response.ok)return {...event,wikidataId};
    const data=await response.json();
    const entity=data.entities?.[wikidataId];
    if(!entity)return {...event,wikidataId};
    const claims=entity.claims||{};
    const timeClaim=(claims.P585||claims.P580||[]).find(claim=>claim?.mainsnak?.datavalue?.value?.time);
    let editionDate=event.editionDate||'';
    if(timeClaim){
      const raw=timeClaim.mainsnak.datavalue.value.time;
      const match=raw.match(/[+-](\d{4})-(\d{2})-(\d{2})T/);
      if(match&&match[1]!=='0000')editionDate=`${match[1]}-${match[2]}-${match[3]}`;
    }
    const locationClaim=[...(claims.P276||[]),...(claims.P131||[]),...(claims.P17||[])].find(claim=>claim?.mainsnak?.datavalue?.value?.id);
    let locationLabel=event.location||'';
    const locationId=locationClaim?.mainsnak?.datavalue?.value?.id;
    if(locationId){
      const labelUrl=new URL('https://www.wikidata.org/w/api.php');
      labelUrl.searchParams.set('action','wbgetentities');
      labelUrl.searchParams.set('ids',locationId);
      labelUrl.searchParams.set('props','labels');
      labelUrl.searchParams.set('languages','en');
      labelUrl.searchParams.set('format','json');
      labelUrl.searchParams.set('origin','*');
      const labelResponse=await fetch(labelUrl.toString(),{headers:{Accept:'application/json'}});
      if(labelResponse.ok){
        const labelData=await labelResponse.json();
        locationLabel=labelData.entities?.[locationId]?.labels?.en?.value||locationLabel;
      }
    }
    const logoFilename=(claims.P154||[])
      .map(claim=>claim?.mainsnak?.datavalue?.value)
      .find(value=>typeof value==='string'&&value.trim());
    const logoCandidate=logoFilename?await fetchCommonsLogoCandidate(logoFilename):null;
    return {
      ...event,
      wikidataId,
      editionDate,
      location:locationLabel,
      description:entity.descriptions?.en?.value||event.description,
      logoCandidate:logoCandidate||event.logoCandidate||null
    };
  }catch{
    return {...event,wikidataId};
  }
}

function eventOrderSnapshot(event=selectedEvent){
  if(!event)return null;
  const {
    uploadedLogoDataUrl,
    ...rest
  }=event;
  return {
    ...rest,
    logoSelection:rest.logoSelection||null,
    uploadedLogoName:rest.uploadedLogoName||'',
    logoPermissionConfirmed:!!rest.logoPermissionConfirmed
  };
}
function persistSelectedEvent(){
  try{
    if(selectedEvent)localStorage.setItem('vyndiSelectedEvent',JSON.stringify(eventOrderSnapshot(selectedEvent)));
    else localStorage.removeItem('vyndiSelectedEvent');
  }catch{}
}
function selectedEventLogoMode(){
  return document.querySelector('input[name="eventLogoMode"]:checked')?.value||selectedEvent?.logoMode||'signature';
}
function setEventMarkElement(element,sourceUrl,fallbackText){
  if(!element)return;
  if(sourceUrl){
    element.classList.add('has-logo');
    element.style.backgroundImage=`url("${sourceUrl}")`;
    element.textContent='';
  }else{
    element.classList.remove('has-logo');
    element.style.backgroundImage='';
    element.textContent=fallbackText||'EV';
  }
}
function renderEventLogoWorkflow(event){
  if(!event)return;
  const candidate=event.logoCandidate||null;
  eventLogoCandidate.hidden=!candidate;
  const discoveredRadio=$('input[name="eventLogoMode"][value="discovered"]');
  discoveredRadio.disabled=!candidate;
  eventLogoDiscoveredOption.classList.toggle('disabled',!candidate);

  if(candidate){
    eventLogoCandidateImage.src=candidate.thumbUrl||candidate.originalUrl||'';
    eventLogoCandidateTitle.textContent='Event mark candidate found';
    const licence=[candidate.licenseName,candidate.attribution].filter(Boolean).join(' · ');
    eventLogoCandidateMeta.textContent=licence||'Source and licence details available on Wikimedia Commons.';
    eventLogoCandidateSource.href=candidate.licenseUrl||candidate.sourceUrl||'#';
  }else{
    eventLogoCandidateImage.removeAttribute('src');
    eventLogoCandidateMeta.textContent='';
    eventLogoCandidateSource.href='#';
  }

  let mode=event.logoMode||'signature';
  if(mode==='discovered'&&!candidate)mode='signature';
  const modeRadio=$(`input[name="eventLogoMode"][value="${mode}"]`);
  if(modeRadio)modeRadio.checked=true;
  event.logoMode=mode;

  const needsPermission=mode==='discovered'||mode==='upload';
  eventLogoPermissionWrap.hidden=!needsPermission;
  eventLogoPermission.checked=!!event.logoPermissionConfirmed;
  eventLogoUploadWrap.hidden=mode!=='upload';
  selectedEventLogoUploadState.textContent=event.uploadedLogoName||'Choose image';

  const approved=needsPermission&&event.logoPermissionConfirmed;
  const markSource=approved
    ? mode==='discovered'
      ? candidate?.thumbUrl||candidate?.originalUrl||''
      : event.uploadedLogoDataUrl||''
    : '';
  setEventMarkElement(selectedEventMark,markSource,eventInitials(event.name));
  eventLogoStatus.textContent=mode==='signature'
    ? 'VYNDI signature selected'
    : approved
      ? mode==='discovered'?'Discovered mark approved':'Uploaded mark approved'
      : 'Rights confirmation required';
}
function setEventLogoMode(mode){
  if(!selectedEvent)return;
  if(mode==='discovered'&&!selectedEvent.logoCandidate){
    mode='signature';
    const signature=$('input[name="eventLogoMode"][value="signature"]');
    if(signature)signature.checked=true;
  }
  selectedEvent.logoMode=mode;
  selectedEvent.logoPermissionConfirmed=false;
  window.vyndiEventMarkExportHref='';
  setEventMarkElement(studioEventMark,'',eventInitials(selectedEvent.name));
  studioEventMarkState.textContent=mode==='signature'?'VYNDI signature':'Pending event mark approval';
  eventLogoPermission.checked=false;
  eventLogoPermissionWrap.hidden=mode==='signature';
  eventLogoUploadWrap.hidden=mode!=='upload';
  renderEventLogoWorkflow(selectedEvent);
  persistSelectedEvent();
}
async function urlToDataUrl(url){
  if(!url)return '';
  try{
    const response=await fetch(url,{mode:'cors'});
    if(!response.ok)throw new Error('Image unavailable');
    const blob=await response.blob();
    return await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
  }catch{
    return url;
  }
}
async function applyApprovedEventMark(){
  if(!selectedEvent)return true;
  const mode=selectedEventLogoMode();
  selectedEvent.logoMode=mode;
  if(mode==='signature'){
    selectedEvent.logoPermissionConfirmed=false;
    selectedEvent.logoSelection={
      mode:'signature',
      source:'VYNDI generated signature',
      candidate:null
    };
    window.vyndiEventMarkExportHref='';
    setEventMarkElement(studioEventMark,'',eventInitials(selectedEvent.name));
    setEventMarkElement(selectedEventMark,'',eventInitials(selectedEvent.name));
    studioEventMarkState.textContent='VYNDI signature';
    persistSelectedEvent();
    return true;
  }

  if(!eventLogoPermission.checked){
    toast('Confirm rights before using an event mark');
    eventLogoPermission.focus();
    return false;
  }

  let source='';
  let selection={mode,source:'',candidate:null};
  if(mode==='discovered'){
    const candidate=selectedEvent.logoCandidate;
    if(!candidate?.thumbUrl&&!candidate?.originalUrl){
      toast('No discovered event mark is available');
      return false;
    }
    source=await urlToDataUrl(candidate.thumbUrl||candidate.originalUrl);
    selection={
      mode:'discovered',
      source:candidate.source||'Wikimedia Commons',
      candidate:{
        filename:candidate.filename,
        sourceUrl:candidate.sourceUrl,
        licenseName:candidate.licenseName,
        licenseUrl:candidate.licenseUrl,
        attribution:candidate.attribution
      }
    };
    studioEventMarkState.textContent=candidate.filename||'Discovered event mark';
  }else{
    source=selectedEvent.uploadedLogoDataUrl||'';
    if(!source){
      toast('Upload the authorised event mark first');
      selectedEventLogoUpload.click();
      return false;
    }
    selection={
      mode:'upload',
      source:'Customer supplied',
      candidate:null,
      filename:selectedEvent.uploadedLogoName||'Uploaded event mark'
    };
    studioEventMarkState.textContent=selectedEvent.uploadedLogoName||'Uploaded event mark';
  }

  selectedEvent.logoPermissionConfirmed=true;
  selectedEvent.logoSelection=selection;
  window.vyndiEventMarkExportHref=source;
  setEventMarkElement(studioEventMark,source,eventInitials(selectedEvent.name));
  setEventMarkElement(selectedEventMark,source,eventInitials(selectedEvent.name));
  studioEventSignature.hidden=false;
  persistSelectedEvent();
  return true;
}
function stageEventLogoFile(file){
  if(!file||!selectedEvent)return;
  const reader=new FileReader();
  reader.onload=()=>{
    selectedEvent.uploadedLogoDataUrl=String(reader.result||'');
    selectedEvent.uploadedLogoName=file.name;
    selectedEvent.logoMode='upload';
    selectedEvent.logoPermissionConfirmed=false;
    const uploadRadio=$('input[name="eventLogoMode"][value="upload"]');
    if(uploadRadio)uploadRadio.checked=true;
    selectedEventLogoUploadState.textContent=file.name;
    selectedEventLogoUploadState.title=file.name;
    renderEventLogoWorkflow(selectedEvent);
    persistSelectedEvent();
    toast('Event mark staged — confirm reproduction rights before using it');
  };
  reader.readAsDataURL(file);
}

function showSelectedEvent(event,shouldScroll=true){
  selectedEvent={...event};
  setEventTheme(selectedEvent);
  selectedEventPanel.hidden=false;
  setEventMarkElement(selectedEventMark,'',eventInitials(selectedEvent.name));
  selectedEventName.textContent=selectedEvent.name;
  selectedEventDescription.textContent=selectedEvent.description||'Confirm the event edition details below.';
  selectedEventDate.value=selectedEvent.editionDate||'';
  selectedEventLocation.value=selectedEvent.location||eventLocationFilter?.value.trim()||'';
  selectedEventDistance.value=selectedEvent.distance||'';
  selectedEventRouteRequest.checked=!!selectedEvent.routeVerificationRequested;
  renderEventLogoWorkflow(selectedEvent);
  persistSelectedEvent();
  if(shouldScroll)selectedEventPanel.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'nearest'});
}
function syncSelectedEventFromEdition(){
  if(!selectedEvent)return;
  selectedEvent.editionDate=selectedEventDate.value||'';
  selectedEvent.location=selectedEventLocation.value.trim();
  selectedEvent.distance=selectedEventDistance.value.trim();
  selectedEvent.routeVerificationRequested=selectedEventRouteRequest.checked;
  persistSelectedEvent();
}
async function applyEventToStudio(){
  if(!selectedEvent){toast('Select an event first');return}
  syncSelectedEventFromEdition();
  if(!(await applyApprovedEventMark()))return;
  const meta=[selectedEvent.editionDate,selectedEvent.location,selectedEvent.distance].filter(Boolean).join(' · ')||selectedEvent.description;
  $('#rideTitle').value=selectedEvent.name;
  $('#rideDetail').value=meta.slice(0,52);
  setCopy();
  if(mementoTitle){mementoTitle.value=selectedEvent.name.slice(0,38)}
  if(mementoDetail){mementoDetail.value=meta.slice(0,54)}
  if(typeof syncMementoCopy==='function')syncMementoCopy();
  studioEventSignature.hidden=false;
  studioEventName.textContent=selectedEvent.name;
  studioEventMeta.textContent=meta;
  setEventTheme(selectedEvent);
  const accent=eventAccent(selectedEvent);
  document.documentElement.style.setProperty('--route',accent);
  const matchingRadio=$(`input[name="palette"][value="${accent}"]`);
  if(matchingRadio)matchingRadio.checked=true;
  pulseStudioPreview();
  persistSelectedEvent();
  document.querySelector('#stories')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
  toast(`${selectedEvent.name} loaded into your Ride Memento`);
}
function clearEventSelection(){
  selectedEvent=null;
  selectedEventPanel.hidden=true;
  studioEventSignature.hidden=true;
  setEventMarkElement(studioEventMark,'','V');
  setEventMarkElement(selectedEventMark,'','V');
  studioAssetUrls.eventMark='';
  window.vyndiEventMarkExportHref='';
  studioEventMarkState.textContent='Only if you have permission';
  eventLogoCandidate.hidden=true;
  eventLogoPermissionWrap.hidden=true;
  eventLogoUploadWrap.hidden=true;
  eventLogoPermission.checked=false;
  const signature=$('input[name="eventLogoMode"][value="signature"]');
  if(signature)signature.checked=true;
  eventLogoStatus.textContent='VYNDI signature selected';
  persistSelectedEvent();
  document.documentElement.style.removeProperty('--event-accent');
  toast('Event selection cleared');
}
eventSearchButton?.addEventListener('click',searchEvents);
eventSearchInput?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();searchEvents()}});
$$('[data-event-category]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-event-category]').forEach(item=>item.classList.toggle('active',item===button));
  eventCategoryFilter.value=button.dataset.eventCategory;
  if(eventSearchInput.value.trim())searchEvents();
}));
$$('[data-event-query]').forEach(button=>button.addEventListener('click',()=>{
  eventSearchInput.value=button.dataset.eventQuery;
  searchEvents();
}));
eventSort?.addEventListener('change',()=>{
  try{renderEventResults(JSON.parse(eventResults.dataset.events||'[]'))}catch{}
});
eventCategoryFilter?.addEventListener('change',()=>{
  $$('[data-event-category]').forEach(button=>button.classList.toggle('active',button.dataset.eventCategory===eventCategoryFilter.value));
  try{renderEventResults(JSON.parse(eventResults.dataset.events||'[]'))}catch{}
});
eventResults?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-select-event]');
  if(!button)return;
  try{
    const events=JSON.parse(eventResults.dataset.events||'[]');
    const found=events[Number(button.dataset.selectEvent)];
    if(found){
      eventSearchStatus.textContent='Loading event edition details…';
      eventSearchStatus.classList.add('loading');
      const enriched=await enrichWikidataEvent(found);
      showSelectedEvent(enriched);
      eventSearchStatus.textContent='Event selected. Confirm the exact edition date, location and distance before using it.';
      eventSearchStatus.classList.remove('loading');
    }
  }catch{
    eventSearchStatus.classList.remove('loading');
  }
});
$$('input[name="eventLogoMode"]').forEach(radio=>radio.addEventListener('change',()=>setEventLogoMode(radio.value)));
eventLogoPermission?.addEventListener('change',()=>{
  if(!selectedEvent)return;
  selectedEvent.logoPermissionConfirmed=eventLogoPermission.checked;
  renderEventLogoWorkflow(selectedEvent);
  persistSelectedEvent();
});
selectedEventLogoUpload?.addEventListener('change',()=>{
  const file=selectedEventLogoUpload.files[0];
  if(file)stageEventLogoFile(file);
});
useSelectedEvent?.addEventListener('click',applyEventToStudio);
clearSelectedEvent?.addEventListener('click',clearEventSelection);
[selectedEventDate,selectedEventLocation,selectedEventDistance,selectedEventRouteRequest].forEach(el=>el?.addEventListener('change',syncSelectedEventFromEdition));
customEventForm?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!customEventForm.reportValidity())return;
  const custom={
    id:`CUSTOM-${Date.now()}`,
    name:$('#customEventName').value.trim(),
    category:$('#customEventCategory').value,
    editionDate:$('#customEventDate').value,
    location:$('#customEventLocation').value.trim(),
    distance:$('#customEventDistance').value.trim(),
    source:'Customer-created event request',
    sourceUrl:$('#customEventWebsite').value.trim(),
    description:'Custom VYNDI event entry created by the customer. Edition details require confirmation before production.'
  };
  showSelectedEvent(custom);
  toast('Custom event created — confirm details and use it in your memento');
});
studioEventMarkInput?.addEventListener('change',()=>{
  const file=studioEventMarkInput.files[0];
  if(!file)return;
  if(selectedEvent){
    stageEventLogoFile(file);
    document.querySelector('#event-finder')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    toast('Event mark staged — confirm rights in Event Finder');
    return;
  }
  const reader=new FileReader();
  reader.onload=()=>{
    const source=String(reader.result||'');
    window.vyndiEventMarkExportHref=source;
    setEventMarkElement(studioEventMark,source,'V');
    studioEventMarkState.textContent=file.name;
    studioEventMarkState.title=file.name;
    studioEventSignature.hidden=false;
    toast('Event mark added — ensure you have permission to reproduce it');
  };
  reader.readAsDataURL(file);
});
if(selectedEvent){
  showSelectedEvent(selectedEvent,false);
  studioEventSignature.hidden=false;
  studioEventName.textContent=selectedEvent.name;
  studioEventMeta.textContent=[selectedEvent.editionDate,selectedEvent.location,selectedEvent.distance].filter(Boolean).join(' · ')||selectedEvent.description;
}

// Ride Memento shop, cart and checkout
const productCatalog=[
  {id:'route',name:'Route Map Print',category:['route'],layout:'route',orientation:'portrait',badge:'Essential',description:'Your real GPX route on a geographic map with ride title, detail, route colour and frame treatment.'},
  {id:'photo',name:'Map + Ride Photo',category:['route','photo'],layout:'photo',orientation:'landscape',badge:'Rider story',description:'Route map paired with a ride photograph for a two-panel endurance memento.'},
  {id:'medal',name:'Map + Medal / Brevet',category:['route','medal'],layout:'medal',orientation:'landscape',badge:'Brevet / event',description:'Route map displayed with a medal or brevet image to keep the achievement and the road together.'},
  {id:'photo-medal',name:'Map + Photo + Medal',category:['route','photo','medal'],layout:'photo-medal',orientation:'landscape',badge:'Complete ride',description:'A three-part story combining the route, rider photograph and medal or brevet.'},
  {id:'complete',name:'Map + Photo + Medal + Bib',category:['route','photo','medal','bib'],layout:'complete',orientation:'landscape',badge:'Full memory',description:'The full event composition: route, photograph, medal or brevet, and bib or brevet card.'},
  {id:'memory-frame',name:'VYNDI Ride Memory Frame',category:['route','photo','medal','bib'],layout:'complete',orientation:'landscape',badge:'Shallow memory frame',description:'A premium shallow framed ride display combining your route, bib, medal and ride photograph in an original My Road — My Glory presentation.',physicalForm:'shallow-shadow-frame'},
  {id:'double-photo',name:'Map + Double Photo',category:['route','photo'],layout:'double-photo',orientation:'landscape',badge:'Two moments',description:'Your route with two ride photographs—ideal for start/finish, rider/team, or before/after moments.'},
  {id:'double-medal',name:'Map + Double Medal',category:['route','medal'],layout:'double-medal',orientation:'landscape',badge:'Two achievements',description:'A route map with two medal or brevet positions for multi-event or paired-event memories.'},
  {id:'gift',name:'VYNDI Ride Gift Card',category:['gift'],layout:'gift',orientation:'landscape',badge:'Gift',description:'Give a rider the choice to create their own VYNDI Ride Memento. Gift value is selected when commercial pricing is released.'}
];
const shopGrid=$('#shopGrid');
const cartButton=$('#cartButton');
const cartCount=$('#cartCount');
const cartDrawer=$('#cartDrawer');
const cartClose=$('#cartClose');
const cartScrim=$('#cartScrim');
const cartItems=$('#cartItems');
const cartEmpty=$('#cartEmpty');
const cartTotal=$('#cartTotal');
const checkoutButton=$('#checkoutButton');
const checkoutDialog=$('#checkoutDialog');
const checkoutClose=$('#checkoutClose');
const checkoutForm=$('#checkoutForm');
const checkoutLines=$('#checkoutLines');
const payOnlineButton=$('#payOnlineButton');
const bespokeButton=$('#bespokeButton');
const finishCartButton=$('#finishCartButton');
const addConfiguredToCart=$('#addConfiguredToCart');
const paymentUrl=document.querySelector('meta[name="vyndi-payment-url"]')?.content?.trim()||'';
let activeMerchandiseProductId='route';
let cart=[];
try{cart=JSON.parse(localStorage.getItem('vyndiRideMementoCart')||'[]');if(!Array.isArray(cart))cart=[]}catch{cart=[]}

function productVisual(product){
  if(product.id==='gift')return '<div class="shop-mini-frame landscape"><div class="shop-mini-mount"><div class="shop-mini-print">VYNDI<br>RIDE GIFT<br><small>YOUR ROAD · YOUR STORY</small></div></div></div>';
  if(product.id==='memory-frame')return '<div class="shop-memory-frame"><div class="shop-memory-frame-inner"><div class="shop-memory-route"></div><div class="shop-memory-photo"></div><div class="shop-memory-medal"></div></div></div>';
  return `<div class="shop-mini-frame ${product.orientation==='landscape'?'landscape':''}"><div class="shop-mini-mount"><div class="shop-mini-print"><div class="shop-mini-map"></div><div class="shop-mini-media"></div></div></div></div>`;
}
function renderShop(filter='all'){
  if(!shopGrid)return;
  shopGrid.innerHTML=productCatalog.map(product=>`
    <article class="shop-card" data-product="${product.id}" data-layout="${product.layout}" data-categories="${product.category.join(' ')}" ${filter!=='all'&&!product.category.includes(filter)?'hidden':''}>
      <div class="shop-card-visual"><span class="shop-card-badge">${product.badge}</span>${productVisual(product)}</div>
      <div class="shop-card-body">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="shop-card-meta"><span>${product.orientation}</span><strong>Price list pending</strong></div>
        <div class="shop-card-actions">
          <button class="shop-configure" type="button" data-configure-product="${product.id}">${product.id==='gift'?'Review':'Configure'}</button>
          <button type="button" data-quick-add="${product.id}">Add to cart</button>
        </div>
      </div>
    </article>`).join('');
}
function activeStudioConfig(){
  if(selectedEvent)syncSelectedEventFromEdition();
  return {
    title:$('#rideTitle')?.value?.trim()||'Your Ride Memento',
    detail:$('#rideDetail')?.value?.trim()||'Ride details to be confirmed',
    layout:document.querySelector('[data-studio-layout].active')?.dataset.studioLayout||'route',
    mapStyle:document.querySelector('[data-map-style].active')?.dataset.mapStyle||'graphite',
    frame:document.querySelector('[data-studio-frame].active')?.dataset.studioFrame||'black',
    mount:document.querySelector('[data-studio-mount].active')?.dataset.studioMount||'white',
    orientation:document.querySelector('[data-studio-size].active')?.dataset.studioSize||'portrait',
    routeColour:getComputedStyle(document.documentElement).getPropertyValue('--route').trim()||'#ffb000',
    event:eventOrderSnapshot(),
    files:{
      gpx:$('#fileState')?.textContent||'GPX not loaded',
      photo1:studioPhotoState?.textContent||'Not supplied',
      photo2:studioPhoto2State?.textContent||'Not supplied',
      medal1:studioMedalState?.textContent||'Not supplied',
      medal2:studioMedal2State?.textContent||'Not supplied',
      bib:studioBibState?.textContent||'Not supplied',
      eventMark:studioEventMarkState?.textContent||'Not supplied'
    }
  };
}
function configureProduct(productId){
  const product=productCatalog.find(item=>item.id===productId);
  if(!product)return;
  activeMerchandiseProductId=product.id;
  if(product.id==='gift'){
    addCartItem(product,{title:'VYNDI Ride Gift Card',detail:'Gift value to be selected after commercial pricing release',layout:'gift',orientation:'landscape'});
    openCart();
    return;
  }
  setStudioLayout(product.layout);
  setStudioSize(product.orientation);
  if(product.id==='memory-frame'){
    setStudioFrame('black');
    setStudioMount('white');
    setStudioMapStyle('graphite');
  }
  document.querySelector('#stories')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
  toast(`${product.name} loaded into the creator`);
}
function addCartItem(product,config){
  const item={
    uid:`RM-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,
    productId:product.id,
    name:product.name,
    price:null,
    configuration:config,
    addedAt:new Date().toISOString()
  };
  cart.push(item);
  persistCart();
  toast(`${product.name} added to cart`);
}
function addCurrentConfiguration(){
  const config=activeStudioConfig();
  const preferred=productCatalog.find(item=>item.id===activeMerchandiseProductId);
  const product=preferred?.layout===config.layout?preferred:(productCatalog.find(item=>item.layout===config.layout)||productCatalog[0]);
  addCartItem(product,{...config,physicalForm:product.physicalForm||'standard-frame'});
  openCart();
}
function persistCart(){
  try{localStorage.setItem('vyndiRideMementoCart',JSON.stringify(cart))}catch{}
  renderCart();
}
function renderCart(){
  if(cartCount)cartCount.textContent=String(cart.length);
  if(!cartItems)return;
  cartEmpty.hidden=cart.length>0;
  cartItems.innerHTML=cart.map(item=>`<article class="cart-item"><div><h3>${escapeXml(String(item.name||''))}</h3><p>${escapeXml(String(item.configuration?.title||'To be personalised'))} · ${escapeXml(String(item.configuration?.frame||'frame TBD'))} · ${escapeXml(String(item.configuration?.orientation||'format TBD'))}</p></div><button type="button" aria-label="Remove ${escapeXml(String(item.name||''))}" data-remove-cart="${escapeXml(String(item.uid||''))}">×</button></article>`).join('');
  cartTotal.textContent=cart.length?`${cart.length} item${cart.length===1?'':'s'} · price list pending`:'Price list pending';
  checkoutButton.disabled=cart.length===0;
}
function openCart(){
  cartDrawer.classList.add('open');
  cartDrawer.setAttribute('aria-hidden','false');
  cartButton.setAttribute('aria-expanded','true');
  cartScrim.hidden=false;
}
function closeCart(){
  cartDrawer.classList.remove('open');
  cartDrawer.setAttribute('aria-hidden','true');
  cartButton.setAttribute('aria-expanded','false');
  cartScrim.hidden=true;
}
function renderCheckout(){
  checkoutLines.innerHTML=cart.map(item=>`<div class="checkout-line"><span>${item.name}</span><strong>Price pending</strong></div>`).join('');
}
function makeOrderRequest(){
  if(selectedEvent)syncSelectedEventFromEdition();
  const orderRef=`VYNDI-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  return {
    order_reference:orderRef,
    status:'ORDER REQUEST — PAYMENT NOT CAPTURED',
    created_at:new Date().toISOString(),
    customer:{
      name:$('#checkoutName').value.trim(),
      email:$('#checkoutEmail').value.trim(),
      phone:$('#checkoutPhone').value.trim(),
      pincode:$('#checkoutPincode').value.trim(),
      shipping_address:$('#checkoutAddress').value.trim()
    },
    event:eventOrderSnapshot(),
    items:cart,
    pricing_status:'Commercial price list pending approval',
    payment_status:'Payment gateway not connected'
  };
}
renderShop();
renderCart();

$$('[data-shop-filter]').forEach(button=>button.addEventListener('click',()=>{
  $$('[data-shop-filter]').forEach(item=>item.classList.toggle('active',item===button));
  const filter=button.dataset.shopFilter;
  $$('.shop-card').forEach(card=>card.hidden=filter!=='all'&&!card.dataset.categories.split(' ').includes(filter));
}));
shopGrid?.addEventListener('click',event=>{
  const configure=event.target.closest('[data-configure-product]');
  const quickAdd=event.target.closest('[data-quick-add]');
  if(configure)configureProduct(configure.dataset.configureProduct);
  if(quickAdd){
    const product=productCatalog.find(item=>item.id===quickAdd.dataset.quickAdd);
    if(product)addCartItem(product,{title:'To be personalised',detail:'Configure in VYNDI Ride Memento studio',layout:product.layout,orientation:product.orientation,frame:'To be selected',mount:'To be selected',mapStyle:'To be selected',event:eventOrderSnapshot()});
  }
});
cartButton?.addEventListener('click',openCart);
finishCartButton?.addEventListener('click',openCart);
cartClose?.addEventListener('click',closeCart);
cartScrim?.addEventListener('click',closeCart);
cartItems?.addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove-cart]');
  if(!remove)return;
  cart=cart.filter(item=>item.uid!==remove.dataset.removeCart);
  persistCart();
});
addConfiguredToCart?.addEventListener('click',addCurrentConfiguration);
bespokeButton?.addEventListener('click',()=>{
  setStudioLayout('complete');
  document.querySelector('#stories')?.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
  toast('Bespoke starting point loaded — use the studio and save the order request');
});
checkoutClose?.addEventListener('click',()=>checkoutDialog.close());
checkoutButton?.addEventListener('click',()=>{
  if(!cart.length){toast('Your cart is empty');return}
  renderCheckout();
  closeCart();
  checkoutDialog.showModal();
});
checkoutForm?.addEventListener('submit',event=>{
  event.preventDefault();
  if(!checkoutForm.reportValidity())return;
  const order=makeOrderRequest();
  try{localStorage.setItem('vyndiLastOrderRequest',JSON.stringify(order))}catch{}
  download(`${order.order_reference}.json`,JSON.stringify(order,null,2),'application/json');
  checkoutDialog.close();
  toast(`${order.order_reference} saved — payment has not been charged`);
});
if(paymentUrl){
  payOnlineButton.disabled=false;
  payOnlineButton.textContent='Continue to secure payment';
  payOnlineButton.addEventListener('click',()=>{
    const ref=makeOrderRequest().order_reference;
    const join=paymentUrl.includes('?')?'&':'?';
    window.open(`${paymentUrl}${join}order_ref=${encodeURIComponent(ref)}`,'_blank','noopener');
  });
}
