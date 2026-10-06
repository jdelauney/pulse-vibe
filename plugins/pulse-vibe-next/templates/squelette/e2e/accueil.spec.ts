import { expect, test } from "@playwright/test";
import { projet } from "../src/lib/projet";

test("la page d'accueil affiche le nom du projet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(projet.nom);
});
