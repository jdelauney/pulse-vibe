### 5. Le repository

Toute la lecture et l'écriture des factures en base. Chaque requête commence par la **condition de propriété** (`utilisateurId`) : une personne ne lit et n'écrit que ses propres factures. Le repository est une classe qui implémente le port du métier (`DrizzleFactureRepository implements FactureRepository`). La base arrive par le constructeur : `getDb()` dans l'application, PGlite dans les tests. `inserer`, utilisée par le use-case, renvoie l'entité `Facture` ; `lister`, qui sert seulement l'affichage, renvoie des objets simples (`FactureVue`).

<!-- fichier: src/db/factures/facture.repository.ts -->
```ts
// src/db/factures/facture.repository.ts
import "server-only";
import {
  Facture,
  type FactureVue,
  type StatutFacture,
  type TriFactures,
} from "@src/core/factures/facture.entity";
import type { FactureRepository } from "@src/core/factures/facture-repository.port";
import type { Db } from "@src/db/db-client";
import { decalagePourPage } from "@src/lib/helpers/pagination/pagination";
import { and, asc, desc, eq, ilike, type SQL } from "drizzle-orm";
import { factures } from "./facture.table";

export type FiltresListeFactures = {
  statut: StatutFacture | null;
  recherche: string;
  tri: TriFactures;
  page: number;
  taillePage: number;
};

// L'id termine chaque tri : deux factures de même date ou de même montant gardent leur page.
const ORDRE_PAR_TRI: Record<TriFactures, SQL[]> = {
  recentes: [desc(factures.creeLe), desc(factures.id)],
  anciennes: [asc(factures.creeLe), asc(factures.id)],
  "montant-desc": [
    desc(factures.montantCentimes),
    desc(factures.creeLe),
    desc(factures.id),
  ],
  "montant-asc": [
    asc(factures.montantCentimes),
    desc(factures.creeLe),
    desc(factures.id),
  ],
};

/** Rend %, _ et \ ordinaires dans un motif ILIKE : la recherche « 100% » cherche le texte « 100% ». */
function echapperMotifLike(texte: string): string {
  return texte.replace(/[\\%_]/g, "\\$&");
}

/** Le stockage des factures dans Postgres (Drizzle) : implémente le port du métier. */
export class DrizzleFactureRepository implements FactureRepository {
  constructor(private readonly db: Db) {}

  async lister(
    utilisateurId: string,
    filtres: FiltresListeFactures,
  ): Promise<{ factures: FactureVue[]; total: number }> {
    const conditions: SQL[] = [eq(factures.utilisateurId, utilisateurId)];
    if (filtres.statut) {
      conditions.push(eq(factures.statut, filtres.statut));
    }
    const recherche = filtres.recherche.trim();
    if (recherche !== "") {
      conditions.push(
        ilike(factures.client, `%${echapperMotifLike(recherche)}%`),
      );
    }
    const filtre = and(...conditions);

    const [lignes, total] = await Promise.all([
      this.db
        .select()
        .from(factures)
        .where(filtre)
        .orderBy(...ORDRE_PAR_TRI[filtres.tri])
        .limit(filtres.taillePage)
        .offset(decalagePourPage(filtres.page, filtres.taillePage)),
      this.db.$count(factures, filtre),
    ]);
    return { factures: lignes, total };
  }

  async inserer(
    utilisateurId: string,
    donnees: { client: string; montantCentimes: number },
  ): Promise<Facture> {
    const [ligne] = await this.db
      .insert(factures)
      .values({ utilisateurId, ...donnees })
      .returning();
    if (!ligne) throw new Error("La base n'a pas renvoyé la facture créée.");
    return new Facture(ligne);
  }
}
```

La classe déclare `implements FactureRepository` : TypeScript vérifie qu'elle tient toutes les promesses du port.

