import { describe, expect, test } from "vitest";
import {
  commerceLocal,
  filDAriane,
  organisation,
  siteWeb,
} from "./donnees-structurees";

describe("Données structurées", () => {
  test("le site : nom et adresse, contexte schema.org", () => {
    expect(
      siteWeb({ nom: "Menuiserie Dupont", adresse: "https://www.exemple.fr" }),
    ).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Menuiserie Dupont",
      url: "https://www.exemple.fr",
    });
  });

  test("l'organisation porte son logo", () => {
    expect(
      organisation({
        nom: "Menuiserie Dupont",
        adresse: "https://www.exemple.fr",
        logo: "https://www.exemple.fr/logo.png",
      }),
    ).toMatchObject({ logo: "https://www.exemple.fr/logo.png" });
  });

  test("le commerce local porte une adresse postale complète", () => {
    expect(
      commerceLocal({
        nom: "Menuiserie Dupont",
        adresse: "https://www.exemple.fr",
        rue: "Rue du Bois 1",
        codePostal: "1000",
        ville: "Lausanne",
        pays: "CH",
      }),
    ).toMatchObject({
      address: {
        "@type": "PostalAddress",
        streetAddress: "Rue du Bois 1",
        postalCode: "1000",
        addressLocality: "Lausanne",
        addressCountry: "CH",
      },
    });
  });

  test("le fil d'Ariane numérote ses étapes à partir de 1", () => {
    const fil = filDAriane([
      { nom: "Accueil", adresse: "https://www.exemple.fr" },
      { nom: "Tarifs", adresse: "https://www.exemple.fr/tarifs" },
    ]);
    expect(fil.itemListElement).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://www.exemple.fr",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tarifs",
        item: "https://www.exemple.fr/tarifs",
      },
    ]);
  });

  test("les caractères < sont échappés à l'affichage", () => {
    const texte = JSON.stringify(
      siteWeb({ nom: "</script><b>", adresse: "https://x.fr" }),
    ).replace(/</g, "\\u003c");
    expect(texte).not.toContain("<");
  });
});
