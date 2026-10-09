### 1. Le contrat des limiteurs

Trois limiteurs savent compter : la base (par défaut), Redis (option) et la mémoire (tests). Ils suivent le même contrat, placé dans `src/core/shared/` : la garde de l'étape 6 les utilise sans savoir lequel est choisi.

```ts
// src/core/shared/limiteur.port.ts
// Contrat commun des limiteurs de requêtes : base (Neon), Redis (Upstash) ou mémoire.

export type RegleLimite = { nombre: number; fenetreMs: number };

/** `reset` : instant (en millisecondes) où la fenêtre se termine. */
export type ResultatLimite = { accepte: boolean; reset: number };

export interface Limiteur {
  /** Compte une tentative pour `cle` et dit si elle reste dans la règle. */
  verifier(
    cle: string,
    regle: RegleLimite,
    maintenant: number,
  ): Promise<ResultatLimite>;
}
```

