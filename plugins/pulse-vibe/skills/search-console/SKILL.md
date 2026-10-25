---
description: Relier le site à Google Search Console (et Bing), puis lire ce que Google voit vraiment, en lecture seule — chiffres, requêtes à potentiel, pages oubliées, indexation — et suivre l'évolution tous les 28 jours
argument-hint: "[relier | lire [28j|3m] | suivre | inspecter <adresse>] (détecté si vide)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte search-console) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sonder *) Bash(pulse-aidd search-console lire*) Bash(pulse-aidd search-console suivre*) Bash(pulse-aidd search-console inspecter *) Bash(pulse-aidd search-console proprietes*) Bash(pulse-aidd search-console connecter *) Bash(git status *) Bash(git log *) Bash(pulse-aidd travail-fini) Write(aidd_docs/tasks/in-progress.md) Edit(aidd_docs/tasks/in-progress.md) Edit(docs/technical.md) Write(docs/referencement/**) Edit(docs/referencement/**) Bash(pulse-aidd etape *) Bash(pulse-aidd contexte commit) Bash(pulse-aidd contexte deploy) Bash(pulse-aidd contexte fix) Bash(pulse-aidd contexte auto-fix) Bash(pulse-aidd contexte cicd) Bash(pulse-aidd sessions *) Bash(pulse-aidd revue *) Bash(pulse-aidd verifier) Bash(pulse-aidd seo *) Bash(pulse-aidd secrets inventaire *) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd installer-ci) Bash(pulse-aidd installer-hook) Bash(pulse-aidd agent *) Bash(pulse-aidd qualite *) Bash(pulse-aidd perf *) Bash(pulse-aidd guide) Bash(pulse-aidd pile contexte *) Bash(git diff *) Bash(git remote -v) Bash(git remote get-url *) Bash(pulse-aidd preuve *) Bash(pulse-aidd verifier --index) Bash(pulse-aidd secrets historique *) Bash(pulse-aidd secrets verifier *) Bash(pulse-aidd secrets journal *) Bash(pulse-aidd pile secrets fiche *)
---

# /pulse:search-console – Ce que Google voit de votre site

## Objectif

Donner à la personne le tableau de bord que Google lui tend, en trois temps : **relier** le site (une fois), **lire** ce que Google en voit, **suivre** l'évolution tous les 28 jours. Tout se fait en lecture seule, avec les droits de la personne. L'analogie à donner au début : « Search Console, c'est le tableau de bord que Google vous tend : ce qu'il a trouvé sur votre site, et ce que les gens ont tapé pour vous trouver. »

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte search-console` et lire sa sortie en entier) pendant toute la commande.

## Contexte

Action demandée (facultative) : `$ARGUMENTS`

Fichiers de cette commande : [references/search-console.md](references/search-console.md), [references/relier.md](references/relier.md), [assets/rapport-search-console.md](assets/rapport-search-console.md), [scripts/search-console.js](scripts/search-console.js).

### 0. Prérequis et choix de l'action

1. Le site est en ligne : ligne « Site en ligne » de `docs/technical.md` (ou section « Adresses » de `CLAUDE.md`). Absente ou « pas encore en ligne » : proposer `/pulse:deploy`, et s'arrêter.
2. L'adresse est la **définitive** (le domaine que verront les clients). Un changement de domaine prévu bientôt : proposer de relier après ce changement, pour éviter de recommencer.
3. Sans argument, choisir l'action :
   - section « Référencement » absente de `docs/technical.md`, ou Search Console notée « à relier » → `relier` ;
   - aucun rapport dans `docs/referencement/` → `lire` ;
   - dernier rapport de 28 jours ou plus → `suivre` ;
   - dernier rapport plus récent → dire la date du prochain rapport conseillé (écrite à la fin du dernier rapport), puis proposer (AskUserQuestion) : « Inspecter une page », « Relire quand même (Recommandé si vous venez de corriger quelque chose) », « Rien pour l'instant ».

Annoncer le calendrier dès la première utilisation (référence, § 1).

## Processus

### 1. `relier` – une étape à la fois

Charger `pulse-aidd reference search-console/relier.md` et le suivre, étapes 1a à 1g, une à la fois, en notant l'avancement comme il le dit (« Avancement »). Après un compactage, recharger `pulse-aidd reference search-console/relier.md` avant de reprendre l'étape en cours ; un fichier d'identifiants se donne toujours par son chemin, jamais par son contenu. Deux gestes propres à cette commande :

- 1b, pour mettre la balise en ligne : `pulse-aidd etape commit --sans-communes`, puis `pulse-aidd reference regles-taches.md` et `pulse-aidd reference regles-realisation.md` (trois appels séparés, chaque sortie lue en entier) (argument `push`), puis `pulse-aidd etape deploy --sans-communes` (mise à jour).
- 1c, quand une étape attend (propagation DNS) : en plus de l'avancement noté dans « Référencement », la noter dans `aidd_docs/tasks/in-progress.md` (règle commune 16, modèle `pulse-aidd modele in-progress.md`), puis l'effacer avec `pulse-aidd travail-fini` une fois la propriété vérifiée.

### 2. `lire [28j | 3m]`

1. Source des données :
   - connexion enregistrée → `pulse-aidd search-console lire --periode <28j|3m> --ecrire` ;
   - sinon, guider l'export (référence, § 2.1), demander le chemin de l'archive, puis `pulse-aidd search-console lire --fichier <chemin> --ecrire` ; proposer la connexion seulement si la personne veut éviter l'export à chaque fois.
2. Le script écrit `docs/referencement/search-console-<date>.md` et l'instantané `docs/referencement/donnees/<date>.json`. Un rapport du même jour existe déjà : demander avant de le remplacer.
3. Selon le code de sortie (tableau de la référence, § 2) : 6 → « pas encore de données, c'est normal », date de retour ; 2, 3, 4, 5 → expliquer simplement et proposer la suite indiquée.
4. Présenter le rapport : d'abord « En bref », puis les **3 actions prioritaires**. Relire chaque action avec le code réel (la page qui répond à la requête existe-t-elle ? son titre ?) ; la reformuler ou la remplacer si le code montre mieux, et mettre à jour le rapport. Chaque chiffre cité est suivi de son sens et de ce qu'il faut faire, ou de « rien à faire, c'est normal ».
5. Échantillon d'indexation : le présenter comme un échantillon, et renvoyer au rapport « Indexation des pages » de l'interface pour la vue complète.
6. Rappeler ce que l'API ne montre pas (référence, § 6) : rapport IA générative, réglage « Search generative AI » (décision de la personne, à relier à `/pulse:seo ia`), et le rapport « AI Performance » de Bing, à ouvrir dans son interface.
7. Première écriture dans `docs/referencement/donnees/` d'un dépôt public : proposer de l'ajouter au `.gitignore` (données personnelles possibles dans les requêtes).
8. Proposer d'enregistrer : `/pulse:commit`.

### 3. `suivre`

1. Connexion enregistrée : `pulse-aidd search-console suivre --ecrire` lit les 28 derniers jours et les 28 jours d'avant (mêmes jours de la semaine). Export : la personne exporte la nouvelle période, puis `pulse-aidd search-console suivre --fichier <chemin> --ecrire` compare au dernier instantané.
2. Relier les écarts aux changements du site : `git log --since=<début de la période précédente> --oneline`, les journaux des plans, et le journal du rapport précédent. Compléter la section « Journal des changements du site » du nouveau rapport (date, page, changement). Un écart sans changement connu : le dire simplement (saisonnalité, mise à jour de Google, concurrence), sans inventer de cause.
3. Proposer d'ajouter une **annotation** dans le graphique de Search Console pour chaque changement important (date et texte court, visible par tous les utilisateurs de la propriété).
4. Les 3 actions prioritaires, comme pour `lire`.

### 4. `inspecter <adresse>`

1. Adresse complète d'une page du site. Connexion absente : expliquer que l'inspection passe par la connexion en lecture seule (`pulse-aidd reference search-console/relier.md`, § 1f), ou guider l'inspection dans l'interface (barre en haut de Search Console).
2. `pulse-aidd search-console inspecter <adresse>`, puis expliquer l'état (référence, § 4) : ce qu'il veut dire, et quoi faire.
3. Rappeler que c'est l'état de la version déjà indexée, et que la demande d'indexation se fait dans l'interface (Inspection de l'URL → Demander l'indexation), page par page.

### 5. Clore

Transformer les actions retenues en demandes (`/pulse:spirc "…"` ou `/pulse:seo textes <page>`). Une page qui change d'adresse reçoit une redirection permanente (301).

Terminer avec le bloc de fin de commande ; « Prochaine étape » donne la date du prochain rapport conseillé (`/pulse:search-console suivre`, dans 28 jours) ou la première action à réaliser.

## Exemples

- `/pulse:search-console relier` : une étape à la fois, vous ajoutez votre site dans Search Console avec votre compte Google, puis vous déclarez le plan du site.
- `/pulse:search-console lire` : un rapport court dans `docs/referencement/`, avec les 3 actions prioritaires expliquées simplement.
- `/pulse:search-console` sans argument, 28 jours après le dernier rapport : la comparaison avec la période d'avant, reliée aux changements faits sur le site.

## Références de la commande

!`pulse-aidd contexte search-console`

Ce contexte contient aussi « Search Console : relier, lire, suivre », « Modèle : docs/referencement/search-console-<date>.md », « Modèle : docs/lexique.md » et, avec un pack de pile, ses consignes ; `relier.md` et le modèle du travail en cours se chargent à leur étape. Si ce contexte est absent, lancer `pulse-aidd contexte search-console` et lire sa sortie.
