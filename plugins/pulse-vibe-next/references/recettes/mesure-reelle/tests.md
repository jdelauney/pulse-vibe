
Unitaires (règles, use-case avec un repository en mémoire, schéma, réception avec l'accès à la base remplacé) et intégration (PGlite, vraies migrations). Chaque test vit dans le `__tests__/` de son dossier.

<!-- fichier: src/core/vitesse/__tests__/mesure.rules.test.ts -->
```ts
// src/core/vitesse/__tests__/mesure.rules.test.ts
import { describe, expect, it } from "vitest";
import { ReglesMesure } from "../mesure.rules";

describe("Mesure réelle de la vitesse : règles", () => {
  const regles = new ReglesMesure();

  describe("Les mesures se regroupent par gabarit, sans identifiant", () => {
    it("US-XXX-1 – Adresse d'une facture : l'identifiant devient [id]", () => {
      expect(
        regles.normaliserChemin(
          "/factures/3f2b8c1e-9d4a-4c7b-a1e2-0b9c8d7e6f50?tri=date#haut",
        ),
      ).toBe("/factures/[id]");
      expect(regles.normaliserChemin("/commandes/1234/recu")).toBe(
        "/commandes/[id]/recu",
      );
    });

    it("US-XXX-1 – Page ordinaire : le chemin reste lisible", () => {
      expect(regles.normaliserChemin("/")).toBe("/");
      expect(regles.normaliserChemin("/tarifs/offre-pro")).toBe(
        "/tarifs/offre-pro",
      );
    });
  });

  describe("Les anciennes mesures s'effacent", () => {
    it("US-XXX-3 – La limite de conservation est à 90 jours", () => {
      const maintenant = new Date("2026-10-08T12:00:00.000Z");

      expect(regles.limiteDeConservation(maintenant).toISOString()).toBe(
        "2026-07-10T12:00:00.000Z",
      );
    });

    it("US-XXX-3 – L'effacement a lieu au plus une fois par heure", () => {
      const premiere = new Date("2026-10-08T12:00:00.000Z");

      expect(regles.purgeNecessaire(null, premiere)).toBe(true);
      expect(
        regles.purgeNecessaire(
          premiere,
          new Date("2026-10-08T12:59:59.999Z"),
        ),
      ).toBe(false);
      expect(
        regles.purgeNecessaire(
          premiere,
          new Date("2026-10-08T13:00:00.000Z"),
        ),
      ).toBe(true);
    });
  });
});
```

<!-- fichier: src/core/vitesse/__tests__/enregistrer-mesure.use-case.test.ts -->
```ts
// src/core/vitesse/__tests__/enregistrer-mesure.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { MesureVitesse, MesureVitesseVue } from "../mesure.entity";
import type { MesureVitesseRepository } from "../mesure-repository.port";
import { EnregistrerMesure } from "../use-cases/enregistrer-mesure.use-case";

/** Le repository en mémoire : garde les mesures enregistrées et les limites d'effacement demandées. */
class MesureVitesseRepositoryEnMemoire implements MesureVitesseRepository {
  readonly enregistrees: MesureVitesseVue[] = [];
  readonly limites: Date[] = [];

  async enregistrer(mesure: MesureVitesse) {
    this.enregistrees.push(mesure.versVue());
  }

  async effacerAvant(limite: Date) {
    this.limites.push(limite);
  }
}

describe("Use-case : enregistrer une mesure", () => {
  it("US-XXX-2 – Mesure valide : enregistrée sans identifiant, anciennes mesures effacées", async () => {
    const mesures = new MesureVitesseRepositoryEnMemoire();
    const maintenant = new Date("2026-10-08T12:00:00.000Z");

    await new EnregistrerMesure(mesures).executer({
      mesure: {
        page: "/factures/1234",
        mesure: "INP",
        valeur: 180,
        note: "good",
      },
      maintenant,
      dernierePurge: null,
    });

    expect(mesures.enregistrees).toEqual([
      { page: "/factures/[id]", mesure: "INP", valeur: 180, note: "good" },
    ]);
    expect(mesures.limites.map((l) => l.toISOString())).toEqual([
      "2026-07-10T12:00:00.000Z",
    ]);
  });

  it("US-XXX-3 – Effacement fait il y a moins d'une heure : mesure enregistrée, sans nouvel effacement", async () => {
    const mesures = new MesureVitesseRepositoryEnMemoire();

    const resultat = await new EnregistrerMesure(mesures).executer({
      mesure: { page: "/", mesure: "LCP", valeur: 900, note: "good" },
      maintenant: new Date("2026-10-08T12:30:00.000Z"),
      dernierePurge: new Date("2026-10-08T12:00:00.000Z"),
    });

    expect(resultat).toEqual({ purge: false });
    expect(mesures.enregistrees).toHaveLength(1);
    expect(mesures.limites).toEqual([]);
  });
});
```

<!-- fichier: src/features/vitesse/schemas/__tests__/mesure.schema.test.ts -->
```ts
// src/features/vitesse/schemas/__tests__/mesure.schema.test.ts
import { describe, expect, it } from "vitest";
import { mesureVitesseSchema } from "../mesure.schema";

describe("Mesure réelle de la vitesse : schéma", () => {
  describe("Seules des mesures valides sont acceptées", () => {
    it("US-XXX-2 – Mesure LCP valide : acceptée", () => {
      const lu = mesureVitesseSchema.safeParse({
        page: "/",
        mesure: "LCP",
        valeur: 2100.5,
        note: "good",
        navigation: "navigate",
      });

      expect(lu.success).toBe(true);
    });

    it("US-XXX-2 – Mesure inconnue ou valeur absurde : refusée", () => {
      for (const corps of [
        { page: "/", mesure: "FID", valeur: 10, note: "good" },
        { page: "/", mesure: "LCP", valeur: -1, note: "good" },
        { page: "/", mesure: "LCP", valeur: 9e9, note: "good" },
      ]) {
        expect(mesureVitesseSchema.safeParse(corps).success).toBe(false);
      }
    });
  });
});
```

<!-- fichier: src/features/vitesse/webhooks/__tests__/recevoir-mesure.webhook.test.ts -->
```ts
// src/features/vitesse/webhooks/__tests__/recevoir-mesure.webhook.test.ts
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const enregistrees: unknown[] = [];
let effacements = 0;
let panne = false;

vi.mock("@src/db/db-client", () => ({ getDb: () => ({}) }));
vi.mock("@src/db/vitesse/mesure-vitesse.repository", () => ({
  DrizzleMesureVitesseRepository: class {
    async enregistrer(mesure: { versVue(): unknown }) {
      if (panne) throw new Error("Base indisponible");
      enregistrees.push(mesure.versVue());
    }

    async effacerAvant() {
      effacements += 1;
    }
  },
}));

// Chaque test repart d'un module neuf : la date du dernier effacement est gardée dans le module.
async function chargerWebhook() {
  vi.resetModules();
  return (await import("../recevoir-mesure.webhook")).recevoirMesure;
}

function requete(corps: string, origine = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/vitesse", {
    method: "POST",
    body: corps,
    headers: { origin: origine, "content-type": "text/plain;charset=UTF-8" },
  });
}

const mesureValide = {
  page: "/factures/1234",
  mesure: "INP",
  valeur: 180,
  note: "good",
};

beforeEach(() => {
  enregistrees.length = 0;
  effacements = 0;
  panne = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Réception des mesures", () => {
  it("US-XXX-2 – Mesure valide envoyée par le site : enregistrée sans identifiant", async () => {
    const recevoirMesure = await chargerWebhook();

    const reponse = await recevoirMesure(requete(JSON.stringify(mesureValide)));

    expect(reponse.status).toBe(204);
    expect(enregistrees).toEqual([
      { page: "/factures/[id]", mesure: "INP", valeur: 180, note: "good" },
    ]);
  });

  it("US-XXX-2 – Envoi depuis un autre site ou corps illisible : refusé", async () => {
    const recevoirMesure = await chargerWebhook();
    const corps = JSON.stringify(mesureValide);

    expect(
      (await recevoirMesure(requete(corps, "https://autre.example"))).status,
    ).toBe(403);
    expect((await recevoirMesure(requete("pas du json"))).status).toBe(400);
    expect((await recevoirMesure(requete("x".repeat(3000)))).status).toBe(413);
    expect(enregistrees).toEqual([]);
  });

  it("US-XXX-2 – Base indisponible : réponse générique, sans détail", async () => {
    const recevoirMesure = await chargerWebhook();
    panne = true;

    const reponse = await recevoirMesure(requete(JSON.stringify(mesureValide)));

    expect(reponse.status).toBe(500);
    expect(await reponse.text()).not.toContain("Base indisponible");
  });

  it("US-XXX-3 – Les anciennes mesures s'effacent au plus une fois par heure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T12:00:00.000Z"));
    const recevoirMesure = await chargerWebhook();
    const corps = JSON.stringify(mesureValide);

    await recevoirMesure(requete(corps));
    await recevoirMesure(requete(corps));
    vi.setSystemTime(new Date("2026-10-08T12:59:00.000Z"));
    await recevoirMesure(requete(corps));

    expect(enregistrees).toHaveLength(3);
    expect(effacements).toBe(1);

    vi.setSystemTime(new Date("2026-10-08T13:00:00.000Z"));
    await recevoirMesure(requete(corps));

    expect(effacements).toBe(2);
  });
});
```

<!-- fichier: src/db/vitesse/__tests__/mesure-vitesse.repository.test.ts -->
```ts
// src/db/vitesse/__tests__/mesure-vitesse.repository.test.ts
import { MesureVitesse } from "@src/core/vitesse/mesure.entity";
import { ReglesMesure } from "@src/core/vitesse/mesure.rules";
import type { Db } from "@src/db/db-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { DrizzleMesureVitesseRepository } from "../mesure-vitesse.repository";
import { mesuresVitesse } from "../mesure-vitesse.table";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
});

afterEach(async () => {
  await fermer();
});

const JOUR = 86_400_000;

describe("Mesure réelle : enregistrement et lecture", () => {
  it("US-XXX-3 – Quatre LCP sur l'accueil : le 75e centile est calculé par page", async () => {
    const mesures = new DrizzleMesureVitesseRepository(db);
    for (const valeur of [1000, 2000, 3000, 4000]) {
      await mesures.enregistrer(
        new MesureVitesse({ page: "/", mesure: "LCP", valeur, note: "good" }),
      );
    }
    await mesures.enregistrer(
      new MesureVitesse({
        page: "/tarifs",
        mesure: "CLS",
        valeur: 0.02,
        note: "good",
      }),
    );

    const lignes = await mesures.p75ParPage(new Date(Date.now() - 28 * JOUR));

    expect(lignes).toEqual([
      { page: "/", mesure: "LCP", p75: 3250, nombre: 4 },
      { page: "/tarifs", mesure: "CLS", p75: 0.02, nombre: 1 },
    ]);
  });

  it("US-XXX-3 – Mesure de plus de 90 jours : effacée", async () => {
    const maintenant = new Date();
    await db.insert(mesuresVitesse).values([
      {
        page: "/",
        mesure: "LCP",
        valeur: 1,
        note: "good",
        creeLe: new Date(maintenant.getTime() - 91 * JOUR),
      },
      {
        page: "/",
        mesure: "LCP",
        valeur: 2,
        note: "good",
        creeLe: new Date(maintenant.getTime() - 89 * JOUR),
      },
    ]);

    await new DrizzleMesureVitesseRepository(db).effacerAvant(
      new ReglesMesure().limiteDeConservation(maintenant),
    );

    const restantes = await db.select().from(mesuresVitesse);
    expect(restantes.map((m) => m.valeur)).toEqual([2]);
  });
});
```

