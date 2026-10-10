
### Unitaires

Les tests du squelette couvrent `metadonneesDePage()`, `adresseDuSite()`, `reglesRobots()` et les fonctions de données structurées (`src/lib/seo/__tests__/*.test.ts`, `src/config/__tests__/`). Pour une page :

<!-- fichier: app/(public)/tarifs/__tests__/metadonnees.test.ts -->
```ts
// app/(public)/tarifs/__tests__/metadonnees.test.ts
import { describe, expect, it } from "vitest";
import { metadata } from "../page";

describe("Référencement des pages publiques", () => {
  it("US-XXX-1 – La page Tarifs a son titre, sa description et son adresse officielle", () => {
    expect(metadata.title).toBe("Tarifs");
    expect(metadata.alternates?.canonical).toBe("/tarifs");
    expect(metadata.openGraph).toMatchObject({ url: "/tarifs" });
  });
});
```

`vitest.config.ts` inclut déjà `app/**/*.test.ts` et `src/**/*.test.ts`.

### Intégration (PGlite)

Le repository est testé sur une base en mémoire (`creerBaseDeTest()`) : une réalisation publiée est trouvée avec sa date, un brouillon et un `slug` inconnu n'existent pas pour le public, la liste ne contient que les publiées, la plus récente d'abord.

<!-- fichier: src/db/realisations/__tests__/realisation.repository.test.ts -->
```ts
// src/db/realisations/__tests__/realisation.repository.test.ts
import type { Db } from "@src/db/db-client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { realisationRepository } from "../realisation.repository";
import { realisations } from "../realisation.table";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
  await db.insert(realisations).values([
    {
      slug: "table-en-chene",
      titre: "Table en chêne",
      resume: "Une table sur mesure.",
      publiee: true,
      misAJourLe: new Date("2026-03-01T10:00:00Z"),
    },
    {
      slug: "buffet-brouillon",
      titre: "Buffet",
      resume: "Pas encore publié.",
      publiee: false,
    },
    {
      slug: "etagere-noyer",
      titre: "Étagère en noyer",
      resume: "Une étagère murale.",
      publiee: true,
      misAJourLe: new Date("2026-05-01T10:00:00Z"),
    },
  ]);
});

afterEach(async () => {
  await fermer();
});

describe("realisationRepository", () => {
  it("US-XXX-4 – Une réalisation publiée est trouvée avec sa date de mise à jour", async () => {
    const realisation =
      await realisationRepository(db).trouverPubliee("table-en-chene");
    expect(realisation).toMatchObject({
      slug: "table-en-chene",
      titre: "Table en chêne",
      misAJourLe: new Date("2026-03-01T10:00:00Z"),
    });
  });

  it("US-XXX-4 – Un brouillon et un slug inconnu n'existent pas pour le public", async () => {
    const repository = realisationRepository(db);
    expect(await repository.trouverPubliee("buffet-brouillon")).toBeNull();
    expect(await repository.existePubliee("buffet-brouillon")).toBe(false);
    expect(await repository.existePubliee("inconnu")).toBe(false);
    expect(await repository.existePubliee("table-en-chene")).toBe(true);
  });

  it("US-XXX-4 – La liste ne contient que les publiées, les plus récentes d'abord", async () => {
    const liste = await realisationRepository(db).listerPubliees();
    expect(liste.map((r) => r.slug)).toEqual([
      "etagere-noyer",
      "table-en-chene",
    ]);
  });
});
```

### Bout en bout (Playwright)

`e2e/referencement.spec.ts` du squelette : robots.txt (200, ligne `Sitemap:` complète), sitemap.xml, adresse inconnue en 404, titre, adresse officielle et image de partage dans `<head>` de l'accueil.

`e2e/realisations.spec.ts` (étapes 5 et 6) prouve le vrai 404 d'un `slug` inconnu, avec le `User-Agent` de Googlebot aussi, et la date `lastmod` du sitemap. Prérequis : une base qui contient les migrations et **une réalisation publiée** (`publiee = true`) de slug `table-en-chene` (insertion SQL ou écran d'administration du projet ; changer `SLUG_PUBLIE` pour un autre slug), avec `DATABASE_URL` renseignée. Cette base est une base de test ou une branche Neon : jamais la production. Le test cible la version construite, celle que reçoivent les robots : `CI=1 npx playwright test e2e/realisations.spec.ts` construit le site, le démarre, puis lance les tests.

<!-- fichier: e2e/realisations.spec.ts -->
```ts
// e2e/realisations.spec.ts
import { expect, test } from "@playwright/test";

// Prérequis : la base de l'application (DATABASE_URL) contient une réalisation publiée
// (publiee = true) dont le slug est « table-en-chene », avec les migrations appliquées.
// À lancer sur la version construite : CI=1 npx playwright test e2e/realisations.spec.ts
const SLUG_PUBLIE = "table-en-chene";
const GOOGLEBOT = "Googlebot/2.1 (+http://www.google.com/bot.html)";

test.describe("Réalisations publiques", () => {
  test("US-XXX-5 – Une réalisation inconnue répond 404", async ({
    request,
  }) => {
    const reponse = await request.get("/realisations/slug-inconnu");

    expect(reponse.status()).toBe(404);
  });

  test("US-XXX-5 – Une réalisation inconnue répond 404 à Googlebot", async ({
    request,
  }) => {
    const reponse = await request.get("/realisations/slug-inconnu", {
      headers: { "user-agent": GOOGLEBOT },
    });

    expect(reponse.status()).toBe(404);
  });

  test("US-XXX-5 – Une réalisation publiée répond 200", async ({ request }) => {
    const reponse = await request.get(`/realisations/${SLUG_PUBLIE}`);

    expect(reponse.status()).toBe(200);
  });

  test("US-XXX-6 – Le sitemap donne la date de modification d'une réalisation publiée", async ({
    request,
  }) => {
    const reponse = await request.get("/sitemap.xml");

    expect(reponse.status()).toBe(200);
    // Dans le bloc <url> de la réalisation : avec les langues, des <xhtml:link> précèdent <lastmod>.
    expect(await reponse.text()).toMatch(
      new RegExp(
        String.raw`<url>(?:(?!</url>)[\s\S])*?/realisations/${SLUG_PUBLIE}</loc>(?:(?!</url>)[\s\S])*?<lastmod>\d{4}-\d{2}-\d{2}T`,
      ),
    );
  });
});
```

