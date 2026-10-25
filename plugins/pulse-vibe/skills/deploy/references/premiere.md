# Première mise en ligne

Utilisé par `/pulse:deploy`, en première mise en ligne (§ 2), après les contrôles du § 1. Avec un pack de pile, ses consignes de première mise en ligne (`pulse-aidd pile contexte deploy-premiere`) s'appliquent à chaque étape.

Chaque envoi déclenche une demande d'accord de Claude Code : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. Le dire en une phrase avant le premier envoi (3a), puis avant chacun des suivants.

## 3a. Le dépôt distant

Un dépôt distant est déjà relié (`git remote -v`, par exemple depuis `/pulse:init`) : l'envoyer à jour (annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. » ; puis `git push`) et passer à 3b. Sinon, appliquer « 1. Relier le projet à un dépôt distant » (`pulse-aidd reference depot-distant.md`) ; le fournisseur est celui de « Hébergement et mise en ligne ». Si la personne répond « Non, plus tard », expliquer qu'une mise en ligne passe par un dépôt distant, et s'arrêter.

## 3b. Relier le dépôt à l'hébergeur (à faire par la personne, guidé)

Suivre la documentation officielle de l'hébergeur retenu, et la traduire en étapes simples, une à la fois :
1. Se connecter à l'hébergeur (avec le compte du dépôt distant si c'est proposé : c'est souvent le plus simple).
2. Créer un nouveau site ou projet à partir d'un dépôt existant, autoriser l'accès au dépôt, choisir le dépôt.
3. Vérifier les réglages de construction et de publication d'après « Commandes du projet » (commande « construire », ou aucune) et « Organisation des fichiers » (dossier publié ou point d'entrée). Si un fichier de configuration de l'hébergeur est nécessaire, le proposer d'après sa documentation, le montrer avant de l'écrire, puis l'enregistrer en appliquant l'étape **commit** (`pulse-aidd etape commit --sans-communes`, puis `pulse-aidd reference regles-taches.md` et `pulse-aidd reference regles-realisation.md` (trois appels séparés, chaque sortie lue en entier)).
4. Si l'appli a besoin de variables d'environnement (« Secrets et variables d'environnement », `.env.example`) : appliquer `pulse-aidd reference deploy/variables.md` **avant** le premier déploiement, sinon la construction ou l'appli échoue.
5. Lancer le premier déploiement, attendre la fin, puis renommer le site si souhaité.
6. Me coller l'adresse du site.

Ensuite : inscrire l'adresse du dépôt et celle du site dans la section « Adresses » de `CLAUDE.md`, dans `README.md` et dans la ligne « Site en ligne » de « Hébergement et mise en ligne » (`docs/technical.md`). Puis **prouver** que le site répond : `pulse-aidd sonder <adresse du site> --texte "<un texte visible de la page, ex. le nom du projet>"`. En cas d'échec, lire la cause qu'il donne, l'expliquer simplement, corriger avec la personne (réglages de construction, variable manquante), puis relancer la sonde.

Ensuite, **garde-fou de référencement** : `pulse-aidd seo <adresse du site> --essentiel` (ajouter `--previsualisation` pour une adresse de prévisualisation). Il lit `docs/seo.md` (site privé, pages privées). S'il affiche ❌ (constat Critique : `noindex` sur une page publique, `Disallow: /`, adresse officielle vers localhost ou un autre domaine, boucle de redirections, page privée servie à un inconnu), la mise en ligne n'est pas déclarée réussie : expliquer le constat et sa conséquence, corriger, remettre en ligne, relancer.

Le site répond et le garde-fou passe : proposer une **première mesure de vitesse** (AskUserQuestion) : « Mesurer la vitesse de la page d'accueil maintenant (2 minutes, point de départ) (Recommandé) » / « Plus tard ». Maintenant : `pulse-aidd perf cle` (clé absente : ajouter `--source local` à la mesure), puis `pulse-aidd perf mesurer <adresse du site> --passages 3 --json docs/performance/mesures/<AAAA-MM-JJ>.json` ; donner la ligne de l'accueil (feu et médiane) ; écrire `docs/performance.md` (modèle `pulse-aidd modele perf/performance.md` : « Pages suivies » = l'accueil, « Dernière mesure », une ligne d'« Historique ») ; les priorités viendront avec `/pulse:perf`. Puis passer à 3c.

## 3c. Voir le déploiement automatique en action

Proposer une petite modification visible (par exemple le texte du titre), puis appliquer l'étape **commit** (`pulse-aidd etape commit --sans-communes`, puis `pulse-aidd reference regles-taches.md` et `pulse-aidd reference regles-realisation.md` (trois appels séparés, chaque sortie lue en entier), argument `push`), et suivre l'avancement dans la liste des déploiements de l'hébergeur. Rafraîchir le site quand le déploiement est terminé. C'est le moment « waouh » : la nouvelle version est en ligne sans rien faire d'autre.
