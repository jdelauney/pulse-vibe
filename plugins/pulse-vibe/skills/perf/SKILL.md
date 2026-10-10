---
description: Mesurer et améliorer la vitesse vécue par les visiteurs - chargement simulé en plusieurs passages (médiane), données des vrais visiteurs, 3 priorités corrigées avec avant/après, mesure réelle, budget et suivi automatique
argument-hint: "[mesurer | corriger | suivre] (vide : mesurer)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte perf) Bash(pulse-aidd perf *) Bash(pulse-aidd reference performance.md) Bash(pulse-aidd reference fichiers-projet.md) Bash(pulse-aidd reference cycle.md) Bash(pulse-aidd modele performance.md) Bash(pulse-aidd modele lexique.md) Bash(pulse-aidd modele confidentialite.md) Bash(pulse-aidd qualite) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sonder *) Bash(git status *) Bash(git log *) Bash(git branch --show-current) Read Glob Grep
---

# /pulse:perf – La vitesse vécue par vos visiteurs

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte perf`

Appliquer les « Règles communes Pulse » et la référence « La vitesse vécue par les visiteurs » ci-dessus pendant toute la commande. Le modèle cité plus bas figure ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte perf` et lire sa sortie.

Action demandée : `$ARGUMENTS`

## Objectif

Faire vivre à la personne ce que vit son visiteur, puis l'améliorer, chiffres à l'appui. Phrase d'ouverture : « Imaginons un visiteur sur téléphone, en 4G moyenne. Voici ce qu'il vit en ouvrant votre site. »

Trois règles tiennent toute la commande (détails dans la référence) :
- chaque chiffre dit sa **source** : simulation (laboratoire) ou vrais visiteurs (terrain), dans deux tableaux distincts ;
- chaque chiffre de simulation est une **médiane** de plusieurs passages, avec son écart ; une mesure instable se refait avant de conclure ;
- **trois priorités au plus**, chacune avec ce que vit le visiteur, la cause en mots simples, le gain attendu et qui décide.

| Action | Question de la personne | Section |
|---|---|---|
| `mesurer` (défaut) | « Mon site est-il rapide ? » | « mesurer » |
| `corriger` | « Que faut-il changer, et ça a marché ? » | « corriger » |
| `suivre` | « Mes vrais visiteurs vivent-ils la même chose, et comment le garder ? » | « suivre » |

**Frontières**, à dire si la demande en sort : l'accessibilité réelle et l'apparence relèvent de `/pulse:ui audit` (le score d'accessibilité de Lighthouse n'en est qu'un indice) ; les en-têtes de sécurité, de `/pulse:security entetes` ; la lenteur côté serveur (requêtes en base, quotas) devient une ligne « côté serveur » du rapport, puis `/pulse:fix` ou une user story.

## Prérequis (toutes les actions)

1. `docs/technical.md` : pile, « Commandes du projet », « Hébergement et mise en ligne » (ligne « Site en ligne »). Absent : proposer `/pulse:tech` et s'arrêter.
2. Le site à mesurer, construit pour la production :
   - **en ligne** : l'adresse de « Adresses » dans `CLAUDE.md` ou de « Site en ligne » ;
   - **sinon, en local** : la commande « Construire », puis servir le résultat en mode production d'après les consignes du pack de pile ou la documentation officielle de la pile (le mode développement donne des chiffres sans rapport avec la réalité). Lancer ce serveur en arrière-plan sur un port libre, noter son numéro de processus, et l'arrêter à la fin de la commande, lui seul.
   - Ni l'un ni l'autre possible (rien à construire encore) : proposer `/pulse:deploy` ou la première tâche du plan, et s'arrêter.
3. `docs/performance.md` : s'il existe, le lire (pages suivies, budget, dernière mesure, priorités) ; sinon, il sera créé à partir du modèle `performance.md`.
4. **La source** : lancer `pulse-aidd perf cle`.
   - Clé présente et site en ligne : PageSpeed Insights.
   - Sinon, proposer (AskUserQuestion) : « Mesurer sur ce poste, sans clé (Recommandé pour commencer) » / « Créer ma clé Google d'abord (5 minutes) ». La clé : suivre « La clé Google » de la référence, une étape à la fois. La personne colle la clé elle-même dans la fenêtre de son système ; si une clé apparaît dans la conversation, appliquer « Clé compromise » de la référence.
   - Une mesure sur ce poste se compare seulement avec une autre mesure de ce poste : le dire une fois.

## mesurer

1. **Les pages.** « Pages suivies » de `docs/performance.md` existe : la reprendre telle quelle, et proposer d'ajouter une page seulement si un nouveau gabarit est apparu. Sinon : trouver les pages publiques (plan du site `sitemap.xml`, liens de la page d'accueil, « Organisation des fichiers » de `docs/technical.md`, consignes du pack de pile), proposer 3 à 5 pages, **une par gabarit** (accueil, liste, détail, formulaire public), et faire valider la liste (AskUserQuestion, « Recommandé » sur la proposition). Les pages réservées aux personnes connectées restent hors mesure : le dire en une phrase.
2. **Annoncer la durée** : environ 30 secondes par passage, 3 passages par page.
3. **Mesurer** : `pulse-aidd perf mesurer <adresse>[,<adresse>…] --passages 3 --json docs/performance/mesures/<AAAA-MM-JJ>.json` (ajouter `--source local` pour une mesure sur ce poste ; `--appareil ordinateur` seulement sur demande). Si le fichier du jour existe déjà, suffixer `-2`, `-3`. Une page marquée « Instable » : la remesurer seule avec `--passages 5` avant d'en parler.
4. **Vrais visiteurs** (clé présente, site en ligne) : `pulse-aidd perf terrain <adresse du site>`. « Pas encore de données » : l'expliquer comme une étape normale et proposer `/pulse:perf suivre` pour une mesure réelle.
5. **Choisir 3 priorités au plus**, à partir des diagnostics du passage médian, de la table « Lire les diagnostics de Lighthouse 13 » et des consignes du pack de pile : le plus grand gain d'abord ; un diagnostic présent sur plusieurs pages compte une fois ; le socle normal du framework se signale sans devenir une priorité.
6. **Présenter**, dans cet ordre :
   1. une phrase de verdict par page, avec les feux de l'affichage du contenu principal (LCP), de la stabilité (CLS) et des blocages pendant le chargement (TBT) ;
   2. la source et la fiabilité (« Simulation de Google, téléphone moyen en 4G lente, médiane de 3 passages, écart 0,2 s ») ;
   3. les vrais visiteurs, dans un tableau à part, s'il y en a ;
   4. les 3 priorités : ce que vit le visiteur, la cause en mots simples, l'élément désigné en langage clair (« la grande photo de l'accueil »), le gain attendu, qui décide ;
   5. en secondaire : poids et nombre de requêtes, scores d'accessibilité et de SEO technique (contrôles automatiques seulement), réponse du serveur ;
   6. la phrase juste sur Google de la référence (§ 1).
   Le profil « Développeur » reçoit aussi les identifiants des diagnostics et les valeurs brutes.
7. **Lexique** : LCP, CLS, INP, Core Web Vitals, simulation (laboratoire), vrais visiteurs (terrain), avec les images du quotidien de la référence.
8. **Écrire `docs/performance.md`** (modèle `performance.md`) : « Pages suivies », « Dernière mesure », « Vrais visiteurs », « Priorités », une ligne d'« Historique ». Garder le budget existant. Montrer le résumé, puis écrire.

Prochaine étape : `/pulse:perf corriger` s'il y a une priorité, sinon `/pulse:perf suivre`.

## corriger

**Prérequis** : une mesure avec des priorités (`docs/performance.md`, « Priorités », et son JSON dans `docs/performance/mesures/`). Sinon, faire « mesurer » d'abord.

1. **Choisir** : présenter les priorités « à faire » (AskUserQuestion, plusieurs choix possibles, toutes recommandées si Pulse les corrige seul). Une priorité qui relève d'un choix de la personne (outil tiers, police, vidéo d'accueil, hébergement) : présenter 2 ou 3 options avec leurs conséquences, et laisser décider.
2. **Point de comparaison** :
   - source PageSpeed Insights : la dernière mesure sert d'« avant » ;
   - source locale : mesurer d'abord l'« avant » sur ce poste, construction de production actuelle, `--passages 5 --json docs/performance/mesures/<AAAA-MM-JJ>-avant.json`.
3. **Corriger** : appliquer les règles de qualité (`pulse-aidd qualite`), les consignes « Pack de pile » et la documentation officielle de la pile ; changer seulement ce que demande la priorité. Lancer ensuite les contrôles automatiques et la commande « Construire » de « Commandes du projet » : une erreur se corrige avant d'aller plus loin.
4. **Mesurer l'« après »** :
   - source locale : servir la nouvelle construction, puis `pulse-aidd perf mesurer … --source local --passages 5 --json docs/performance/mesures/<AAAA-MM-JJ>-apres.json` ;
   - source PageSpeed Insights : enregistrer (`/pulse:commit`), mettre en ligne avec l'accord de la personne (`/pulse:deploy`), vérifier avec `pulse-aidd sonder <adresse>`, puis mesurer avec `--passages 5`.
5. **Comparer** : `pulse-aidd perf comparer <avant.json> <apres.json>`. Annoncer une amélioration seulement sur les lignes « mieux » ; « dans le bruit » se dit tel quel, avec la proposition de remesurer.
6. **Écrire** dans `docs/performance.md` : statut de chaque priorité (« corrigé le … », ou « écarté : raison »), « Dernière mesure », une ligne d'« Historique » avec l'avant/après. Proposer `/pulse:commit` pour le code et le document, puis la mise en ligne si elle reste à faire.
7. Placer le **rapport de réalisation** des règles communes avant le bloc de fin : la preuve d'une correction est la ligne « mieux » de `pulse-aidd perf comparer`.

Prochaine étape : `/pulse:perf suivre` si la mesure réelle ou le budget manquent.

## suivre

Trois volets, proposés un par un (AskUserQuestion), chacun facultatif.

1. **Mesure réelle chez les visiteurs.** Utile tant que les données des vrais visiteurs manquent, et pour voir toutes les pages. Avec un pack de pile : `pulse-aidd pile recette mesure-reelle` ; sinon, la documentation officielle de la pile et de la bibliothèque `web-vitals`. Présenter les options de la recette (service de l'hébergeur, ou envoi vers une route du site) avec leurs limites, et laisser choisir. Mettre à jour la mention de confidentialité du site (modèle : `pulse-aidd modele confidentialite.md`) avec l'outil choisi et ce qu'il recueille. La mise en place suit la recette ; le code passe ensuite par `/pulse:commit` et `/pulse:deploy`.
2. **Tendance des vrais visiteurs** (clé présente, site en ligne) : `pulse-aidd perf terrain <adresse du site> --historique`. Résumer en une phrase par mesure (« le contenu principal s'affiche plus vite depuis 6 semaines »).
3. **Budget et vérification automatique.**
   - Proposer un budget à partir de la dernière mesure (§ « Le budget » de la référence), le faire valider, l'écrire dans « Budget » de `docs/performance.md`, puis le vérifier : `pulse-aidd perf budget <dernière mesure.json> docs/performance.md`.
   - Proposer la vérification automatique, avec le fournisseur de CI de « Hébergement et mise en ligne » (sa documentation officielle pour la syntaxe). `pulse-aidd perf installer` copie le script de mesure dans `scripts/perf.js` du projet ; la CI l'appelle avec `node scripts/perf.js`.
     - **Chaque semaine, sur le site en ligne (Recommandé)** : tâche planifiée et déclenchable à la main ; Node.js LTS ; `node scripts/perf.js mesurer <adresse du site> --pages docs/performance.md --source psi --passages 3 --json mesure.json`, puis `node scripts/perf.js budget mesure.json docs/performance.md` ; `mesure.json` gardé comme fichier joint du passage. La clé va dans les secrets du dépôt sous le nom `PULSE_PSI_CLE`, saisie par la personne. Un budget dépassé fait échouer la tâche : le fournisseur prévient par e-mail ; les fusions restent libres.
     - **Sur chaque demande de fusion** : installer, construire, servir la construction en mode production en arrière-plan, attendre qu'elle réponde, puis `node scripts/perf.js mesurer http://localhost:<port> --pages docs/performance.md --source local --passages 3 --json mesure.json` et `budget`. La machine de CI diffère du poste : commencer en mode informatif (l'échec de cette étape laisse la CI verte), puis rendre l'étape bloquante quand les chiffres sont stables. PageSpeed Insights ne sert pas ici : les adresses de prévisualisation sont souvent protégées.
   - Montrer le fichier de CI complet, l'écrire avec accord, essayer les deux commandes en local, puis l'enregistrer (`/pulse:commit`) et l'envoyer. Mettre à jour « Mesure réelle et suivi » de `docs/performance.md` et la ligne CI de `docs/technical.md`.

## Fin

Arrêter le serveur local lancé pour la mesure (son numéro de processus), s'il y en a un. Terminer avec le bloc de fin de commande, en citant la source et la médiane des mesures présentées (« LCP 2,1 s, médiane de 3 passages, simulation PageSpeed Insights »).
