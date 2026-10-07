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
  db/<domaine>/           tables (.table.ts) et repositories (.repository.ts) ; db/index.ts : getDb()
  features/<domaine>/     actions/, queries/, schemas/, components/{containers,sections,composites,elements}/, hooks/
  adapters/<service>/     services externes (auth, e-mail, fichiers, paiement)
  components/             ui/ (shadcn), shared/
  lib/                    safe-action, logger, errors/, seo/, helpers/
  config/                 env, site, projet
tests/helpers/            aides de test, base de test
e2e/                      tests de bout en bout (Playwright)
drizzle/                  migrations
```

- Sans fichier de réexportation (`index.ts`) : on importe directement le fichier visé ; une feature importe d'une autre seulement `actions/`, `queries/` et `components/`.
- 20 fichiers au plus par dossier (hors `src/components/ui/`) ; tests unitaires et d'intégration dans `__tests__/`. Vérifié par `npm test` (`tests/structure.test.ts`) et `npm run check` (Biome).
- Suffixes : `.entity`, `.rules`, `.errors`, `.port`, `.use-case`, `.table`, `.repository`, `.adapter`, `.action`, `.query`, `.schema`, `.webhook`, `.container`, `.test` (Vitest), `.spec` (Playwright).

## Commandes du projet

| Action | Commande |
|---|---|
| Installer les dépendances | `npm install` (première fois aussi : `npx playwright install chromium`) |
| Lancer en local | `npm run dev`, puis ouvrir http://localhost:3000 |
| Tester | `npm test` (bout en bout : `npm run test:e2e`) |
| Contrôles automatiques (lint, format, types) | `npm run check` et `npm run typecheck` (corriger le format : `npm run format`) |
| Construire | `npm run build` |
| Déployer | automatique à chaque envoi sur `main` (Vercel) ; migrations de base : `npm run db:migrate` |

## Données et contrôle d'accès

- Où sont les données : base Neon (Postgres), région Francfort (`aws-eu-central-1`).
- Qui peut lire, créer, modifier, supprimer quoi : {{par table : la personne propriétaire (colonne utilisateurId), un rôle éventuel}}.
- Où c'est vérifié : côté serveur, dans chaque action (`actionConnectee` puis condition `utilisateurId` dans le repository) et dans chaque lecture (`utilisateurConnecte()` puis filtre `utilisateurId`). `proxy.ts` redirige seulement, par confort.

## Secrets et variables d'environnement

- Fichier local non versionné : `.env` (ou `.env.local`) à la racine ; modèle versionné : `.env.example`.
- Variables : `DATABASE_URL` (adresse « pooled » de Neon, serveur), `DATABASE_URL_DIRECT` (adresse directe, migrations), puis celles des recettes (ex. `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` pour la connexion). Toutes côté serveur ; aucune ne commence par `NEXT_PUBLIC_` sauf une clé prévue pour être publique.
- `SITE_URL` (non secrète, Production) : l'adresse officielle du site, une fois le domaine définitif.
- En production : à saisir par la personne dans Vercel (Project → Settings → Environment Variables), pour Production et Preview, ou `pulse-aidd secrets envoyer` (Vercel CLI relié). L'inventaire et le journal des rotations : `docs/secrets.md` (`/pulse:secrets`).

## Hébergement et mise en ligne

- Dépôt distant : {{GitHub, d'après /pulse:init}}.
- Hébergeur : Vercel (offre Hobby, gratuite, réservée à un usage non commercial ; offre Pro pour une activité commerciale), fonctions en `fra1` (fichier `vercel.json`) ; mise en ligne automatique à chaque envoi sur `main`, adresse de prévisualisation pour chaque demande de fusion.
- Contrôle automatique avant mise en ligne (CI) : à mettre en place avec `/pulse:cicd` (GitHub Actions).

## Mise en place

1. Créer un compte **Neon** (https://console.neon.tech), un projet en région **AWS Europe Central 1 (Frankfurt)**, puis copier les deux adresses de connexion (« pooled » et directe) dans `.env`, que la personne crée elle-même à partir de `.env.example`.
2. Créer un compte **Vercel** (https://vercel.com), relié au compte GitHub. Le projet Vercel se crée à la première mise en ligne.
3. Poser le squelette : `pulse-aidd pile squelette --nom "<nom du projet>" --description "<la phrase du brief>"`.
4. `npm install`, puis `npx playwright install chromium`.
5. Vérifier : `npm run dev` (la page d'accueil affiche le nom du projet), `npm run check`, `npm run typecheck`, `npm test`.
6. Si `docs/design.md` existe : appliquer le thème (référence « Le thème »).
