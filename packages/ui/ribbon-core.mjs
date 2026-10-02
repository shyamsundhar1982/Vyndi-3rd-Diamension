const clean=value=>String(value??"").trim().replace(/\s+/g," ");
const finite=value=>Number.isFinite(Number(value))?Number(value):0;

export const DEFAULT_TERRAIN_PALETTE=Object.freeze({
  land:"#b7a77a",
  forest:"#3f6b3a",
  mountain:"#8b8378",
  snow:"#f4f7f8",
  water:"#2f86a6",
  route:"#ff6a1f",
  roads:"#c9c1b5",
  labels:"#f2c14e"
});

export function normalizeTerrainPalette(input={}){
  const out={};
  for(const [key,fallback] of Object.entries(DEFAULT_TERRAIN_PALETTE)){
    const value=clean(input[key]);
    out[key]=/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;
  }
  return out;
}

export function formatDuration(seconds=0){
  const total=Math.max(0,Math.round(finite(seconds)));
  const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return [h,m,s].map((v,i)=>i===0?String(v).padStart(2,"0"):String(v).padStart(2,"0")).join(":");
}

export function deriveRibbonMeta(route={},overrides={}){
  const points=Array.isArray(route.points)?route.points:[];
  const firstTime=points.find(p=>Number.isFinite(Number(p?.time)))?.time;
  const date=clean(overrides.date)||(
    Number.isFinite(Number(firstTime))
      ? new Date(Number(firstTime)).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
      : ""
  );
  const distance=finite(route.distanceKm);
  const elevation=finite(route.elevationGainM);
  return {
    event:clean(overrides.event)||clean(route.name)||"UNTITLED ROUTE",
    rider:clean(overrides.rider)||"RIDER",
    date,
    distance:distance?Math.round(distance).toLocaleString("en-US")+" KM":"— KM",
    elevation:elevation?Math.round(elevation).toLocaleString("en-US")+" M":"— M",
    duration:finite(route.elapsedTimeSeconds)?formatDuration(route.elapsedTimeSeconds):"—",
    sourcePoints:(finite(route.sourcePointCount)||points.length).toLocaleString("en-US")+" PTS"
  };
}

export function terrainBandForElevation(elevationM,thresholds={}){
  const mountainM=Math.max(0,finite(thresholds.mountainM)||1200);
  const snowM=Math.max(mountainM,finite(thresholds.snowM)||2600);
  const elevation=finite(elevationM);
  if(elevation>=snowM)return "snow";
  if(elevation>=mountainM)return "mountain";
  return "land";
}
