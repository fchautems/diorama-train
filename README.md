# diorama-train

Petit diorama ferroviaire 3D interactif pour le navigateur, basé sur Three.js.

## Lancer sous Windows

Double-cliquer sur **`START_DIORAMA.bat`**.

Le lanceur démarre automatiquement un petit serveur local sur le port 8000 puis ouvre :

`http://localhost:8000`

Fermer la fenêtre du serveur pour arrêter le diorama.

## Prototype Le Muids géoréférencé v0.2

Une nouvelle branche fonctionnelle du projet utilise les vraies coordonnées LV95 de swisstopo.

Pages utiles :

- `layout-official.html` — réseau réel uniquement, issu de swisstopo ;
- `layout-fiction-editor.html` — édition de notre boucle ferroviaire, route intérieure et passages inférieurs sur la base officielle ;
- `le-muids-3d.html` — premier prototype Three.js qui projette les données LV95 dans une scène locale, affiche le fond officiel, les routes/voies réelles, la couche fictive et un train animé.

Le prototype 3D utilise maintenant un **relief réel** :
- maillage terrain construit depuis le service d'altitude swisstopo, en LV95 ;
- texture officielle AV projetée sur le relief ;
- routes/rails réels suivent le terrain ;
- la Route cantonale est abaissée autour des 4 passages inférieurs prévus ;
- swissBUILDINGS3D peut être activé depuis l'interface ;
- les bâtiments officiels sont reprojetés d'ECEF vers le repère local centré sur la gare ;
- les tunnels ne sont pas encore réellement creusés dans le maillage, mais la géométrie routière descend déjà sous les croisements.

## Scène actuelle — v0.4

Passe corrective basée sur les captures de v0.3 :

- rendu moins délavé : tone mapping neutre, lumière ambiante mieux répartie et palette du terrain plus soutenue ;
- matériaux Nature Kit légèrement rehaussés pour éviter les végétaux presque noirs ;
- suppression de la grande place ovale centrale qui se superposait aux chemins ;
- chemins piétons un peu plus étroits et placés à des hauteurs légèrement différentes pour éviter le z-fighting aux croisements ;
- enclos des vaches déplacé à l'intérieur de la boucle ferroviaire et refait avec des rails continus : les quatre côtés sont fermés ;
- vaches accélérées et animation `walk` prioritaire pour que le déplacement soit réellement visible ;
- suppression des gros reliefs/rochers qui donnaient un paysage de blocs ;
- remplacement du fond par une ligne d'arbres et seulement quelques petits rochers discrets ;
- végétation un peu moins dense pour améliorer la lisibilité ;
- arrêt du train décalé d'environ 4,2 m afin de mieux aligner la locomotive sur le quai ;
- personnage statique de la gare remplacé par un petit trajet aller-retour sur le quai ;
- le lanceur Windows `START_DIORAMA.bat` reste inchangé.

## Choix techniques

- **Three.js/WebGL** reste le runtime.
- Pas de moteur physique pour les PNJ : pour un diorama observé de l'extérieur, ils suivent des splines/pathways. C'est plus simple et plus déterministe qu'une simulation de collisions.
- La végétation est placée de manière déterministe avec des zones interdites autour des éléments critiques.
- Les bâtiments actuels viennent du **Kenney City Kit (Suburban)** et sont des bâtiments complets.
- Si l'on veut ensuite composer les façades et volumes nous-mêmes, le candidat naturel est **Kenney Modular Buildings**.

## Assets

Voir `assets/ATTRIBUTION.md` et `assets/asset-manifest.json` pour les sources et licences.


### v0.5 — géométrie ferroviaire propre

- tronçon réel conservé autour de la gare;
- raccords tangents et progressifs vers la boucle fictive;
- boucle repoussée vers la périphérie droite;
- corridor ferroviaire fictif de sécurité;
- bâtiments/végétation officiels masqués automatiquement s'ils tombent dans ce corridor ou hors du plateau;
- clipping bas pour limiter les objets sous le socle;
- réseau officiel coupé aux limites de la scène;
- route intérieure provisoire toujours masquée jusqu'à reconstruction depuis les routes officielles.


### v0.5.2 — validation screenshot

Cette version est la première dont le contrôle avant livraison vérifie réellement le rendu:
- Playwright attend des bâtiments et arbres visibles au-dessus du terrain;
- deux screenshots sont produits (perspective + dessus);
- raccords rail réel/fictif mesurés automatiquement;
- alignement vertical swissBUILDINGS3D/terrain corrigé automatiquement;
- boucle resserrée autour d'environ 116 m de vraie voie puis envoyée vers la périphérie droite.
