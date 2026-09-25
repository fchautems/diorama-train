# PROJECT_STATE

Dernière mise à jour: 2026-09-25

## État vérifié
- Dépôt `fchautems/diorama-train`.
- Runtime: Three.js/WebGL dans le navigateur.
- Direction: diorama ferroviaire low-poly / maquette miniature.
- v0.2 a été testée visuellement par l'utilisateur. Retours principaux: PNJ qui reculent et traversent librement, voie trop épaisse/bizarre, brouillard inutile, montagnes trop grandes et hors plateau, arbres parfois sur la voie, végétation trop pauvre.

## Changements v0.3
- Suppression complète du brouillard.
- Plateau agrandi pour donner plus d'espace de composition.
- Voie entièrement refaite:
  - ballast plat en ruban, plus de gros tube gris ;
  - deux rails métalliques fins ;
  - 132 traverses.
- Train conservé avec locomotive + 2 wagons.
- Ajout d'un comportement ferroviaire: ralentissement, arrêt de 4,5 s en gare, puis redémarrage.
- PNJ:
  - suppression des trajectoires libres autour de centres arbitraires ;
  - création de 3 chemins/splines dédiés et visibles ;
  - 4 promeneurs restent sur ces chemins ;
  - 1 cinquième personnage reste à la gare ;
  - correction de l'orientation: suppression du retournement de 180° qui les faisait marcher à reculons.
- Vaches confinées à une spline fermée à l'intérieur du pâturage.
- Végétation:
  - ajout du Kenney Nature Kit CC0 ;
  - chêne, pin, arbre haut, buisson, herbe et rocher ajoutés au dépôt ;
  - environ 36 arbres, 34 buissons et 115 touffes d'herbe placés de façon déterministe ;
  - zones d'exclusion autour des voies, chemins, bâtiments, étang et pâturage.
- Relief:
  - retrait des grands cônes montagneux ;
  - remplacement par une ligne de collines low-poly plus basses, intégrées au fond de la maquette.
- Nuages refaits avec des formes low-poly plus plates.
- Gare enrichie avec bancs et lampadaires ; les lampes s'allument en mode nuit.
- Le lanceur Windows `START_DIORAMA.bat` reste le point d'entrée.

## Choix technique PNJ / collisions
Pas de moteur de physique ni de navmesh à ce stade. Les personnages suivent des chemins explicites. Pour un diorama observé de l'extérieur, cette méthode garantit qu'ils restent sur les zones prévues sans introduire une simulation plus lourde.

## Assets ajoutés en v0.3
Kenney Nature Kit, CC0:
- `tree_oak.glb`
- `tree_pineRoundC.glb`
- `tree_tall.glb`
- `plant_bushDetailed.glb`
- `grass_large.glb`
- `rock_largeC.glb`

## À vérifier visuellement
- Sens réel des personnages après retrait du yaw +180°.
- Sens de la locomotive et écart entre wagons dans les courbes.
- Qualité visuelle du nouveau ballast plat.
- Placement des arbres/buissons/herbes par rapport aux rails et bâtiments.
- Taille du nouveau relief de fond.
- Arrêt du train en gare et reprise après 4,5 s.
- Charge/performance de la végétation sur la machine cible.

## Bâtiments
Les maisons actuelles restent des modèles complets du Kenney City Kit (Suburban). Si la prochaine passe demande plus de variété architecturale, privilégier Kenney Modular Buildings plutôt que des bâtiments procéduraux grossiers.

## Prochaine action
Lancer v0.3 via `START_DIORAMA.bat`, faire une nouvelle passe visuelle, puis corriger uniquement les défauts constatés avant d'ajouter de nouveaux événements.
