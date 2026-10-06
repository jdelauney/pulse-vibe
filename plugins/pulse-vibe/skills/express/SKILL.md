---
description: Démarrer vite - en une seule conversation, l'idée, les écrans, l'apparence et les contraintes deviennent le brief, le PRD et les user stories ; puis les choix techniques et l'identité visuelle, jusqu'à la première US prête à réaliser
argument-hint: "[votre idée en une phrase]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep Bash(start "" *.html") Bash(open *.html") Bash(xdg-open *.html")
---

# /pulse:express – Démarrer vite

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte express`

Appliquer les « Règles communes Pulse », « Penser avant d'écrire » et les « Règles de la mémoire projet » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte express` et lire sa sortie.

Idée de départ (facultative) : `$ARGUMENTS`

## Objectif

Amener la personne, dans une seule conversation, d'une idée à une première user story prête à réaliser, avec les **mêmes documents** que le parcours complet (brief, PRD, user stories, choix techniques, identité visuelle). Phrase à dire : « On va droit au but : quatre blocs de questions, un seul écran de validation, puis on choisit les outils et l'apparence. Vous pourrez tout affiner ensuite. »

La rapidité vient du regroupement des questions et des déductions que Pulse fait lui-même ; les décisions restent celles de la personne.

## Prérequis

- `CLAUDE.md` Pulse présent : sinon, proposer `/pulse:init` et s'arrêter.
- `docs/brief.md`, `docs/prd.md` ou `docs/user-stories.md` existent déjà : le projet a commencé. Proposer (AskUserQuestion) « Reprendre là où en est le projet avec `/pulse:init` (Recommandé) » / « Repartir de zéro en express (les documents existants sont remplacés) ». Remplacer seulement avec cet accord explicite.
- `aidd_docs/tasks/in-progress.md` concerne `/pulse:express` : proposer de reprendre à l'étape notée.

## 1. Annoncer le parcours

Afficher la liste, puis la mettre à jour (⬜ → ✅) à la fin de chaque bloc :

```
⬜ L'idée          pour qui, quel problème, comment on fait aujourd'hui
⬜ Les écrans      ce qu'on voit et ce qu'on fait sur chaque écran
⬜ L'apparence     l'impression que l'outil doit donner
⬜ Les contraintes données personnelles, budget, technologie imposée, échéance
⬜ Validation      un seul écran récapitulatif
⬜ Outils          les choix techniques
⬜ Identité        2 apparences à comparer, vous choisissez
```

## 2. Les quatre blocs

Pour chaque bloc : poser ses questions, puis reformuler en 2 lignes (« ✔ Compris : … ») et faire confirmer. Les questions clés suivent « Penser avant d'écrire » (réponse libre, exemples d'autres métiers) ; les autres passent par AskUserQuestion, en rondes de 4 au plus. Une question déjà tranchée par l'argument ou par une réponse précédente se cite au lieu de se reposer.

1. **L'idée** (questions clés) : pour qui est l'outil ; quel problème il règle et comment la personne s'y prend aujourd'hui ; ce qui lui ferait dire « ça m'aide vraiment ».
2. **Les écrans** : proposer une liste d'écrans déduite de l'idée ; la personne ajoute, retire, renomme. Pour chaque écran principal : ce qu'on y voit, ce qu'on y fait. **Noter chaque action** (réserver, payer, envoyer, se connecter, déposer un fichier…) : c'est la source des déductions de l'étape 3. Demander s'il existe un espace réservé (administration, compte client).
3. **L'apparence** : la personnalité de l'outil en 3 mots (réponses proposées concrètes, réponse libre possible) ; 1 à 3 outils ou sites dont la personne aime l'allure. Codes couleur et polices viendront à l'étape 7.
4. **Les contraintes** : données personnelles ou sensibles ; budget mensuel accepté ; technologie imposée ou refusée ; échéance.

Avant de rendre la main sur une question clé ou une ronde, écrire `aidd_docs/tasks/in-progress.md` (règle commune 16).

## 3. Déduire (sans rien afficher)

À partir des quatre blocs, Pulse déduit lui-même :

- **Le MVP** (MoSCoW) : le parcours le plus court qui règle le problème principal = **Indispensable** ; le reste en Essentiel, Optionnel ou « En attente ».
- **Les epics et les US** (règles de `/pulse:us` : identifiants, `<epic>`, `<nom>`, critères d'acceptation vérifiables), avec un **parcours utilisateur**.
- **Les besoins techniques**, à partir des actions notées : comptes ou espace réservé → connexion ; réservation, commande, fiche, contenu géré → données partagées ; paiement → service de paiement, en mode test ; dépôt de fichiers → stockage ; e-mails ou confirmations → service d'e-mail ; plusieurs langues → traduction. Seulement ce que la personne a décrit : une mesure d'audience, par exemple, attend une demande explicite.

Une ambiguïté qui change le périmètre (paiement unique ou abonnement ? une seule personne ou une équipe ?) : poser **une seule** question ciblée.

## 4. Un seul écran de validation

```
Votre projet en un coup d'œil

Pour qui      : …
Le problème   : …
Le MVP        : US-001 … · US-002 … · US-003 …   (Indispensables, dans l'ordre du parcours)
Ensuite       : US-004 … · US-005 …               (Essentielles, Optionnelles)
Rangement     : epic « … » (dossier <epic>), …
Il faudra     : connexion · données partagées · e-mails …   (déduit de vos réponses)
Proposé par Pulse : …                               (ce que vous n'avez pas dit vous-même)
```

Demander (AskUserQuestion) : « Valider (Recommandé) » / « Modifier quelque chose ». Modifier : appliquer la demande, puis remontrer l'écran.

## 5. Écrire les documents

Avec les modèles ci-dessus, en appliquant « Qui a décidé quoi » (`raisonnement.md` § 5) :

- `docs/brief.md` (blocs 1 et 2) et `aidd_docs/memory/glossary.md` (les mots du métier employés par la personne) ;
- `docs/prd.md` : objectifs, utilisateurs, MVP en MoSCoW, contraintes (bloc 4), questions ouvertes ;
- `docs/user-stories.md` (référentiel) et un fichier `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` par US ;
- les réponses du bloc 3 dans la section « Décisions prises » du brief, sur une ligne « Apparence souhaitée : <3 mots> ; références : … », pour l'étape 7.

Lancer `pulse-aidd memoire`, puis `pulse-aidd travail-fini`.

## 6. Les outils (choix techniques)

Annoncer : « Maintenant, on choisit les outils. » Lancer `pulse-aidd etape tech` et appliquer sa section « Déroulé » à l'identique, hors son bloc de fin de commande. Les besoins de l'étape 3 remplissent d'office le tableau « Les besoins qui guident le choix » : poser seulement les questions restantes.

## 7. L'identité visuelle

Annoncer : « Dernière étape : l'apparence. Vous allez en voir deux et choisir. » Lancer `pulse-aidd etape ui`, puis appliquer la section « identite » avec **2 directions** (au lieu de 2 ou 3) ; l'entretien de l'étape 2 de « identite » part des réponses du bloc 3 et pose seulement ce qui manque.

## Fin

Résumé en 4 lignes : le MVP, la pile retenue, l'apparence choisie, ce qui reste à faire par la personne (comptes à créer, mise en ligne).

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:spirc <première US Indispensable du parcours>`, qui écrit sa spec, son plan, puis la réalise tâche par tâche. Proposer de faire `/clear` avant : la conversation repartira légère.
