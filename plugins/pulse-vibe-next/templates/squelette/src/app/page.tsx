import { projet } from "@/lib/projet";

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="font-heading text-4xl font-semibold tracking-tight">
        {projet.nom}
      </h1>
      <p className="text-lg text-muted-foreground">{projet.description}</p>
    </main>
  );
}
