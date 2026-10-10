# Recette : limite

> Quand l'utiliser : le site a une connexion, une inscription ou un formulaire public, et doit freiner les essais en rafale (devinette de mots de passe, spam, e-mails en boucle).

## Prérequis

- La base Neon du squelette : par défaut, les compteurs y sont rangés (aucun compte ni aucune clé en plus).
- Pour protéger la connexion et l'inscription : recette `connexion` appliquée (actions `inscrire` et `connecter`, `actionPublique` de `src/lib/safe-action.ts`).
- Pour un formulaire ouvert à tous (contact, devis, avis) : cette recette, puis la recette `formulaire-public` (`pulse-aidd pile recette formulaire-public`).
- Option Redis (site à fort trafic) : voir « Option : Redis (Upstash) » en fin d'étapes.
- Vérifiée automatiquement par la CI du pack, chaque semaine aux dernières versions (chaîne `connexion,limite,formulaire-public` de `verifier-recettes.js`), option Redis comprise : contrôles, types, tests unitaires et d'intégration (PGlite ; panne d'Upstash simulée par une adresse locale injoignable), construction. `npm run db:migrate` n'est pas lancé : PGlite applique les migrations dans les tests. Upstash n'est jamais appelé : le fonctionnement avec un vrai compte Upstash reste un essai à la main.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `LIMITE_STOCKAGE` | Facultative. Où ranger les compteurs : `base` (par défaut, la base Neon), `redis` (option Upstash) ou `memoire` (tests et développement local seulement) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Seulement avec `LIMITE_STOCKAGE=redis` (voir l'option Redis) |

`LIMITE_STOCKAGE` reste absente de `.env.example` et de Vercel quand la base suffit : sa valeur par défaut est `base`.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/core/shared/limiteur.port.ts` | Le contrat commun des limiteurs |
| `src/lib/helpers/limite/ip-et-message.ts` | Lecture de l'IP et message (fonctions pures) |
| `src/lib/helpers/limite/limiteur-memoire.ts` | Limiteur en mémoire (tests, développement local) |
| `src/db/limite/limite.table.ts`, `drizzle/<numéro>_<nom>.sql` | Table `limites` et sa migration |
| `src/db/limite/limite.repository.ts` | Limiteur en base (par défaut) |
| `src/lib/limite.ts` | Les règles, le choix du limiteur, `verifierLimite` et `exigerLimite` |
| `src/config/env.ts` (modifié) | `LIMITE_STOCKAGE` (et les variables Upstash de l'option) |
| `tests/helpers/contrat-limiteur.ts` | Tests communs à tous les limiteurs |
| `src/lib/helpers/limite/__tests__/`, `src/db/limite/__tests__/`, `src/lib/__tests__/limite.test.ts`, `src/config/__tests__/env-limite.test.ts` | Tests |
| `src/features/compte/actions/inscrire.action.ts`, `connecter.action.ts` (modifiés) | `exigerLimite` en tête |
| `src/features/compte/actions/demander-nouveau-mot-de-passe.action.ts` (modifié, avec la recette `email`) | `exigerLimite("motDePasseOublie")` en tête |
| `src/adapters/limite/upstash.adapter.ts` et son test (option Redis) | Limiteur Upstash |

Formulaires publics (contact, avis, lettre) : recette `formulaire-public`, qui s'appuie sur celle-ci.

## Étapes

- Étape 1 – Le contrat des limiteurs : `pulse-aidd pile recette limite etape 1`
- Étape 2 – Les fonctions pures et le limiteur en mémoire : `pulse-aidd pile recette limite etape 2`
- Étape 3 – La table et la migration : `pulse-aidd pile recette limite etape 3`
- Étape 4 – Le limiteur en base : `pulse-aidd pile recette limite etape 4`
- Étape 5 – Les variables : `pulse-aidd pile recette limite etape 5`
- Étape 6 – La garde : `pulse-aidd pile recette limite etape 6`
- Étape 7 – Protéger la connexion, l'inscription et le mot de passe oublié : `pulse-aidd pile recette limite etape 7`
- Étape 8 – Essayer : `pulse-aidd pile recette limite etape 8`
- Étape 9 – Mettre en ligne : `pulse-aidd pile recette limite etape 9`
- Étape option-redis – Option : Redis (Upstash), pour un site à fort trafic : `pulse-aidd pile recette limite etape option-redis`
## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Limite de requêtes

  Règle: Au-delà de la limite, la personne reçoit un message clair

    @US-XXX-1 @unitaire @securite
    Exemple: Sixième tentative de connexion en une minute : refusée avec un message en français
      Étant donné 5 tentatives de connexion depuis l'adresse 203.0.113.7 dans la dernière minute
      Quand une sixième tentative arrive
      Alors elle est refusée avec « Trop de tentatives. Réessayez dans 1 minute. »

    @US-XXX-1 @unitaire
    Exemple: Attente de 9 minutes et demie : le message annonce 10 minutes
      Étant donné la limite se termine dans 9 minutes et 30 secondes
      Quand le message est préparé
      Alors il dit « Trop de tentatives. Réessayez dans 10 minutes. »

    @US-XXX-1 @manuel @securite
    Exemple: Six mots de passe faux de suite sur le site : le sixième essai est bloqué
      Étant donné Camille a un compte
      Quand Camille se trompe de mot de passe six fois en moins d'une minute
      Alors Camille lit « Trop de tentatives. Réessayez dans 1 minute. »

  Règle: La limite s'applique par adresse IP du visiteur

    @US-XXX-2 @unitaire
    Exemple: L'adresse retenue est la première de x-forwarded-for
      Étant donné une requête qui porte « 203.0.113.7, 10.0.0.1 » dans x-forwarded-for
      Quand l'adresse du visiteur est lue
      Alors l'adresse retenue est « 203.0.113.7 »

  Règle: Limiteur indisponible : le site reste utilisable

    @US-XXX-3 @integration
    Exemple: L'incident est journalisé sans l'adresse IP
      Étant donné le limiteur ne répond pas
      Quand un formulaire public est envoyé
      Alors l'envoi est accepté et l'incident est journalisé

  Règle: Les compteurs restent justes quand des envois arrivent ensemble

    @US-XXX-4 @integration @securite
    Exemple: Dix envois simultanés avec une limite de trois : trois sont acceptés
      Étant donné une règle de 3 tentatives par minute
      Quand 10 tentatives arrivent au même instant depuis la même adresse
      Alors 3 sont acceptées et 7 refusées
```

## Tâches de plan prêtes

- [ ] **Tn – Compter les tentatives par adresse IP** · US-XXX
  - Objectif : le site sait compter les tentatives par adresse IP et refuser au-delà de la limite, avec un message clair
  - Dépend de : —
  - Fichiers : à créer : `src/core/shared/limiteur.port.ts`, `src/lib/helpers/limite/ip-et-message.ts`, `src/lib/helpers/limite/limiteur-memoire.ts`, `src/db/limite/limite.table.ts`, migration dans `drizzle/`, `src/db/limite/limite.repository.ts`, `src/lib/limite.ts`, `tests/helpers/contrat-limiteur.ts` et les tests de la section « Tests » · à modifier : `src/config/env.ts`
  - Vérification : US-XXX critères 1 à 4 – `npm test` passe (base PGlite et mémoire)
  - Tests : « Sixième tentative de connexion en une minute… », « Attente de 9 minutes et demie… », « L'adresse retenue est la première de x-forwarded-for » (unitaires) ; « L'incident est journalisé sans l'adresse IP », « des envois simultanés ne dépassent jamais la limite » (intégration)
- [ ] **Tn+1 – Freiner les essais en rafale** · US-XXX
  - Objectif : la connexion, l'inscription et le mot de passe oublié refusent les essais en rafale
  - Dépend de : Tn
  - Fichiers : à modifier : `src/features/compte/actions/inscrire.action.ts`, `src/features/compte/actions/connecter.action.ts` (et `demander-nouveau-mot-de-passe.action.ts` avec la recette `email`)
  - Vérification : US-XXX critère 1 – six mots de passe faux en moins d'une minute : le message s'affiche
  - Tests : « Six mots de passe faux de suite sur le site… » (manuel)
- [ ] **Tn+2 (facultative) – Passer les compteurs sur Redis** · US-XXX
  - Objectif : les compteurs sont rangés dans Upstash pour tenir un fort trafic
  - Dépend de : Tn
  - Fichiers : à créer : `src/adapters/limite/upstash.adapter.ts`, `src/adapters/limite/__tests__/upstash.adapter.test.ts` · à modifier : `src/config/env.ts`, `src/lib/limite.ts`, `src/config/__tests__/env-limite.test.ts`, `.env.example`
  - Vérification : `npm test` passe, dont « Upstash injoignable : la tentative est laissée passer » ; un essai sur le site montre les clés `limite:…` dans la console Upstash
  - Action manuelle : créer la base Upstash (Francfort, offre gratuite), saisir `LIMITE_STOCKAGE=redis`, `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` dans `.env` et dans Vercel, puis redéployer

## Tests
Le code des tests : `pulse-aidd pile recette limite tests`
## Points de sécurité

- **S1, S2 – Secrets** : avec l'option Redis, `UPSTASH_REDIS_REST_TOKEN` reste côté serveur (`server-only`, sans `NEXT_PUBLIC_`).
- **S10 – Abus et coûts** : connexion (5 par minute), inscription et mot de passe oublié (3 par 10 minutes), formulaires publics (5 par minute), comptés par IP. Les e-mails déclenchés par un inconnu restent bornés.
- **S9 – Données personnelles** : la table `limites` garde des adresses IP, au plus un jour (effacées au passage) ; avec Redis, elles sont effacées à la fin de chaque fenêtre. À citer dans la mention de confidentialité (hébergement Neon, ou Upstash, à Francfort). Le journal note la règle et des codes techniques, sans l'adresse IP ni le texte de l'erreur.
- **S11 – Messages d'erreur** : le message dit seulement d'attendre, et pour combien de temps.
- La limite s'ajoute aux autres protections : la session et le schéma Zod restent vérifiés dans chaque action.

## Pièges connus

- **Toutes les requêtes locales comptent pour une seule IP** : en local, `x-forwarded-for` est absent et l'identifiant vaut `inconnue`. C'est normal. Un parcours Playwright qui se connecte plus de 5 fois par minute atteint la limite : espacer les connexions ou relever `REGLES` le temps des essais.
- **IP falsifiable hors de Vercel** : Vercel réécrit `x-forwarded-for`. Chez un autre hébergeur, vérifier qui écrit cet en-tête avant de s'y fier.
- **Plusieurs personnes derrière la même IP** (entreprise, école, événement, réseau Wi-Fi partagé) : elles partagent la limite. Si un groupe utilise le site en même temps depuis un même lieu, relever les nombres de `REGLES` le temps nécessaire.
- **`exigerLimite` placé après un `try`** : le placer en première ligne de l'action, hors de tout `try … catch` ; il arrête l'action avec `returnServerError`.
- **Limiteur appelé ailleurs que dans une action ou un Route Handler** : les containers et les sections restent sans appel au limiteur ; la limite s'applique côté serveur, en première ligne de l'action.
- **`LIMITE_STOCKAGE=memoire` en ligne** : chaque instance Vercel compte de son côté, la limite ne tient plus ; un avertissement apparaît dans les journaux. Mettre `base` ou retirer la variable.
- **`npm run db:generate` réclame `DATABASE_URL_DIRECT`** : les deux adresses Neon du squelette sont dans `.env` (adresse « pooled » et adresse directe).
- **Projet qui a appliqué l'ancienne recette (Upstash seul, `src/adapters/limite/limite.adapter.ts`)** : créer les fichiers des étapes 1 à 6 et de l'option Redis, supprimer `limite.adapter.ts` et son test, remplacer les imports par `@src/lib/limite`, puis ajouter `LIMITE_STOCKAGE=redis` pour garder Upstash (ou rien pour passer à la base, avec la migration de l'étape 3). Vérifier avec `npm run check && npm test`.
- **Offre gratuite d'Upstash dépassée** (option Redis) : chaque vérification consomme des commandes Redis ; surveiller le compteur dans la console Upstash.

## Sources

- PostgreSQL, `INSERT … ON CONFLICT DO UPDATE` : https://www.postgresql.org/docs/current/sql-insert.html
- Drizzle, `onConflictDoUpdate` : https://orm.drizzle.team/docs/insert#on-conflict-do-update ; PGlite : https://orm.drizzle.team/docs/connect-pglite
- @upstash/ratelimit 2.2.0, paquet installé : `dist/index.d.ts` (`timeout`, `ephemeralCache`, `RatelimitResponse`, `Duration` dont `${number} ms`) ; `dist/index.mjs` (au bout du délai : `success: true`, raison `timeout`)
- @upstash/redis 1.39.0 : `nodejs.d.ts` (`url`, `token`)
- Upstash : https://upstash.com/pricing/redis (offre gratuite) ; https://upstash.com/docs/devops/developer-api/redis/create_database_global (régions `eu-central-1`, `eu-west-1`)
- Vercel : https://vercel.com/docs/headers/request-headers (`x-forwarded-for` réécrit par la plateforme, `x-real-ip`)
- better-auth : https://www.better-auth.com/docs/concepts/rate-limit (« Server-side requests using `auth.api` bypass rate limiting »)
- next-safe-action 8.7.3 : `dist/index.d.mts` (`returnServerError`)
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/headers.md`
- Vérifications locales le 2026-10-08, sur le squelette du pack (Next.js 16.4.0, Drizzle 0.45.3, PGlite 0.5.8, Zod 4.6.5, Vitest 5.0.3) : `npm run db:generate`, `npm run check`, `npm run typecheck`, `npm test` (dont le contrat des limiteurs en mémoire et sur PGlite) et `npm run build` passent sans les paquets Upstash ; puis, avec l'option Redis appliquée, les mêmes commandes et le test de panne d'Upstash

## Points à vérifier

- Le refus effectif au sixième essai sur une vraie base Neon et avec une vraie base Upstash : test manuel prévu (US-XXX-1).
- Les libellés exacts de la console Upstash (création d'une base, section REST API) et le sort d'une base gratuite inutilisée longtemps : non précisés par la page des tarifs.
- La durée du test de panne d'Upstash en CI (2 secondes au plus grâce à `timeout`) : à allonger si la CI est lente.
