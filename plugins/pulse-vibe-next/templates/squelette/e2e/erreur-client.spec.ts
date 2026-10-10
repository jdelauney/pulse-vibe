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

test("une erreur dans la page est affichée puis signalée au serveur", async ({
  page,
}) => {
  // Seulement sur la construction de production (CI) : avec npm run dev, rien n'est envoyé.
  test.skip(!process.env.CI, "npm run dev affiche l'erreur sans l'envoyer");
  await page.goto("/essai-surveillance");
  const envoi = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/erreur-client"),
  );
  await page
    .getByRole("button", { name: "Déclencher une erreur d'essai" })
    .click();
  const requete = await envoi;
  expect(JSON.parse(requete.postData() ?? "{}")).toEqual({
    message: "Erreur d'essai de la surveillance",
    chemin: "/essai-surveillance",
  });
  await expect(
    page.getByRole("heading", { name: "Un problème est survenu" }),
  ).toBeVisible();
});
