### 7. La page du code et « Mon compte »

La page du code est publique : la personne n'a pas encore de session. Elle n'a rien à lire dans la requête (le cookie `two_factor` est lu par l'action) : elle reste statique.

<!-- fichier: app/(public)/connexion/code/page.tsx -->
```tsx
// app/(public)/connexion/code/page.tsx
import { CodeConnexionContainer } from "@src/features/compte/components/containers/code-connexion.container";
import type { Metadata } from "next";

// Page d'authentification : hors de Google (fiche, règle 47).
export const metadata: Metadata = {
  title: "Code de connexion",
  robots: { index: false, follow: false },
};

export default function PageCodeConnexion() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-2xl font-semibold">Code de connexion</h1>
      <p className="mb-6 text-muted-foreground">
        Nous venons d'envoyer un code à 6 chiffres à votre adresse e-mail. Il
        reste valable 5 minutes.
      </p>
      <CodeConnexionContainer />
    </main>
  );
}
```

Dans « Mon compte » (`compte.container.tsx`, version de la recette `email`), l'import du container, puis sa section avant « Supprimer mon compte » :

<!-- ajout: src/features/compte/components/containers/compte.container.tsx après: import { ChangementAdresseContainer } from "./changement-adresse.container"; -->
```tsx
import { DoubleAuthentificationContainer } from "./double-authentification.container";
```

<!-- remplacer-ligne: src/features/compte/components/containers/compte.container.tsx début: <section aria-labelledby="titre-suppression"> -->
```tsx
      <section aria-labelledby="titre-double-authentification">
        <h2
          id="titre-double-authentification"
          className="mb-4 text-lg font-medium"
        >
          Double authentification
        </h2>
        <DoubleAuthentificationContainer
          active={utilisateur.doubleAuthentification}
        />
      </section>
      <section aria-labelledby="titre-suppression">
```
