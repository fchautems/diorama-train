import * as THREE from 'three';

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

async function fetchJson(url) {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
  return response.json();
}

export function lv95ToWgs84Approx(easting, northing) {
  const y = (easting - 2600000.0) / 1000000.0;
  const x = (northing - 1200000.0) / 1000000.0;

  let lon =
    2.6779094 +
    4.728982 * y +
    0.791484 * y * x +
    0.1306 * y * x * x -
    0.0436 * y * y * y;

  let lat =
    16.9023892 +
    3.238272 * x -
    0.270978 * y * y -
    0.002528 * x * x -
    0.0447 * y * y * x -
    0.0140 * x * x * x;

  lon = lon * 100.0 / 36.0;
  lat = lat * 100.0 / 36.0;
  return { lonDeg: lon, latDeg: lat };
}

export function wgs84ToEcef(lonDeg, latDeg, height = 0) {
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const lat = THREE.MathUtils.degToRad(latDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

  return new THREE.Vector3(
    (n + height) * cosLat * cosLon,
    (n + height) * cosLat * sinLon,
    (n * (1 - WGS84_E2) + height) * sinLat
  );
}

export function makeEcefToLocalMatrix(lonDeg, latDeg, anchorEcef, localYOffset = 0) {
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const lat = THREE.MathUtils.degToRad(latDeg);

  const east = new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0).normalize();
  const north = new THREE.Vector3(
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat)
  ).normalize();
  const up = new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat)
  ).normalize();
  const south = north.clone().multiplyScalar(-1);

  const matrix = new THREE.Matrix4();
  matrix.set(
    east.x, east.y, east.z, -east.dot(anchorEcef),
    up.x, up.y, up.z, -up.dot(anchorEcef) + localYOffset,
    south.x, south.y, south.z, -south.dot(anchorEcef),
    0, 0, 0, 1
  );
  return matrix;
}

export async function fetchLocalFrame(easting, northing) {
  const heightUrl =
    'https://api3.geo.admin.ch/rest/services/height?easting=' +
    encodeURIComponent(easting) +
    '&northing=' +
    encodeURIComponent(northing) +
    '&sr=2056';

  const heightData = await fetchJson(heightUrl);
  const groundHeight = Number(heightData.height);

  let lonDeg;
  let latDeg;
  let ellipsoidHeight;
  let exact = false;

  try {
    const besselUrl =
      'https://geodesy.geo.admin.ch/reframe/ln02tobessel?easting=' +
      encodeURIComponent(easting) +
      '&northing=' +
      encodeURIComponent(northing) +
      '&altitude=' +
      encodeURIComponent(groundHeight) +
      '&format=json';

    const bessel = await fetchJson(besselUrl);

    const wgsUrl =
      'https://geodesy.geo.admin.ch/reframe/lv95towgs84?easting=' +
      encodeURIComponent(easting) +
      '&northing=' +
      encodeURIComponent(northing) +
      '&altitude=' +
      encodeURIComponent(Number(bessel.altitude)) +
      '&format=json';

    const wgs = await fetchJson(wgsUrl);
    lonDeg = Number(wgs.easting);
    latDeg = Number(wgs.northing);
    ellipsoidHeight = Number(wgs.altitude);
    exact = Number.isFinite(lonDeg) && Number.isFinite(latDeg) && Number.isFinite(ellipsoidHeight);
  } catch (error) {
    console.warn('REFRAME exact transform unavailable; using local approximation.', error);
  }

  if (!exact) {
    const approx = lv95ToWgs84Approx(easting, northing);
    lonDeg = approx.lonDeg;
    latDeg = approx.latDeg;
    ellipsoidHeight = groundHeight + 50;
  }

  const anchorEcef = wgs84ToEcef(lonDeg, latDeg, ellipsoidHeight);
  return {
    easting,
    northing,
    groundHeight,
    lonDeg,
    latDeg,
    ellipsoidHeight,
    anchorEcef,
    exact
  };
}
