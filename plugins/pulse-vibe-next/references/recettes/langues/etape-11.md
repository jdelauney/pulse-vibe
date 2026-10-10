### 11. Traduire les écrans

- Composant serveur non `async`, ou composant client : `const t = useTranslations("Compte");` puis `t("titre")`.
- Composant serveur `async` : `const t = await getTranslations("Compte");` (de `next-intl/server`) puis `t("connecteEnTantQue", { nom: utilisateur.nom })`.
- Liens internes : `Link` de `@src/lib/i18n/navigation` à la place de `next/link` (dans `app/[locale]/not-found.tsx` et les formulaires de `connexion`, par exemple).
- Les lectures de session et de données restent sous `<Suspense>`, comme avant.
- Les containers et les pages portent les textes ; une section, un composite ou un élément qui a besoin d'un texte le reçoit en props (comme `ChoixLangue`, qui reçoit ses libellés de `ChoixLangueContainer`).

Exemple avec l'écran « Mon compte » : le container serveur lit la traduction, la page lit son titre et son texte de chargement, et `generateMetadata` traduit le titre de l'onglet (la langue vient de `params`).

<!-- fichier: src/features/compte/components/containers/compte.container.tsx -->
```tsx
// src/features/compte/components/containers/compte.container.tsx
import { getTranslations } from "next-intl/server";
import { utilisateurConnecte } from "../../queries/utilisateur-connecte.query";
import { BoutonDeconnexionContainer } from "./bouton-deconnexion.container";
import { MotDePasseContainer } from "./mot-de-passe.container";

export async function CompteContainer() {
  const t = await getTranslations("Compte");
  const utilisateur = await utilisateurConnecte();
  return (
    <>
      <section className="flex items-center justify-between gap-4">
        <p>{t("connecteEnTantQue", { nom: utilisateur.nom })}</p>
        <BoutonDeconnexionContainer />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-medium">{t("changerMotDePasse")}</h2>
        <MotDePasseContainer />
      </section>
    </>
  );
}
```

<!-- fichier: app/[locale]/(connecte)/compte/page.tsx -->
```tsx
// app/[locale]/(connecte)/compte/page.tsx
import { CompteContainer } from "@src/features/compte/components/containers/compte.container";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Compte" });
  return { title: t("titre") };
}

export default function PageCompte() {
  const t = useTranslations("Compte");
  return (
    <main className="mx-auto max-w-sm space-y-8 p-6">
      <h1 className="text-2xl font-semibold">{t("titre")}</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">{t("chargement")}</p>}
      >
        <CompteContainer />
      </Suspense>
    </main>
  );
}
```

