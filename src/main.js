import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const app = document.querySelector('#app');
const status = document.querySelector('#status');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdbe7ee);
scene.fog = new THREE.Fog(0xdbe7ee, 35, 75);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 150);
camera.position.set(18, 13, 22);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.8, 0);
controls.enableDamping = true;
controls.minDistance = 7;
controls.maxDistance = 55;
controls.maxPolarAngle = Math.PI * 0.48;

scene.add(new THREE.HemisphereLight(0xf3f7ff, 0x65705d, 2.2));
const sun = new THREE.DirectionalLight(0xfff1d3, 4.0);
sun.position.set(12, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(15, 15.6, 1.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x84a96d, roughness: 0.95 })
);
ground.position.y = -0.62;
ground.receiveShadow = true;
scene.add(ground);

const rim = new THREE.Mesh(
  new THREE.CylinderGeometry(15.62, 12.5, 3.8, 64),
  new THREE.MeshStandardMaterial({ color: 0x7a6552, roughness: 1 })
);
rim.position.y = -3.05;
rim.receiveShadow = true;
scene.add(rim);

const loader = new GLTFLoader();
const mixers = [];

const assets = {
  train: {
    reference: 'assets/kenney/train-kit/train-locomotive-a.glb',
    targetHorizontal: 5.5,
    items: [
      ['locomotive', 'assets/kenney/train-kit/train-locomotive-a.glb', [-6,0,-4], 0],
      ['wagon', 'assets/kenney/train-kit/train-carriage-wood.glb', [0,0,-4], 0],
      ['railStraight', 'assets/kenney/train-kit/railroad-straight.glb', [6,0,-4], 0],
      ['railCurve', 'assets/kenney/train-kit/railroad-curve.glb', [10,0,-4], 0]
    ]
  },
  city: {
    reference: 'assets/kenney/city-kit-suburban/building-type-a.glb',
    targetHeight: 5.2,
    items: [
      ['houseA', 'assets/kenney/city-kit-suburban/building-type-a.glb', [-7,0,3], 0],
      ['houseH', 'assets/kenney/city-kit-suburban/building-type-h.glb', [0,0,3], 0],
      ['treeLarge', 'assets/kenney/city-kit-suburban/tree-large.glb', [7,0,3], 0],
      ['treeSmall', 'assets/kenney/city-kit-suburban/tree-small.glb', [10,0,3], 0]
    ]
  },
  characters: {
    reference: 'assets/kenney/mini-characters/character-male-a.glb',
    targetHeight: 1.75,
    items: [
      ['maleA', 'assets/kenney/mini-characters/character-male-a.glb', [-2.2,0,9], Math.PI],
      ['femaleA', 'assets/kenney/mini-characters/character-female-a.glb', [2.2,0,9], Math.PI]
    ]
  }
};

function bboxInfo(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { box, size };
}

function packScaleFromReference(object, cfg) {
  const { size } = bboxInfo(object);
  if (cfg.targetHeight) return cfg.targetHeight / Math.max(size.y, 0.0001);
  const horizontal = Math.max(size.x, size.z);
  return cfg.targetHorizontal / Math.max(horizontal, 0.0001);
}

function groundObject(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.y -= box.min.y;
}

function prepareObject(object) {
  object.traverse(n => {
    if (n.isMesh) {
      n.castShadow = true;
      n.receiveShadow = true;
    }
  });
}

async function loadGLB(url) {
  return await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

async function addPack(cfg) {
  const ref = await loadGLB(cfg.reference);
  const scale = packScaleFromReference(ref.scene, cfg);

  for (const [id, url, pos, rotY] of cfg.items) {
    const gltf = url === cfg.reference ? ref : await loadGLB(url);
    const obj = gltf.scene;
    obj.name = id;
    prepareObject(obj);
    obj.scale.setScalar(scale);
    obj.rotation.y = rotY;
    obj.position.set(pos[0], pos[1], pos[2]);
    scene.add(obj);
    groundObject(obj);

    if (gltf.animations?.length) {
      const mixer = new THREE.AnimationMixer(obj);
      const walk = gltf.animations.find(a => /walk/i.test(a.name));
      const idle = gltf.animations.find(a => /idle/i.test(a.name));
      mixer.clipAction(walk || idle || gltf.animations[0]).play();
      mixers.push(mixer);
    }
  }
}

try {
  for (const [name, cfg] of Object.entries(assets)) {
    status.textContent = 'Chargement: ' + name + '…';
    await addPack(cfg);
  }
  status.textContent = '10 modèles chargés · échelle normalisée par pack';
} catch (err) {
  console.error(err);
  status.textContent = 'Erreur de chargement: ' + (err?.message || err);
}

const clock = new THREE.Clock();
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const mixer of mixers) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}
animate();
