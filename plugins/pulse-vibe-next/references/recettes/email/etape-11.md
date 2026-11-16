### 11. Supprimer son compte

Deux temps : dans « Mon compte », la personne demande la suppression et reçoit un lien par e-mail ; le lien ouvre une page qui dit ce qui va disparaître et demande une dernière confirmation. Le compte part alors avec toutes ses données, la session se ferme, et une page le confirme.

<!-- fichier: src/features/compte/actions/demander-suppression-compte.action.ts -->
```ts
// src/features/compte/actions/demander-suppression-compte.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionConnectee } from "@src/lib/safe-action";
import { headers } from "next/headers";

// better-auth envoie le lien de confirmation (sendDeleteAccountVerification) : rien n'est encore supprimé.
export const demanderSuppressionCompte = actionConnectee
  .metadata({ nom: "demanderSuppressionCompte" })
  .action(async () => {
    await getAuth().api.deleteUser({ body: {}, headers: await headers() });
    return {
      message:
        "Un e-mail de confirmation vient de partir. Ouvrez son lien dans ce navigateur pour supprimer votre compte.",
    };
  });
```

<!-- fichier: src/features/compte/actions/confirmer-suppression-compte.action.ts -->
```ts
// src/features/compte/actions/confirmer-suppression-compte.action.ts
"use server";

import { getAuth } from "@src/adapters/auth/auth.adapter";
import { actionConnectee } from "@src/lib/safe-action";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnServerError } from "next-safe-action";
import { schemaConfirmationSuppression } from "../schemas/compte.schema";

// Le jeton du lien reçu par e-mail : better-auth supprime le compte, ses sessions, et ferme la session en cours.
export const confirmerSuppressionCompte = actionConnectee
  .metadata({ nom: "confirmerSuppressionCompte" })
  .inputSchema(schemaConfirmationSuppression)
  .action(async ({ parsedInput }) => {
    try {
      await getAuth().api.deleteUser({
        body: { token: parsedInput.token },
        headers: await headers(),
      });
    } catch (erreur) {
      if (erreur instanceof APIError && erreur.body?.code === "INVALID_TOKEN") {
        returnServerError(
          "Ce lien n'est plus valable. Demandez-en un nouveau depuis « Mon compte ».",
        );
      }
      throw erreur;
    }
    redirect("/compte-supprime");
  });
```

La section de « Mon compte » : ce que fait la suppression, et le bouton qui envoie le lien.

<!-- fichier: src/features/compte/components/sections/suppression-compte.tsx -->
```tsx
// src/features/compte/components/sections/suppression-compte.tsx
"use client";

import { Button } from "@src/components/ui/button";

type Props = {
  demander: () => void;
  erreurServeur?: string;
  /** Réponse de l'action : le lien de confirmation est parti. */
  message?: string;
  enCours: boolean;
};

export function SuppressionCompte({
  demander,
  erreurServeur,
  message,
  enCours,
}: Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        La suppression efface votre compte et toutes vos données. Elle ne peut
        pas être annulée. Un e-mail vous demandera de la confirmer.
      </p>
      {erreurServeur && (
        <p role="alert" className="text-sm text-destructive">
          {erreurServeur}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        disabled={enCours}
        onClick={demander}
      >
        {enCours ? "Envoi…" : "Supprimer mon compte"}
      </Button>
    </div>
  );
}
```

<!-- fichier: src/features/compte/components/containers/suppression-compte.container.tsx -->
```tsx
// src/features/compte/components/containers/suppression-compte.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { demanderSuppressionCompte } from "../../actions/demander-suppression-compte.action";
import { SuppressionCompte } from "../sections/suppression-compte";

export function SuppressionCompteContainer() {
  const { execute, result, isPending } = useAction(demanderSuppressionCompte);
  return (
    <SuppressionCompte
      demander={() => execute()}
      erreurServeur={result.serverError}
      message={result.data?.message}
      enCours={isPending}
    />
  );
}
```

La page ouverte par le lien : la dernière confirmation.

<!-- fichier: src/features/compte/components/sections/confirmation-suppression.tsx -->
```tsx
// src/features/compte/components/sections/confirmation-suppression.tsx
"use client";

import { Button } from "@src/components/ui/button";
import Link from "next/link";

type Props = {
  confirmer: () => void;
  erreurServeur?: string;
  enCours: boolean;
};

export function ConfirmationSuppression({
  confirmer,
  erreurServeur,
  enCours,
}: Props) {
  return (
    <div className="space-y-4">
      <p>
        Votre compte et toutes vos données vont être effacés. Cette suppression
        ne peut pas être annulée.
      </p>
      {erreurServeur && (
        <p role="alert" className="text-sm text-destructive">
          {erreurServeur}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          variant="destructive"
          disabled={enCours}
          onClick={confirmer}
        >
          {enCours ? "Suppression…" : "Supprimer définitivement"}
        </Button>
        <Link href="/compte" className="underline">
          Garder mon compte
        </Link>
      </div>
    </div>
  );
}
```

<!-- fichier: src/features/compte/components/containers/confirmation-suppression.container.tsx -->
```tsx
// src/features/compte/components/containers/confirmation-suppression.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { confirmerSuppressionCompte } from "../../actions/confirmer-suppression-compte.action";
import { ConfirmationSuppression } from "../sections/confirmation-suppression";

export function ConfirmationSuppressionContainer({ token }: { token: string }) {
  const { execute, result, isPending } = useAction(confirmerSuppressionCompte);
  return (
    <ConfirmationSuppression
      confirmer={() => execute({ token })}
      erreurServeur={result.serverError}
      enCours={isPending}
    />
  );
}
```

Le container serveur de la page lit la session (page réservée) puis l'adresse (`?token=…`). Le jeton va au container du bouton, jamais à la section.

<!-- fichier: src/features/compte/components/containers/lien-suppression.container.tsx -->
```tsx
// src/features/compte/components/containers/lien-suppression.container.tsx
import Link from "next/link";
import { utilisateurConnecte } from "../../queries/utilisateur-connecte.query";
import { ConfirmationSuppressionContainer } from "./confirmation-suppression.container";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function LienSuppressionContainer({ searchParams }: Props) {
  await utilisateurConnecte();
  const { token } = await searchParams;
  if (typeof token !== "string") {
    return (
      <p>
        Ce lien est incomplet.{" "}
        <Link href="/compte" className="underline">
          Retour à mon compte
        </Link>
      </p>
    );
  }
  return <ConfirmationSuppressionContainer token={token} />;
}
```

<!-- fichier: app/(connecte)/compte/supprimer/page.tsx -->
```tsx
// app/(connecte)/compte/supprimer/page.tsx
import { LienSuppressionContainer } from "@src/features/compte/components/containers/lien-suppression.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Supprimer mon compte" };

export default function PageSupprimerCompte({
  searchParams,
}: PageProps<"/compte/supprimer">) {
  return (
    <main className="mx-auto max-w-sm space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Supprimer mon compte</h1>
      <Suspense fallback={<p className="text-muted-foreground">Chargement…</p>}>
        <LienSuppressionContainer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

<!-- fichier: app/(public)/compte-supprime/page.tsx -->
```tsx
// app/(public)/compte-supprime/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Compte supprimé",
  robots: { index: false, follow: false },
};

export default function PageCompteSupprime() {
  return (
    <main className="mx-auto max-w-sm space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Compte supprimé</h1>
      <p role="status">
        Votre compte et vos données sont effacés. Vous êtes déconnecté.
      </p>
      <Link href="/" className="underline">
        Retour à l'accueil
      </Link>
    </main>
  );
}
```

`/compte/supprimer` est couverte par le `matcher` de `proxy.ts` (`/compte/:path*`). Lien ouvert sans session : la personne passe par la connexion, puis rouvre le lien de l'e-mail.
