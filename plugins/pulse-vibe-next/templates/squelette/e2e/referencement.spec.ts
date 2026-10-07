import { expect, test } from "@playwright/test";
import { projet } from "../src/lib/projet";

test.describe("Référencement", () => {
  test("robots.txt répond et cite le sitemap par son adresse complète", async ({
    request,
  }) => {
    const reponse = await request.get("/robots.txt");
    expect(reponse.status()).toBe(200);
    expect(await reponse.text()).toMatch(
      /^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m,
    );
  });

  test("sitemap.xml répond avec les pages publiques", async ({ request }) => {
    const reponse = await request.get("/sitemap.xml");
    expect(reponse.status()).toBe(200);
    const xml = await reponse.text();
    expect(xml).toContain("<urlset");
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/);
  });

  test("une adresse inconnue répond 404", async ({ request }) => {
    const reponse = await request.get("/adresse-qui-n-existe-pas");
    expect(reponse.status()).toBe(404);
  });

  test("l'accueil a son titre, son adresse officielle et son image de partage dans <head>", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(projet.nom);
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      /^https?:\/\//,
    );
    await expect(
      page.locator('head meta[property="og:image"]'),
    ).toHaveAttribute("content", /^https?:\/\//);
  });
});
