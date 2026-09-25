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
renderer.toneMappingExposure = 1.02;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();

function makeSkyTexture(night = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);

  if (night) {
    gradient.addColorStop(0, '#07101f');
    gradient.addColorStop(0.55, '#17304d');
    gradient.addColorStop(1, '#4d6170');
  } else {
    gradient.addColorStop(0, '#73b9e8');
    gradient.addColorStop(0.58, '#bde1f4');
    gradient.addColorStop(1, '#edf4df');
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let skyTexture = makeSkyTexture(false);
scene.background = skyTexture;

const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 220);
const homeCamera = new THREE.Vector3(52, 39, 61);
camera.position.copy(homeCamera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2.6, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 12;
controls.maxDistance = 105;
controls.maxPolarAngle = Math.PI * 0.49;

const hemi = new THREE.HemisphereLight(0xeaf7ff, 0x536146, 2.25);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffefd0, 4.1);
sun.position.set(-23, 37, 24);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -52;
sun.shadow.camera.right = 52;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

function material(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const WORLD_RX = 46;
const WORLD_RZ = 34;

const turf = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 1.2, 96),
  material(0x82ad65, 1)
);
turf.scale.set(WORLD_RX, 1, WORLD_RZ);
turf.position.y = -0.48;
turf.receiveShadow = true;
world.add(turf);

const earth = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 0.9, 4.8, 96),
  material(0x786149, 1)
);
earth.scale.set(WORLD_RX + 0.35, 1, WORLD_RZ + 0.35);
earth.position.y = -3.42;
earth.receiveShadow = true;
world.add(earth);

class OvalCurve extends THREE.Curve {
  constructor(rx, rz, y = 0) {
    super();
    this.rx = rx;
    this.rz = rz;
    this.y = y;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return target.set(
      this.rx * Math.cos(a),
      this.y,
      this.rz * Math.sin(a)
    );
  }
}

class OffsetCurve extends THREE.Curve {
  constructor(base, offset, yOffset = 0) {
    super();
    this.base = base;
    this.offset = offset;
    this.yOffset = yOffset;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const p = this.base.getPoint(t, new THREE.Vector3());
    const tangent = this.base.getTangent(t, new THREE.Vector3()).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    return target.copy(p)
      .addScaledVector(normal, this.offset)
      .add(new THREE.Vector3(0, this.yOffset, 0));
  }
}

function makeRibbon(curve, width, color, yOffset = 0, segments = 220, roughness = 1) {
  const positions = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t, new THREE.Vector3());
    const tangent = curve.getTangentAt(t, new THREE.Vector3()).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const left = p.clone().addScaledVector(normal, width * 0.5);
    const right = p.clone().addScaledVector(normal, -width * 0.5);
    left.y += yOffset;
    right.y += yOffset;

    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material(color, roughness));
  mesh.receiveShadow = true;
  return mesh;
}

const centerTrack = new OvalCurve(31.5, 20.6, 0.22);
const trackLength = centerTrack.getLength();

const ballast = makeRibbon(centerTrack, 2.25, 0x8e8a7d, 0.11, 300, 1);
world.add(ballast);

const railMaterial = material(0x6c737a, 0.35, 0.7);
for (const offset of [-0.67, 0.67]) {
  const railCurve = new OffsetCurve(centerTrack, offset, 0.31);
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(railCurve, 360, 0.055, 7, true),
    railMaterial
  );
  rail.castShadow = true;
  rail.receiveShadow = true;
  world.add(rail);
}

const sleeperCount = 132;
const sleeperGeometry = new THREE.BoxGeometry(2.0, 0.1, 0.28);
const sleeperMaterial = material(0x9a653d, 0.96);
const sleepers = new THREE.InstancedMesh(
  sleeperGeometry,
  sleeperMaterial,
  sleeperCount
);
sleepers.castShadow = true;
sleepers.receiveShadow = true;

const sleeperObject = new THREE.Object3D();
for (let i = 0; i < sleeperCount; i++) {
  const t = i / sleeperCount;
  const p = centerTrack.getPointAt(t, new THREE.Vector3());
  const tangent = centerTrack.getTangentAt(t, new THREE.Vector3()).normalize();

  sleeperObject.position.set(p.x, 0.31, p.z);
  sleeperObject.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
  sleeperObject.updateMatrix();
  sleepers.setMatrixAt(i, sleeperObject.matrix);
}
world.add(sleepers);

const stationPlatform = new THREE.Mesh(
  new THREE.BoxGeometry(15.5, 0.34, 2.35),
  material(0xb8afa0, 0.95)
);
stationPlatform.position.set(0, 0.19, -17.95);
stationPlatform.castShadow = true;
stationPlatform.receiveShadow = true;
world.add(stationPlatform);

const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(7.6, 48),
  material(0xcdbb97, 1)
);
plaza.rotation.x = -Math.PI / 2;
plaza.scale.set(1.25, 0.8, 1);
plaza.position.set(-0.5, 0.12, -1.0);
plaza.receiveShadow = true;
world.add(plaza);

const pedestrianRoutes = [
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(-9.5, 0.17, -6.5),
    new THREE.Vector3(-5.5, 0.17, -11.0),
    new THREE.Vector3(0.0, 0.17, -12.8),
    new THREE.Vector3(6.0, 0.17, -9.0),
    new THREE.Vector3(8.0, 0.17, -3.5),
    new THREE.Vector3(6.2, 0.17, 2.0),
    new THREE.Vector3(1.0, 0.17, 4.0),
    new THREE.Vector3(-4.5, 0.17, 3.2),
    new THREE.Vector3(-8.5, 0.17, -0.8)
  ], true, 'catmullrom', 0.2),
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(-8.0, 0.18, 4.0),
    new THREE.Vector3(-3.0, 0.18, 7.0),
    new THREE.Vector3(3.0, 0.18, 7.5),
    new THREE.Vector3(8.0, 0.18, 5.0),
    new THREE.Vector3(10.5, 0.18, 1.0),
    new THREE.Vector3(8.2, 0.18, -3.0),
    new THREE.Vector3(4.0, 0.18, -4.5),
    new THREE.Vector3(-1.5, 0.18, -3.0),
    new THREE.Vector3(-6.0, 0.18, 0.2)
  ], true, 'catmullrom', 0.2),
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.0, 0.18, -4.0),
    new THREE.Vector3(-2.0, 0.18, -8.0),
    new THREE.Vector3(-1.0, 0.18, -12.5),
    new THREE.Vector3(-1.0, 0.18, -16.2)
  ], false, 'catmullrom', 0.2)
];

for (const route of pedestrianRoutes) {
  world.add(makeRibbon(route, 0.95, 0xd0bd98, 0.015, 90, 1));
}

function addRoundedHill(x, z, sx, sy, sz, color, rotation = 0) {
  const hill = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 2),
    material(color, 1)
  );
  hill.scale.set(sx, sy, sz);
  hill.position.set(x, sy * 0.18 - 0.25, z);
  hill.rotation.y = rotation;
  hill.castShadow = true;
  hill.receiveShadow = true;
  world.add(hill);
}

addRoundedHill(-25.0, 26.0, 8.3, 5.4, 4.6, 0x6f806f, 0.5);
addRoundedHill(-11.0, 27.0, 7.8, 4.3, 4.3, 0x788776, 1.0);
addRoundedHill(4.0, 27.2, 8.8, 4.9, 4.6, 0x70806e, 0.2);
addRoundedHill(19.5, 26.0, 7.4, 5.2, 4.7, 0x7b8978, 0.8);
addRoundedHill(30.0, 24.0, 6.0, 3.6, 4.1, 0x82907e, 0.1);

const pond = new THREE.Mesh(
  new THREE.CircleGeometry(4.3, 56),
  new THREE.MeshStandardMaterial({
    color: 0x61a9c7,
    roughness: 0.24,
    metalness: 0.04
  })
);
pond.rotation.x = -Math.PI / 2;
pond.scale.set(1.35, 0.85, 1);
pond.position.set(15.2, 0.14, 6.6);
pond.receiveShadow = true;
world.add(pond);

function addFence(cx, cz, width, depth) {
  const wood = material(0x805a39, 0.95);
  const postGeometry = new THREE.BoxGeometry(0.15, 1.1, 0.15);
  const railXGeometry = new THREE.BoxGeometry(2.0, 0.10, 0.10);
  const railZGeometry = new THREE.BoxGeometry(0.10, 0.10, 2.0);
  const spacing = 2;

  for (let x = -width / 2; x <= width / 2 + 0.01; x += spacing) {
    for (const z of [-depth / 2, depth / 2]) {
      const post = new THREE.Mesh(postGeometry, wood);
      post.position.set(cx + x, 0.55, cz + z);
      post.castShadow = true;
      world.add(post);
    }
  }

  for (let z = -depth / 2; z <= depth / 2 + 0.01; z += spacing) {
    for (const x of [-width / 2, width / 2]) {
      const post = new THREE.Mesh(postGeometry, wood);
      post.position.set(cx + x, 0.55, cz + z);
      post.castShadow = true;
      world.add(post);
    }
  }

  for (let x = -width / 2 + spacing / 2; x < width / 2; x += spacing) {
    for (const z of [-depth / 2, depth / 2]) {
      for (const y of [0.37, 0.78]) {
        const rail = new THREE.Mesh(railXGeometry, wood);
        rail.position.set(cx + x, y, cz + z);
        rail.castShadow = true;
        world.add(rail);
      }
    }
  }

  for (let z = -depth / 2 + spacing / 2; z < depth / 2; z += spacing) {
    for (const x of [-width / 2, width / 2]) {
      for (const y of [0.37, 0.78]) {
        const rail = new THREE.Mesh(railZGeometry, wood);
        rail.position.set(cx + x, y, cz + z);
        rail.castShadow = true;
        world.add(rail);
      }
    }
  }
}

addFence(20.4, 8.8, 11.0, 7.4);

const lampLights = [];

function addLamp(x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.07, 2.15, 10),
    material(0x41494d, 0.55, 0.3)
  );
  pole.position.set(x, 1.08, z);
  pole.castShadow = true;
  world.add(pole);

  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe8b5,
    emissive: 0xffb74a,
    emissiveIntensity: 0.25,
    roughness: 0.4
  });

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 12, 8),
    bulbMaterial
  );
  bulb.position.set(x, 2.16, z);
  world.add(bulb);

  const light = new THREE.PointLight(0xffc96b, 0, 7.5, 2);
  light.position.set(x, 2.1, z);
  world.add(light);
  lampLights.push({ light, bulbMaterial });
}

for (const [x, z] of [
  [-6.0, -17.0],
  [-2.0, -17.0],
  [2.0, -17.0],
  [6.0, -17.0],
  [-5.0, -7.8],
  [4.8, -7.0]
]) {
  addLamp(x, z);
}

function addBench(x, z, rotation = 0) {
  const group = new THREE.Group();
  const wood = material(0x9a653d, 0.9);
  const dark = material(0x495257, 0.7, 0.2);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.48), wood);
  seat.position.y = 0.55;
  seat.castShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.65, 0.12), wood);
  back.position.set(0, 0.9, 0.19);
  back.rotation.x = -0.08;
  back.castShadow = true;
  group.add(back);

  for (const xLeg of [-0.58, 0.58]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.55, 0.10), dark);
    leg.position.set(xLeg, 0.28, 0);
    leg.castShadow = true;
    group.add(leg);
  }

  group.position.set(x, 0.16, z);
  group.rotation.y = rotation;
  world.add(group);
}

addBench(-4.0, -16.4, Math.PI);
addBench(3.3, -16.4, Math.PI);
addBench(-2.5, -4.7, -0.35);

const clouds = [];

function addCloud(x, y, z, scale = 1) {
  const group = new THREE.Group();
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1,
    transparent: true,
    opacity: 0.88,
    depthWrite: false
  });

  const blobs = [
    [0, 0, 0, 1.35, 0.72, 0.82],
    [1.25, 0.05, 0.05, 1.0, 0.62, 0.72],
    [-1.2, 0.05, 0.0, 0.95, 0.58, 0.68],
    [0.25, 0.47, 0.08, 0.88, 0.55, 0.62]
  ];

  for (const [bx, by, bz, sx, sy, sz] of blobs) {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 2),
      cloudMaterial
    );
    blob.position.set(bx, by, bz);
    blob.scale.set(sx, sy, sz);
    group.add(blob);
  }

  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  scene.add(group);
  clouds.push({ group, speed: 0.16 + Math.random() * 0.07 });
}

addCloud(-28, 22.0, -7, 1.25);
addCloud(4, 25.0, 8, 0.95);
addCloud(29, 21.5, -3, 1.1);

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
  if (!staticCache.has(url)) {
    staticCache.set(url, loader.loadAsync(url));
  }
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

function wrapModel(model, scale, x, z, rotationY = 0, y = 0.16) {
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
    const found = animations.find(animation => regex.test(animation.name));
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
  male: 'assets/kenney/mini-characters/character-male-a.glb',
  female: 'assets/kenney/mini-characters/character-female-a.glb',
  cow: 'assets/quaternius/farm-animals/quaternius-cow.glb',
  oak: 'assets/kenney/nature-kit/tree_oak.glb',
  pine: 'assets/kenney/nature-kit/tree_pineRoundC.glb',
  tallTree: 'assets/kenney/nature-kit/tree_tall.glb',
  bush: 'assets/kenney/nature-kit/plant_bushDetailed.glb',
  grass: 'assets/kenney/nature-kit/grass_large.glb',
  rock: 'assets/kenney/nature-kit/rock_largeC.glb'
};

status.textContent = 'Chargement du village…';

const locoRef = await loadFresh(URLs.loco);
const trainScale = 5.5 / Math.max(
  sizeOf(locoRef.scene).size.x,
  sizeOf(locoRef.scene).size.z
);

const cityRef = await loadStaticTemplate(URLs.houseA);
const cityScale = 5.2 / Math.max(sizeOf(cityRef.scene).size.y, 0.001);

const maleRef = await loadFresh(URLs.male);
const characterScale = 1.72 / Math.max(sizeOf(maleRef.scene).size.y, 0.001);

const cowRef = await loadFresh(URLs.cow);
const cowScale = 1.5 / Math.max(sizeOf(cowRef.scene).size.y, 0.001);

const oakRef = await loadStaticTemplate(URLs.oak);
const natureScale = 5.4 / Math.max(sizeOf(oakRef.scene).size.y, 0.001);

function addTrainCar(gltf, offsetMeters) {
  const wrapper = wrapModel(gltf.scene, trainScale, 0, 0, 0, 0.39);
  trainCars.push({ wrapper, offsetMeters });
}

addTrainCar(locoRef, 0);
addTrainCar(await loadFresh(URLs.wagon), 5.35);
addTrainCar(await loadFresh(URLs.wagon), 10.05);

const houseATemplate = (await loadStaticTemplate(URLs.houseA)).scene;
const houseHTemplate = (await loadStaticTemplate(URLs.houseH)).scene;

wrapModel(houseHTemplate.clone(true), cityScale, 0.5, -13.8, 0);
wrapModel(houseATemplate.clone(true), cityScale, -13.5, -2.8, Math.PI * 0.52);
wrapModel(houseHTemplate.clone(true), cityScale, -10.2, 9.0, Math.PI * 1.05);
wrapModel(houseATemplate.clone(true), cityScale, 2.2, 9.3, Math.PI * 1.58);
wrapModel(houseHTemplate.clone(true), cityScale, 11.8, -3.3, Math.PI * 0.82);

const stationSignPost = new THREE.Mesh(
  new THREE.BoxGeometry(0.12, 1.5, 0.12),
  material(0x484a48, 0.7)
);
stationSignPost.position.set(-5.3, 0.75, -16.8);
stationSignPost.castShadow = true;
world.add(stationSignPost);

const stationSign = new THREE.Mesh(
  new THREE.BoxGeometry(2.3, 0.65, 0.12),
  material(0xf1eee2, 0.95)
);
stationSign.position.set(-5.3, 1.46, -16.8);
stationSign.castShadow = true;
world.add(stationSign);

const oakTemplate = oakRef.scene;
const pineTemplate = (await loadStaticTemplate(URLs.pine)).scene;
const tallTreeTemplate = (await loadStaticTemplate(URLs.tallTree)).scene;
const bushTemplate = (await loadStaticTemplate(URLs.bush)).scene;
const grassTemplate = (await loadStaticTemplate(URLs.grass)).scene;
const rockTemplate = (await loadStaticTemplate(URLs.rock)).scene;

const trackSamples = Array.from(
  { length: 240 },
  (_, i) => centerTrack.getPointAt(i / 240, new THREE.Vector3())
);

const pathSamples = pedestrianRoutes.flatMap(route =>
  Array.from(
    { length: 80 },
    (_, i) => route.getPointAt(i / 79, new THREE.Vector3())
  )
);

function distanceToSamples(x, z, samples) {
  let minSq = Infinity;
  for (const p of samples) {
    const dx = x - p.x;
    const dz = z - p.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < minSq) minSq = dSq;
  }
  return Math.sqrt(minSq);
}

const blockedZones = [
  { x: 0.5, z: -13.8, r: 5.6 },
  { x: -13.5, z: -2.8, r: 5.0 },
  { x: -10.2, z: 9.0, r: 5.1 },
  { x: 2.2, z: 9.3, r: 5.1 },
  { x: 11.8, z: -3.3, r: 5.0 },
  { x: 15.2, z: 6.6, r: 5.4 },
  { x: 20.4, z: 8.8, r: 6.6 }
];

function insideBlockedZone(x, z, margin = 0) {
  return blockedZones.some(zone => {
    const dx = x - zone.x;
    const dz = z - zone.z;
    return Math.hypot(dx, dz) < zone.r + margin;
  });
}

function insideWorld(x, z, inset = 0) {
  const rx = WORLD_RX - inset;
  const rz = WORLD_RZ - inset;
  return (x * x) / (rx * rx) + (z * z) / (rz * rz) < 1;
}

function vegetationAllowed(x, z, kind) {
  if (!insideWorld(x, z, kind === 'tree' ? 3.0 : 1.0)) return false;

  const trackDistance = distanceToSamples(x, z, trackSamples);
  if (trackDistance < (kind === 'tree' ? 4.0 : kind === 'bush' ? 3.0 : 2.0)) {
    return false;
  }

  const pathDistance = distanceToSamples(x, z, pathSamples);
  if (pathDistance < (kind === 'tree' ? 2.2 : kind === 'bush' ? 1.3 : 0.75)) {
    return false;
  }

  if (insideBlockedZone(x, z, kind === 'tree' ? 0.8 : kind === 'bush' ? 0.25 : -0.9)) {
    return false;
  }

  return true;
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20260925);

function randomPoint() {
  return {
    x: (random() * 2 - 1) * (WORLD_RX - 3),
    z: (random() * 2 - 1) * (WORLD_RZ - 3)
  };
}

const natureTrees = [oakTemplate, pineTemplate, tallTreeTemplate];
let placedTrees = 0;
let attempts = 0;

while (placedTrees < 36 && attempts < 800) {
  attempts++;
  const p = randomPoint();

  if (!vegetationAllowed(p.x, p.z, 'tree')) continue;
  if (p.z > 20.0) continue;

  const template = natureTrees[Math.floor(random() * natureTrees.length)];
  const scaleVariation = 0.72 + random() * 0.48;
  wrapModel(
    template.clone(true),
    natureScale * scaleVariation,
    p.x,
    p.z,
    random() * Math.PI * 2
  );
  placedTrees++;
}

let placedBushes = 0;
attempts = 0;

while (placedBushes < 34 && attempts < 700) {
  attempts++;
  const p = randomPoint();
  if (!vegetationAllowed(p.x, p.z, 'bush')) continue;
  if (p.z > 21.0) continue;

  wrapModel(
    bushTemplate.clone(true),
    natureScale * (0.72 + random() * 0.55),
    p.x,
    p.z,
    random() * Math.PI * 2
  );
  placedBushes++;
}

let placedGrass = 0;
attempts = 0;

while (placedGrass < 115 && attempts < 1500) {
  attempts++;
  const p = randomPoint();
  if (!vegetationAllowed(p.x, p.z, 'grass')) continue;
  if (p.z > 21.5) continue;

  wrapModel(
    grassTemplate.clone(true),
    natureScale * (0.60 + random() * 0.65),
    p.x,
    p.z,
    random() * Math.PI * 2,
    0.13
  );
  placedGrass++;
}

for (const [x, z, scale] of [
  [-30, 25, 1.9],
  [-18, 25, 1.5],
  [-5, 26, 1.8],
  [10, 26, 1.5],
  [24, 25, 1.7],
  [33, 20, 1.4],
  [13, 13, 0.9],
  [9, 12, 0.75]
]) {
  wrapModel(
    rockTemplate.clone(true),
    natureScale * scale,
    x,
    z,
    random() * Math.PI * 2,
    0.12
  );
}

async function addWalker(url, route, speed, phase, pingPong = false, first = false) {
  const gltf = first ? maleRef : await loadFresh(url);
  const wrapper = wrapModel(gltf.scene, characterScale, 0, 0, 0, 0.15);
  playClip(wrapper, gltf.animations, [/walk/i, /run/i, /idle/i]);

  walkers.push({
    wrapper,
    route,
    speed,
    phase,
    pingPong
  });
}

await addWalker(URLs.male, pedestrianRoutes[0], 0.034, 0.04, false, true);
await addWalker(URLs.female, pedestrianRoutes[0], 0.030, 0.48);
await addWalker(URLs.male, pedestrianRoutes[1], 0.031, 0.19);
await addWalker(URLs.female, pedestrianRoutes[1], 0.028, 0.68);
await addWalker(URLs.male, pedestrianRoutes[2], 0.055, 0.10, true);

const cowRoute = new THREE.CatmullRomCurve3([
  new THREE.Vector3(17.1, 0.18, 7.0),
  new THREE.Vector3(20.2, 0.18, 6.3),
  new THREE.Vector3(23.4, 0.18, 7.5),
  new THREE.Vector3(23.7, 0.18, 10.4),
  new THREE.Vector3(20.7, 0.18, 11.2),
  new THREE.Vector3(17.5, 0.18, 10.3)
], true, 'catmullrom', 0.3);

async function addCow(speed, phase, first = false) {
  const gltf = first ? cowRef : await loadFresh(URLs.cow);
  const wrapper = wrapModel(gltf.scene, cowScale, 0, 0, 0, 0.14);
  playClip(wrapper, gltf.animations, [/walk/i, /idle_eating/i, /idle/i]);

  cows.push({
    wrapper,
    route: cowRoute,
    speed,
    phase
  });
}

await addCow(0.010, 0.08, true);
await addCow(0.008, 0.42);
await addCow(0.009, 0.72);

const stationIdle = await loadFresh(URLs.female);
const stationPerson = wrapModel(
  stationIdle.scene,
  characterScale,
  3.6,
  -16.55,
  Math.PI * 0.1,
  0.15
);
playClip(stationPerson, stationIdle.animations, [/idle/i, /walk/i]);

status.textContent =
  'v0.3 · train avec arrêt en gare · chemins piétons · végétation enrichie';

let paused = false;
let night = false;
let elapsed = 0;

const TRAIN_MAX_SPEED = 5.2;
const STATION_DISTANCE = trackLength * 0.75;
let trainDistance = THREE.MathUtils.euclideanModulo(STATION_DISTANCE - 38, trackLength);
let trainSpeed = TRAIN_MAX_SPEED;
let stopTimer = 0;
let stationCooldown = 0;

function forwardDistance(from, to, length) {
  return THREE.MathUtils.euclideanModulo(to - from, length);
}

function updateTrain(dt) {
  if (stopTimer > 0) {
    stopTimer -= dt;
    trainSpeed = 0;

    if (stopTimer <= 0) {
      stationCooldown = 20;
      status.textContent =
        'v0.3 · le train repart · personnages sur chemins · 36 arbres + buissons';
    }
  } else {
    stationCooldown = Math.max(0, stationCooldown - dt);
    const distanceToStation = forwardDistance(
      trainDistance,
      STATION_DISTANCE,
      trackLength
    );

    let targetSpeed = TRAIN_MAX_SPEED;

    if (stationCooldown <= 0 && distanceToStation < 15) {
      targetSpeed = THREE.MathUtils.clamp(
        distanceToStation * 0.42,
        0.16,
        TRAIN_MAX_SPEED
      );
    }

    const response = targetSpeed > trainSpeed ? 0.75 : 2.1;
    trainSpeed += (targetSpeed - trainSpeed) * Math.min(1, dt * response);
    trainDistance = THREE.MathUtils.euclideanModulo(
      trainDistance + trainSpeed * dt,
      trackLength
    );

    const afterMoveDistance = forwardDistance(
      trainDistance,
      STATION_DISTANCE,
      trackLength
    );

    if (
      stationCooldown <= 0 &&
      afterMoveDistance < 0.25 &&
      trainSpeed < 0.55
    ) {
      trainDistance = STATION_DISTANCE;
      trainSpeed = 0;
      stopTimer = 4.5;
      status.textContent = 'Train en gare · arrêt 4,5 s';
    }
  }

  for (const car of trainCars) {
    const distance = THREE.MathUtils.euclideanModulo(
      trainDistance - car.offsetMeters,
      trackLength
    );
    const t = distance / trackLength;
    const p = centerTrack.getPointAt(t, new THREE.Vector3());
    const tangent = centerTrack.getTangentAt(t, new THREE.Vector3()).normalize();

    car.wrapper.position.set(p.x, 0.39, p.z);
    car.wrapper.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI;
  }
}

function updateActor(actor, time, yawOffset = 0) {
  let raw = time * actor.speed + actor.phase;
  let direction = 1;
  let t;

  if (actor.pingPong) {
    raw = THREE.MathUtils.euclideanModulo(raw, 2);
    if (raw > 1) {
      t = 2 - raw;
      direction = -1;
    } else {
      t = raw;
    }
  } else {
    t = THREE.MathUtils.euclideanModulo(raw, 1);
  }

  const p = actor.route.getPointAt(t, new THREE.Vector3());
  const tangent = actor.route.getTangentAt(t, new THREE.Vector3()).normalize();
  tangent.multiplyScalar(direction);

  actor.wrapper.position.x = p.x;
  actor.wrapper.position.z = p.z;
  actor.wrapper.rotation.y = Math.atan2(tangent.x, tangent.z) + yawOffset;
}

function setNight(value) {
  night = value;

  const oldSky = skyTexture;
  skyTexture = makeSkyTexture(night);
  scene.background = skyTexture;
  oldSky?.dispose?.();

  hemi.intensity = night ? 0.44 : 2.25;
  sun.intensity = night ? 0.30 : 4.1;
  sun.color.set(night ? 0x9fb8d7 : 0xffefd0);
  renderer.toneMappingExposure = night ? 0.70 : 1.02;

  for (const { light, bulbMaterial } of lampLights) {
    light.intensity = night ? 3.2 : 0;
    bulbMaterial.emissiveIntensity = night ? 3.0 : 0.25;
  }

  nightBtn.textContent = night ? '☀️ Jour' : '🌙 Nuit';
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? '▶ Reprendre' : '⏸ Pause';
});

nightBtn.addEventListener('click', () => {
  setNight(!night);
});

resetBtn.addEventListener('click', () => {
  camera.position.copy(homeCamera);
  controls.target.set(0, 2.6, 0);
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

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused) {
    elapsed += dt;

    for (const mixer of mixers) {
      mixer.update(dt);
    }

    updateTrain(dt);

    for (const walker of walkers) {
      updateActor(walker, elapsed, 0);
    }

    for (const cow of cows) {
      updateActor(cow, elapsed, 0);
    }

    for (const cloud of clouds) {
      cloud.group.position.x += cloud.speed * dt;
      if (cloud.group.position.x > 52) {
        cloud.group.position.x = -52;
      }
    }

    pond.material.roughness = 0.22 + Math.sin(elapsed * 0.65) * 0.025;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
