# PROJECT_STATE

Dernière mise à jour: 2026-09-25

## État actuel
- Runtime 3D existant: Three.js/WebGL.
- La v0.4 du diorama animé reste disponible et inchangée.
- Nouvelle direction validée: reconstruire un Le Muids schématisé mais structurellement fidèle avant de refaire la scène 3D.
- Le générateur d'images n'est plus utilisé pour décider de la géométrie.

## Nouveau pipeline cartographique
Une géométrie 2D unique devient la source de vérité pour la future 3D:

`référence aérienne -> tracé vectoriel -> data/le_muids_layout_v01.json -> vue debug 2D -> future scène Three.js`

### Couche réelle
Le fichier `data/le_muids_layout_v01.json` contient, en coordonnées pixels de la capture de référence (1412×792):
- Route cantonale;
- Chemin de la Pétoilière / accès gare;
- Chemin de la Grange;
- Rue des Jotins;
- Chemin des Reliantes;
- Rue de l'Ancienne Poste;
- portion de voie ferrée réelle à la gare;
- premiers contours de bâtiments;
- premiers contours de jardins/parcelles visibles.

Ces tracés sont issus directement de la capture satellite fournie par l'utilisateur. Ils ne sont pas générés par modèle d'image.

### Couche fiction diorama
Séparée explicitement de la géométrie réelle:
- `rail_loop`: future boucle ferroviaire extérieure;
- `inner_road_loop`: route intérieure partant de la gare, reprenant la Pétoilière puis bouclant dans le village et le long des voies;
- quatre passages inférieurs où la Route cantonale doit descendre sous:
  - le train au nord;
  - la route intérieure au nord;
  - la route intérieure au sud;
  - le train au sud.

En 3D, la Route cantonale sera abaissée sur Y dans ces zones; les deux boucles restent au niveau du terrain.

## Outil de validation
- `layout-debug.html` affiche exactement les données du JSON.
- La capture satellite n'est pas commitée dans le dépôt.
- L'utilisateur peut charger localement sa capture dans l'outil et superposer:
  - réel;
  - fiction;
  - bâtiments/jardins;
  - opacité du fond.
- Cela permet de corriger la géométrie sans redessiner un SVG/PNG à chaque itération.

## État de précision v0.1
- Les grandes routes et la topologie sont tracées.
- Les bâtiments/jardins sont une première passe à valider et à affiner.
- Les boucles fictives sont une proposition structurelle; elles doivent être validées avant conversion 3D.
- Le but immédiat n'est pas l'esthétique mais l'alignement géométrique.

## Prochaine action
Faire valider la superposition v0.1 sur la capture satellite. Corriger les points de contrôle jusqu'à accord sur la structure, puis brancher ce même JSON comme source de coordonnées X/Z dans Three.js.
