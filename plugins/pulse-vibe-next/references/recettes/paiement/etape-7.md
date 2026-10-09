### 7. L'offre et l'action qui ouvre le paiement

Adaptez le libellé et le prix au projet.

<!-- fichier: src/features/paiement/constants/offre.ts -->
```ts
// src/features/paiement/constants/offre.ts
import type { Offre } from "@src/core/paiement/commande.entity";

// Le prix vit côté serveur : le navigateur ne choisit jamais le montant.
export const OFFRE: Offre = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
};
```

L'action assemble le use-case avec le repository et l'adapter, puis redirige vers la page de Stripe. `{SESSION_ID}` est remplacé par l'adapter avec l'identifiant de la session.

<!-- fichier: src/features/paiement/actions/payer.action.ts -->
```ts
// src/features/paiement/actions/payer.action.ts
"use server";

import { passerellePaiement } from "@src/adapters/payment/payment.adapter";
import { env } from "@src/config/env";
import { ouvrirPaiement } from "@src/core/paiement/use-cases/ouvrir-paiement.use-case";
import { getDb } from "@src/db/db-client";
import { commandeRepository } from "@src/db/paiement/commande.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OFFRE } from "../constants/offre";

export const payerAction = actionConnectee
  .metadata({ nom: "payer" })
  .action(async ({ ctx }) => {
    // Adresse du site qui appelle l'action (Next.js vérifie qu'elle est bien la sienne),
    // sinon l'adresse publique déclarée pour better-auth.
    const origine = (await headers()).get("origin") ?? env.BETTER_AUTH_URL;
    const { url } = await ouvrirPaiement(
      { commandes: commandeRepository(getDb()), paiement: passerellePaiement },
      {
        utilisateurId: ctx.utilisateur.id,
        offre: OFFRE,
        urlSucces: `${origine}/paiement/merci?session_id={SESSION_ID}`,
        urlAnnulation: `${origine}/paiement?annule=1`,
      },
    );
    redirect(url);
  });
```

