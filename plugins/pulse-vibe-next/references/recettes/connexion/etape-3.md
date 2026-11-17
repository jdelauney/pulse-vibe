### 3. better-auth côté serveur

**Les mots de passe compromis.** Un mot de passe déjà paru dans une fuite de données est refusé à l'inscription, au changement et au choix d'un nouveau mot de passe. Le service Have I Been Pwned le sait sans recevoir le mot de passe : l'adapter envoie seulement les 5 premiers caractères de son empreinte SHA-1 (k-anonymat), puis compare le reste lui-même. Le port décrit ce que le compte attend ; un test passe une doublure, sans appel réseau.

<!-- fichier: src/core/compte/mot-de-passe-compromis.port.ts -->
```ts
// src/core/compte/mot-de-passe-compromis.port.ts
/** Dit si un mot de passe a déjà paru dans une fuite de données. L'adapter `hibp` l'implémente ; un test passe une doublure. */
export interface DetecteurMotsDePasseCompromis {
  /** Lève une erreur si le service ne répond pas. */
  estCompromis(motDePasse: string): Promise<boolean>;
}
```

<!-- fichier: src/adapters/hibp/hibp.adapter.ts -->
```ts
// src/adapters/hibp/hibp.adapter.ts
import "server-only";
import { createHash } from "node:crypto";
import type { DetecteurMotsDePasseCompromis } from "@src/core/compte/mot-de-passe-compromis.port";
import { ErreurService } from "@src/lib/errors/erreur-service";

const ADRESSE = "https://api.pwnedpasswords.com/range/";

/**
 * Have I Been Pwned (k-anonymat) : seuls les 5 premiers caractères de l'empreinte SHA-1 partent,
 * la suite se compare ici. Lève ErreurService("hibp", …) si le service ne répond pas à temps.
 */
export class HibpMotDePasseAdapter implements DetecteurMotsDePasseCompromis {
  constructor(
    private readonly recuperer: typeof fetch = fetch,
    private readonly delaiMs = 3_000,
  ) {}

  async estCompromis(motDePasse: string): Promise<boolean> {
    const empreinte = createHash("sha1")
      .update(motDePasse)
      .digest("hex")
      .toUpperCase();
    const suite = empreinte.slice(5);
    let texte: string;
    try {
      const reponse = await this.recuperer(
        `${ADRESSE}${empreinte.slice(0, 5)}`,
        {
          // Add-Padding : la réponse a toujours à peu près la même taille, quel que soit le préfixe.
          headers: { "Add-Padding": "true" },
          signal: AbortSignal.timeout(this.delaiMs),
        },
      );
      if (!reponse.ok) {
        throw new Error(`statut ${reponse.status}`);
      }
      texte = await reponse.text();
    } catch (erreur) {
      throw new ErreurService("hibp", "Have I Been Pwned ne répond pas", {
        cause: { nom: erreur instanceof Error ? erreur.name : undefined },
      });
    }
    // Une ligne par empreinte : « SUITE:nombre ». Les lignes de remplissage ont le nombre 0.
    return texte.split("\n").some((ligne) => {
      const [debut, nombre] = ligne.trim().split(":");
      return debut === suite && Number(nombre) > 0;
    });
  }
}
```

La règle se branche sur better-auth (son crochet `hooks.before`, qui s'applique aussi aux appels `auth.api` des actions). Si le service ne répond pas, le mot de passe est accepté et l'incident journalisé : une panne de Have I Been Pwned ne bloque jamais une inscription.

<!-- fichier: src/adapters/auth/mot-de-passe-compromis.ts -->
```ts
// src/adapters/auth/mot-de-passe-compromis.ts
import "server-only";
import type { DetecteurMotsDePasseCompromis } from "@src/core/compte/mot-de-passe-compromis.port";
import { logger } from "@src/lib/logger";
import { APIError } from "better-auth/api";

/** Code de l'erreur levée pour un mot de passe compromis, traduit en message par les actions. */
export const MOT_DE_PASSE_COMPROMIS = "PASSWORD_COMPROMISED";

// Chemin de better-auth → champ qui porte le nouveau mot de passe.
const CHAMP_DU_NOUVEAU_MOT_DE_PASSE: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};

/** Refuse un nouveau mot de passe déjà paru dans une fuite ; service muet : accepté, et journalisé. */
export async function refuserMotDePasseCompromis(
  requete: { path?: string; body?: unknown },
  detecteur: DetecteurMotsDePasseCompromis,
): Promise<void> {
  const champ = CHAMP_DU_NOUVEAU_MOT_DE_PASSE[requete.path ?? ""];
  const corps = (requete.body ?? {}) as Record<string, unknown>;
  const motDePasse = champ ? corps[champ] : undefined;
  if (typeof motDePasse !== "string") {
    return;
  }
  let compromis: boolean;
  try {
    compromis = await detecteur.estCompromis(motDePasse);
  } catch (erreur) {
    logger.warn(
      { err: erreur, chemin: requete.path },
      "Mots de passe compromis non vérifiés : service injoignable, mot de passe accepté",
    );
    return;
  }
  if (compromis) {
    throw new APIError("BAD_REQUEST", {
      code: MOT_DE_PASSE_COMPROMIS,
      message: "Mot de passe compromis",
    });
  }
}
```

**better-auth.** Il enregistre ses comptes et ses sessions dans la base du projet : son adapter est le seul à importer `src/db/`. Cette exception est déclarée dans `biome.json` (override `src/adapters/auth/**`, architecture.md §3) ; les autres adapters laissent la base aux repositories. L'objet `schema` de l'adaptateur Drizzle se construit ici, à partir des quatre tables.

<!-- fichier: src/adapters/auth/auth.adapter.ts -->
```ts
// src/adapters/auth/auth.adapter.ts
import "server-only";
import { HibpMotDePasseAdapter } from "@src/adapters/hibp/hibp.adapter";
import { env } from "@src/config/env";
import type { DetecteurMotsDePasseCompromis } from "@src/core/compte/mot-de-passe-compromis.port";
import {
  account,
  session,
  user,
  verification,
} from "@src/db/compte/auth.table";
import { type Db, getDb } from "@src/db/db-client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { cookies, headers } from "next/headers";
import { refuserMotDePasseCompromis } from "./mot-de-passe-compromis";

type OptionsAuth = {
  secret: string;
  baseURL: string;
  /** Application : `HibpMotDePasseAdapter`. Tests : une doublure, sans appel réseau. */
  motsDePasse: DetecteurMotsDePasseCompromis;
};

/**
 * Chemins HTTP de better-auth fermés (réponse 404) : toutes ses écritures. Le site écrit seulement par
 * les actions validées de src/features/compte/actions/, qui appellent getAuth().api.
 * Restent ouverts : /get-session (lecture de la session par auth-client.ts), /ok et /error.
 */
const CHEMINS_FERMES = [
  "/account-info",
  "/change-email",
  "/change-password",
  "/delete-user",
  "/delete-user/callback",
  "/get-access-token",
  "/link-social",
  "/list-accounts",
  "/list-sessions",
  "/refresh-token",
  "/request-password-reset",
  "/reset-password",
  "/revoke-other-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/send-verification-email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/sign-up/email",
  "/unlink-account",
  "/update-session",
  "/update-user",
  "/verify-email",
  "/verify-password",
];

/** Crée better-auth sur une base donnée : Neon dans l'application, PGlite dans les tests. */
export function creerAuth(db: Db, options: OptionsAuth) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      // Sans e-mail : pas de vérification d'adresse, pas de « mot de passe oublié »
      // (pas de sendVerificationEmail ni de sendResetPassword). La recette `email` les ajoute.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    hooks: {
      // Inscription, changement, nouveau mot de passe : un mot de passe déjà paru dans une fuite est refusé.
      before: createAuthMiddleware(async (ctx) => {
        await refuserMotDePasseCompromis(ctx, options.motsDePasse);
      }),
    },
    disabledPaths: CHEMINS_FERMES,
    // En dernier : écrit les cookies de session quand une Server Action appelle getAuth().api.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof creerAuth>;
export type Session = Auth["$Infer"]["Session"];

let instance: Auth | undefined;

/** L'instance de l'application, créée une seule fois, à la première demande. */
export function getAuth(): Auth {
  if (!instance) {
    instance = creerAuth(getDb(), {
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      motsDePasse: new HibpMotDePasseAdapter(),
    });
  }
  return instance;
}

/**
 * En-têtes de la requête, avec les cookies à jour.
 * Après une action qui change la session, Next.js réaffiche la page dans la même réponse :
 * headers() garde l'ancien cookie, cookies() donne le nouveau.
 * La requête est lue avant getAuth() : la page est rendue à la demande, jamais pré-rendue avec une session.
 */
export async function enTetesDeSession(): Promise<Headers> {
  const enTetes = new Headers(await headers());
  enTetes.set("cookie", (await cookies()).toString());
  return enTetes;
}
```

`disabledPaths` compare le chemin exact : chaque écriture de better-auth y est nommée (liste lue dans `auth.api` de better-auth 1.7.25). Les chemins à paramètre (`/callback/:id`, sans fournisseur configuré) ne s'y ferment pas. Le test « seuls les chemins de lecture restent ouverts » échoue si une nouvelle version de better-auth ajoute un chemin : le fermer, ou l'ajouter aux chemins ouverts si une recette s'en sert.

Pour lire la session ailleurs (Route Handler, par exemple) : `await getAuth().api.getSession({ headers: request.headers })`.
