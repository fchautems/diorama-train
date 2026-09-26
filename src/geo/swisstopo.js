export const LE_MUIDS = {
  sr: 2056,
  // Official coordinates are in LV95 metres.
  // Expanded diorama extent: more breathing room on all four sides.
  // The village content itself remains clipped to the original compact area.
  bbox: [2505885, 1145295, 2506530, 1145710],
  villageContentBbox: [2505955, 1145355, 2506460, 1145650],
  station: [2506023.16, 1145508.25],
  layers: {
    roads: 'ch.swisstopo.swisstlm3d-strassen',
    rail: 'ch.swisstopo.swisstlm3d-eisenbahnnetz',
    cadastralWms: 'ch.swisstopo-vd.amtliche-vermessung',
    orthophotoWms: 'ch.swisstopo.swissimage'
  }
};

export function identifyUrl(layer, bbox=LE_MUIDS.bbox, width=1600, height=1000) {
  const q = new URLSearchParams({
    geometryType: 'esriGeometryEnvelope',
    geometry: bbox.join(','),
    geometryFormat: 'geojson',
    imageDisplay: width + ',' + height + ',96',
    lang: 'fr',
    layers: 'all:' + layer,
    mapExtent: bbox.join(','),
    returnGeometry: 'true',
    sr: String(LE_MUIDS.sr),
    tolerance: '0',
    limit: '200'
  });
  return 'https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?' + q.toString();
}

export function wmsUrl(layer=LE_MUIDS.layers.cadastralWms, bbox=LE_MUIDS.bbox, width=1600, height=1000) {
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer,
    STYLES: 'default',
    CRS: 'EPSG:' + LE_MUIDS.sr,
    BBOX: bbox.join(','),
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/png',
    TRANSPARENT: 'false',
    LANG: 'fr'
  });
  return 'https://wms.geo.admin.ch/?' + q.toString();
}

export async function fetchLayer(layer, bbox=LE_MUIDS.bbox) {
  const response = await fetch(identifyUrl(layer, bbox), { mode: 'cors' });
  if (!response.ok) throw new Error(layer + ': HTTP ' + response.status);
  const data = await response.json();
  return (data.results || []).filter(r => r.geometry).map(r => ({
    type: 'Feature',
    id: r.featureId ?? r.id,
    geometry: r.geometry,
    properties: {
      ...(r.properties || r.attributes || {}),
      _layer: r.layerBodId || layer,
      _featureId: r.featureId ?? r.id
    }
  }));
}

export async function loadOfficialLayout(bbox=LE_MUIDS.bbox) {
  const [roads, rail] = await Promise.all([
    fetchLayer(LE_MUIDS.layers.roads, bbox),
    fetchLayer(LE_MUIDS.layers.rail, bbox)
  ]);
  return {
    type: 'FeatureCollection',
    bbox,
    crs: { type: 'name', properties: { name: 'EPSG:' + LE_MUIDS.sr } },
    features: [...roads, ...rail],
    meta: {
      source: 'swisstopo / GeoAdmin API',
      fetchedAt: new Date().toISOString(),
      layers: [LE_MUIDS.layers.roads, LE_MUIDS.layers.rail]
    }
  };
}

export function toScreen([e,n], bbox, width, height) {
  const [minE,minN,maxE,maxN] = bbox;
  return [
    (e-minE)/(maxE-minE)*width,
    height-(n-minN)/(maxN-minN)*height
  ];
}

export function geometryToSvgPaths(geometry, bbox, width, height) {
  if (!geometry) return [];
  const paths = [];

  const line = coords => coords.map((p,i) => {
    const [x,y] = toScreen(p, bbox, width, height);
    return (i ? 'L' : 'M') + x.toFixed(2) + ',' + y.toFixed(2);
  }).join(' ');

  if (geometry.type === 'LineString') paths.push(line(geometry.coordinates));
  else if (geometry.type === 'MultiLineString') {
    for (const coords of geometry.coordinates) paths.push(line(coords));
  } else if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) paths.push(line(ring) + ' Z');
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) for (const ring of poly) paths.push(line(ring) + ' Z');
  } else if (geometry.type === 'Point') {
    const [x,y] = toScreen(geometry.coordinates,bbox,width,height);
    paths.push('M'+x+','+y+' l0.01,0');
  }
  return paths;
}
