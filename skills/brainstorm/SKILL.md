---
description: Raconter l'idée par un entretien guidé et approfondi (arbre de décisions), produire le brief et le glossaire du projet (domain storytelling)
argument-hint: "[votre idée en une phrase]"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd *) Read Glob Grep
---

# /pulse:brainstorm – Du besoin au brief

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte brainstorm`

Appliquer les « Règles communes Pulse » et les « Règles de la mémoire projet » ci-dessus pendant toute la commande. Les modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte brainstorm` et lire sa sortie.

Idée reçue en argument (facultative) : `$ARGUMENTS`

## Objectif

Arriver à une **compréhension partagée** de l'idée, où tout est dit explicitement, puis l'écrire :

- `docs/brief.md` : l'idée racontée **en mots simples**, sous forme d'histoire (domain storytelling) ;
- `aidd_docs/memory/glossary.md` : les mots du métier, tranchés et définis, **au fil de l'entretien** ;
- les décisions prises, dans la mémoire (une ligne, ou un fichier de décision si elle remplit les 3 conditions).

On parle du **métier** : la technique (base de données, framework, écrans détaillés) viendra plus tard.

## Prérequis

- Si `CLAUDE.md` n'existe pas : proposer `/pulse:init` d'abord, mais accepter de continuer si la personne le souhaite (créer alors `aidd_docs/memory/glossary.md` avec son modèle quand le premier mot est tranché).
- Si `docs/brief.md` existe : demander s'il faut le **compléter** ou **repartir de zéro**. Pour compléter, partir des « Questions ouvertes » du brief existant.

## Les principes de l'entretien

Appliquer « Penser avant d'écrire » ci-dessus : les branches marquées **clé** ci-dessous se posent en question clé (réponse libre, exemples, reformuler et confronter) ; les autres en rondes à choix.

### 1. Un arbre de décisions, parcouru par rondes

Chaque sujet à trancher est une **branche** ; certaines dépendent d'autres (les règles d'annulation se discutent une fois qu'on sait qui réserve). À chaque instant, la **frontière** regroupe les questions dont tous les prérequis sont déjà tranchés : on peut les poser maintenant en s'appuyant uniquement sur des réponses déjà entendues.

- **Une ronde = la frontière.** Ses questions clés se posent d'abord, une par message, en réponse libre. Ses questions secondaires se posent ensuite en **un seul appel AskUserQuestion** (4 questions au maximum ; s'il y en a plus, garder les plus structurantes et reporter les autres à la ronde suivante).
- Chaque question secondaire propose **2 à 4 réponses concrètes et réalistes** (un « oui / non » seulement pour une question fermée). **La réponse recommandée est la première**, avec « (Recommandé) » dans son libellé et une description qui dit pourquoi. La personne peut toujours écrire sa propre réponse.
- Une question qui dépend d'une autre question **de la même ronde** attend la ronde suivante.
- Après chaque ronde : **reformuler en 1 ou 2 lignes** ce qui est décidé (« ✔ Décidé : … »), recalculer la frontière, puis poser la ronde suivante.
- Afficher la progression en une ligne : « Ronde 3 · encore environ 2 sujets à éclaircir ».

Branches de départ habituelles (à adapter aux réponses) :

| Ronde typique | Branches |
|---|---|
| 1 | **clé** l'idée en une phrase (si l'argument est vide) · **clé** les acteurs · **clé** comment ça se passe aujourd'hui et ce qui coince · **clé** ce qui ferait dire « ça m'aide vraiment » dans un mois |
| 2 | **la validation de l'histoire** (premier jet, voir § 3) · les contraintes connues (données personnelles, budget mensuel, délai) |
| 3 et + | les zones d'ombre révélées par l'histoire : **clé** la règle métier centrale, puis règles secondaires, cas limites, mots ambigus |

**Travail en cours** : après chaque ronde ou question clé, mettre à jour `aidd_docs/tasks/in-progress.md` (règle commune 16) avec les décisions prises, les mots tranchés et la prochaine question. Le supprimer après l'écriture du brief.

### 2. Les faits, c'est vous ; les décisions, c'est la personne

- **Chercher d'abord dans les fichiers ; demander à la personne le reste.** Avant chaque ronde, consulter ce qui existe : `docs/`, `aidd_docs/memory/` (surtout `glossary.md` et `project.md`), et le code s'il y en a. Dans un projet qui contient déjà du code, confier la recherche au sous-agent **`pulse:explorer`** et continuer pendant sa recherche : seules les questions qui dépendent de sa réponse sont reportées.
- **Les décisions appartiennent à la personne** : besoin, priorités, règles métier, périmètre. Les poser, attendre la réponse, la laisser trancher.
- **S'en tenir à la complexité qu'elle a mentionnée.** Si elle n'a jamais parlé de comptes utilisateurs, l'histoire n'en contient pas. On peut poser la question ; la décision lui revient.

### 3. L'histoire (domain storytelling)

Dès que l'idée, les acteurs et la situation actuelle sont connus, **rédiger un premier jet** (5 à 12 lignes) :
`Il était une fois **{{Nom}}**, {{ce que c'est}}…` puis des puces `L'acteur → action → objet`, avec des sous-puces pour les précisions. Utiliser des exemples réalistes et fictifs (noms, objets et situations du métier de la personne, inventés mais plausibles).

La validation de l'histoire est une question de la ronde suivante : « Est-ce bien ça ? » → « Oui, c'est ça (Recommandé) » / « Il manque quelque chose » / « Quelque chose est faux ». Relever ensuite dans l'histoire les **zones d'ombre** qui changent le comportement de l'outil : ce sont les branches des rondes suivantes.

### 4. Les mots du métier (glossaire vivant)

- **Confronter au glossaire** : si la personne emploie un mot dans un autre sens que celui de `glossary.md`, le signaler aussitôt. « Votre glossaire définit "<mot>" comme X, mais vous semblez parler de Y. Lequel est le bon ? »
- **Préciser les mots flous** : quand un mot est vague ou sert à deux choses, proposer un terme précis. « Vous dites "<mot>" : <sens A>, ou <sens B> ? »
- **Tester avec des scénarios concrets** : inventer des cas limites réalistes qui obligent à préciser les frontières. « <Un acteur> fait <une action>, puis l'annule juste avant <l'échéance> : que se passe-t-il ? »
- **Écrire au fil de l'eau** : dès qu'un mot est tranché, l'ajouter ou le corriger dans `aidd_docs/memory/glossary.md` (format des règles de la mémoire), tout de suite. Le dire en une ligne : « 📖 Ajouté au glossaire : **<mot>**. »

### 5. Les décisions

Quand une réponse tranche une question structurante, la noter dans la liste des décisions (§ « Fin de l'entretien »). Proposer un **fichier de décision** (modèle « décision (ADR) », dans `aidd_docs/memory/internal/decisions/`) **seulement** si les 3 conditions sont réunies : difficile à défaire, surprenante sans contexte, fruit d'un vrai choix entre plusieurs options.

### 6. Garder la personne à l'aise

- Employer des mots simples. Une question technique qui surgit est notée pour `/pulse:spec`, qui la posera.
- **Après la 4ᵉ ronde**, ajouter à la ronde une question : « On continue d'approfondir ? » → « Continuer (Recommandé) » s'il reste des branches structurantes, ou « Rédiger le brief maintenant » ; les sujets restants deviennent alors des **questions ouvertes** du brief.

## Fin de l'entretien

L'entretien est terminé quand **la frontière est vide** : toutes les branches visitées, tout dit explicitement (ou quand la personne choisit de s'arrêter).

1. Présenter un **récapitulatif** court : la phrase de synthèse, l'histoire, les décisions prises (« ✔ … »), les mots ajoutés au glossaire, les questions restées ouvertes.
2. **Test de compréhension** : demander, dans la conversation : « Présentez votre outil en une phrase, comme vous le feriez à un client. » Cette phrase devient la phrase de synthèse du brief. Si elle s'écarte de l'histoire validée (un acteur ou un besoin absent, un autre centre de gravité), le dire et en parler avant de rédiger. Puis demander (AskUserQuestion) : « Rédiger le brief (Recommandé) » / « Je veux corriger quelque chose ».

## Rédiger

1. Remplir le modèle `docs/brief.md` et écrire `docs/brief.md` : la phrase de synthèse, le problème, les acteurs, l'histoire validée, les décisions (« Décidé par vous » / « Proposé par Pulse, accepté »), les hypothèses à vérifier, les questions encore ouvertes (cases à cocher), la réussite. Pour le vocabulaire, le brief **renvoie au glossaire**.
2. Vérifier que `aidd_docs/memory/glossary.md` contient tous les mots tranchés.
3. Mémoire : compléter la section « Vision » de `aidd_docs/memory/project.md` (résumé, public cible, problème principal) et ajouter une ligne datée par décision structurante dans « Décisions importantes ». Montrer ces lignes avant de les écrire.
4. Mettre à jour la ligne de description en haut de `CLAUDE.md` si elle contient encore `{{…}}`.
5. Lancer `pulse-aidd memoire` pour que la prochaine session charge le glossaire.

## Valider

Montrer la phrase de synthèse et l'histoire. Demander une validation (AskUserQuestion : « Valider » / « Modifier quelque chose »). Corriger si besoin.

Terminer avec le bloc de fin de commande. Prochaine étape : `/pulse:prd`, pour décider de ce qui entre dans la première version (MVP).
