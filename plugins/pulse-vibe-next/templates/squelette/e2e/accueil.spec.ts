import { expect, test } from "@playwright/test";
import { projet } from "../src/config/projet";

test("la page d'accueil affiche le nom du projet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(projet.nom);
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
