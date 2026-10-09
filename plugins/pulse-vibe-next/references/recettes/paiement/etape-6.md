### 6. L'adapter de paiement

Le client Stripe et la vérification de signature vivent dans `src/adapters/payment/`. Le client est créé à la première utilisation : la construction du site n'a pas besoin de la clé. Toute panne de Stripe devient une `ErreurService("paiement", …)` : son message est sans secret ni donnée personnelle, et sa `cause` garde seulement des champs techniques (`name`, `type`, `code`, `requestId`, code HTTP), lus un par un, jamais le texte de l'erreur d'origine, qui peut citer une adresse e-mail ou une clé (architecture.md §8). `safe-action` journalise et affiche un message générique ; le webhook de l'étape 8 utilise `reponseErreur()`.

`lireEvenement` reçoit le corps **brut** : la signature porte sur ces octets exacts. Une signature fausse donne `echec("signature-invalide")`, sans lever d'exception.

<!-- fichier: src/adapters/payment/payment.adapter.ts -->
```ts
// src/adapters/payment/payment.adapter.ts
import "server-only";
import { env } from "@src/config/env";
import type { EvenementPaiement } from "@src/core/paiement/commande.entity";
import type { PasserellePaiement } from "@src/core/paiement/passerelle-paiement.port";
import { echec, ok } from "@src/core/shared/result";
import { ErreurService } from "@src/lib/errors/erreur-service";
import Stripe from "stripe";

let client: Stripe | undefined;

// Client créé à la première utilisation : la construction du site n'a pas besoin de la clé.
function obtenirClient(): Stripe {
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

const EVENEMENTS_DE_PAIEMENT = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/** Un paiement encaissé : un événement de paiement dont la session est « paid » et porte une commande. */
function confirmationDe(
  evenement: Stripe.Event,
): EvenementPaiement["confirmation"] {
  if (!EVENEMENTS_DE_PAIEMENT.has(evenement.type)) {
    return null;
  }
  const session = evenement.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" || !session.client_reference_id) {
    return null;
  }
  return {
    commandeId: session.client_reference_id,
    // Sans montant, aucune commande ne correspond : -1 laisse la commande en attente.
    montantCentimes: session.amount_total ?? -1,
  };
}

/**
 * Champs techniques de l'erreur de Stripe, sans son texte : le texte peut citer une adresse
 * e-mail, un nom ou une clé.
 */
function causeTechnique(erreur: unknown) {
  const brute = (erreur ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    name: texte(brute.name),
    type: texte(brute.type),
    code: texte(brute.code),
    requestId: texte(brute.requestId),
    statusCode:
      typeof brute.statusCode === "number" ? brute.statusCode : undefined,
  };
}

function panneDePaiement(erreur: unknown): ErreurService {
  return new ErreurService("paiement", "Le service de paiement a échoué", {
    cause: causeTechnique(erreur),
  });
}

/**
 * La seule porte de sortie vers Stripe. Toute panne devient une ErreurService("paiement", …)
 * sans secret ni donnée personnelle.
 */
export const passerellePaiement: PasserellePaiement = {
  async creerSession(params) {
    let session: Stripe.Checkout.Session;
    try {
      session = await obtenirClient().checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: params.offre.devise,
              unit_amount: params.offre.montantCentimes,
              product_data: { name: params.offre.libelle },
            },
          },
        ],
        client_reference_id: params.commandeId,
        metadata: { commandeId: params.commandeId },
        locale: "fr",
        success_url: params.urlSucces.replace(
          "{SESSION_ID}",
          "{CHECKOUT_SESSION_ID}",
        ),
        cancel_url: params.urlAnnulation,
      });
    } catch (erreur) {
      throw panneDePaiement(erreur);
    }
    if (!session.url) {
      throw new ErreurService(
        "paiement",
        "Le service de paiement n'a pas donné d'adresse de paiement",
      );
    }
    return { id: session.id, url: session.url };
  },

  // La signature porte sur les octets exacts du corps : il arrive brut, jamais relu ni transformé.
  lireEvenement(corps, signature) {
    const stripe = obtenirClient();
    const secret = env.STRIPE_WEBHOOK_SECRET;
    let evenement: Stripe.Event;
    try {
      evenement = stripe.webhooks.constructEvent(corps, signature, secret);
    } catch {
      return echec("signature-invalide");
    }
    return ok({
      id: evenement.id,
      type: evenement.type,
      confirmation: confirmationDe(evenement),
    });
  },
};
```

