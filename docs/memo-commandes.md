# Mémo Pulse – les commandes dans l'ordre

> À garder à côté de votre clavier. Tapez la commande dans Claude Code, puis laissez-vous guider.

## 1. Démarrer

| Commande | Ce qu'elle fait | Vous obtenez |
|---|---|---|
| `/pulse:init` | Prépare le dossier du projet, puis vous dit où vous en êtes et quoi faire ensuite | Les fichiers de base, la mémoire et l'historique Git |

## 2. Décrire (sans technique)

| Commande | Ce qu'elle fait | Vous obtenez |
|---|---|---|
| `/pulse:brainstorm` | Vous fait réfléchir à votre idée : quelques questions essentielles, auxquelles vous répondez avec vos mots (avec des exemples), puis des questions rapides à choix ; raconte enfin votre outil comme une histoire | `docs/brief.md` et le glossaire |
| `/pulse:prd` | Trie les fonctionnalités : Indispensable / Essentiel / Optionnel / En attente | `docs/prd.md` et votre **MVP** |
| `/pulse:tech` | Choisit les outils adaptés à votre besoin, en comparant 2 ou 3 options | `docs/technical.md` |
| `/pulse:ui identite` | (Facultatif) Vous montre 2 ou 3 apparences possibles pour votre outil ; vous choisissez. À faire avant les user stories : specs et plans s'y conformeront | `docs/design.md` |
| `/pulse:us` | Découpe le besoin en epics et écrit les user stories : « En tant que… je souhaite… afin de… » | `docs/user-stories.md` (le référentiel) et un fichier par US : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` |

## 3. Préparer la construction

| Commande | Ce qu'elle fait | Vous obtenez |
|---|---|---|
| `/pulse:spec US-001` ou `/pulse:spec "…"` | Décrit écrans, données, sécurité pour cette user story (une spec par US) ou pour votre demande | `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` |
| `/pulse:ui maquettes US-001` | (Facultatif) Dessine 2 à 4 versions de vos écrans, à comparer dans le navigateur | `docs/design/maquettes/US-XXX-<nom>/` |
| `/pulse:plan US-001` | Découpe la spec de l'US en petites tâches T1, T2… (un plan par spec) | `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` (votre kanban) et `docs/guide/` (votre carnet de route) |
| `/pulse:refine US-001 "…"` | Change le plan selon vos remarques, après vous avoir montré ce qui change | le plan mis à jour |

## 4. Construire, tâche par tâche

| Commande | Ce qu'elle fait |
|---|---|
| `/pulse:implement US-001 T3` | Réalise **une** tâche et vous explique le code, via un assistant spécialisé ou directement devant vous : on vous demande (sans `T3` : tout le plan, chaque tâche réalisée, relue, corrigée puis enregistrée avant la suivante) |
| `/pulse:review` | Un relecteur indépendant vérifie ; **vous testez** ; on corrige |
| `/pulse:commit` | Enregistre la version (une « photo » du projet), un sujet par photo ; `/pulse:commit push` l'envoie aussi en ligne |

🔁 Recommencez pour chaque tâche. Ou laissez `/pulse:spirc US-001` enchaîner : des assistants réalisent, relisent et vérifient ; il s'arrête pour votre accord et c'est vous qui testez.
Astuce : `/pulse:spirc US-001 "ajouter un filtre par date"` ajoute une demande précise au plan de l'US (ou crée une nouvelle US si c'est un nouveau besoin) et la traite de bout en bout.
Sans argument, chaque commande vous montre les specs ou les plans existants et vous demande lequel choisir.

🌿 En équipe ou pour tester avant de publier : `/pulse:pr branche US-001` avant de construire (une copie de travail), puis `/pulse:pr` pour proposer la fusion (une demande relisible, souvent avec une adresse de prévisualisation).

🪟 Deux sessions Claude Code en même temps sur le même projet : lancez `/pulse:implement US-002` ou `/pulse:spirc US-002` dans la deuxième. Pulse voit l'autre session et vous propose un **worktree**, une deuxième copie du projet sur sa propre branche, puis rassemble le travail à la fin.

## 5. Mettre en ligne

| Commande | Ce qu'elle fait |
|---|---|
| `/pulse:cicd` | (Facultatif, conseillé) Un contrôle qualité automatique à chaque envoi et sur chaque demande de fusion : une croix rouge vous prévient avant que l'erreur n'arrive sur le site |
| `/pulse:deploy` | Première fois : dépôt en ligne + hébergeur choisis avec `/pulse:tech`. Ensuite : chaque envoi met le site à jour tout seul |
| `/pulse:deploy production` | Prépare le site « pour de vrai » : variables, services connectés, retour arrière (et la CI avec `/pulse:cicd` si elle manque) |

## À tout moment

| Commande | Quand l'utiliser |
|---|---|
| `/pulse:status` | « Où en suis-je ? Que faire maintenant ? » |
| `/pulse:explain app.js` | « Je ne comprends pas ce code » |
| `/pulse:learn les fonctions` | « Je veux apprendre une notion de programmation » (aussi : `feynman <notion>`, `exercice <notion>`, `parcours "<objectif>"` ; sans argument : réviser) |
| `/pulse:security` | « Mon appli est-elle bien protégée ? » (`rapide` pour un contrôle en 2 minutes) |
| `/pulse:ui audit` puis `/pulse:ui polish` | « Mon interface est-elle soignée, lisible, cohérente ? » |
| `/pulse:auto-fix` | « Il y a des erreurs rouges dans le code » |
| `/pulse:fix "…"` | « J'ai une erreur » ou « ce bouton ne marche pas » |
| `/pulse:guide` | « Quelle commande je tape maintenant ? » (ouvrez aussi `docs/guide/index.md`) |
| `/pulse:memory retenir "…"` | « Je veux que l'IA s'en souvienne la prochaine fois » |

## Les 4 réflexes

1. **Une tâche à la fois.** Petit, testé, enregistré.
2. **C'est vous qui testez.** L'IA propose, vous validez.
3. **Jamais de vraie donnée ni de vraie clé** dans la conversation ou dans le code.
4. **« Si ce n'est pas interdit côté serveur, c'est autorisé. »**
