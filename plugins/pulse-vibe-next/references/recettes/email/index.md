# Recette : email

> Quand l'utiliser : l'application envoie des e-mails : confirmation d'adresse, mot de passe oublié, changement d'adresse, suppression du compte.

## Prérequis

- Recette `connexion` appliquée (`creerAuth`, `getAuth`, actions `inscrire` et `connecter`, `CompteContainer`, aides Playwright `e2e/aides/connexion.ts`). Les composants `Field`, `Input`, `Button` et le client d'action du squelette sont ceux de `connexion`.
- Paquet à installer : `npm install nodemailer` (dernière version ; recette vérifiée avec 10.6.0 et better-auth 1.7.25). Nodemailer 10 fournit ses propres types : si `@types/nodemailer` est présent, le désinstaller (`npm uninstall @types/nodemailer`).
- **Mailpit** sur le poste. Il capture tous les e-mails envoyés en local : rien ne part vers de vraies adresses.
  - Windows : `winget install --id axllent.mailpit --exact` (ou l'archive `mailpit-windows-amd64.zip` de https://github.com/axllent/mailpit/releases, à décompresser dans un dossier du PATH).
  - macOS : `brew install mailpit`, puis `brew services start mailpit` pour le lancer en tâche de fond.
  - Linux (et macOS) : `sudo sh < <(curl -sL https://raw.githubusercontent.com/axllent/mailpit/develop/install.sh)`.
  - Lancement : `mailpit` dans un terminal. Il reçoit les e-mails sur le port SMTP **1025** et les affiche sur **http://localhost:8025**.
- Pour le site en ligne, un compte SMTP :
  - **Pour essayer en ligne** : un compte Gmail que la personne crée pour le projet (jamais son compte personnel), avec la validation en deux étapes, puis un **mot de passe d'application** créé sur https://myaccount.google.com/apppasswords. La personne le colle elle-même dans `.env`, puis dans Vercel ; il ne passe jamais par la conversation. Elle le révoque sur la même page quand il ne sert plus.
  - **Pour un vrai lancement** : le SMTP d'un fournisseur, avec le nom de domaine du projet. Infomaniak (suisse) : `mail.infomaniak.com`, port 587, identifiant = l'adresse e-mail complète. Brevo (français) : `smtp-relay.brevo.com`, port 587, identifiant = l'adresse du compte Brevo, mot de passe = une clé SMTP créée dans « SMTP & API ».
- Vérifiée automatiquement par la CI du pack, à chaque modification et chaque semaine, aux dernières versions (chaîne `connexion,email` de `verifier-recettes.js`) : contrôles, types, tests unitaires et d'intégration, construction. Les tests de bout en bout (`e2e/email.spec.ts`, avec Mailpit) se lancent à la main ; l'envoi par un vrai serveur SMTP reste un essai à la main.

## Variables d'environnement

| Nom | Rôle | En local (Mailpit) | Pour essayer en ligne (Gmail) |
|---|---|---|---|
| `SMTP_HOST` | Serveur SMTP | `localhost` | `smtp.gmail.com` |
| `SMTP_PORT` | Port | `1025` | `587` |
| `SMTP_USER` | Identifiant | vide | l'adresse Gmail du projet |
| `SMTP_PASSWORD` | Mot de passe | vide | le mot de passe d'application (`VOTRE_MOT_DE_PASSE_ICI`) |
| `MAIL_FROM` | Expéditeur affiché | `Mon projet <ne-pas-repondre@exemple.fr>` | `Mon projet <adresse.du.projet@gmail.com>` |

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts`, après `BETTER_AUTH_URL` :

<!-- ajout: src/config/env.ts après: BETTER_AUTH_URL: z.url(), -->
```ts
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().min(1),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: BETTER_AUTH_URL: "http://localhost:3000", -->
```ts
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  MAIL_FROM: "Mon projet <ne-pas-repondre@exemple.fr>",
```

Ajoutez les cinq noms, **sans valeur**, à `.env.example` :

<!-- ajout: .env.example -->
```
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
```

Dans Vercel, saisissez-les pour Production et Preview.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | Les cinq variables SMTP |
| `src/core/compte/email.port.ts` | Port d'envoi : type `MessageEmail` et interface `EnvoyeurEmail` |
| `src/core/compte/emails-compte.rules.ts` | Classe `EmailsCompte` : contenus des e-mails du compte (sans état), dont l'alerte de changement d'adresse et la confirmation de suppression |
| `src/adapters/email/email.adapter.ts` | Classe `NodemailerEmailAdapter` (configuration SMTP reçue par le constructeur), méthode `envoyer({ a, sujet, texte, html })` : la seule porte de sortie des e-mails ; lève `ErreurService("email", …)` si l'envoi échoue |
| `src/adapters/auth/auth.adapter.ts` (modifié) | Configuration de better-auth (reste celle de la bibliothèque) : vérification d'adresse, mot de passe oublié, e-mail « compte existant », changement d'adresse, suppression du compte ; reçoit l'envoyeur d'e-mails par ses options |
| `src/features/compte/schemas/compte.schema.ts` (modifié) | `schemaMotDePasseOublie`, `schemaNouveauMotDePasse`, `schemaChoixMotDePasse`, `schemaChangementAdresse`, `schemaConfirmationSuppression` |
| `src/features/compte/actions/inscrire.action.ts`, `connecter.action.ts` (modifiés) | `inscrire` renvoie un message ; `connecter` traduit `EMAIL_NOT_VERIFIED` |
| `src/features/compte/actions/demander-nouveau-mot-de-passe.action.ts` | Action `demanderNouveauMotDePasse` |
| `src/features/compte/actions/choisir-nouveau-mot-de-passe.action.ts` | Action `choisirNouveauMotDePasse` |
| `src/features/compte/actions/changer-adresse-email.action.ts` | Action `changerAdresseEmail` |
| `src/features/compte/actions/demander-suppression-compte.action.ts`, `confirmer-suppression-compte.action.ts` | Actions `demanderSuppressionCompte` et `confirmerSuppressionCompte` |
| `src/features/compte/components/sections/formulaire-inscription.tsx`, `formulaire-connexion.tsx` (modifiés) | Message « Ouvrez l'e-mail », lien « Mot de passe oublié ? » |
| `src/features/compte/components/containers/inscription.container.tsx` (modifié) | Passe le message de l'action à la section |
| `src/features/compte/components/sections/formulaire-mot-de-passe-oublie.tsx` | Champs et validation de la demande de lien |
| `src/features/compte/components/sections/formulaire-nouveau-mot-de-passe.tsx` | Champs et validation du nouveau mot de passe |
| `src/features/compte/components/containers/mot-de-passe-oublie.container.tsx` | Branche `demanderNouveauMotDePasse` sur son formulaire |
| `src/features/compte/components/containers/nouveau-mot-de-passe.container.tsx` | Branche `choisirNouveauMotDePasse` sur son formulaire, avec le jeton |
| `src/features/compte/components/containers/lien-mot-de-passe.container.tsx` | Lit l'adresse de la page : formulaire si le lien est valable, sinon message |
| `src/features/compte/components/containers/adresse-verifiee.container.tsx` | Arrivée des liens de confirmation : « Adresse vérifiée », ou lien expiré |
| `src/features/compte/components/sections/formulaire-adresse.tsx`, `containers/changement-adresse.container.tsx` | Changer d'adresse e-mail |
| `src/features/compte/components/sections/suppression-compte.tsx`, `confirmation-suppression.tsx`, `containers/suppression-compte.container.tsx`, `confirmation-suppression.container.tsx`, `lien-suppression.container.tsx` | Supprimer son compte : la demande, puis la confirmation |
| `src/features/compte/components/containers/compte.container.tsx` (modifié) | « Mon compte » : sections adresse et suppression |
| `app/(public)/mot-de-passe-oublie/page.tsx`, `nouveau-mot-de-passe/page.tsx`, `adresse-verifiee/page.tsx`, `compte-supprime/page.tsx`, `app/(connecte)/compte/supprimer/page.tsx` | Les nouvelles pages |
| `src/core/compte/__tests__/emails-compte.rules.test.ts` | Tests unitaires de `EmailsCompte` |
| `src/adapters/email/__tests__/email.adapter.test.ts` | Test de l'échec d'envoi de `NodemailerEmailAdapter` |
| `src/adapters/auth/__tests__/auth-email.test.ts` | Tests d'intégration des e-mails du compte |
| `src/adapters/auth/__tests__/auth.adapter.test.ts` (modifié) | Tests de la recette `connexion` adaptés à la vérification d'adresse |
| `e2e/aides/mailpit.ts`, `e2e/aides/connexion.ts` (modifié), `e2e/email.spec.ts` | Lecture de Mailpit dans Playwright |

## Étapes

<!-- commande: npm install nodemailer -->

Le parcours une fois la recette en place :

1. Camille s'inscrit : l'écran affiche « Compte créé. Ouvrez l'e-mail… ». Aucune session n'est ouverte.
2. Elle clique sur le lien de l'e-mail (`/api/auth/verify-email?token=…`, valable 1 heure) : better-auth confirme l'adresse et l'envoie sur `/adresse-verifiee` (« Adresse vérifiée, vous pouvez vous connecter »), sans ouvrir de session. Elle se connecte.
3. Si elle se connecte avant de confirmer, la connexion est refusée et un nouvel e-mail de confirmation part.
4. Mot de passe oublié : elle reçoit un lien `/api/auth/reset-password/<jeton>` ; better-auth la renvoie sur `/nouveau-mot-de-passe?token=…` (ou `?error=INVALID_TOKEN` si le lien a expiré), où elle choisit un nouveau mot de passe.
5. Dans « Mon compte », elle change d'adresse : la nouvelle reçoit un lien de confirmation, l'ancienne une alerte. L'adresse change au clic.
6. Dans « Mon compte », elle demande la suppression de son compte : un lien arrive, ouvre `/compte/supprimer`, qui demande une dernière confirmation. Le compte et ses données sont effacés, puis `/compte-supprime` le confirme.

- Étape 1 – Mailpit et les variables : `pulse-aidd pile recette email etape 1`
- Étape 2 – Le port et l'envoi : `pulse-aidd pile recette email etape 2`
- Étape 3 – Les contenus des e-mails : `pulse-aidd pile recette email etape 3`
- Étape 4 – better-auth : `pulse-aidd pile recette email etape 4`
- Étape 5 – Les schémas : `pulse-aidd pile recette email etape 5`
- Étape 6 – Les actions : `pulse-aidd pile recette email etape 6`
- Étape 7 – Les formulaires existants : `pulse-aidd pile recette email etape 7`
- Étape 8 – Les deux nouveaux formulaires : sections et containers : `pulse-aidd pile recette email etape 8`
- Étape 9 – Les nouvelles pages publiques : `pulse-aidd pile recette email etape 9`
- Étape 10 – Changer d'adresse e-mail : `pulse-aidd pile recette email etape 10`
- Étape 11 – Supprimer son compte : `pulse-aidd pile recette email etape 11`
- Étape 12 – « Mon compte » : `pulse-aidd pile recette email etape 12`
- Étape 13 – Les tests de la recette `connexion` : `pulse-aidd pile recette email etape 13`
- Étape 14 – Essayer en local : `pulse-aidd pile recette email etape 14`
- Étape 15 – Mettre en ligne : `pulse-aidd pile recette email etape 15`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: E-mails du compte

  Règle: Une adresse est confirmée par un lien reçu par e-mail avant la première connexion

    @US-XXX-1 @bout-en-bout
    Exemple: Camille s'inscrit, confirme son adresse, puis se connecte
      Étant donné aucun compte n'existe pour l'adresse de Camille
      Quand Camille s'inscrit puis clique sur le lien de l'e-mail reçu
      Alors la page affiche « Adresse vérifiée, vous pouvez vous connecter. »
      Et après sa connexion, « Mon compte » affiche « Connecté en tant que Camille Martin »

    @US-XXX-1 @integration @securite
    Exemple: Le lien confirme l'adresse sans ouvrir de session, et vaut 1 heure
      Quand Camille ouvre le lien de confirmation
      Alors aucune session n'est ouverte
      Et le lien expire 1 heure après son envoi

    @US-XXX-1 @integration @securite
    Exemple: Adresse non confirmée : la connexion est refusée et un nouvel e-mail part
      Étant donné Camille s'est inscrite sans cliquer sur le lien de confirmation
      Quand Camille se connecte avec son mot de passe
      Alors la connexion est refusée
      Et un nouvel e-mail « Confirmez votre adresse e-mail » part vers Camille

    @US-XXX-1 @unitaire
    Exemple: L'e-mail de Camille contient son lien de confirmation
      Étant donné un lien de confirmation pour Camille
      Quand l'e-mail de confirmation est préparé
      Alors son texte et son HTML contiennent ce lien

  Règle: Une inscription avec une adresse déjà prise ne révèle rien

    @US-XXX-2 @integration @securite
    Exemple: La propriétaire de l'adresse est prévenue par e-mail
      Étant donné Camille a un compte confirmé
      Quand quelqu'un s'inscrit avec l'adresse de Camille
      Alors Camille reçoit l'e-mail « Votre compte existe déjà »

  Règle: Un mot de passe oublié se remplace grâce à un lien valable 1 heure

    @US-XXX-3 @bout-en-bout
    Exemple: Camille choisit un nouveau mot de passe depuis l'e-mail reçu
      Étant donné Camille a un compte confirmé
      Quand Camille demande un lien, l'ouvre et choisit « nouveau-secret-42 »
      Alors Camille lit « Mot de passe modifié. Connectez-vous. »

    @US-XXX-3 @integration
    Exemple: Camille choisit un nouveau mot de passe et se connecte avec
      Étant donné Camille a un compte confirmé
      Quand Camille choisit « nouveau-secret-42 » avec le lien reçu
      Alors Camille se connecte avec « nouveau-secret-42 »

    @US-XXX-3 @integration @securite
    Exemple: Un lien déjà utilisé ne sert plus
      Étant donné Camille a déjà changé son mot de passe avec un lien
      Quand ce même lien sert une deuxième fois
      Alors le changement est refusé

    @US-XXX-3 @integration @securite
    Exemple: Un nouveau mot de passe paru dans une fuite est refusé
      Quand Camille choisit un mot de passe paru dans une fuite avec le lien reçu
      Alors le changement est refusé

    @US-XXX-3 @integration @securite
    Exemple: Une adresse inconnue reçoit la même réponse, sans e-mail
      Étant donné aucun compte n'existe pour « inconnu@exemple.fr »
      Quand quelqu'un demande un lien pour « inconnu@exemple.fr »
      Alors la réponse est la même que pour une adresse connue
      Et aucun e-mail ne part

  Règle: Une nouvelle adresse est confirmée par un lien, l'ancienne est prévenue

    @US-XXX-6 @bout-en-bout
    Exemple: Camille change d'adresse : le lien arrive à la nouvelle, l'alerte à l'ancienne
      Étant donné Camille est connectée
      Quand Camille demande à changer pour une nouvelle adresse puis ouvre le lien reçu à celle-ci
      Alors l'ancienne adresse reçoit « Changement de votre adresse e-mail »
      Et Camille se connecte avec la nouvelle adresse

    @US-XXX-6 @integration @securite
    Exemple: Adresse déjà prise : même réponse, aucun e-mail vers elle
      Étant donné un compte existe pour « dominique@exemple.fr »
      Quand Camille demande à changer pour « dominique@exemple.fr »
      Alors la réponse est la même que pour une adresse libre
      Et aucun e-mail ne part vers « dominique@exemple.fr »

  Règle: Un compte se supprime après confirmation par un lien reçu par e-mail

    @US-XXX-7 @bout-en-bout
    Exemple: Camille supprime son compte
      Étant donné Camille est connectée
      Quand Camille demande la suppression, ouvre le lien reçu et confirme
      Alors la page affiche « Votre compte et vos données sont effacés. »
      Et la connexion avec son ancienne adresse est refusée

    @US-XXX-7 @integration @securite
    Exemple: Un lien inventé ne supprime rien
      Quand quelqu'un confirme la suppression avec un jeton inventé
      Alors le compte reste en place

  Règle: Un nom saisi s'affiche comme du texte dans l'e-mail

    @US-XXX-4 @unitaire @securite
    Exemple: Un nom contenant du HTML est neutralisé
      Étant donné une personne nommée « <img src=x onerror=alert(1)> »
      Quand l'e-mail de mot de passe oublié est préparé
      Alors le HTML de l'e-mail affiche ce nom comme du texte

  Règle: Une panne du serveur d'e-mail est signalée comme une panne de service

    @US-XXX-5 @unitaire
    Exemple: L'échec de l'envoi lève une erreur de service « email » sans l'adresse
      Étant donné le serveur d'e-mail refuse l'adresse de Camille
      Quand l'application envoie un e-mail à Camille
      Alors une erreur de service « email » est levée
      Et ni son message ni sa cause ne contiennent l'adresse de Camille
```

## Tâches de plan prêtes

- [ ] **Tn – Envoyer des e-mails** · US-XXX
  - Objectif : l'application sait envoyer un e-mail, visible dans Mailpit
  - Dépend de : —
  - Fichiers : à créer : `src/core/compte/email.port.ts`, `src/core/compte/emails-compte.rules.ts`, `src/adapters/email/email.adapter.ts`, `src/core/compte/__tests__/emails-compte.rules.test.ts`, `src/adapters/email/__tests__/email.adapter.test.ts` · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1, 4 et 5 – `npm test` passe
  - Tests : « L'e-mail de Camille contient son lien de confirmation » (unitaire) ; « Un nom contenant du HTML est neutralisé » (unitaire) ; « L'échec de l'envoi lève une erreur de service « email » sans l'adresse » (adapter)
  - Action manuelle : installer et lancer Mailpit ; remplir les variables SMTP dans `.env`
- [ ] **Tn+1 – Confirmer l'adresse à l'inscription** · US-XXX
  - Objectif : une personne confirme son adresse par e-mail avant sa première connexion
  - Dépend de : Tn
  - Fichiers : à modifier : `src/adapters/auth/auth.adapter.ts`, `src/features/compte/actions/inscrire.action.ts`, `src/features/compte/actions/connecter.action.ts`, `src/features/compte/components/sections/formulaire-inscription.tsx`, `src/features/compte/components/containers/inscription.container.tsx`, `src/adapters/auth/__tests__/auth.adapter.test.ts` · à créer : `src/adapters/auth/__tests__/auth-email.test.ts`, `src/features/compte/components/containers/adresse-verifiee.container.tsx`, `app/(public)/adresse-verifiee/page.tsx`
  - Vérification : US-XXX critères 1 et 2 – s'inscrire, ouvrir l'e-mail dans Mailpit, cliquer : « Adresse vérifiée, vous pouvez vous connecter » s'affiche ; se connecter
  - Tests : « Adresse non confirmée : la connexion est refusée… », « Le lien confirme l'adresse sans ouvrir de session… », « La propriétaire de l'adresse est prévenue par e-mail » (intégration)
  - Attention : les comptes créés avant cette tâche n'ont pas d'adresse confirmée ; les supprimer de la base de développement
- [ ] **Tn+2 – Remplacer un mot de passe oublié** · US-XXX
  - Objectif : une personne qui a oublié son mot de passe en choisit un nouveau
  - Dépend de : Tn+1
  - Fichiers : à modifier : `src/features/compte/schemas/compte.schema.ts`, `src/features/compte/components/sections/formulaire-connexion.tsx` · à créer : `src/features/compte/actions/demander-nouveau-mot-de-passe.action.ts`, `src/features/compte/actions/choisir-nouveau-mot-de-passe.action.ts`, `src/features/compte/components/sections/formulaire-mot-de-passe-oublie.tsx`, `src/features/compte/components/sections/formulaire-nouveau-mot-de-passe.tsx`, `src/features/compte/components/containers/mot-de-passe-oublie.container.tsx`, `src/features/compte/components/containers/nouveau-mot-de-passe.container.tsx`, `src/features/compte/components/containers/lien-mot-de-passe.container.tsx`, `app/(public)/mot-de-passe-oublie/page.tsx`, `app/(public)/nouveau-mot-de-passe/page.tsx`
  - Vérification : US-XXX critère 3 – demander un lien, l'ouvrir depuis Mailpit, choisir un mot de passe, se connecter avec
  - Tests : « Camille choisit un nouveau mot de passe et se connecte avec », « Un lien déjà utilisé ne sert plus », « Une adresse inconnue reçoit la même réponse, sans e-mail » (intégration)
  - Attention : les sections reçoivent tout par props, les containers appellent `useAction` ; le jeton va au container, pas au formulaire
- [ ] **Tn+3 – Changer d'adresse et supprimer son compte** · US-XXX
  - Objectif : depuis « Mon compte », la personne change d'adresse (lien à la nouvelle, alerte à l'ancienne) et supprime son compte après confirmation par e-mail
  - Dépend de : Tn+2
  - Fichiers : à créer : `src/features/compte/actions/changer-adresse-email.action.ts`, `demander-suppression-compte.action.ts`, `confirmer-suppression-compte.action.ts`, `src/features/compte/components/sections/formulaire-adresse.tsx`, `suppression-compte.tsx`, `confirmation-suppression.tsx`, `src/features/compte/components/containers/changement-adresse.container.tsx`, `suppression-compte.container.tsx`, `confirmation-suppression.container.tsx`, `lien-suppression.container.tsx`, `app/(connecte)/compte/supprimer/page.tsx`, `app/(public)/compte-supprime/page.tsx` · à modifier : `src/features/compte/components/containers/compte.container.tsx`
  - Vérification : US-XXX critères 6 et 7 – les deux parcours à la main, avec Mailpit
  - Tests : « Adresse déjà prise : même réponse… », « Un lien inventé ne supprime rien » (intégration)
  - Attention : chaque table métier qui appartient à une personne référence `user.id` avec `onDelete: "cascade"` : ses lignes partent avec le compte
- [ ] **Tn+4 – Parcours de bout en bout avec Mailpit** · US-XXX
  - Objectif : les parcours avec e-mail sont vérifiés automatiquement
  - Dépend de : Tn+3
  - Fichiers : à créer : `e2e/aides/mailpit.ts`, `e2e/email.spec.ts` · à modifier : `e2e/aides/connexion.ts`
  - Vérification : US-XXX critères 1, 3, 6 et 7 – Mailpit lancé, `npm run test:e2e` passe
  - Tests : « Camille s'inscrit, confirme son adresse, puis se connecte », « Camille choisit un nouveau mot de passe depuis l'e-mail reçu », « Camille change d'adresse… », « Camille supprime son compte » (bout en bout)
- [ ] **Tn+5 – Envoyer les e-mails du site en ligne** · US-XXX
  - Objectif : le site en ligne envoie de vrais e-mails
  - Dépend de : Tn+4
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – s'inscrire sur le site en ligne avec sa propre adresse : l'e-mail arrive
  - Action manuelle : saisir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` dans Vercel (Production et Preview), puis redéployer

## Tests
Le code des tests : `pulse-aidd pile recette email tests`
## Points de sécurité

- **S1 – Secrets hors du code** : `SMTP_PASSWORD` vit dans `.env` et dans Vercel ; la personne saisit le mot de passe d'application elle-même, hors de la conversation.
- **S2 – Clés côté client** : aucune variable `NEXT_PUBLIC_` ; `src/adapters/email/email.adapter.ts` commence par `import "server-only"`.
- **S5 – Validation des entrées** : chaque formulaire passe par un schéma Zod dans son action ; `disabledPaths` ferme toutes les adresses HTTP d'écriture de better-auth (lien, mot de passe, adresse, suppression) ; restent ouverts les deux liens reçus par e-mail.
- **S6 – Affichage sans injection** : chaque valeur insérée dans le HTML d'un e-mail passe par `echapperHtml`, dans `EmailsCompte`.
- **S9 – Données personnelles** : le journal note l'identifiant du message et le sujet, sans adresse ni lien (le lien contient un jeton) ; l'`ErreurService` ne garde, de l'erreur du serveur SMTP, que `code`, `command` et `responseCode` : ni son texte, ni l'adresse du destinataire, ni le lien.
- **S10 – Abus et coûts** : inscription et « mot de passe oublié » déclenchent des e-mails à la demande d'un inconnu ; changement d'adresse et suppression, à la demande d'une personne connectée. Appliquez la recette `limite` avant l'ouverture au public. Gmail limite à 500 destinataires par jour : Mailpit pour tous les essais, Gmail seulement pour le site en ligne.
- **S11 – Messages d'erreur** : inscription, « mot de passe oublié » et changement d'adresse répondent la même chose qu'un compte existe ou non ; l'envoi part après la réponse (`after()`). Une connexion refusée est journalisée avec son motif, sans l'adresse.
- Liens courts : 1 heure pour la confirmation d'adresse, le mot de passe et la suppression ; ceux du mot de passe et de la suppression servent une seule fois. Le lien de confirmation n'ouvre pas de session : un lien volé ne donne pas accès au compte. Un nouveau mot de passe ferme les autres sessions.
- **Changement d'adresse** : l'adresse change seulement quand la nouvelle confirme ; l'ancienne reçoit une alerte, que la nouvelle soit libre ou non.
- **Suppression du compte** : demandée connecté, confirmée par un lien reçu à l'adresse du compte, puis par un dernier clic. Sessions, comptes et chaque table métier liée à `user.id` en cascade partent avec lui.

## Pièges connus

- **Port 25 bloqué par Vercel** : utilisez 587 (STARTTLS) ou 465 (chiffré dès la connexion). `src/adapters/email/email.adapter.ts` règle `secure` d'après le port.
- **Mailpit éteint** : l'envoi échoue en silence côté écran (better-auth journalise « Failed to run background task », avec l'`ErreurService` de l'adapter). Lancez `mailpit` avant `npm run dev` et avant `npm run test:e2e`.
- **Mailpit lancé, rien n'arrive (`ETIMEDOUT`)** : Nodemailer demande `localhost` au DNS, et certaines box répondent une autre adresse. Mettez `SMTP_HOST=127.0.0.1`.
- **Gmail** : le mot de passe d'application exige la validation en deux étapes. Changer le mot de passe du compte Google révoque d'un coup tous les mots de passe d'application. L'expéditeur reste l'adresse Gmail. Un mot de passe d'application ouvre aussi la lecture de la boîte : réservez ce compte Gmail au projet. Google peut bloquer des connexions venues de nombreux endroits à la fois, et déconseille les mots de passe d'application pour un service en production.
- **Comptes créés avant la recette** : leur adresse n'est pas confirmée ; ils ne peuvent plus se connecter. En développement, supprimez-les. En ligne, la connexion leur envoie un e-mail de confirmation (`sendOnSignIn`).
- **`authClient.requestPasswordReset`, `changeEmail` ou `deleteUser` répond 404** : ces adresses sont fermées par `disabledPaths`. Passez par les actions de `src/features/compte/actions/`.
- **Lien de suppression ouvert sans session** (autre navigateur, téléphone) : la page renvoie vers la connexion ; une fois connecté, rouvrir le lien de l'e-mail (valable 1 heure).
- **Données d'une table métier restées après une suppression** : sa colonne `utilisateurId` doit référencer `user.id` avec `onDelete: "cascade"` (recette `connexion`, étape 2). Un fichier rangé ailleurs (stockage R2, recette `fichiers`) reste à effacer par `user.deleteUser.beforeDelete`.
- **`after()` hors d'une requête** : `tacheDeFond` reste absent dans `creerAuth` pour les tests ; seul `getAuth()` le fournit.
- **`creerAuth` sans `envoyeur`** : l'option est obligatoire. Un test qui appelle `creerAuth` passe une doublure (`envoyeur: { async envoyer() {} }`).
- **`npm run check` signale `noRestrictedImports` dans `src/core/compte/`** : les contenus d'e-mails (`EmailsCompte`) n'importent rien hors de `src/core/`. Gardez-les sans Next, sans Nodemailer, sans `@src/lib`.
- **E-mails rangés dans les indésirables** : avec un domaine à soi, configurez SPF, DKIM et DMARC chez le fournisseur.
- **`@types/nodemailer`** : il entre en conflit avec les types fournis par Nodemailer 10 ; désinstallez-le.
- **Langues** : avec la recette `langues`, les nouvelles pages vont sous `app/[locale]/(public)/` (et `app/[locale]/(connecte)/`), et leur `PageProps` prend la clé `"/[locale]/…"`.

## Sources

- better-auth 1.7.25, types et code du paquet (lus le 2026-11-16) : `@better-auth/core/dist/types/init-options.d.mts` (`emailVerification`, `autoSignInAfterVerification`, `emailAndPassword`, `onExistingUserSignUp`, `user.changeEmail`, `user.deleteUser`, `advanced.backgroundTasks`) ; `better-auth/dist/api/routes/update-user.mjs` (`/change-email` : adresse déjà prise → `status: true` sans e-mail ; `/delete-user` : jeton `delete-account-…`, `sendDeleteAccountVerification` reçoit `token`) ; `email-verification.mjs` (`change-email-verification` : l'adresse change au clic ; `?error=` ajouté au `callbackURL`) ; `dispatch.mjs` (`hooks.after` voit `ctx.context.session` et `returned`) ; `better-auth/dist/api/routes/password.mjs` (`/request-password-reset`, `/reset-password/:token` qui renvoie vers `?token=` ou `?error=INVALID_TOKEN`) ; `sign-up.mjs` (réponse identique pour une adresse déjà prise quand `requireEmailVerification` est actif) ; `api/index.mjs` (`disabledPaths` : chemin exact)
- Nodemailer 10.0.16 (10.6.0 au 2026-11-16) : `README.md` et `CHANGELOG.md` du paquet (types fournis, Node.js 20, `secure` seulement pour 465) ; https://nodemailer.com/
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/after.md` ; `01-app/01-getting-started/08-caching.md` (lecture de `searchParams` sous `<Suspense>`)
- Mailpit : https://mailpit.axllent.org/docs/install/ (ports 1025 et 8025) ; https://mailpit.axllent.org/docs/usage/search-filters/ ; API : `server/ui/api/v1/swagger.json` du dépôt axllent/mailpit ; paquet winget `axllent.mailpit`
- Vercel, ports SMTP : https://vercel.com/kb/guide/serverless-functions-and-smtp
- Google : https://support.google.com/accounts/answer/185833 (mots de passe d'application) ; https://support.google.com/mail/answer/22839 (limite de 500)
- Infomaniak : https://www.infomaniak.com/fr/support/faq/468/ ; Brevo : https://help.brevo.com/hc/en-us/articles/10905415650322
- Rejoué le 2026-11-16 (better-auth 1.7.25, Nodemailer 10.6.0) par `verifier-recettes.js` (chaîne `connexion,email`) : contrôles, types, tests, construction.
- Essais antérieurs : 2026-10-06 avec Mailpit 1.31 (envoi réel, lecture par `to:"…"`, `/nouveau-mot-de-passe` avec `?token=` et `?error=INVALID_TOKEN`), 2026-10-08 dans l'architecture du pack.
- Bout en bout rejoué le 2026-11-16 (`e2e/compte.spec.ts` et `e2e/email.spec.ts`, ordinateur et téléphone, `next start`, base PGlite) avec une doublure locale de Mailpit (même API de lecture, SMTP sur 1025) : tous les parcours passent au premier essai.

## Points à vérifier

- Les tests de bout en bout avec Mailpit lui-même (rejoués le 2026-11-16 avec une doublure de son API).
- L'envoi par `after()` sur Vercel : l'e-mail doit partir après la réponse. À constater à la tâche Tn+5 (réception, et journaux Vercel sans « Failed to run background task »).
- La limite de 500 destinataires par jour : chiffre de l'aide Google pour un compte Gmail, susceptible de changer.
- L'envoi par un vrai serveur SMTP (Gmail, Infomaniak, Brevo) reste à essayer.
