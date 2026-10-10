### 6. La garde

`src/lib/limite.ts` assemble la limite (architecture.md §3) : les règles, le choix du limiteur selon `LIMITE_STOCKAGE`, et deux fonctions pour les actions. Un limiteur injoignable est journalisé sous forme d'`ErreurService("limite", …)` dont la `cause` garde seulement des codes techniques (le texte d'une erreur réseau peut citer une adresse) ; la requête passe.

<!-- fichier: src/lib/limite.ts -->
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

