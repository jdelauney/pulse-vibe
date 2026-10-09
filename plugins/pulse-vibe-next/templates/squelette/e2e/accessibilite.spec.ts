import { test } from "@playwright/test";
import { verifierAccessibilite } from "./aides/accessibilite";

// Chaque page publique du squelette. Une nouvelle page ajoute son test ici ou dans son propre
// fichier e2e (consignes de test du pack).
for (const chemin of [
  "/",
  "/essai-surveillance",
  "/adresse-qui-n-existe-pas",
]) {
  test(`${chemin} : WCAG 2.2 AA (axe) et cibles assez grandes`, async ({
    page,
  }, testInfo) => {
    await page.goto(chemin);
    await verifierAccessibilite(page, testInfo);
  });
}
