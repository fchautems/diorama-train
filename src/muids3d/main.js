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

const TILESETS = {
  buildings:
    'https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json',
  vegetation:
    'https://3d.geo.admin.ch/ch.swisstopo.vegetation.3d/v1/tileset.json'
};

const app = document.querySelector('#app');
const status = document.querySelector('#status');
const pauseBtn = document.querySelector('#pause');
const terrainToggle = document.querySelector('#terrain');
const buildingsToggle = document.querySelector('#buildings');
const vegetationToggle = document.querySelector('#vegetation');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.03;
renderer.localClippingEnabled = true;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9d6e5);

const camera = new THREE.PerspectiveCamera(42, 1, 1, 7000);

const [sceneMinE, sceneMinN, sceneMaxE, sceneMaxN] = LE_MUIDS.bbox;
const sceneCenter = new THREE.Vector3(
  (sceneMinE + sceneMaxE) / 2 - LE_MUIDS.station[0],
  16,
  -((sceneMinN + sceneMaxN) / 2 - LE_MUIDS.station[1])
);
const HOME_POS = sceneCenter.clone().add(
  new THREE.Vector3(300, 260, 360)
);
camera.position.copy(HOME_POS);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(sceneCenter);
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
let vegetationTiles = null;
let buildingsInitializing = false;
let vegetationInitializing = false;
let activeRailCurve = null;
let corridorRemovedBuildings = 0;
let corridorRemovedVegetation = 0;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/'
);
dracoLoader.preload();

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

function clipSegmentToBbox(a, b, bbox) {
  const [minE, minN, maxE, maxN] = bbox;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];

  let t0 = 0;
  let t1 = 1;

  const tests = [
    [-dx, a[0] - minE],
    [ dx, maxE - a[0]],
    [-dy, a[1] - minN],
    [ dy, maxN - a[1]]
  ];

  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
      continue;
    }

    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  return [
    [a[0] + dx * t0, a[1] + dy * t0],
    [a[0] + dx * t1, a[1] + dy * t1]
  ];
}

function clipPolylineToBbox(points, bbox) {
  const segments = [];
  let current = [];

  for (let i = 1; i < points.length; i++) {
    const clipped = clipSegmentToBbox(
      points[i - 1],
      points[i],
      bbox
    );

    if (!clipped) {
      if (current.length >= 2) segments.push(current);
      current = [];
      continue;
    }

    const [a, b] = clipped;

    if (!current.length) {
      current.push(a, b);
      continue;
    }

    const last = current[current.length - 1];
    if (distance2D(last, a) < 0.01) {
      current.push(b);
    } else {
      if (current.length >= 2) segments.push(current);
      current = [a, b];
    }
  }

  if (current.length >= 2) segments.push(current);
  return segments;
}

function unit2(a, b) {
  const x = b[0] - a[0];
  const y = b[1] - a[1];
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

function cubicBezierSamples(p0, p1, startTangent, endTangent, h0, h1, steps = 10) {
  const c1 = [
    p0[0] + startTangent[0] * h0,
    p0[1] + startTangent[1] * h0
  ];
  const c2 = [
    p1[0] - endTangent[0] * h1,
    p1[1] - endTangent[1] * h1
  ];

  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u*u*u*p0[0] +
        3*u*u*t*c1[0] +
        3*u*t*t*c2[0] +
        t*t*t*p1[0],
      u*u*u*p0[1] +
        3*u*u*t*c1[1] +
        3*u*t*t*c2[1] +
        t*t*t*p1[1]
    ]);
  }
  return out;
}

function railDistance2D(point, curve, samples = 260) {
  let best = Infinity;
  let prev = curve.getPointAt(0);

  for (let i = 1; i <= samples; i++) {
    const curr = curve.getPointAt(i / samples);

    const ax = prev.x;
    const az = prev.z;
    const bx = curr.x;
    const bz = curr.z;
    const vx = bx - ax;
    const vz = bz - az;
    const wx = point.x - ax;
    const wz = point.z - az;
    const vv = vx * vx + vz * vz;

    let t = vv > 0 ? (wx * vx + wz * vz) / vv : 0;
    t = THREE.MathUtils.clamp(t, 0, 1);

    const px = ax + vx * t;
    const pz = az + vz * t;
    best = Math.min(best, Math.hypot(point.x - px, point.z - pz));

    prev = curr;
  }

  return best;
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

function localPoint([e, n], offset = 0) {
  return new THREE.Vector3(
    e - centerE,
    groundY(e, n) + offset,
    -(n - centerN)
  );
}

function curveFromLV95(points, offset = 0.65, closed = false) {
  const p = points.map(pt => localPoint(pt, offset));
  return new THREE.CatmullRomCurve3(p, closed, 'centripetal', 0.3);
}

function tubeFromPoints(
  points,
  radius,
  color,
  offset = 0.65,
  closed = false,
  segmentsFactor = 1
) {
  if (points.length < 2) return null;

  const curve = curveFromLV95(points, offset, closed);
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

function makeRibbon(points, width, color, offset = 1, closed = false) {
  const curve = curveFromLV95(points, offset, closed);
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

function distance2D(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function polylineLength(points) {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance2D(points[i - 1], points[i]);
  }
  return length;
}

function closestProjection(points, query) {
  let best = {
    distance: Infinity,
    s: 0,
    point: points[0],
    segmentIndex: 0,
    t: 0
  };

  let cumulative = 0;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const seg2 = vx * vx + vy * vy;
    const segLen = Math.sqrt(seg2);

    let t = 0;
    if (seg2 > 0) {
      t = (
        (query[0] - a[0]) * vx +
        (query[1] - a[1]) * vy
      ) / seg2;
      t = THREE.MathUtils.clamp(t, 0, 1);
    }

    const p = [
      a[0] + vx * t,
      a[1] + vy * t
    ];

    const d = distance2D(p, query);
    if (d < best.distance) {
      best = {
        distance: d,
        s: cumulative + segLen * t,
        point: p,
        segmentIndex: i - 1,
        t
      };
    }

    cumulative += segLen;
  }

  best.totalLength = cumulative;
  return best;
}

function cumulativeDistances(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(
      cumulative[i - 1] + distance2D(points[i - 1], points[i])
    );
  }
  return cumulative;
}

function pointAtPolylineDistance(points, cumulative, s) {
  if (s <= 0) return [...points[0]];
  const total = cumulative[cumulative.length - 1];
  if (s >= total) return [...points[points.length - 1]];

  for (let i = 1; i < points.length; i++) {
    if (cumulative[i] < s) continue;

    const a = points[i - 1];
    const b = points[i];
    const span = cumulative[i] - cumulative[i - 1];
    const t = span > 0 ? (s - cumulative[i - 1]) / span : 0;

    return [
      THREE.MathUtils.lerp(a[0], b[0], t),
      THREE.MathUtils.lerp(a[1], b[1], t)
    ];
  }

  return [...points[points.length - 1]];
}

function extractPolylineWindow(points, query, halfLength = 180) {
  const projection = closestProjection(points, query);
  const cumulative = cumulativeDistances(points);
  const total = cumulative[cumulative.length - 1];

  const startS = Math.max(0, projection.s - halfLength);
  const endS = Math.min(total, projection.s + halfLength);

  const out = [
    pointAtPolylineDistance(points, cumulative, startS)
  ];

  for (let i = 1; i < points.length - 1; i++) {
    if (cumulative[i] > startS && cumulative[i] < endS) {
      out.push([...points[i]]);
    }
  }

  out.push(
    pointAtPolylineDistance(points, cumulative, endS)
  );

  return out;
}

function buildStitchedRailPolyline(official) {
  const lines = official.features
    .filter(feature =>
      (feature.properties?._layer || '').includes('eisenbahnnetz')
    )
    .flatMap(feature => lineStrings(feature.geometry))
    .filter(points => points.length >= 2);

  if (!lines.length) return null;

  const nearStation = lines
    .map((points, index) => ({
      index,
      distance: closestProjection(points, LE_MUIDS.station).distance,
      length: polylineLength(points)
    }))
    .filter(candidate => candidate.distance < 35)
    .sort((a, b) => b.length - a.length);

  let seedIndex;

  if (nearStation.length) {
    seedIndex = nearStation[0].index;
  } else {
    seedIndex = lines
      .map((points, index) => ({
        index,
        distance: closestProjection(points, LE_MUIDS.station).distance
      }))
      .sort((a, b) => a.distance - b.distance)[0].index;
  }

  let stitched = lines[seedIndex].map(point => [...point]);
  const used = new Set([seedIndex]);

  for (let iteration = 0; iteration < lines.length; iteration++) {
    const start = stitched[0];
    const end = stitched[stitched.length - 1];
    let best = null;

    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;

      const candidate = lines[i];
      const cStart = candidate[0];
      const cEnd = candidate[candidate.length - 1];

      const options = [
        { gap: distance2D(end, cStart), mode: 'appendForward' },
        { gap: distance2D(end, cEnd), mode: 'appendReverse' },
        { gap: distance2D(start, cEnd), mode: 'prependForward' },
        { gap: distance2D(start, cStart), mode: 'prependReverse' }
      ];

      for (const option of options) {
        if (option.gap > 12) continue;
        if (!best || option.gap < best.gap) {
          best = { ...option, index: i };
        }
      }
    }

    if (!best) break;

    const candidate = lines[best.index].map(point => [...point]);
    used.add(best.index);

    if (best.mode === 'appendForward') {
      stitched.push(...candidate.slice(1));
    } else if (best.mode === 'appendReverse') {
      stitched.push(...candidate.reverse().slice(1));
    } else if (best.mode === 'prependForward') {
      stitched.unshift(...candidate.slice(0, -1));
    } else {
      stitched.unshift(...candidate.reverse().slice(0, -1));
    }
  }

  return stitched;
}

function buildStationRightRailLoop(official) {
  const stitched = buildStitchedRailPolyline(official);

  if (!stitched || stitched.length < 2) {
    const [minE, minN, maxE, maxN] = LE_MUIDS.bbox;
    return {
      points: [
        [LE_MUIDS.station[0], minN + 35],
        [LE_MUIDS.station[0] + 85, minN + 20],
        [maxE - 70, minN + 18],
        [maxE - 14, (minN + maxN) / 2],
        [maxE - 70, maxN - 18],
        [LE_MUIDS.station[0] + 85, maxN - 20]
      ],
      realSegment: [],
      realLength: 0,
      fallback: true
    };
  }

  let realSegment = extractPolylineWindow(
    stitched,
    LE_MUIDS.station,
    105
  );

  if (realSegment[0][1] > realSegment[realSegment.length - 1][1]) {
    realSegment = realSegment.reverse();
  }

  const southEnd = realSegment[0];
  const northEnd = realSegment[realSegment.length - 1];
  const southTangent = unit2(realSegment[0], realSegment[1]);
  const northTangent = unit2(
    realSegment[realSegment.length - 2],
    realSegment[realSegment.length - 1]
  );

  const [minE, minN, maxE, maxN] = LE_MUIDS.bbox;
  const east = maxE - 10;
  const top = maxN - 12;
  const bottom = minN + 12;
  const midN = (minN + maxN) / 2;

  // The first/last fictional points are intentionally well to the east.
  // The cubic transitions keep the same tangent as the real rail for a
  // significant distance before the circuit bends towards the village.
  const northEntry = [
    Math.max(LE_MUIDS.station[0] + 135, northEnd[0] + 110),
    Math.min(top, northEnd[1] + 42)
  ];

  const southEntry = [
    Math.max(LE_MUIDS.station[0] + 135, southEnd[0] + 110),
    Math.max(bottom, southEnd[1] - 42)
  ];

  const northTransition = cubicBezierSamples(
    northEnd,
    northEntry,
    northTangent,
    [1, 0],
    85,
    55,
    12
  );

  const southTransition = cubicBezierSamples(
    southEntry,
    southEnd,
    [-1, 0],
    southTangent,
    55,
    85,
    12
  );

  // Wide loop around the outside of the village. This route deliberately
  // favours the periphery; any residual conflicting 3D objects are filtered
  // by the rail corridor when official tiles load.
  const outerArc = [
    northEntry,
    [LE_MUIDS.station[0] + 235, top],
    [maxE - 90, top],
    [maxE - 25, top - 42],
    [east, midN + 58],
    [east, midN - 58],
    [maxE - 25, bottom + 42],
    [maxE - 90, bottom],
    [LE_MUIDS.station[0] + 235, bottom],
    southEntry
  ];

  return {
    points: [
      ...realSegment,
      ...northTransition,
      ...outerArc.slice(1),
      ...southTransition
    ],
    realSegment,
    realLength: polylineLength(realSegment),
    fallback: false
  };
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
  const base = makeRibbon(points, 4.6, 0x9b7a58, 1.0, true);
  group.add(base.mesh);

  for (const off of [-0.75, 0.75]) {
    const samples = [];
    const count = 260;
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const p = base.curve.getPointAt(t);
      const tangent = base.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3().crossVectors(up, tangent).normalize();
      samples.push(p.clone().addScaledVector(normal, off));
    }

    const curve = new THREE.CatmullRomCurve3(
      samples,
      true,
      'centripetal',
      0.25
    );

    const rail = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 480, 0.085, 8, true),
      mat(0x4e5357, 0.35, 0.65)
    );

    rail.castShadow = true;
    group.add(rail);
  }

  const sleeperCount = Math.max(
    150,
    Math.round(base.curve.getLength() / 5.5)
  );
  addSleepers(base.curve, sleeperCount, 3.2, group);

  return base.curve;
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

      const clippedSegments = clipPolylineToBbox(
        points,
        LE_MUIDS.bbox
      );

      for (const clipped of clippedSegments) {
        const mesh = tubeFromPoints(
          clipped,
          isRail ? 0.50 : 0.34,
          isRail ? 0x34383b : 0x5f6569,
          isRail ? 1.10 : 0.82,
          false,
          0.7
        );

        if (!mesh) continue;

        mesh.userData.kind = isRail
          ? 'officialRail'
          : 'officialRoad';

        groups.real.add(mesh);

        if (isRail) rails++;
        else roads++;
      }
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

function sceneClippingPlanes() {
  const minX = sceneMinE - centerE;
  const maxX = sceneMaxE - centerE;
  const minZ = -(sceneMaxN - centerN);
  const maxZ = -(sceneMinN - centerN);

  const bottomCut = terrainModel
    ? terrainModel.minHeight - terrainModel.stationHeight - 3
    : -15;

  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -minX),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), maxX),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -minZ),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), maxZ),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -bottomCut)
  ];
}

function applySceneClipping(material) {
  const materials = Array.isArray(material)
    ? material
    : [material];

  for (const item of materials) {
    if (!item) continue;
    item.clippingPlanes = sceneClippingPlanes();
    item.clipIntersection = false;
    item.needsUpdate = true;
  }
}

function meshWorldBounds(mesh) {
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  return box;
}

function shouldHideMeshFromScene(mesh, kind) {
  const box = meshWorldBounds(mesh);
  if (box.isEmpty()) return false;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const minX = sceneMinE - centerE;
  const maxX = sceneMaxE - centerE;
  const minZ = -(sceneMaxN - centerN);
  const maxZ = -(sceneMinN - centerN);
  const bottomCut = terrainModel
    ? terrainModel.minHeight - terrainModel.stationHeight - 3
    : -15;

  if (
    center.x < minX - 5 ||
    center.x > maxX + 5 ||
    center.z < minZ - 5 ||
    center.z > maxZ + 5 ||
    box.max.y < bottomCut
  ) {
    return true;
  }

  if (!activeRailCurve) return false;

  // Keep the real-station section intact visually; clearance filtering is
  // mainly for the added loop through the diorama.
  const corridor = kind === 'buildings' ? 11 : 8;
  const footprintRadius = Math.min(
    12,
    0.5 * Math.hypot(size.x, size.z)
  );

  return railDistance2D(
    center,
    activeRailCurve
  ) < corridor + footprintRadius;
}

function filterLoadedOfficialScene(root, kind) {
  root?.updateMatrixWorld(true);

  root?.traverse(node => {
    if (!node.isMesh) return;

    if (shouldHideMeshFromScene(node, kind)) {
      node.visible = false;

      if (kind === 'buildings') {
        corridorRemovedBuildings++;
      } else {
        corridorRemovedVegetation++;
      }
    }
  });
}

async function createOfficialTilesLayer(url, kind, toggle) {
  if (!localFrame) {
    localFrame = await fetchLocalFrame(centerE, centerN);
  }

  const tiles = new TilesRenderer(url);
  tiles.errorTarget = kind === 'vegetation' ? 8 : 10;
  tiles.optimizedLoadStrategy = true;
  tiles.loadSiblings = true;

  tiles.registerPlugin(
    new GLTFExtensionsPlugin({ dracoLoader })
  );
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

  if (tiles.group.matrixWorldInverse) {
    tiles.group.matrixWorldInverse
      .copy(tiles.group.matrixWorld)
      .invert();
  }

  tiles.group.visible = toggle.checked;

  tiles.addEventListener('load-model', event => {
    event.scene?.traverse(node => {
      if (!node.isMesh) return;

      if (!node.geometry.attributes.normal) {
        node.geometry.computeVertexNormals();
      }

      applySceneClipping(node.material);
      node.castShadow = kind === 'buildings';
      node.receiveShadow = true;
    });

    filterLoadedOfficialScene(
      event.scene,
      kind
    );

    if (typeof updateStatus === 'function') {
      updateStatus();
    }
  });

  tiles.addEventListener('load-error', event => {
    console.warn(kind + ' 3D Tiles load error', event);
  });

  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);
  scene.add(tiles.group);

  return tiles;
}

async function initBuildings3D() {
  if (buildingsTiles || buildingsInitializing) return;

  buildingsInitializing = true;

  try {
    buildingsTiles = await createOfficialTilesLayer(
      TILESETS.buildings,
      'buildings',
      buildingsToggle
    );
  } catch (error) {
    console.error('swissBUILDINGS3D init failed', error);
    buildingsToggle.checked = false;
  } finally {
    buildingsInitializing = false;
  }
}

async function initVegetation3D() {
  if (vegetationTiles || vegetationInitializing) return;

  vegetationInitializing = true;

  try {
    vegetationTiles = await createOfficialTilesLayer(
      TILESETS.vegetation,
      'vegetation',
      vegetationToggle
    );
  } catch (error) {
    console.error('swisstopo vegetation init failed', error);
    vegetationToggle.checked = false;
  } finally {
    vegetationInitializing = false;
  }
}

status.textContent = 'Chargement du relief swisstopo…';

try {
  localFrame = await fetchLocalFrame(centerE, centerN);
} catch (error) {
  console.error('Local frame failed', error);

  localFrame = {
    // Published station altitude; only used if the live height service fails.
    groundHeight: 715,
    exact: false
  };
}

try {
  terrainModel = await loadTerrainGrid(
    LE_MUIDS.bbox,
    localFrame.groundHeight,
    17,
    11
  );
} catch (error) {
  console.warn('Terrain profile failed; flat fallback.', error);

  terrainModel = flatTerrainModel(
    LE_MUIDS.bbox,
    localFrame.groundHeight || 0
  );
}

const terrainTextureUrl = wmsUrl(
  LE_MUIDS.layers.orthophotoWms,
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

groups.terrain.add(
  terrainObjects.base,
  terrainObjects.mesh
);

status.textContent =
  'Chargement des réseaux officiels et de la boucle ferroviaire…';

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

// v0.4: the station is deliberately the LEFT anchor of the scene.
// A real swissTLM3D rail section around Le Muids station is preserved,
// then the added circuit loops only through the village/right-hand side.
const hybridRail = buildStationRightRailLoop(
  official
);

const railClearance = makeRibbon(
  hybridRail.points,
  11.5,
  0x8a7a61,
  0.45,
  true
);
railClearance.mesh.material.roughness = 1;
railClearance.mesh.receiveShadow = true;
groups.fiction.add(railClearance.mesh);

const railCurve = addTrack(
  hybridRail.points,
  groups.fiction
);
activeRailCurve = railCurve;

// The former yellow inner-road polygon is intentionally NOT rendered here.
// It stays in the design data until we rebuild it from the official road
// network instead of asking the user to drag control points.
//
// The former blue tunnel markers are also hidden. They remain design metadata
// only; no technical marker should pollute the final diorama.

const stationMarker = new THREE.Mesh(
  new THREE.CylinderGeometry(4.5, 4.5, 3.5, 24),
  mat(0x38b977, 0.55, 0.05)
);

stationMarker.position.copy(
  localPoint(LE_MUIDS.station, 1.8)
);
stationMarker.castShadow = true;
groups.real.add(stationMarker);

let cars = [];

try {
  cars = await buildTrain(railCurve);
} catch (error) {
  console.warn('Train asset load failed', error);
}

function findStationT(curve) {
  const target = localPoint(LE_MUIDS.station, 0);
  let bestT = 0;
  let bestDistance = Infinity;

  for (let i = 0; i <= 1000; i++) {
    const t = i / 1000;
    const p = curve.getPointAt(t);
    const d = Math.hypot(
      p.x - target.x,
      p.z - target.z
    );

    if (d < bestDistance) {
      bestDistance = d;
      bestT = t;
    }
  }

  return bestT;
}

let paused = false;
let trainT = 0.1;
let stationStopRemaining = 0;

const trackLength = railCurve.getLength();
const speedMps = 18;
const stationT = findStationT(railCurve);

function crossedTarget(previous, next, target) {
  if (next >= previous) {
    return target > previous && target <= next;
  }

  return target > previous || target <= next;
}

function moveTrain(dt) {
  if (!cars.length) return;

  if (stationStopRemaining > 0) {
    stationStopRemaining = Math.max(
      0,
      stationStopRemaining - dt
    );
  } else {
    const previous = trainT;
    const next =
      (trainT + (speedMps * dt) / trackLength) % 1;

    if (crossedTarget(previous, next, stationT)) {
      trainT = stationT;
      stationStopRemaining = 4.5;
    } else {
      trainT = next;
    }
  }

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
  pauseBtn.textContent = paused
    ? '▶ Train'
    : '⏸ Train';
});

document.querySelector('#reset').addEventListener(
  'click',
  () => {
    camera.position.copy(HOME_POS);
    controls.target.copy(sceneCenter);
    controls.update();
  }
);

document.querySelector('#top').addEventListener(
  'click',
  () => {
    camera.position.set(
      sceneCenter.x,
      720,
      sceneCenter.z + 0.01
    );
    controls.target.copy(sceneCenter);
    controls.update();
  }
);

document.querySelector('#real').addEventListener(
  'change',
  event => {
    groups.real.visible = event.target.checked;
  }
);

document.querySelector('#fiction').addEventListener(
  'change',
  event => {
    groups.fiction.visible = event.target.checked;
    groups.train.visible = event.target.checked;
  }
);

terrainToggle.addEventListener('change', event => {
  groups.terrain.visible = event.target.checked;
});

buildingsToggle.addEventListener(
  'change',
  async event => {
    if (event.target.checked && !buildingsTiles) {
      await initBuildings3D();
    }

    if (buildingsTiles) {
      buildingsTiles.group.visible = event.target.checked;
    }
  }
);

vegetationToggle.addEventListener(
  'change',
  async event => {
    if (event.target.checked && !vegetationTiles) {
      await initVegetation3D();
    }

    if (vegetationTiles) {
      vegetationTiles.group.visible = event.target.checked;
    }
  }
);

// Houses and trees now load automatically; the user does not have to discover
// a hidden debug toggle.
await Promise.allSettled([
  initBuildings3D(),
  initVegetation3D()
]);

const relief = (
  terrainModel.maxHeight -
  terrainModel.minHeight
).toFixed(1);

function updateStatus() {
  status.textContent =
    'Prêt · ' +
    hybridRail.realLength.toFixed(0) +
    ' m de vraie voie · relief ' +
    relief +
    ' m · cadrage village 505×295 m · ' +
    counts.roads +
    ' routes · ' +
    counts.rails +
    ' voies · objets écartés du rail: ' +
    corridorRemovedBuildings +
    ' maisons / ' +
    corridorRemovedVegetation +
    ' végétation';
}

updateStatus();

const clock = new THREE.Clock();

function resize() {
  const width = innerWidth;
  const height = innerHeight;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  for (const tiles of [buildingsTiles, vegetationTiles]) {
    if (tiles) {
      tiles.setResolutionFromRenderer(
        camera,
        renderer
      );
    }
  }
}

addEventListener('resize', resize);
resize();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(
    clock.getDelta(),
    0.05
  );

  if (!paused) {
    moveTrain(dt);
  }

  controls.update();
  camera.updateMatrixWorld();

  for (const tiles of [buildingsTiles, vegetationTiles]) {
    if (tiles?.group.visible) {
      tiles.setResolutionFromRenderer(
        camera,
        renderer
      );
      tiles.update();
    }
  }

  renderer.render(scene, camera);
}

animate();
