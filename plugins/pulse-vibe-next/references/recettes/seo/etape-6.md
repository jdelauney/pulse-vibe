### 6. Un vrai 404 pour un `slug` inconnu (facultatif)

Avec Cache Components, une adresse inconnue de ce segment répond **200 avec `noindex`** à Googlebot et aux robots IA (la coquille prérendue part avant `notFound()`) ; Google l'écarte des résultats, mais la compte comme « soft 404 ». Pour un vrai 404, vérifier l'existence dans `proxy.ts` (à la racine), qui agit avant le rendu. Le proxy appelle `existePubliee` du repository : c'est la seule lecture de base permise dans le proxy, une requête légère (colonne indexée), jamais le contenu entier. Si la base est indisponible, le proxy journalise un message fixe (`logger.warn`, sans donnée de la requête) et laisse la page répondre : un « soft 404 » vaut mieux qu'une erreur 500 pour tout le segment.

<!-- fichier: proxy.ts -->
```ts
// proxy.ts (à fusionner avec le proxy existant de la recette connexion)
import { getDb } from "@src/db/db-client";
import { realisationRepository } from "@src/db/realisations/realisation.repository";
import { logger } from "@src/lib/logger";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Page publique : un slug sans contenu publié répond 404 avant le rendu (vrai 404 pour les robots).
  if (pathname.startsWith("/realisations/")) {
    const slug = pathname.split("/")[2] ?? "";
    try {
      if (!(await realisationRepository(getDb()).existePubliee(slug))) {
        // Adresse sans page : Next.js répond 404 avec app/not-found.tsx.
        return NextResponse.rewrite(new URL("/introuvable", request.url));
      }
    } catch {
      // Base indisponible : la page décide (404 « soft ») plutôt qu'une erreur 500 pour tout le segment.
      logger.warn("Proxy : vérification d'existence impossible");
    }
    return NextResponse.next();
  }

  // Pages connectées : seulement l'ouverture d'une page (GET). Une action (POST) continue jusqu'à
  // actionConnectee, qui répond « Connexion requise » dans le formulaire.
  if (request.method === "GET" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Une ligne par page du groupe (connecte) : les groupes de routes n'apparaissent pas dans l'adresse.
  matcher: ["/compte/:path*", "/factures/:path*", "/realisations/:slug"],
};
```

Le bloc des réalisations passe en premier et rend la main : une page publique n'est jamais renvoyée vers la connexion. Gardez une seule fonction `proxy` et réunissez les listes de `matcher` (le fichier montre `compte` et `factures` ; gardez les lignes de votre projet).

