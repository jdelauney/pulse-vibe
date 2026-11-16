### 6. La garde

`src/lib/limite.ts` assemble la limite (architecture.md §3) : les règles, le choix du limiteur selon `LIMITE_STOCKAGE` (c'est là que `new LimiteurMemoire()`, `new DrizzleLimiteurRepository(getDb())` ou `new UpstashLimiteurAdapter(…)` est créé), et deux fonctions pour les actions. Les actions restent des fonctions : elles ne voient que l'interface `Limiteur`. Chaque refus est journalisé avec la règle et une empreinte courte de l'identifiant (jamais l'adresse IP en clair). Un limiteur injoignable est journalisé sous forme d'`ErreurService("limite", …)` dont la `cause` garde seulement des codes techniques (le texte d'une erreur réseau peut citer une adresse) ; la requête passe.

<!-- fichier: src/lib/limite.ts -->
```ts
// src/lib/limite.ts
// Limite de requêtes : règles, choix du limiteur (LIMITE_STOCKAGE) et garde des actions.
import "server-only";
import { env } from "@src/config/env";
import type { Limiteur, RegleLimite } from "@src/core/shared/limiteur.port";
import { getDb } from "@src/db/db-client";
import { DrizzleLimiteurRepository } from "@src/db/limite/limite.repository";
import { ErreurService } from "@src/lib/errors/erreur-service";
import {
  empreinteCourte,
  ipDepuis,
  messageLimite,
} from "@src/lib/helpers/limite/ip-et-message";
import { LimiteurMemoire } from "@src/lib/helpers/limite/limiteur-memoire";
import { logger } from "@src/lib/logger";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";

const MINUTE = 60_000;

// Une règle par usage : nombre de tentatives sur une fenêtre de temps, par adresse IP
// ou, pour une personne connectée, par compte (exigerLimite(nom, ctx.utilisateur.id)).
const REGLES = {
  connexion: { nombre: 5, fenetreMs: MINUTE },
  inscription: { nombre: 3, fenetreMs: 10 * MINUTE },
  motDePasseOublie: { nombre: 3, fenetreMs: 10 * MINUTE },
  formulairePublic: { nombre: 5, fenetreMs: MINUTE },
  // Par compte.
  changementMotDePasse: { nombre: 5, fenetreMs: MINUTE },
  // Recette email : le lien reçu (par IP), puis par compte.
  nouveauMotDePasse: { nombre: 5, fenetreMs: MINUTE },
  changementAdresse: { nombre: 3, fenetreMs: 10 * MINUTE },
  suppressionCompte: { nombre: 3, fenetreMs: 10 * MINUTE },
  // Recette double-authentification : le code (par IP), son renvoi (par IP), l'activation (par compte).
  codeDeConnexion: { nombre: 5, fenetreMs: MINUTE },
  renvoiDuCode: { nombre: 3, fenetreMs: 10 * MINUTE },
  reglageDoubleAuthentification: { nombre: 5, fenetreMs: MINUTE },
} as const satisfies Record<string, RegleLimite>;

export type NomLimite = keyof typeof REGLES;

export type Verdict =
  | { autorise: true }
  | { autorise: false; message: string; reset: number };

let limiteurDuProjet: Limiteur | undefined;

/** Le limiteur choisi par LIMITE_STOCKAGE (patron Strategy), créé une fois puis gardé : c'est ici que les objets s'assemblent. */
function limiteurChoisi(): Limiteur {
  if (!limiteurDuProjet) {
    const { LIMITE_STOCKAGE } = env;
    if (LIMITE_STOCKAGE === "memoire") {
      if (process.env.VERCEL) {
        logger.warn(
          "LIMITE_STOCKAGE=memoire sur Vercel : chaque instance compte de son côté. Retirez la variable pour compter dans la base.",
        );
      }
      limiteurDuProjet = new LimiteurMemoire();
    } else {
      limiteurDuProjet = new DrizzleLimiteurRepository(getDb());
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
    // Refus journalisé avec la règle et une empreinte de l'identifiant, jamais l'adresse IP en clair.
    logger.warn(
      { limite: nom, cle: empreinteCourte(identifiant) },
      "Limite atteinte : tentative refusée",
    );
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
// Sans identifiant, la limite compte par adresse IP ; une action connectée passe ctx.utilisateur.id.
export async function exigerLimite(
  nom: NomLimite,
  identifiant?: string,
): Promise<void> {
  const verdict = await verifierLimite(
    nom,
    identifiant ?? ipDepuis(await headers()),
  );
  if (!verdict.autorise) {
    returnServerError(verdict.message);
  }
}
```

