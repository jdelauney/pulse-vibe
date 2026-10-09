### 3. Les aides techniques génériques

Pagination, affichage des montants et des dates, erreurs de formulaire : rien de propre aux factures. Elles vont dans `src/lib/helpers/<catégorie>/` et servent à toutes les listes du projet.

<!-- fichier: src/lib/helpers/pagination/pagination.ts -->
```ts
// src/lib/helpers/pagination/pagination.ts
/** Une page reçue dans l'adresse : entier à partir de 1, sinon 1. */
export function pageValide(page: number): number {
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function decalagePourPage(page: number, taillePage: number): number {
  return (pageValide(page) - 1) * taillePage;
}

export function nombreDePages(total: number, taillePage: number): number {
  return Math.max(1, Math.ceil(total / taillePage));
}
```

<!-- fichier: src/lib/helpers/format/format.ts -->
```ts
// src/lib/helpers/format/format.ts
const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formaterMontant(centimes: number): string {
  return formatEuros.format(centimes / 100);
}

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Europe/Paris",
});

/** Affiche une date à l'heure de Paris, quel que soit le fuseau du serveur. */
export function formaterDate(date: Date): string {
  return formatDate.format(date);
}
```

<!-- fichier: src/lib/helpers/formulaire/erreurs-de-champs.ts -->
```ts
// src/lib/helpers/formulaire/erreurs-de-champs.ts
type ErreursFormatees<C extends string> = Partial<
  Record<C, { _errors?: string[] }>
>;

/** Transforme les erreurs de validation de next-safe-action (forme formatée) en erreurs de champ pour TanStack Form. */
export function erreursDeChamps<C extends string>(
  champs: readonly C[],
  erreurs: ErreursFormatees<C>,
): Partial<Record<C, { message: string }>> {
  const resultat: Partial<Record<C, { message: string }>> = {};
  for (const champ of champs) {
    const message = erreurs[champ]?._errors?.[0];
    if (message) resultat[champ] = { message };
  }
  return resultat;
}
```

