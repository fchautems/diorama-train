import * as THREE from 'three';

function key(e, n) {
  return Math.round(e) + ',' + Math.round(n);
}

function makeSnakeGrid(bbox, cols, rows) {
  const [minE, minN, maxE, maxN] = bbox;
  const grid = [];
  const snake = [];

  for (let j = 0; j < rows; j++) {
    const n = minN + (maxN - minN) * (j / (rows - 1));
    const row = [];
    for (let i = 0; i < cols; i++) {
      const e = minE + (maxE - minE) * (i / (cols - 1));
      row.push([e, n]);
    }
    grid.push(row);
    const ordered = j % 2 === 0 ? row : [...row].reverse();
    snake.push(...ordered);
  }
  return { grid, snake };
}

async function fetchProfile(points) {
  const body = new URLSearchParams({
    geom: JSON.stringify({ type: 'LineString', coordinates: points }),
    sr: '2056',
    nb_points: String(points.length),
    distinct_points: 'True'
  });

  const response = await fetch('https://api3.geo.admin.ch/rest/services/profile.json', {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
  if (!response.ok) throw new Error('profile HTTP ' + response.status);
  return response.json();
}

function nearestHeight(samples, e, n) {
  let best = null;
  let bestD2 = Infinity;
  for (const sample of samples) {
    const dx = Number(sample.easting) - e;
    const dy = Number(sample.northing) - n;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = sample;
    }
  }
  return Number(best?.alts?.COMB ?? best?.alts?.DTM2 ?? best?.alts?.DTM25 ?? 0);
}

export async function loadTerrainGrid(bbox, stationHeight, cols = 41, rows = 31) {
  const { grid, snake } = makeSnakeGrid(bbox, cols, rows);
  const samples = await fetchProfile(snake);
  const sampleMap = new Map();

  for (const sample of samples) {
    const e = Number(sample.easting);
    const n = Number(sample.northing);
    const h = Number(sample?.alts?.COMB ?? sample?.alts?.DTM2 ?? sample?.alts?.DTM25);
    if (Number.isFinite(e) && Number.isFinite(n) && Number.isFinite(h)) {
      sampleMap.set(key(e, n), h);
    }
  }

  const heights = grid.map(row =>
    row.map(([e, n]) => {
      const direct = sampleMap.get(key(e, n));
      return Number.isFinite(direct) ? direct : nearestHeight(samples, e, n);
    })
  );

  return {
    bbox,
    cols,
    rows,
    grid,
    heights,
    stationHeight,
    minHeight: Math.min(...heights.flat()),
    maxHeight: Math.max(...heights.flat())
  };
}

export function terrainHeightAt(model, e, n) {
  const [minE, minN, maxE, maxN] = model.bbox;
  const u = THREE.MathUtils.clamp((e - minE) / (maxE - minE), 0, 1);
  const v = THREE.MathUtils.clamp((n - minN) / (maxN - minN), 0, 1);

  const gx = u * (model.cols - 1);
  const gy = v * (model.rows - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(model.cols - 1, x0 + 1);
  const y1 = Math.min(model.rows - 1, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;

  const h00 = model.heights[y0][x0];
  const h10 = model.heights[y0][x1];
  const h01 = model.heights[y1][x0];
  const h11 = model.heights[y1][x1];

  const h0 = THREE.MathUtils.lerp(h00, h10, tx);
  const h1 = THREE.MathUtils.lerp(h01, h11, tx);
  return THREE.MathUtils.lerp(h0, h1, ty) - model.stationHeight;
}

export async function buildTerrainMesh(model, centerE, centerN, textureUrl, renderer) {
  const [minE, minN, maxE, maxN] = model.bbox;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j < model.rows; j++) {
    for (let i = 0; i < model.cols; i++) {
      const [e, n] = model.grid[j][i];
      const y = model.heights[j][i] - model.stationHeight;
      positions.push(e - centerE, y, -(n - centerN));
      uvs.push(
        (e - minE) / (maxE - minE),
        (n - minN) / (maxN - minN)
      );
    }
  }

  for (let j = 0; j < model.rows - 1; j++) {
    for (let i = 0; i < model.cols - 1; i++) {
      const a = j * model.cols + i;
      const b = a + 1;
      const c = a + model.cols;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  let texture = null;
  try {
    texture = await new THREE.TextureLoader().loadAsync(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  } catch (error) {
    console.warn('Terrain texture unavailable', error);
  }

  const material = texture
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 1, metalness: 0 })
    : new THREE.MeshStandardMaterial({ color: 0x8fb36d, roughness: 1 });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const width = maxE - minE;
  const depth = maxN - minN;
  const minRelativeHeight = model.minHeight - model.stationHeight;
  const baseTop = minRelativeHeight - 2;
  const baseHeight = 24;
  const baseBottom = baseTop - baseHeight;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(width, baseHeight, depth),
    new THREE.MeshStandardMaterial({ color: 0x705b45, roughness: 1 })
  );
  base.position.set(
    (minE + maxE) / 2 - centerE,
    (baseTop + baseBottom) / 2,
    -((minN + maxN) / 2 - centerN)
  );
  base.receiveShadow = true;

  return { mesh, base };
}
