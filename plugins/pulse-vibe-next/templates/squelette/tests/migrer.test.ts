import { describe, expect, it, vi } from "vitest";
import {
  appelNeon,
  creerSauvegarde,
  migrationsEnAttente,
  migrer,
  sauvegardePour,
} from "../scripts/migrer.mjs";

const JOURNAL = [
  { tag: "0000_debut", when: 1000 },
  { tag: "0001_factures", when: 2000 },
];
const PRODUCTION = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  DATABASE_URL_UNPOOLED: "postgresql://production",
  NEON_API_KEY: "cle-de-test",
  NEON_PROJECT_ID: "projet-de-test",
};

function dependances(env: Record<string, string>, derniere: string | null) {
  return {
    env,
    journal: JOURNAL,
    maintenant: new Date("2026-10-08T14:05:30.123Z"),
    lireDerniere: vi.fn(async () => derniere),
    sauvegarder: vi.fn(async () => {}),
    appliquerMigrations: vi.fn(),
    dire: vi.fn(),
  };
}

describe("Migrations avant construction", () => {
  it("en attente : celles plus récentes que la dernière appliquée", () => {
    expect(migrationsEnAttente(JOURNAL, null)).toEqual(JOURNAL);
    expect(migrationsEnAttente(JOURNAL, "1000")).toEqual([JOURNAL[1]]);
    expect(migrationsEnAttente(JOURNAL, "2000")).toEqual([]);
  });

  it("sauvegarde : nom horodaté, expiration à 7 jours au format RFC 3339", () => {
    expect(sauvegardePour(new Date("2026-10-08T14:05:30.123Z"))).toEqual({
      nom: "sauvegarde-20261008-1405",
      expiration: "2026-10-15T14:05:30Z",
    });
  });

  it("hors Vercel : rien n'est lancé", async () => {
    const d = dependances({}, null);
    expect(await migrer(d)).toBe("hors-vercel");
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("sans migration dans drizzle/ : aucune connexion à la base", async () => {
    const d = { ...dependances(PRODUCTION, null), journal: [] };
    expect(await migrer(d)).toBe("rien");
    expect(d.lireDerniere).not.toHaveBeenCalled();
  });

  it("prévisualisation : applique sur la branche de la prévisualisation, sans sauvegarde", async () => {
    const d = dependances(
      {
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL_UNPOOLED: "postgresql://apercu",
      },
      "1000",
    );
    expect(await migrer(d)).toBe("applique");
    expect(d.sauvegarder).not.toHaveBeenCalled();
    expect(d.appliquerMigrations).toHaveBeenCalledWith("postgresql://apercu");
  });

  it("production avec migration en attente : sauvegarde d'abord, puis migration", async () => {
    const d = dependances(PRODUCTION, "1000");
    expect(await migrer(d)).toBe("applique");
    expect(d.sauvegarder).toHaveBeenCalledWith({
      cle: "cle-de-test",
      projet: "projet-de-test",
      nom: "sauvegarde-20261008-1405",
      expiration: "2026-10-15T14:05:30Z",
    });
    expect(d.sauvegarder.mock.invocationCallOrder[0]).toBeLessThan(
      d.appliquerMigrations.mock.invocationCallOrder[0],
    );
  });

  it("production sans clé Neon : la migration attend et la construction s'arrête", async () => {
    const { NEON_API_KEY: _cle, ...sansCle } = PRODUCTION;
    const d = dependances(sansCle, "1000");
    await expect(migrer(d)).rejects.toThrow(/NEON_API_KEY et NEON_PROJECT_ID/);
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("production à jour : ni sauvegarde ni migration", async () => {
    const d = dependances(PRODUCTION, "2000");
    expect(await migrer(d)).toBe("a-jour");
    expect(d.sauvegarder).not.toHaveBeenCalled();
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("échec de la sauvegarde : aucune migration appliquée", async () => {
    const d = dependances(PRODUCTION, null);
    d.sauvegarder.mockRejectedValueOnce(new Error("l'API Neon répond 401"));
    await expect(migrer(d)).rejects.toThrow(/401/);
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("prévisualisation avec la seule adresse directe : refus, rien n'est lancé", async () => {
    const d = dependances(
      {
        VERCEL: "1",
        VERCEL_ENV: "preview",
        DATABASE_URL_DIRECT: "postgresql://production",
      },
      "1000",
    );
    await expect(migrer(d)).rejects.toThrow(/base de prévisualisation manque/);
    expect(d.lireDerniere).not.toHaveBeenCalled();
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("production avec la seule adresse directe : refus", async () => {
    const { DATABASE_URL_UNPOOLED: _adresse, ...reste } = PRODUCTION;
    const d = dependances(
      { ...reste, DATABASE_URL_DIRECT: "postgresql://x" },
      "1000",
    );
    await expect(migrer(d)).rejects.toThrow(/base de production manque/);
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("DATABASE_URL_UNPOOLED est préférée à l'adresse directe", async () => {
    const d = dependances(
      { ...PRODUCTION, DATABASE_URL_DIRECT: "postgresql://autre" },
      "2000",
    );
    await migrer(d);
    expect(d.lireDerniere).toHaveBeenCalledWith("postgresql://production");
  });

  it("--vercel sans VERCEL_ENV : arrêt avec consigne ; sans le drapeau : rien", async () => {
    const d = { ...dependances({ VERCEL: "1" }, null), vercel: true };
    await expect(migrer(d)).rejects.toThrow(/variables système de Vercel/);
    const local = { ...dependances({}, null), vercel: false };
    expect(await migrer(local)).toBe("hors-vercel");
  });
});

function reponse(status: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status });
}

describe("API Neon", () => {
  const sansAttente = { attendre: async () => {} };

  it("création : adresse, méthode, en-têtes et corps", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(reponse(200, { branches: [] }))
      .mockResolvedValueOnce(reponse(201, {}));
    await creerSauvegarde(
      {
        cle: "k",
        projet: "p",
        nom: "sauvegarde-20261008-1405",
        expiration: "2026-10-15T14:05:30Z",
      },
      { fetchFn, ...sansAttente },
    );
    const [url, init] = fetchFn.mock.calls[1];
    expect(url).toBe("https://console.neon.tech/api/v2/projects/p/branches");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body)).toEqual({
      branch: {
        name: "sauvegarde-20261008-1405",
        expires_at: "2026-10-15T14:05:30Z",
      },
    });
  });

  it("nettoyage : garde les 2 sauvegardes les plus récentes, jamais la branche par défaut", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        reponse(200, {
          branches: [
            {
              id: "br-1",
              name: "sauvegarde-a",
              created_at: "2026-10-01T00:00:00Z",
            },
            {
              id: "br-3",
              name: "sauvegarde-c",
              created_at: "2026-10-03T00:00:00Z",
            },
            {
              id: "br-2",
              name: "sauvegarde-b",
              created_at: "2026-10-02T00:00:00Z",
            },
            {
              id: "br-0",
              name: "sauvegarde-principale",
              default: true,
              created_at: "2026-09-01T00:00:00Z",
            },
          ],
        }),
      )
      .mockResolvedValue(reponse(200, {}));
    await creerSauvegarde(
      {
        cle: "k",
        projet: "p",
        nom: "sauvegarde-n",
        expiration: "2026-10-15T00:00:00Z",
      },
      { fetchFn, ...sansAttente },
    );
    const suppressions = fetchFn.mock.calls.filter(
      ([, init]) => init.method === "DELETE",
    );
    expect(suppressions.map(([url]) => url)).toEqual([
      "https://console.neon.tech/api/v2/projects/p/branches/br-1",
    ]);
  });

  it("erreur 4xx : le message de Neon est repris, avec la consigne si la limite est atteinte", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(reponse(422, { message: "branches limit exceeded" }));
    await expect(
      appelNeon(
        { cle: "k", chemin: "/projects/p/branches", methode: "POST" },
        { fetchFn, ...sansAttente },
      ),
    ).rejects.toThrow(
      /422 \(branches limit exceeded\).*limite de branches atteinte/,
    );
  });

  it("423 : deux nouveaux essais, puis réussite", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(reponse(423, { message: "locked" }))
      .mockResolvedValueOnce(reponse(423, { message: "locked" }))
      .mockResolvedValueOnce(reponse(200, { ok: true }));
    expect(
      await appelNeon({ cle: "k", chemin: "/x" }, { fetchFn, ...sansAttente }),
    ).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("423 persistant : échec après trois appels", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(async () => reponse(423, { message: "locked" }));
    await expect(
      appelNeon({ cle: "k", chemin: "/x" }, { fetchFn, ...sansAttente }),
    ).rejects.toThrow(/423/);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
