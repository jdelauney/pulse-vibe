import Link from "next/link";

export default function PageIntrouvable() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <p className="text-muted-foreground">
        Cette adresse ne mène à aucune page.
      </p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Revenir à l'accueil
      </Link>
    </main>
  );
}
