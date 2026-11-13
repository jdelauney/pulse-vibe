### 5. Le repository

`DrizzleFichierRepository` est une classe qui implémente le port des use-cases (patron Repository) : la base arrive par le constructeur (`getDb()` dans l'application, PGlite dans les tests). Chaque requête commence par la **condition de propriété** (`utilisateurId`, venu de la session). `trouver` renvoie l'entité `Fichier`, car un use-case s'en sert. `listerEnvoyes` et `trouverEnvoye` servent seulement l'affichage : ils renvoient des objets simples et ignorent les lignes `en_attente`.

<!-- fichier: src/db/fichiers/fichier.repository.ts -->
```ts
// src/db/fichiers/fichier.repository.ts
import "server-only";
import { Fichier, type TypeAutorise } from "@src/core/fichiers/fichier.entity";
import type { FichierRepository } from "@src/core/fichiers/fichier-repository.port";
import type { Db } from "@src/db/db-client";
import { and, desc, eq } from "drizzle-orm";
import { fichiers } from "./fichier.table";

/** Le stockage des fichiers dans Postgres (Drizzle) : implémente le port du métier. */
export class DrizzleFichierRepository implements FichierRepository {
  constructor(private readonly db: Db) {}

  async reserver(donnees: {
    id: string;
    utilisateurId: string;
    cle: string;
    nom: string;
    typeMime: TypeAutorise;
    taille: number;
  }): Promise<void> {
    await this.db.insert(fichiers).values(donnees);
  }

  async trouver(id: string, utilisateurId: string): Promise<Fichier | null> {
    const [ligne] = await this.db
      .select()
      .from(fichiers)
      .where(this.proprietaire(id, utilisateurId));
    return ligne ? new Fichier(ligne) : null;
  }

  async marquerEnvoye(id: string, utilisateurId: string): Promise<void> {
    await this.db
      .update(fichiers)
      .set({ statut: "envoye" })
      .where(this.proprietaire(id, utilisateurId));
  }

  async supprimer(
    id: string,
    utilisateurId: string,
  ): Promise<{ cle: string } | null> {
    const [ligne] = await this.db
      .delete(fichiers)
      .where(this.proprietaire(id, utilisateurId))
      .returning({ cle: fichiers.cle });
    return ligne ?? null;
  }

  /** Les fichiers dont l'envoi est vérifié, du plus récent au plus ancien. */
  async listerEnvoyes(utilisateurId: string) {
    return this.db
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
  }

  /** Un fichier dont l'envoi est vérifié ; un envoi en attente reste invisible. */
  async trouverEnvoye(id: string, utilisateurId: string) {
    const [ligne] = await this.db
      .select({ cle: fichiers.cle, nom: fichiers.nom })
      .from(fichiers)
      .where(
        and(
          this.proprietaire(id, utilisateurId),
          eq(fichiers.statut, "envoye"),
        ),
      );
    return ligne ?? null;
  }

  // Chaque requête commence par la condition de propriété : une personne ne touche que ses fichiers.
  private proprietaire(id: string, utilisateurId: string) {
    return and(eq(fichiers.id, id), eq(fichiers.utilisateurId, utilisateurId));
  }
}
```
