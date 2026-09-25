# diorama-train

Petit diorama ferroviaire 3D interactif pour le navigateur, basé sur Three.js.

## Lancer sous Windows

Double-cliquer sur **`START_DIORAMA.bat`**.

Le lanceur démarre automatiquement un petit serveur local sur le port 8000 puis ouvre :

`http://localhost:8000`

Fermer la fenêtre du serveur pour arrêter le diorama.

## Scène actuelle — v0.3

Cette version remplace la logique de "démo d'objets posés sur un disque" par une scène structurée :

- plateau elliptique agrandi ;
- boucle ferroviaire refaite : ballast plat, deux rails fins et traverses ;
- locomotive + 2 wagons ;
- ralentissement et arrêt automatique du train en gare pendant 4,5 s ;
- quai, bancs et lampadaires ;
- 5 personnages, dont 4 promeneurs et 1 personnage à la gare ;
- les promeneurs suivent désormais des chemins définis et visibles au lieu de traverser librement la scène ;
- pâturage avec 3 vaches Quaternius ;
- étang ;
- relief bas intégré au fond de la maquette à la place des grands cônes montagneux ;
- ciel sans brouillard ;
- nuages low-poly mobiles ;
- 36 arbres environ, avec plusieurs formes provenant du Kenney Nature Kit ;
- buissons, touffes d'herbe et rochers low-poly ;
- zones d'exclusion autour des rails, chemins, bâtiments et étang pour éviter la végétation mal placée ;
- bascule jour/nuit avec lampes de gare ;
- pause et remise à zéro de la caméra.

## Choix techniques

- **Three.js/WebGL** reste le runtime.
- Pas de moteur physique pour les PNJ : pour un diorama observé de l'extérieur, ils suivent des splines/pathways. C'est plus simple et plus déterministe qu'une simulation de collisions.
- La végétation est placée de manière déterministe avec des zones interdites autour des éléments critiques.
- Les bâtiments actuels viennent du **Kenney City Kit (Suburban)** et sont des bâtiments complets.
- Si l'on veut ensuite composer les façades et volumes nous-mêmes, le candidat naturel est **Kenney Modular Buildings**.

## Assets

Voir `assets/ATTRIBUTION.md` et `assets/asset-manifest.json` pour les sources et licences.
