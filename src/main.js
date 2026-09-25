import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const pauseBtn = document.querySelector('#pauseBtn');
const nightBtn = document.querySelector('#nightBtn');
const resetBtn = document.querySelector('#resetBtn');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe4ef, 55, 105);

function makeSkyTexture(night = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (night) {
    g.addColorStop(0, '#07101f');
    g.addColorStop(0.55, '#1b2d48');
    g.addColorStop(1, '#5c6e7d');
  } else {
    g.addColorStop(0, '#77b9e6');
    g.addColorStop(0.58, '#bfe0f2');
    g.addColorStop(1, '#edf3df');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let skyTexture = makeSkyTexture(false);
scene.background = skyTexture;

const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 180);
const homeCamera = new THREE.Vector3(43, 31, 48);
camera.position.copy(homeCamera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 10;
controls.maxDistance = 88;
controls.maxPolarAngle = Math.PI * 0.49;

const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5b674d, 2.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0cb, 4.35);
sun.position.set(-18, 32, 21);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -44;
sun.shadow.camera.right = 44;
sun.shadow.camera.top = 34;
sun.shadow.camera.bottom = -34;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 100;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

function standardMaterial(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const grass = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 1.25, 96),
  standardMaterial(0x83ad66, 1)
);
grass.scale.set(37, 1, 26);
grass.position.y = -0.5;
grass.receiveShadow = true;
world.add(grass);

const earth = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 0.87, 4.8, 96),
  standardMaterial(0x77604b, 1)
);
earth.scale.set(37.3, 1, 26.3);
earth.position.y = -3.45;
earth.receiveShadow = true;
world.add(earth);

const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(8.3, 48),
  standardMaterial(0xd7c39d, 1)
);
plaza.rotation.x = -Math.PI / 2;
plaza.scale.set(1.35, 0.8, 1);
plaza.position.set(-2, 0.16, 1);
plaza.receiveShadow = true;
world.add(plaza);

const stationPlatform = new THREE.Mesh(
  new THREE.BoxGeometry(14.5, 0.38, 2.5),
  standardMaterial(0xb5ad9c, 0.95)
);
stationPlatform.position.set(0, 0.18, -14.75);
stationPlatform.castShadow = true;
stationPlatform.receiveShadow = true;
world.add(stationPlatform);

class OvalCurve extends THREE.Curve {
  constructor(rx, rz, y = 0) {
    super();
    this.rx = rx;
    this.rz = rz;
    this.y = y;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return target.set(this.rx * Math.cos(a), this.y, this.rz * Math.sin(a));
  }
}

const centerTrack = new OvalCurve(27.4, 17.7, 0.34);
const innerRail = new OvalCurve(26.83, 17.13, 0.48);
const outerRail = new OvalCurve(27.97, 18.27, 0.48);
const trackLength = centerTrack.getLength();

const ballast = new THREE.Mesh(
  new THREE.TubeGeometry(centerTrack, 280, 0.72, 6, true),
  standardMaterial(0x77766f, 1)
);
ballast.receiveShadow = true;
world.add(ballast);

const railMaterial = standardMaterial(0x747980, 0.35, 0.65);
for (const railCurve of [innerRail, outerRail]) {
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(railCurve, 300, 0.085, 8, true),
    railMaterial
  );
  rail.castShadow = true;
  rail.receiveShadow = true;
  world.add(rail);
}

const sleeperGeometry = new THREE.BoxGeometry(2.4, 0.13, 0.34);
const sleeperMaterial = standardMaterial(0xa46d42, 0.95);
const sleeperCount = 112;
const sleepers = new THREE.InstancedMesh(sleeperGeometry, sleeperMaterial, sleeperCount);
sleepers.castShadow = true;
sleepers.receiveShadow = true;
const tmp = new THREE.Object3D();
for (let i = 0; i < sleeperCount; i++) {
  const t = i / sleeperCount;
  const p = centerTrack.getPointAt(t);
  const tangent = centerTrack.getTangentAt(t).normalize();
  tmp.position.set(p.x, 0.4, p.z);
  tmp.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
  tmp.updateMatrix();
  sleepers.setMatrixAt(i, tmp.matrix);
}
world.add(sleepers);

function addMountain(x, z, radius, height, color, snow = true) {
  const mountain = new THREE.Mesh(
    new THREE.ConeGeometry(radius, height, 7),
    standardMaterial(color, 1)
  );
  mountain.position.set(x, height / 2 - 0.05, z);
  mountain.rotation.y = 0.18 + x * 0.015;
  mountain.castShadow = true;
  mountain.receiveShadow = true;
  world.add(mountain);

  if (snow) {
    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 0.39, height * 0.27, 7),
      standardMaterial(0xe8edf0, 0.95)
    );
    snowCap.position.set(x, height * 0.865, z);
    snowCap.rotation.y = mountain.rotation.y;
    snowCap.castShadow = true;
    world.add(snowCap);
  }
}
addMountain(-15.5, 20.5, 7.5, 13.5, 0x728080, true);
addMountain(-5.2, 22.0, 5.2, 9.1, 0x7e8987, true);
addMountain(21.5, 20.8, 4.8, 8.2, 0x84918b, false);

const pond = new THREE.Mesh(
  new THREE.CircleGeometry(4.2, 48),
  new THREE.MeshStandardMaterial({ color: 0x5fa8c7, roughness: 0.25, metalness: 0.05 })
);
pond.rotation.x = -Math.PI / 2;
pond.scale.set(1.45, 0.85, 1);
pond.position.set(13, 0.19, 2.0);
pond.receiveShadow = true;
world.add(pond);

function addFence(cx, cz, width, depth) {
  const wood = standardMaterial(0x805a39, 0.95);
  const postGeo = new THREE.BoxGeometry(0.16, 1.2, 0.16);
  const railXGeo = new THREE.BoxGeometry(2.1, 0.11, 0.11);
  const railZGeo = new THREE.BoxGeometry(0.11, 0.11, 2.1);
  const spacing = 2;

  for (let x = -width / 2; x <= width / 2 + 0.01; x += spacing) {
    for (const z of [-depth / 2, depth / 2]) {
      const post = new THREE.Mesh(postGeo, wood);
      post.position.set(cx + x, 0.6, cz + z);
      post.castShadow = true;
      world.add(post);
    }
  }
  for (let z = -depth / 2; z <= depth / 2 + 0.01; z += spacing) {
    for (const x of [-width / 2, width / 2]) {
      const post = new THREE.Mesh(postGeo, wood);
      post.position.set(cx + x, 0.6, cz + z);
      post.castShadow = true;
      world.add(post);
    }
  }
  for (let x = -width / 2 + spacing / 2; x < width / 2; x += spacing) {
    for (const z of [-depth / 2, depth / 2]) {
      for (const y of [0.42, 0.88]) {
        const rail = new THREE.Mesh(railXGeo, wood);
        rail.position.set(cx + x, y, cz + z);
        rail.castShadow = true;
        world.add(rail);
      }
    }
  }
  for (let z = -depth / 2 + spacing / 2; z < depth / 2; z += spacing) {
    for (const x of [-width / 2, width / 2]) {
      for (const y of [0.42, 0.88]) {
        const rail = new THREE.Mesh(railZGeo, wood);
        rail.position.set(cx + x, y, cz + z);
        rail.castShadow = true;
        world.add(rail);
      }
    }
  }
}
addFence(13.8, 9.0, 12, 7.5);

const clouds = [];
function addCloud(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  const blobs = [
    [0, 0, 0, 1.3],
    [1.25, 0.15, 0.05, 1.0],
    [-1.25, 0.1, 0.1, 0.95],
    [0.3, 0.55, 0.15, 0.85],
    [-0.45, 0.45, 0.05, 0.75]
  ];
  for (const [bx, by, bz, s] of blobs) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 14, 10), cloudMat);
    ball.position.set(bx, by, bz);
    group.add(ball);
  }
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  scene.add(group);
  clouds.push({ group, speed: 0.2 + Math.random() * 0.12 });
}
addCloud(-20, 19, -10, 1.3);
addCloud(5, 22, 4, 1.0);
addCloud(25, 18.5, -5, 1.15);
addCloud(-2, 20, 18, 0.9);

const loader = new GLTFLoader();
const staticCache = new Map();
const mixers = [];
const walkers = [];
const cows = [];
const trainCars = [];

async function loadFresh(url) {
  return loader.loadAsync(url);
}
async function loadStaticTemplate(url) {
  if (!staticCache.has(url)) staticCache.set(url, loader.loadAsync(url));
  return staticCache.get(url);
}
function prepareMeshes(root) {
  root.traverse(node => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
}
function sizeOf(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { box, size };
}
function centerAndGround(model, scale) {
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y;
  model.updateMatrixWorld(true);
}
function wrapModel(model, scale, x, z, rotationY = 0, y = 0.22) {
  const wrapper = new THREE.Group();
  prepareMeshes(model);
  wrapper.add(model);
  centerAndGround(model, scale);
  wrapper.position.set(x, y, z);
  wrapper.rotation.y = rotationY;
  world.add(wrapper);
  return wrapper;
}
function bestClip(animations, preferred) {
  for (const regex of preferred) {
    const found = animations.find(a => regex.test(a.name));
    if (found) return found;
  }
  return animations[0] || null;
}
function playClip(root, animations, preferred) {
  if (!animations?.length) return null;
  const clip = bestClip(animations, preferred);
  if (!clip) return null;
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  mixers.push(mixer);
  return mixer;
}

const URLs = {
  loco: 'assets/kenney/train-kit/train-locomotive-a.glb',
  wagon: 'assets/kenney/train-kit/train-carriage-wood.glb',
  houseA: 'assets/kenney/city-kit-suburban/building-type-a.glb',
  houseH: 'assets/kenney/city-kit-suburban/building-type-h.glb',
  treeLarge: 'assets/kenney/city-kit-suburban/tree-large.glb',
  treeSmall: 'assets/kenney/city-kit-suburban/tree-small.glb',
  male: 'assets/kenney/mini-characters/character-male-a.glb',
  female: 'assets/kenney/mini-characters/character-female-a.glb',
  cow: 'assets/quaternius/farm-animals/quaternius-cow.glb'
};

status.textContent = 'Chargement du petit monde…';

const locoRef = await loadFresh(URLs.loco);
const locoSize = sizeOf(locoRef.scene).size;
const trainScale = 5.5 / Math.max(locoSize.x, locoSize.z);

const cityRef = await loadStaticTemplate(URLs.houseA);
const citySize = sizeOf(cityRef.scene).size;
const cityScale = 5.2 / Math.max(citySize.y, 0.001);

const maleRef = await loadFresh(URLs.male);
const maleSize = sizeOf(maleRef.scene).size;
const characterScale = 1.72 / Math.max(maleSize.y, 0.001);

const cowRef = await loadFresh(URLs.cow);
const cowSize = sizeOf(cowRef.scene).size;
const cowScale = 1.5 / Math.max(cowSize.y, 0.001);

function addTrainCar(gltf, offsetMeters) {
  const wrapper = wrapModel(gltf.scene, trainScale, 0, 0, 0, 0.42);
  trainCars.push({ wrapper, offsetMeters });
}
addTrainCar(locoRef, 0);
addTrainCar(await loadFresh(URLs.wagon), 5.4);
addTrainCar(await loadFresh(URLs.wagon), 10.0);

const houseATemplate = (await loadStaticTemplate(URLs.houseA)).scene;
const houseHTemplate = (await loadStaticTemplate(URLs.houseH)).scene;
wrapModel(houseHTemplate.clone(true), cityScale, 0, -10.8, 0);
wrapModel(houseATemplate.clone(true), cityScale, -11.5, -2.5, Math.PI * 0.52);
wrapModel(houseHTemplate.clone(true), cityScale, -8.2, 6.6, Math.PI * 1.08);
wrapModel(houseATemplate.clone(true), cityScale, 1.2, 7.4, Math.PI * 1.62);
wrapModel(houseHTemplate.clone(true), cityScale, 9.0, -5.0, Math.PI * 0.8);

const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.45, 0.13), standardMaterial(0x4d4b47));
signPost.position.set(-4.8, 0.73, -14.4);
signPost.castShadow = true;
world.add(signPost);
const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 0.12), standardMaterial(0xf1eee2));
signBoard.position.set(-4.8, 1.42, -14.4);
signBoard.castShadow = true;
world.add(signBoard);

const largeTreeTemplate = (await loadStaticTemplate(URLs.treeLarge)).scene;
const smallTreeTemplate = (await loadStaticTemplate(URLs.treeSmall)).scene;
const treeSpots = [
  [-20,-8,1.0],[-17,2,0.9],[-19,10,1.05],[-11,13,0.95],[-4,13,0.82],
  [5,13,0.9],[21,10,0.86],[20,2,1.0],[18,-8,0.92],[10,-10,0.78],[-14,-10,0.9],
  [-23,15,0.85],[26,6,0.9],[-25,-1,0.78],[16,15,0.78]
];
for (let i = 0; i < treeSpots.length; i++) {
  const [x, z, s] = treeSpots[i];
  const template = i % 3 === 0 ? smallTreeTemplate : largeTreeTemplate;
  wrapModel(template.clone(true), cityScale * s, x, z, (i * 1.77) % (Math.PI * 2));
}

async function addWalker(url, cx, cz, rx, rz, speed, phase) {
  const gltf = url === URLs.male && walkers.length === 0 ? maleRef : await loadFresh(url);
  const wrapper = wrapModel(gltf.scene, characterScale, cx, cz, Math.PI, 0.22);
  playClip(wrapper, gltf.animations, [/walk/i, /run/i, /idle/i]);
  walkers.push({ wrapper, cx, cz, rx, rz, speed, phase });
}
await addWalker(URLs.male, -4, -7.5, 4.0, 2.2, 0.28, 0.0);
await addWalker(URLs.female, -4, 2.5, 5.2, 3.0, 0.22, 1.8);
await addWalker(URLs.male, 5, 4.5, 3.7, 2.0, 0.25, 3.4);
await addWalker(URLs.female, 2, -8.0, 3.0, 1.4, 0.20, 4.8);

async function addCow(cx, cz, rx, rz, speed, phase, first = false) {
  const gltf = first ? cowRef : await loadFresh(URLs.cow);
  const wrapper = wrapModel(gltf.scene, cowScale, cx, cz, 0, 0.22);
  playClip(wrapper, gltf.animations, [/walk/i, /idle/i, /eat/i]);
  cows.push({ wrapper, cx, cz, rx, rz, speed, phase });
}
await addCow(12.2, 8.6, 2.0, 1.2, 0.085, 0.3, true);
await addCow(15.2, 9.7, 1.7, 1.0, 0.065, 2.4);
await addCow(14.3, 7.2, 1.4, 0.8, 0.075, 4.3);

status.textContent = 'Train en mouvement · 4 promeneurs · 3 vaches · souris pour explorer';

let paused = false;
let night = false;
let elapsed = 0;
let trainT = 0.64;
const trainMetersPerSecond = 5.2;

function setNight(value) {
  night = value;
  const old = skyTexture;
  skyTexture = makeSkyTexture(night);
  scene.background = skyTexture;
  old?.dispose?.();
  hemi.intensity = night ? 0.48 : 2.35;
  sun.intensity = night ? 0.35 : 4.35;
  sun.color.set(night ? 0x9cb7d9 : 0xfff0cb);
  scene.fog.color.set(night ? 0x233246 : 0xcfe4ef);
  renderer.toneMappingExposure = night ? 0.72 : 1.05;
  nightBtn.textContent = night ? '☀️ Jour' : '🌙 Nuit';
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? '▶ Reprendre' : '⏸ Pause';
});
nightBtn.addEventListener('click', () => setNight(!night));
resetBtn.addEventListener('click', () => {
  camera.position.copy(homeCamera);
  controls.target.set(0, 2.7, 0);
  controls.update();
});

const clock = new THREE.Clock();
function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function moveActorOnLoop(actor, time, yawCorrection = Math.PI) {
  const a = time * actor.speed + actor.phase;
  const x = actor.cx + Math.cos(a) * actor.rx;
  const z = actor.cz + Math.sin(a) * actor.rz;
  const dx = -Math.sin(a) * actor.rx;
  const dz = Math.cos(a) * actor.rz;
  actor.wrapper.position.x = x;
  actor.wrapper.position.z = z;
  actor.wrapper.rotation.y = Math.atan2(dx, dz) + yawCorrection;
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused) {
    elapsed += dt;
    for (const mixer of mixers) mixer.update(dt);

    trainT = (trainT + (trainMetersPerSecond * dt) / trackLength) % 1;
    for (const car of trainCars) {
      let t = trainT - car.offsetMeters / trackLength;
      t = (t % 1 + 1) % 1;
      const p = centerTrack.getPointAt(t);
      const tangent = centerTrack.getTangentAt(t).normalize();
      car.wrapper.position.set(p.x, 0.43, p.z);
      car.wrapper.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI;
    }

    for (const walker of walkers) moveActorOnLoop(walker, elapsed, Math.PI);
    for (const cow of cows) moveActorOnLoop(cow, elapsed, Math.PI);

    for (const cloud of clouds) {
      cloud.group.position.x += cloud.speed * dt;
      if (cloud.group.position.x > 43) cloud.group.position.x = -43;
    }

    pond.material.roughness = 0.22 + Math.sin(elapsed * 0.7) * 0.03;
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();
