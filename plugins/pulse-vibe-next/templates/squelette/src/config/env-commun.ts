// Ce que t3 env donne pour chaque variable refusée : son chemin (le nom de la variable).
type Probleme = {
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
};

// Réglages communs à env.ts (serveur) et env-public.ts (navigateur).
export const optionsCommunes = {
  // Une ligne « NOM= » vide compte comme une variable absente.
  emptyStringAsUndefined: true,
  // La construction de vérification (CI, vérificateur du pack) se fait sans variables.
  // Sur Vercel, la validation s'applique toujours, même si SKIP_ENV_VALIDATION y est saisie.
  skipValidation:
    Boolean(process.env.SKIP_ENV_VALIDATION) && !process.env.VERCEL,
  onValidationError: (problemes: readonly Probleme[]): never => {
    const noms = problemes
      .map((p) =>
        (p.path ?? [])
          .map((s) => (typeof s === "object" ? String(s.key) : String(s)))
          .join("."),
      )
      .join(", ");
    throw new Error(
      `Variables d'environnement invalides ou manquantes : ${noms}`,
    );
  },
};
