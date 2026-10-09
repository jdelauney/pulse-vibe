
### Unitaires

Les règles et les use-cases s'essaient sans base ni réseau : le repository et le stockage sont remplacés par des doublures en mémoire.

<!-- fichier: src/core/fichiers/__tests__/fichier.rules.test.ts -->
```ts
// src/core/fichiers/__tests__/fichier.rules.test.ts
import { describe, expect, it } from "vitest";
import { appartientA, construireCle } from "../fichier.rules";

describe("Fichiers", () => {
  describe("La clé d'un fichier commence par l'identifiant de sa propriétaire", () => {
    it("US-XXX-3 – La clé du fichier de Camille commence par l'identifiant de Camille", () => {
      const cle = construireCle(
        "camille-id",
        "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10",
        "image/png",
      );

      expect(cle).toBe("camille-id/0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10.png");
      expect(appartientA(cle, "camille-id")).toBe(true);
      expect(appartientA(cle, "leo-id")).toBe(false);
    });
  });
});
```

Les trois use-cases partagent les mêmes doublures en mémoire, rangées dans un petit fichier d'aide ; chaque use-case a son fichier de tests.

<!-- fichier: src/core/fichiers/use-cases/__tests__/sut-fichiers.ts -->
```ts
// src/core/fichiers/use-cases/__tests__/sut-fichiers.ts
import type { Fichier } from "../../fichier.entity";
import type { FichierRepository } from "../../fichier-repository.port";
import type { StockageFichiers } from "../../stockage-fichiers.port";
import { confirmerEnvoi } from "../confirmer-envoi.use-case";
import { preparerEnvoi } from "../preparer-envoi.use-case";
import { supprimerFichier } from "../supprimer-fichier.use-case";

export const ID = "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10";

/** Doublures en mémoire des deux ports, et les trois use-cases branchés dessus. */
export function creerSut() {
  const lignes = new Map<string, Fichier>();
  const objets = new Map<string, { taille: number; typeMime: string }>();

  const fichiers: FichierRepository = {
    async reserver(donnees) {
      lignes.set(donnees.id, {
        ...donnees,
        statut: "en_attente",
        creeLe: new Date(),
      });
    },
    async trouver(id, utilisateurId) {
      const ligne = lignes.get(id);
      return ligne?.utilisateurId === utilisateurId ? ligne : null;
    },
    async marquerEnvoye(id, utilisateurId) {
      const ligne = lignes.get(id);
      if (ligne?.utilisateurId === utilisateurId) ligne.statut = "envoye";
    },
    async supprimer(id, utilisateurId) {
      const ligne = lignes.get(id);
      if (ligne?.utilisateurId !== utilisateurId) return null;
      lignes.delete(id);
      return { cle: ligne.cle };
    },
  };
  const stockage: StockageFichiers = {
    async adresseEnvoi({ cle }) {
      return `https://stockage.exemple/${cle}?signature=1`;
    },
    async adresseLecture({ cle }) {
      return `https://stockage.exemple/${cle}`;
    },
    async lireObjet(cle) {
      return objets.get(cle) ?? null;
    },
    async supprimerObjet(cle) {
      objets.delete(cle);
    },
  };
  const deps = { fichiers, stockage };

  const preparer = (utilisateurId: string) =>
    preparerEnvoi(deps, {
      id: ID,
      utilisateurId,
      nom: "facture-mars.png",
      typeMime: "image/png",
      taille: 1000,
    });

  return {
    lignes,
    objets,
    preparer,
    async givenEnvoiPrepare() {
      await preparer("camille-id");
    },
    givenObjetRecu(taille: number, typeMime: string) {
      objets.set(`camille-id/${ID}.png`, { taille, typeMime });
    },
    confirmer: (utilisateurId: string) =>
      confirmerEnvoi(deps, { id: ID, utilisateurId }),
    supprimer: (utilisateurId: string) =>
      supprimerFichier(deps, { id: ID, utilisateurId }),
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

L'adapter se teste avec le SDK doublé : l'erreur du service est choisie par le test, et les adresses signées (calculées en local, sans réseau) sont relues.

<!-- fichier: src/adapters/storage/__tests__/storage.adapter.test.ts -->
```ts
// src/adapters/storage/__tests__/storage.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ envoi: vi.fn() }));

// SDK doublé : le stockage répond par l'erreur choisie par le test.
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  class S3ClientDouble extends reel.S3Client {
    override send = etat.envoi;
  }
  return { ...reel, S3Client: S3ClientDouble };
});
vi.mock("@src/config/env", () => ({
  env: {
    R2_ACCOUNT_ID: "compte",
    R2_ACCESS_KEY_ID: "cle-acces",
    R2_SECRET_ACCESS_KEY: "secret-de-test",
    R2_BUCKET: "bucket-de-test",
  },
}));

const { stockageFichiers } = await import("../storage.adapter");

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

### Intégration (Vitest + PGlite)

Le repository reçoit la base de test : aucune doublure de session ni de `getDb()`.

<!-- fichier: src/db/fichiers/__tests__/fichier.repository.test.ts -->
```ts
// src/db/fichiers/__tests__/fichier.repository.test.ts
import { user } from "@src/db/compte/auth.table";
import type { Db } from "@src/db/db-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { fichierRepository } from "../fichier.repository";

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
  const fichiers = fichierRepository(db);
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

      const ligne = await fichierRepository(db).trouverEnvoye(
        ID_FICHIER,
        "camille-id",
      );

      expect(ligne).toMatchObject({ nom: "facture-mars.png" });
    });

    it("US-XXX-4 – Léo ne peut pas ouvrir la facture de Camille", async () => {
      await camilleEnvoie();

      const ligne = await fichierRepository(db).trouverEnvoye(
        ID_FICHIER,
        "leo-id",
      );

      expect(ligne).toBeNull();
    });

    it("US-XXX-4 – La liste de Léo ne contient pas la facture de Camille", async () => {
      await camilleEnvoie();

      const liste = await fichierRepository(db).listerEnvoyes("leo-id");

      expect(liste).toEqual([]);
    });

    it("US-XXX-4 – La base refuse à Léo de confirmer ou d'effacer la ligne de Camille", async () => {
      await camilleEnvoie(false);
      const fichiers = fichierRepository(db);

      await fichiers.marquerEnvoye(ID_FICHIER, "leo-id");
      const supprime = await fichiers.supprimer(ID_FICHIER, "leo-id");

      expect(supprime).toBeNull();
      expect(await fichiers.trouver(ID_FICHIER, "camille-id")).toMatchObject({
        statut: "en_attente",
      });
    });
  });

  describe("Un envoi non confirmé reste invisible", () => {
    it("US-XXX-6 – Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement", async () => {
      await camilleEnvoie(false);
      const fichiers = fichierRepository(db);

      expect(await fichiers.listerEnvoyes("camille-id")).toEqual([]);
      expect(await fichiers.trouverEnvoye(ID_FICHIER, "camille-id")).toBeNull();
    });
  });
});
```

### Bout en bout (Playwright)

Le premier test envoie un vrai fichier vers R2 : en local et en CI, utilisez un bucket de test, distinct de celui de production. Le second coupe l'envoi vers R2 (`page.route`) : il tourne sans compte R2.

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
    // Le stockage ne répond pas : l'envoi direct vers R2 est coupé.
    await page.route("**/*.r2.cloudflarestorage.com/**", (route) =>
      route.abort(),
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

