import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import fontJson from "three/examples/fonts/helvetiker_bold.typeface.json";
import { TRAILRELIEF_SOURCE_SCENE } from "../../packages/source-parity/source-contracts.mjs";

const font=new FontLoader().parse(fontJson);

function disposeObject(object){
  object.traverse?.(node=>{
    node.geometry?.dispose?.();
    if(Array.isArray(node.material))node.material.forEach(material=>material.dispose?.());
    else node.material?.dispose?.();
  });
}

function regionColor(region,colors={}){
  const map={
    0:colors.land||"#b7a77a",1:colors.forest||"#3f6b3a",2:colors.mountain||"#8a7a68",3:colors.snow||"#f4f3ee",
    4:colors.water||"#3d86b8",5:colors.route||"#ff6a1f",6:colors.roads||"#c9c1b5",7:colors.trails||colors.forest||"#3f6b3a",
    8:colors.railways||"#7e8791",9:colors.buildings||"#d8d1c4",10:colors.logo||colors.text||"#f2c14e",
    11:colors.text||"#f2c14e",12:colors.rim||"#23201d"
  };
  return map[region]||colors.base||"#2b2622";
}

function regionGeometry(mesh,region){
  const vertices=mesh?.vertices||[],positions=[];
  for(const triangle of mesh?.triangles||[]){
    if(Number(triangle.region)!==Number(region))continue;
    for(const id of [triangle.a,triangle.b,triangle.c]){
      const v=vertices[id];if(!v)continue;
      positions.push(Number(v.x)||0,Number(v.y)||0,Number(v.z)||0);
    }
  }
  if(!positions.length)return null;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

function curvedTextGroup(text,{radius=76,z=8,size=6,depth=.8,color="#f2c14e"}={}){
  const clean=String(text||"").trim();const group=new THREE.Group();if(!clean)return group;
  const glyphs=[],tracking=Math.max(.45,size*.10);
  let total=0;
  for(const char of clean){
    const geometry=new TextGeometry(char,{font,size,depth,curveSegments:2,bevelEnabled:false});
    geometry.computeBoundingBox();
    const box=geometry.boundingBox,width=Math.max(size*.28,(box?.max.x||0)-(box?.min.x||0));
    glyphs.push({geometry,width,char});total+=width+tracking;
  }
  total=Math.max(0,total-tracking);
  const maxArc=Math.PI*1.82,scale=Math.min(1,(radius*maxArc)/Math.max(1,total));
  const material=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:.03});
  let cursor=-total*scale/2;
  for(const item of glyphs){
    const width=item.width*scale,center=cursor+width/2,angle=-Math.PI/2+center/radius;
    item.geometry.scale(scale,scale,scale);
    item.geometry.computeBoundingBox();
    const box=item.geometry.boundingBox;
    item.geometry.translate(-((box?.min.x||0)+(box?.max.x||0))/2,-((box?.min.y||0)+(box?.max.y||0))/2,0);
    const mesh=new THREE.Mesh(item.geometry,material.clone());
    mesh.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,z);
    mesh.rotation.z=angle+Math.PI/2;
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    cursor+=width+tracking*scale;
  }
  return group;
}

export function renderTrailReliefSource({canvas,model,colors={},label="",modelWidthMm=180,rimWidthMm=12,rimHeightMm=5,baseMm=3,textSize=6,textDepth=.8}={}){
  if(!canvas||!model?.mesh)throw new Error("TrailRelief source renderer needs a canvas and governed mesh.");
  const sceneContract=TRAILRELIEF_SOURCE_SCENE;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(2,globalThis.devicePixelRatio||1));
  renderer.setClearColor(sceneContract.background,1);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;

  const scene=new THREE.Scene();scene.background=new THREE.Color(sceneContract.background);
  const r=Math.max(Number(modelWidthMm)||180,Number(modelWidthMm)||180);
  const camera=new THREE.PerspectiveCamera(sceneContract.cameraFov,1,sceneContract.near,r*sceneContract.farScale);
  camera.position.set(0,r*sceneContract.cameraPositionScale[1],r*sceneContract.cameraPositionScale[2]);
  camera.lookAt(0,0,0);

  const hemi=new THREE.HemisphereLight(sceneContract.hemisphereSky,sceneContract.hemisphereGround,sceneContract.hemisphereIntensity);scene.add(hemi);
  const key=new THREE.DirectionalLight("#fff4e0",sceneContract.directionalIntensity);
  key.position.set(r*sceneContract.directionalPositionScale[0],r*sceneContract.directionalPositionScale[1],r*sceneContract.directionalPositionScale[2]);
  key.castShadow=true;key.shadow.mapSize.set(sceneContract.shadowMapSize,sceneContract.shadowMapSize);key.shadow.bias=sceneContract.shadowBias;
  key.shadow.camera.left=-r;key.shadow.camera.right=r;key.shadow.camera.top=r;key.shadow.camera.bottom=-r;scene.add(key);

  const softTop=new THREE.RectAreaLight("#ffffff",sceneContract.softboxTopIntensity,r*1.5,r*1.5);softTop.position.set(0,r*.8,0);softTop.lookAt(0,0,0);scene.add(softTop);
  const warm=new THREE.RectAreaLight(sceneContract.softboxWarmColor,sceneContract.softboxWarmIntensity,r*1.8,r*.7);warm.position.set(-r*.8,r*.15,-r*.15);warm.lookAt(0,0,0);scene.add(warm);

  const group=new THREE.Group();group.rotation.x=-Math.PI/2;scene.add(group);
  for(const region of [...new Set((model.mesh.triangles||[]).map(t=>Number(t.region)))].sort((a,b)=>a-b)){
    if(region===11)continue;
    const geometry=regionGeometry(model.mesh,region);if(!geometry)continue;
    const material=new THREE.MeshStandardMaterial({color:regionColor(region,colors),roughness:sceneContract.roughness,metalness:sceneContract.metalness});
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  if(label&&rimWidthMm>=2){
    const radius=Math.max(4,(Number(modelWidthMm)||180)/2-Math.max(0,Number(rimWidthMm)||12)/2);
    const z=Math.max(0,Number(baseMm)||3)+Math.max(0,Number(rimHeightMm)||5)-.2;
    const text=curvedTextGroup(label,{radius,z,size:Math.min(Number(textSize)||6,Math.max(2,(Number(rimWidthMm)||12)*.75)),depth:Number(textDepth)||.8,color:colors.text||"#f2c14e"});
    group.add(text);
  }

  const ground=new THREE.Mesh(new THREE.PlaneGeometry(r*3.5,r*3.5),new THREE.ShadowMaterial({color:"#000000",opacity:sceneContract.contactShadowOpacity*.55}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.05;ground.receiveShadow=true;scene.add(ground);

  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2.05;controls.minDistance=r*.2;controls.maxDistance=r*4;
  const resize=()=>{
    const rect=canvas.getBoundingClientRect(),width=Math.max(2,Math.floor(rect.width)),height=Math.max(2,Math.floor(rect.height));
    if(canvas.width!==Math.floor(width*renderer.getPixelRatio())||canvas.height!==Math.floor(height*renderer.getPixelRatio()))renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
  };
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  let frame=0,disposed=false;
  const loop=()=>{if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(loop)};loop();
  return {
    reset(){camera.position.set(0,r*sceneContract.cameraPositionScale[1],r*sceneContract.cameraPositionScale[2]);controls.target.set(0,0,0);controls.update()},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();disposeObject(scene);renderer.dispose()}
  };
}
