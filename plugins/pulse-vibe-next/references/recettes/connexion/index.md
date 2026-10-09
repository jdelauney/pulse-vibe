# Recette : connexion

> Quand l'utiliser : l'application a des comptes : une personne crée son compte avec son e-mail et un mot de passe, se connecte, change son mot de passe et se déconnecte, et certaines pages lui sont réservées.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `src/db/db-client.ts` (`getDb()`, type `Db`), `drizzle.config.ts` (lit `src/db/*/*.table.ts`), `src/config/env.ts` (objet `env`, t3 env), `src/lib/logger.ts`, `src/lib/safe-action.ts` (`actionPublique`), `tests/helpers/base-de-test.ts` (`creerBaseDeTest()`).
- Une base Neon existe, avec ses deux adresses dans `.env` : `DATABASE_URL` (adresse « pooled », avec `-pooler`) et `DATABASE_URL_DIRECT` (adresse directe).
- Paquets : ceux du squelette (`drizzle-orm`, `drizzle-kit`, `next-safe-action`, `zod`, `@tanstack/react-form`, `sonner`), plus `better-auth` à installer à sa dernière version : `npm install better-auth` (recette vérifiée avec 1.7.7). L'adaptateur Drizzle est inclus (`better-auth/adapters/drizzle`) : rien d'autre à installer.
- Composants shadcn du squelette : `button`, `field`, `input`, `sonner`. Le layout racine (`app/layout.tsx`) affiche `<Toaster />` (`@src/components/ui/sonner`) ; ajoutez-le après `{children}` s'il manque.
- `vitest.config.ts` remplace `server-only` par un module vide (alias `"server-only"` → `tests/helpers/server-only-vide.ts`). S'il manque, ajoutez l'alias, ou `vi.mock("server-only", () => ({}))` en tête de chaque test qui importe `@src/db`.
- **Sans e-mail** : cette recette ne vérifie pas les adresses et n'offre pas « mot de passe oublié ». La personne change son mot de passe depuis « Mon compte », une fois connectée. La recette `email` ajoutera les deux.

## Variables d'environnement

| Nom | Où | Valeur |
|---|---|---|
| `BETTER_AUTH_SECRET` | `.env`, Vercel (Production et Preview) | 32 caractères au moins, tirés au hasard, une valeur différente par environnement : `pulse-aidd secrets generer BETTER_AUTH_SECRET` (`.env`), puis `pulse-aidd secrets generer BETTER_AUTH_SECRET --envoyer production,preview --sans-local` (Vercel). Rien n'est affiché. |
| `BETTER_AUTH_SECRETS` | facultative, ajoutée lors d'une rotation | Forme versionnée `2:<nouvelle>,1:<ancienne>` (better-auth 1.5 et plus), lue directement par better-auth : voir `/pulse:secrets renouveler BETTER_AUTH_SECRET`. Absente au départ. |
| `BETTER_AUTH_URL` | `.env`, Vercel | Adresse du site : `http://localhost:3000` en local, `https://<projet>.vercel.app` (ou le domaine) en production |
| `DATABASE_URL` | déjà là | Adresse « pooled » de Neon (application) |
| `DATABASE_URL_DIRECT` | déjà là | Adresse directe de Neon (drizzle-kit) |

Ajoutez les deux nouveaux noms à `.env.example`, **sans valeur** :

<!-- ajout: .env.example -->
```
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

Le secret est généré par `pulse-aidd secrets generer`, qui l'écrit dans `.env` (et l'envoie à Vercel avec `--envoyer`) sans jamais l'afficher : il ne passe pas par la conversation. Les générateurs qui affichent leur résultat (`npx auth secret`, `openssl rand`) restent à l'écart : leur sortie arriverait dans la conversation.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts` (modifié) | Ajoute `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` et, facultative, `BETTER_AUTH_SECRETS` |
| `src/db/compte/auth.table.ts` | Tables `user`, `session`, `account`, `verification` (sortie de la CLI better-auth) |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/adapters/auth/auth.adapter.ts` | better-auth côté serveur : `creerAuth(db, options)`, `getAuth()`, `enTetesDeSession()` |
| `src/lib/auth-client.ts` | Client better-auth pour React (lecture de session côté navigateur) |
| `app/api/auth/[...all]/route.ts` | Adresse HTTP de better-auth |
| `src/lib/safe-action.ts` (modifié) | Ajoute `actionConnectee` |
| `src/features/compte/queries/utilisateur-connecte.query.ts` | `utilisateurConnecte()` pour les pages |
| `src/features/compte/schemas/compte.schema.ts` | Schémas Zod partagés formulaire / action |
| `src/features/compte/actions/inscrire.action.ts` | Action `inscrire` |
| `src/features/compte/actions/connecter.action.ts` | Action `connecter` |
| `src/features/compte/actions/changer-mot-de-passe.action.ts` | Action `changerMotDePasse` |
| `src/features/compte/actions/deconnecter.action.ts` | Action `deconnecter` |
| `src/features/compte/components/sections/formulaire-inscription.tsx` | Champs et validation de l'inscription |
| `src/features/compte/components/sections/formulaire-connexion.tsx` | Champs et validation de la connexion |
| `src/features/compte/components/sections/formulaire-mot-de-passe.tsx` | Champs et validation du changement de mot de passe |
| `src/features/compte/components/containers/inscription.container.tsx` | Branche `inscrire` sur le formulaire d'inscription |
| `src/features/compte/components/containers/connexion.container.tsx` | Branche `connecter` sur le formulaire de connexion |
| `src/features/compte/components/containers/mot-de-passe.container.tsx` | Branche `changerMotDePasse` sur son formulaire, message de réussite |
| `src/features/compte/components/containers/bouton-deconnexion.container.tsx` | Bouton « Se déconnecter » |
| `src/features/compte/components/containers/compte.container.tsx` | Contenu de « Mon compte » : lit la personne connectée |
| `app/(public)/inscription/page.tsx` | Page publique d'inscription |
| `app/(public)/connexion/page.tsx` | Page publique de connexion |
| `app/(connecte)/layout.tsx` | Pages connectées hors de Google (`noindex`) |
| `app/(connecte)/compte/page.tsx` | Page « Mon compte » |
| `proxy.ts` | Renvoi rapide vers `/connexion` sans cookie de session |
| `src/adapters/auth/__tests__/auth.adapter.test.ts` | Tests d'intégration better-auth + PGlite |
| `src/features/compte/schemas/__tests__/compte.schema.test.ts` | Tests unitaires des schémas |
| `e2e/aides/connexion.ts` | Aide Playwright `connecterNouvelUtilisateur(page)` |
| `e2e/compte.spec.ts` | Parcours de bout en bout |

## Étapes

<!-- commande: npm install better-auth -->

- Étape 1 – Les variables validées : `pulse-aidd pile recette connexion etape 1`
- Étape 2 – Les tables de better-auth et leur migration : `pulse-aidd pile recette connexion etape 2`
- Étape 3 – better-auth côté serveur : `pulse-aidd pile recette connexion etape 3`
- Étape 4 – Le client React et la route de better-auth : `pulse-aidd pile recette connexion etape 4`
- Étape 5 – Le client d'action « connecté » : `pulse-aidd pile recette connexion etape 5`
- Étape 6 – La personne connectée, côté pages : `pulse-aidd pile recette connexion etape 6`
- Étape 7 – Les schémas partagés : `pulse-aidd pile recette connexion etape 7`
- Étape 8 – Les actions : `pulse-aidd pile recette connexion etape 8`
- Étape 9 – Les formulaires : sections (TanStack Form + Field) : `pulse-aidd pile recette connexion etape 9`
- Étape 10 – Les containers : actions branchées, session lue : `pulse-aidd pile recette connexion etape 10`
- Étape 11 – Les pages : `pulse-aidd pile recette connexion etape 11`
- Étape 12 – Le renvoi rapide vers la connexion (`proxy.ts`) : `pulse-aidd pile recette connexion etape 12`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Compte personnel

  Règle: On crée un compte avec un nom, une adresse e-mail et un mot de passe d'au moins 8 caractères

    @US-XXX-1 @integration
    Exemple: Camille crée son compte et arrive sur « Mon compte »
      Étant donné aucun compte n'existe pour « camille@exemple.fr »
      Quand Camille crée son compte avec le nom « Camille Martin », l'adresse « camille@exemple.fr » et le mot de passe « motdepasse-solide »
      Alors la page « Mon compte » affiche « Connecté en tant que Camille Martin »

    @US-XXX-1 @integration @securite
    Exemple: Le mot de passe n'est jamais enregistré en clair
      Quand Camille crée son compte avec le mot de passe « motdepasse-solide »
      Alors la base ne contient pas le texte « motdepasse-solide »

    @US-XXX-2 @integration
    Exemple: Une adresse déjà utilisée est refusée
      Étant donné un compte existe pour « camille@exemple.fr »
      Quand quelqu'un crée un compte avec l'adresse « camille@exemple.fr »
      Alors le message « Un compte existe déjà avec cette adresse. Connectez-vous. » s'affiche

    @US-XXX-2 @unitaire
    Plan du scénario: Une saisie invalide est refusée avec un message sous le champ
      Quand Camille crée son compte avec <champ> « <saisie> »
      Alors le message « <message> » s'affiche sous le champ

      Exemples:
        | champ           | saisie       | message                  |
        | le nom          |              | Indiquez votre nom.      |
        | l'adresse       | camille@     | Adresse e-mail invalide. |
        | le mot de passe | court        | 8 caractères au moins.   |

  Règle: Seule la bonne combinaison adresse et mot de passe ouvre une session

    @US-XXX-3 @integration @securite
    Exemple: Mauvais mot de passe : la connexion est refusée
      Étant donné Camille a un compte avec le mot de passe « motdepasse-solide »
      Quand Camille se connecte avec le mot de passe « mauvais-mot-de-passe »
      Alors le message « Adresse e-mail ou mot de passe incorrect. » s'affiche
      Et Camille reste sur la page de connexion

    @US-XXX-3 @bout-en-bout @securite
    Exemple: Sans session, « Mon compte » renvoie vers la connexion
      Étant donné personne n'est connecté
      Quand quelqu'un ouvre l'adresse « /compte »
      Alors la page « Se connecter » s'affiche

    @US-XXX-3 @manuel @securite
    Exemple: Une action réservée envoyée sans session est refusée
      Étant donné personne n'est connecté
      Quand quelqu'un envoie directement la demande de changement de mot de passe
      Alors la demande est refusée avec « Connexion requise »

  Règle: Une personne connectée change son mot de passe en donnant l'actuel

    @US-XXX-4 @bout-en-bout
    Exemple: Camille change son mot de passe puis se reconnecte avec le nouveau
      Étant donné Camille est connectée
      Quand Camille remplace « motdepasse-solide » par « nouveau-mot-de-passe »
      Alors le message « Mot de passe modifié. » s'affiche
      Et Camille se reconnecte avec « nouveau-mot-de-passe »

    @US-XXX-4 @integration @securite
    Exemple: Mot de passe actuel faux : rien ne change
      Étant donné Camille est connectée
      Quand Camille donne « faux » comme mot de passe actuel
      Alors le message « Mot de passe actuel incorrect. » s'affiche
      Et l'ancien mot de passe fonctionne toujours

    @US-XXX-4 @integration @securite
    Exemple: Après le changement, l'ancien mot de passe ne marche plus
      Étant donné Camille a changé son mot de passe pour « nouveau-mot-de-passe »
      Quand Camille se connecte avec « motdepasse-solide »
      Alors la connexion est refusée

    @US-XXX-4 @unitaire
    Exemple: Confirmation différente : le changement est refusé
      Quand Camille saisit « nouveau-mot-de-passe » puis « nouveau-mot-de-passx » en confirmation
      Alors le message « Les deux mots de passe sont différents. » s'affiche sous la confirmation

  Règle: Se déconnecter ferme la session

    @US-XXX-5 @bout-en-bout @securite
    Exemple: Après la déconnexion, « Mon compte » renvoie vers la connexion
      Étant donné Camille est connectée
      Quand Camille clique sur « Se déconnecter »
      Alors la page « Se connecter » s'affiche
      Et l'adresse « /compte » renvoie vers la connexion
```

## Tâches de plan prêtes

> US terminée quand : une personne crée son compte, se connecte, change son mot de passe et se déconnecte ; « Mon compte » est inaccessible sans session.

- [ ] **T1 – Tables et configuration de better-auth** · US-XXX
  - Objectif : la base sait enregistrer les comptes et les sessions
  - Dépend de : —
  - Fichiers : à créer : `src/db/compte/auth.table.ts`, `src/adapters/auth/auth.adapter.ts`, `src/lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`, `src/adapters/auth/__tests__/auth.adapter.test.ts`, migration dans `drizzle/` · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1 à 4 – `npm test` passe ; `npm run db:migrate` crée les 4 tables
  - Tests : « Le mot de passe n'est jamais enregistré en clair » (intégration) ; « Une adresse déjà utilisée est refusée » (intégration) ; « Mauvais mot de passe : la connexion est refusée » (intégration) ; « Mot de passe actuel faux » (intégration) ; « Après le changement, l'ancien mot de passe ne marche plus » (intégration)
  - Attention : `BETTER_AUTH_SECRET` se génère avec `pulse-aidd secrets generer BETTER_AUTH_SECRET`, jamais affiché (S1)
- [ ] **T2 – Actions et client « connecté »** · US-XXX
  - Objectif : chaque écriture du compte passe par une action validée, et les pages savent qui est connecté
  - Dépend de : T1
  - Fichiers : à créer : `src/features/compte/schemas/compte.schema.ts`, `src/features/compte/actions/inscrire.action.ts`, `src/features/compte/actions/connecter.action.ts`, `src/features/compte/actions/changer-mot-de-passe.action.ts`, `src/features/compte/actions/deconnecter.action.ts`, `src/features/compte/queries/utilisateur-connecte.query.ts`, `src/features/compte/schemas/__tests__/compte.schema.test.ts` · à modifier : `src/lib/safe-action.ts`
  - Vérification : US-XXX critères 2 et 4 – `npm test`, `npm run check` et `npm run typecheck` passent
  - Tests : « Une saisie invalide est refusée avec un message sous le champ » (unitaire) ; « Confirmation différente » (unitaire)
  - Attention : un fichier par action ; chaque fichier d'`actions/` commence par `"use server"` et n'exporte que son action next-safe-action
- [ ] **T3 – Pages, formulaires et renvoi vers la connexion** · US-XXX
  - Objectif : la personne s'inscrit, se connecte, change son mot de passe et se déconnecte depuis l'écran
  - Dépend de : T2
  - Fichiers : à créer : `src/features/compte/components/sections/formulaire-inscription.tsx`, `src/features/compte/components/sections/formulaire-connexion.tsx`, `src/features/compte/components/sections/formulaire-mot-de-passe.tsx`, `src/features/compte/components/containers/inscription.container.tsx`, `src/features/compte/components/containers/connexion.container.tsx`, `src/features/compte/components/containers/mot-de-passe.container.tsx`, `src/features/compte/components/containers/bouton-deconnexion.container.tsx`, `src/features/compte/components/containers/compte.container.tsx`, `app/(public)/inscription/page.tsx`, `app/(public)/connexion/page.tsx`, `app/(connecte)/layout.tsx`, `app/(connecte)/compte/page.tsx`, `proxy.ts`
  - Vérification : US-XXX critères 1 à 5 – `npm run check` et `npm run build` passent ; parcours complet à la main en local
  - Tests : « Une action réservée envoyée sans session est refusée » (manuel)
  - Attention : les sections reçoivent tout par props, les containers appellent `useAction` ; lecture de session dans un container sous `<Suspense>` ; `id` des champs préfixés par `useId()`
- [ ] **T4 – Parcours de bout en bout** · US-XXX
  - Objectif : le parcours complet est vérifié automatiquement, et l'aide de connexion sert aux autres recettes
  - Dépend de : T3
  - Fichiers : à créer : `e2e/aides/connexion.ts`, `e2e/compte.spec.ts`
  - Vérification : US-XXX critères 1, 3, 4 et 5 – `npm run test:e2e` passe
  - Tests : « Camille crée son compte et arrive sur « Mon compte » » (bout en bout) ; « Sans session, « Mon compte » renvoie vers la connexion » (bout en bout) ; « Camille change son mot de passe puis se reconnecte avec le nouveau » (bout en bout) ; « Après la déconnexion… » (bout en bout)
- [ ] **T5 – Mise en ligne** · US-XXX
  - Objectif : la connexion marche sur le site en ligne
  - Dépend de : T4
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – `BETTER_AUTH_SECRET` et `BETTER_AUTH_URL` réglées dans Vercel ; `npm run db:migrate` appliqué à la base de production avant l'envoi ; inscription réussie sur l'adresse publique
  - Attention : la protection contre les essais répétés de mot de passe vient de la recette `limite` ; appliquez-la avant d'ouvrir le site au public

## Tests
Le code des tests : `pulse-aidd pile recette connexion tests`
## Points de sécurité

- **S1 – Secrets hors du code** : `BETTER_AUTH_SECRET` et les adresses de base vivent dans `.env` (ignoré par Git) et dans Vercel ; `.env.example` garde seulement les noms. Le secret est généré par `pulse-aidd secrets generer`, sans affichage, avec une valeur différente par environnement. `src/config/env.ts` refuse de démarrer si une variable manque, et son message nomme la variable sans afficher de valeur.
- **S2 – Clés côté client** : aucune variable `NEXT_PUBLIC_` ; `auth-client.ts` n'a besoin d'aucune clé (même domaine).
- **S3 – Contrôle d'accès aux données** : l'identifiant de la personne vient toujours de la session (`ctx.utilisateur.id`, `utilisateurConnecte().id`), jamais d'un champ du formulaire.
- **S4 – Pages et actions réservées** : `actionConnectee` relit la session à chaque appel (une Server Action est une adresse publique) ; la page « Mon compte » relit la session avec `utilisateurConnecte()`, dans `CompteContainer`. `proxy.ts` ne fait qu'un renvoi rapide : il voit la présence d'un cookie, pas sa validité.
- **S5 – Validation des entrées** : chaque action revalide avec son schéma Zod (longueurs maximales comprises). `disabledPaths` ferme les adresses HTTP d'inscription, de connexion et de changement de mot de passe de better-auth : les seules portes d'entrée sont les actions validées.
- **Mots de passe et sessions** : better-auth hache les mots de passe (scrypt) ; 8 à 128 caractères ; cookie de session `HttpOnly`, `SameSite=Lax`, préfixe `__Secure-` en production ; session de 7 jours, prolongée chaque jour d'utilisation ; changement de mot de passe avec l'actuel et déconnexion des autres appareils (`revokeOtherSessions: true`). better-auth refuse aussi les requêtes HTTP venues d'une autre origine que `BETTER_AUTH_URL`.
- **S9 – Données personnelles** : seuls le nom, l'e-mail et le mot de passe haché sont stockés (plus l'adresse IP et le navigateur de chaque session, colonnes `ip_address` et `user_agent`) : à citer dans la mention de confidentialité. La suppression d'un `user` efface ses sessions et comptes (`onDelete: "cascade"`).
- **S10 – Abus** : sans la recette `limite`, rien ne freine les essais répétés de mot de passe (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Appliquez la recette `limite` avant d'ouvrir le site au public.
- **S11 – Messages d'erreur** : messages en français, sans détail technique ; `handleServerError` journalise l'erreur côté serveur et renvoie un message générique. La connexion répond le même message pour une adresse inconnue et un mauvais mot de passe. L'inscription, elle, dit « Un compte existe déjà » : c'est le compromis courant sans e-mail de confirmation (voir « Pièges connus »).

## Pièges connus

- **`next build` échoue sur `/compte` pendant le pré-rendu** : la requête doit être lue **avant** `getAuth()`. Passez par `enTetesDeSession()` (ou `const enTetes = await headers();` sur sa propre ligne), jamais `getAuth().api.getSession({ headers: await headers() })` dans une page.
- **Renvoyé vers `/connexion` juste après « Mot de passe modifié »** : la page est réaffichée dans la réponse de l'action avec l'ancien cookie si la session est lue avec `headers()` seul. Lisez-la avec `enTetesDeSession()`, qui prend les cookies à jour.
- **Libellé qui remplit le mauvais champ, ou champ introuvable dans Playwright** : Next.js garde les pages visitées, cachées, dans le document. Préfixez les `id` avec `useId()` ; dans Playwright, utilisez `champ(page, "…")` (libellé exact + `visible: true`).
- **`npx auth generate` refuse de démarrer** (« Please remove import 'server-only' ») : utilisez le fichier `src/db/compte/auth.table.ts` de la recette. Pour un plugin better-auth qui ajoute des tables, lancez la CLI sur un fichier temporaire sans `server-only`, copiez les nouvelles tables dans `src/db/compte/auth.table.ts`, ajoutez-les à l'objet `schema` de `auth.adapter.ts`, puis supprimez le fichier temporaire.
- **`npm run check` signale `noRestrictedImports` dans `src/adapters/auth/`** : le `biome.json` du projet date d'avant l'exception de l'adapter d'authentification. Copiez dans `overrides`, juste après celui de `src/adapters/**`, l'override `src/adapters/auth/**` du squelette du pack (il ferme seulement `app/` et les features). Seul l'adapter de better-auth a cette exception.
- **`authClient.signIn.email` répond 404** : ces adresses sont fermées par `disabledPaths`. Appelez l'action `connecter`. Une recette qui ajoute un parcours HTTP de better-auth retire son chemin de `disabledPaths`.
- **Page connectée qui ne se construit pas** (`next build` signale `cookies()` ou `headers()` « accessed outside of `<Suspense>` ») : la lecture de session va dans un container sous `<Suspense>`, jamais au premier niveau d'une page ou d'un layout.
- **Nouvelle page connectée accessible sans renvoi** : ajoutez son adresse au `matcher` de `proxy.ts` (`"/factures/:path*"`). La page reste protégée par `utilisateurConnecte()` même si vous l'oubliez.
- **Formulaire muet sur une page connectée quand la session a expiré** : `proxy.ts` redirige aussi le POST de la Server Action (réponse 307), et l'action ne répond rien. Gardez le test `request.method === "GET"` du proxy : l'action arrive alors à `actionConnectee`, qui répond « Connexion requise ».
- **Redirection vers `/connexion` en réponse 200** : quand la session manque dans un composant sous `<Suspense>`, Next.js a déjà commencé à envoyer la page ; la redirection se fait dans le navigateur. C'est normal ; `proxy.ts` répond 307 avant, dès que le cookie manque.
- **Test d'intégration qui plante sur `server-only`** : ajoutez l'alias `server-only` dans `vitest.config.ts` (voir « Prérequis »).
- **Tout le monde est déconnecté après un changement de `BETTER_AUTH_SECRET`** : la signature du cookie de session utilise seulement le secret courant (code de better-auth 1.7.7), même avec `BETTER_AUTH_SECRETS`. C'est normal : chacun se reconnecte. `BETTER_AUTH_SECRETS` garde lisibles les données chiffrées par better-auth (plugins de double authentification, connexion par un service tiers, cookie de session mis en cache). Procédure : `/pulse:secrets renouveler BETTER_AUTH_SECRET`.
- **Pas de lien « Mot de passe oublié »** : il arrive avec la recette `email`. En attendant, la personne qui oublie son mot de passe contacte l'administrateur.
- **Inscription bloquée avec « Un compte existe déjà »** : quelqu'un a pu utiliser l'adresse d'une autre personne, faute de vérification par e-mail. La recette `email` règle ce cas avec `requireEmailVerification: true`.

## Sources

- Installation, variables `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL`, route `toNextJsHandler` : https://www.better-auth.com/docs/installation
- Rotation des secrets (`secrets`, `BETTER_AUTH_SECRETS=2:…,1:…`, première version pour les nouveaux chiffrements, suivantes pour relire) : https://www.better-auth.com/docs/reference/options ; lecture de `BETTER_AUTH_SECRETS` et signature des cookies par le seul secret courant : code de `better-auth@1.7.7` (`dist/context/create-context.mjs`, `dist/context/secret-utils.mjs`, `dist/api/routes/session.mjs`), lu le 2026-10-07
- Next.js, `nextCookies()` (en dernier plugin), `auth.api.getSession({ headers })`, `proxy.ts` et `getSessionCookie` (« only checks for the existence of a session cookie ; it does not validate it ») : https://www.better-auth.com/docs/integrations/next
- Adaptateur Drizzle (`schema` passé à `drizzleAdapter`), CLI `npx auth@latest generate` : https://www.better-auth.com/docs/adapters/drizzle
- E-mail et mot de passe (`requireEmailVerification`, longueurs 8–128, `autoSignIn`, `changePassword` et `revokeOtherSessions`, hachage scrypt) : https://www.better-auth.com/docs/authentication/email-password
- Sessions (7 jours, prolongées chaque jour) : https://www.better-auth.com/docs/concepts/session-management
- Limite de fréquence (production seulement ; « Server-side requests using `auth.api` bypass rate limiting ») : https://www.better-auth.com/docs/concepts/rate-limit
- `baseURL`, `trustedOrigins` : https://www.better-auth.com/docs/reference/options ; `disabledPaths` : type `BetterAuthOptions` du paquet `@better-auth/core@1.7.7` (testé : HTTP 404, `auth.api` intact)
- next-safe-action : https://next-safe-action.dev/docs/define-actions/middleware ; https://next-safe-action.dev/docs/concepts/error-handling (`returnServerError`) ; https://next-safe-action.dev/docs/execute-actions/hooks/useaction
- shadcn + TanStack Form : https://ui.shadcn.com/docs/forms/tanstack-form
- Next.js 16.4 (doc embarquée `node_modules/next/dist/docs/`) : `01-app/02-guides/authentication-with-cache-components.md` (session sous `<Suspense>`, revérifier dans chaque action) ; `01-app/01-getting-started/16-proxy.md` et `01-app/03-api-reference/03-file-conventions/proxy.md` (`proxy`, `matcher`, runtime Node.js) ; `01-app/03-api-reference/04-functions/cookies.md` (réaffichage dans la même réponse après un cookie modifié)
- Codes d'erreur, cookies, `disabledPaths`, réaffichage après changement de mot de passe : vérifiés par essai réel (better-auth 1.7.7, Next.js 16.4.0, PGlite 0.5.8, Playwright 1.63.0).
- Rejoué le 2026-10-06 sur le squelette du pack (shadcn 4.21.3 « base-nova », Biome 2.5.15) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build` sans variables, puis Playwright sur ordinateur et téléphone, avec `next start` et `next dev` branchés sur PGlite. Le scénario « Une action réservée envoyée sans session est refusée » a été joué par Playwright (cookies effacés avant l'envoi).
- Rejoué le 2026-10-08 dans l'architecture du pack (`app/` à la racine, alias `@src/`, règles de couches de Biome) : `npm run check`, `npm run typecheck`, `npm test`, `npm run build` sans variables puis avec des valeurs factices ; avec `next start`, `/compte` répond 307 vers `/connexion` et l'adresse HTTP d'inscription de better-auth répond 404. Les parcours Playwright restent à rejouer sur cette organisation.

## Points à vérifier

- **Vercel, déploiements de prévisualisation** : avec `BETTER_AUTH_URL` fixé sur l'adresse de production, better-auth refuse les requêtes HTTP venues d'une autre origine (« Invalid origin », essai fait). Les actions passent par `auth.api`, mais `/api/auth/get-session` ou `sign-out` appelés depuis une prévisualisation seraient refusés. Piste documentée : `baseURL: { allowedHosts: ["<projet>.vercel.app", "*.vercel.app"], protocol: "https", fallback: "https://<projet>.vercel.app" }`. Non essayé.
- **Limite de fréquence sur Vercel** : la limite intégrée garde ses compteurs en mémoire, propre à chaque instance (« may not be suitable […] in serverless environments »). La recette `limite` doit couvrir les actions `connecter` et `inscrire`.
- **Connexion réelle à Neon** : tout le parcours a été essayé sur PGlite ; à rejouer une fois sur Neon (`npm run db:migrate`, puis inscription en ligne).
- **Dates sans fuseau dans les tables better-auth** : la CLI génère `timestamp` sans `with time zone`, contrairement à la règle 26 de la fiche. Sans effet tant que la base tourne en UTC (cas de Neon) ; laissé tel quel pour pouvoir régénérer.
