### 10. Les containers : actions branchées, session lue

Un container client par formulaire : il appelle `useAction(action)` de `next-safe-action/hooks` et passe `envoyer`, `erreurServeur` (`result.serverError`) et `enCours` (`isPending`) à sa section.

<!-- fichier: src/features/compte/components/containers/inscription.container.tsx -->
```tsx
// src/features/compte/components/containers/inscription.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { inscrire } from "../../actions/inscrire.action";
import { FormulaireInscription } from "../sections/formulaire-inscription";

export function InscriptionContainer() {
  const { executeAsync, result, isPending } = useAction(inscrire);
  return (
    <FormulaireInscription
      envoyer={async (valeurs) => {
        const reponse = await executeAsync(valeurs);
        return Boolean(reponse?.data);
      }}
      erreurServeur={result.serverError}
      enCours={isPending}
    />
  );
}
```

<!-- fichier: src/features/compte/components/containers/connexion.container.tsx -->
```tsx
// src/features/compte/components/containers/connexion.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { connecter } from "../../actions/connecter.action";
import { FormulaireConnexion } from "../sections/formulaire-connexion";

export function ConnexionContainer() {
  const { executeAsync, result, isPending } = useAction(connecter);
  return (
    <FormulaireConnexion
      envoyer={async (valeurs) => {
        const reponse = await executeAsync(valeurs);
        return Boolean(reponse?.data);
      }}
      erreurServeur={result.serverError}
      enCours={isPending}
    />
  );
}
```

<!-- fichier: src/features/compte/components/containers/mot-de-passe.container.tsx -->
```tsx
// src/features/compte/components/containers/mot-de-passe.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";
import { changerMotDePasse } from "../../actions/changer-mot-de-passe.action";
import { FormulaireMotDePasse } from "../sections/formulaire-mot-de-passe";

export function MotDePasseContainer() {
  const { executeAsync, result, isPending } = useAction(changerMotDePasse);
  return (
    <FormulaireMotDePasse
      envoyer={async (valeurs) => {
        const reponse = await executeAsync(valeurs);
        if (!reponse?.data) {
          return false;
        }
        toast.success(reponse.data.message);
        return true;
      }}
      erreurServeur={result.serverError}
      enCours={isPending}
    />
  );
}
```

<!-- fichier: src/features/compte/components/containers/bouton-deconnexion.container.tsx -->
```tsx
// src/features/compte/components/containers/bouton-deconnexion.container.tsx
"use client";

import { Button } from "@src/components/ui/button";
import { useAction } from "next-safe-action/hooks";
import { deconnecter } from "../../actions/deconnecter.action";

export function BoutonDeconnexionContainer() {
  const { execute, isPending } = useAction(deconnecter);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => execute()}
    >
      {isPending ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}
```

Le contenu de « Mon compte » lit la session : c'est un container serveur, rendu sous `<Suspense>` par la page.

<!-- fichier: src/features/compte/components/containers/compte.container.tsx -->
```tsx
// src/features/compte/components/containers/compte.container.tsx
import { utilisateurConnecte } from "../../queries/utilisateur-connecte.query";
import { BoutonDeconnexionContainer } from "./bouton-deconnexion.container";
import { MotDePasseContainer } from "./mot-de-passe.container";

export async function CompteContainer() {
  const utilisateur = await utilisateurConnecte();
  return (
    <>
      <section className="flex items-center justify-between gap-4">
        <p>Connecté en tant que {utilisateur.nom}</p>
        <BoutonDeconnexionContainer />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-medium">Changer mon mot de passe</h2>
        <MotDePasseContainer />
      </section>
    </>
  );
}
```

