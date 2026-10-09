
### Unitaires (Vitest)

<!-- fichier: src/core/factures/__tests__/facture.rules.test.ts -->
```ts
// src/core/factures/__tests__/facture.rules.test.ts
import { describe, expect, it } from "vitest";
import { eurosEnCentimes, montantEnCentimes } from "../facture.rules";

describe("Règles du montant", () => {
  it.each([
    ["120,50", 12050],
    ["120.5", 12050],
    ["0,05", 5],
    ["45", 4500],
  ])("US-XXX-6 – « %s » vaut %i centimes", (saisie, centimes) => {
    expect(eurosEnCentimes(saisie)).toBe(centimes);
  });

  it("US-XXX-6 – une saisie hors format ne donne pas de montant", () => {
    expect(eurosEnCentimes("abc")).toBeNaN();
  });

  it("US-XXX-6 – un montant de 0 € est refusé", () => {
    expect(montantEnCentimes("0")).toEqual({
      ok: false,
      raison: "montant-invalide",
    });
  });

  it("US-XXX-6 – un montant positif est accepté en centimes", () => {
    expect(montantEnCentimes("120,50")).toEqual({ ok: true, valeur: 12050 });
  });
});
```

Le use-case se teste avec une doublure du port, en mémoire : aucune base.

<!-- fichier: src/core/factures/__tests__/creer-facture.use-case.test.ts -->
```ts
// src/core/factures/__tests__/creer-facture.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { FactureRepository } from "../facture-repository.port";
import { creerFacture } from "../use-cases/creer-facture.use-case";

function facturesEnMemoire() {
  const enregistrees: {
    utilisateurId: string;
    client: string;
    montantCentimes: number;
  }[] = [];
  const factures: FactureRepository = {
    async inserer(utilisateurId, donnees) {
      enregistrees.push({ utilisateurId, ...donnees });
      return { id: `facture-${enregistrees.length}` };
    },
  };
  return { factures, enregistrees };
}

describe("creerFacture", () => {
  it("US-XXX-6 – « 120,50 » est enregistré en 12050 centimes pour la personne", async () => {
    const { factures, enregistrees } = facturesEnMemoire();

    const resultat = await creerFacture(
      { factures },
      { utilisateurId: "camille", client: "Atelier Dupont", montant: "120,50" },
    );

    expect(resultat).toEqual({ ok: true, valeur: { id: "facture-1" } });
    expect(enregistrees).toEqual([
      {
        utilisateurId: "camille",
        client: "Atelier Dupont",
        montantCentimes: 12050,
      },
    ]);
  });

  it("US-XXX-6 – un montant de 0 € est refusé et rien n'est enregistré", async () => {
    const { factures, enregistrees } = facturesEnMemoire();

    const resultat = await creerFacture(
      { factures },
      { utilisateurId: "camille", client: "Atelier Dupont", montant: "0" },
    );

    expect(resultat).toEqual({ ok: false, raison: "montant-invalide" });
    expect(enregistrees).toEqual([]);
  });
});
```

<!-- fichier: src/lib/helpers/pagination/__tests__/pagination.test.ts -->
```ts
// src/lib/helpers/pagination/__tests__/pagination.test.ts
import { describe, expect, it } from "vitest";
import { decalagePourPage, nombreDePages, pageValide } from "../pagination";

describe("Pagination", () => {
  it.each([
    [0, 1],
    [10, 1],
    [11, 2],
  ])("US-XXX-4 – %i factures font %i page(s)", (total, pages) => {
    expect(nombreDePages(total, 10)).toBe(pages);
  });

  it("US-XXX-4 – une page invalide revient à la page 1", () => {
    expect(pageValide(-3)).toBe(1);
    expect(pageValide(2.5)).toBe(1);
    expect(decalagePourPage(-3, 10)).toBe(0);
    expect(decalagePourPage(2, 10)).toBe(10);
  });
});
```

<!-- fichier: src/lib/helpers/format/__tests__/format.test.ts -->
```ts
// src/lib/helpers/format/__tests__/format.test.ts
import { describe, expect, it } from "vitest";
import { formaterDate, formaterMontant } from "../format";

/** Intl sépare le montant et « € » par une espace insécable : on la remplace pour comparer. */
const espacesSimples = (texte: string) => texte.replace(/\s/g, " ");

describe("Affichage", () => {
  it("US-XXX-6 – 12050 centimes s'affichent « 120,50 € »", () => {
    expect(espacesSimples(formaterMontant(12050))).toBe("120,50 €");
  });

  it("US-XXX-6 – une date s'affiche à l'heure de Paris", () => {
    expect(formaterDate(new Date("2026-03-09T23:30:00Z"))).toBe("10 mars 2026");
  });
});
```

<!-- fichier: src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts -->
```ts
// src/lib/helpers/formulaire/__tests__/erreurs-de-champs.test.ts
import { describe, expect, it } from "vitest";
import { erreursDeChamps } from "../erreurs-de-champs";

describe("erreursDeChamps", () => {
  it("US-XXX-6 – les erreurs du serveur deviennent des erreurs de champ", () => {
    expect(
      erreursDeChamps(["client", "montant"], {
        montant: { _errors: ["Le montant doit être supérieur à 0 €."] },
      }),
    ).toEqual({
      montant: { message: "Le montant doit être supérieur à 0 €." },
    });
  });
});
```

<!-- fichier: src/features/factures/schemas/__tests__/facture.schema.test.ts -->
```ts
// src/features/factures/schemas/__tests__/facture.schema.test.ts
import { describe, expect, it } from "vitest";
import { creerFactureSchema } from "../facture.schema";

function messagesDuMontant(montant: string) {
  const resultat = creerFactureSchema.safeParse({
    client: "Atelier Dupont",
    montant,
  });
  return resultat.success
    ? []
    : resultat.error.issues.map((probleme) => probleme.message);
}

describe("Schéma de création de facture", () => {
  it("US-XXX-6 – « 120,50 » est accepté", () => {
    expect(messagesDuMontant("120,50")).toEqual([]);
  });

  it.each([
    ["0", "Le montant doit être supérieur à 0 €."],
    ["12,345", "Écrivez un montant en euros, par exemple 120,50."],
    ["abc", "Écrivez un montant en euros, par exemple 120,50."],
  ])("US-XXX-6 – « %s » est refusé avec un seul message", (saisie, message) => {
    expect(messagesDuMontant(saisie)).toEqual([message]);
  });

  it("US-XXX-6 – un client vide est refusé", () => {
    const resultat = creerFactureSchema.safeParse({
      client: "   ",
      montant: "10",
    });
    expect(resultat.success).toBe(false);
  });
});
```

### Intégration du repository (Vitest + PGlite)

Chaque test reçoit une base PGlite neuve (Postgres en mémoire) avec les vraies migrations : `creerBaseDeTest()` du squelette. La base est passée au repository ; le test n'ouvre jamais la base réelle.

<!-- fichier: src/db/factures/__tests__/facture.repository.test.ts -->
```ts
// src/db/factures/__tests__/facture.repository.test.ts
import type { StatutFacture } from "@src/core/factures/facture.entity";
import { user } from "@src/db/compte/auth.table";
import type { Db } from "@src/db/db-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import {
  type FiltresListeFactures,
  factureRepository,
} from "../facture.repository";
import { factures } from "../facture.table";

const FILTRES_PAR_DEFAUT: FiltresListeFactures = {
  statut: null,
  recherche: "",
  tri: "recentes",
  page: 1,
  taillePage: 10,
};

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
  await db.insert(user).values([
    { id: "camille", name: "Camille", email: "camille@exemple.fr" },
    { id: "leo", name: "Léo", email: "leo@exemple.fr" },
  ]);
});

afterEach(async () => {
  await fermer();
});

async function ajouter(
  utilisateurId: string,
  client: string,
  montantCentimes: number,
  statut: StatutFacture = "brouillon",
) {
  await db
    .insert(factures)
    .values({ utilisateurId, client, montantCentimes, statut });
}

describe("factureRepository.lister", () => {
  it("US-XXX-1 – Camille ne voit pas les factures de Léo", async () => {
    await ajouter("camille", "Atelier Dupont", 12050);
    await ajouter("leo", "Boulangerie Martin", 4500);

    const { factures: liste, total } = await factureRepository(db).lister(
      "camille",
      FILTRES_PAR_DEFAUT,
    );

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
    expect(total).toBe(1);
  });

  it("US-XXX-2 – le filtre « Payée » ne garde que les factures payées", async () => {
    await ajouter("camille", "Atelier Dupont", 12050, "payee");
    await ajouter("camille", "Café Leroy", 8000, "brouillon");

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      statut: "payee",
    });

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
  });

  it("US-XXX-2 – la recherche ignore les majuscules", async () => {
    await ajouter("camille", "Atelier Dupont", 12050);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "dupont",
    });

    expect(liste.map((f) => f.client)).toEqual(["Atelier Dupont"]);
  });

  it("US-XXX-2 – le signe % est cherché comme un caractère", async () => {
    await ajouter("camille", "Remise 100%", 1000);
    await ajouter("camille", "Atelier Dupont", 12050);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "100%",
    });

    expect(liste.map((f) => f.client)).toEqual(["Remise 100%"]);
  });

  it("US-XXX-2 – le signe _ est cherché comme un caractère, pas comme « n'importe quel caractère »", async () => {
    await ajouter("camille", "Client_1", 1000);
    await ajouter("camille", "Client11", 2000);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "Client_1",
    });

    expect(liste.map((f) => f.client)).toEqual(["Client_1"]);
  });

  it("US-XXX-2 – la barre oblique inverse est cherchée comme un caractère", async () => {
    await ajouter("camille", "Atelier\\Dupont", 1000);
    await ajouter("camille", "Atelier Dupont", 2000);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      recherche: "Atelier\\Dupont",
    });

    expect(liste.map((f) => f.client)).toEqual(["Atelier\\Dupont"]);
  });

  it("US-XXX-3 – le tri par montant décroissant range 120,50 €, 80 €, 45 €", async () => {
    await ajouter("camille", "Boulangerie Martin", 4500);
    await ajouter("camille", "Atelier Dupont", 12050);
    await ajouter("camille", "Café Leroy", 8000);

    const { factures: liste } = await factureRepository(db).lister("camille", {
      ...FILTRES_PAR_DEFAUT,
      tri: "montant-desc",
    });

    expect(liste.map((f) => f.montantCentimes)).toEqual([12050, 8000, 4500]);
  });

  it("US-XXX-4 – 12 factures : 2 en page 2, total 12", async () => {
    for (let numero = 1; numero <= 12; numero++) {
      await ajouter("camille", `Client ${numero}`, numero * 100);
    }

    const { factures: liste, total } = await factureRepository(db).lister(
      "camille",
      { ...FILTRES_PAR_DEFAUT, page: 2 },
    );

    expect(liste).toHaveLength(2);
    expect(total).toBe(12);
  });
});

describe("factureRepository.inserer", () => {
  it("US-XXX-6 – la facture créée appartient à la personne indiquée", async () => {
    const repository = factureRepository(db);
    const { id } = await repository.inserer("camille", {
      client: "Atelier Dupont",
      montantCentimes: 12050,
    });

    const camille = await repository.lister("camille", FILTRES_PAR_DEFAUT);
    const leo = await repository.lister("leo", FILTRES_PAR_DEFAUT);

    expect(camille.factures).toEqual([
      expect.objectContaining({
        id,
        client: "Atelier Dupont",
        montantCentimes: 12050,
        statut: "brouillon",
      }),
    ]);
    expect(leo.total).toBe(0);
  });
});
```

### Bout en bout (Playwright)

`champ(page, libellé)` (recette `connexion`) vise le champ visible par son libellé exact.

<!-- fichier: e2e/factures.spec.ts -->
```ts
// e2e/factures.spec.ts
import { expect, type Page, test } from "@playwright/test";
import { champ, connecterNouvelUtilisateur } from "./aides/connexion";

async function creerFacture(page: Page, client: string, montant: string) {
  await champ(page, "Client").fill(client);
  await champ(page, "Montant (€)").fill(montant);
  await page.getByRole("button", { name: "Créer la facture" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(client) }),
  ).toBeVisible();
}

test.describe("Mes factures", () => {
  test.beforeEach(async ({ page }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/factures");
    await expect(
      page.getByRole("heading", { name: "Mes factures" }),
    ).toBeVisible();
  });

  test("US-XXX-6 – une facture créée apparaît dans la liste avec un message", async ({
    page,
  }) => {
    await expect(
      page.getByText("Vous n'avez pas encore de facture."),
    ).toBeVisible();

    await champ(page, "Client").fill("Atelier Dupont");
    await champ(page, "Montant (€)").fill("120,50");
    await page.getByRole("button", { name: "Créer la facture" }).click();

    await expect(page.getByText("Facture créée.")).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Atelier Dupont/ }),
    ).toContainText(/120,50\s€/);
  });

  test("US-XXX-5 – la recherche reste dans l'adresse après un rechargement", async ({
    page,
  }) => {
    await creerFacture(page, "Atelier Dupont", "120,50");
    await creerFacture(page, "Boulangerie Martin", "45");

    await champ(page, "Rechercher un client").fill("dupont");
    await expect(page).toHaveURL(/recherche=dupont/);
    await expect(
      page.getByRole("row", { name: /Boulangerie Martin/ }),
    ).toHaveCount(0);

    await page.reload();

    await expect(champ(page, "Rechercher un client")).toHaveValue("dupont");
    await expect(
      page.getByRole("row", { name: /Atelier Dupont/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("row", { name: /Boulangerie Martin/ }),
    ).toHaveCount(0);
  });
});
```

Commandes : `npm test` (unitaires et intégration), `npm run test:e2e` (bout en bout).

