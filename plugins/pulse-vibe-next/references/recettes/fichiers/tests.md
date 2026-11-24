
### Unitaires

Les règles et les use-cases s'essaient sans base ni réseau : le repository et le stockage sont remplacés par des classes en mémoire qui implémentent les mêmes interfaces.

<!-- fichier: src/core/fichiers/__tests__/fichier.rules.test.ts -->
```ts
// src/core/fichiers/__tests__/fichier.rules.test.ts
import { describe, expect, it } from "vitest";
import { ReglesFichier } from "../fichier.rules";

describe("Fichiers", () => {
  describe("La clé d'un fichier commence par l'identifiant de sa propriétaire", () => {
    it("US-XXX-3 – La clé du fichier de Camille commence par l'identifiant de Camille", () => {
      const regles = new ReglesFichier();

      const cle = regles.construireCle(
        "camille-id",
        "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10",
        "image/png",
      );

      expect(cle).toBe("camille-id/0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10.png");
      expect(regles.appartientA(cle, "camille-id")).toBe(true);
      expect(regles.appartientA(cle, "leo-id")).toBe(false);
    });
  });
});
```

Les trois use-cases partagent les mêmes classes en mémoire, rangées dans un petit fichier d'aide ; chaque use-case a son fichier de tests.

<!-- fichier: src/core/fichiers/use-cases/__tests__/sut-fichiers.ts -->
```ts
// src/core/fichiers/use-cases/__tests__/sut-fichiers.ts
import {
  Fichier,
  type FichierVue,
  type ObjetRecu,
} from "../../fichier.entity";
import type { FichierRepository } from "../../fichier-repository.port";
import type { StockageFichiers } from "../../stockage-fichiers.port";
import { ConfirmerEnvoi } from "../confirmer-envoi.use-case";
import { PreparerEnvoi } from "../preparer-envoi.use-case";
import { SupprimerFichier } from "../supprimer-fichier.use-case";

export const ID = "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10";

/** Le repository en mémoire : mêmes promesses que celui de Postgres, sans base. */
class FichierRepositoryEnMemoire implements FichierRepository {
  readonly lignes = new Map<string, FichierVue>();

  async reserver(donnees: Parameters<FichierRepository["reserver"]>[0]) {
    this.lignes.set(donnees.id, {
      ...donnees,
      statut: "en_attente",
      creeLe: new Date(),
    });
  }

  async trouver(id: string, utilisateurId: string) {
    const ligne = this.lignes.get(id);
    return ligne?.utilisateurId === utilisateurId ? new Fichier(ligne) : null;
  }

  async marquerEnvoye(id: string, utilisateurId: string) {
    const ligne = this.lignes.get(id);
    if (ligne?.utilisateurId === utilisateurId) ligne.statut = "envoye";
  }

  async supprimer(id: string, utilisateurId: string) {
    const ligne = this.lignes.get(id);
    if (ligne?.utilisateurId !== utilisateurId) return null;
    this.lignes.delete(id);
    return { cle: ligne.cle };
  }
}

/** Le stockage en mémoire : les objets « reçus » sont posés par le test. */
class StockageEnMemoire implements StockageFichiers {
  readonly objets = new Map<string, ObjetRecu>();

  async adresseEnvoi({ cle }: { cle: string }) {
    return `https://stockage.exemple/${cle}?signature=1`;
  }

  async adresseLecture({ cle }: { cle: string }) {
    return `https://stockage.exemple/${cle}`;
  }

  async lireObjet(cle: string) {
    return this.objets.get(cle) ?? null;
  }

  async supprimerObjet(cle: string) {
    this.objets.delete(cle);
  }
}

/** Les deux classes en mémoire, et les trois use-cases branchés dessus. */
export function creerSut() {
  const repository = new FichierRepositoryEnMemoire();
  const stockage = new StockageEnMemoire();
  const preparerEnvoi = new PreparerEnvoi(repository, stockage);
  const confirmerEnvoi = new ConfirmerEnvoi(repository, stockage);
  const supprimerFichier = new SupprimerFichier(repository, stockage);

  const preparer = (utilisateurId: string) =>
    preparerEnvoi.executer({
      id: ID,
      utilisateurId,
      nom: "facture-mars.png",
      typeMime: "image/png",
      taille: 1000,
    });

  return {
    lignes: repository.lignes,
    objets: stockage.objets,
    preparer,
    async givenEnvoiPrepare() {
      await preparer("camille-id");
    },
    givenObjetRecu(taille: number, typeMime: string) {
      stockage.objets.set(`camille-id/${ID}.png`, { taille, typeMime });
    },
    confirmer: (utilisateurId: string) =>
      confirmerEnvoi.executer({ id: ID, utilisateurId }),
    supprimer: (utilisateurId: string) =>
      supprimerFichier.executer({ id: ID, utilisateurId }),
  };
}
```

<!-- fichier: src/core/fichiers/use-cases/__tests__/preparer-envoi.use-case.test.ts -->
```ts
// src/core/fichiers/use-cases/__tests__/preparer-envoi.use-case.test.ts
import { describe, expect, it } from "vitest";
import { creerSut, ID } from "./sut-fichiers";

describe("Fichiers", () => {
  describe("Un envoi se prépare avec une adresse signée et une ligne en attente", () => {
    it("US-XXX-3 – Camille reçoit une adresse d'envoi et une ligne en attente est réservée", async () => {
      const sut = creerSut();

      const resultat = await sut.preparer("camille-id");

      expect(resultat.adresse).toContain(`camille-id/${ID}.png`);
      expect(sut.lignes.get(ID)).toMatchObject({
        cle: `camille-id/${ID}.png`,
        statut: "en_attente",
      });
    });
  });
});
```

<!-- fichier: src/core/fichiers/use-cases/__tests__/confirmer-envoi.use-case.test.ts -->
```ts
// src/core/fichiers/use-cases/__tests__/confirmer-envoi.use-case.test.ts
import { describe, expect, it } from "vitest";
import { creerSut, ID } from "./sut-fichiers";

describe("Fichiers", () => {
  describe("Un envoi n'est confirmé que s'il correspond à ce qui était annoncé", () => {
    it("US-XXX-6 – L'envoi conforme passe la ligne à « envoye »", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.confirmer("camille-id");

      expect(resultat).toEqual({ ok: true, valeur: { id: ID } });
      expect(sut.lignes.get(ID)?.statut).toBe("envoye");
    });

    it.each([
      ["rien n'a été reçu", null],
      ["la taille diffère", { taille: 999, typeMime: "image/png" }],
      ["le type diffère", { taille: 1000, typeMime: "application/pdf" }],
    ])(
      "US-XXX-6 – Un envoi différent de l'annonce est effacé avec sa ligne : %s",
      async (_cas, recu) => {
        const sut = creerSut();
        await sut.givenEnvoiPrepare();
        if (recu) sut.givenObjetRecu(recu.taille, recu.typeMime);

        const resultat = await sut.confirmer("camille-id");

        expect(resultat).toEqual({ ok: false, raison: "envoi-incomplet" });
        expect(sut.lignes.size).toBe(0);
        expect(sut.objets.size).toBe(0);
      },
    );
  });

  describe("Une personne accède seulement à ses propres fichiers", () => {
    it("US-XXX-4 – Léo ne peut pas confirmer l'envoi de Camille", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.confirmer("leo-id");

      expect(resultat).toEqual({ ok: false, raison: "fichier-introuvable" });
      expect(sut.lignes.get(ID)?.statut).toBe("en_attente");
    });
  });
});
```

<!-- fichier: src/core/fichiers/use-cases/__tests__/supprimer-fichier.use-case.test.ts -->
```ts
// src/core/fichiers/use-cases/__tests__/supprimer-fichier.use-case.test.ts
import { describe, expect, it } from "vitest";
import { creerSut } from "./sut-fichiers";

describe("Fichiers", () => {
  describe("Une personne accède seulement à ses propres fichiers", () => {
    it("US-XXX-4 – Camille supprime son fichier : la ligne et l'objet disparaissent", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.supprimer("camille-id");

      expect(resultat.ok).toBe(true);
      expect(sut.lignes.size).toBe(0);
      expect(sut.objets.size).toBe(0);
    });

    it("US-XXX-4 – Léo ne peut pas supprimer le fichier de Camille", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.supprimer("leo-id");

      expect(resultat).toEqual({ ok: false, raison: "fichier-introuvable" });
      expect(sut.lignes.size).toBe(1);
      expect(sut.objets.size).toBe(1);
    });
  });
});
```

<!-- fichier: src/features/fichiers/schemas/__tests__/fichier.schema.test.ts -->
```ts
// src/features/fichiers/schemas/__tests__/fichier.schema.test.ts
import { TAILLE_MAX } from "@src/core/fichiers/fichier.entity";
import { describe, expect, it } from "vitest";
import { demandeEnvoiSchema } from "../fichier.schema";

describe("Fichiers", () => {
  describe("Seuls les types et tailles autorisés sont acceptés", () => {
    it("US-XXX-1 – Une photo PNG de 2 Mo est acceptée", () => {
      const resultat = demandeEnvoiSchema.safeParse({
        nom: "facture-mars.png",
        typeMime: "image/png",
        taille: 2 * 1024 * 1024,
      });

      expect(resultat.success).toBe(true);
    });

    it("US-XXX-2 – Un fichier interdit ou trop lourd est refusé avec un message clair : gros.pdf de 5 Mo et 1 octet", () => {
      const resultat = demandeEnvoiSchema.safeParse({
        nom: "gros.pdf",
        typeMime: "application/pdf",
        taille: TAILLE_MAX + 1,
      });

      expect(resultat.success).toBe(false);
      expect(resultat.error?.issues[0]?.message).toBe(
        "Fichier trop lourd : 5 Mo au maximum.",
      );
    });

    it("US-XXX-2 – Un fichier interdit ou trop lourd est refusé avec un message clair : outil.exe", () => {
      const resultat = demandeEnvoiSchema.safeParse({
        nom: "outil.exe",
        typeMime: "application/x-msdownload",
        taille: 1000,
      });

      expect(resultat.success).toBe(false);
      expect(resultat.error?.issues[0]?.message).toBe(
        "Type de fichier refusé : JPEG, PNG, WebP ou PDF seulement.",
      );
    });
  });
});
```

Vercel : l'adapter se teste avec le client du SDK doublé : l'erreur du service est choisie par le test, et les adresses signées (calculées en local, sans réseau) sont relues.

<!-- fichier: src/adapters/storage/__tests__/storage.adapter.test.ts hebergement: vercel -->
```ts
// src/adapters/storage/__tests__/storage.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StockageR2Adapter } from "../storage.adapter";

const etat = vi.hoisted(() => ({ envoi: vi.fn() }));

// SDK doublé : le stockage répond par l'erreur choisie par le test.
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  class S3ClientDouble extends reel.S3Client {
    override send = etat.envoi;
  }
  return { ...reel, S3Client: S3ClientDouble };
});

// L'adapter reçoit sa configuration par le constructeur : aucun module de configuration à doubler.
const stockageFichiers = new StockageR2Adapter({
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "cle-acces",
  R2_SECRET_ACCESS_KEY: "secret-de-test",
  R2_BUCKET: "bucket-de-test",
});

describe("Stockage des fichiers", () => {
  beforeEach(() => {
    etat.envoi.mockReset();
  });

  describe("Une panne du stockage est signalée comme une panne de service", () => {
    it("US-XXX-7 – Un refus de R2 lève une erreur de service « stockage » sans la clé de l'objet", async () => {
      etat.envoi.mockRejectedValue(
        Object.assign(
          new Error("Access Denied pour camille-id/f1.pdf (secret-de-test)"),
          {
            name: "AccessDenied",
            Code: "AccessDenied",
            $metadata: { httpStatusCode: 403 },
          },
        ),
      );

      const erreur = await stockageFichiers
        .lireObjet("camille-id/f1.pdf")
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
      const service = erreur as ErreurService;
      expect(service.service).toBe("stockage");
      expect(service.message).not.toContain("camille-id");
      // La cause garde les champs techniques, sans le texte de l'erreur d'origine.
      expect(service.cause).toEqual({
        name: "AccessDenied",
        code: "AccessDenied",
        httpStatusCode: 403,
      });
      expect(JSON.stringify(service.cause)).not.toContain("camille-id");
      expect(JSON.stringify(service.cause)).not.toContain("secret-de-test");
    });

    it("US-XXX-7 – Un objet absent n'est pas une panne : le stockage répond « rien reçu »", async () => {
      etat.envoi.mockRejectedValue(
        Object.assign(new Error("NotFound"), { name: "NotFound" }),
      );

      const recu = await stockageFichiers.lireObjet("camille-id/f1.pdf");

      expect(recu).toBeNull();
    });
  });

  describe("Les adresses signées durent 5 minutes et figent le type et la taille", () => {
    it("US-XXX-8 – L'adresse d'envoi signe le type et la taille exacts", async () => {
      const adresse = new URL(
        await stockageFichiers.adresseEnvoi({
          cle: "camille-id/f1.png",
          typeMime: "image/png",
          taille: 1000,
        }),
      );

      expect(adresse.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(adresse.searchParams.get("X-Amz-SignedHeaders")).toBe(
        "content-length;content-type;host",
      );
      expect(adresse.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    });

    it("US-XXX-8 – L'adresse de lecture force le téléchargement sous un nom nettoyé", async () => {
      const adresse = new URL(
        await stockageFichiers.adresseLecture({
          cle: "camille-id/f1.pdf",
          nom: 'fa"ctu<re>.pdf',
        }),
      );

      expect(adresse.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(adresse.searchParams.get("response-content-disposition")).toBe(
        'attachment; filename="fa_ctu_re_.pdf"',
      );
    });
  });
});
```

Serveur : l'adapter du disque se teste sur un dossier temporaire du système, avec une horloge choisie par le test.

<!-- fichier: src/adapters/storage/__tests__/storage.adapter.test.ts hebergement: docker,serveur -->
```ts
// src/adapters/storage/__tests__/storage.adapter.test.ts
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ErreurService } from "@src/lib/errors/erreur-service";
import { afterAll, describe, expect, it } from "vitest";
import { StockageDisqueAdapter } from "../storage.adapter";

const DOSSIER = mkdtempSync(join(tmpdir(), "fichiers-"));
const SECRET = "secret-de-test-de-trente-deux-caracteres";
let heure = 1_000_000;
const stockage = new StockageDisqueAdapter(
  { FICHIERS_DOSSIER: DOSSIER, FICHIERS_SECRET: SECRET },
  () => heure,
);
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const jetonDe = (adresse: string) =>
  new URL(adresse, "http://site").searchParams.get("jeton") ?? "";

afterAll(() => rmSync(DOSSIER, { recursive: true, force: true }));

describe("Stockage des fichiers sur le disque", () => {
  it("US-XXX-6 – Un envoi conforme au jeton est enregistré, puis relu tel quel", async () => {
    const adresse = await stockage.adresseEnvoi({
      cle: "camille-id/f1.png",
      typeMime: "image/png",
      taille: PNG.byteLength,
    });
    expect(adresse).toMatch(/^\/api\/fichiers\/envoi\?jeton=/);
    expect(
      await stockage.recevoir({
        jeton: jetonDe(adresse),
        typeMime: "image/png",
        contenu: PNG,
      }),
    ).toBe("enregistre");
    expect(await stockage.lireObjet("camille-id/f1.png")).toEqual({
      taille: PNG.byteLength,
      typeMime: "image/png",
    });
    const lecture = await stockage.adresseLecture({
      cle: "camille-id/f1.png",
      nom: "photo.png",
    });
    const fichier = await stockage.ouvrir(jetonDe(lecture));
    expect(fichier?.nom).toBe("photo.png");
    expect([...(fichier?.contenu ?? [])]).toEqual([...PNG]);
  });

  it("US-XXX-8 – Un envoi d'un autre type, d'une autre taille ou avec un jeton modifié est refusé", async () => {
    const jeton = jetonDe(
      await stockage.adresseEnvoi({
        cle: "camille-id/f2.png",
        typeMime: "image/png",
        taille: PNG.byteLength,
      }),
    );
    expect(
      await stockage.recevoir({
        jeton,
        typeMime: "application/pdf",
        contenu: PNG,
      }),
    ).toBe("refuse");
    expect(
      await stockage.recevoir({
        jeton,
        typeMime: "image/png",
        contenu: PNG.slice(1),
      }),
    ).toBe("refuse");
    const [corps] = jeton.split(".");
    const fausse = `${corps}.${"A".repeat(43)}`;
    expect(
      await stockage.recevoir({
        jeton: fausse,
        typeMime: "image/png",
        contenu: PNG,
      }),
    ).toBe("refuse");
    expect(await stockage.lireObjet("camille-id/f2.png")).toBeNull();
  });

  it("US-XXX-8 – Les jetons durent 5 minutes et servent à un seul usage", async () => {
    const lecture = jetonDe(
      await stockage.adresseLecture({
        cle: "camille-id/f1.png",
        nom: "photo.png",
      }),
    );
    expect(stockage.verifier(lecture, "envoi")).toBeNull();
    heure += 5 * 60 * 1000 + 1;
    expect(stockage.verifier(lecture, "lecture")).toBeNull();
    expect(await stockage.ouvrir(lecture)).toBeNull();
  });

  it("US-XXX-7 – Une clé qui sortirait du dossier est refusée avant tout accès au disque", async () => {
    const erreur = await stockage.lireObjet("../../etc/passwd").catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurService);
    expect(erreur.message).not.toContain("etc");
  });

  it("US-XXX-4 – Supprimer efface le fichier ; un fichier absent répond « rien reçu »", async () => {
    await stockage.supprimerObjet("camille-id/f1.png");
    expect(await stockage.lireObjet("camille-id/f1.png")).toBeNull();
    await expect(
      stockage.supprimerObjet("camille-id/f1.png"),
    ).resolves.toBeUndefined();
  });
});
```

### Intégration (Vitest + PGlite)

Le repository reçoit la base de test : aucune doublure de session ni de `getDb()`.

<!-- fichier: src/db/fichiers/__tests__/fichier.repository.test.ts -->
```ts
// src/db/fichiers/__tests__/fichier.repository.test.ts
import { user } from "@src/db/compte/auth.table";
import type { Db } from "@src/db/db-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { DrizzleFichierRepository } from "../fichier.repository";

const ID_FICHIER = "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
  await db.insert(user).values([
    { id: "camille-id", name: "Camille", email: "camille@exemple.fr" },
    { id: "leo-id", name: "Léo", email: "leo@exemple.fr" },
  ]);
});

afterEach(async () => {
  await fermer();
});

/** Camille réserve « facture-mars.pdf » ; `envoye` la fait passer au statut vérifié. */
async function camilleEnvoie(envoye = true) {
  const fichiers = new DrizzleFichierRepository(db);
  await fichiers.reserver({
    id: ID_FICHIER,
    utilisateurId: "camille-id",
    cle: `camille-id/${ID_FICHIER}.png`,
    nom: "facture-mars.png",
    typeMime: "image/png",
    taille: 1000,
  });
  if (envoye) await fichiers.marquerEnvoye(ID_FICHIER, "camille-id");
}

describe("Fichiers", () => {
  describe("Une personne accède seulement à ses propres fichiers", () => {
    it("US-XXX-4 – Camille ouvre sa facture", async () => {
      await camilleEnvoie();

      const ligne = await new DrizzleFichierRepository(db).trouverEnvoye(
        ID_FICHIER,
        "camille-id",
      );

      expect(ligne).toMatchObject({ nom: "facture-mars.png" });
    });

    it("US-XXX-4 – Léo ne peut pas ouvrir la facture de Camille", async () => {
      await camilleEnvoie();

      const ligne = await new DrizzleFichierRepository(db).trouverEnvoye(
        ID_FICHIER,
        "leo-id",
      );

      expect(ligne).toBeNull();
    });

    it("US-XXX-4 – La liste de Léo ne contient pas la facture de Camille", async () => {
      await camilleEnvoie();

      const liste = await new DrizzleFichierRepository(db).listerEnvoyes("leo-id");

      expect(liste).toEqual([]);
    });

    it("US-XXX-4 – La base refuse à Léo de confirmer ou d'effacer la ligne de Camille", async () => {
      await camilleEnvoie(false);
      const fichiers = new DrizzleFichierRepository(db);

      await fichiers.marquerEnvoye(ID_FICHIER, "leo-id");
      const supprime = await fichiers.supprimer(ID_FICHIER, "leo-id");

      expect(supprime).toBeNull();
      const fichier = await fichiers.trouver(ID_FICHIER, "camille-id");
      expect(fichier?.versVue()).toMatchObject({ statut: "en_attente" });
    });
  });

  describe("Un envoi non confirmé reste invisible", () => {
    it("US-XXX-6 – Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement", async () => {
      await camilleEnvoie(false);
      const fichiers = new DrizzleFichierRepository(db);

      expect(await fichiers.listerEnvoyes("camille-id")).toEqual([]);
      expect(await fichiers.trouverEnvoye(ID_FICHIER, "camille-id")).toBeNull();
    });
  });
});
```

### Bout en bout (Playwright)

Le premier test envoie un vrai fichier vers R2 : en local et en CI, utilisez un bucket de test, distinct de celui de production. Le second coupe l'envoi du fichier (`page.route`, toute requête PUT : R2 ou la route du site) : il tourne sans compte R2.

<!-- fichier: e2e/fichiers.spec.ts -->
```ts
// e2e/fichiers.spec.ts
import { expect, test } from "@playwright/test";
import { connecterNouvelUtilisateur } from "./aides/connexion";

// Plus petite image PNG valide (1 × 1 pixel).
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Fichiers", () => {
  test("US-XXX-5 – Camille envoie une photo et la voit dans sa liste", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/fichiers");

    await page.getByLabel(/Ajouter un fichier/).setInputFiles({
      name: "photo-chantier.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });

    await expect(page.getByText("Fichier enregistré.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "photo-chantier.png" }),
    ).toBeVisible();
  });

  test("US-XXX-5 – L'envoi échoue en route : un message clair, la page reste en place", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/fichiers");
    // Le stockage ne répond pas : l'envoi du fichier (PUT, vers R2 ou vers le site) est coupé.
    await page.route("**/*", (route) =>
      route.request().method() === "PUT" ? route.abort() : route.fallback(),
    );

    await page.getByLabel(/Ajouter un fichier/).setInputFiles({
      name: "photo-chantier.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "L'envoi n'a pas abouti. Réessayez." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mes fichiers" }),
    ).toBeVisible();
  });
});
```

