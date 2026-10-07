import { describe, expect, test } from "vitest";
import { projet } from "@src/config/projet";
import { imageDePartage, metadonneesDePage } from "../seo";
import { adresseDuSite } from "@src/config/site";

describe("Métadonnées d'une page publique", () => {
  test("une page a son titre, sa description, son adresse officielle et une carte de partage complète", () => {
    const m = metadonneesDePage({
      titre: "Tarifs",
      description: "Nos tarifs, sans surprise.",
      chemin: "/tarifs",
    });
    expect(m.title).toBe("Tarifs");
    expect(m.description).toBe("Nos tarifs, sans surprise.");
    expect(m.alternates?.canonical).toBe("/tarifs");
    expect(m.openGraph).toMatchObject({
      siteName: projet.nom,
      locale: "fr_FR",
      type: "website",
      title: `Tarifs | ${projet.nom}`,
      url: "/tarifs",
      images: [imageDePartage],
    });
  });

  test("l'accueil garde son titre tel quel", () => {
    const m = metadonneesDePage({
      titre: "Menuiserie Dupont – meubles sur mesure",
      description: "d",
      chemin: "/",
      accueil: true,
    });
    expect(m.title).toEqual({
      absolute: "Menuiserie Dupont – meubles sur mesure",
    });
  });

  test("une image propre à la page remplace celle du site", () => {
    const image = {
      url: "/tarifs.png",
      width: 1200,
      height: 630,
      alt: "Tarifs",
    };
    const m = metadonneesDePage({
      titre: "T",
      description: "d",
      chemin: "/t",
      image,
    });
    expect(m.openGraph?.images).toEqual([image]);
  });
});

describe("Adresse du site", () => {
  test("SITE_URL d'abord, sans barre finale", () => {
    expect(
      adresseDuSite({
        SITE_URL: "https://www.mon-site.fr/",
        VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app",
      }),
    ).toBe("https://www.mon-site.fr");
  });

  test("sinon le domaine de production de Vercel, puis localhost", () => {
    expect(
      adresseDuSite({ VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" }),
    ).toBe("https://x.vercel.app");
    expect(adresseDuSite({ SITE_URL: "" })).toBe("http://localhost:3000");
  });

  test("une adresse mal écrite arrête tout avec un message clair", () => {
    expect(() => adresseDuSite({ SITE_URL: "mon-site.fr" })).toThrow(
      /SITE_URL invalide/,
    );
  });
});
