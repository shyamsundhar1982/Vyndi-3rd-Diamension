import { processGpxTextJob } from "./gpx-core.mjs";

self.onmessage=async event=>{
  const {file,fallbackName,maxPoints=20000,serialize=false}=event.data||{};
  try{
    if(!file)throw new Error("No GPX file supplied.");
    const text=await file.text();
    const {route,liveText}=processGpxTextJob(text,{fallbackName:fallbackName||file.name,maxPoints,serialize});
    self.postMessage({ok:true,route,liveText});
  }catch(error){
    self.postMessage({ok:false,error:error?.message||String(error)});
  }
};
