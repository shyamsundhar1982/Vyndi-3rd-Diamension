const PARENT_ORIGIN=location.origin;
function setField(id,value){
  const el=document.getElementById(id);if(!el||value==null||value==="")return;
  el.value=String(value);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));
}
async function loadGpx(payload){
  const input=document.getElementById("gpxInput");
  if(!input)throw new Error("Ride Stories GPX input not found.");
  const file=new File([String(payload.gpxText||"")],String(payload.fileName||"v3d-route.gpx"),{type:"application/gpx+xml"});
  const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
  input.dispatchEvent(new Event("change",{bubbles:true}));
  const meta=payload.meta||{};
  setField("eventName",meta.event);setField("participant",meta.rider);setField("eventDate",meta.date);
  setField("eventLocation",meta.location);setField("bib",meta.bib);
}
addEventListener("message",event=>{
  if(event.origin!==PARENT_ORIGIN||event.data?.type!=="v3d-load-gpx")return;
  loadGpx(event.data).then(()=>parent.postMessage({type:"v3d-source-loaded",engine:"ride-stories"},PARENT_ORIGIN))
    .catch(error=>parent.postMessage({type:"v3d-source-error",engine:"ride-stories",message:error.message},PARENT_ORIGIN));
});
parent.postMessage({type:"v3d-source-ready",engine:"ride-stories"},PARENT_ORIGIN);
