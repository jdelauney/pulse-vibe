
### Unitaires

```ts
// src/lib/i18n/__tests__/chemins.test.ts
import { describe, expect, it } from "vitest";
import { cheminDansLaLangue, separerLangue } from "../chemins";

describe("Langues", () => {
  describe("La langue se lit dans le début de l'adresse", () => {
    it("US-XXX-1 – Une adresse donne sa langue et sa page : /en/compte", () => {
      expect(separerLangue("/en/compte")).toEqual({
        langue: "en",
        chemin: "/compte",
      });
    });

    it("US-XXX-1 – Une adresse donne sa langue et sa page : /compte", () => {
      expect(separerLangue("/compte")).toEqual({
        langue: "fr",
        chemin: "/compte",
      });
    });
  });

  describe("La page de connexion garde la langue de la personne", () => {
    it("US-XXX-3 – La page de connexion se trouve dans la langue courante : en", () => {
      expect(cheminDansLaLangue("en", "/connexion")).toBe("/en/connexion");
    });

    it("US-XXX-3 – La page de connexion se trouve dans la langue courante : fr", () => {
      expect(cheminDansLaLangue("fr", "/connexion")).toBe("/connexion");
    });

    it("US-XXX-3 – L'accueil anglais est « /en », sans barre finale", () => {
      expect(cheminDansLaLangue("en", "/")).toBe("/en");
      expect(separerLangue("/en")).toEqual({ langue: "en", chemin: "/" });
    });
  });
});
```

```ts
// src/lib/i18n/__tests__/referencement.test.ts
import { describe, expect, it } from "vitest";
import { adresseDansLaLangue, versionsDeLangue } from "../referencement";

describe("Référencement des langues", () => {
  describe("Chaque page déclare ses versions de langue", () => {
    it("US-XXX-4 – Une page déclare toutes ses versions, x-default comprise", () => {
      expect(versionsDeLangue("/tarifs")).toEqual({
        fr: "/tarifs",
        en: "/en/tarifs",
        "x-default": "/tarifs",
      });
    });

    it("US-XXX-4 – Une page a son adresse officielle dans la langue de la requête", () => {
      expect(adresseDansLaLangue("en", "/tarifs")).toBe("/en/tarifs");
      expect(adresseDansLaLangue("fr", "/tarifs")).toBe("/tarifs");
    });

    it("US-XXX-4 – Une langue inconnue prend la langue par défaut", () => {
      expect(adresseDansLaLangue("xx", "/tarifs")).toBe("/tarifs");
    });
  });
});
```

### Bout en bout (Playwright)

```ts
// e2e/langues.spec.ts
import { expect, test } from "@playwright/test";

test.describe("Langues", () => {
  test("US-XXX-2 – Une visiteuse francophone voit le site en français", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  });

  test("US-XXX-2 – Camille passe en anglais depuis le sélecteur de langue", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "English" }).click();

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("US-XXX-3 – Sans session, la page compte anglaise mène à la connexion anglaise", async ({
    page,
  }) => {
    await page.goto("/en/compte");

    await expect(page).toHaveURL(/\/en\/connexion$/);
  });
});
```

