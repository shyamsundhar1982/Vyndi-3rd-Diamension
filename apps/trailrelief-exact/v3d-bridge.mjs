const PARENT_ORIGIN=location.origin;
function waitForFileInput(){
  return new Promise((resolve,reject)=>{
    const deadline=Date.now()+15000;
    const tick=()=>{
      const input=document.querySelector('input[type="file"][accept*=".gpx"],input[type="file"]');
      if(input)return resolve(input);
      if(Date.now()>deadline)return reject(new Error("TrailRelief GPX input not found."));
      requestAnimationFrame(tick);
    };
    tick();
  });
}
async function loadGpx(payload){
  const input=await waitForFileInput();
  const file=new File([String(payload.gpxText||"")],String(payload.fileName||"v3d-route.gpx"),{type:"application/gpx+xml"});
  const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
  input.dispatchEvent(new Event("change",{bubbles:true}));
  document.documentElement.dataset.v3dGpxLoaded=file.name;
}
addEventListener("message",event=>{
  if(event.origin!==PARENT_ORIGIN||event.data?.type!=="v3d-load-gpx")return;
  loadGpx(event.data).then(()=>parent.postMessage({type:"v3d-source-loaded",engine:"trailrelief"},PARENT_ORIGIN))
    .catch(error=>parent.postMessage({type:"v3d-source-error",engine:"trailrelief",message:error.message},PARENT_ORIGIN));
});
parent.postMessage({type:"v3d-source-ready",engine:"trailrelief"},PARENT_ORIGIN);
