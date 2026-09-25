import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer } from '3d-tiles-renderer';
import {
  GLTFExtensionsPlugin,
  TilesFadePlugin,
  UnloadTilesPlugin
} from '3d-tiles-renderer/three/plugins';

import { LE_MUIDS, wmsUrl, loadOfficialLayout } from '../geo/swisstopo.js';
import { fetchLocalFrame, makeEcefToLocalMatrix } from '../geo/geodesy.js';
import {
  loadTerrainGrid,
  terrainHeightAt,
  buildTerrainMesh
} from '../geo/terrain.js';

const BUILDINGS_TILESET =
  'https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json';

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const pauseBtn = document.querySelector('#pause');
const terrainToggle = document.querySelector('#terrain');
const buildingsToggle = document.querySelector('#buildings');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.03;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d6e5);

const camera = new THREE.PerspectiveCamera(42, 1, 1, 7000);
const HOME_POS = new THREE.Vector3(760, 610, 940);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 18, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 80;
controls.maxDistance = 2800;

scene.add(new THREE.HemisphereLight(0xe9f4ff, 0x53644a, 1.55));

const sun = new THREE.DirectionalLight(0xfff0d2, 2.8);
sun.position.set(-600, 950, 500);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -900;
sun.shadow.camera.right = 900;
sun.shadow.camera.top = 700;
sun.shadow.camera.bottom = -700;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 2600;
scene.add(sun);

const groups = {
  terrain: new THREE.Group(),
  real: new THREE.Group(),
  fiction: new THREE.Group(),
  train: new THREE.Group()
};
scene.add(groups.terrain, groups.real, groups.fiction, groups.train);

const centerE = LE_MUIDS.station[0];
const centerN = LE_MUIDS.station[1];

let terrainModel = null;
let fiction = null;
let localFrame = null;
let buildingsTiles = null;
let buildingsInitializing = false;

function mat(color, rough = 0.9, metal = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: rough,
    metalness: metal
  });
}

function lineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

function flatTerrainModel(bbox, stationHeight) {
  const [minE, minN, maxE, maxN] = bbox;
  const grid = [
    [[minE, minN], [maxE, minN]],
    [[minE, maxN], [maxE, maxN]]
  ];
  return {
    bbox,
    cols: 2,
    rows: 2,
    grid,
    heights: [
      [stationHeight, stationHeight],
      [stationHeight, stationHeight]
    ],
    stationHeight,
    minHeight: stationHeight,
    maxHeight: stationHeight
  };
}

function groundY(e, n) {
  if (!terrainModel) return 0;
  return terrainHeightAt(terrainModel, e, n);
}

function tunnelDropAt(e, n) {
  if (!fiction?.tunnels?.length) return 0;

  let maxDrop = 0;
  for (const tunnel of fiction.tunnels) {
    const dx = e - tunnel.xy[0];
    const dn = n - tunnel.xy[1];
    const d = Math.hypot(dx, dn);
    const radius = 78;
    if (d >= radius) continue;

    const t = 1 - d / radius;
    const smooth = t * t * (3 - 2 * t);
    maxDrop = Math.max(maxDrop, 7.5 * smooth);
  }
  return maxDrop;
}

function localPoint([e, n], offset = 0, dipRoad = false) {
  const dip = dipRoad ? tunnelDropAt(e, n) : 0;
  return new THREE.Vector3(
    e - centerE,
    groundY(e, n) + offset - dip,
    -(n - centerN)
  );
}

function curveFromLV95(points, offset = 0.65, closed = false, dipRoad = false) {
  const p = points.map(pt => localPoint(pt, offset, dipRoad));
  return new THREE.CatmullRomCurve3(p, closed, 'centripetal', 0.3);
}

function tubeFromPoints(
  points,
  radius,
  color,
  offset = 0.65,
  closed = false,
  segmentsFactor = 1,
  dipRoad = false
) {
  if (points.length < 2) return null;
  const curve = curveFromLV95(points, offset, closed, dipRoad);
  const geom = new THREE.TubeGeometry(
    curve,
    Math.max(8, Math.round(points.length * 8 * segmentsFactor)),
    radius,
    6,
    closed
  );
  const mesh = new THREE.Mesh(geom, mat(color, 0.78, 0.08));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeRibbon(
  points,
  width,
  color,
  offset = 1,
  closed = false,
  dipRoad = false
) {
  const curve = curveFromLV95(points, offset, closed, dipRoad);
  const segments = Math.max(80, points.length * 14);
  const pos = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3().crossVectors(up, tangent).normalize();

    const left = p.clone().addScaledVector(normal, width / 2);
    const right = p.clone().addScaledVector(normal, -width / 2);

    pos.push(
      left.x, left.y, left.z,
      right.x, right.y, right.z
    );

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      idx.push(a, c, b, c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(pos, 3)
  );
  geometry.setIndex(idx);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, mat(color, 0.94));
  mesh.receiveShadow = true;
  return { mesh, curve };
}

function addSleepers(curve, count, width, group) {
  const geo = new THREE.BoxGeometry(width, 0.16, 0.34);
  const sleeperMat = mat(0x8b6340, 0.95);
  const inst = new THREE.InstancedMesh(geo, sleeperMat, count);
  inst.castShadow = true;
  inst.receiveShadow = true;

  const tmp = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();

    tmp.position.copy(p);
    tmp.position.y += 0.18;
    tmp.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
    tmp.updateMatrix();
    inst.setMatrixAt(i, tmp.matrix);
  }
  group.add(inst);
}

function addTrack(points, group) {
  const base = makeRibbon(points, 4.6, 0x9b7a58, 1.0, true, false);
  group.add(base.mesh);

  for (const off of [-0.75, 0.75]) {
    const samples = [];
    const count = 220;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const p = base.curve.getPointAt(t);
      const tangent = base.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(up, tangent).normalize();
      samples.push(p.clone().addScaledVector(normal, off));
    }

    const c = new THREE.CatmullRomCurve3(samples, true, 'centripetal', 0.25);
    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(c, 420, 0.085, 8, true),
      mat(0x4e5357, 0.35, 0.65)
    );
    rail.castShadow = true;
    group.add(rail);
  }

  addSleepers(base.curve, 190, 3.2, group);
  return base.curve;
}

function addTunnelMarker(xy, index) {
  const p = localPoint(xy, 1.8, false);
  const group = new THREE.Group();

  const portal = new THREE.Mesh(
    new THREE.BoxGeometry(14, 5, 4),
    mat(0x2b72d6, 0.65, 0.05)
  );
  portal.position.copy(p);
  portal.castShadow = true;
  group.add(portal);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 7, 4, 24, 1, false, 0, Math.PI),
    mat(0x2b72d6, 0.65, 0.05)
  );
  cap.rotation.z = Math.PI / 2;
  cap.rotation.y = Math.PI / 2;
  cap.position.copy(p).add(new THREE.Vector3(0, 2.5, 0));
  group.add(cap);

  group.userData.index = index;
  groups.fiction.add(group);
}

function buildOfficialNetwork(official) {
  let roads = 0;
  let rails = 0;

  for (const feature of official.features) {
    const layer = feature.properties?._layer || '';
    const isRail = layer.includes('eisenbahnnetz');
    const isRoad = layer.includes('strassen');
    if (!isRail && !isRoad) continue;

    for (const points of lineStrings(feature.geometry)) {
      if (points.length < 2) continue;

      const mesh = tubeFromPoints(
        points,
        isRail ? 0.50 : 0.34,
        isRail ? 0x34383b : 0x5f6569,
        isRail ? 1.10 : 0.82,
        false,
        0.7,
        isRoad
      );

      if (!mesh) continue;
      mesh.userData.kind = isRail ? 'officialRail' : 'officialRoad';
      groups.real.add(mesh);
      if (isRail) rails++;
      else roads++;
    }
  }

  return { roads, rails };
}

async function buildTrain(curve) {
  const loader = new GLTFLoader();
  const urls = [
    'assets/kenney/train-kit/train-locomotive-a.glb',
    'assets/kenney/train-kit/train-carriage-wood.glb',
    'assets/kenney/train-kit/train-carriage-wood.glb'
  ];

  const gltfs = [];
  for (const url of urls) {
    gltfs.push(await loader.loadAsync(url));
  }

  const box = new THREE.Box3().setFromObject(gltfs[0].scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const nativeLength = Math.max(size.x, size.z);
  const scale = 10 / Math.max(nativeLength, 0.001);

  const cars = [];
  for (let i = 0; i < gltfs.length; i++) {
    const wrapper = new THREE.Group();
    const model = gltfs[i].scene;

    model.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    const modelBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    modelBox.getCenter(center);

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= modelBox.min.y;

    wrapper.add(model);
    groups.train.add(wrapper);
    cars.push({ wrapper, offset: i * 11.5 });
  }

  return cars;
}

async function initBuildings3D() {
  if (buildingsTiles || buildingsInitializing) return;
  buildingsInitializing = true;
  status.textContent = 'Initialisation de swissBUILDINGS3D…';

  try {
    if (!localFrame) {
      localFrame = await fetchLocalFrame(centerE, centerN);
    }

    const tiles = new TilesRenderer(BUILDINGS_TILESET);
    tiles.errorTarget = 10;
    tiles.optimizedLoadStrategy = true;
    tiles.loadSiblings = true;

    const draco = new DRACOLoader();
    draco.setDecoderPath(
      'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/'
    );
    draco.preload();

    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new UnloadTilesPlugin());
    tiles.registerPlugin(new TilesFadePlugin());

    const ecefToLocal = makeEcefToLocalMatrix(
      localFrame.lonDeg,
      localFrame.latDeg,
      localFrame.anchorEcef,
      0
    );

    tiles.group.matrixAutoUpdate = false;
    tiles.group.matrix.copy(ecefToLocal);
    tiles.group.updateMatrixWorld(true);
    tiles.group.visible = buildingsToggle.checked;

    tiles.addEventListener('load-model', event => {
      event.scene?.traverse(node => {
        if (!node.isMesh) return;
        if (!node.geometry.attributes.normal) {
          node.geometry.computeVertexNormals();
        }
        node.castShadow = true;
        node.receiveShadow = true;
      });
    });

    tiles.addEventListener('load-tileset', () => {
      status.textContent =
        'swissBUILDINGS3D chargé · relief réel · train + fiction LV95';
    });

    tiles.addEventListener('load-error', event => {
      console.warn('3D Tiles load error', event);
    });

    tiles.setCamera(camera);
    tiles.setResolutionFromRenderer(camera, renderer);
    scene.add(tiles.group);

    buildingsTiles = tiles;
  } catch (error) {
    console.error('swissBUILDINGS3D init failed', error);
    buildingsToggle.checked = false;
    status.textContent =
      'Bâtiments 3D indisponibles: ' + (error?.message || error);
  } finally {
    buildingsInitializing = false;
  }
}

status.textContent = 'Chargement du relief swisstopo…';

try {
  localFrame = await fetchLocalFrame(centerE, centerN);
} catch (error) {
  console.error('Local frame failed', error);
  localFrame = {
    groundHeight: 0,
    exact: false
  };
}

try {
  terrainModel = await loadTerrainGrid(
    LE_MUIDS.bbox,
    localFrame.groundHeight,
    41,
    31
  );
} catch (error) {
  console.warn('Terrain profile failed; flat fallback.', error);
  terrainModel = flatTerrainModel(
    LE_MUIDS.bbox,
    localFrame.groundHeight || 0
  );
}

const terrainTextureUrl = wmsUrl(
  LE_MUIDS.layers.cadastralWms,
  LE_MUIDS.bbox,
  1600,
  1000
);

const terrainObjects = await buildTerrainMesh(
  terrainModel,
  centerE,
  centerN,
  terrainTextureUrl,
  renderer
);
groups.terrain.add(terrainObjects.base, terrainObjects.mesh);

status.textContent = 'Chargement des réseaux officiels et de la fiction…';

let official;
try {
  [official, fiction] = await Promise.all([
    loadOfficialLayout(LE_MUIDS.bbox),
    fetch('./data/le_muids_fiction_v01.json').then(response => {
      if (!response.ok) {
        throw new Error('fiction JSON HTTP ' + response.status);
      }
      return response.json();
    })
  ]);
} catch (error) {
  console.error(error);
  status.textContent = 'Erreur de chargement: ' + error.message;
  throw error;
}

const counts = buildOfficialNetwork(official);

const inner = makeRibbon(
  fiction.innerRoadLoop,
  7.5,
  0xd6c9ad,
  1.35,
  true,
  false
);
groups.fiction.add(inner.mesh);

const railCurve = addTrack(fiction.railLoop, groups.fiction);
fiction.tunnels.forEach((tunnel, index) => {
  addTunnelMarker(tunnel.xy, index);
});

const stationMarker = new THREE.Mesh(
  new THREE.CylinderGeometry(4.5, 4.5, 3.5, 24),
  mat(0x38b977, 0.55, 0.05)
);
stationMarker.position.copy(localPoint(LE_MUIDS.station, 1.8, false));
stationMarker.castShadow = true;
groups.real.add(stationMarker);

let cars = [];
try {
  cars = await buildTrain(railCurve);
} catch (error) {
  console.warn('Train asset load failed', error);
}

let paused = false;
let trainT = 0.1;
const trackLength = railCurve.getLength();
const speedMps = 18;

function moveTrain(dt) {
  if (!cars.length) return;

  trainT = (trainT + (speedMps * dt) / trackLength) % 1;
  for (const car of cars) {
    let t = trainT - car.offset / trackLength;
    t = (t % 1 + 1) % 1;

    const p = railCurve.getPointAt(t);
    const tangent = railCurve.getTangentAt(t).normalize();

    car.wrapper.position.copy(p);
    car.wrapper.position.y += 1.35;
    car.wrapper.rotation.y =
      Math.atan2(tangent.x, tangent.z) + Math.PI;
  }
}

pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? '▶ Train' : '⏸ Train';
});

document.querySelector('#reset').addEventListener('click', () => {
  camera.position.copy(HOME_POS);
  controls.target.set(0, 18, 0);
  controls.update();
});

document.querySelector('#top').addEventListener('click', () => {
  camera.position.set(0, 1650, 0.01);
  controls.target.set(0, 0, 0);
  controls.update();
});

document.querySelector('#real').addEventListener('change', event => {
  groups.real.visible = event.target.checked;
});

document.querySelector('#fiction').addEventListener('change', event => {
  groups.fiction.visible = event.target.checked;
  groups.train.visible = event.target.checked;
});

terrainToggle.addEventListener('change', event => {
  groups.terrain.visible = event.target.checked;
});

buildingsToggle.addEventListener('change', async event => {
  if (event.target.checked && !buildingsTiles) {
    await initBuildings3D();
  }
  if (buildingsTiles) {
    buildingsTiles.group.visible = event.target.checked;
  }
});

const relief = (
  terrainModel.maxHeight - terrainModel.minHeight
).toFixed(1);

status.textContent =
  'Prêt · relief ' +
  relief +
  ' m · ' +
  counts.roads +
  ' segments route · ' +
  counts.rails +
  ' segments rail · bâtiments 3D à activer';

const clock = new THREE.Clock();

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  if (buildingsTiles) {
    buildingsTiles.setResolutionFromRenderer(camera, renderer);
  }
}
addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused) {
    moveTrain(dt);
  }

  controls.update();
  camera.updateMatrixWorld();

  if (buildingsTiles?.group.visible) {
    buildingsTiles.setResolutionFromRenderer(camera, renderer);
    buildingsTiles.update();
  }

  renderer.render(scene, camera);
}
animate();
