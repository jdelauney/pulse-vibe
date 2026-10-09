### 3. Les use-cases

`ouvrirPaiement` combine la base et Stripe (deux ports), et `confirmerPaiement` garde la règle « seul un paiement encaissé compte » : les deux passent par un use-case (architecture.md §5, point 2). La partie atomique de la confirmation (noter l'événement et passer la commande en `payee` d'un seul bloc) reste dans le repository, car une transaction doit envelopper les deux écritures.

<!-- fichier: src/core/paiement/use-cases/ouvrir-paiement.use-case.ts -->
```ts
// src/core/paiement/use-cases/ouvrir-paiement.use-case.ts
import type { Offre } from "../commande.entity";
import type { CommandeRepository } from "../commande-repository.port";
import type { PasserellePaiement } from "../passerelle-paiement.port";

/** Crée la commande « en_attente », ouvre la page de paiement, puis relie les deux. */
export async function ouvrirPaiement(
  deps: { commandes: CommandeRepository; paiement: PasserellePaiement },
  entree: {
    utilisateurId: string;
    offre: Offre;
    urlSucces: string;
    urlAnnulation: string;
  },
): Promise<{ url: string }> {
  const commande = await deps.commandes.creer({
    utilisateurId: entree.utilisateurId,
    offre: entree.offre,
  });
  const session = await deps.paiement.creerSession({
    commandeId: commande.id,
    offre: entree.offre,
    urlSucces: entree.urlSucces,
    urlAnnulation: entree.urlAnnulation,
  });
  await deps.commandes.attacherSession(
    commande.id,
    entree.utilisateurId,
    session.id,
  );
  return { url: session.url };
}
```

<!-- fichier: src/core/paiement/use-cases/confirmer-paiement.use-case.ts -->
```ts
// src/core/paiement/use-cases/confirmer-paiement.use-case.ts
import type {
  EvenementPaiement,
  ResultatConfirmation,
} from "../commande.entity";
import type { CommandeRepository } from "../commande-repository.port";

/** Seul un paiement réellement encaissé compte ; chaque événement n'est traité qu'une fois. */
export async function confirmerPaiement(
  deps: { commandes: CommandeRepository },
  evenement: EvenementPaiement,
): Promise<ResultatConfirmation> {
  if (!evenement.confirmation) return "ignore";
  return deps.commandes.enregistrerConfirmation({
    evenementId: evenement.id,
    type: evenement.type,
    ...evenement.confirmation,
  });
}
```

