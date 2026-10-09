import { describe, expect, it, vi } from "vitest";
import {
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
});
