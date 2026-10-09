import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { projet } from "../src/config/projet";

// Règles WCAG 2.2 niveaux A et AA (étiquettes d'axe-core) : https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#axe-core-tags
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test("la page d'accueil affiche le nom du projet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(projet.nom);
});

test("la page d'accueil respecte WCAG 2.2 AA (axe)", async ({ page }) => {
  await page.goto("/");
  const resultat = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  expect(resultat.violations).toEqual([]);
});

test("le lien d'évitement est le premier arrêt au clavier et mène au contenu", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const lien = page.getByRole("link", { name: "Aller au contenu" });
  await expect(lien).toBeFocused();
  await lien.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
});
