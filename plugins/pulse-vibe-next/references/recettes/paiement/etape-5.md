### 5. Le repository

`DrizzleCommandeRepository` implémente le port `CommandeRepository`. Chaque requête qui touche la commande d'une personne commence par la **condition de propriété** (`utilisateurId`, venu de la session). La base arrive par le constructeur : `getDb()` dans l'application, PGlite dans les tests. La méthode qu'un use-case appelle (`creer`) renvoie l'entité `Commande` ; la lecture qui sert seulement l'écran (`trouverParSession`) renvoie des données simples (`CommandeAffichee`).

<!-- fichier: src/db/paiement/commande.repository.ts -->
```ts
// src/db/paiement/commande.repository.ts
import "server-only";
import {
  Commande,
  type CommandeAffichee,
  type Offre,
  type ResultatConfirmation,
} from "@src/core/paiement/commande.entity";
import type { CommandeRepository } from "@src/core/paiement/commande-repository.port";
import type { Db } from "@src/db/db-client";
import { and, eq } from "drizzle-orm";
import { commande } from "./commande.table";
import { evenementStripe } from "./evenement-stripe.table";

/** Le stockage des commandes dans Postgres (Drizzle) : implémente le port du métier. */
export class DrizzleCommandeRepository implements CommandeRepository {
  constructor(private readonly db: Db) {}

  async creer(donnees: {
    utilisateurId: string;
    offre: Offre;
  }): Promise<Commande> {
    const [ligne] = await this.db
      .insert(commande)
      .values({
        utilisateurId: donnees.utilisateurId,
        libelle: donnees.offre.libelle,
        montantCentimes: donnees.offre.montantCentimes,
        devise: donnees.offre.devise,
      })
      .returning();
    return new Commande({
      id: ligne.id,
      utilisateurId: ligne.utilisateurId,
      libelle: ligne.libelle,
      montantCentimes: ligne.montantCentimes,
      devise: ligne.devise,
      statut: ligne.statut,
    });
  }

  async attacherSession(
    id: string,
    utilisateurId: string,
    sessionId: string,
  ): Promise<void> {
    await this.db
      .update(commande)
      .set({ stripeSessionId: sessionId })
      .where(
        and(eq(commande.id, id), eq(commande.utilisateurId, utilisateurId)),
      );
  }

  // Un seul bloc : l'événement est noté et la commande mise à jour, ou rien du tout.
  async enregistrerConfirmation(confirmation: {
    evenementId: string;
    type: string;
    commandeId: string;
    montantCentimes: number;
  }): Promise<ResultatConfirmation> {
    return this.db.transaction(async (tx) => {
      const nouveau = await tx
        .insert(evenementStripe)
        .values({ id: confirmation.evenementId, type: confirmation.type })
        .onConflictDoNothing()
        .returning({ id: evenementStripe.id });
      if (nouveau.length === 0) {
        return "deja_traite";
      }
      // Seule une commande « en_attente », au montant payé, passe « payee ».
      const misesAJour = await tx
        .update(commande)
        .set({ statut: "payee", payeeLe: new Date() })
        .where(
          and(
            eq(commande.id, confirmation.commandeId),
            eq(commande.statut, "en_attente"),
            eq(commande.montantCentimes, confirmation.montantCentimes),
          ),
        )
        .returning({ id: commande.id });
      return misesAJour.length > 0 ? "payee" : "ignore";
    });
  }

  /** La commande de cette personne pour cette session de paiement, ou null. */
  async trouverParSession(
    sessionId: string,
    utilisateurId: string,
  ): Promise<CommandeAffichee | null> {
    const [ligne] = await this.db
      .select({
        libelle: commande.libelle,
        statut: commande.statut,
        montantCentimes: commande.montantCentimes,
      })
      .from(commande)
      .where(
        and(
          eq(commande.stripeSessionId, sessionId),
          eq(commande.utilisateurId, utilisateurId),
        ),
      );
    return ligne ?? null;
  }
}
```
