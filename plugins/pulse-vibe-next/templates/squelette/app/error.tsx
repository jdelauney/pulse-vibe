"use client";

import { Button } from "@src/components/ui/button";
import { signalerErreurClient } from "@src/lib/errors/signaler-erreur-client";
import { useEffect } from "react";

// Affiché quand une page rencontre une erreur imprévue. Le détail technique reste dans les journaux
// du serveur ; la référence (digest) permet de retrouver la bonne ligne du journal.
export default function Erreur({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    signalerErreurClient(error);
  }, [error]);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Un problème est survenu</h1>
      <p className="text-muted-foreground">
        Réessayez dans un instant. Si le problème continue, prévenez-nous.
      </p>
      {error.digest ? (
        <p className="text-sm text-muted-foreground">
          Référence à nous transmettre : <code>{error.digest}</code>
        </p>
      ) : null}
      <div>
        <Button onClick={() => retry()}>Réessayer</Button>
      </div>
    </main>
  );
}
