### Option : Redis (Upstash), pour un site à fort trafic

La base suffit à la plupart des sites. Redis répond plus vite sous une forte charge et compte sur une fenêtre glissante.

1. Créer un compte Upstash (https://console.upstash.com). Offre gratuite : une base, 500 000 commandes par mois, 256 Mo de données, 10 Go de trafic par mois.
2. Dans la console Upstash : créer une base Redis **régionale**, région **eu-central-1 (Francfort)**, proche de Vercel `fra1` et de Neon, offre gratuite. Sur la page de la base, section **REST API**, copier l'adresse et le jeton dans `.env`.
3. Installer les paquets : `npm install @upstash/ratelimit @upstash/redis` (dernières versions ; recette vérifiée avec 2.2.0 et 1.39.0).

<!-- commande: npm install @upstash/ratelimit @upstash/redis -->

4. Dans `.env` :

   ```
   LIMITE_STOCKAGE=redis
   UPSTASH_REDIS_REST_URL=
   UPSTASH_REDIS_REST_TOKEN=VOTRE_CLE_ICI
   ```

   et dans `.env.example`, les trois noms.

<!-- ajout: .env.example -->
```
LIMITE_STOCKAGE=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

5. Dans `src/config/env.ts`, dans `server: { … }` : `LIMITE_STOCKAGE` accepte `redis` et les deux variables Upstash s'ajoutent :

<!-- remplacer-ligne: src/config/env.ts début: LIMITE_STOCKAGE: -->
```ts
    LIMITE_STOCKAGE: z.enum(["base", "redis", "memoire"]).default("base"),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
```

   puis une vérification qui les exige ensemble avec `redis`, ajoutée à la liste `verificationsCroisees` du squelette, juste après sa déclaration (d'autres recettes y ajoutent la leur) :

<!-- ajout: src/config/env.ts après: const verificationsCroisees: VerificationCroisee[] = []; -->
```ts
// Recette limite, option Redis : les deux variables Upstash sont requises avec LIMITE_STOCKAGE=redis.
verificationsCroisees.push((valeurs, ctx) => {
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
});
```

   Avec `LIMITE_STOCKAGE=redis` sans les deux variables Upstash, le site s'arrête au chargement avec un message qui les nomme.
6. Créer l'adapter :

<!-- fichier: src/adapters/limite/upstash.adapter.ts -->
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

<!-- fichier: src/lib/limite.ts -->
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

