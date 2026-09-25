# PROJECT_STATE

Dernière mise à jour: 2026-09-25

## Direction actuelle
- Runtime 3D existant: Three.js/WebGL.
- La v0.4 animée reste disponible.
- Nouvelle stratégie cartographique: ne plus tracer les routes/bâtiments à la main depuis une capture.
- Les anciennes données `data/le_muids_layout_v01.json` sont **dépréciées** et ne doivent plus servir de source de vérité.

## Source de vérité officielle
La géométrie réelle provient désormais directement de swisstopo / GeoAdmin au runtime navigateur.

### Module
`src/geo/swisstopo.js`

Il définit:
- bbox LV95 du secteur Le Muids;
- ancre gare Le Muids;
- couches officielles:
  - `ch.swisstopo.swisstlm3d-strassen`;
  - `ch.swisstopo.swisstlm3d-eisenbahnnetz`;
  - fond WMS `ch.swisstopo-vd.amtliche-vermessung`;
- fonctions de requête GeoAdmin Identify;
- conversion LV95 -> écran;
- export GeoJSON des objets réellement récupérés.

### Outil de validation
`layout-official.html`

Fonctionnement:
- charge automatiquement le fond de mensuration officielle swisstopo;
- récupère les routes/chemins swissTLM3D sur la bbox;
- récupère les voies ferroviaires swissTLM3D sur la bbox;
- affiche l'ancre de la gare;
- aucune boucle fictive n'est affichée;
- aucune géométrie réelle n'est dessinée à la main;
- bouton d'export du GeoJSON officiel récupéré par le navigateur.

L'ancien `layout-debug.html` redirige maintenant vers `layout-official.html`.

## Coordonnées
- Référentiel: EPSG:2056 / LV95.
- Bbox actuelle: `[2505500, 1145000, 2506900, 1145900]`.
- Gare Le Muids: environ `E 2506023.16 / N 1145508.25`.
- La bbox peut être ajustée plus tard si le secteur réel est trop large/étroit.

## Bâtiments
À ce stade, les bâtiments/parcelles sont visibles via le fond officiel de mensuration (AV), mais ne sont pas encore exportés comme polygones vectoriels dans notre propre GeoJSON.

Choix pour la suite:
1. valider d'abord que routes + voies officielles correspondent parfaitement au secteur;
2. ensuite récupérer/charger une source officielle adaptée aux bâtiments (AV / swissBUILDINGS3D) au lieu de les redessiner;
3. seulement après validation, créer la couche fiction (boucle train, route intérieure, tunnels).

## Sources
- GeoAdmin Identify API pour les géométries vectorielles.
- swissTLM3D Strassen und Wege.
- swissTLM3D Eisenbahn.
- WMS swisstopo pour le fond de mensuration officielle.

## Prochaine action
Faire tourner `layout-official.html` après `git pull`, vérifier que le fond AV et les tracés routes/rails sont exacts, puis ajuster la bbox si nécessaire. Ne pas ajouter la couche fiction avant validation du réel.
