# Contrôle rapide de sécurité (`/pulse:security rapide`)

Lecture seule : aucun fichier modifié. Durée visée : 2 minutes. Ne remplace pas l'audit complet (`/pulse:security`).

Avant de commencer, lire « Pile retenue », « Commandes du projet », « Données et contrôle d'accès » et « Secrets et variables d'environnement » de `docs/technical.md`. S'il n'existe pas, observer le projet (fichiers de configuration, dépendances déclarées) sans rien supposer. Chaque contrôle se décrit par son intention ; il se réalise avec les outils de la pile retenue, selon leur documentation officielle (ne jamais deviner une commande).

Chaque contrôle donne un statut : ✅ bon · ⚠️ à améliorer · ⛔ à corriger tout de suite · — non concerné (par exemple pas de serveur, pas de base, pas de comptes).

## 1. Dépendances

- Intention : aucune bibliothèque avec une faille connue grave, aucune version non fixée.
- Si la pile a un outil d'audit des vulnérabilités (voir sa documentation), le lancer en excluant si possible les dépendances de développement → nombre de vulnérabilités par gravité. ⛔ si critique ou élevée. Correction proposée : la mise à jour ciblée recommandée par l'outil, jamais une correction forcée qui change de version majeure sans accord (elle peut casser l'appli).
- Le fichier de verrouillage des versions, si l'outil en produit un, est versionné. ⚠️ sinon.
- Bibliothèques chargées depuis une adresse externe : chaque adresse fixe une version. ⚠️ si « dernière version » ou sans version.

## 2. Fichiers sensibles

- `git ls-files | grep -E "(^|/)\.env($|\.)" | grep -v -E "\.env\.(example|sample|template)$"` → ⛔ si un fichier d'environnement est suivi par Git. Si la pile utilise un autre nom de fichier d'environnement (voir « Secrets et variables d'environnement »), le chercher aussi.
- `.gitignore` contient le fichier d'environnement local et ses variantes, et idéalement `*.pem`, `*.key`. ⚠️ sinon.
- `git ls-files | grep -E "\.(pem|key|p12|pfx)$"` → ⛔ si trouvé.

## 3. Secrets dans le code

- `pulse-aidd verifier` (formats de clés de nombreux fournisseurs, mots de passe dans une adresse de base de données…). ⛔ au moindre résultat.
- Variables exposées au client : si la pile a une convention qui rend une variable visible côté client (préfixe, fichier de configuration publique ; voir sa documentation), chercher celles dont le nom évoque un secret, par exemple `git grep -n -E "<préfixe public>[A-Z_]*(SECRET|SERVICE|PRIVATE|PASSWORD)"`. ⛔ si trouvé.
- Recherche de motifs dans le code client : `git grep -n -i -E "secret|private.?key|password\s*[:=]"`, puis lire chaque résultat. ⛔ si une vraie valeur secrète part au client.

## 4. Validation des saisies

- Intention : chaque entrée est contrôlée côté serveur (types, longueurs, formats, liste blanche de champs), en plus de l'interface.
- Sans serveur (données restées sur l'appareil) : les formulaires ont des contrôles dans l'interface (obligatoire, longueur maximale, type).
- Avec serveur : lister chaque point d'entrée serveur réellement présent et vérifier qu'il valide son entrée ; vérifier les contraintes de la base (non nul, vérification, longueur) si le schéma est dans le dépôt. ⚠️ par point d'entrée ou table sans validation.

## 5. En-têtes de sécurité

- Trouver où la pile retenue configure les en-têtes (configuration du serveur, de l'hébergeur ou du framework, selon sa documentation et « Hébergement et mise en ligne »).
- Attendus : `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options` (ou `frame-ancestors` dans la CSP), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. ⚠️ par en-tête manquant → proposer `/pulse:security entetes`.
- Si le site est en ligne : `curl -sI <adresse>` confirme ce qui est réellement envoyé.

## 6. Connexion et droits

- Sans comptes ni données partagées : —.
- Sinon : le contrôle d'accès décrit dans « Données et contrôle d'accès » est vérifié côté serveur ou par des règles au niveau de la base, pour chaque table ou collection ; aucune règle « tout le monde peut tout faire » sur des données privées ; pages et actions d'administration protégées côté serveur, pas seulement en masquant un bouton. ⛔ sinon.

## 7. Limitation des appels (rate limiting)

- Concerné seulement si un point d'entrée **coûte** ou **expose** : envoi d'email, IA, paiement, connexion, formulaire public.
- `git grep -n -i -E "rate.?limit|ratelimit|too.?many.?requests|429"` dans le code serveur, ou réglage équivalent chez l'hébergeur ou le service. ⚠️ par point d'entrée concerné sans limitation (voir la référence de qualité « sécurité du code », `pulse-aidd qualite`).

## Rapport (à afficher, ne pas écrire de fichier)

```
🛡️ Contrôle rapide – <projet> (pile : <résumé de « Pile retenue »>) – <date>
Score : <n>/10   (10 − 2 par ⛔ − 1 par ⚠️, minimum 0)

| Contrôle | Statut | Détail |
|---|---|---|
| Dépendances | ✅/⚠️/⛔/— | … |
| Fichiers sensibles | | |
| Secrets dans le code | | |
| Validation des saisies | | |
| En-têtes de sécurité | | |
| Connexion et droits | | |
| Limitation des appels | | |

⛔ À corriger tout de suite : <action à l'infinitif> …
⚠️ À améliorer : …
```

Puis proposer : corriger les ⛔ maintenant (recommandé), `/pulse:security entetes` si des en-têtes manquent, ou l'audit complet `/pulse:security`.
