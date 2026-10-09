### 5. Le repository

Chaque requête qui touche la commande d'une personne commence par la **condition de propriété** (`utilisateurId`, venu de la session). La base arrive en paramètre : `getDb()` dans l'application, PGlite dans les tests.

<!-- fichier: src/db/paiement/commande.repository.ts -->
```ts
// src/db/paiement/commande.repository.ts
import "server-only";
import type {
  Offre,
  ResultatConfirmation,
} from "@src/core/paiement/commande.entity";
import type { Db } from "@src/db/db-client";
import { and, eq } from "drizzle-orm";
import { commande } from "./commande.table";
import { evenementStripe } from "./evenement-stripe.table";

export function commandeRepository(db: Db) {
  return {
    async creer(donnees: {
      utilisateurId: string;
      offre: Offre;
    }): Promise<{ id: string }> {
      const [ligne] = await db
        .insert(commande)
        .values({
          utilisateurId: donnees.utilisateurId,
          libelle: donnees.offre.libelle,
          montantCentimes: donnees.offre.montantCentimes,
          devise: donnees.offre.devise,
        })
        .returning({ id: commande.id });
      return ligne;
    },

    async attacherSession(
      id: string,
      utilisateurId: string,
      sessionId: string,
    ): Promise<void> {
      await db
        .update(commande)
        .set({ stripeSessionId: sessionId })
        .where(
          and(eq(commande.id, id), eq(commande.utilisateurId, utilisateurId)),
        );
    },

    // Un seul bloc : l'événement est noté et la commande mise à jour, ou rien du tout.
    async enregistrerConfirmation(confirmation: {
      evenementId: string;
      type: string;
      commandeId: string;
      montantCentimes: number;
    }): Promise<ResultatConfirmation> {
      return db.transaction(async (tx) => {
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
    },

    /** La commande de cette personne pour cette session de paiement, ou null. */
    async trouverParSession(sessionId: string, utilisateurId: string) {
      const [ligne] = await db
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
    },
  };
}
```

