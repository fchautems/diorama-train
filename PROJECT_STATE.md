# PROJECT_STATE

Dernière mise à jour: 2026-09-25

## État vérifié
- Dépôt `fchautems/diorama-train`.
- Runtime: Three.js/WebGL dans le navigateur.
- Direction: diorama ferroviaire low-poly / maquette miniature.
- Les premiers assets GLB ont été visuellement validés par l'utilisateur comme une base correcte.

## Changements v0.2
- La simple galerie d'assets a été remplacée par une vraie scène de diorama plus grande.
- Plateau elliptique agrandi.
- Boucle ferroviaire complète générée en Three.js: ballast, 2 rails, 112 traverses.
- Locomotive Kenney + 2 wagons animés sur la boucle.
- Quai et bâtiment de gare.
- 4 bâtiments répartis dans le village en plus de la gare.
- 15 arbres Kenney.
- 4 personnages Kenney qui se déplacent en boucle et jouent une animation disponible (Walk/Run/Idle par préférence).
- Ajout de 3 vaches Quaternius CC0 dans un pâturage clôturé; animations disponibles exploitées.
- Ajout d'un étang, d'une chaîne de montagnes low-poly, d'un ciel en dégradé et de nuages mobiles.
- Commandes UI: pause/reprise, jour/nuit, vue initiale.
- Ajout de `START_DIORAMA.bat`: double-clic sous Windows pour démarrer le serveur local et ouvrir le navigateur.
- Provenance/licences mises à jour.

## Échelle
- Train Kit: locomotive de référence ~5.5 m sur son axe horizontal principal.
- City Kit: bâtiment A de référence ~5.2 m de haut.
- Mini Characters: personnage de référence ~1.72 m.
- Vache Quaternius: ~1.5 m de haut.

## Contrôles effectués
- Syntaxe de `src/main.js` vérifiée avec `node --check`.
- Licence officielle Quaternius Farm Animal Pack: CC0.
- La copie GLB utilisée est accompagnée d'un fichier de provenance qui identifie explicitement la vache Quaternius sous CC0.
- Aucun générateur externe n'est nécessaire pour lancer la scène.

## À vérifier visuellement
- Sens exact de la locomotive sur la spline.
- Distance visuelle entre locomotive et wagons dans les courbes.
- Orientation des personnages/vaches par rapport à leur trajectoire.
- Taille/position des montagnes selon l'angle de caméra.
- Performance sur la machine cible.

## Décision bâtiments
Les bâtiments actuels du Kenney City Kit (Suburban) sont des modèles prêts à l'emploi. Si l'on veut plus de liberté architecturale, passer ultérieurement au Kenney Modular Buildings plutôt que fabriquer des maisons grossières à la main.

## Prochaine action
Lancer `START_DIORAMA.bat`, faire une passe visuelle de v0.2 et corriger en priorité les orientations/proportions évidentes avant d'ajouter davantage de détails.
