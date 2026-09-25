# PROJECT_STATE

Dernière mise à jour: 2026-09-25

## État vérifié
- Dépôt `fchautems/diorama-train`.
- Runtime: Three.js/WebGL dans le navigateur.
- Direction: diorama ferroviaire low-poly / maquette miniature.
- v0.3 a été testée visuellement par l'utilisateur.
- Retours v0.3: couleurs trop délavées, enclos des vaches partiellement sur la voie et visuellement ouvert, vaches semblant faire du sur-place, z-fighting/superposition au centre du village, gros reliefs/rochers peu convaincants, train arrêté un peu trop tôt, personnage de gare mal orienté/statiquement coincé.

## Changements v0.4
- Rendu:
  - passage de ACES Filmic à Neutral Tone Mapping ;
  - exposition jour portée à 1.08 ;
  - ajout d'une lumière ambiante douce ;
  - rééquilibrage Hemisphere/Directional Light ;
  - terrain légèrement plus saturé ;
  - matériaux Nature Kit légèrement rehaussés en saturation/luminosité avec plancher de luminosité pour éviter les végétaux presque noirs.
- Centre du village:
  - suppression de la grande place ovale ;
  - chemins réduits à 0.88 m de large ;
  - faible décalage vertical différent par chemin pour supprimer le z-fighting aux croisements.
- Pâturage:
  - déplacement vers `x=23, z=0.6`, entièrement à l'intérieur de la boucle ;
  - dimensions ~9 × 7.2 m ;
  - clôture reconstruite avec quatre rails continus et poteaux réguliers, donc visuellement fermée ;
  - trajectoire des vaches déplacée dans ce nouvel enclos.
- Vaches:
  - priorité explicite au clip `walk` ;
  - mixer accéléré à 1.15× ;
  - vitesse de déplacement environ doublée pour rendre le mouvement perceptible.
- Paysage:
  - suppression des gros reliefs arrondis ;
  - réduction forte de la taille/nombre des rochers ;
  - ajout d'une ligne d'arbres de fond à la place ;
  - végétation réduite à ~30 arbres, ~24 buissons et ~82 touffes d'herbe pour alléger la scène.
- Gare:
  - cible d'arrêt du train avancée de ~4.2 m pour mieux aligner la locomotive sur le quai ;
  - personnage statique supprimé ;
  - ajout d'un personnage qui fait un petit aller-retour sur le quai.
- Jour/nuit ajusté au nouveau schéma d'éclairage.
- `START_DIORAMA.bat` reste le point d'entrée.

## Choix technique maintenu
Pas de moteur physique ni de navmesh à ce stade. Les personnages et animaux suivent des splines contrôlées. C'est adapté à un diorama observé de l'extérieur et évite la complexité d'une navigation dynamique tant qu'elle n'est pas nécessaire.

## Assets
Aucun nouvel asset externe ajouté en v0.4. Les assets existants restent ceux documentés dans `assets/ATTRIBUTION.md`.

## À vérifier visuellement
- Saturation/couleurs: plus vives sans être criardes.
- Absence de clignotement au centre du village.
- Enclos entièrement fermé et nettement séparé de la voie.
- Déplacement visible des vaches.
- Arrêt de la locomotive correctement aligné au quai.
- Personnage de quai correctement orienté pendant son aller-retour.
- Fond végétal plus naturel que les anciens gros blocs.
- Aucun arbre/buisson/herbe sur les rails.

## Bâtiments
Les maisons actuelles restent des modèles complets du Kenney City Kit (Suburban). Une future passe peut tester Kenney Modular Buildings pour introduire une gare et des maisons plus variées sans changer de direction artistique.

## Prochaine action
Lancer v0.4 via `START_DIORAMA.bat` et faire une nouvelle passe visuelle ciblée. Ne pas complexifier davantage avant d'avoir vérifié ces corrections.
