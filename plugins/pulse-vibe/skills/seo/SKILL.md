---
description: Être trouvé sur Google et par les assistants IA - audit du site servi, fondations (adresse, titres, sitemap, robots, carte de partage), textes choisis par vous, politique des robots IA, lancement (Search Console, Bing)
argument-hint: "[audit | bases | textes [page] | ia | lancer] (par défaut : audit)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte seo) Bash(pulse-aidd textes *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd seo *) Bash(pulse-aidd sonder *) Bash(pulse-aidd pile seo-code*) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(git status *) Bash(git log *) Read Glob Grep
---

# /pulse:seo – Être trouvé

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte seo`

Appliquer les « Règles communes Pulse », « Référencement : les règles » et « Référencement : assistants IA » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte seo` et lire sa sortie.

Action demandée : `$ARGUMENTS` (vide = `audit`)

## Objectif

Aider la personne à être trouvée par ceux qui cherchent ce qu'elle offre, avec quatre questions, dans l'ordre : Google peut-il **venir** ? peut-il **garder** la page ? comment la page **se présente** ? mérite-t-elle d'être **choisie** ? Phrase à dire : « On vérifie d'abord que Google peut entrer et lire ; ensuite, comment vous vous présentez ; le reste, c'est votre contenu. »

Le script `pulse-aidd seo` lit le site **servi**, comme un robot. Les textes sont **choisis par la personne** et gardés dans `docs/seo.md` (modèle `seo.md`), source unique pour le code.

## Choisir l'action

| Action | Quand | Section |
|---|---|---|
| `audit` (par défaut) | Avant une mise en ligne publique, après une refonte, à chaque rendez-vous de suivi | « audit » |
| `bases` | Une fois, avant la première mise en ligne publique, ou quand l'audit signale des fondations manquantes | « bases » |
| `textes [page]` | Pour chaque page publique dont le contenu est stable | « textes » |
| `ia` | Décider ce que les robots des assistants IA peuvent faire, ou changer d'avis | « ia » |
| `lancer` | Après la mise en ligne sur le domaine définitif | « lancer » |

## Avant toute action

1. Lire `docs/technical.md` (pile, « Commandes du projet », « Hébergement et mise en ligne »), « Être trouvé » de `docs/prd.md` et `docs/seo.md` s'ils existent. Sans `docs/technical.md`, proposer `/pulse:tech`.
2. **Outil interne** (« Être trouvé » répond non, ou bloc `pulse-seo` avec `site: privé`) : le référencement se résume à rester hors de Google. Proposer `ia` avec le choix D, puis `audit` avec `--prive`.
3. **L'adresse à lire** : l'adresse en ligne (« Hébergement et mise en ligne ») ; sinon le serveur local **de production** : lancer la construction, puis le démarrage (« Commandes du projet »), en arrière-plan, et attendre que l'accueil réponde. À la fin, arrêter ce serveur seulement (son numéro de processus), en laissant les autres processus tels quels. Le serveur de développement donne des résultats différents de la production : l'éviter pour l'audit.

## audit

1. **Pages à lire.** Avec un pack de pile : `pulse-aidd pile seo-code --pages` donne les pages publiques fixes. Pages privées : lignes `privee:` de `docs/seo.md`, sinon pages de la connexion d'après les specs.
2. **Lancer** `pulse-aidd seo <adresse> --ia [--chemins <pages>] [--privees <pages privées>] [--previsualisation]`, puis, avec un pack, `pulse-aidd pile seo-code` (contrôles du code). Expliquer en une phrase que les deux sont en lecture seule.
3. **Enregistrer** le rapport dans `docs/seo/audits/seo-<AAAA-MM-JJ>.md` (ajouter `-2`, `-3` si le fichier existe), selon le modèle `seo-audit.md` : constats rangés par les quatre questions, chacun avec sa conséquence concrète et sa correction.
4. **Présenter** en 5 lignes : le bilan, les Critiques et Hautes avec leur conséquence (« Google ne peut pas ouvrir cette adresse, donc… »), ce qui va bien. Pour la quatrième question, poser deux ou trois questions de la référence « textes » (§ 3), sans note.
5. **Traiter** les constats selon les règles communes (§ 6) : une fondation manquante → `bases` ; un titre ou une description → `textes` ; une politique IA absente → `ia` ; une page privée exposée → `/pulse:security` ; l'accessibilité → `/pulse:ui audit`. Avant de corriger du code : `pulse-aidd qualite`. Après correction : relancer `pulse-aidd seo` et remplir « Avant / après » du rapport.

Terminer avec le bloc de fin de commande. Prochaine étape : la première action de traitement, sinon `/pulse:seo lancer` si le site est en ligne sur son domaine définitif.

## bases

Les fondations, posées une fois : adresse du site (variable de production), modèle de titre, description par défaut, robots.txt, sitemap, image de partage, icône, nom du site (`WebSite` sur l'accueil), organisation (`Organization`, ou `LocalBusiness` pour un commerce avec adresse), `noindex` des pages privées, vraie page 404.

1. Avec un pack : suivre sa recette `seo` (`pulse-aidd pile recette seo`). Sans pack : la documentation officielle de la pile, pour chacune des fondations ci-dessus.
2. Montrer la liste des fichiers à créer ou modifier avant d'écrire. Lancer `pulse-aidd qualite` et appliquer ses règles.
3. Créer `docs/seo.md` à partir du modèle `seo.md` s'il manque (bloc `pulse-seo` compris) ; la politique des robots IA reste « à décider » : robots.txt ouvert (choix A) en attendant.
4. **Preuve** : construire, servir, `pulse-aidd seo <adresse locale> --ia` : aucun Critique ni Haute ; avec un pack, `pulse-aidd pile seo-code`. Lancer aussi les contrôles automatiques de « Commandes du projet ».

Terminer avec le rapport de réalisation et le bloc de fin de commande. Prochaine étape : `/pulse:seo textes`, puis `/pulse:seo ia`.

## textes

Suivre la référence « textes » (`pulse-aidd reference seo/textes.md`), page par page (argument : une adresse ou un nom de page ; vide : les pages publiques sans texte validé dans `docs/seo.md`, la personne choisit l'ordre).

1. Entretien court : qui arrive sur la page, avec quels mots, quelle promesse.
2. Proposer 2 titres et 2 descriptions ; la personne choisit ou réécrit. Vérifier l'unicité.
3. Faits clés (une fois pour le site) et rappel sur les textes générés par l'IA : la personne relit et vérifie chaque fait.
4. Écrire `docs/seo.md`, puis reporter les textes dans le code (consignes de la pile) ; preuve par `pulse-aidd seo <adresse locale> --chemins <page>`.

Terminer avec le bloc de fin de commande. Prochaine étape : la page suivante, ou `/pulse:seo ia`.

## ia

Suivre « Référencement : assistants IA » ci-dessus.

1. Afficher la politique actuelle de `docs/seo.md` (choix et date), ou « à décider ».
2. Expliquer en trois lignes les trois familles de robots, puis poser **une** question à quatre réponses (A, B, C, D) avec leurs conséquences, sans recommandation ; B porte la mention « (le plus courant pour un site vitrine) ». Les options (Content-Signal, Amazonbot, `nosnippet`) se proposent seulement si la personne s'y intéresse.
3. Écrire la décision dans `docs/seo.md` (section « Assistants IA » et bloc `pulse-seo`), puis robots.txt selon la pile (consignes du pack, ou `pulse-aidd seo robots <choix> --sitemap <adresse>`), montré avant d'être écrit.
4. Preuve : `pulse-aidd seo <adresse> --ia` (IA1, IA4). Choix C : guider le réglage Search Console (`pulse-aidd reference seo/lancer.md`, § 5).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:seo audit`, ou `/pulse:seo lancer` si le site est en ligne.

## lancer

Prérequis : le site est en ligne sur son domaine définitif (sinon proposer `/pulse:deploy`) et `pulse-aidd seo <adresse> --essentiel` ne relève aucun Critique.

Suivre `pulse-aidd reference seo/lancer.md`, une étape à la fois : la personne agit sur chaque site ; demander le résultat de chaque étape (AskUserQuestion : « Fait ✅ » / « Bloqué » / « Plus tard ») et le noter dans « Suivi » de `docs/seo.md`. Ajouter le prochain rendez-vous (1 mois, puis 3 mois). Search Console : vérification minimale ici (propriété, balise ou DNS, sitemap déclaré) ; pour les données, le suivi et l'accès en lecture, `/pulse:search-console relier` reprend où vous en êtes (il relit la section « Référencement » de `docs/technical.md`).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:search-console relier` (données et suivi), puis le rendez-vous noté et `/pulse:seo audit`.
