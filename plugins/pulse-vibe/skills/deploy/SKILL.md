---
description: Mettre l'appli en ligne et la mettre à jour automatiquement à chaque envoi, puis passer en mode production (variables, services, retour arrière ; les contrôles automatiques se mettent en place avec /pulse:cicd)
argument-hint: "[premiere | production] (détecté automatiquement si vide)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte *) Bash(pulse-aidd etape *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd qualite) Bash(pulse-aidd verifier) Bash(pulse-aidd installer-ci) Bash(pulse-aidd sonder *) Bash(pulse-aidd seo *) Bash(pulse-aidd perf *) Bash(pulse-aidd secrets inventaire*) Bash(pulse-aidd secrets historique*) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd installer-hook) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(git status *) Bash(git ls-files *) Bash(git grep -n *) Bash(git grep -l *) Bash(git remote -v) Bash(git remote get-url *) Bash(git remote add origin *) Bash(gh auth status*) Bash(glab auth status*) Bash(git log *) Bash(git branch --show-current) Bash(git branch -M main) Bash(git rev-parse *) Bash(node scripts/verifier.js)
---

# /pulse:deploy – Mettre en ligne

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte deploy`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte deploy` et lire sa sortie.

Mode demandé (facultatif) : `$ARGUMENTS`

## Objectif

Mettre l'appli en ligne, et faire comprendre la chaîne :
**commit → envoi (push) vers le dépôt distant → l'hébergeur détecte la nouvelle version → il la met en ligne tout seul.**

Analogie à donner : « C'est comme un document partagé qui se met à jour tout seul : chaque fois que vous envoyez une nouvelle version sur le dépôt distant, le site se met à jour en quelques minutes. C'est le déploiement continu (CD). »

## 0. Prérequis : la mise en ligne est choisie

Lire la section « Hébergement et mise en ligne » de `docs/technical.md` : hébergeur, dépôt distant, CI éventuelle. Lire aussi « Commandes du projet » (en particulier « construire » et « déployer ») et « Secrets et variables d'environnement ».

- `docs/technical.md` absent, ou hébergeur / dépôt distant encore à choisir (vides ou « aucune ») : expliquer qu'il faut d'abord choisir où mettre l'appli en ligne, et proposer `/pulse:tech`. S'arrêter là, avant toute installation ou configuration.
- Pour chaque étape propre à l'hébergeur, au dépôt distant ou à la CI retenus : suivre **leur documentation officielle** (outil de documentation comme context7 s'il est disponible, sinon WebFetch). Tirer de cette documentation chaque libellé, menu ou nom de fichier de configuration ; si la documentation est inaccessible, le dire et guider à partir de ce que la personne voit à l'écran.

## 1. Contrôles avant envoi (toujours)

1. Dépôt Git présent, sinon proposer `/pulse:init`.
2. Branche : `git branch --show-current`. Si c'est `master`, proposer `git branch -M main` et expliquer que `main` est la branche publiée.
3. Tout est enregistré : si `git status --short` liste des fichiers, proposer `/pulse:commit` d'abord.
4. Secrets : lancer `pulse-aidd verifier` depuis la racine du projet. Il vérifie que les fichiers d'environnement restent hors de Git et que le projet est exempt de clés secrètes. S'il échoue, expliquer chaque problème simplement et corriger avant d'aller plus loin.
5. Contrôles du projet : lancer les contrôles automatiques, la commande « Tester » et la commande « Construire » de « Commandes du projet » (celles qui ont une valeur autre que « aucune »). Une erreur ou un test en échec bloque l'envoi : proposer `/pulse:fix` ou `/pulse:auto-fix`. Si aucune commande de contrôle ni de test n'existe, le signaler et proposer d'en ajouter avec `/pulse:tech`.
6. Sécurité, avant la **première** mise en ligne (aucun dépôt distant, mode `premiere`, ou ligne « Site en ligne » de `docs/technical.md` encore vide) : appliquer à l'identique le contrôle rapide de `/pulse:security rapide` (`pulse-aidd reference securite/rapide.md`, en lecture seule). Un ⛔ bloque la mise en ligne : le corriger d'abord (une clé exposée se traite avec `/pulse:secrets fuite`). Les ⚠️ s'affichent avec leur correction proposée, et la mise en ligne continue.

## 2. Choisir le mode

- `premiere`, ou **aucun dépôt distant** (`git remote -v` vide) → **Première mise en ligne** (section 3).
- `production`, ou projet qui stocke des données ou utilise des secrets (« Données et contrôle d'accès », « Secrets et variables d'environnement ») sans `scripts/verifier.js` → **Mode production** (section 5), après la section 4 si besoin.
- Sinon → **Mise à jour** (section 4).

## 3. Première mise en ligne

Chaque envoi déclenche une demande d'accord de Claude Code : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. Le dire en une phrase avant le premier envoi (3a), puis avant chacun des suivants dans cette commande.

### 3a. Le dépôt distant

Un dépôt distant est déjà relié (`git remote -v`, par exemple depuis `/pulse:init`) : l'envoyer à jour (`git push`) et passer à 3b. Sinon, appliquer « 1. Relier le projet à un dépôt distant » de la référence « Le dépôt distant et l'envoi du travail » ; le fournisseur est celui de « Hébergement et mise en ligne ». Si la personne répond « Non, plus tard », expliquer qu'une mise en ligne passe par un dépôt distant, et s'arrêter.

### 3b. Relier le dépôt à l'hébergeur (à faire par la personne, guidé)

Suivre la documentation officielle de l'hébergeur retenu, et la traduire en étapes simples, une à la fois :
1. Se connecter à l'hébergeur (avec le compte du dépôt distant si c'est proposé : c'est souvent le plus simple).
2. Créer un nouveau site ou projet à partir d'un dépôt existant, autoriser l'accès au dépôt, choisir le dépôt.
3. Vérifier les réglages de construction et de publication d'après « Commandes du projet » (commande « construire », ou aucune) et « Organisation des fichiers » (dossier publié ou point d'entrée). Si un fichier de configuration de l'hébergeur est nécessaire, le proposer d'après sa documentation, le montrer avant de l'écrire, puis l'enregistrer avec `/pulse:commit`.
4. Si l'appli a besoin de variables d'environnement (« Secrets et variables d'environnement », `.env.example`) : les faire saisir **avant** le premier déploiement (section 5, point 2), sinon la construction ou l'appli échoue.
5. Lancer le premier déploiement, attendre la fin, puis renommer le site si souhaité.
6. Me coller l'adresse du site.

Ensuite : inscrire l'adresse du dépôt et celle du site dans la section « Adresses » de `CLAUDE.md`, dans `README.md` et dans la ligne « Site en ligne » de « Hébergement et mise en ligne » (`docs/technical.md`). Puis **prouver** que le site répond : `pulse-aidd sonder <adresse du site> --texte "<un texte visible de la page, ex. le nom du projet>"`. En cas d'échec, lire la cause qu'il donne, l'expliquer simplement, corriger avec la personne (réglages de construction, variable manquante), puis relancer la sonde.

Ensuite, **garde-fou de référencement** : `pulse-aidd seo <adresse du site> --essentiel` (ajouter `--previsualisation` pour une adresse de prévisualisation). Il lit `docs/seo.md` (site privé, pages privées). S'il affiche ❌ (constat Critique : `noindex` sur une page publique, `Disallow: /`, adresse officielle vers localhost ou un autre domaine, boucle de redirections, page privée servie à un inconnu), la mise en ligne n'est pas déclarée réussie : expliquer le constat et sa conséquence, corriger, remettre en ligne, relancer.

Le site répond et le garde-fou passe : proposer une **première mesure de vitesse** (AskUserQuestion) : « Mesurer la vitesse de la page d'accueil maintenant (2 minutes, point de départ) (Recommandé) » / « Plus tard ». Maintenant : appliquer « mesurer » de `/pulse:perf` (`pulse-aidd etape perf --sans-communes`) sur l'accueil seul, 3 passages, puis revenir à 3c.

### 3c. Voir le déploiement automatique en action

Proposer une petite modification visible (par exemple le texte du titre), puis : `/pulse:commit`, `git push`, et suivre l'avancement dans la liste des déploiements de l'hébergeur. Rafraîchir le site quand le déploiement est terminé. C'est le moment « waouh » : la nouvelle version est en ligne sans rien faire d'autre.

## 4. Mise à jour

1. Annoncer : « Claude Code va vous demander l'accord pour envoyer : c'est ce qui met votre travail sur le dépôt distant, d'où l'hébergeur le publie. » Puis `git push` (après les contrôles de la section 1).
2. Expliquer que l'hébergeur publie la nouvelle version automatiquement, et où suivre l'avancement (liste des déploiements de l'hébergeur).
3. Une fois la publication terminée chez l'hébergeur, lancer `pulse-aidd sonder <adresse du site>` (section « Adresses » de `CLAUDE.md`), avec `--texte` suivi d'un texte que la nouvelle version affiche, puis `pulse-aidd seo <adresse du site> --essentiel` (même règle qu'en 3b : ❌ = mise en ligne à corriger). Donner l'adresse à la personne pour qu'elle regarde la nouveauté.
4. Si cette version change une page de « Pages suivies » dans `docs/performance.md`, proposer `/pulse:perf mesurer` en une ligne (la mesure reste au choix de la personne : elle prend quelques minutes).

## 5. Mode production (« pour de vrai »)

Expliquer d'abord l'**intégration continue (CI)** : « Avant chaque mise en ligne, un contrôle qualité automatique vérifie le projet. Si le contrôle échoue, l'ancienne version reste en ligne à la place de la nouvelle, défectueuse. »

1. **Installer le contrôle** :
   - si la CI reste à installer : appliquer l'étape **cicd** (`pulse-aidd etape cicd --sans-communes`, § 1 à 6), qui installe `scripts/verifier.js` et les contrôles automatiques à chaque envoi et sur chaque demande de fusion. La personne peut aussi préférer s'appuyer seulement sur l'hébergeur (point suivant) ;
   - si l'hébergeur le permet, le configurer pour exécuter ce contrôle **avant chaque mise en ligne** (commande de construction qui enchaîne `node scripts/verifier.js`, les contrôles du projet, puis la construction), d'après sa documentation ; si le pack de pile fournit déjà une commande de construction (migrations…), insérer les contrôles avant elle, sans la remplacer ;
   - lancer `node scripts/verifier.js` pour vérifier qu'il passe.
2. **Variables d'environnement** : lancer `pulse-aidd secrets inventaire` (noms, présence dans `.env` et chez l'hébergeur, type Secret ou Config, sans aucune valeur). Pour chaque variable absente de la production :
   - le pack de pile sait envoyer à l'hébergeur : `pulse-aidd secrets envoyer <NOM> --env production,preview` (valeur lue dans `.env`, passée par l'entrée standard) ; une valeur propre à la production (clé « live », base de production) passe par `pulse-aidd secrets preparer <NOM> --fichier .env.envoi`, la saisie par la personne, puis `pulse-aidd secrets envoyer <NOM> --env production --depuis .env.envoi --vider` ; un secret généré reçoit une valeur par environnement : `pulse-aidd secrets generer <NOM> --envoyer production,preview`. Une variable que le pack marque « propre à chaque environnement » (adresse de la base, adresse du site, clé « live ») part en production depuis `.env.envoi` : `envoyer` depuis `.env` s'arrête et rappelle ce chemin ; `--meme-valeur` seulement quand la personne confirme que sa valeur locale est aussi celle de la production. Ces envois changent la production : Claude Code demande l'accord de la personne à chaque fois ;
   - sinon : guider la personne pour les saisir **elle-même** dans les réglages de l'hébergeur, en type Secret pour les secrets.
   Les valeurs passent uniquement par l'éditeur de la personne, `.env` et l'hébergeur, **jamais** par cette conversation. Une variable modifiée sert au déploiement suivant : `pulse-aidd secrets redeployer --env production` (ou le bouton de l'hébergeur). Proposer ensuite `/pulse:secrets` pour tenir `docs/secrets.md` à jour.
3. **Services connectés** : si un service de « Pile retenue » (connexion, données, emails…) doit connaître l'adresse du site (liens de connexion, redirections, origines autorisées), guider la personne pour la renseigner, d'après la documentation officielle du service.
4. **Environnements** : si l'hébergeur le propose, expliquer la différence entre une adresse de **prévisualisation** (pour une version parallèle proposée, pour la tester sans toucher au site) et la **production** publiée depuis `main` (le site des clients).
5. **Être trouvé** (si « Être trouvé » de `docs/prd.md` répond oui) : une seule adresse officielle pour le site (domaine définitif, autres variantes redirigées). Le référencement et Search Console suivent en clôture (section 6).
6. **Surveillance** : proposer une sonde de disponibilité, gratuite chez la plupart des services (la personne choisit le sien) : elle appelle l'adresse du site toutes les quelques minutes et prévient par e-mail s'il ne répond plus. Guider la création, faite par la personne, d'après la documentation du service. Pour les erreurs, indiquer que les journaux de l'hébergeur les montrent et où les ouvrir (d'après sa documentation ou le contexte du pack de pile). Noter le service et l'adresse surveillée dans la ligne « Surveillance » de `docs/technical.md` (« aucune » si la personne préfère attendre).
7. **Retour arrière** : montrer la section « Retour arrière » de `docs/technical.md` (le site, puis les données) ; si elle manque, l'écrire d'après les valeurs du pack de pile ou la documentation de l'hébergeur et de la base (modèle « docs/technical.md »). Rassurer : tout reste réparable.
8. **Enregistrer et envoyer** : commit `chore: contrôle automatique avant mise en ligne`, puis `git push` (accord annoncé au § 3). Montrer où voir le résultat de la CI (coche verte ou croix rouge sur le dépôt distant, ou journal de la CI) et le journal du déploiement chez l'hébergeur.

## 6. Clore

Si une tâche « Mettre en ligne… » est `[ ]` ou `[~]` dans un plan de `aidd_docs/tasks/`, la faire passer à `[x]` et ajouter une ligne au journal de ce plan (puis enregistrer ce changement avec un commit `docs: plan à jour` et un `git push`, accord annoncé au § 3).

Site sur son adresse définitive, « Être trouvé » de `docs/prd.md` à oui (ou absent), et section « Référencement » de `docs/technical.md` absente : la prochaine étape proposée est `/pulse:seo lancer` (vérification minimale : Search Console, Bing, carte de partage), puis `/pulse:search-console relier` (données et suivi). Si le pack de pile prévoit un envoi IndexNow, il se fait ici, après les preuves ci-dessous.

Après la première mise en ligne, ou si `docs/securite.md` est absent : proposer `/pulse:security audit` (audit complet et test du cambrioleur), car le site est désormais ouvert à tous.

Terminer avec le bloc de fin de commande, en indiquant l'adresse du site, le résultat de `pulse-aidd sonder` et celui de `pulse-aidd seo --essentiel` (les lignes ✅ ou ❌ qu'ils affichent) comme preuves de la mise en ligne.
