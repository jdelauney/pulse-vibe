# Valeurs de `docs/technical.md` pour la pile Pulse Next.js

À recopier dans `docs/technical.md` par `/pulse:tech` quand la personne choisit cette pile, en adaptant le texte au projet. Les versions exactes sont celles du `package.json` posé par le squelette (dernières versions publiées, vérifiées par la construction et les tests du pack) : les relever avec `npm ls --depth=0` après `npm install`.

## Pile retenue

| Élément | Choix | Pourquoi (en une phrase) |
|---|---|---|
| Langage | TypeScript (strict) | Le code est vérifié avant de tourner : beaucoup d'erreurs sont signalées dès l'écriture. |
| Framework | Next.js (App Router), React | Pages, logique serveur et mise en ligne dans un seul projet, très bien documenté. |
| Interface | Tailwind CSS et shadcn/ui | Des composants accessibles, prêts à l'emploi, habillés par le thème du projet. |
| Données | Neon (Postgres), région Francfort ; Drizzle ORM | Une vraie base de données, gratuite au démarrage, en Europe ; les tables sont décrites en TypeScript. |
| Connexion des utilisateurs | better-auth (e-mail et mot de passe) | Une connexion éprouvée, dont les données restent dans votre base. |
| Code serveur | Server Actions (next-safe-action, Zod) | Chaque écriture est validée et vérifiée côté serveur. |
| Hébergement | Vercel, fonctions à Francfort (`fra1`) | Mise en ligne automatique à chaque envoi, proche de la base. |
| Services externes | selon les recettes retenues (e-mail, fichiers, paiement…) | |
| Tests automatiques | Vitest (unitaires et intégration, base PGlite en mémoire) ; Playwright (bout en bout) | Les scénarios de la spec deviennent des tests, sans toucher à la vraie base. |

**Pack de pile Pulse** : next

## Organisation des fichiers

Palier : hexagonal simplifié du pack Next.js (référence « Architecture du code » du pack). Noms de dossiers de domaine tirés du glossaire, identiques dans `src/core/`, `src/db/` et `src/features/` ; identifiants de code en anglais simple ou en français selon le métier ; textes affichés en français.

```
app/                      routes ; (connecte)/ pour les pages réservées ; api/ pour les Route Handlers
proxy.ts                  redirection vers la connexion
src/
  core/<domaine>/         règles métier pures : entity, rules, errors, ports, use-cases/
  db/<domaine>/           tables (.table.ts) et repositories (.repository.ts) ; db/db-client.ts : getDb()
  features/<domaine>/     actions/, queries/, schemas/, components/{containers,sections,composites,elements}/, hooks/
  adapters/<service>/     services externes (auth, e-mail, fichiers, paiement)
  components/             ui/ (shadcn), shared/
  lib/                    utils, auth-client, safe-action, logger, errors/, seo/, helpers/
  config/                 env, site, projet
tests/helpers/            aides de test, base de test
e2e/                      tests de bout en bout (Playwright)
drizzle/                  migrations
```

- Sans fichier de réexportation (`index.ts`) : on importe directement le fichier visé ; une feature importe d'une autre seulement `actions/`, `queries/` et `components/`.
- 20 fichiers au plus par dossier (hors `src/components/ui/`) ; tests unitaires et d'intégration dans `__tests__/`. Vérifié par `npm test` (`tests/structure.test.ts`) et `npm run check` (Biome).
- Suffixes : `.entity`, `.rules`, `.errors`, `.port`, `.use-case`, `.table`, `.repository`, `.adapter`, `.action`, `.query`, `.schema`, `.webhook`, `.container`, `.store` (état global côté navigateur, dans `src/stores/`), `.test` (Vitest), `.spec` (Playwright).

## Commandes du projet

| Action | Commande |
|---|---|
| Installer les dépendances | `npm install` (première fois aussi : `npx playwright install chromium`) |
| Lancer en local | `npm run dev`, puis ouvrir http://localhost:3000 |
| Tester | `npm test` (bout en bout : `npm run test:e2e`) |
| Contrôles automatiques (lint, format, types) | `npm run check` et `npm run typecheck` (corriger le format : `npm run format`) |
| Auditer les dépendances | `npm audit --omit=dev --audit-level=high` |
| Construire | `npm run build` |
| Déployer | automatique à chaque envoi sur `main` (Vercel), migrations comprises (`scripts/migrer.mjs`, sauvegarde Neon avant chaque migration de production) ; en local, sur la branche `dev` : `npm run db:migrate` |

## Données et contrôle d'accès

- Où sont les données : base Neon (Postgres), région Francfort (`aws-eu-central-1`).
- Qui peut lire, créer, modifier, supprimer quoi : {{par table : la personne propriétaire (colonne utilisateurId), un rôle éventuel}}.
- Où c'est vérifié : côté serveur, dans chaque action (`actionConnectee` puis condition `utilisateurId` dans le repository) et dans chaque lecture (`utilisateurConnecte()` puis filtre `utilisateurId`). `proxy.ts` redirige seulement, par confort.
- Sauvegarde et restauration : Neon garde l'historique de la base ; restauration à un instant donné depuis la console Neon (Restore), à essayer une fois sur une branche de test. Avant chaque migration de production, une branche `sauvegarde-AAAAMMJJ-HHMM` est gardée 7 jours (`scripts/migrer.mjs`). Marche à suivre : section « Retour arrière » plus bas.

## Secrets et variables d'environnement

- Fichier local non versionné : `.env` (ou `.env.local`) à la racine ; modèle versionné : `.env.example`.
- Variables : `DATABASE_URL` (adresse « pooled » de Neon, serveur), `DATABASE_URL_DIRECT` (adresse directe, migrations), puis celles des recettes (ex. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` pour la connexion). Toutes côté serveur ; aucune ne commence par `NEXT_PUBLIC_` sauf une clé prévue pour être publique.
- `SITE_URL` (non secrète, Production) : l'adresse officielle du site, une fois le domaine définitif.
- Une base par environnement : `.env` porte les adresses de la branche `dev` de Neon ; Production et chaque prévisualisation reçoivent les leurs de l'intégration Vercel–Neon (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`), jamais celles de `.env`.
- `NEON_API_KEY` (clé d'API limitée au projet, secret) et `NEON_PROJECT_ID` (identifiant du projet Neon), en Production seulement : la sauvegarde avant chaque migration.
- En production : à saisir par la personne dans Vercel (Project → Settings → Environment Variables), pour Production et Preview, ou `pulse-aidd secrets envoyer` (Vercel CLI relié). Une variable propre à chaque environnement (adresse du site, clés Stripe) part en production depuis `.env.envoi`. L'inventaire et le journal des rotations : `docs/secrets.md` (`/pulse:secrets`).

## Hébergement et mise en ligne

- Dépôt distant : {{GitHub, d'après /pulse:init}}.
- Hébergeur : Vercel (offre Hobby, gratuite, réservée à un usage non commercial ; offre Pro pour une activité commerciale), fonctions en `fra1` (fichier `vercel.json`) ; mise en ligne automatique à chaque envoi sur `main`, adresse de prévisualisation pour chaque demande de fusion.
- Contrôle automatique avant mise en ligne (CI) : à mettre en place avec `/pulse:cicd` (GitHub Actions).

## Mise en place

1. Créer un compte **Neon** (https://console.neon.tech) et un projet en région **AWS Europe Central 1 (Frankfurt)**. Sa branche principale sert la **production**. Créer la branche de développement : **Branches** → **New branch** → nom `dev`, parent la branche principale, case « Automatically delete branch after » **décochée** (cochée par défaut : la branche disparaîtrait au bout d'un jour) → **Create**. Sur la branche `dev`, bouton **Connect** : copier l'adresse « pooled » dans `DATABASE_URL` et l'adresse directe (sans `-pooler`) dans `DATABASE_URL_DIRECT` de `.env`, que la personne crée elle-même à partir de `.env.example`. Les essais et `npm run db:migrate` touchent ainsi `dev`, jamais les données réelles.
2. Créer un compte **Vercel** (https://vercel.com), relié au compte GitHub. Le projet Vercel se crée à la première mise en ligne.
3. Poser le squelette : `pulse-aidd pile squelette --nom "<nom du projet>" --description "<la phrase du brief>"`.
4. `npm install` (il écrit `package-lock.json`, enregistré avec le code : les versions exactes de toutes les dépendances), puis `npx playwright install chromium`.
5. Vérifier : `npm run dev` (la page d'accueil affiche le nom du projet), `npm run check`, `npm run typecheck`, `npm test`.
6. Si `docs/design.md` existe : appliquer le thème (référence « Le thème »).
7. Avant la première version qui lit la base en ligne : relier Neon à Vercel et préparer la sauvegarde avant migration (consignes « Pour mettre en ligne » du pack, `pulse-aidd pile reference contexte/deploy.md`).

## Retour arrière

- **Le site** : Vercel → le projet → tuile « Production Deployment » → **Instant Rollback** → la version précédente → **Continue** → **Confirm Rollback**. Effet immédiat. Sur l'offre Hobby, seule la version juste précédente est proposée. Ensuite, les envois sur `main` ne passent plus en ligne d'eux-mêmes : une fois la correction prête et envoyée, **Undo Rollback** (même tuile) remet la mise en ligne automatique.
- **Les données**, seulement si une migration ou une écriture les a abîmées : console Neon → la branche principale → **Postgres database** → **Backup & Restore** → **Restore from history** → l'heure d'avant la migration (journal de construction Vercel : « Sauvegarde créée : branche Neon « sauvegarde-AAAAMMJJ-HHMM » », heure UTC) → **Next** → **Restore**. Toutes les données de la branche reviennent à cet instant ; Neon garde l'état d'avant dans une branche `<nom>_old_<horodatage>`. Possible pendant la fenêtre d'historique du projet : 6 heures sur l'offre gratuite, jusqu'à 7 jours sur Launch. Au-delà, la branche `sauvegarde-…` (gardée 7 jours) contient les données d'avant la migration : les relire dans la console (**SQL Editor**, branche `sauvegarde-…`) et recopier ce qui manque, avec l'accord de la personne.
- **Dans quel ordre** : le site d'abord, puis les données si besoin. Une migration qui ajoute seulement des tables ou des colonnes laisse l'ancienne version fonctionner : les données restent telles quelles.
