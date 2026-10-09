import { expect, test } from "@playwright/test";

// La route des erreurs du navigateur accepte seulement les envois du site lui-même.
test("une erreur envoyée par la page est acceptée ; un envoi d'ailleurs est refusé", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const statut = await page.evaluate(async () => {
    const r = await fetch("/api/erreur-client", {
      method: "POST",
      body: JSON.stringify({ message: "essai e2e", chemin: "/" }),
    });
    return r.status;
  });
  expect(statut).toBe(204);
  const ailleurs = await request.post("/api/erreur-client", {
    data: { message: "essai", chemin: "/" },
    headers: { origin: "https://autre-site.fr" },
  });
  expect(ailleurs.status()).toBe(403);
});
