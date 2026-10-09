### 6. La personne connectée, côté pages

<!-- fichier: src/features/compte/queries/utilisateur-connecte.query.ts -->
```ts
// src/features/compte/queries/utilisateur-connecte.query.ts
import "server-only";
import { enTetesDeSession, getAuth } from "@src/adapters/auth/auth.adapter";
import { redirect } from "next/navigation";
import { cache } from "react";

export type UtilisateurConnecte = { id: string; nom: string };

/** La personne connectée ; sans session, renvoie vers /connexion. Une seule lecture par requête. */
export const utilisateurConnecte = cache(
  async (): Promise<UtilisateurConnecte> => {
    const enTetes = await enTetesDeSession();
    const session = await getAuth().api.getSession({ headers: enTetes });
    if (!session) {
      redirect("/connexion");
    }
    return { id: session.user.id, nom: session.user.name };
  },
);
```

Appelez-la dans un container placé sous `<Suspense>`, jamais au premier niveau d'une page ou d'un layout.

