# Mémo Pulse – les commandes dans l'ordre

> À garder à côté de votre clavier. Tapez la commande dans Claude Code, puis laissez-vous guider.

## 1. Démarrer

| Commande | Ce qu'elle fait | Vous obtenez |
|---|---|---|
| `/pulse:init` | Prépare le dossier du projet, puis vous dit où vous en êtes et quoi faire ensuite | Les fichiers de base, la mémoire et l'historique Git |
| `/pulse:express` | ⚡ Pour démarrer vite : en une conversation, votre idée, vos écrans, l'apparence et vos contraintes ; puis les outils et 2 apparences à comparer. Remplace la partie 2 ci-dessous | Tous les documents de la partie 2, et une première US prête à réaliser |

## 2. Décrire (sans technique)

| Commande | Ce qu'elle fait | Vous obtenez |
|---|---|---|
| `/pulse:brainstorm` | Vous fait réfléchir à votre idée : quelques questions essentielles, auxquelles vous répondez avec vos mots (avec des exemples), puis des questions rapides à choix ; raconte enfin votre outil comme une histoire | `docs/brief.md` et le glossaire |
| `/pulse:prd` | Trie les fonctionnalités : Indispensable / Essentiel / Optionnel / En attente | `docs/prd.md` et votre **MVP** |
| `/pulse:tech` | Choisit les outils adaptés à votre besoin, en comparant 2 ou 3 options (dont une pile Pulse prête à l'emploi si elle est installée), et peut mettre en ligne une page de départ dès aujourd'hui | `docs/technical.md` |
| `/pulse:ui identite` | (Facultatif) Vous montre 2 ou 3 apparences possibles pour votre outil ; vous choisissez. À faire avant les user stories : specs et plans s'y conformeront | `docs/design.md` |
| `/pulse:us` | Découpe le besoin en epics et écrit les user stories : « En tant que… je souhaite… afin de… », 3 questions au plus par ronde ; chaque US vérifiée (INVEST, prête à spécifier), triée par ordre de réalisation, enregistrée après votre accord | `docs/user-stories.md` (le référentiel) et un fichier par US : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` |

## 3. Préparer la construction

| Commande | Ce qu'elle fait | Vous obtenez |
|---|---|---|
| `/pulse:spec US-001` ou `/pulse:spec "…"` | Décrit ce que l'utilisateur obtient pour cette user story (une spec par US) ou pour votre demande : écrans, informations, règles, hors objectifs ; chaque inconnue notée `TBD:` ; verrouillée une fois validée | `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` |
| `/pulse:ui maquettes US-001` | (Facultatif) Dessine 2 à 4 versions de vos écrans, à comparer dans le navigateur | `docs/design/maquettes/US-XXX-<nom>/` |
| `/pulse:plan US-001` | Décide comment construire la spec (pile, données, sécurité, fichiers), puis la découpe en petites tâches T1, T2… (un plan par spec) | `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` (votre tableau de tâches) et `docs/guide/` (votre carnet de route) |
| `/pulse:refine US-001 "…"` | Change le plan selon vos remarques, après vous avoir montré ce qui change | le plan mis à jour |

## 4. Construire, tâche par tâche

| Commande | Ce qu'elle fait |
|---|---|
| `/pulse:implement US-001 T3` | Réalise **une** tâche et vous explique le code, en coulisse ou devant vous : on vous demande (sans `T3` : tout le plan, chaque tâche réalisée, relue, corrigée puis enregistrée avant la suivante) |
| `/pulse:review` | Deux assistants indépendants relisent et essaient la tâche en marche ; **vous testez** ; on corrige |
| `/pulse:commit` | Enregistre la version (une « photo » du projet), un sujet par photo ; `/pulse:commit push` l'envoie aussi en ligne, après votre accord |

🔁 Recommencez pour chaque tâche. Ou laissez `/pulse:spirc US-001` enchaîner : des assistants réalisent, relisent et vérifient ; il s'arrête pour votre accord et c'est vous qui testez.
Astuce : `/pulse:spirc US-001 "ajouter un filtre par date"` ajoute une demande précise au plan de l'US (ou crée une nouvelle US si c'est un nouveau besoin) et la traite de bout en bout.
Sans argument, chaque commande vous montre les specs ou les plans existants et vous demande lequel choisir.

🧭 Profil « Jamais programmé » : `/pulse:implement` et `/pulse:spirc` prennent les réglages conseillés sans vous poser de questions techniques ; dites-le si vous préférez autre chose.

🌿 En équipe ou pour tester avant de publier : au démarrage de `/pulse:implement` ou `/pulse:spirc`, choisissez « Une version parallèle pour l'US, publiée quand vous l'acceptez sur le site du dépôt » : Pulse prépare la version parallèle et sa proposition (relisible sur le site du dépôt, souvent avec une adresse de prévisualisation). `/pulse:pr` permet aussi de le faire à la main.

🪟 Deux sessions Claude Code en même temps sur le même projet : lancez `/pulse:implement US-002` ou `/pulse:spirc US-002` dans la deuxième. Pulse voit l'autre session et vous propose un **dossier à part** du projet (un worktree), sur sa propre version parallèle, puis rassemble le travail à la fin.

## 5. Mettre en ligne

| Commande | Ce qu'elle fait |
|---|---|
| `/pulse:cicd` | (Facultatif, conseillé) Un contrôle qualité automatique à chaque envoi et sur chaque demande de fusion : une croix rouge vous prévient avant que l'erreur n'arrive sur le site ; un contrôle des clés secrètes protège aussi chaque enregistrement |
| `/pulse:deploy` | Première fois : dépôt en ligne + hébergeur choisis avec `/pulse:tech`. Ensuite : chaque envoi met le site à jour tout seul. Avant la première fois : tests et contrôle rapide de sécurité. Chaque fois, Pulse vérifie que le site répond vraiment et reste visible pour Google |
| `/pulse:deploy production` | Prépare le site « pour de vrai » : variables, services connectés, retour arrière (et la CI avec `/pulse:cicd` si elle manque) |
| `/pulse:search-console relier` | Une fois le site en ligne : prouver à Google (et à Bing) que le site est à vous, déclarer son plan (sitemap). Une seule fois |
| `/pulse:search-console` | Tous les 28 jours : ce que Google voit de votre site (combien de fois il le montre, les mots tapés, les pages oubliées) et 3 actions. Sans secret : vous exportez un fichier, Pulse le lit |

## À tout moment

| Commande | Quand l'utiliser |
|---|---|
| `/pulse:status` | « Où en suis-je ? Que faire maintenant ? » (même calcul que `/pulse:init`) |
| `/pulse:explain app.js` | « Je ne comprends pas ce code » |
| `/pulse:learn les fonctions` | « Je veux apprendre une notion de programmation » (aussi : `feynman <notion>`, `exercice <notion>`, `parcours "<objectif>"` ; sans argument : réviser) |
| `/pulse:security` | « Mon appli est-elle bien protégée ? » (`rapide` pour un contrôle en 2 minutes) |
| `/pulse:secrets` | « Où sont mes clés ? » ; `renouveler <NOM>` pour changer une clé sans couper le site ; `fuite` dès qu'une clé a été vue (dépôt, conversation, écran) : on la révoque d'abord |
| `/pulse:seo` | « Mon site est-il trouvable sur Google et par les assistants IA ? » (`bases`, `textes`, `ia`, `lancer`) |
| `/pulse:rediger accueil` | « Je veux le texte de ma page, dans la voix du site, sans tics d'IA » (`--humaniser` : réécrire un texte existant) |
| `/pulse:perf` | « Mon site est-il rapide pour mes visiteurs ? » (`corriger` : améliorer, avec un avant/après chiffré ; `suivre` : vrais visiteurs et vérification chaque semaine) |
| `/pulse:ui audit` puis `/pulse:ui polish` | « Mon interface est-elle soignée, lisible, cohérente ? » |
| `/pulse:auto-fix` | « Il y a des erreurs rouges dans le code » |
| `/pulse:test` | « Mes tests automatiques passent-ils ? » (`ecrire US-003` : ajouter les tests d'un code déjà fait) |
| `/pulse:fix "…"` | « J'ai une erreur » ou « ce bouton ne marche pas » |
| `/pulse:annuler` | « Je veux revenir en arrière » : rien n'est perdu, tout se récupère |
| `/pulse:get-help` | « Je suis bloqué » : une demande d'aide prête à envoyer, sans vos secrets |
| `/pulse:guide` | « Quelle commande je tape maintenant ? » (ouvrez aussi `docs/guide/index.md`) |
| `/pulse:memory retenir "…"` | « Je veux que l'IA s'en souvienne la prochaine fois » |
| `/pulse:memory compacter` | « Pulse me dit que la mémoire est presque pleine » |

## Les 4 réflexes

1. **Une tâche à la fois.** Petit, testé, enregistré.
2. **C'est vous qui testez.** L'IA propose, vous validez.
3. **Jamais de vraie donnée ni de vraie clé** dans la conversation ou dans le code.
4. **« Si ce n'est pas interdit côté serveur, c'est autorisé. »**

⚙️ Avec le pack **pulse-next** installé, `/pulse:tech` vous propose une pile Next.js prête à l'emploi : un projet de départ vérifié, et des recettes (connexion, listes, e-mails, fichiers, paiement, langues, limite) que la spec et le plan reprennent pour vous.

🔒 Si Pulse refuse une commande ou vous demande votre accord (« Pulse demande votre accord… »), c'est son garde-fou : il protège votre travail, vos données et votre site. Lisez la raison, puis acceptez seulement si vous comprenez ce qui va se passer.
