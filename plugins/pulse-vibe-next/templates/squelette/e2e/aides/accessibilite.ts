import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

// Règles WCAG 2.2 niveaux A et AA (étiquettes d'axe-core) : https://github.com/dequelabs/axe-core/blob/develop/doc/API.md#axe-core-tags
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// Cibles mesurées : boutons (y compris un lien affiché en bouton, data-slot="button") et champs.
// Les liens dans le texte en sont exemptés (WCAG 2.5.8), comme les cases à cocher et boutons radio,
// dont le libellé agrandit la cible.
const CIBLES =
  'button, [role="button"], a[data-slot="button"], select, textarea, input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])';

// Outils de développement de Next (bouton « N » en bas de l'écran avec npm run dev) : hors de l'application.
const OUTILS_NEXT = "nextjs-portal";

/** Pulse vise 44 × 44 px sur téléphone (cibles tactiles) ; WCAG 2.2 AA demande 24 px. */
export function tailleMinimale(projet: string): number {
  return projet === "telephone" ? 44 : 24;
}

/**
 * Vérifie la page affichée, dans son état principal (formulaire affiché, liste chargée) :
 * aucune violation WCAG 2.2 AA (axe), et des boutons et champs assez grands pour le doigt.
 */
export async function verifierAccessibilite(page: Page, testInfo: TestInfo) {
  const resultat = await new AxeBuilder({ page })
    .withTags(WCAG_AA)
    .exclude(OUTILS_NEXT)
    .analyze();
  expect(resultat.violations).toEqual([]);
  const minimum = tailleMinimale(testInfo.project.name);
  const tropPetites: string[] = [];
  for (const cible of await page
    .locator(CIBLES)
    .filter({ visible: true })
    .all()) {
    const boite = await cible.boundingBox();
    // 1 px ou moins : élément masqué visuellement (sr-only), hors de portée du doigt.
    if (!boite || boite.width <= 1 || boite.height <= 1) continue;
    if (await cible.evaluate(dansLesOutilsDeNext, OUTILS_NEXT)) continue;
    if (boite.width < minimum || boite.height < minimum) {
      const balise = await cible.evaluate((e) => e.outerHTML.slice(0, 80));
      tropPetites.push(
        `${balise} : ${Math.round(boite.width)} × ${Math.round(boite.height)} px`,
      );
    }
  }
  expect(tropPetites, `cibles de moins de ${minimum} px`).toEqual([]);
}

/** Vrai pour un élément des outils de Next, même placé dans leur shadow DOM. */
function dansLesOutilsDeNext(element: Element, portail: string) {
  let noeud: Node | null = element;
  while (noeud) {
    if (
      noeud instanceof Element &&
      (noeud.localName === portail || noeud.hasAttribute("data-next-mark"))
    )
      return true;
    noeud =
      noeud.parentNode ?? (noeud instanceof ShadowRoot ? noeud.host : null);
  }
  return false;
}
