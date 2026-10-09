### 2. Les noms des champs

Partagés par le navigateur et le serveur.

```ts
// src/lib/helpers/formulaire-public/champs.ts
// Noms des champs de protection d'un formulaire public, communs au navigateur et au serveur.

// Le nom du champ piège n'évoque aucun champ que le navigateur remplit tout seul (nom, société, adresse…).
export const CHAMP_PIEGE = "champ_verification";
export const CHAMP_JETON = "jeton_formulaire";
export const CHAMP_TURNSTILE = "cf-turnstile-response";

/** Nom d'un formulaire : lettres minuscules, chiffres et tirets (il entre dans le jeton). */
export const NOM_FORMULAIRE = /^[a-z0-9-]{1,40}$/;

/** Vrai si le champ piège, invisible pour une personne, contient quelque chose. */
export function estPiegeRempli(entree: unknown): boolean {
  if (typeof entree !== "object" || entree === null) return false;
  const valeur = (entree as Record<string, unknown>)[CHAMP_PIEGE];
  if (valeur === undefined || valeur === null) return false;
  return typeof valeur !== "string" || valeur.trim() !== "";
}
```

