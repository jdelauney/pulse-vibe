---
description: Choisir la pile technique à partir du besoin (ou documenter celle d'un projet existant), comparer 2 à 3 options vérifiées sur la documentation officielle, et produire docs/technical.md, le bloc Pile technique de CLAUDE.md, la mémoire technique et la mise en place
argument-hint: "[contrainte ou préférence technique (facultatif)]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte cicd) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte perf) Bash(pulse-aidd contexte tech) Bash(pulse-aidd etape cicd --sans-communes) Bash(pulse-aidd etape commit --sans-communes) Bash(pulse-aidd etape deploy --sans-communes) Bash(pulse-aidd etape perf --sans-communes) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd tests) Bash(pulse-aidd scenarios) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd memoire) Bash(pulse-aidd perf *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile squelette *) Bash(pulse-aidd piles) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd seo *) Bash(pulse-aidd sessions *) Bash(pulse-aidd sonder *) Bash(pulse-aidd verifier) Bash(pulse-aidd guide) Bash(pulse-aidd etape pr --sans-communes) Read Glob Grep Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git remote -v) Bash(git remote get-url *) Bash(pulse-aidd revue *) Bash(pulse-aidd travail-fini) Write(aidd_docs/tasks/in-progress.md) Edit(aidd_docs/tasks/in-progress.md) Write(docs/technical.md) Edit(docs/technical.md) Edit(./CLAUDE.md) Edit(./README.md) Write(aidd_docs/memory/**) Edit(aidd_docs/memory/**) Bash(pulse-aidd pile contexte tech)
---

# /pulse:tech – Les choix techniques

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte tech`

Appliquer les « Règles communes Pulse », les « Règles de la mémoire projet » et la référence `skills/tech/references/choix-techniques.md` ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte tech` et lire sa sortie (et `pulse-aidd reference tech/choix-techniques.md` si la référence manque).

Contrainte ou préférence exprimée (facultative) : `$ARGUMENTS`

## Objectif

Jouer le rôle d'architecte technique, en langage simple. Chaque technologie proposée découle du besoin : la pile se construit **à partir du besoin** (brief, PRD), ou s'**observe** dans le code d'un projet existant. La décision appartient à la personne. Puis écrire :

- `docs/technical.md`, **toutes** ses sections : « Les besoins qui guident le choix », « Les options comparées », « Pile retenue », « Organisation des fichiers », « Commandes du projet », « Données et contrôle d'accès », « Secrets et variables d'environnement », « Hébergement et mise en ligne », « Mise en place », « Ce qu'on a écarté » ;
- le bloc **Pile technique** de `CLAUDE.md` (entre `<!-- pulse_pile:debut -->` et `<!-- pulse_pile:fin -->`) ;
- `aidd_docs/memory/technical.md` et les décisions difficiles à défaire ;
- la **mise en place** du squelette, avec l'accord de la personne.

Phrase à dire : « On comprend d'abord le besoin, et on choisit les outils **après**. Le plus simple qui répond au besoin est le meilleur choix. »

## Prérequis

- `CLAUDE.md` est nécessaire. Sinon, proposer `/pulse:init`.
- `docs/prd.md` est fortement conseillé (le périmètre MVP guide le choix). S'il manque : proposer `/pulse:prd` ; accepter de continuer si la personne le souhaite, en le signalant.
- Si `docs/technical.md` existe : demander s'il faut le **revoir** (un besoin a changé) ou le **garder**.
- **Du code existe déjà** (fichiers source, manifeste de dépendances, configuration d'outils, quel que soit le langage) : c'est un **projet existant**, suivre le chemin A. Sinon, **projet neuf** : chemin B.

## Déroulé

### 1. Ce que l'on sait déjà

Lire `docs/brief.md`, `docs/prd.md`, `aidd_docs/memory/` et le code s'il y en a. Remplir **soi-même** toutes les lignes du tableau « Les besoins qui guident le choix » que ces documents permettent de remplir. Réserver les questions aux lignes restantes.

### A. Projet existant : documenter la pile observée

1. **Observer** (Glob, Grep, Read) : langages, manifestes de dépendances et leurs versions, frameworks, stockage des données et schéma éventuel, mécanisme de connexion, code serveur, configuration d'hébergement et de CI, scripts déclarés, fichiers d'environnement d'exemple, organisation des dossiers et conventions de nommage. Chaque élément de la pile s'appuie sur un fichier réel, cité.
2. **Commandes du projet** : relever celles que le projet déclare (installer, lancer en local, tester, contrôles automatiques : lint / format / types, construire, auditer les dépendances, déployer). Une commande absente s'écrit « aucune » ; noter uniquement les commandes déclarées.
3. **Vérifier les points incertains** sur la documentation officielle des technologies observées (outil de documentation comme context7 s'il est disponible, sinon WebFetch) : version maintenue ou non, mécanisme de contrôle d'accès, gestion des secrets.
4. **Présenter** la pile observée en 5 à 8 lignes, avec les manques constatés (pas de contrôle automatique, contrôle d'accès seulement dans le navigateur, secret dans le code…). Proposer un changement de technologie seulement si le besoin l'exige, en expliquant le coût (réécriture). Demander « C'est bien ça » / « Corriger quelque chose ».
5. Passer à l'étape 6 (« Écrire ») : les tableaux « Les options comparées » et « Ce qu'on a écarté » indiquent « Projet existant : pile observée, pas de comparaison » sauf si un changement a été décidé.

### B. Projet neuf : construire et comparer les options

#### 2. Les questions qui restent (par rondes)

Poser seulement les lignes manquantes du tableau des besoins, en rondes de 4 questions au plus (AskUserQuestion), chacune avec 2 à 4 réponses concrètes, **la réponse recommandée en premier** avec « (Recommandé) ». Les questions portent sur le **besoin** (qui, combien, données partagées ou non, comptes, données personnelles, plateformes, hors ligne, budget, expérience, contraintes imposées) ; les outils viendront à l'étape 3. Une réponse floue (« beaucoup d'utilisateurs ») appelle une précision chiffrée (« une dizaine ? une centaine ? »). Demander aussi si la personne ou son organisation **impose ou exclut** une technologie, et si elle en connaît déjà une.

Après la dernière ronde, **signaler les contradictions** et faire trancher : par exemple « paiement en ligne » avec « budget 0 € et aucun compte », ou « données de santé » avec « hébergement sans garantie de localisation ».

#### 3. Construire 2 ou 3 options

Suivre `skills/tech/references/choix-techniques.md` pour construire **2 ou 3 options réellement différentes** (approche, nature du stockage, hébergement : trois approches distinctes plutôt que trois variantes du même outil), chacune déduite des besoins seulement, plutôt que d'une habitude ou d'une technologie par défaut. Inclure systématiquement l'option **la plus simple** qui répond au besoin. Pour chaque option : pile (langage, framework éventuel, données, connexion, code serveur, hébergement, services), coût mensuel estimé (ordre de grandeur, incertitude signalée), localisation des données si elle compte, points forts, **1 à 3 risques honnêtes** (chaque option en a).

- **Packs de pile** : lancer `pulse-aidd piles`. Un pack installé dont la pile couvre les besoins devient une option à part entière, vérifiée comme les autres à l'étape 4 : « Pile Pulse <nom> : code de départ vérifié, recettes prêtes et pièges connus déjà traités ; c'est l'option qui demande le moins d'essais pour obtenir un code juste. » Quand elle convient au besoin, la recommander ; les autres options restent présentées et la personne choisit. Aucun pack installé et besoin d'une application web avec comptes et données partagées : ajouter une ligne pour dire que le plugin `pulse-next` (pile Next.js prête à l'emploi) existe, installable avec `/plugin install pulse-next@pulseia`.
- **Services externes** : 1 ou 2 au maximum pour le MVP ; paiement d'abord en **mode test** ; le mode réel est une décision de la personne, au moment de la mise en ligne.
- **Données personnelles** : minimiser ; pour des données sensibles, choisir la région d'hébergement exigée par la loi de protection des données qui s'applique au projet, à vérifier dans l'offre du service.
- **Anti-complaisance** : si la personne veut un outil qui ne correspond pas à son besoin, le dire avec tact, montrer le coût (pièces à comprendre, temps, verrouillage), et demander si elle a une raison que l'on ignore.

#### 4. Vérifier les options sur la documentation officielle

Avant de recommander quoi que ce soit, vérifier chaque option : lancer **en parallèle** un sous-agent `general-purpose` par option (plusieurs appels Agent dans le même message), avec pour consigne de consulter la **documentation officielle** et les pages de tarifs (outil de documentation comme context7 s'il est disponible, sinon WebFetch ou recherche web) : version actuelle maintenue, compatibilité des pièces entre elles, offre gratuite ou tarif annoncé, région d'hébergement si elle compte, façon officielle d'initialiser un projet, pièges connus récents. Chacun rend : verdict ✅ / ⚠️ / ❌, trois puces justifiées avec leurs sources. Si les sous-agents ne sont pas disponibles, faire ces vérifications soi-même, option par option.

Reporter les verdicts dans le tableau « Les options comparées ». Si toutes les options sont ❌ : expliquer le blocage commun et revenir à l'étape 2 ou 3.

#### 5. Choisir

Présenter le tableau et **recommander** une option en une phrase. Avant la question, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) : les options (une ligne chacune) et la recommandation ; l'effacer avec `pulse-aidd travail-fini` une fois le choix fait (étape de `/pulse:express` ou de `/pulse:spirc` : le réécrire plutôt pour cette commande, à son étape suivante). Demander (AskUserQuestion) : « Option A (Recommandé) » / « Option B » / (« Option C ») / « Revoir un besoin ». La décision appartient à la personne.

### 6. Écrire (projet existant ou neuf)

1. **`docs/technical.md`** à partir du modèle, toutes sections remplies (« aucune » ou « sans objet » si c'est le cas) :
   - « Pile retenue » : langage, framework éventuel, données, connexion, code serveur, hébergement, services, **versions** ; une phrase de « pourquoi » par élément. **Pack de pile choisi** : écrire la ligne `**Pack de pile Pulse** : <id>`, puis lancer `pulse-aidd pile contexte tech` : les consignes du pack donnent les valeurs de la pile (versions, organisation, commandes, mise en place), qui remplissent les sections suivantes (les règles et modèles de cette commande figurent déjà ci-dessus) ;
   - « Organisation des fichiers » : **la référence unique** que suivront la spec, le plan et le code. Projet existant : l'organisation **observée** (dossiers réels, conventions de nommage, où vivent l'interface, l'accès aux données, le code serveur, le schéma). Projet neuf : l'organisation **décidée** selon la référence `qualite/organisation.md` ci-dessus, adaptée aux conventions de la documentation officielle de la technologie retenue (qui priment) : **palier** retenu et sa raison, arborescence, convention de nommage et exceptions imposées par le langage, **suffixes** utilisés, emplacement des tests ; en indiquant que les dossiers seront créés au fil des tâches ;
   - « Commandes du projet » : installer, lancer en local, tester, contrôles automatiques (lint / format / types), construire, auditer les dépendances (« Auditer les dépendances »), déployer ; une commande absente s'écrit « aucune ». Projet neuf : les commandes que fournira le squelette selon la documentation officielle, ou « aucune » ;
   - « Tests automatiques » de « Pile retenue » : choix technique (règle commune « La personne décide ») : l'outil de test recommandé par la documentation officielle de la pile retenue, version fixée, vérifié à l'étape 4 avec le reste ; sinon le lanceur de tests intégré au langage s'il en a un (`unittest` pour Python ; `node --test` pour JavaScript avec Node.js, et pour TypeScript avec Node.js 22.19 ou plus quand le code s'en tient à la syntaxe effaçable, importe ses fichiers avec l'extension `.ts` et n'utilise pas d'alias de chemins, sinon l'outil de test recommandé pour la pile) ; à défaut, s'il y a du code à tester, l'outil de test le plus répandu pour ce langage, version fixée ; un outil de bout en bout seulement si `docs/prd.md` montre un parcours critique qui le justifie, sinon « aucun ». Projet existant : l'outil observé, ou « aucun ». Son installation fait partie de « Mise en place », et sa commande remplit « Tester » ;
   - « Données et contrôle d'accès » : où sont les données, qui peut lire, créer, modifier, supprimer quoi, et **où c'est vérifié côté serveur** (ou « données sur l'appareil, sans partage » si c'est le cas) ;
   - « Secrets et variables d'environnement » : le fichier local non versionné, les **noms** des variables (jamais leurs valeurs), où les saisir en production ;
   - « Hébergement et mise en ligne » : hébergeur, dépôt distant, CI éventuelle ;
   - « Mise en place » : les étapes pas à pas avant la première tâche (comptes à créer, initialisation du squelette selon la documentation officielle, compléments à `.gitignore` et `.env.example`) ;
   - un schéma Mermaid simple de l'assemblage des pièces.
2. **`CLAUDE.md`** : remplacer **uniquement** le contenu entre `<!-- pulse_pile:debut -->` et `<!-- pulse_pile:fin -->` (y compris la phrase « Pile non choisie… ») par : un résumé court de « Pile retenue » (5 lignes au plus), les commandes de « Commandes du projet » (une par ligne, « aucune » si absente), puis la ligne « Détails : `docs/technical.md` ». Si les marqueurs sont absents (projet créé avant Pulse 0.3), remplacer la section « Pile technique » existante par une section avec les marqueurs, en gardant le reste intact.
3. **`aidd_docs/memory/technical.md`** : mettre à jour le résumé de la pile retenue (une ou deux lignes et un renvoi à `docs/technical.md`, qui reste la source) et ajouter une ligne datée par décision dans « Décisions techniques ».
4. **Décisions difficiles à défaire** (langage ou framework, stockage des données, mécanisme de connexion, hébergement de données personnelles) : proposer un fichier de décision seulement si les 3 conditions des règles de la mémoire sont réunies. Montrer avant d'écrire.
5. Lancer `pulse-aidd memoire`.

### 7. Mise en place

Projet existant : seulement compléter `.gitignore` et `.env.example` si des manques ont été constatés (avec accord), puis passer à l'étape 8.

Projet neuf : présenter la « Mise en place » en 3 à 5 lignes, puis demander (AskUserQuestion) : « Préparer le code de départ maintenant (Recommandé) » / « Plus tard, avec la première tâche ».

- **Maintenant** :
  1. Initialiser le squelette de la technologie retenue **selon sa documentation officielle** (commande ou procédure d'initialisation, versions fixées). Si l'outil d'initialisation refuse un dossier non vide, ou risque d'écraser un fichier : initialiser dans un **dossier temporaire**, puis rapatrier les fichiers. Conserver `CLAUDE.md`, `README.md` et `.gitignore` (ne **jamais** les écraser) : fusionner ce qu'ils apportent d'utile, puis supprimer le dossier temporaire.
  2. Compléter `.gitignore` selon la pile (dépendances installées, fichiers construits, caches, fichiers d'environnement locaux) et `.env.example` avec les **noms** des variables de « Secrets et variables d'environnement », sans valeurs.
  3. Vérifier que la commande « lancer en local » de « Commandes du projet » fonctionne ; corriger « Commandes du projet » et le bloc `pulse_pile` si le squelette en fournit d'autres.
  4. **Le thème** : si `docs/design.md` existe, traduire son identité en valeurs de thème dans le code (section « Dans le code » de `docs/design.md`), avec accord.
  5. Expliquer en quelques lignes ce qui a été ajouté. Les actions qui relèvent de la personne (créer un compte, saisir une clé secrète dans le fichier local) sont guidées pas à pas ; la personne écrit une clé secrète directement dans le fichier local, **jamais** dans la conversation.
  6. **En ligne dès le premier jour** : si l'hébergeur retenu publie depuis un dépôt distant, proposer (AskUserQuestion) « Mettre en ligne la page de départ maintenant (Recommandé) » / « Plus tard ». Expliquer : « Mettre en ligne une page presque vide, c'est découvrir aujourd'hui les réglages de l'hébergeur, plutôt qu'à la fin, avec tout le projet en jeu. » Maintenant : enregistrer le squelette avec la section « Déroulé » de `pulse-aidd etape commit --sans-communes` (message `chore: squelette du projet` ; aucune tâche de plan, donc rien à relire ni à cocher), puis appliquer la section « 3. Première mise en ligne » de `pulse-aidd etape deploy --sans-communes` ; elle se termine par `pulse-aidd sonder`.
- **Plus tard** : l'indiquer dans « Mise en place » (« À réaliser avec la première tâche du premier plan ») : l'installation se fera avec cette tâche.

### 8. Valider

Résumé en 5 lignes : pile retenue (et pack de pile éventuel), hébergement, services, coût estimé, mise en place faite ou restant à faire par la personne (avec l'adresse du site s'il est déjà en ligne). Demander « Valider » / « Modifier quelque chose ».

Terminer avec le bloc de fin de commande. Prochaine étape : si `docs/design.md` n'existe pas, proposer `/pulse:ui identite` en précisant qu'elle est **facultative** (« Définir l'apparence de votre outil maintenant permet aux user stories, specs et plans de s'y conformer ») ; sinon, ou si la personne préfère s'en passer, `/pulse:us` (puis `/pulse:spec`, qui s'appuie sur ces choix), ou `/pulse:spirc` pour enchaîner. Si un dépôt distant est relié (`git remote -v`), que le squelette est en place et qu'aucune CI n'existe : mentionner aussi `/pulse:cicd` (facultatif) pour vérifier automatiquement chaque envoi.
