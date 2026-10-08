"use client";

import { Button } from "@src/components/ui/button";

// Affiché quand une page rencontre une erreur imprévue. Le détail technique reste dans les journaux du serveur.
export default function Erreur({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Un problème est survenu</h1>
      <p className="text-muted-foreground">
        Réessayez dans un instant. Si le problème continue, prévenez-nous.
      </p>
      <div>
        <Button onClick={() => retry()}>Réessayer</Button>
      </div>
    </main>
  );
}
