# Recette : limite

> Quand l'utiliser : le site a une connexion, une inscription ou un formulaire public, et doit freiner les essais en rafale (devinette de mots de passe, spam, e-mails en boucle).

## Prérequis

- La base Neon du squelette : par défaut, les compteurs y sont rangés (aucun compte ni aucune clé en plus).
- Pour protéger la connexion et l'inscription : recette `connexion` appliquée (actions `inscrire` et `connecter`, `actionPublique` de `src/lib/safe-action.ts`).
- Pour un formulaire ouvert à tous (contact, devis, avis) : cette recette, puis la recette `formulaire-public` (`pulse-aidd pile recette formulaire-public`).
- Option Redis (site à fort trafic) : voir « Option : Redis (Upstash) » en fin d'étapes.

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

### 1. Le contrat des limiteurs

Trois limiteurs savent compter : la base (par défaut), Redis (option) et la mémoire (tests). Ils suivent le même contrat, placé dans `src/core/shared/` : la garde de l'étape 6 les utilise sans savoir lequel est choisi.

```ts
// src/core/shared/limiteur.port.ts
// Contrat commun des limiteurs de requêtes : base (Neon), Redis (Upstash) ou mémoire.

export type RegleLimite = { nombre: number; fenetreMs: number };

/** `reset` : instant (en millisecondes) où la fenêtre se termine. */
export type ResultatLimite = { accepte: boolean; reset: number };

export interface Limiteur {
  /** Compte une tentative pour `cle` et dit si elle reste dans la règle. */
  verifier(
    cle: string,
    regle: RegleLimite,
    maintenant: number,
  ): Promise<ResultatLimite>;
}
```

### 2. Les fonctions pures et le limiteur en mémoire

Techniques et sans service : elles vivent dans `src/lib/helpers/limite/`. Le limiteur en mémoire sert aux tests et au développement local.

```ts
// src/lib/helpers/limite/ip-et-message.ts
// Fonctions pures de la limite de requêtes, testées en unitaire.

// Sur Vercel, x-forwarded-for est réécrit par la plateforme : la première adresse est celle du visiteur.
export function ipDepuis(entetes: Headers): string {
  const premiere = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
  return premiere || entetes.get("x-real-ip") || "inconnue";
}

export function messageLimite(reset: number, maintenant: number): string {
  const minutes = Math.max(1, Math.ceil((reset - maintenant) / 60_000));
  return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}
```

```ts
// src/lib/helpers/limite/limiteur-memoire.ts
// Limiteur en mémoire, pour les tests et le développement local. Sur Vercel, chaque instance
// garde ses propres compteurs : en ligne, utilisez la base (par défaut) ou Redis.
import type { Limiteur } from "@src/core/shared/limiteur.port";

const TAILLE_AVANT_MENAGE = 10_000;

export function limiteurMemoire(): Limiteur {
  const compteurs = new Map<string, { compte: number; debut: number }>();
  return {
    async verifier(cle, { nombre, fenetreMs }, maintenant) {
      if (compteurs.size > TAILLE_AVANT_MENAGE) {
        for (const [c, v] of compteurs) {
          if (v.debut <= maintenant - fenetreMs) compteurs.delete(c);
        }
      }
      const actuel = compteurs.get(cle);
      const suivant =
        !actuel || actuel.debut <= maintenant - fenetreMs
          ? { compte: 1, debut: maintenant }
          : { compte: actuel.compte + 1, debut: actuel.debut };
      compteurs.set(cle, suivant);
      return {
        accepte: suivant.compte <= nombre,
        reset: suivant.debut + fenetreMs,
      };
    },
  };
}
```

### 3. La table et la migration

Une ligne par règle et par adresse IP. `drizzle.config.ts` lit déjà `src/db/*/*.table.ts`.

```ts
// src/db/limite/limite.table.ts
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Compteurs de la limite de requêtes : une ligne par règle et par adresse IP.
export const limites = pgTable(
  "limites",
  {
    cle: text().primaryKey(),
    compte: integer().notNull(),
    debut: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index("limites_debut_idx").on(table.debut)],
);
```

Générez la migration, relisez le fichier SQL créé dans `drizzle/`, puis appliquez-la (les deux adresses Neon, `DATABASE_URL` et `DATABASE_URL_DIRECT`, sont dans `.env`) :

```bash
npm run db:generate
npm run db:migrate
```

### 4. Le limiteur en base

Une seule requête compte la tentative : elle crée la ligne, ou l'incrémente, ou la remet à 1 si la fenêtre est écoulée (`onConflictDoUpdate`, c'est-à-dire `INSERT … ON CONFLICT DO UPDATE` de Postgres). Postgres verrouille la ligne pendant la mise à jour : deux envois simultanés sont comptés l'un après l'autre, sans dépasser la limite. Environ une vérification sur cinquante efface au passage des compteurs de plus d'un jour, sans tâche planifiée.

```ts
// src/db/limite/limite.repository.ts
import "server-only";
import type { Limiteur } from "@src/core/shared/limiteur.port";
import type { Db } from "@src/db/db-client";
import { inArray, lt, sql } from "drizzle-orm";
import { limites } from "./limite.table";

const UN_JOUR_MS = 86_400_000;
const LOT_DE_MENAGE = 500;

/**
 * Limiteur rangé dans Postgres (Neon) : une ligne par clé, comptée en une seule requête.
 * Postgres verrouille la ligne pendant la mise à jour : deux envois simultanés sont comptés l'un après l'autre.
 */
export function limiteurBase(
  db: Db,
  options: { nettoyer?: () => boolean } = {},
): Limiteur {
  // Environ une vérification sur cinquante efface au passage des compteurs de plus d'un jour.
  const nettoyer = options.nettoyer ?? (() => Math.random() < 0.02);
  return {
    async verifier(cle, { nombre, fenetreMs }, maintenant) {
      const instant = new Date(maintenant).toISOString();
      const finDeLaFenetrePrecedente = new Date(
        maintenant - fenetreMs,
      ).toISOString();
      const fenetreEcoulee = sql`${limites.debut} <= ${finDeLaFenetrePrecedente}::timestamptz`;
      const [ligne] = await db
        .insert(limites)
        .values({ cle, compte: 1, debut: new Date(maintenant) })
        .onConflictDoUpdate({
          target: limites.cle,
          set: {
            compte: sql`case when ${fenetreEcoulee} then 1 else ${limites.compte} + 1 end`,
            debut: sql`case when ${fenetreEcoulee} then ${instant}::timestamptz else ${limites.debut} end`,
          },
        })
        .returning({ compte: limites.compte, debut: limites.debut });
      if (nettoyer()) {
        await effacerAnciens(db, maintenant);
      }
      return {
        accepte: ligne.compte <= nombre,
        reset: ligne.debut.getTime() + fenetreMs,
      };
    },
  };
}

async function effacerAnciens(db: Db, maintenant: number) {
  const anciens = db
    .select({ cle: limites.cle })
    .from(limites)
    .where(lt(limites.debut, new Date(maintenant - UN_JOUR_MS)))
    .limit(LOT_DE_MENAGE);
  await db.delete(limites).where(inArray(limites.cle, anciens));
}
```

### 5. Les variables

Dans `src/config/env.ts`, ajouter dans `server: { … }` :

```ts
    // Recette limite : où ranger les compteurs (base par défaut ; memoire pour les tests).
    LIMITE_STOCKAGE: z.enum(["base", "memoire"]).default("base"),
```

### 6. La garde

`src/lib/limite.ts` assemble la limite (architecture.md §3) : les règles, le choix du limiteur selon `LIMITE_STOCKAGE`, et deux fonctions pour les actions. Un limiteur injoignable est journalisé sous forme d'`ErreurService("limite", …)` dont la `cause` garde seulement des codes techniques (le texte d'une erreur réseau peut citer une adresse) ; la requête passe.

```ts
// src/lib/limite.ts
// Limite de requêtes : règles, choix du limiteur (LIMITE_STOCKAGE) et garde des actions.
import "server-only";
import { env } from "@src/config/env";
import type { Limiteur, RegleLimite } from "@src/core/shared/limiteur.port";
import { getDb } from "@src/db/db-client";
import { limiteurBase } from "@src/db/limite/limite.repository";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { ipDepuis, messageLimite } from "@src/lib/helpers/limite/ip-et-message";
import { limiteurMemoire } from "@src/lib/helpers/limite/limiteur-memoire";
import { logger } from "@src/lib/logger";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

const MINUTE = 60_000;

// Une règle par usage : nombre de tentatives par adresse IP, sur une fenêtre de temps.
const REGLES = {
  connexion: { nombre: 5, fenetreMs: MINUTE },
  inscription: { nombre: 3, fenetreMs: 10 * MINUTE },
  motDePasseOublie: { nombre: 3, fenetreMs: 10 * MINUTE },
  formulairePublic: { nombre: 5, fenetreMs: MINUTE },
} as const satisfies Record<string, RegleLimite>;

export type NomLimite = keyof typeof REGLES;

export type Verdict =
  | { autorise: true }
  | { autorise: false; message: string; reset: number };

let limiteurDuProjet: Limiteur | undefined;

/** Le limiteur choisi par LIMITE_STOCKAGE, créé une fois puis gardé. */
function limiteurChoisi(): Limiteur {
  if (!limiteurDuProjet) {
    const { LIMITE_STOCKAGE } = env;
    if (LIMITE_STOCKAGE === "memoire") {
      if (process.env.VERCEL) {
        logger.warn(
          "LIMITE_STOCKAGE=memoire sur Vercel : chaque instance compte de son côté. Retirez la variable pour compter dans la base.",
        );
      }
      limiteurDuProjet = limiteurMemoire();
    } else {
      limiteurDuProjet = limiteurBase(getDb());
    }
  }
  return limiteurDuProjet;
}

/**
 * Codes techniques de l'erreur, sans son texte : le texte d'une erreur réseau peut citer l'adresse appelée.
 */
function causeTechnique(erreur: unknown) {
  const brute = (erreur ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : undefined);
  const origine = (brute.cause ?? {}) as Record<string, unknown>;
  return {
    nom: texte(brute.name),
    code: texte(brute.code) ?? texte(origine.code),
  };
}

export async function verifierLimite(
  nom: NomLimite,
  identifiant: string,
  limiteur: Limiteur = limiteurChoisi(),
): Promise<Verdict> {
  try {
    const maintenant = Date.now();
    const { accepte, reset } = await limiteur.verifier(
      `${nom}:${identifiant}`,
      REGLES[nom],
      maintenant,
    );
    if (accepte) {
      return { autorise: true };
    }
    return {
      autorise: false,
      message: messageLimite(reset, maintenant),
      reset,
    };
  } catch (erreur) {
    // Limiteur injoignable : le site reste utilisable, et l'incident est journalisé (sans l'adresse IP).
    logger.error(
      {
        err: new ErreurService("limite", "Limiteur indisponible", {
          cause: causeTechnique(erreur),
        }),
        limite: nom,
      },
      "Limiteur indisponible : requête laissée passer",
    );
    return { autorise: true };
  }
}

// Pour une action next-safe-action : arrête l'action avec un message clair si la limite est atteinte.
export async function exigerLimite(nom: NomLimite): Promise<void> {
  const verdict = await verifierLimite(nom, ipDepuis(await headers()));
  if (!verdict.autorise) {
    returnServerError(verdict.message);
  }
}
```

### 7. Protéger la connexion, l'inscription et le mot de passe oublié

Les formulaires du compte passent par des actions : la limite se place **dans l'action**, en première ligne (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Dans chaque action concernée de `src/features/compte/actions/`, ajouter l'import puis une ligne en tête :

```ts
import { exigerLimite } from "@src/lib/limite";
```

```ts
// src/features/compte/actions/inscrire.action.ts
export const inscrire = actionPublique
  .inputSchema(schemaInscription)
  .action(async ({ parsedInput }) => {
    await exigerLimite("inscription");
    // … suite inchangée
```

```ts
// src/features/compte/actions/connecter.action.ts
export const connecter = actionPublique
  .inputSchema(schemaConnexion)
  .action(async ({ parsedInput }) => {
    await exigerLimite("connexion");
    // … suite inchangée
```

Avec la recette `email` : `await exigerLimite("motDePasseOublie");` en tête de `demanderNouveauMotDePasse` (`demander-nouveau-mot-de-passe.action.ts`).

Le message de refus arrive dans `result.serverError` : les containers de la recette `connexion` le transmettent déjà aux formulaires, qui l'affichent.

### 8. Essayer

Se tromper 6 fois de mot de passe en moins d'une minute : la sixième fois, « Trop de tentatives. Réessayez dans 1 minute. » s'affiche. Les compteurs se lisent dans l'éditeur SQL de Neon : `select * from limites;`.

### 9. Mettre en ligne

Avec la base, il n'y a rien à saisir dans Vercel : la migration de l'étape 3 suffit. Redéployer, puis refaire l'essai sur le site en ligne.

### Option : Redis (Upstash), pour un site à fort trafic

La base suffit à la plupart des sites. Redis répond plus vite sous une forte charge et compte sur une fenêtre glissante.

1. Créer un compte Upstash (https://console.upstash.com). Offre gratuite : une base, 500 000 commandes par mois, 256 Mo de données, 10 Go de trafic par mois.
2. Dans la console Upstash : créer une base Redis **régionale**, région **eu-central-1 (Francfort)**, proche de Vercel `fra1` et de Neon, offre gratuite. Sur la page de la base, section **REST API**, copier l'adresse et le jeton dans `.env`.
3. Installer les paquets : `npm install @upstash/ratelimit @upstash/redis` (dernières versions ; recette vérifiée avec 2.2.0 et 1.39.0).
4. Dans `.env` :

   ```
   LIMITE_STOCKAGE=redis
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=VOTRE_CLE_ICI
   ```

   et dans `.env.example`, les trois noms.
5. Dans `src/config/env.ts`, dans `server: { … }` : `LIMITE_STOCKAGE` accepte `redis` et les deux variables Upstash s'ajoutent :

```ts
    // Recette limite : où ranger les compteurs (base par défaut ; redis ; memoire pour les tests).
    LIMITE_STOCKAGE: z.enum(["base", "redis", "memoire"]).default("base"),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
```

   puis, dans `createEnv({ … })`, une vérification qui les exige ensemble avec `redis`. S'il existe déjà un `createFinalSchema` (autre recette), ajouter seulement le `.superRefine(…)` à la suite du premier :

```ts
  // Recette limite, option Redis : les deux variables Upstash sont requises.
  createFinalSchema: (forme) =>
    z.object(forme).superRefine((valeurs, ctx) => {
      if (valeurs.LIMITE_STOCKAGE !== "redis") return;
      for (const nom of [
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ] as const) {
        if (!valeurs[nom]) {
          ctx.addIssue({
            code: "custom",
            path: [nom],
            message: "requise avec LIMITE_STOCKAGE=redis",
          });
        }
      }
    }),
```

   Avec `LIMITE_STOCKAGE=redis` sans les deux variables Upstash, le site s'arrête au chargement avec un message qui les nomme.
6. Créer l'adapter :

```ts
// src/adapters/limite/upstash.adapter.ts
import "server-only";
import type { Limiteur, RegleLimite } from "@src/core/shared/limiteur.port";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/** Limiteur rangé dans Redis (Upstash), sur une fenêtre glissante. Pour les sites à fort trafic. */
export function limiteurUpstash(acces: {
  url: string;
  token: string;
}): Limiteur {
  const redis = new Redis(acces);
  // Un limiteur Upstash par règle, gardé d'une requête à l'autre (son cache local reste actif).
  const parRegle = new Map<string, Ratelimit>();

  function pour({ nombre, fenetreMs }: RegleLimite): Ratelimit {
    const id = `${nombre}/${fenetreMs}`;
    let limiteur = parRegle.get(id);
    if (!limiteur) {
      limiteur = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(nombre, `${fenetreMs} ms`),
        prefix: "limite",
        // Upstash lent : la requête passe au bout de 2 secondes au lieu d'attendre.
        timeout: 2000,
      });
      parRegle.set(id, limiteur);
    }
    return limiteur;
  }

  return {
    async verifier(cle, regle) {
      const { success, reset } = await pour(regle).limit(cle);
      return { accepte: success, reset };
    },
  };
}
```

7. La garde complète : `src/lib/limite.ts` choisit aussi Upstash quand `LIMITE_STOCKAGE` vaut `redis`.

```ts
// src/lib/limite.ts
// Limite de requêtes : règles, choix du limiteur (LIMITE_STOCKAGE) et garde des actions.
import "server-only";
import { limiteurUpstash } from "@src/adapters/limite/upstash.adapter";
import { env } from "@src/config/env";
import type { Limiteur, RegleLimite } from "@src/core/shared/limiteur.port";
import { getDb } from "@src/db/db-client";
import { limiteurBase } from "@src/db/limite/limite.repository";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { ipDepuis, messageLimite } from "@src/lib/helpers/limite/ip-et-message";
import { limiteurMemoire } from "@src/lib/helpers/limite/limiteur-memoire";
import { logger } from "@src/lib/logger";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

const MINUTE = 60_000;

// Une règle par usage : nombre de tentatives par adresse IP, sur une fenêtre de temps.
const REGLES = {
  connexion: { nombre: 5, fenetreMs: MINUTE },
  inscription: { nombre: 3, fenetreMs: 10 * MINUTE },
  motDePasseOublie: { nombre: 3, fenetreMs: 10 * MINUTE },
  formulairePublic: { nombre: 5, fenetreMs: MINUTE },
} as const satisfies Record<string, RegleLimite>;

export type NomLimite = keyof typeof REGLES;

export type Verdict =
  | { autorise: true }
  | { autorise: false; message: string; reset: number };

let limiteurDuProjet: Limiteur | undefined;

/** Le limiteur choisi par LIMITE_STOCKAGE, créé une fois puis gardé. */
function limiteurChoisi(): Limiteur {
  if (!limiteurDuProjet) {
    const {
      LIMITE_STOCKAGE,
      UPSTASH_REDIS_REST_URL: url,
      UPSTASH_REDIS_REST_TOKEN: token,
    } = env;
    // env.ts exige les deux variables Upstash quand LIMITE_STOCKAGE vaut redis.
    if (LIMITE_STOCKAGE === "redis" && url && token) {
      limiteurDuProjet = limiteurUpstash({ url, token });
    } else if (LIMITE_STOCKAGE === "memoire") {
      if (process.env.VERCEL) {
        logger.warn(
          "LIMITE_STOCKAGE=memoire sur Vercel : chaque instance compte de son côté. Retirez la variable pour compter dans la base.",
        );
      }
      limiteurDuProjet = limiteurMemoire();
    } else {
      limiteurDuProjet = limiteurBase(getDb());
    }
  }
  return limiteurDuProjet;
}

/**
 * Codes techniques de l'erreur, sans son texte : le texte d'une erreur réseau peut citer l'adresse appelée.
 */
function causeTechnique(erreur: unknown) {
  const brute = (erreur ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : undefined);
  const origine = (brute.cause ?? {}) as Record<string, unknown>;
  return {
    nom: texte(brute.name),
    code: texte(brute.code) ?? texte(origine.code),
  };
}

export async function verifierLimite(
  nom: NomLimite,
  identifiant: string,
  limiteur: Limiteur = limiteurChoisi(),
): Promise<Verdict> {
  try {
    const maintenant = Date.now();
    const { accepte, reset } = await limiteur.verifier(
      `${nom}:${identifiant}`,
      REGLES[nom],
      maintenant,
    );
    if (accepte) {
      return { autorise: true };
    }
    return {
      autorise: false,
      message: messageLimite(reset, maintenant),
      reset,
    };
  } catch (erreur) {
    // Limiteur injoignable : le site reste utilisable, et l'incident est journalisé (sans l'adresse IP).
    logger.error(
      {
        err: new ErreurService("limite", "Limiteur indisponible", {
          cause: causeTechnique(erreur),
        }),
        limite: nom,
      },
      "Limiteur indisponible : requête laissée passer",
    );
    return { autorise: true };
  }
}

// Pour une action next-safe-action : arrête l'action avec un message clair si la limite est atteinte.
export async function exigerLimite(nom: NomLimite): Promise<void> {
  const verdict = await verifierLimite(nom, ipDepuis(await headers()));
  if (!verdict.autorise) {
    returnServerError(verdict.message);
  }
}
```

8. Le test de panne d'Upstash et le test des variables (section « Tests »), puis `npm test`.
9. Dans Vercel, saisir les trois variables pour Production et Preview, puis redéployer. Une même base peut servir en local et en ligne : les compteurs sont alors partagés.

#### Si Upstash est indisponible

La recette **laisse passer** la requête et écrit une erreur dans le journal. Deux cas, vérifiés dans le code de `@upstash/ratelimit` 2.2.0 :

- Upstash répond trop lentement : au bout de `timeout` (2 secondes), la bibliothèque répond elle-même `success: true` (raison `timeout`).
- Upstash est injoignable (erreur réseau) : `verifierLimite` attrape l'erreur, la journalise et autorise.

Le site reste ainsi utilisable pendant une panne. La base se comporte de la même façon. Pour un formulaire très exposé, refuser à la place est possible : remplacer le `return { autorise: true }` du `catch` de `verifierLimite` par un refus. C'est une décision de la personne.

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

Un même jeu de tests vérifie chaque limiteur (`verifierContratLimiteur`) : la mémoire en unitaire, la base sur PGlite avec les vraies migrations.

```ts
// tests/helpers/contrat-limiteur.ts
// Comportement attendu de tout limiteur. À appeler dans un describe, avec une fabrique de limiteur neuf.
import type { Limiteur } from "@src/core/shared/limiteur.port";
import { expect, it } from "vitest";

const REGLE = { nombre: 3, fenetreMs: 60_000 };
const T0 = Date.UTC(2026, 9, 8, 10, 0, 0);

export function verifierContratLimiteur(
  fabrique: () => Limiteur | Promise<Limiteur>,
) {
  it("accepte jusqu'au nombre de la règle, puis refuse", async () => {
    const limiteur = await fabrique();
    const acceptes: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await limiteur.verifier(
        "connexion:203.0.113.7",
        REGLE,
        T0 + i * 1000,
      );
      acceptes.push(r.accepte);
    }
    expect(acceptes).toEqual([true, true, true, false]);
  });

  it("annonce la fin de la fenêtre ouverte par la première tentative", async () => {
    const limiteur = await fabrique();
    await limiteur.verifier("connexion:a", REGLE, T0);
    const r = await limiteur.verifier("connexion:a", REGLE, T0 + 5_000);
    expect(r.reset).toBe(T0 + 60_000);
  });

  it("repart de zéro une fois la fenêtre écoulée", async () => {
    const limiteur = await fabrique();
    for (let i = 0; i < 4; i++) {
      await limiteur.verifier("connexion:b", REGLE, T0);
    }
    const r = await limiteur.verifier("connexion:b", REGLE, T0 + 60_000);
    expect(r).toEqual({ accepte: true, reset: T0 + 120_000 });
  });

  it("compte chaque clé séparément", async () => {
    const limiteur = await fabrique();
    for (let i = 0; i < 3; i++) {
      await limiteur.verifier("connexion:c", REGLE, T0);
    }
    const r = await limiteur.verifier("connexion:d", REGLE, T0);
    expect(r.accepte).toBe(true);
  });

  it("des envois simultanés ne dépassent jamais la limite", async () => {
    const limiteur = await fabrique();
    const resultats = await Promise.all(
      Array.from({ length: 10 }, () =>
        limiteur.verifier("connexion:simultane", REGLE, T0),
      ),
    );
    expect(resultats.filter((r) => r.accepte)).toHaveLength(3);
  });
}
```

```ts
// src/lib/helpers/limite/__tests__/limiteur-memoire.test.ts
import { describe } from "vitest";
import { verifierContratLimiteur } from "../../../../../tests/helpers/contrat-limiteur";
import { limiteurMemoire } from "../limiteur-memoire";

describe("Limiteur en mémoire", () => {
  verifierContratLimiteur(() => limiteurMemoire());
});
```

```ts
// src/db/limite/__tests__/limite.repository.test.ts
import type { Db } from "@src/db/db-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { verifierContratLimiteur } from "../../../../tests/helpers/contrat-limiteur";
import { limiteurBase } from "../limite.repository";
import { limites } from "../limite.table";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
});

afterEach(async () => {
  await fermer();
});

describe("Limiteur en base", () => {
  verifierContratLimiteur(() => limiteurBase(db, { nettoyer: () => false }));

  it("efface au passage les compteurs de plus d'un jour", async () => {
    const T0 = Date.UTC(2026, 9, 8, 10, 0, 0);
    await db.insert(limites).values([
      {
        cle: "connexion:ancienne",
        compte: 2,
        debut: new Date(T0 - 2 * 86_400_000),
      },
      { cle: "connexion:recente", compte: 1, debut: new Date(T0 - 60_000) },
    ]);

    await limiteurBase(db, { nettoyer: () => true }).verifier(
      "connexion:nouvelle",
      { nombre: 5, fenetreMs: 60_000 },
      T0,
    );

    const cles = (await db.select({ cle: limites.cle }).from(limites))
      .map((l) => l.cle)
      .sort();
    expect(cles).toEqual(["connexion:nouvelle", "connexion:recente"]);
  });
});
```

```ts
// src/lib/helpers/limite/__tests__/ip-et-message.test.ts
import { describe, expect, it } from "vitest";
import { ipDepuis, messageLimite } from "../ip-et-message";

describe("Limite de requêtes", () => {
  describe("Au-delà de la limite, la personne reçoit un message clair", () => {
    it("US-XXX-1 – Attente de 9 minutes et demie : le message annonce 10 minutes", () => {
      expect(messageLimite(1_000_000 + 570_000, 1_000_000)).toBe(
        "Trop de tentatives. Réessayez dans 10 minutes.",
      );
    });
  });

  describe("La limite s'applique par adresse IP du visiteur", () => {
    it("US-XXX-2 – L'adresse retenue est la première de x-forwarded-for", () => {
      const entetes = new Headers({
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      });

      expect(ipDepuis(entetes)).toBe("203.0.113.7");
    });
  });
});
```

La garde : verdict, choix du limiteur, panne d'un limiteur et contenu du journal.

```ts
// src/lib/__tests__/limite.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import { limiteurMemoire } from "@src/lib/helpers/limite/limiteur-memoire";
import { beforeEach, describe, expect, it, vi } from "vitest";

const journal = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@src/lib/logger", () => ({ logger: journal }));
vi.mock("@src/config/env", () => ({
  env: { LIMITE_STOCKAGE: "memoire" },
}));

const { verifierLimite } = await import("../limite");

describe("Limite de requêtes", () => {
  beforeEach(() => {
    journal.error.mockClear();
  });

  describe("Au-delà de la limite, la personne reçoit un message clair", () => {
    it("US-XXX-1 – Sixième tentative de connexion en une minute : refusée avec un message en français", async () => {
      const limiteur = limiteurMemoire();
      for (let i = 0; i < 5; i++) {
        await verifierLimite("connexion", "203.0.113.7", limiteur);
      }

      const verdict = await verifierLimite(
        "connexion",
        "203.0.113.7",
        limiteur,
      );

      expect(verdict).toMatchObject({
        autorise: false,
        message: "Trop de tentatives. Réessayez dans 1 minute.",
      });
    });

    it("US-XXX-1 – Sans limiteur fourni, LIMITE_STOCKAGE=memoire est utilisé", async () => {
      for (let i = 0; i < 5; i++) {
        await verifierLimite("formulairePublic", "198.51.100.1");
      }
      const verdict = await verifierLimite("formulairePublic", "198.51.100.1");
      expect(verdict.autorise).toBe(false);
    });
  });

  describe("Limiteur indisponible : le site reste utilisable", () => {
    it("US-XXX-3 – L'incident est journalisé sans l'adresse IP", async () => {
      const enPanne = {
        verifier: async () => {
          throw Object.assign(new Error("connexion à 203.0.113.7 impossible"), {
            name: "TypeError",
            code: "ECONNREFUSED",
          });
        },
      };

      await verifierLimite("connexion", "203.0.113.7", enPanne);

      const [contexte] = journal.error.mock.calls[0] as [
        { err: ErreurService; limite: string },
      ];
      expect(contexte.err).toBeInstanceOf(ErreurService);
      expect(contexte.err.cause).toEqual({
        nom: "TypeError",
        code: "ECONNREFUSED",
      });
      expect(JSON.stringify(contexte.err.cause)).not.toContain("203.0.113.7");
      expect(contexte.limite).toBe("connexion");
    });
  });
});
```

Les variables :

```ts
// src/config/__tests__/env-limite.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { chargerEnvValide } from "../../../tests/helpers/env-de-test";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Variables de la limite", () => {
  it("la base est la stratégie par défaut", async () => {
    expect((await chargerEnvValide()).LIMITE_STOCKAGE).toBe("base");
  });
});
```

`chargerEnvValide()` (aide du squelette, `tests/helpers/env-de-test.ts`) part des valeurs de `VARIABLES_VALIDES` : chaque recette qui ajoute une variable obligatoire y ajoute une valeur de test.

Option Redis : la panne d'Upstash (l'adresse `http://127.0.0.1:9` ne répond jamais) et un test de plus pour les variables.

```ts
// src/adapters/limite/__tests__/upstash.adapter.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@src/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@src/config/env", () => ({
  env: { LIMITE_STOCKAGE: "memoire" },
}));

const { verifierLimite } = await import("@src/lib/limite");
const { limiteurUpstash } = await import("../upstash.adapter");

describe("Limite de requêtes, option Redis", () => {
  it("US-XXX-3 – Upstash injoignable : la tentative est laissée passer", async () => {
    // Adresse volontairement injoignable : simule une panne d'Upstash.
    const enPanne = limiteurUpstash({
      url: "http://127.0.0.1:9",
      token: "jeton-de-test",
    });

    const verdict = await verifierLimite(
      "formulairePublic",
      "203.0.113.7",
      enPanne,
    );

    expect(verdict).toEqual({ autorise: true });
  }, 10_000);
});
```

```ts
// à ajouter dans src/config/__tests__/env-limite.test.ts
  it("redis sans les variables Upstash : le message nomme les variables manquantes", async () => {
    await expect(
      chargerEnvValide({ LIMITE_STOCKAGE: "redis" }),
    ).rejects.toThrow(
      /UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN/,
    );
  });
```

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
