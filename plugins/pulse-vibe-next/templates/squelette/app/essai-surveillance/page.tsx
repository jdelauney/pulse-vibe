import type { Metadata } from "next";
import { Declencheur } from "./declencheur";

// Page d'essai de la surveillance (consignes « Pour mettre en ligne » du pack) : après une mise en
// ligne, une erreur provoquée ici doit apparaître dans Vercel → Logs. Hors de Google.
export const metadata: Metadata = {
  title: "Essai de la surveillance",
  robots: { index: false, follow: false },
};

export default function EssaiSurveillance() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Essai de la surveillance</h1>
      <p className="text-muted-foreground">
        Ce bouton provoque une erreur dans le navigateur. Elle apparaît ensuite
        dans les journaux de Vercel, avec le message « Erreur dans le navigateur
        ».
      </p>
      <div>
        <Declencheur />
      </div>
    </main>
  );
}
