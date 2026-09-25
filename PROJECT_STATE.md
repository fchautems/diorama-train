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

## Éditeur fiction sur base officielle
Ajout de `layout-fiction-editor.html` et `data/le_muids_fiction_v01.json`.

Objectif:
- garder les routes/rails réels exclusivement issus de swisstopo;
- éditer séparément la couche fictive en LV95;
- déplacer les points de contrôle à la souris;
- exporter un JSON fiction propre quand la géométrie est validée.

Couche fictive actuelle:
- boucle ferroviaire extérieure violette;
- route intérieure jaune;
- 4 marqueurs de passages inférieurs bleus;
- toutes les coordonnées sont en EPSG:2056 / mètres.

Important: cette couche est un **brouillon éditable**, pas une géométrie validée.

## Bâtiments 3D officiels
GeoAdmin publie également swissBUILDINGS3D en 3D Tiles. Cette piste est retenue pour la phase 3D afin d'éviter de réinventer les volumes des maisons.

## Prochaine action
Valider d'abord `layout-official.html`, puis ajuster la couche fiction dans `layout-fiction-editor.html`. Une fois les deux couches validées, brancher les coordonnées LV95 dans Three.js et tester l'intégration des bâtiments officiels 3D.


## Prototype 3D LV95 v0.1
Ajout de `le-muids-3d.html` et `src/muids3d/main.js`.

Le prototype:
- travaille en mètres autour de l'ancre gare Le Muids;
- transforme les coordonnées LV95 officielles en coordonnées locales Three.js;
- charge le fond WMS officiel sur un plateau 3D;
- affiche routes et rails swissTLM3D comme géométrie Three.js;
- affiche la boucle ferroviaire fictive et la route intérieure depuis `data/le_muids_fiction_v01.json`;
- matérialise les 4 passages inférieurs prévus avec des marqueurs 3D;
- réutilise le train Kenney existant et l'anime sur la boucle fictive;
- fournit vue initiale, vue du dessus et masquage réel/fiction.

Limites connues:
- terrain plat, sans swissALTI3D;
- les passages inférieurs sont encore des marqueurs/volumes de contrôle, pas des tunnels creusés;
- swissBUILDINGS3D n'est pas encore intégré dans cette scène locale;
- la boucle fictive reste un brouillon à régler dans l'éditeur.

## Recherche bâtiments 3D
Endpoint public confirmé:
`https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json`

Le dataset est servi en 3D Tiles. L'intégration directe dans notre scène locale nécessite encore le raccord entre le repère géocentrique des 3D Tiles et notre repère local LV95/ENU. Cette étape est séparée pour ne pas fragiliser le prototype géométrique actuel.

## Prochaine action
Tester `le-muids-3d.html`, puis:
1. corriger la couche fictive si nécessaire;
2. ajouter le relief swissALTI3D/terrain;
3. intégrer swissBUILDINGS3D dans un repère ENU local;
4. remplacer les marqueurs de tunnels par deux vraies séquences de passage inférieur;
5. seulement ensuite réintroduire végétation/animaux/personnages.


## Prototype 3D LV95 v0.2
Ajouts:
- `src/geo/terrain.js`: génération d'un maillage terrain à partir du service `profile.json` de swisstopo;
- grille 41×31 sur la bbox actuelle, soit ~1'271 points d'altitude;
- interpolation bilinéaire pour placer routes, voies, gare et fiction sur le relief;
- texture WMS officielle projetée sur le maillage;
- la Route cantonale descend progressivement de ~7.5 m autour des 4 marqueurs de passage inférieur;
- `src/geo/geodesy.js`: conversion LV95 -> WGS84 / ECEF avec REFRAME, plus fallback local;
- intégration optionnelle de `swissBUILDINGS3D` via `3d-tiles-renderer`;
- transformation du tileset ECEF vers le repère local est/up/sud centré sur la gare;
- boutons `relief` et `bâtiments 3D` ajoutés dans `le-muids-3d.html`.

Endpoint bâtiments:
`https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json`

## À valider visuellement
- orientation et alignement horizontal des bâtiments 3D;
- alignement vertical swissBUILDINGS3D / terrain local;
- relief suffisamment lisible sans exagération;
- continuité de la Route cantonale dans les passages inférieurs;
- absence de clipping ou de chargement excessif des 3D Tiles.

## Limites restantes
- les tunnels ne percent pas encore physiquement le terrain: la route descend sous la surface et des volumes bleus servent encore de repères;
- les bâtiments 3D sont encore rendus dans leur style officiel, pas encore stylisés façon diorama;
- aucune végétation officielle 3D n'est chargée;
- la couche fiction reste ajustable dans `layout-fiction-editor.html`.

## Prochaine action
Tester `le-muids-3d.html` avec `bâtiments 3D` activé. Si l'alignement est bon, passer à la stylisation des bâtiments et à la vraie géométrie de tunnels; sinon corriger d'abord le transform ECEF -> local.


## Prototype 3D LV95 v0.3 — corrections après retour utilisateur
Décisions et changements:
- la boucle ferroviaire n'est plus entièrement fictive;
- le code détecte la voie swissTLM3D la plus pertinente autour de la gare, recolle les segments officiels connectés, extrait ~360 m autour de la gare puis greffe le reste de la grande boucle fictive dessus;
- le train circule donc sur un vrai tronçon ferroviaire au passage de la gare puis continue sur la boucle ajoutée;
- arrêt en gare réintroduit (~4,5 s);
- les marqueurs bleus de tunnel sont supprimés du rendu normal;
- l'ancien polygone jaune de route intérieure n'est plus rendu dans la scène 3D: il reste seulement comme donnée de conception tant qu'on ne l'a pas reconstruit proprement depuis les routes officielles;
- les routes officielles ne sont plus artificiellement abaissées autour de tous les points tunnel: la Route cantonale reste entièrement visible tant qu'un vrai système de tunnel n'est pas construit;
- swissBUILDINGS3D est maintenant activé par défaut;
- la couche de végétation officielle swisstopo 3D est ajoutée et activée par défaut;
- correction du winding du maillage terrain: le dessus texturé du terrain fait désormais face à la caméra et ne doit plus être masqué par le socle brun.

## À tester sur v0.3
1. vérifier que le train suit bien la vraie voie autour de la gare avant de rejoindre la boucle;
2. vérifier que les maisons officielles apparaissent et sont correctement alignées;
3. vérifier que les arbres/végétation apparaissent;
4. vérifier que la Route cantonale reste continue/visible;
5. vérifier que le terrain texturé officiel est visible au-dessus du socle brun.

## Prochaine étape
Après validation visuelle de v0.3:
- reconstruire automatiquement la route intérieure en s'appuyant d'abord sur les rues officielles, puis ajouter seulement les raccords fictifs nécessaires;
- construire deux vrais passages inférieurs de la Route cantonale (géométrie + masquage/percement du terrain), sans marqueurs de debug visibles;
- styliser maisons et végétation vers l'esthétique diorama.


## Prototype 3D LV95 v0.4 — recadrage corrigé
Diagnostic du retour utilisateur:
- la bbox précédente couvrait ~1.4 km × 0.9 km, beaucoup trop large par rapport à la vue de référence du village (~0.5 km × 0.3 km);
- cela plaçait visuellement la gare trop près du centre au lieu de la laisser à gauche;
- swissBUILDINGS3D et la végétation chargeaient au-delà du plateau, donnant l'impression que les couches étaient décalées;
- le fond cadastral beige rendait la scène difficile à comparer avec la capture satellite.

Corrections:
- bbox resserrée à `[2505955,1145355,2506460,1145650]` (~505 × 295 m);
- caméra et cible calculées depuis cette bbox: gare à gauche, village à droite;
- fond 3D remplacé par swissIMAGE (orthophoto officielle);
- boucle ferroviaire reconstruite: ~210 m de vraie voie autour de la gare puis boucle uniquement à droite;
- swissBUILDINGS3D et végétation 3D sont découpés par 4 plans de clipping sur les limites de la scène;
- sampling du relief réécrit en profils horizontaux 17×11 pour éviter le fallback plat;
- fallback altitude gare fixé à 715 m;
- plan officiel 2D recadré sur la même bbox et sur swissIMAGE;
- éditeur manuel retiré du workflow et redirigé vers le prototype 3D.

## À tester sur v0.4
- gare visuellement à gauche;
- boucle train ne part plus à gauche de la gare;
- orthophoto comparable à la capture utilisateur;
- maisons/arbres limités au plateau;
- relief non nul dans le statut;
- voies officielles et bâtiments correctement alignés.
