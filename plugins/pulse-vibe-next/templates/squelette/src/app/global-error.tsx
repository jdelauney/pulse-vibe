"use client";

import "./globals.css";

// Remplace la mise en page racine quand celle-ci rencontre une erreur : elle porte donc ses propres <html> et <body>.
export default function ErreurGlobale({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col items-start justify-center gap-4 px-6">
        <title>Un problème est survenu</title>
        <h1 className="text-2xl font-semibold">Un problème est survenu</h1>
        <p>
          Réessayez dans un instant. Si le problème continue, prévenez-nous.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md border px-4 py-2"
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
