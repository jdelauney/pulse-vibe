### 5. Le repository

Chaque requête commence par la **condition de propriété** (`utilisateurId`, venu de la session). `trouverEnvoye` et `listerEnvoyes` ignorent les lignes `en_attente`. La base arrive en paramètre : `getDb()` dans l'application, PGlite dans les tests. `satisfies FichierRepository` fait vérifier par TypeScript que le repository remplit le port des use-cases, sans cacher ses lectures propres à l'écran (`listerEnvoyes`, `trouverEnvoye`).

<!-- fichier: src/db/fichiers/fichier.repository.ts -->
```ts
// src/db/fichiers/fichier.repository.ts
import "server-only";
import type { Fichier, TypeAutorise } from "@src/core/fichiers/fichier.entity";
import type { FichierRepository } from "@src/core/fichiers/fichier-repository.port";
import type { Db } from "@src/db/db-client";
import { and, desc, eq } from "drizzle-orm";
import { fichiers } from "./fichier.table";

export function fichierRepository(db: Db) {
  // Chaque requête commence par la condition de propriété : une personne ne touche que ses fichiers.
  const proprietaire = (id: string, utilisateurId: string) =>
    and(eq(fichiers.id, id), eq(fichiers.utilisateurId, utilisateurId));

  const repository = {
    async reserver(donnees: {
      id: string;
      utilisateurId: string;
      cle: string;
      nom: string;
      typeMime: TypeAutorise;
      taille: number;
    }): Promise<void> {
      await db.insert(fichiers).values(donnees);
    },

    async trouver(id: string, utilisateurId: string): Promise<Fichier | null> {
      const [ligne] = await db
        .select()
        .from(fichiers)
        .where(proprietaire(id, utilisateurId));
      return ligne ?? null;
    },

    async marquerEnvoye(id: string, utilisateurId: string): Promise<void> {
      await db
        .update(fichiers)
        .set({ statut: "envoye" })
        .where(proprietaire(id, utilisateurId));
    },

    async supprimer(
      id: string,
      utilisateurId: string,
    ): Promise<{ cle: string } | null> {
      const [ligne] = await db
        .delete(fichiers)
        .where(proprietaire(id, utilisateurId))
        .returning({ cle: fichiers.cle });
      return ligne ?? null;
    },

    /** Les fichiers dont l'envoi est vérifié, du plus récent au plus ancien. */
    async listerEnvoyes(utilisateurId: string) {
      return db
        .select({
          id: fichiers.id,
          nom: fichiers.nom,
          taille: fichiers.taille,
          creeLe: fichiers.creeLe,
        })
        .from(fichiers)
        .where(
          and(
            eq(fichiers.utilisateurId, utilisateurId),
            eq(fichiers.statut, "envoye"),
          ),
        )
        .orderBy(desc(fichiers.creeLe), desc(fichiers.id));
    },

    /** Un fichier dont l'envoi est vérifié ; un envoi en attente reste invisible. */
    async trouverEnvoye(id: string, utilisateurId: string) {
      const [ligne] = await db
        .select({ cle: fichiers.cle, nom: fichiers.nom })
        .from(fichiers)
        .where(
          and(proprietaire(id, utilisateurId), eq(fichiers.statut, "envoye")),
        );
      return ligne ?? null;
    },
  };

  // Le repository remplit le port des use-cases ; TypeScript le vérifie ici, sans perdre les lectures propres à l'écran.
  return repository satisfies FichierRepository;
}
```

