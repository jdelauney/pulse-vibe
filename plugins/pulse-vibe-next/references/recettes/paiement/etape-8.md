### 8. Le webhook

Dans un Route Handler de Next.js 16, le corps brut s'obtient avec `await requete.text()`, lu **une seule fois**, avant toute autre lecture. Le fichier du webhook vérifie la signature par l'adapter, puis appelle le use-case. Une signature fausse répond 400, sans rien écrire du message dans le journal. Une panne (base, Stripe) répond avec `reponseErreur()` : Stripe renvoie alors le message plus tard.

<!-- fichier: src/features/paiement/webhooks/stripe-paiement.webhook.ts -->
```ts
// src/features/paiement/webhooks/stripe-paiement.webhook.ts
import { passerellePaiement } from "@src/adapters/payment/payment.adapter";
import { confirmerPaiement } from "@src/core/paiement/use-cases/confirmer-paiement.use-case";
import { getDb } from "@src/db/db-client";
import { commandeRepository } from "@src/db/paiement/commande.repository";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";
import { logger } from "@src/lib/logger";

/** Reçoit un message de Stripe : signature vérifiée par l'adapter, puis traitement une seule fois par événement. */
export async function recevoirWebhookStripe(
  requete: Request,
): Promise<Response> {
  const signature = requete.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Signature absente.", { status: 400 });
  }
  // Corps brut, lu une seule fois et tel quel : la signature porte sur ces octets exacts.
  const corps = await requete.text();

  try {
    const lecture = passerellePaiement.lireEvenement(corps, signature);
    if (!lecture.ok) {
      // Le journal ne reçoit ni le corps ni la signature.
      logger.warn("Webhook Stripe refusé : signature invalide");
      return new Response("Signature invalide.", { status: 400 });
    }
    const evenement = lecture.valeur;
    const resultat = await confirmerPaiement(
      { commandes: commandeRepository(getDb()) },
      evenement,
    );
    logger.info(
      { evenementId: evenement.id, type: evenement.type, resultat },
      "Webhook Stripe traité",
    );
    return Response.json({ recu: true });
  } catch (erreur) {
    // Une panne répond 500 ou 503 : Stripe renvoie le message plus tard.
    return reponseErreur(erreur, "Webhook Stripe");
  }
}
```

<!-- fichier: app/api/stripe/webhook/route.ts -->
```ts
// app/api/stripe/webhook/route.ts
import { recevoirWebhookStripe } from "@src/features/paiement/webhooks/stripe-paiement.webhook";

export async function POST(requete: Request) {
  return recevoirWebhookStripe(requete);
}
```

