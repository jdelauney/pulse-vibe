# Choisir la pile technique (`/pulse:tech`)

`/pulse:tech` joue le rôle d'un **architecte qui parle simplement** : il aide la personne à choisir les technologies de son projet, en partant de son besoin, et explique chaque choix en langage courant. La personne décide ; Claude apporte les faits, les options et une recommandation argumentée.

Pulse n'impose aucune technologie et n'en propose aucune par défaut. Le résultat est écrit dans `docs/technical.md`, qui devient la source unique pour toutes les autres commandes.

## Principes

- **La solution la plus simple qui répond au besoin.** Moins il y a de pièces à comprendre, mieux la personne maîtrise ce qui tourne. Une pièce ne s'ajoute que si le besoin l'exige.
- **Le besoin d'abord, la technologie ensuite.** On ne choisit pas un outil parce qu'il est à la mode ou connu de Claude.
- **Peu de dépendances.** Une bibliothèque ne s'ajoute que si elle évite beaucoup de code, avec une version fixée.
- **Lisible avant d'être malin.** Des fonctions courtes, des noms explicites, des commentaires en français qui expliquent le *pourquoi*. Identifiants en anglais simple, textes affichés en français.
- **Rien de mémoire.** Chaque affirmation sur une technologie (offre gratuite, limite, prix, fonctionnalité, API, région d'hébergement) est vérifiée sur sa documentation officielle et sa page de tarifs actuelles.

## Projet existant ou projet neuf

- **Projet existant** (du code est déjà là) : **documenter la pile observée** dans le code (fichiers de configuration, dépendances déclarées, organisation des dossiers, commandes déjà définies), sans rien inventer. Remplir `docs/technical.md` avec ce qui existe. Ne proposer un changement que si le besoin l'exige vraiment (exigence du PRD impossible à tenir, faille de sécurité, coût disproportionné), en expliquant le coût du changement.
- **Projet neuf** : partir du besoin (`docs/brief.md`, `docs/prd.md`), poser les questions ci-dessous, puis construire 2 à 3 options.

## Les questions à se poser

Chercher d'abord les réponses dans `docs/brief.md` et `docs/prd.md` ; ne poser à la personne que les questions restées ouvertes, une par une.

1. **Utilisateurs et volume** : combien de personnes utiliseront l'outil (une, une équipe, le public) ? Combien de données, à quelle fréquence ?
2. **Partage de données** : les données restent-elles sur un seul appareil, ou doivent-elles être partagées entre personnes ou appareils ?
3. **Comptes et rôles** : faut-il se connecter ? Y a-t-il des rôles différents (client, gestionnaire, administrateur) ?
4. **Données personnelles ou sensibles** : lesquelles ? Où doivent-elles être hébergées pour respecter la loi de protection des données qui s'applique au projet ?
5. **Services externes** : email, paiement, carte, intelligence artificielle, calendrier, fichiers… Lesquels sont indispensables au MVP ?
6. **Plateformes** : ordinateur, téléphone, les deux ? Navigateur ou application installée ?
7. **Référencement** : l'outil doit-il être trouvé par les moteurs de recherche ?
8. **Hors-ligne** : doit-il fonctionner sans connexion internet ?
9. **Budget** : combien la personne accepte-t-elle de payer par mois, aujourd'hui et dans 6 mois ?
10. **Expérience** : la personne ou son équipe connaît-elle déjà une technologie ? Est-elle accompagnée d'un développeur ?
11. **Contraintes et exclusions** : une technologie imposée par le client, l'employeur ou un outil existant ? Une technologie que la personne refuse ?

## Critères d'évaluation

Pour chaque option, évaluer :

| Critère | Question |
|---|---|
| Simplicité | Combien de pièces faut-il comprendre pour savoir ce qui tourne ? Y a-t-il une étape de construction ? |
| Courbe d'apprentissage | La personne peut-elle lire et modifier le code après quelques heures ? |
| Coût réel à 6 mois | Avec le volume prévu, que coûtent l'hébergement, la base et les services ? Que se passe-t-il à la sortie de l'offre gratuite ? |
| Sécurité intégrée | Le contrôle d'accès aux données se vérifie-t-il côté serveur ou dans la base ? L'authentification est-elle fournie et éprouvée, ou à écrire soi-même ? |
| Maturité et documentation | La technologie est-elle maintenue, largement utilisée, documentée clairement (si possible en français) ? |
| Localisation des données | Peut-on choisir la région d'hébergement ? Le contrat de traitement des données est-il disponible ? |
| Verrouillage fournisseur | Peut-on exporter ses données et changer de fournisseur sans tout réécrire ? |
| Mise en ligne et test local | Peut-on tester sur son ordinateur facilement ? La mise en ligne est-elle automatique depuis le dépôt ? |

## Construire 2 à 3 options

- Les options doivent être **réellement différentes** (par exemple : sans serveur ni compte, avec un service de données géré, avec un serveur à soi), pas trois variantes de la même chose.
- Au moins une option est **la plus simple possible** qui couvre le MVP.
- Pour chaque option : en une phrase, ce que c'est ; le **coût** mensuel estimé à 6 mois ; les **points forts** pour ce projet ; **1 à 3 risques honnêtes** (limite de l'offre gratuite, complexité, verrouillage, localisation des données).
- **Vérifier chaque option** sur sa documentation officielle et sa page de tarifs actuelle (outil de documentation comme context7 s'il est disponible, sinon WebFetch) : existence et nom exact, offre gratuite et limites, région d'hébergement, fonctionnalités nécessaires. Ne **jamais** affirmer de mémoire une offre gratuite, un prix ou une API. Si une information ne peut pas être vérifiée, le dire.
- Donner une **recommandation** et sa raison en une phrase, puis laisser la personne choisir.

## Règles transverses, quelle que soit la technologie

- **Secrets** : jamais dans le code envoyé au client (navigateur, application installée), ni dans une variable exposée au client. Ils vivent dans des variables d'environnement : en local dans un fichier d'environnement non versionné (listé dans `.gitignore`), en production dans les réglages de l'hébergeur. `.env.example` liste les noms, sans valeur.
- **Une clé publique** (prévue par le service pour être visible côté client) peut être dans le code client ; ce qui protège alors les données, c'est le contrôle d'accès côté serveur ou dans la base.
- **Contrôle d'accès** : toujours vérifié côté serveur ou par des règles au niveau de la base, jamais seulement en cachant un bouton. Phrase à retenir : **« Si ce n'est pas interdit côté serveur, c'est autorisé. »**
- **Paiements en mode test** d'abord : cartes de test, aucune vraie transaction ; le passage en mode réel est une décision de la personne, au moment de la mise en ligne.
- **Services payants** (email, IA, SMS) : vérifier les tarifs, fixer une limite de dépense si le service le permet, empêcher le déclenchement en boucle.
- **1 à 2 services externes au plus** pour un MVP. Les autres attendent une version suivante.
- **Confidentialité** : noter où sont hébergées les données personnelles ; ce sera repris dans la mention de confidentialité (`pulse-aidd modele confidentialite.md`). Un outil de statistiques de visite respectueux de la vie privée, sans cookies, est préférable.

## Anti-complaisance

- Ne pas valider un choix de la personne par politesse : si la technologie demandée est surdimensionnée, coûteuse ou risquée pour ses données, le dire avec les faits vérifiés, puis respecter sa décision.
- Ne pas recommander la technologie que Claude connaît le mieux, mais celle qui sert le mieux le besoin.
- Signaler ce qu'on ne sait pas, et ce qui coûtera plus tard (migration, montée en charge).

## Ce que `/pulse:tech` écrit dans `docs/technical.md`

Suivre le modèle `pulse-aidd modele technical.md`, avec les sections suivantes (noms exacts) :

- « Les besoins qui guident le choix » : les réponses aux questions, en phrases courtes.
- « Les options comparées » : les 2-3 options, coût, points forts, risques, sources vérifiées.
- « Pile retenue » : langage, framework éventuel, données, connexion, code serveur, hébergement, services, avec les versions.
- « Organisation des fichiers » : observée (projet existant) ou décidée (projet neuf, selon `qualite/organisation.md` : palier, nommage, suffixes, tests) ; où va le code client, le code serveur, les fichiers publiés, ce qui reste privé (`docs/` ne doit jamais être publié).
- « Commandes du projet » : installer, lancer en local, tester, contrôles automatiques (lint, format, types), construire, déployer. Une commande absente s'écrit « aucune ». Chaque commande est vérifiée dans la documentation officielle ou dans les fichiers du projet.
- « Données et contrôle d'accès » : où sont les données, qui peut lire et écrire quoi, et où c'est vérifié côté serveur ou dans la base.
- « Secrets et variables d'environnement » : le fichier local non versionné, les noms des variables (lesquelles sont publiques, lesquelles sont secrètes), où les saisir en production.
- « Hébergement et mise en ligne » : hébergeur, région, dépôt distant, CI éventuelle.
- « Mise en place » : les étapes de départ, dans l'ordre.
- « Ce qu'on a écarté » : les options non retenues et pourquoi.

Une décision difficile à défaire (hébergement des données, service de connexion) se propose aussi en fichier de décision (`/pulse:memory retenir`).
