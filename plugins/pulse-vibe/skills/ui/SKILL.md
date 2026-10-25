---
description: Définir et soigner l'interface - identité visuelle (docs/design.md), maquettes d'écrans à comparer pour la spec d'une US, audit et finitions d'une interface existante
argument-hint: "[identite | maquettes <US-XXX> | audit [cible] | polish [cible]]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte ui) Bash(pulse-aidd agent designer) Bash(pulse-aidd agent ui-critic) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite *) Bash(pulse-aidd tests *) Bash(pulse-aidd scenarios) Bash(pulse-aidd comparer *) Bash(pulse-aidd identite *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd pile contexte *) Bash(pulse-aidd maquettes verifier *) Bash(pulse-aidd textes verifier *) Bash(pulse-aidd contraste *) Bash(start "" *.html) Bash(open *.html) Bash(xdg-open *.html) Read Glob Grep Bash(pulse-aidd travail-fini) Write(aidd_docs/tasks/in-progress.md) Edit(aidd_docs/tasks/in-progress.md) Write(docs/design.md) Edit(docs/design.md) Write(docs/design/**) Edit(docs/design/**) Edit(aidd_docs/tasks/**) Bash(pulse-aidd copies)
---

# /pulse:ui – L'interface

## Objectif

Aider la personne à **voir** et choisir l'apparence de son outil, puis à la soigner. Phrase à dire : « On choisit une apparence en la regardant, plutôt qu'en lisant des codes couleur. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte ui` et lire sa sortie en entier) pendant toute la commande.

Les références de design se chargent à l'étape qui les cite (`pulse-aidd reference ui/<fichier>`, `pulse-aidd modele ui/<fichier>`) ; la « liste noire » désigne `ui/anti-patterns.md`. Les agents `pulse:designer` et `pulse:ui-critic` chargent eux-mêmes les leurs.

Questions : règle commune 5.

Les maquettes HTML sont une **référence visuelle**, indépendante de la pile : le code les traduit ensuite dans la technologie de `docs/technical.md`. `/pulse:ui` laisse le code intact ; seule l'action `polish` le modifie.

**Noms des dossiers** : `d<n>-<slug>` pour une direction d'identité, `v<n>-<slug>` pour une variante de maquette (`<n>` = 1, 2, 3…). `<slug>` est tiré de la thèse : minuscules, sans accent, mots séparés par des tirets, 30 caractères au plus. `<spec>` est le nom commun de l'US et de sa spec, `US-XXX-<nom>`, tel qu'il existe réellement dans `aidd_docs/tasks/<epic>/`. **Avant de générer un nouveau lot** : `pulse-aidd comparer <dossier> --ranger` (les dossiers `d*` ou `v*` déjà présents partent dans `alternatives/`, ignoré par la comparaison) ; numéroter les nouveaux dossiers à partir de `prochain`. **Hybride** : dossier `d<n+1>-hybride-<slug>` (identité) ou `v<n+1>-hybride-<slug>` (maquettes), thèse « Hybride : <ce qui vient de quelle proposition> » ; passer à l'agent les chemins des propositions sources. C'est ce dossier que l'on retient. **Retenir le choix** : `pulse-aidd comparer <dossier> --retenir <variante>` (`--mobile <variante>` pour un mobile pris d'une autre variante) : l'ancien `retenue/` part dans `alternatives/retenue-<AAAA-MM-JJ>/`, le choix est copié dans `retenue/`, les autres variantes sont rangées et `comparer.html`, périmé, est retiré.

## Contexte

Action demandée : `$ARGUMENTS`

Fichiers de cette commande : [references/anti-patterns.md](references/anti-patterns.md), [references/directions.md](references/directions.md), [references/heuristiques.md](references/heuristiques.md), [references/motifs.md](references/motifs.md), [references/registres.md](references/registres.md), [references/regles-ui.md](references/regles-ui.md), [assets/design.md](assets/design.md), [assets/maquette-note.md](assets/maquette-note.md), [assets/revue-ui.md](assets/revue-ui.md), [scripts/comparer.js](scripts/comparer.js), [scripts/contraste.js](scripts/contraste.js), [scripts/identite.js](scripts/identite.js), [scripts/maquettes.js](scripts/maquettes.js).

### Choisir l'action

| Action | Quand | Section |
|---|---|---|
| `identite` | Créer l'identité visuelle, ou la revoir | « identite » |
| `maquettes <US-XXX>` | La spec d'une US décrit des écrans : en voir plusieurs versions et choisir | « maquettes » |
| `audit [cible]` | Une interface existe : relever ce qui cloche, en lecture seule | « audit » |
| `polish [cible]` | Appliquer les corrections visuelles et de texte d'un audit | « polish » |
| (vide) | Hésiter sur le point de départ | « Sans argument » |

## Rôle

Cette commande mène l'entretien, fait choisir la personne et écrit les documents. Les agents sont ses moyens :
- `pulse:designer` : génère une direction d'identité (planche) ou une variante de maquette, un agent par proposition, et assemble un hybride ;
- `pulse:ui-critic` : critique la maquette retenue (mode maquette) ou audite l'interface existante (mode code), en lecture seule.

**Lancer les agents de génération** (`identite` et `maquettes`) : lancer **en parallèle** un sous-agent `pulse:designer` par variante (plusieurs appels Agent dans le même message). Message de délégation : type, thèse, axes de différence, dossier de sortie, écrans à couvrir, chemins de `docs/design.md` (ou direction provisoire), de `docs/prd.md` et `docs/brief.md` (s'ils existent), de la spec et de `docs/user-stories.md` (maquettes ; s'ils existent) et de `aidd_docs/memory/glossary.md`. Si les sous-agents ne sont pas disponibles, lancer `pulse-aidd agent designer`, lire ses consignes et produire les variantes soi-même, une par une. Chaque agent rend 3 lignes (Thèse / Ce qui la distingue / Fichiers) : les garder pour la comparaison.

## Processus

**Comparer** : lancer `pulse-aidd comparer <dossier>`, puis ouvrir le fichier affiché (section « Ouvrir une page »). Si la commande échoue (aucune variante), le dire et relancer la génération manquante.

### Sans argument

1. Lire `docs/`, `docs/design.md`, les specs (`aidd_docs/tasks/*/SPEC-US-*.md`), `docs/design/maquettes/`. Chercher du code d'interface à l'emplacement indiqué par « Organisation des fichiers » de `docs/technical.md`, sinon dans le code existant (Glob, Grep).
2. Recommander une action (AskUserQuestion, la recommandée en premier) :
   - pas de `docs/design.md` → `identite` ;
   - une spec avec des écrans et sans dossier `docs/design/maquettes/<spec>/` → `maquettes <US-XXX de cette spec>` ;
   - du code d'interface → `audit`.
3. Attendre la réponse avant de lancer quoi que ce soit. Puis suivre la section de l'action choisie.

### identite

#### Prérequis

- `docs/prd.md` est nécessaire. Sinon, proposer `/pulse:prd` et s'arrêter.
- Lire `docs/brief.md`, `aidd_docs/memory/` et le glossaire s'ils existent.
- Si `docs/design.md` existe : demander « Le revoir » / « Le garder ». Le garder termine la commande. Le revoir : appliquer la règle « Noms des dossiers » (`--ranger` avant le lot ; l'ancien `retenue/` est rangé par `--retenir` au moment du choix).

#### Déroulé

1. **Ce que l'on sait déjà.** Au début de cette étape, charger `pulse-aidd reference ui/registres.md` et `pulse-aidd reference ui/regles-ui.md` (registres, stratégies de couleur et règles qui serviront jusqu'à l'écriture de `docs/design.md`). Déduire des documents le public, les écrans probables et l'hypothèse de registre. Affirmer puis faire confirmer, par exemple : « Votre outil sert à *utiliser*, pas à *convaincre* : je pars sur le registre outil, d'accord ? ». Si le projet contient déjà une interface : lancer `pulse-aidd identite extraire <dossier du code d'interface>`, montrer ce qui a été relevé (couleurs, polices, rayons, avec leurs fichiers) et demander s'il faut les **garder comme base** ou **repartir de zéro**. Base gardée : seules les valeurs relevées, ou fournies par la personne (charte, logo), entrent dans les directions ; une valeur « non trouvée » se demande à la personne.
2. **Entretien**, par rondes de 4 questions au plus, en langage courant. Demander uniquement ce que les documents laissent ouvert. Sujets :
   - la scène d'usage (qui, où, quand, sur quel écran) ;
   - la personnalité en 3 mots (réponses proposées concrètes, réponse libre possible) ;
   - 2 ou 3 outils ou sites dont la personne aime l'allure, 1 ou 2 dont elle veut se démarquer ;
   - l'intensité de couleur (les 4 stratégies de « Règles d'interface », traduites en langage courant) ;
   - un logo, des couleurs ou une police imposés.

   Laisser de côté codes couleur et noms de police : la personne décrit, vous traduisez. Après chaque ronde, reformuler en 1 ou 2 lignes (« ✔ Décidé : … »).
3. **Directions.** Charger `pulse-aidd reference ui/directions.md`. D'après l'entretien, recommander une famille et une alternative (« Choisir une famille »), en une phrase chacune. Construire 2 ou 3 directions réellement différentes, chacune tirée d'une famille et d'un style du catalogue, cités dans sa thèse : au moins 2 axes parmi stratégie de couleur, typographie, densité, forme, ambiance claire / sombre. Donner à chacune une thèse en une phrase. Montrer le plan en 3 lignes, puis lancer les agents de génération (type `planche`), un par direction, dossier `docs/design/identite/d<n>-<slug>/`. Chaque agent écrit `planche.html` et `note.md` : palette par rôle avec contrastes, titres et texte, boutons et champs dans leurs états, une liste, un message d'erreur, un état vide, avec des contenus fictifs tirés du projet (glossaire, US).
4. **Comparer.** Lancer `pulse-aidd comparer docs/design/identite`, ouvrir `comparer.html` (section « Ouvrir une page »), expliquer chaque thèse en une ligne. Avant de demander le choix, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16) : les directions proposées et leurs dossiers ; l'effacer avec `pulse-aidd travail-fini` une fois le choix fait (étape de `/pulse:express` : le réécrire plutôt pour cette commande, à son étape suivante).
5. **Choisir dans le chat** : une direction ; un hybride (un agent `pulse:designer` assemble la planche hybride, dossier `d<n+1>-hybride-<slug>`) ; ou « aucune, … » (retour à l'étape 3 avec la nouvelle consigne). Mesurer les contrastes du choix avec `pulse-aidd contraste <couleur> <fond>`, paire par paire : un texte sous 4,5:1, ou un contour de champ ou de focus sous 3:1, se corrige (`--viser` propose la luminosité qui atteint le seuil), et la correction se dit.
6. **Écrire.**
   - Retenir la planche choisie (ou l'hybride) : `pulse-aidd comparer docs/design/identite --retenir <direction>`.
   - Écrire `docs/design.md` à partir du modèle, affiché au moment de l'écrire (`pulse-aidd modele ui/design.md`) : **toutes** les sections remplies ; écrire « sans objet » quand une section ne s'applique pas.
   - Montrer un résumé en 5 lignes et demander « Valider » / « Modifier quelque chose ».
   - **Traduire dans le code** : si le squelette de la pile est en place (« Mise en place » de `docs/technical.md` faite), proposer « Appliquer cette identité au code maintenant (Recommandé) » / « Plus tard ». Maintenant : lancer `pulse-aidd qualite clean-code`, puis `pulse-aidd qualite composants` (chaque sortie lue en entier), écrire les valeurs de `docs/design.md` dans le fichier du thème de la pile retenue (consignes du pack de pile s'il y en a un, sinon documentation officielle de la technologie), remplir la section « Dans le code » de `docs/design.md`, lancer les contrôles automatiques de « Commandes du projet », puis demander à la personne de regarder la page de départ dans son navigateur. Sans squelette : écrire « à créer à la mise en place » dans « Dans le code » ; `/pulse:tech` appliquera le thème après le squelette.
   - Si l'identité est traduite dans le code, proposer le contrôle `couleurs-variables` selon `pulse-aidd reference controles-proposes.md` ; le fichier des variables vient du contexte du pack, sinon du fichier où l'identité vient d'être traduite en code.
   - Proposer `/pulse:memory retenir` pour le registre et la stratégie de couleur.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:us` si `docs/user-stories.md` n'existe pas encore (cas habituel : l'identité se définit juste après `/pulse:tech`) ; sinon `/pulse:spec <US-XXX>`, ou `/pulse:ui maquettes <US-XXX>` si une spec avec des écrans existe déjà.

### maquettes

#### Prérequis

- La spec de l'US désignée existe (`aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`). Argument absent ou introuvable : lister les specs et demander (règle commune).
- `docs/design.md` est fortement conseillé. S'il manque, demander : « Définir l'identité d'abord (Recommandé) » / « Continuer avec une direction provisoire ». Avec une direction provisoire, la décrire dans le message de délégation et le signaler dans chaque `note.md`.

#### Déroulé

1. **Écrans.** Lire la section « Ce que l'utilisateur voit et fait » de la spec (« Écrans » dans une spec plus ancienne). Faire choisir les écrans à maquetter (AskUserQuestion multiSelect, le parcours principal recommandé), **3 écrans au plus** par passage. Si `docs/design/maquettes/<spec>/` existe déjà : « Compléter avec d'autres écrans » / « Refaire » / « Garder ».
   - « Garder » termine la commande : bloc de fin, prochaine étape `/pulse:plan <US-XXX>`.
   - « Refaire » : l'ancien `retenue/` reste en place jusqu'au nouveau choix, que `--retenir` range.
   - « Compléter » : à l'étape 7, ajouter les nouveaux écrans dans `retenue/` sous les noms `desktop-<k>.html` et `mobile-<k>.html` (k = 2, 3…) au lieu de `--retenir`, puis ranger les variantes avec `--ranger` ; le `note.md` de `retenue/` indique quels écrans chaque fichier couvre.
2. **Plan des variantes.** N variantes : 3 par défaut, 2 à 4 si la personne le demande. Chacune a une thèse et une différence d'organisation ou d'interaction (navigation, ordre des informations, mode de saisie, densité). Montrer le plan en 3 lignes avant de générer.
3. **Générer** : lancer les agents de génération (type `maquette`), un par variante, dossier `docs/design/maquettes/<spec>/v<n>-<slug>/`. Chacun écrit `desktop.html`, `mobile.html` et `note.md`, en respectant `docs/design.md` et la liste noire, avec des données fictives réalistes (glossaire, US) et les états clés de chaque écran montrés (vide, chargement, erreur).
4. **Contrôler la différence.** Si deux variantes diffèrent seulement par le style, le dire et proposer : « Régénérer celle-ci avec une autre thèse (Recommandé) » / « Garder ainsi ».
5. **Comparer.** Lancer `pulse-aidd comparer docs/design/maquettes/<spec>`, ouvrir la page, expliquer chaque thèse en une ligne.
6. **Choisir dans le chat** : une variante pour les deux formats ; « desktop = a, mobile = b » ; un hybride (un agent `pulse:designer` assemble, dossier `v<n+1>-hybride-<slug>`) ; ou « aucune, … » (retour à l'étape 2).
7. **Enregistrer.**
   - Retenir le choix : `pulse-aidd comparer docs/design/maquettes/<spec> --retenir <variante>` ; pour « desktop = a, mobile = b » : `--retenir a --mobile b`.
   - Mettre à jour le `note.md` de `retenue/` au moment de l'enregistrer, d'après le modèle `pulse-aidd modele ui/maquette-note.md` : il dit d'où vient chaque partie.
   - La spec reste telle quelle : le plan retrouve la maquette retenue à cet emplacement et la cite dans sa conception technique (si le plan existe déjà, y ajouter la ligne « Maquette », avec l'accord de la personne).
   - Laisser le commit à une étape ultérieure.
8. **Critiquer.** Corriger une maquette coûte moins que corriger le code : proposer « Critiquer la maquette retenue (Recommandé) » / « Passer au plan ». Pour critiquer :
   - Lancer le sous-agent `pulse:ui-critic` en **mode maquette** (s'il n'est pas disponible, `pulse-aidd agent ui-critic`, consignes appliquées soi-même, en lecture seule). Lui indiquer la cible `docs/design/maquettes/<spec>/retenue/`, le chemin de `docs/design.md` (ou la direction provisoire) et la spec de l'US.
   - Écrire sa réponse, à partir de sa deuxième ligne, dans `docs/design/maquettes/<spec>/retenue/critique.md` (après « Compléter », dans `critique-<k>.md`, avec le même `<k>` que les nouveaux écrans).
   - Montrer le verdict, la note sur 50 et les corrections rapides.
   - Faire choisir les constats à corriger : Montrer la liste numérotée, puis proposer (AskUserQuestion) « Les 🔴 et les corrections rapides (Recommandé) » / « Tous les constats » / « Je donne les numéros » (réponse libre). Proposer `/pulse:refine` pour les constats renvoyés (ils changent la spec).
   - Avant de corriger, charger `pulse-aidd reference ui/regles-ui.md` et `pulse-aidd reference ui/anti-patterns.md`, puis corriger le HTML de `retenue/` en respectant `docs/design.md`, la liste noire et les consignes du pack pour les maquettes. Dans le rapport, marquer ✅ les constats corrigés et ↪️ laissé les autres ; noter les changements dans `note.md`.
   - Ouvrir `retenue/desktop.html` (section « Ouvrir une page ») pour que la personne regarde le résultat.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:plan <US-XXX>`.

### audit

Cible : un écran, un fichier, un dossier, ou toute l'interface (vide = toute l'interface, à l'emplacement indiqué par « Organisation des fichiers » de `docs/technical.md`, sinon le code existant). Vérifier d'abord que le fichier ou l'écran existe (Glob, Grep) ; sinon, lister ce qui existe et demander.

1. **Lancer l'audit.** Expliquer en une phrase qu'il se fait en lecture seule. Lancer le sous-agent `pulse:ui-critic` ; s'il n'est pas disponible, lancer `pulse-aidd agent ui-critic` et appliquer ses consignes soi-même, en lecture seule. Lui indiquer : la cible, le chemin de `docs/design.md` (ou « absent »), la ou les maquettes retenues des specs dont relève la cible (`docs/design/maquettes/<spec>/retenue/`), l'emplacement du code d'interface d'après « Organisation des fichiers », et le mode `code`.
2. **Contrôler la réponse** : elle commence par `Verdict : 🔴 n · 🟠 n · 🟢 n · note n / 50`, puis donne l'évaluation d'ensemble, les constats des 7 rubriques et 3 corrections rapides ; sinon, relancer l'agent avec ce qui manque. Seulement si la réponse s'écarte du modèle, l'afficher (`pulse-aidd modele ui/revue-ui.md`) pour nommer à l'agent la partie manquante.
3. **Enregistrer.** Écrire sa réponse à partir de sa deuxième ligne (la première, `Verdict : …`, est réservée au résumé dans le chat ; le modèle a sa propre ligne **Verdict**), dans `docs/design/audits/ui-<AAAA-MM-JJ>.md` (ajouter `-2`, `-3` si le fichier existe déjà), selon le modèle `revue-ui.md`.
4. **Présenter** l'essentiel en 5 lignes : le verdict, la note sur 50, les 🔴, les corrections rapides.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:ui polish` ; `/pulse:refine` pour un constat qui change le besoin ou le parcours ; `/pulse:fix` pour un comportement cassé.

### polish

1. **Partir du rapport** `docs/design/audits/ui-*.md` le plus récent qui couvre la cible. S'il n'y en a pas, faire d'abord l'audit (section « audit »).
2. **Trier.** Retenir les constats **purement visuels ou de texte** : apparence et libellés seulement, hors logique métier, données et contrôle d'accès. Renvoyer les autres vers `/pulse:refine` (besoin ou parcours) ou `/pulse:fix` (comportement cassé), en le disant.
3. **Faire choisir.** Montrer la liste numérotée, puis proposer (AskUserQuestion) « Les 🔴 et les corrections rapides (Recommandé) » / « Tous les constats » / « Je donne les numéros » (réponse libre).
4. **Appliquer** par petits lots. Avant d'écrire du code, charger `pulse-aidd reference ui/regles-ui.md` et `pulse-aidd reference ui/anti-patterns.md`, puis lancer `pulse-aidd qualite clean-code` et `pulse-aidd qualite composants` (chaque sortie lue en entier), et appliquer ces règles, avec les consignes du pack de pile pour `polish` s'il y en a un. Respecter la pile retenue (`docs/technical.md`), `docs/design.md` et la maquette retenue. Lancer ensuite les contrôles automatiques de « Commandes du projet » (sauter ceux qui valent « aucune »).
5. **Vérifier.** Demander à la personne de vérifier dans son navigateur. Marquer les constats corrigés (✅) dans le rapport.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:commit`.

### Ouvrir une page

Après `pulse-aidd comparer`, ouvrir le fichier affiché (« Page de comparaison : <chemin> ») avec la commande du système (avec l'outil Bash ; sous PowerShell : `Start-Process "<chemin>"`) :
- Windows : `start "" "<chemin>"` ;
- macOS : `open "<chemin>"` ;
- Linux : `xdg-open "<chemin>"`.

En cas d'échec, afficher le chemin complet et dire : « Double-cliquez sur ce fichier pour l'ouvrir dans votre navigateur. »

## Exemples

- `/pulse:ui identite` : quelques questions sur votre outil, puis 2 ou 3 apparences à comparer dans votre navigateur ; vous choisissez, et `docs/design.md` est écrit.
- `/pulse:ui maquettes US-003` : 3 versions des écrans de cette user story, côte à côte ; vous gardez celle qui vous plaît.
- `/pulse:ui audit` : un rapport de ce qui cloche dans l'interface, sans rien modifier ; `/pulse:ui polish` applique ensuite les corrections que vous choisissez.

## Références de la commande

!`pulse-aidd contexte ui`

Si ce contexte est absent, lancer `pulse-aidd contexte ui` et lire sa sortie.
