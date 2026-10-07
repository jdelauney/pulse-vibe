# Pack Pulse Next.js – pour /pulse:secrets

Fiche par variable du squelette et des recettes : où renouveler, effet, délai de grâce, préfixe attendu, test. Les libellés des tableaux de bord changent : suivez ce chemin, puis ce que la personne voit à l'écran ; en cas d'écart, la documentation officielle citée fait foi (règle 15). Pages consultées le 2026-10-06 ou le 2026-10-07.

## L'hébergeur : Vercel

- **Envoi automatique** : `pulse-aidd secrets envoyer` passe la valeur à `vercel env update` (variable existante) ou `vercel env add … --type secret` (nouvelle), **par l'entrée standard**. Prérequis sur le poste : le Vercel CLI (`npm install -g vercel`), `vercel login`, puis `vercel link` dans le dossier du projet (crée `.vercel/`, déjà ignoré par Git). Sans CLI : la personne saisit la valeur dans Project → Settings → Environment Variables.
- **Type Secret** pour tout secret : sa valeur ne se relit plus, ni par l'équipe ni par le CLI. Une variable déjà enregistrée en type Config se supprime dans les réglages (par la personne), puis se renvoie : elle revient en Secret. Production et Preview sont en Secret par défaut ; Development accepte aussi les Secrets.
- **Une variable modifiée sert au déploiement suivant** : les déploiements existants gardent l'ancienne valeur. `pulse-aidd secrets redeployer --env production` relance le dernier déploiement prêt (`vercel redeploy`). Les adresses de prévisualisation se reconstruisent au prochain envoi de la branche ; une ancienne adresse de prévisualisation cesse de marcher quand l'ancienne valeur est révoquée : c'est attendu.
- **Valeurs distinctes** : Production et Preview reçoivent chacune leur valeur pour les secrets générés (`pulse-aidd secrets generer <NOM> --envoyer production,preview`). Pour Preview, une base Neon de prévisualisation (branche Neon) et des clés de test (Stripe, R2) évitent de toucher aux données réelles.
- **Variables propres à une branche Git** : l'adaptateur les laisse de côté ; elles se gèrent dans les réglages Vercel.
- **Traces d'utilisation** : Vercel → Team → Activity (variables modifiées, déploiements) ; les journaux de chaque fournisseur ci-dessous.
- **Jeton d'accès Vercel** (CLI, CI) : Account Settings → Tokens ; créer le nouveau, mettre à jour la CI, supprimer l'ancien. Les jetons récents commencent par `vcp_` (personnel) ou `vck_` (clé d'API). Test : `vercel whoami`.

Sources : https://vercel.com/docs/cli/env (màj 2026-08-20), https://vercel.com/docs/environment-variables/rotating-secrets (màj 2026-07-15), https://vercel.com/docs/environment-variables/sensitive-environment-variables (màj 2026-08-28), https://vercel.com/docs/cli/redeploy (màj 2026-03-17), https://vercel.com/changelog/new-token-formats-and-secret-scanning (2026-02-09).

## Les variables

### `DATABASE_URL` et `DATABASE_URL_DIRECT`

- **Rôle** : adresses de la base Neon. `DATABASE_URL` (« pooled », l'hôte contient `-pooler`) sert à l'application ; `DATABASE_URL_DIRECT` (sans `-pooler`) aux migrations. Les deux contiennent le **même mot de passe** : elles se renouvellent ensemble.
- **Préfixe attendu** : `postgresql://` (ou `postgres://`).
- **Où renouveler** : console Neon → le projet → sélecteur **Branch** (la branche de production) → **Postgres database** → **Roles** → menu du rôle → **Reset password** → **Reset**. Le nouveau mot de passe s'affiche ; les adresses complètes se copient ensuite depuis le bouton **Connect** (choisir « pooled » puis direct). Pas de commande CLI pour cette opération.
- **Effet** : immédiat pour les nouvelles connexions ; les connexions déjà ouvertes restent actives jusqu'au redémarrage du calcul. Chaque branche Neon a ses propres rôles : la branche de prévisualisation se renouvelle à part.
- **Délai de grâce** : aucun. Coupure entre la réinitialisation et la fin du redéploiement (quelques minutes) : prévenir, choisir une heure creuse, tout préparer avant (`.env` ouvert, commandes prêtes), puis enchaîner : réinitialisation → `.env` → `verifier` → `envoyer` → `redeployer`.
- **Après une fuite** : réinitialiser, puis **redémarrer le calcul** pour fermer les connexions ouvertes avec l'ancien mot de passe : **Postgres database** → **Computes** → **Restart compute** (interrompt les connexions en cours, voulu ici).
- **Test** : `pulse-aidd secrets verifier DATABASE_URL` (connexion et `select 1` avec le pilote du projet ; vérifie aussi que les deux adresses ont le même mot de passe), puis une page qui lit la base en production, et `npm run db:migrate` qui doit passer avec l'adresse directe.
- **Traces** : console Neon → **Monitoring** (connexions, requêtes) sur la période d'exposition.
- Sources : https://neon.com/docs/manage/roles ; https://neon.com/faqs/rotate-database-password-after-leak ; https://neon.com/docs/manage/computes ; https://neon.com/docs/connect/connection-pooling.

### `BETTER_AUTH_SECRET`

- **Rôle** : signe les cookies de session et chiffre les données internes de better-auth (recette `connexion`).
- **Longueur** : 32 caractères au moins, tirés au hasard : `pulse-aidd secrets generer BETTER_AUTH_SECRET` (rien n'est affiché). Une valeur différente par environnement : `pulse-aidd secrets generer BETTER_AUTH_SECRET --envoyer production,preview --sans-local`.
- **Où renouveler** : nulle part ailleurs que dans le projet : la valeur est générée.
- **Effet** : la signature du cookie de session utilise seulement le secret courant (vérifié dans le code de better-auth 1.7.7) : après un changement, **toutes les personnes sont déconnectées** et se reconnectent. Les comptes et les données restent intacts.
- **Délai de grâce** : aucun pour les sessions. Choisir un moment calme et prévenir les utilisateurs si besoin.
- **Après une fuite** : nouvelle valeur seule (sans garder l'ancienne), redéploiement, puis supprimer les sessions en base (table `session`) pour fermer celles qu'un tiers aurait ouvertes. Cette suppression efface des données : elle passe par l'accord de la personne.
- **Test** : `pulse-aidd secrets verifier BETTER_AUTH_SECRET` (longueur), puis, après le redéploiement, se connecter sur le site et recharger une page réservée.
- Source : https://www.better-auth.com/docs/reference/options (`secret`, `secrets`).

### `BETTER_AUTH_SECRETS`

- **Rôle** : la forme versionnée du secret (better-auth 1.5 et plus) : `BETTER_AUTH_SECRETS=2:<nouvelle>,1:<ancienne>`. La première version sert aux nouvelles signatures et aux nouveaux chiffrements ; les suivantes servent seulement à **relire** les données chiffrées avec elles. Quand elle est présente, better-auth la lit à la place de `BETTER_AUTH_SECRET` (gardé seulement pour relire les données plus anciennes).
- **Utile quand** le projet chiffre des données avec better-auth (jetons de connexion par un service tiers, double authentification, cookie de session mis en cache) : la rotation ne les rend pas illisibles. Les sessions, elles, sont déconnectées comme avec `BETTER_AUTH_SECRET`.
- **Générer** : `pulse-aidd secrets generer BETTER_AUTH_SECRETS --versionne --ancien BETTER_AUTH_SECRET` (première fois), puis `pulse-aidd secrets generer BETTER_AUTH_SECRETS --versionne` à chaque rotation. Envoi : `pulse-aidd secrets envoyer BETTER_AUTH_SECRETS`.
- **Retirer l'ancienne version** : au déploiement suivant, quand les données chiffrées avec elle ont été réécrites ou n'ont plus d'usage : `pulse-aidd secrets elaguer BETTER_AUTH_SECRETS`, envoi, redéploiement. Après une fuite : `--versionne --seul` (aucune ancienne version gardée).
- **Test** : `pulse-aidd secrets verifier BETTER_AUTH_SECRETS` (forme, versions uniques, première version de 32 caractères au moins), puis la connexion sur le site.
- Sources : https://www.better-auth.com/docs/reference/options ; https://www.better-auth.com/blog/1-5.

### `BETTER_AUTH_URL`

- **Rôle** : adresse du site (`http://localhost:3000` en local, l'adresse de production en ligne). Ce n'est **pas un secret** : elle peut passer par la conversation.
- **Préfixe attendu** : `http://` ou `https://`.

### `STRIPE_SECRET_KEY`

- **Rôle** : clé secrète de l'API Stripe (recette `paiement`).
- **Préfixe attendu** : `sk_test_` (mode test), `sk_live_` (mode live), `rk_test_` ou `rk_live_` (clé restreinte, conseillée par Stripe pour limiter les droits). Mode test et mode live ont des clés distinctes : la clé live va seulement en Production.
- **Où renouveler** : https://dashboard.stripe.com/apikeys → menu ⋯ de la clé → **Roll key** (« Faire tourner la clé ») → réglage **Expiration** : *maintenant* ou une date → copier la nouvelle valeur (montrée **une seule fois** en mode live : garder l'onglet ouvert jusqu'à l'enregistrement) → noter où elle est rangée. **Expire key** révoque sans créer.
- **Effet** : avec une date d'expiration, l'ancienne et la nouvelle marchent en même temps jusqu'à cette date ; *maintenant* coupe l'ancienne tout de suite.
- **Délai de grâce** : jusqu'à **7 jours**. Renouvellement planifié : 24 heures suffisent en général. Après une fuite : *maintenant*.
- **Test** : `pulse-aidd secrets verifier STRIPE_SECRET_KEY` (appel de lecture du solde : accepté, ou « valide sans ce droit » pour une clé restreinte), puis un paiement de test en Preview. Avant d'expirer l'ancienne clé : **Workbench → Logs**, filtrés sur l'ancienne clé, doivent être vides.
- **Traces** : Workbench → Logs (requêtes par clé), paiements et remboursements inhabituels.
- Source : https://docs.stripe.com/keys (libellés français à confirmer à l'écran).

### `STRIPE_WEBHOOK_SECRET`

- **Rôle** : vérifie la signature des événements envoyés par Stripe (recette `paiement`).
- **Préfixe attendu** : `whsec_`.
- **Deux valeurs différentes** : en local, celle affichée par `stripe listen` ; en ligne, celle de la destination de webhook. Renouveler la production laisse le `.env` local tel quel : utiliser `pulse-aidd secrets preparer STRIPE_WEBHOOK_SECRET --fichier .env.envoi`, puis `envoyer … --env production --depuis .env.envoi --vider`.
- **Où renouveler** : https://dashboard.stripe.com/webhooks → la destination → menu ⋯ → **Roll secret** → expiration immédiate ou différée.
- **Effet** : pendant le délai, Stripe signe chaque événement avec chaque secret actif ; la bibliothèque accepte l'une ou l'autre signature.
- **Délai de grâce** : jusqu'à **24 heures**. Après une fuite : immédiat.
- **Test** : pas de test direct de la valeur. Après le redéploiement : envoyer un événement de test à la destination (onglet de la destination, ou `stripe trigger checkout.session.completed`) et vérifier une réponse 2xx dans la liste des tentatives.
- Source : https://docs.stripe.com/webhooks.

### `SMTP_PASSWORD`

- **Rôle** : mot de passe d'envoi des e-mails (recette `email`), avec `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `MAIL_FROM` (réglages, pas des secrets).
- **Où renouveler** : chez le fournisseur d'e-mail du projet. Principe commun : créer le nouvel identifiant d'envoi **avant** de supprimer l'ancien.
  - **Gmail** (mot de passe d'application) : https://myaccount.google.com/apppasswords → créer (nom = le projet) → copier → plus tard, supprimer l'ancien dans la même liste. Exige la validation en deux étapes ; indisponible pour certains comptes professionnels. Changer le mot de passe du compte Google révoque **tous** ses mots de passe d'application.
  - **Infomaniak** : Manager → Service Mail → l'adresse → onglet **Appareils** : ajouter un appareil (nouveau mot de passe), puis **Déconnecter l'appareil** ancien.
  - **Brevo** (clé SMTP) : Paramètres → **SMTP & API** → onglet **SMTP** → **Generate a new SMTP key** ; supprimer l'ancienne ensuite. Clé montrée une seule fois. Chemin relevé par des sources secondaires : à confirmer à l'écran.
  - Autre fournisseur : sa documentation officielle.
- **Effet** : la suppression de l'ancien identifiant est immédiate.
- **Délai de grâce** : oui, tant que les deux identifiants coexistent.
- **Test** : `pulse-aidd secrets verifier SMTP_PASSWORD` (authentification auprès du serveur, sans envoi), puis un envoi réel vers une adresse de test après le redéploiement.
- **Traces** : journal des envois du fournisseur (volumes, rebonds, plaintes).
- Sources : https://support.google.com/accounts/answer/185833 ; https://www.infomaniak.com/fr/support/faq/1736.

### `R2_ACCESS_KEY_ID` et `R2_SECRET_ACCESS_KEY`

- **Rôle** : le jeton d'accès au stockage Cloudflare R2 (recette `fichiers`), avec `R2_ACCOUNT_ID` et `R2_BUCKET` (réglages). Les deux valeurs du jeton changent ensemble.
- **Où renouveler** : tableau de bord Cloudflare → **R2 object storage** → **Manage API tokens** → créer un nouveau jeton, droits limités au bucket du projet (lecture et écriture d'objets) → copier l'Access Key ID et le Secret Access Key (le secret est montré **une seule fois**). Après vérification : supprimer l'ancien jeton dans la même liste.
- **Effet** : la suppression d'un jeton est immédiate.
- **Délai de grâce** : oui, avec deux jetons actifs pendant la bascule.
- **Test** : `pulse-aidd secrets verifier R2_SECRET_ACCESS_KEY` (ouverture du bucket avec le client du projet), puis un dépôt de fichier réel sur le site.
- **Traces** : R2 → le bucket → **Metrics** (opérations de lecture et d'écriture).
- **Format** : les jetons d'API Cloudflare récents commencent par `cfut_` (utilisateur) ou `cfat_` (compte) ; les identifiants R2 dérivés n'ont pas de préfixe.
- Sources : https://developers.cloudflare.com/r2/api/tokens/ (màj 2026-10-01) ; https://developers.cloudflare.com/fundamentals/api/get-started/token-formats/.

### `UPSTASH_REDIS_REST_TOKEN`

- **Rôle** : le jeton de la base Redis Upstash (recette `limite`), avec `UPSTASH_REDIS_REST_URL` (adresse, préfixe `https://`, pas un secret).
- **Où renouveler** : console Upstash → la base → **Reset Credentials** (ou **Reset Password**) → confirmer en tapant le nom de la base → copier le nouveau jeton REST.
- **Effet** : **immédiat** ; le mot de passe, le jeton REST et le jeton en lecture seule changent ensemble.
- **Délai de grâce** : aucun. Coupure courte jusqu'au redémarrage : même préparation que pour Neon. Pendant la coupure, la limite de requêtes ne répond plus : les formulaires concernés renvoient une erreur.
- **Test** : `pulse-aidd secrets verifier UPSTASH_REDIS_REST_TOKEN` (réponse PONG), puis un envoi de formulaire limité sur le site.
- **Traces** : console Upstash → la base → **Usage / Metrics**.
- Sources : https://upstash.com/docs/redis/features/security ; https://upstash.com/blog/rotate-upstash-secrets-after-vercel-incident (2026-04-19).

## Autres secrets du poste

- **Jeton GitHub** (`gh`, CI) : https://github.com/settings/tokens → créer le nouveau, mettre à jour la CI, supprimer l'ancien ; `gh auth refresh` pour le jeton de `gh`. Test : `gh auth status`. Un jeton poussé dans un dépôt public est révoqué automatiquement par GitHub.
- **Clé d'API Neon** (`napi_…`, administration, rarement utile au projet) : console Neon → Account settings → API keys → Revoke ; montrée une seule fois.
