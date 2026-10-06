---
description: Définir et soigner l'interface - identité visuelle (docs/design.md), maquettes d'écrans à comparer pour la spec d'une US, audit et finitions d'une interface existante
argument-hint: "[identite | maquettes <US-XXX> | audit [cible] | polish [cible]]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Bash(start "" *.html") Bash(open *.html") Bash(xdg-open *.html") Read Glob Grep
---

# /pulse:ui – L'interface

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte ui`

Appliquer les « Règles communes Pulse », les « Règles de la mémoire projet » et les trois références de design ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte ui` et lire sa sortie.

Action demandée : `$ARGUMENTS`

## Objectif

Aider la personne à **voir** et choisir l'apparence de son outil, puis à la soigner. Phrase à dire : « On choisit une apparence en la regardant, plutôt qu'en lisant des codes couleur. »

Poser les questions une par une ou par rondes (AskUserQuestion, 2 à 4 réponses, la recommandée en premier avec « (Recommandé) »). Les trois références de design ont pour titres « Registres d'interface », « Règles d'interface » et « Anti-patterns d'interface » (la « liste noire ») ; on peut les réafficher avec `pulse-aidd reference design/<fichier>`.

## Choisir l'action

| Action | Quand | Section |
|---|---|---|
| `identite` | Créer l'identité visuelle, ou la revoir | « identite » |
| `maquettes <US-XXX>` | La spec d'une US décrit des écrans : en voir plusieurs versions et choisir | « maquettes » |
| `audit [cible]` | Une interface existe : relever ce qui cloche, en lecture seule | « audit » |
| `polish [cible]` | Appliquer les corrections visuelles et de texte d'un audit | « polish » |
| (vide) | Hésiter sur le point de départ | « Sans argument » |

Les maquettes HTML sont une **référence visuelle**, indépendante de la pile : le code les traduit ensuite dans la technologie de `docs/technical.md`. `/pulse:ui` laisse le code intact ; seule l'action `polish` le modifie.

**Noms des dossiers** : `d<n>-<slug>` pour une direction d'identité, `v<n>-<slug>` pour une variante de maquette (`<n>` = 1, 2, 3…). `<slug>` est tiré de la thèse : minuscules, sans accent, mots séparés par des tirets, 30 caractères au plus. `<spec>` est le nom commun de l'US et de sa spec, `US-XXX-<nom>`, tel qu'il existe réellement dans `aidd_docs/tasks/<epic>/`. **Avant de générer un nouveau lot**, déplacer les dossiers `d*` ou `v*` déjà présents dans le dossier concerné vers son sous-dossier `alternatives/` (ignoré par `pulse-aidd comparer`) ; numéroter les nouveaux dossiers à partir du plus grand `<n>` trouvé, `alternatives/` compris. **Hybride** : dossier `d<n+1>-hybride-<slug>` (identité) ou `v<n+1>-hybride-<slug>` (maquettes), thèse « Hybride : <ce qui vient de quelle proposition> » ; passer à l'agent les chemins des propositions sources. C'est ce dossier qui est copié dans `retenue/`.

**Lancer les agents de génération** (`identite` et `maquettes`) : lancer **en parallèle** un sous-agent `pulse:designer` par variante (plusieurs appels Agent dans le même message). Message de délégation : type, thèse, axes de différence, dossier de sortie, écrans à couvrir, chemins de `docs/design.md` (ou direction provisoire), de `docs/prd.md` et `docs/brief.md` (s'ils existent), de la spec et de `docs/user-stories.md` (maquettes ; s'ils existent) et de `aidd_docs/memory/glossary.md`. Si les sous-agents ne sont pas disponibles, lancer `pulse-aidd agent designer`, lire ses consignes et produire les variantes soi-même, une par une. Chaque agent rend 3 lignes (Thèse / Ce qui la distingue / Fichiers) : les garder pour la comparaison.

**Comparer** : lancer `pulse-aidd comparer <dossier>`, puis ouvrir le fichier affiché (section « Ouvrir une page »). Si la commande échoue (aucune variante), le dire et relancer la génération manquante.

## Sans argument

1. Lire `docs/`, `docs/design.md`, les specs (`aidd_docs/tasks/*/SPEC-US-*.md`), `docs/design/maquettes/`. Chercher du code d'interface à l'emplacement indiqué par « Organisation des fichiers » de `docs/technical.md`, sinon dans le code existant (Glob, Grep).
2. Recommander une action (AskUserQuestion, la recommandée en premier) :
   - pas de `docs/design.md` → `identite` ;
   - une spec avec des écrans et sans dossier `docs/design/maquettes/<spec>/` → `maquettes <US-XXX de cette spec>` ;
   - du code d'interface → `audit`.
3. Attendre la réponse avant de lancer quoi que ce soit. Puis suivre la section de l'action choisie.

## identite

### Prérequis

- `docs/prd.md` est nécessaire. Sinon, proposer `/pulse:prd` et s'arrêter.
- Lire `docs/brief.md`, `aidd_docs/memory/` et le glossaire s'ils existent.
- Si `docs/design.md` existe : demander « Le revoir » / « Le garder ». Le garder termine la commande. Le revoir : appliquer la règle « Noms des dossiers » (anciennes directions déplacées dans `alternatives/`) et déplacer aussi l'ancien `retenue/` dans `docs/design/identite/alternatives/retenue-<AAAA-MM-JJ>/`.

### Déroulé

1. **Ce que l'on sait déjà.** Déduire des documents le public, les écrans probables et l'hypothèse de registre. Affirmer puis faire confirmer, par exemple : « Votre outil sert à *utiliser*, pas à *convaincre* : je pars sur le registre outil, d'accord ? ». Si le projet contient déjà une interface : relever ses couleurs, polices et composants (fichiers réels, cités) et demander s'il faut les **garder comme base** ou **repartir de zéro**.
2. **Entretien**, par rondes de 4 questions au plus, en langage courant. Demander uniquement ce que les documents laissent ouvert. Sujets :
   - la scène d'usage (qui, où, quand, sur quel écran) ;
   - la personnalité en 3 mots (réponses proposées concrètes, réponse libre possible) ;
   - 2 ou 3 outils ou sites dont la personne aime l'allure, 1 ou 2 dont elle veut se démarquer ;
   - l'intensité de couleur (les 4 stratégies de « Règles d'interface », traduites en langage courant) ;
   - un logo, des couleurs ou une police imposés.

   Laisser de côté codes couleur et noms de police : la personne décrit, vous traduisez. Après chaque ronde, reformuler en 1 ou 2 lignes (« ✔ Décidé : … »).
3. **Directions.** Construire 2 ou 3 directions réellement différentes : au moins 2 axes parmi stratégie de couleur, typographie, densité, forme, ambiance claire / sombre. Donner à chacune une thèse en une phrase. Montrer le plan en 3 lignes, puis lancer les agents de génération (type `planche`), un par direction, dossier `docs/design/identite/d<n>-<slug>/`. Chaque agent écrit `planche.html` et `note.md` : palette par rôle avec contrastes, titres et texte, boutons et champs dans leurs états, une liste, un message d'erreur, un état vide, avec des contenus fictifs tirés du projet (glossaire, US).
4. **Comparer.** Lancer `pulse-aidd comparer docs/design/identite`, ouvrir `comparer.html` (section « Ouvrir une page »), expliquer chaque thèse en une ligne.
5. **Choisir dans le chat** : une direction ; un hybride (un agent `pulse:designer` assemble la planche hybride, dossier `d<n+1>-hybride-<slug>`) ; ou « aucune, … » (retour à l'étape 3 avec la nouvelle consigne). Vérifier les contrastes du choix (calculer) : si un texte est sous 4,5:1, le corriger et le dire.
6. **Écrire.**
   - Copier la planche choisie (ou l'hybride) et son `note.md` dans `docs/design/identite/retenue/`.
   - Écrire `docs/design.md` à partir du modèle `design.md` : **toutes** les sections remplies ; écrire « sans objet » quand une section ne s'applique pas.
   - Montrer un résumé en 5 lignes et demander « Valider » / « Modifier quelque chose ».
   - Proposer `/pulse:memory retenir` pour le registre et la stratégie de couleur.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:us` si `docs/user-stories.md` n'existe pas encore (cas habituel : l'identité se définit juste après `/pulse:tech`) ; sinon `/pulse:spec <US-XXX>`, ou `/pulse:ui maquettes <US-XXX>` si une spec avec des écrans existe déjà.

## maquettes

### Prérequis

- La spec de l'US désignée existe (`aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md`). Argument absent ou introuvable : lister les specs et demander (règle commune).
- `docs/design.md` est fortement conseillé. S'il manque, demander : « Définir l'identité d'abord (Recommandé) » / « Continuer avec une direction provisoire ». Avec une direction provisoire, la décrire dans le message de délégation et le signaler dans chaque `note.md`.

### Déroulé

1. **Écrans.** Lire la section « Écrans » de la spec. Faire choisir les écrans à maquetter (AskUserQuestion multiSelect, le parcours principal recommandé), **3 écrans au plus** par passage. Si `docs/design/maquettes/<spec>/` existe déjà : « Compléter avec d'autres écrans » / « Refaire » / « Garder ».
   - « Garder » termine la commande : bloc de fin, prochaine étape `/pulse:plan <US-XXX>`.
   - « Refaire » : déplacer d'abord `retenue/` dans `alternatives/retenue-<AAAA-MM-JJ>/`.
   - « Compléter » : ajouter les nouveaux écrans dans `retenue/` sous les noms `desktop-<k>.html` et `mobile-<k>.html` (k = 2, 3…) ; le `note.md` de `retenue/` indique quels écrans chaque fichier couvre.
2. **Plan des variantes.** N variantes : 3 par défaut, 2 à 4 si la personne le demande. Chacune a une thèse et une différence d'organisation ou d'interaction (navigation, ordre des informations, mode de saisie, densité). Montrer le plan en 3 lignes avant de générer.
3. **Générer** : lancer les agents de génération (type `maquette`), un par variante, dossier `docs/design/maquettes/<spec>/v<n>-<slug>/`. Chacun écrit `desktop.html`, `mobile.html` et `note.md`, en respectant `docs/design.md` et la liste noire, avec des données fictives réalistes (glossaire, US) et les états clés de chaque écran montrés (vide, chargement, erreur).
4. **Contrôler la différence.** Si deux variantes diffèrent seulement par le style, le dire et proposer : « Régénérer celle-ci avec une autre thèse (Recommandé) » / « Garder ainsi ».
5. **Comparer.** Lancer `pulse-aidd comparer docs/design/maquettes/<spec>`, ouvrir la page, expliquer chaque thèse en une ligne.
6. **Choisir dans le chat** : une variante pour les deux formats ; « desktop = a, mobile = b » ; un hybride (un agent `pulse:designer` assemble, dossier `v<n+1>-hybride-<slug>`) ; ou « aucune, … » (retour à l'étape 2).
7. **Enregistrer.**
   - Copier le choix dans `docs/design/maquettes/<spec>/retenue/`, avec un `note.md` qui dit d'où vient chaque partie.
   - Déplacer les autres variantes dans `docs/design/maquettes/<spec>/alternatives/`, puis supprimer `comparer.html` devenu périmé (`pulse-aidd comparer` a besoin de variantes pour le régénérer).
   - Avec l'accord de la personne, ajouter à la section « Écrans » de la spec : « Maquette : `docs/design/maquettes/<spec>/retenue/` ».
   - Laisser le commit à une étape ultérieure.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:plan <US-XXX>`.

## audit

Cible : un écran, un fichier, un dossier, ou toute l'interface (vide = toute l'interface, à l'emplacement indiqué par « Organisation des fichiers » de `docs/technical.md`, sinon le code existant). Vérifier d'abord que le fichier ou l'écran existe (Glob, Grep) ; sinon, lister ce qui existe et demander.

1. **Lancer l'audit.** Expliquer en une phrase qu'il se fait en lecture seule. Lancer le sous-agent `pulse:ui-critic` ; s'il n'est pas disponible, lancer `pulse-aidd agent ui-critic` et appliquer ses consignes soi-même, en lecture seule. Lui indiquer : la cible, le chemin de `docs/design.md` (ou « absent »), la ou les maquettes retenues des specs dont relève la cible (`docs/design/maquettes/<spec>/retenue/`), l'emplacement du code d'interface d'après « Organisation des fichiers », et les trois références.
2. **Contenu attendu.** Pour 5 rubriques (fidélité à `docs/design.md` et à la maquette ; anti-patterns ; états manquants ; accessibilité : contraste, focus visible, libellés, taille des cibles ; textes d'interface) : des constats classés 🔴 bloquant, 🟠 important, 🟢 finition, chacun avec le fichier, ce qui se voit, pourquoi c'est gênant et la correction proposée ; plus 3 points « ce qui va bien ». La réponse commence par une ligne `Verdict : …`, suivie du rapport complet.
3. **Enregistrer.** Écrire sa réponse à partir de sa deuxième ligne (la première, `Verdict : …`, est réservée au résumé dans le chat ; le modèle a sa propre ligne **Verdict**), dans `docs/design/audits/ui-<AAAA-MM-JJ>.md` (ajouter `-2`, `-3` si le fichier existe déjà), selon le modèle `revue-ui.md`.
4. **Présenter** l'essentiel en 5 lignes : le verdict, les 🔴, ce qui va bien.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:ui polish` ; `/pulse:refine` pour un constat qui change le besoin ou le parcours ; `/pulse:fix` pour un comportement cassé.

## polish

1. **Partir du rapport** `docs/design/audits/ui-*.md` le plus récent qui couvre la cible. S'il n'y en a pas, faire d'abord l'audit (section « audit »).
2. **Trier.** Retenir les constats **purement visuels ou de texte** : apparence et libellés seulement, hors logique métier, données et contrôle d'accès. Renvoyer les autres vers `/pulse:refine` (besoin ou parcours) ou `/pulse:fix` (comportement cassé), en le disant.
3. **Faire choisir.** Montrer la liste ; la personne coche ceux à appliquer (AskUserQuestion multiSelect, les 🔴 cochés par défaut dans la recommandation).
4. **Appliquer** par petits lots. Avant d'écrire du code, lancer `pulse-aidd qualite` et appliquer ces règles. Respecter la pile retenue (`docs/technical.md`), `docs/design.md` et la maquette retenue. Lancer ensuite les contrôles automatiques de « Commandes du projet » (sauter ceux qui valent « aucune »).
5. **Vérifier.** Demander à la personne de vérifier dans son navigateur. Marquer les constats corrigés (✅) dans le rapport.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:commit`.

## Ouvrir une page

Après `pulse-aidd comparer`, ouvrir le fichier affiché (« Page de comparaison : <chemin> ») avec la commande du système (avec l'outil Bash ; sous PowerShell : `Start-Process "<chemin>"`) :
- Windows : `start "" "<chemin>"` ;
- macOS : `open "<chemin>"` ;
- Linux : `xdg-open "<chemin>"`.

En cas d'échec, afficher le chemin complet et dire : « Double-cliquez sur ce fichier pour l'ouvrir dans votre navigateur. »
