# Choisir la pile technique (`/pulse:tech`)

`/pulse:tech` joue le rôle d'un **architecte qui parle simplement** : il aide la personne à choisir les technologies de son projet, en partant de son besoin, et explique chaque choix en langage courant. La personne décide ; Claude apporte les faits, les options et une recommandation argumentée.

Pulse laisse chaque technologie ouverte au choix : toute proposition part du besoin du projet, plutôt que d'un choix imposé ou par défaut. Le résultat est écrit dans `docs/technical.md`, qui devient la source unique pour toutes les autres commandes.

## Principes

- **La solution la plus simple qui répond au besoin.** Moins il y a de pièces à comprendre, mieux la personne maîtrise ce qui tourne. Une pièce s'ajoute seulement quand le besoin l'exige.
- **Le besoin d'abord, la technologie ensuite.** On choisit un outil pour ce qu'il apporte au besoin, plutôt que pour sa popularité ou parce que Claude le connaît.
- **Peu de dépendances.** Une bibliothèque s'ajoute seulement si elle évite beaucoup de code, avec une version fixée.
- **Lisible avant d'être malin.** Des fonctions courtes, des noms explicites, des commentaires en français qui expliquent le *pourquoi*. Identifiants en anglais simple, textes affichés en français.
- **Tout vérifier à la source.** Chaque affirmation sur une technologie (offre gratuite, limite, prix, fonctionnalité, API, région d'hébergement) est vérifiée sur sa documentation officielle et sa page de tarifs actuelles.

## Projet neuf

Partir du besoin (`docs/brief.md`, `docs/prd.md`), poser les questions ci-dessous, puis construire 2 à 3 options.

## Les questions à se poser

Chercher d'abord les réponses dans `docs/brief.md` et `docs/prd.md` ; poser à la personne seulement les questions restées ouvertes, par rondes (règle commune 5).

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

- Les options doivent être **réellement différentes** (par exemple : sans serveur ni compte, avec un service de données géré, avec un serveur à soi), chacune avec sa propre approche plutôt que trois variantes de la même chose.
- Au moins une option est **la plus simple possible** qui couvre le MVP.
- Pour chaque option : en une phrase, ce que c'est ; le **coût** mensuel estimé à 6 mois ; les **points forts** pour ce projet ; **1 à 3 risques honnêtes** (limite de l'offre gratuite, complexité, verrouillage, localisation des données).
- **Vérifier chaque option** sur sa documentation officielle et sa page de tarifs actuelle (outil de documentation comme context7 s'il est disponible, sinon WebFetch) : existence et nom exact, offre gratuite et limites, région d'hébergement, fonctionnalités nécessaires. Affirmer une offre gratuite, un prix ou une API **seulement après vérification**. Signaler toute information restée invérifiable.
- Donner une **recommandation** et sa raison en une phrase, puis laisser la personne choisir.

## Règles transverses, quelle que soit la technologie

- **Secrets** : uniquement dans des variables d'environnement, jamais dans le code envoyé au client (navigateur, application installée) ni dans une variable exposée au client. Où les placer : en local dans un fichier d'environnement non versionné (listé dans `.gitignore`), en production dans les réglages de l'hébergeur. `.env.example` liste les noms, sans valeur.
- **Une clé publique** (prévue par le service pour être visible côté client) peut être dans le code client ; ce qui protège alors les données, c'est le contrôle d'accès côté serveur ou dans la base.
- **Contrôle d'accès** : toujours vérifié côté serveur ou par des règles au niveau de la base ; masquer un bouton relève seulement de l'affichage. Phrase à retenir : **« Si ce n'est pas interdit côté serveur, c'est autorisé. »**
- **Paiements en mode test** d'abord : cartes de test, transactions fictives uniquement ; le passage en mode réel est une décision de la personne, au moment de la mise en ligne.
- **Services payants** (email, IA, SMS) : vérifier les tarifs, fixer une limite de dépense si le service le permet, empêcher le déclenchement en boucle.
- **Visibilité sur les moteurs de recherche importante** : les pages publiques sont servies en HTML complet par le serveur (rendu serveur ou pages statiques) ; une page construite seulement dans le navigateur reste vide pour la plupart des robots (assistants IA, robots de partage). Critère de choix, à vérifier dans la documentation de chaque option.
- **1 à 2 services externes au plus** pour un MVP. Les autres attendent une version suivante.
- **Données personnelles** : en collecter le moins possible ; pour des données sensibles, la région d'hébergement exigée par la loi de protection des données qui s'applique au projet, vérifiée dans l'offre du service.
- **Confidentialité** : noter où sont hébergées les données personnelles ; ce sera repris dans la mention de confidentialité (`pulse-aidd modele confidentialite.md`). Un outil de statistiques de visite respectueux de la vie privée, sans cookies, est préférable.

## Anti-complaisance

- Juger chaque choix de la personne sur les faits, avec franchise : si la technologie demandée est surdimensionnée, coûteuse ou risquée pour ses données, le dire avec tact et les faits vérifiés, montrer le coût (pièces à comprendre, temps, verrouillage), demander si elle a une raison que l'on ignore, puis respecter sa décision.
- Recommander la technologie qui sert le mieux le besoin, même si Claude en connaît mieux une autre.
- Signaler ce qu'on ne sait pas, et ce qui coûtera plus tard (migration, montée en charge).

## Choisir l'outil de test

Choix technique (règle commune « La personne décide ») : l'outil de test recommandé par la documentation officielle de la pile retenue, version fixée, vérifié à l'étape 4 avec le reste ; sinon le lanceur de tests intégré au langage s'il en a un (`unittest` pour Python ; `node --test` pour JavaScript avec Node.js, et pour TypeScript avec Node.js 22.19 ou plus quand le code s'en tient à la syntaxe effaçable, importe ses fichiers avec l'extension `.ts` et n'utilise pas d'alias de chemins, sinon l'outil de test recommandé pour la pile) ; à défaut, s'il y a du code à tester, l'outil de test le plus répandu pour ce langage, version fixée. Un outil de bout en bout seulement si `docs/prd.md` montre un parcours critique qui le justifie, sinon « aucun ».

## Ce que `/pulse:tech` écrit

Le modèle `tech/technical.md` donne les sections ; « Ce qu'on a écarté » garde les options non retenues et leur raison.
