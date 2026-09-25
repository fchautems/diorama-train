# diorama-train

Petit diorama ferroviaire 3D interactif pour le navigateur, basé sur Three.js.

## Lancer sous Windows

Double-cliquer sur **`START_DIORAMA.bat`**.

Le lanceur démarre automatiquement un petit serveur local sur le port 8000 puis ouvre :

`http://localhost:8000`

Fermer la fenêtre du serveur pour arrêter le diorama.

## Scène actuelle — v0.2

- grand plateau de diorama elliptique ;
- boucle ferroviaire complète avec rails, ballast et traverses ;
- locomotive + 2 wagons qui tournent en continu ;
- petite gare/quai et plusieurs bâtiments Kenney ;
- arbres répartis dans la scène ;
- 4 petits personnages animés qui se promènent ;
- pâturage avec 3 vaches Quaternius animées ;
- étang ;
- montagnes low-poly avec sommets enneigés ;
- ciel en dégradé et nuages animés ;
- bascule jour/nuit, pause et remise à zéro de la caméra.

## Direction visuelle

- Low-poly premium / maquette miniature.
- Priorité aux assets existants cohérents plutôt qu'à la géométrie procédurale.
- Base artistique principale : packs 3D Kenney CC0.
- Les animaux Quaternius CC0 sont acceptés lorsqu'ils restent visuellement compatibles.
- Échelle de scène : 1 unité Three.js ≈ 1 mètre.

## Assets

Voir `assets/ATTRIBUTION.md` et `assets/asset-manifest.json` pour les sources et licences.

Les maisons actuelles viennent du **Kenney City Kit (Suburban)** : ce sont surtout des bâtiments prêts à l'emploi. Pour une phase ultérieure, Kenney propose aussi un **Modular Buildings** kit si l'on veut composer les façades/volumes nous-mêmes.
