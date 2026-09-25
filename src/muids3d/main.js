import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LE_MUIDS, wmsUrl, loadOfficialLayout } from '../geo/swisstopo.js';

const app=document.querySelector('#app');
const status=document.querySelector('#status');
const pauseBtn=document.querySelector('#pause');

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping;
renderer.toneMappingExposure=1.05;
app.prepend(renderer.domElement);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb9d6e5);

const camera=new THREE.PerspectiveCamera(42,1,1,6000);
const HOME_POS=new THREE.Vector3(760,670,940);
camera.position.copy(HOME_POS);

const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,0,0);
controls.enableDamping=true;
controls.dampingFactor=.055;
controls.maxPolarAngle=Math.PI*.495;
controls.minDistance=80;
controls.maxDistance=2600;

scene.add(new THREE.HemisphereLight(0xe9f4ff,0x53644a,1.65));
const sun=new THREE.DirectionalLight(0xfff0d2,3.0);
sun.position.set(-600,900,500);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-900;
sun.shadow.camera.right=900;
sun.shadow.camera.top=700;
sun.shadow.camera.bottom=-700;
sun.shadow.camera.near=10;
sun.shadow.camera.far=2500;
scene.add(sun);

const groups={
  real:new THREE.Group(),
  fiction:new THREE.Group(),
  train:new THREE.Group()
};
scene.add(groups.real,groups.fiction,groups.train);

const centerE=LE_MUIDS.station[0];
const centerN=LE_MUIDS.station[1];

function local([e,n],y=0){
  return new THREE.Vector3(e-centerE,y,-(n-centerN));
}
function local2([e,n]){
  return [e-centerE,-(n-centerN)];
}
function mat(color,rough=.9,metal=0){
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
}

function lineStrings(geometry){
  if(!geometry)return[];
  if(geometry.type==='LineString')return[geometry.coordinates];
  if(geometry.type==='MultiLineString')return geometry.coordinates;
  if(geometry.type==='Polygon')return geometry.coordinates;
  if(geometry.type==='MultiPolygon')return geometry.coordinates.flat();
  return[];
}

function curveFromLV95(points,y=.65,closed=false){
  const p=points.map(pt=>local(pt,y));
  return new THREE.CatmullRomCurve3(p,closed,'centripetal',.3);
}

function tubeFromPoints(points,radius,color,y=.65,closed=false,segmentsFactor=1){
  if(points.length<2)return null;
  const curve=curveFromLV95(points,y,closed);
  const geom=new THREE.TubeGeometry(curve,Math.max(8,Math.round(points.length*8*segmentsFactor)),radius,6,closed);
  const mesh=new THREE.Mesh(geom,mat(color,.78,.08));
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  return mesh;
}

function makeRibbon(points,width,color,y=1,closed=false){
  const curve=curveFromLV95(points,y,closed);
  const segments=Math.max(80,points.length*14);
  const pos=[],idx=[];
  const up=new THREE.Vector3(0,1,0);
  for(let i=0;i<=segments;i++){
    const t=i/segments;
    const p=curve.getPointAt(t);
    const tangent=curve.getTangentAt(t).normalize();
    const normal=new THREE.Vector3().crossVectors(up,tangent).normalize();
    const left=p.clone().addScaledVector(normal,width/2);
    const right=p.clone().addScaledVector(normal,-width/2);
    pos.push(left.x,left.y,left.z,right.x,right.y,right.z);
    if(i<segments){
      const a=i*2,b=a+1,c=a+2,d=a+3;
      idx.push(a,c,b,c,d,b);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat(color,.94));
  m.receiveShadow=true;
  return{mesh:m,curve};
}

function addSleepers(curve,count,width,y,group){
  const geo=new THREE.BoxGeometry(width,.16,.34);
  const sleeperMat=mat(0x8b6340,.95);
  const inst=new THREE.InstancedMesh(geo,sleeperMat,count);
  inst.castShadow=true;
  inst.receiveShadow=true;
  const tmp=new THREE.Object3D();
  for(let i=0;i<count;i++){
    const t=i/count;
    const p=curve.getPointAt(t);
    const tangent=curve.getTangentAt(t).normalize();
    tmp.position.set(p.x,y,p.z);
    tmp.rotation.set(0,Math.atan2(tangent.x,tangent.z),0);
    tmp.updateMatrix();
    inst.setMatrixAt(i,tmp.matrix);
  }
  group.add(inst);
}

function addTrack(points,group){
  const base=makeRibbon(points,4.6,0x9b7a58,1.0,true);
  group.add(base.mesh);
  for(const off of [-.75,.75]){
    const samples=[];
    const count=220;
    const up=new THREE.Vector3(0,1,0);
    for(let i=0;i<count;i++){
      const t=i/(count-1);
      const p=base.curve.getPointAt(t);
      const tangent=base.curve.getTangentAt(t).normalize();
      const normal=new THREE.Vector3().crossVectors(up,tangent).normalize();
      samples.push(p.clone().addScaledVector(normal,off));
    }
    const c=new THREE.CatmullRomCurve3(samples,true,'centripetal',.25);
    const rail=new THREE.Mesh(new THREE.TubeGeometry(c,420,.085,8,true),mat(0x4e5357,.35,.65));
    rail.castShadow=true;
    group.add(rail);
  }
  addSleepers(base.curve,190,3.2,1.18,group);
  return base.curve;
}

function addTunnelMarker(xy,index){
  const p=local(xy,2.2);
  const group=new THREE.Group();
  const portal=new THREE.Mesh(
    new THREE.BoxGeometry(14,5,4),
    mat(0x2b72d6,.65,.05)
  );
  portal.position.copy(p);
  portal.castShadow=true;
  group.add(portal);
  const cap=new THREE.Mesh(
    new THREE.CylinderGeometry(7,7,4,24,1,false,0,Math.PI),
    mat(0x2b72d6,.65,.05)
  );
  cap.rotation.z=Math.PI/2;
  cap.rotation.y=Math.PI/2;
  cap.position.copy(p).add(new THREE.Vector3(0,2.5,0));
  group.add(cap);
  group.userData.index=index;
  groups.fiction.add(group);
}

async function makeGround(){
  const [minE,minN,maxE,maxN]=LE_MUIDS.bbox;
  const w=maxE-minE,h=maxN-minN;
  const loader=new THREE.TextureLoader();
  const url=wmsUrl(LE_MUIDS.layers.cadastralWms,LE_MUIDS.bbox,1600,1000);

  let texture=null;
  try{
    texture=await loader.loadAsync(url);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  }catch(err){
    console.warn('WMS texture failed',err);
  }

  const side=new THREE.Mesh(
    new THREE.BoxGeometry(w,18,h),
    mat(0x6f5b43,1)
  );
  side.position.set((minE+maxE)/2-centerE,-9,-((minN+maxN)/2-centerN));
  side.receiveShadow=true;
  scene.add(side);

  const ground=new THREE.Mesh(
    new THREE.PlaneGeometry(w,h),
    texture
      ? new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0})
      : mat(0x93b96d,1)
  );
  ground.rotation.x=-Math.PI/2;
  ground.position.set((minE+maxE)/2-centerE,.08,-((minN+maxN)/2-centerN));
  ground.receiveShadow=true;
  scene.add(ground);
}

function buildOfficialNetwork(official){
  let roads=0,rails=0;
  for(const feature of official.features){
    const layer=feature.properties?._layer||'';
    const isRail=layer.includes('eisenbahnnetz');
    const isRoad=layer.includes('strassen');
    if(!isRail&&!isRoad)continue;

    for(const points of lineStrings(feature.geometry)){
      if(points.length<2)continue;
      const mesh=tubeFromPoints(
        points,
        isRail?.52:.38,
        isRail?0x34383b:0x5f6569,
        isRail?1.15:.85,
        false,
        .7
      );
      if(mesh){
        mesh.userData.kind=isRail?'officialRail':'officialRoad';
        groups.real.add(mesh);
        if(isRail)rails++; else roads++;
      }
    }
  }
  return{roads,rails};
}

async function buildTrain(curve){
  const loader=new GLTFLoader();
  const urls=[
    'assets/kenney/train-kit/train-locomotive-a.glb',
    'assets/kenney/train-kit/train-carriage-wood.glb',
    'assets/kenney/train-kit/train-carriage-wood.glb'
  ];
  const gltfs=[];
  for(const u of urls)gltfs.push(await loader.loadAsync(u));

  const box=new THREE.Box3().setFromObject(gltfs[0].scene);
  const size=new THREE.Vector3();
  box.getSize(size);
  const nativeLength=Math.max(size.x,size.z);
  const scale=10/Math.max(nativeLength,.001); // exaggerated miniature visibility

  const cars=[];
  for(let i=0;i<gltfs.length;i++){
    const wrapper=new THREE.Group();
    const model=gltfs[i].scene;
    model.traverse(n=>{
      if(n.isMesh){
        n.castShadow=true;
        n.receiveShadow=true;
      }
    });
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(model);
    const c=new THREE.Vector3();
    b.getCenter(c);
    model.position.x-=c.x;
    model.position.z-=c.z;
    model.position.y-=b.min.y;
    wrapper.add(model);
    wrapper.position.y=1.4;
    groups.train.add(wrapper);
    cars.push({wrapper,offset:i*11.5});
  }
  return cars;
}

await makeGround();
status.textContent='Chargement des données officielles et de la fiction…';

let official,fiction;
try{
  [official,fiction]=await Promise.all([
    loadOfficialLayout(LE_MUIDS.bbox),
    fetch('./data/le_muids_fiction_v01.json').then(r=>{
      if(!r.ok)throw new Error('fiction JSON HTTP '+r.status);
      return r.json();
    })
  ]);
}catch(err){
  console.error(err);
  status.textContent='Erreur de chargement: '+err.message;
  throw err;
}

const counts=buildOfficialNetwork(official);

const inner=makeRibbon(fiction.innerRoadLoop,7.5,0xd6c9ad,1.55,true);
inner.mesh.castShadow=false;
groups.fiction.add(inner.mesh);

const railCurve=addTrack(fiction.railLoop,groups.fiction);
fiction.tunnels.forEach((t,i)=>addTunnelMarker(t.xy,i));

const stationMarker=new THREE.Mesh(
  new THREE.CylinderGeometry(4.5,4.5,3.5,24),
  mat(0x38b977,.55,.05)
);
stationMarker.position.copy(local(LE_MUIDS.station,1.8));
stationMarker.castShadow=true;
groups.real.add(stationMarker);

let cars=[];
try{
  cars=await buildTrain(railCurve);
}catch(err){
  console.warn('Train asset load failed',err);
}

let paused=false;
let trainT=.1;
const trackLength=railCurve.getLength();
const speedMps=18; // visually readable, intentionally faster than real

function moveTrain(dt){
  if(!cars.length)return;
  trainT=(trainT+(speedMps*dt)/trackLength)%1;
  for(const car of cars){
    let t=trainT-car.offset/trackLength;
    t=(t%1+1)%1;
    const p=railCurve.getPointAt(t);
    const tangent=railCurve.getTangentAt(t).normalize();
    car.wrapper.position.set(p.x,1.4,p.z);
    car.wrapper.rotation.y=Math.atan2(tangent.x,tangent.z)+Math.PI;
  }
}

pauseBtn.addEventListener('click',()=>{
  paused=!paused;
  pauseBtn.textContent=paused?'▶ Train':'⏸ Train';
});
document.querySelector('#reset').addEventListener('click',()=>{
  camera.position.copy(HOME_POS);
  controls.target.set(0,0,0);
  controls.update();
});
document.querySelector('#top').addEventListener('click',()=>{
  camera.position.set(0,1550,0.01);
  controls.target.set(0,0,0);
  controls.update();
});
document.querySelector('#real').addEventListener('change',e=>{
  groups.real.visible=e.target.checked;
});
document.querySelector('#fiction').addEventListener('change',e=>{
  groups.fiction.visible=e.target.checked;
  groups.train.visible=e.target.checked;
});

status.textContent='Prêt · '+counts.roads+' segments route · '+counts.rails+' segments rail · fiction en LV95 · terrain encore plat';

const clock=new THREE.Clock();
function resize(){
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
addEventListener('resize',resize);
resize();

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.05);
  if(!paused)moveTrain(dt);
  controls.update();
  renderer.render(scene,camera);
}
animate();
