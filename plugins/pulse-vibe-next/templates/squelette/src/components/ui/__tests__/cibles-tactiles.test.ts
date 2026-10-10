import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "../button";
import { Input } from "../input";

// Règle Pulse : cibles tactiles de 44 × 44 px au moins sur téléphone (classes sans préfixe d'écran ;
// md: et au-delà, la souris permet des tailles compactes). Un `npx shadcn add button` qui réécrit
// le composant remet 32 px : ce test le signale.
const TAILLES = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const;

/** Hauteur et largeur en px sur téléphone, lues dans les classes Tailwind (h-11 → 44, min-w-11 → 44). */
function tailleTelephone(classes: string) {
  const jetons = classes.split(/\s+/).filter((j) => !j.includes(":"));
  const px = (prefixe: string) => {
    const jeton = jetons.find((j) => j.startsWith(prefixe));
    return jeton ? Number(jeton.slice(prefixe.length)) * 4 : undefined;
  };
  const carre = px("size-");
  return { hauteur: carre ?? px("h-"), largeur: carre ?? px("min-w-") };
}

describe("Cibles tactiles", () => {
  it.each(TAILLES)("bouton %s : 44 px au moins sur téléphone", (size) => {
    const { hauteur, largeur } = tailleTelephone(buttonVariants({ size }));
    expect(hauteur).toBeGreaterThanOrEqual(44);
    // Les petites tailles, souvent un mot court (« OK »), reçoivent aussi une largeur minimale.
    if (size.startsWith("icon") || size === "xs" || size === "sm")
      expect(largeur).toBeGreaterThanOrEqual(44);
  });

  it("champ de saisie : 44 px de haut", () => {
    const html = renderToStaticMarkup(createElement(Input));
    const classes = /class="([^"]+)"/.exec(html)?.[1] ?? "";
    expect(tailleTelephone(classes).hauteur).toBeGreaterThanOrEqual(44);
  });
});
