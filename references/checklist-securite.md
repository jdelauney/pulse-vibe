# Checklist sécurité Pulse

Utilisée par `/pulse:spec` (exigences), `/pulse:review` et `/pulse:spirc` (vérification), `/pulse:security` (audit).

Chaque point a un identifiant pour pouvoir y faire référence dans les rapports. Certains points ne s'appliquent que **si l'application a un serveur, une base ou des comptes** : sinon, les marquer « non concerné ». La façon de vérifier dépend de la pile retenue : lire « Pile retenue », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md`, et la documentation officielle de la technologie.

## S1 – Secrets hors du code
- Aucune clé, aucun mot de passe, aucune chaîne de connexion dans le code ni dans l'historique Git.
- Le fichier d'environnement local est listé dans `.gitignore`. `.env.example` existe et ne contient que des noms de variables, sans valeur réelle.
- Test : `git ls-files` ne montre aucun fichier d'environnement (hors `.env.example`) ; `pulse-aidd verifier` ne signale rien.

## S2 – Clés côté client (si l'application appelle un service avec une clé)
- Seules les clés **publiques** (prévues par le service pour être visibles) apparaissent dans le code envoyé au client (navigateur, application installée).
- Aucune clé secrète (accès complet à la base, paiement, email, IA…) dans le code envoyé au client, ni dans une variable exposée au client (voir la convention de la pile retenue dans sa documentation).
- Les appels qui nécessitent une clé secrète passent par du code serveur.

## S3 – Contrôle d'accès aux données (si l'application a une base partagée ou des comptes)
- Le contrôle d'accès est vérifié **côté serveur ou par des règles au niveau de la base**, pour chaque table ou collection, tel que décrit dans « Données et contrôle d'accès ».
- Chaque table ou collection a des règles explicites : qui peut lire, créer, modifier, supprimer. Aucune règle « tout le monde peut tout faire » sur des données privées.
- Un utilisateur ne voit et ne modifie que **ses** données, sauf rôle autorisé (admin, manager).
- Test du cambrioleur : connecté en « Client B », peut-on voir ou modifier une donnée du « Client A » en changeant un identifiant dans l'adresse ou dans la requête ?

## S4 – Pages et actions réservées (si l'application a des comptes ou des rôles)
- Les pages et actions d'administration sont protégées **côté serveur ou dans la base** (rôle vérifié à chaque requête), pas seulement en cachant un bouton.
- Test : ouvrir directement l'adresse de la page admin avec un compte non admin.

## S5 – Validation des entrées
- Les champs obligatoires, les longueurs maximales et les formats sont contrôlés **côté serveur** (code serveur, contraintes de la base : non nul, vérification, longueur) en plus de l'interface. Sans serveur, la validation dans l'interface suffit, puisqu'aucune donnée ne quitte l'appareil.
- Seuls les champs attendus sont acceptés (liste blanche).
- Test : envoyer un formulaire vide, un texte très long, des caractères spéciaux (`<script>`, `' OR 1=1 --`, émojis).

## S6 – Affichage sans injection (XSS)
- Les données saisies par un utilisateur sont **affichées comme du texte**, avec le mécanisme d'affichage sûr de la technologie retenue.
- On n'interprète **jamais** du HTML construit avec une saisie. Si du contenu riche est indispensable, il est nettoyé par une bibliothèque reconnue.
- Test : créer un élément dont le titre est `<img src=x onerror=alert(1)>` et vérifier qu'il s'affiche comme du texte.

## S7 – Fichiers (si l'application stocke des fichiers envoyés)
- Les espaces de stockage contenant des documents privés sont **privés**. Les téléchargements utilisent des **liens temporaires** (signés, à durée limitée).
- Le type et la taille des fichiers envoyés sont contrôlés côté serveur.
- Test : copier un lien de téléchargement, se déconnecter, l'ouvrir en navigation privée.

## S8 – Dépendances
- Chaque bibliothèque est connue, existe sous ce nom exact (vérifié dans sa documentation officielle ou son registre), et sa **version est fixée** (jamais « dernière version » sans numéro).
- Si l'outil de gestion des dépendances de la pile produit un **fichier de verrouillage**, il est versionné dans Git.
- L'**outil d'audit des vulnérabilités** de la pile (voir sa documentation) ne signale aucune faille critique ou élevée.
- Elle est chargée depuis une source officielle. Aucune bibliothèque inutile.

## S9 – Données personnelles
- On ne collecte que les données **nécessaires** (minimisation).
- Une mention de confidentialité explique quelles données sont collectées, pourquoi, où elles sont hébergées, et comment demander leur suppression (modèle : `pulse-aidd modele confidentialite.md`).
- Il est possible de supprimer les données d'une personne sur demande.
- Aucune vraie donnée personnelle n'a été utilisée pendant le développement ni collée dans un prompt.

## S10 – Abus et coûts
- Les formulaires publics sont protégés contre le spam (champ piège invisible, limite de fréquence, ou confirmation).
- Les fonctions qui coûtent de l'argent (email, IA, SMS) ne peuvent pas être déclenchées en boucle par un inconnu (limitation de fréquence côté serveur).
- Les opérations sensibles évitent les doublons (même opération enregistrée deux fois, double paiement) grâce à une contrainte d'unicité dans la base.

## S11 – Messages d'erreur
- Les erreurs affichées à l'utilisateur sont compréhensibles et ne révèlent rien d'interne (clé, requête à la base, chemin de fichier).
- Aucun journal (log) ne contient de données personnelles ou de jetons.

## S12 – En-têtes de sécurité (si l'application est servie par le web)
- Le site envoie des en-têtes de sécurité (CSP, HSTS, X-Frame-Options ou `frame-ancestors`, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), configurés là où la pile retenue le permet : voir `/pulse:security entetes`.

---

## Fiche du cambrioleur (tests manuels, sans compétence technique)

À adapter au projet par `/pulse:security`. Chaque test se coche ✅ (protégé) ou ❌ (faille).

1. **Sans être connecté** : en navigation privée, ouvrez chaque page de l'appli. Voyez-vous des données ?
2. **Changer de compte** : connectez-vous avec le compte test « Client B ». Voyez-vous une donnée du « Client A » ? Essayez en changeant un numéro dans l'adresse.
3. **Action interdite** : avec un compte simple, essayez une action réservée (page admin, modification, suppression).
4. **Secrets** : sur le dépôt en ligne, ouvrez les fichiers du projet. Voyez-vous une clé, un mot de passe ou un fichier d'environnement ?
5. **Formulaire malmené** : envoyez un formulaire vide, un texte énorme, et `<img src=x onerror=alert(1)>`.
6. **Doublon** : essayez de faire deux fois la même chose en même temps (enregistrer deux fois la même opération, payer deux fois).
