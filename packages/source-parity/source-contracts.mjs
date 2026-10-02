export const TRAILRELIEF_SOURCE_DEFAULTS=Object.freeze({
  paddingKm:3,resolution:220,modelSize:180,exaggeration:2,plateThickness:3,snowLine:2600,mountainLine:1200,
  forestRaise:.4,waterDepth:.6,
  colors:Object.freeze({
    base:"#2b2622",land:"#b7a77a",mountain:"#8a7a68",snow:"#f4f3ee",forest:"#3f6b3a",
    water:"#3d86b8",sea:"#1f4f7a",route:"#ff6a1f",rim:"#23201d",text:"#f2c14e"
  }),
  routeMode:"raised",routeWidth:1.6,routeHeight:1.2,clearance:.2,shape:"round",
  rimWidth:12,rimHeight:5,textEnabled:true,textSize:6,textDepth:.8,units:"metric",
  labels:Object.freeze({name:"",date:"",time:true,distance:true,gain:true}),
  tiled:false,bedX:220,bedY:220,pegs:true
});

export const TRAILRELIEF_SOURCE_SCENE=Object.freeze({
  background:"#171411",
  cameraFov:40,cameraPositionScale:Object.freeze([0,1.05,1.25]),near:1,farScale:20,
  hemisphereSky:"#fff4e0",hemisphereGround:"#2a2420",hemisphereIntensity:.6,
  directionalPositionScale:Object.freeze([.6,1,.3]),directionalIntensity:2.2,
  shadowMapSize:2048,shadowBias:-.0005,
  softboxTopIntensity:1.5,softboxWarmIntensity:.8,softboxWarmColor:"#ffcf99",
  roughness:.82,metalness:.02,contactShadowBlur:2.5,contactShadowOpacity:.6
});

export const VYNDI_SOURCE_DEFAULTS=Object.freeze({
  exaggeration:5,reliefLimitMm:4,waterMode:"procedural-waves",waveHeightMm:.3,wavelengthMm:2.6,
  baseMm:3.2,routeStyle:"raised",routeWidthMm:1.2,routeRiseMm:1,
  shape:"circle",terrainColor:"#343a3e",waterColor:"#2f9bc1",routeColor:"#ff5c35",roadsColor:"#e7ece9",labelsColor:"#b8f229"
});

export const VYNDI_SOURCE_VIEW=Object.freeze({
  yaw:-.42,pitch:.92,zoom:1,perspectiveDepth:.0024,
  waterBase:.13,landBase:.16,landReliefBase:.18,exaggerationRelief:.055,
  waterShade:Object.freeze([.34,.92,1.22]),landShade:Object.freeze([.72,.84,.88]),
  shadeBase:72,shadeDepth:.35,shadeMin:38,shadeMax:112
});

export function sourceProfileOptions(){
  return [
    {id:"trailrelief-original",label:"TrailRelief Original"},
    {id:"vyndi-original",label:"VYNDI Terrain Medal Original"},
    {id:"v3d-unified",label:"V3D Unified"}
  ];
}

export function trailReliefSourceConfig(customization={}){
  const d=TRAILRELIEF_SOURCE_DEFAULTS;
  return {
    dem:{source:"terrarium",routeElevationMode:"dem",routeElevationBlend:.5,fillNoData:true,smoothingRadius:0,crsOverride:"",maxDeltaM:150},
    map:{roads:false,trails:false,railways:false,buildings:false},
    placeLabels:{mode:"none",selectedNames:[],maxCount:0},
    terrainBands:{mountainM:d.mountainLine,snowM:d.snowLine},
    surface:{forestRaiseMm:d.forestRaise,waterDepthMm:d.waterDepth,waterMode:"flat",waveHeightMm:0,waveSpacingMm:2.6},
    contours:{enabled:false,intervalMm:1,widthMm:.08,riseMm:.2},
    colors:{
      base:d.colors.base,terrain:d.colors.land,land:d.colors.land,mountain:d.colors.mountain,snow:d.colors.snow,
      forest:d.colors.forest,water:d.colors.water,sea:d.colors.sea,route:d.colors.route,rim:d.colors.rim,text:d.colors.text,
      labels:d.colors.text,logo:d.colors.text,roads:"#c9c1b5",trails:d.colors.forest,railways:"#7e8791",buildings:"#d8d1c4"
    },
    shape:{kind:"circle",aspect:1,routeBufferKm:d.paddingKm,outlineGeometry:null,logoEnabled:false,logoAuto:true,logoWidthMm:18,logoRiseMm:.8},
    fabrication:{
      modelWidthMm:d.modelSize,baseMm:d.plateThickness,reliefMm:12,targetXyMm:Math.max(.25,d.modelSize/d.resolution),
      routeStyle:d.routeMode,routeWidthMm:d.routeWidth,routeRiseMm:d.routeHeight,
      rimWidthMm:d.rimWidth,rimHeightMm:d.rimHeight,
      tiled:false,maxTileMm:d.bedX,maxTileWidthMm:d.bedX,maxTileHeightMm:d.bedY,jointType:"dovetail",jointDiameterMm:8,jointDepthMm:2,jointClearanceMm:d.clearance,
      magnetEnabled:false,magnetDiameterMm:8,magnetDepthMm:2,magnetSpacingMm:30,
      hangerEnabled:false,hangerInnerDiameterMm:6,hangerWallMm:3,standEnabled:false,heightmapStrengthMm:0
    },
    production:{
      printerProfile:"bambu-p1s",medalSize:"180",surfaceLettering:"full",rimTextLayout:"standard",
      sourceRenderer:"trailrelief-original",trailReliefExaggeration:d.exaggeration,trailReliefResolution:d.resolution,
      trailReliefTextSize:d.textSize,trailReliefTextDepth:d.textDepth,bottomMark:"",bottomEngraveDepthMm:.35
    },
    customization:{event:String(customization.event||""),name:String(customization.name||""),date:String(customization.date||""),distance:String(customization.distance||""),elevation:String(customization.elevation||""),duration:String(customization.duration||"")}
  };
}

export function vyndiSourceConfig(base={}){
  return {
    ...base,
    production:{...(base.production||{}),sourceRenderer:"vyndi-original"},
    shape:{...(base.shape||{}),kind:base.shape?.kind||"circle"}
  };
}
