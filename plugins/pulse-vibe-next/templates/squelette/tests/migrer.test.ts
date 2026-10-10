import { describe, expect, it, vi } from "vitest";
import {
  appelNeon,
  creerSauvegarde,
  migrationsEnAttente,
  migrer,
  pointDAcces,
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
const ADRESSE_APERCU =
  "postgresql://ep-apercu-111111.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const APERCU = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  DATABASE_URL_UNPOOLED: ADRESSE_APERCU,
  NEON_ENDPOINT_PRODUCTION: "ep-principale-222222",
};

/** Tout ce que migrer() a écrit dans le journal de construction. */
const journalDe = (d: ReturnType<typeof dependances>) =>
  d.dire.mock.calls.map(([message]) => String(message)).join("\n");

function dependances(env: Record<string, string>, derniere: string | null) {
  return {
    env,
    journal: JOURNAL,
    maintenant: new Date("2026-10-08T14:05:30.123Z"),
    lireDerniere: vi.fn(async () => derniere),
    sauvegarder: vi.fn(
      async (): Promise<{ expiration: string | null } | undefined> => undefined,
    ),
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

  it("prévisualisation sur sa propre branche : applique, sans sauvegarde", async () => {
    const d = dependances(APERCU, "1000");
    expect(await migrer(d)).toBe("applique");
    expect(d.sauvegarder).not.toHaveBeenCalled();
    expect(d.appliquerMigrations).toHaveBeenCalledWith(ADRESSE_APERCU);
  });

  it("prévisualisation sur le point d'accès de la production : migrations sautées, construction poursuivie, explication et solution", async () => {
    for (const repere of [
      "ep-apercu-111111",
      "ep-apercu-111111-pooler.eu-central-1.aws.neon.tech",
      ADRESSE_APERCU.replace("ep-apercu-111111", "ep-apercu-111111-pooler"),
    ]) {
      const d = dependances(
        { ...APERCU, NEON_ENDPOINT_PRODUCTION: repere },
        "1000",
      );
      // La promesse se résout : le script sort avec le code 0 et Vercel poursuit la construction.
      expect(await migrer(d)).toBe("ignore-production");
      expect(d.appliquerMigrations).not.toHaveBeenCalled();
      expect(d.sauvegarder).not.toHaveBeenCalled();
      const journal = journalDe(d);
      expect(journal).toMatch(/utilise la base de production/);
      expect(journal).toMatch(/la production reste protégée/);
      expect(journal).toMatch(/peuvent afficher des erreurs/);
      expect(journal).toMatch(/Integrations → Vercel → Manage/);
      expect(journal).toMatch(/une branche pour chaque prévisualisation/);
    }
  });

  it("prévisualisation sans NEON_ENDPOINT_PRODUCTION : migrations sautées par prudence, construction poursuivie, comment activer la vérification", async () => {
    const { NEON_ENDPOINT_PRODUCTION: _repere, ...sansRepere } = APERCU;
    const d = dependances(sansRepere, "1000");
    expect(await migrer(d)).toBe("ignore-sans-repere");
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
    const journal = journalDe(d);
    expect(journal).toMatch(/NEON_ENDPOINT_PRODUCTION/);
    expect(journal).toMatch(/construction continue/i);
    expect(journal).toMatch(/\/pulse:deploy/);
    expect(journal).toMatch(/\/pulse:init/);
  });

  it("prévisualisation avec un NEON_ENDPOINT_PRODUCTION illisible : message à part, migrations sautées", async () => {
    const d = dependances(
      { ...APERCU, NEON_ENDPOINT_PRODUCTION: "pas-un-repere" },
      "1000",
    );
    expect(await migrer(d)).toBe("ignore-repere-illisible");
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
    const journal = journalDe(d);
    expect(journal).toMatch(/n'a pas la forme d'un point d'accès/);
    expect(journal).not.toMatch(/pas encore enregistré/);
  });

  it("prévisualisation dont l'adresse n'est pas lisible : migrations sautées par prudence, construction poursuivie", async () => {
    const d = dependances(
      { ...APERCU, DATABASE_URL_UNPOOLED: "postgresql://localhost:5432/x" },
      "1000",
    );
    expect(await migrer(d)).toBe("ignore-adresse-illisible");
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
    expect(journalDe(d)).toMatch(/par prudence/);
  });

  it("prévisualisation à jour sans NEON_ENDPOINT_PRODUCTION : rien à dire de plus", async () => {
    const { NEON_ENDPOINT_PRODUCTION: _repere, ...sansRepere } = APERCU;
    const d = dependances(sansRepere, "2000");
    expect(await migrer(d)).toBe("a-jour");
    expect(journalDe(d)).not.toMatch(/NEON_ENDPOINT_PRODUCTION/);
  });

  it("production : la garde des prévisualisations ne s'applique pas", async () => {
    const d = dependances(
      { ...PRODUCTION, NEON_ENDPOINT_PRODUCTION: "ep-production-1" },
      "1000",
    );
    expect(await migrer(d)).toBe("applique");
  });

  it("point d'accès : lu dans une adresse, un nom d'hôte ou un identifiant, sans -pooler", () => {
    expect(pointDAcces(ADRESSE_APERCU)).toBe("ep-apercu-111111");
    expect(
      pointDAcces("ep-apercu-111111-pooler.eu-central-1.aws.neon.tech"),
    ).toBe("ep-apercu-111111");
    expect(pointDAcces(" EP-Apercu-111111 ")).toBe("ep-apercu-111111");
    expect(pointDAcces("postgresql://localhost:5432/x")).toBeNull();
    expect(pointDAcces(undefined)).toBeNull();
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

  it("production, expiration refusée par Neon : le journal n'annonce pas de date", async () => {
    const d = dependances(PRODUCTION, "1000");
    d.sauvegarder.mockResolvedValueOnce({ expiration: null });
    expect(await migrer(d)).toBe("applique");
    const messages = d.dire.mock.calls.map(([m]) => String(m)).join(" ");
    expect(messages).toMatch(/sans date d'expiration.*2 plus récentes/);
    expect(messages).not.toMatch(/gardée jusqu'au/);
  });

  it("production sans clé Neon : la migration attend et la construction s'arrête", async () => {
    const { NEON_API_KEY: _cle, ...sansCle } = PRODUCTION;
    const d = dependances(sansCle, "1000");
    await expect(migrer(d)).rejects.toThrow(/NEON_API_KEY et NEON_PROJECT_ID/);
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("production, base jamais migrée : rien à sauvegarder, la migration passe même sans clé Neon", async () => {
    const { NEON_API_KEY: _cle, ...sansCle } = PRODUCTION;
    const d = dependances(sansCle, null);
    expect(await migrer(d)).toBe("applique");
    expect(d.sauvegarder).not.toHaveBeenCalled();
    expect(d.appliquerMigrations).toHaveBeenCalledWith(
      "postgresql://production",
    );
    expect(d.dire).toHaveBeenCalledWith(
      expect.stringMatching(/jamais migrée.*sauvegarde/),
    );
  });

  it("production à jour : ni sauvegarde ni migration", async () => {
    const d = dependances(PRODUCTION, "2000");
    expect(await migrer(d)).toBe("a-jour");
    expect(d.sauvegarder).not.toHaveBeenCalled();
    expect(d.appliquerMigrations).not.toHaveBeenCalled();
  });

  it("échec de la sauvegarde : aucune migration appliquée", async () => {
    const d = dependances(PRODUCTION, "1000");
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

  it("projet sans migration : aucun arrêt, même sans VERCEL_ENV avec --vercel", async () => {
    const d = {
      ...dependances({ VERCEL: "1" }, null),
      journal: [],
      vercel: true,
    };
    expect(await migrer(d)).toBe("rien");
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

  it("création : sans expiration si Neon refuse expires_at (400), une seule fois", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(reponse(200, { branches: [] }))
      .mockResolvedValueOnce(
        reponse(400, { message: "expires_at not allowed" }),
      )
      .mockResolvedValueOnce(reponse(201, {}));
    const dire = vi.fn();
    const posee = await creerSauvegarde(
      {
        cle: "k",
        projet: "p",
        nom: "sauvegarde-20261008-1405",
        expiration: "2026-10-15T14:05:30Z",
      },
      { fetchFn, ...sansAttente },
      dire,
    );
    expect(posee).toEqual({ expiration: null });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchFn.mock.calls[2][1].body)).toEqual({
      branch: { name: "sauvegarde-20261008-1405" },
    });
    expect(dire).toHaveBeenCalledWith(
      expect.stringContaining("2 sauvegardes les plus récentes"),
    );
  });

  it("création : la limite de branches n'est pas rejouée", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(reponse(200, { branches: [] }))
      .mockResolvedValueOnce(
        reponse(422, { message: "branches limit exceeded" }),
      );
    await expect(
      creerSauvegarde(
        { cle: "k", projet: "p", nom: "s", expiration: "2026-10-15T14:05:30Z" },
        { fetchFn, ...sansAttente },
        () => {},
      ),
    ).rejects.toThrow(/limite de branches/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("nettoyage : garde les 2 sauvegardes les plus récentes, jamais la branche par défaut", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        reponse(200, {
          branches: [
            {
              id: "br-1",
              name: "sauvegarde-20261001-0900",
              created_at: "2026-10-01T00:00:00Z",
            },
            {
              id: "br-3",
              name: "sauvegarde-20261003-0900",
              created_at: "2026-10-03T00:00:00Z",
            },
            {
              id: "br-2",
              name: "sauvegarde-20261002-0900",
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
      /422 \(branches limit exceeded\).*limite de branches Neon atteinte.*preview\/….*_old_/,
    );
  });

  it("423 : attentes de 2, 5 et 10 s, réussite au quatrième appel", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(reponse(423, { message: "locked" }))
      .mockResolvedValueOnce(reponse(423, { message: "locked" }))
      .mockResolvedValueOnce(reponse(423, { message: "locked" }))
      .mockResolvedValueOnce(reponse(200, { ok: true }));
    const attendre = vi.fn(async (_ms: number) => {});
    expect(
      await appelNeon({ cle: "k", chemin: "/x" }, { fetchFn, attendre }),
    ).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(attendre.mock.calls.map(([ms]) => ms)).toEqual([2000, 5000, 10000]);
  });

  it("423 persistant : échec après quatre appels", async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(async () => reponse(423, { message: "locked" }));
    await expect(
      appelNeon({ cle: "k", chemin: "/x" }, { fetchFn, ...sansAttente }),
    ).rejects.toThrow(/423/);
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("délai dépassé : message en français", async () => {
    const fetchFn = vi.fn().mockRejectedValue(
      Object.assign(new Error("aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );
    await expect(
      appelNeon({ cle: "k", chemin: "/x" }, { fetchFn, ...sansAttente }),
    ).rejects.toThrow("Neon n'a pas répondu en 20 secondes");
  });

  it("limite de débit : pas de consigne sur les branches", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(reponse(429, { message: "rate limit exceeded" }));
    await expect(
      appelNeon({ cle: "k", chemin: "/x" }, { fetchFn, ...sansAttente }),
    ).rejects.toThrow(/429 \(rate limit exceeded\)$/);
  });

  it("nettoyage : seules les sauvegardes Pulse sont supprimées, un échec de suppression n'arrête rien", async () => {
    const branche = (id: string, name: string, created_at: string) => ({
      id,
      name,
      created_at,
    });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        reponse(200, {
          branches: [
            branche("br-m", "sauvegarde-manuelle", "2026-01-01T00:00:00Z"),
            branche("br-1", "sauvegarde-20261001-0900", "2026-10-01T00:00:00Z"),
            branche("br-2", "sauvegarde-20261002-0900", "2026-10-02T00:00:00Z"),
            branche("br-3", "sauvegarde-20261003-0900", "2026-10-03T00:00:00Z"),
            branche("br-4", "sauvegarde-20261004-0900", "2026-10-04T00:00:00Z"),
          ],
        }),
      )
      .mockResolvedValueOnce(reponse(409, { message: "branche occupée" }))
      .mockResolvedValue(reponse(200, {}));
    const dire = vi.fn();
    await creerSauvegarde(
      {
        cle: "k",
        projet: "p",
        nom: "sauvegarde-20261005-0900",
        expiration: "2026-10-15T00:00:00Z",
      },
      { fetchFn, ...sansAttente },
      dire,
    );
    const appels = fetchFn.mock.calls.map(
      ([url, init]) => `${init.method} ${String(url).split("/branches")[1]}`,
    );
    expect(appels.filter((a) => a.startsWith("DELETE"))).toEqual([
      "DELETE /br-2",
      "DELETE /br-1",
    ]);
    expect(appels.join(" ")).not.toContain("br-m");
    expect(appels.at(-1)).toBe("POST ");
    expect(dire).toHaveBeenCalledWith(
      "impossible de supprimer l'ancienne sauvegarde sauvegarde-20261002-0900 : l'API Neon répond 409 (branche occupée) ; on continue",
    );
  });
});
