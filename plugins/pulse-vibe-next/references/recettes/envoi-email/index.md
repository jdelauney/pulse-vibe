# Recette : envoi-email

> Quand l'utiliser : l'application envoie des e-mails (confirmation, notification, rappel), avec ou sans comptes.

## Prérequis

- Squelette seul. La recette `email` (e-mails du compte) et toute fonctionnalité qui envoie un e-mail s'appuient sur elle.
- Paquet à installer : `npm install nodemailer` (dernière version ; recette vérifiée avec 10.6.1). Nodemailer 10 fournit ses propres types : si `@types/nodemailer` est présent, le désinstaller (`npm uninstall @types/nodemailer`).
- **Mailpit** sur le poste. Il capture tous les e-mails envoyés en local : rien ne part vers de vraies adresses.
  - Windows : `winget install --id axllent.mailpit --exact` (ou l'archive `mailpit-windows-amd64.zip` de https://github.com/axllent/mailpit/releases, à décompresser dans un dossier du PATH).
  - macOS : `brew install mailpit`, puis `brew services start mailpit` pour le lancer en tâche de fond.
  - Linux (et macOS) : `sudo sh < <(curl -sL https://raw.githubusercontent.com/axllent/mailpit/develop/install.sh)`.
  - Lancement : `mailpit` dans un terminal. Il reçoit les e-mails sur le port SMTP **1025** et les affiche sur **http://localhost:8025**.
- Pour le site en ligne, une adresse d'envoi chez le fournisseur d'e-mail choisi par la personne : une adresse créée pour le projet (jamais sa boîte personnelle), de préférence sur le nom de domaine du projet. Lui demander (souvent dans son aide « configurer un logiciel de messagerie » ou « SMTP ») :
  - l'**adresse du serveur SMTP** (`SMTP_HOST`) ;
  - le **port 587** (`SMTP_PORT`, chiffrement STARTTLS ; 465 si le fournisseur l'indique) ;
  - l'**identifiant** (`SMTP_USER`, souvent l'adresse e-mail complète) ;
  - un **mot de passe d'application** (ou clé SMTP) créé pour le projet, distinct du mot de passe du compte (`SMTP_PASSWORD`). La personne le colle elle-même dans `.env`, puis chez l'hébergeur ; il ne passe jamais par la conversation. Elle le révoque chez le fournisseur quand il ne sert plus.
- Vérifiée automatiquement par la CI du pack, à chaque modification et chaque semaine, aux dernières versions (chaînes `envoi-email` et `connexion,envoi-email,email` de `verifier-recettes.js`) : contrôles, types, tests unitaires, construction. L'envoi par Mailpit et par un vrai serveur SMTP reste un essai à la main.

## Variables d'environnement

| Nom | Rôle | En local (Mailpit) | En ligne (donné par le fournisseur) |
|---|---|---|---|
| `SMTP_HOST` | Serveur SMTP | `localhost` | l'adresse du serveur SMTP |
| `SMTP_PORT` | Port | `1025` | `587` |
| `SMTP_USER` | Identifiant | vide | l'identifiant (souvent l'adresse d'envoi) |
| `SMTP_PASSWORD` | Mot de passe | vide | le mot de passe d'application (`VOTRE_MOT_DE_PASSE_ICI`) |
| `MAIL_FROM` | Expéditeur affiché | `Mon projet <ne-pas-repondre@exemple.fr>` | `Mon projet <contact@domaine-du-projet.fr>` (l'adresse d'envoi) |

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts`, après `DATABASE_URL` :

<!-- ajout: src/config/env.ts après: DATABASE_URL: z.url(), -->
```ts
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().positive(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().min(1),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: DATABASE_URL: "postgresql://localhost:5432/essai", -->
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

Dans Vercel, saisissez-les pour Production et Preview. Les variables sont obligatoires : un réglage oublié arrête le site au démarrage avec son nom, au lieu de laisser partir des e-mails qui n'arrivent jamais.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example`, `tests/helpers/env-de-test.ts` (modifiés) | Les cinq variables SMTP |
| `src/core/email/email.port.ts` | Les contrats : type `MessageEmail` (`a`, `sujet`, `texte`, `html`, `repondreA`, `piecesJointes`), interface `EnvoyeurEmail` (ce que le métier reçoit), interface `TransportEmail` (ce qu'un fournisseur d'envoi fournit) |
| `src/adapters/email/nodemailer.adapter.ts` | Classe `NodemailerTransport` (implémente `TransportEmail`) : configuration SMTP reçue par le constructeur, transport créé une fois, délais bornés ; lève `ErreurService("email", …)` si l'envoi échoue |
| `src/adapters/email/email.adapter.ts` | Classe `ServiceEmail` (implémente `EnvoyeurEmail`) : expéditeur du site, en-tête `X-Environment` en développement, journal sans adresse ; `getEnvoyeurEmail()`, le seul endroit qui assemble l'envoi à partir d'`env` |
| `src/adapters/email/__tests__/email.adapter.test.ts` | Tests unitaires de `ServiceEmail`, avec une doublure du transport |
| `src/adapters/email/__tests__/nodemailer.adapter.test.ts` | Tests unitaires de `NodemailerTransport`, Nodemailer doublé : réglages, réponse, pièce jointe, échec du serveur |
| `e2e/aides/mailpit.ts` | Lecture de Mailpit dans Playwright, pour les parcours des fonctionnalités qui envoient un e-mail |

## Étapes

<!-- commande: npm install nodemailer -->

Le chemin d'un e-mail une fois la recette en place :

1. Une fonctionnalité (action, use-case, configuration de better-auth) reçoit un `EnvoyeurEmail` et appelle `envoyer({ a, sujet, texte, html })`.
2. `ServiceEmail` ajoute l'expéditeur du site et, en développement, l'en-tête `X-Environment: development`, puis passe l'e-mail au transport.
3. `NodemailerTransport` le confie au serveur SMTP : Mailpit en local, celui du fournisseur d'e-mail en ligne.
4. Le journal du serveur note l'identifiant du message, son sujet et le nombre de destinataires, sans aucune adresse.

Conception : `TransportEmail` est le contrat d'un fournisseur (patron Adapter : `NodemailerTransport` adapte Nodemailer) ; `ServiceEmail` est la façade que le métier connaît (patron Façade), qui reçoit son transport par le constructeur (inversion de dépendance) ; `getEnvoyeurEmail()` est la racine de composition, comme `getAuth()` pour la connexion. Changer de fournisseur revient à écrire une autre classe qui implémente `TransportEmail`, sans toucher au reste.

- Étape 1 – Mailpit et les variables : `pulse-aidd pile recette envoi-email etape 1`
- Étape 2 – Les contrats : `pulse-aidd pile recette envoi-email etape 2`
- Étape 3 – Le transport Nodemailer : `pulse-aidd pile recette envoi-email etape 3`
- Étape 4 – Le service et l'assemblage : `pulse-aidd pile recette envoi-email etape 4`
- Étape 5 – Envoyer depuis une fonctionnalité : `pulse-aidd pile recette envoi-email etape 5`
- Étape 6 – Essayer en local : `pulse-aidd pile recette envoi-email etape 6`
- Étape 7 – Mettre en ligne : `pulse-aidd pile recette envoi-email etape 7`
## Scénarios Gherkin à ajouter à la spec

Avec la recette `email`, le dernier scénario figure aussi dans ses scénarios : reprenez-le une seule fois.

```gherkin
# language: fr
Fonctionnalité: Envoi des e-mails

  Règle: Chaque e-mail part avec l'expéditeur du site

    @US-XXX-1 @unitaire
    Exemple: Un e-mail part avec l'expéditeur du site
      Étant donné l'expéditeur du site est « Mon projet <ne-pas-repondre@exemple.fr> »
      Quand l'application envoie à Camille l'e-mail « Votre réservation est confirmée »
      Alors l'e-mail part de « Mon projet <ne-pas-repondre@exemple.fr> » vers Camille

    @US-XXX-1 @unitaire
    Exemple: Un e-mail envoyé pendant le développement porte une marque
      Étant donné l'application tourne sur l'ordinateur de développement
      Quand l'application envoie un e-mail
      Alors l'e-mail porte l'en-tête « X-Environment: development »
      Et son sujet reste celui prévu

  Règle: La réponse va à l'adresse choisie, et les pièces jointes suivent

    @US-XXX-2 @unitaire
    Exemple: La réponse à une notification va à la personne qui a écrit
      Quand l'application envoie une notification qui se répond à Camille, avec l'invitation « rendez-vous.ics » jointe
      Alors le serveur d'e-mail reçoit l'adresse de réponse de Camille
      Et la pièce jointe « rendez-vous.ics »

  Règle: Le journal du serveur ne contient aucune adresse de destinataire

    @US-XXX-3 @unitaire @securite
    Exemple: L'envoi est journalisé sans l'adresse
      Quand l'application envoie un e-mail à Camille
      Alors le journal note l'envoi et son sujet
      Et il ne contient pas l'adresse de Camille

  Règle: Un serveur d'e-mail lent n'immobilise pas le site

    @US-XXX-4 @unitaire
    Exemple: L'attente du serveur d'e-mail est bornée
      Quand l'envoi des e-mails est réglé
      Alors la connexion au serveur attend 10 secondes au plus
      Et un serveur muet pendant 20 secondes est abandonné

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
  - Fichiers : à créer : `src/core/email/email.port.ts`, `src/adapters/email/nodemailer.adapter.ts`, `src/adapters/email/email.adapter.ts`, `src/adapters/email/__tests__/email.adapter.test.ts`, `src/adapters/email/__tests__/nodemailer.adapter.test.ts`, `e2e/aides/mailpit.ts` · à modifier : `src/config/env.ts`, `.env.example`, `tests/helpers/env-de-test.ts`
  - Vérification : US-XXX critères 1 à 5 – `npm test` passe
  - Tests : « Un e-mail part avec l'expéditeur du site », « Un e-mail envoyé pendant le développement porte une marque », « L'envoi est journalisé sans l'adresse » (service) ; « La réponse à une notification va à la personne qui a écrit », « L'attente du serveur d'e-mail est bornée », « L'échec de l'envoi lève une erreur de service « email » sans l'adresse » (transport)
  - Action manuelle : installer et lancer Mailpit ; remplir les variables SMTP dans `.env`
- [ ] **Tn+1 – Envoyer les e-mails du site en ligne** · US-XXX
  - Objectif : le site en ligne envoie de vrais e-mails
  - Dépend de : Tn et la première tâche qui envoie un e-mail
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – déclencher l'envoi sur le site en ligne avec sa propre adresse : l'e-mail arrive
  - Action manuelle : saisir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` dans Vercel (Production et Preview), puis redéployer

## Tests
Le code des tests : `pulse-aidd pile recette envoi-email tests`
## Points de sécurité

- **S1 – Secrets hors du code** : `SMTP_PASSWORD` vit dans `.env` et dans Vercel ; la personne saisit le mot de passe elle-même, hors de la conversation.
- **S2 – Clés côté client** : aucune variable `NEXT_PUBLIC_` ; `src/adapters/email/email.adapter.ts` et `nodemailer.adapter.ts` commencent par `import "server-only"`.
- **S6 – Affichage sans injection** : le HTML d'un e-mail se compose dans `src/core/<domaine>/`, et chaque valeur saisie par quelqu'un (nom, message) y passe par une fonction d'échappement (`echapperHtml` de la recette `email`, par exemple).
- **S9 – Données personnelles** : le journal note l'identifiant du message, le sujet et le nombre de destinataires, sans adresse ; un sujet reste sans donnée personnelle (pas de nom ni de lien). L'`ErreurService` ne garde, de l'erreur du serveur SMTP, que `code`, `command` et `responseCode` : ni son texte, ni l'adresse du destinataire.
- **S10 – Abus et coûts** : un e-mail déclenché par un inconnu (formulaire de contact, réservation sans compte) passe par la recette `limite` avant l'ouverture au public. Chaque fournisseur limite le nombre d'e-mails par jour (chiffre à relever chez lui) : Mailpit pour tous les essais, le fournisseur seulement pour le site en ligne.
- **Réponse et expéditeur** : l'expéditeur reste `MAIL_FROM` ; une adresse saisie par un visiteur va seulement dans `repondreA`, après validation par le schéma Zod de l'action.

## Pièges connus

- **Port 25 bloqué par Vercel** : utilisez 587 (STARTTLS) ou 465 (chiffré dès la connexion). `NodemailerTransport` règle `secure` d'après le port.
- **Mailpit éteint** : l'envoi échoue avec `ECONNREFUSED` (une `ErreurService("email", …)` dans le journal). Lancez `mailpit` avant `npm run dev` et avant `npm run test:e2e`.
- **Mailpit lancé, rien n'arrive (`ETIMEDOUT`)** : Nodemailer demande `localhost` au DNS, et certaines box répondent une autre adresse. Mettez `SMTP_HOST=127.0.0.1`.
- **Mot de passe d'application** : beaucoup de fournisseurs demandent d'activer d'abord la validation en deux étapes du compte. Changer le mot de passe du compte peut révoquer d'un coup tous ses mots de passe d'application. Chez certains, ce mot de passe ouvre aussi la lecture de la boîte : réservez cette adresse au projet. L'expéditeur reste en général l'adresse du compte d'envoi : gardez `MAIL_FROM` sur elle.
- **E-mails rangés dans les indésirables** : avec un domaine à soi, configurez SPF, DKIM et DMARC chez le fournisseur ; gardez `MAIL_FROM` sur ce domaine.
- **`@types/nodemailer`** : il entre en conflit avec les types fournis par Nodemailer 10 ; désinstallez-le.
- **`npm run check` signale `noRestrictedImports` dans `src/core/`** : les contenus d'e-mails et les use-cases reçoivent un `EnvoyeurEmail` et importent seulement `@src/core/email/email.port`. `getEnvoyeurEmail()` s'appelle dans une action, une route ou `auth.adapter.ts`.
- **Un test qui appelle `getEnvoyeurEmail()`** : il lirait `env` et ouvrirait une connexion. Passez une doublure qui implémente `EnvoyeurEmail` (`{ async envoyer() {} }`, ou une classe qui garde les messages).
- **Destinataires en partie refusés** : Nodemailer considère l'e-mail parti si une adresse au moins est acceptée ; `ServiceEmail` journalise alors le nombre de refus (« E-mail refusé pour une partie des destinataires »).

## Sources

- Nodemailer 10.6.1 (dernière version sur le registre npm le 2026-11-23) : https://nodemailer.com/ (`sendMail` renvoie une promesse ; `info.messageId`, `info.rejected` : l'e-mail compte comme parti si une adresse est acceptée ; un transport créé une fois et réutilisé ; Node.js 20 au moins) ; https://nodemailer.com/smtp (`host`, `port`, `secure` pour 465, `requireTLS`, `auth` absent = sans identifiant, `connectionTimeout` 2 min, `greetingTimeout` 30 s, `socketTimeout` 10 min par défaut, `pool`) ; https://nodemailer.com/smtp/pooled (connexions réutilisées, fermées après 4 min sans envoi, e-mail remis en file si le serveur coupe une connexion réutilisée) ; https://nodemailer.com/message (`to` : une adresse ou un tableau, `replyTo`, `headers`, `attachments`) ; https://nodemailer.com/message/attachments (`filename`, `content` en texte, `Buffer` ou flux, `contentType`)
- Mailpit : https://mailpit.axllent.org/docs/install/ (ports 1025 et 8025) ; https://mailpit.axllent.org/docs/usage/search-filters/ ; API : `server/ui/api/v1/swagger.json` du dépôt axllent/mailpit ; paquet winget `axllent.mailpit`
- Vercel, ports SMTP : https://vercel.com/kb/guide/serverless-functions-and-smtp
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/after.md`

## Points à vérifier

- L'envoi par un vrai serveur SMTP reste à essayer, comme les connexions gardées ouvertes (`pool`) entre deux requêtes sur Vercel.
- L'envoi par `after()` sur Vercel : l'e-mail doit partir après la réponse (réception, et journaux Vercel sans erreur).
