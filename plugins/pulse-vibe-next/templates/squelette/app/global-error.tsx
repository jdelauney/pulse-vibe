"use client";

import "./globals.css";
import { signalerErreurClient } from "@src/lib/errors/signaler-erreur-client";
import { useEffect } from "react";

// Remplace la mise en page racine quand celle-ci rencontre une erreur : elle porte donc ses propres <html> et <body>.
// La référence (digest) permet de retrouver la bonne ligne du journal du serveur.
export default function ErreurGlobale({
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
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-start justify-center gap-4 px-6">
        <title>Un problème est survenu</title>
        <h1 className="text-2xl font-semibold">Un problème est survenu</h1>
        <p>
          Réessayez dans un instant. Si le problème continue, prévenez-nous.
        </p>
        {error.digest ? (
          <p className="text-sm">
            Référence à nous transmettre : <code>{error.digest}</code>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => retry()}
          className="min-h-11 min-w-11 rounded-md border px-4 py-2"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
