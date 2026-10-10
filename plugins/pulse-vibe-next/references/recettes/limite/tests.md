
Un même jeu de tests vérifie chaque limiteur (`verifierContratLimiteur`) : la mémoire en unitaire, la base sur PGlite avec les vraies migrations.

<!-- fichier: tests/helpers/contrat-limiteur.ts -->
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

<!-- fichier: src/lib/helpers/limite/__tests__/limiteur-memoire.test.ts -->
```ts
// src/lib/helpers/limite/__tests__/limiteur-memoire.test.ts
import { describe } from "vitest";
import { verifierContratLimiteur } from "../../../../../tests/helpers/contrat-limiteur";
import { limiteurMemoire } from "../limiteur-memoire";

describe("Limiteur en mémoire", () => {
  verifierContratLimiteur(() => limiteurMemoire());
});
```

<!-- fichier: src/db/limite/__tests__/limite.repository.test.ts -->
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

<!-- fichier: src/lib/helpers/limite/__tests__/ip-et-message.test.ts -->
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

<!-- fichier: src/lib/__tests__/limite.test.ts -->
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

<!-- fichier: src/config/__tests__/env-limite.test.ts -->
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

<!-- fichier: src/adapters/limite/__tests__/upstash.adapter.test.ts -->
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

À ajouter dans `src/config/__tests__/env-limite.test.ts`, en tête du `describe` :

<!-- ajout: src/config/__tests__/env-limite.test.ts après: describe("Variables de la limite", () => { -->
```ts
  it("redis sans les variables Upstash : le message nomme les variables manquantes", async () => {
    await expect(
      chargerEnvValide({ LIMITE_STOCKAGE: "redis" }),
    ).rejects.toThrow(/UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN/);
  });

```

