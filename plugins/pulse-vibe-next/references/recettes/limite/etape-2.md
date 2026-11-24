### 2. Les fonctions pures et le limiteur en mémoire

Les fonctions pures (lire l'adresse, écrire le message, l'empreinte courte d'un identifiant pour le journal) restent des fonctions : sans état ni règle métier, elles vivent dans `src/lib/helpers/limite/`. Le limiteur en mémoire est une classe qui garde ses compteurs ; elle sert aux tests et au développement local.

<!-- fichier: src/lib/helpers/limite/ip-et-message.ts -->
```ts
// src/lib/helpers/limite/ip-et-message.ts
// Fonctions pures de la limite de requêtes, testées en unitaire.
import { createHash } from "node:crypto";

// L'adresse du visiteur est celle qu'ajoute à x-forwarded-for le premier proxy de confiance, compté depuis la fin :
// les adresses écrites avant lui viennent du navigateur et peuvent être fausses. Vercel, Caddy et le proxy d'un
// fournisseur écrivent chacun l'adresse qu'ils voient : un proxy (PROXYS_DE_CONFIANCE=1, par défaut).
export function ipDepuis(entetes: Headers, proxysDeConfiance = 1): string {
  const adresses = (entetes.get("x-forwarded-for") ?? "")
    .split(",")
    .map((adresse) => adresse.trim())
    .filter(Boolean);
  const retenue = adresses[Math.max(0, adresses.length - proxysDeConfiance)];
  return retenue || entetes.get("x-real-ip") || "inconnue";
}

export function messageLimite(reset: number, maintenant: number): string {
  const minutes = Math.max(1, Math.ceil((reset - maintenant) / 60_000));
  return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}

/** Empreinte courte d'un identifiant (adresse IP, compte) pour le journal : relie les refus d'une même source sans l'écrire en clair. */
export function empreinteCourte(identifiant: string): string {
  return createHash("sha256").update(identifiant).digest("hex").slice(0, 12);
}
```

<!-- fichier: src/lib/helpers/limite/limiteur-memoire.ts -->
```ts
// src/lib/helpers/limite/limiteur-memoire.ts
// Limiteur en mémoire, pour les tests et le développement local. Sur Vercel, chaque instance
// garde ses propres compteurs : en ligne, utilisez la base (par défaut) ou Redis.
import type {
  Limiteur,
  RegleLimite,
  ResultatLimite,
} from "@src/core/shared/limiteur.port";

const TAILLE_AVANT_MENAGE = 10_000;

/** Limiteur qui compte dans la mémoire de l'instance (patron Strategy : une façon de compter parmi trois). */
export class LimiteurMemoire implements Limiteur {
  private readonly compteurs = new Map<
    string,
    { compte: number; debut: number }
  >();

  async verifier(
    cle: string,
    { nombre, fenetreMs }: RegleLimite,
    maintenant: number,
  ): Promise<ResultatLimite> {
    if (this.compteurs.size > TAILLE_AVANT_MENAGE) {
      this.effacerEcoules(maintenant - fenetreMs);
    }
    const actuel = this.compteurs.get(cle);
    const suivant =
      !actuel || actuel.debut <= maintenant - fenetreMs
        ? { compte: 1, debut: maintenant }
        : { compte: actuel.compte + 1, debut: actuel.debut };
    this.compteurs.set(cle, suivant);
    return {
      accepte: suivant.compte <= nombre,
      reset: suivant.debut + fenetreMs,
    };
  }

  private effacerEcoules(finDeFenetrePrecedente: number): void {
    for (const [cle, valeur] of this.compteurs) {
      if (valeur.debut <= finDeFenetrePrecedente) this.compteurs.delete(cle);
    }
  }
}
```

