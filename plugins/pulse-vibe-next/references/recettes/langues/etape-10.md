### 10. Le proxy : connexion et langues

Remplacer `proxy.ts` (à la racine). Le `matcher` couvre désormais toutes les pages (next-intl en a besoin) ; la liste `PAGES_CONNECTEES` reprend les lignes de l'ancien `matcher`, sans `/:path*` (ajouter `"/factures"`, `"/fichiers"`, `"/paiement"` quand ces recettes sont appliquées). La redirection vers la connexion passe en premier, dans la langue de l'adresse ; elle ne vaut que pour l'ouverture d'une page (GET), comme avant. next-intl gère ensuite le préfixe, la détection de la langue et la réécriture vers `/[locale]/…`.

<!-- fichier: proxy.ts -->
```ts
// proxy.ts
import { routing } from "@src/config/i18n";
import { cheminDansLaLangue, separerLangue } from "@src/lib/i18n/chemins";
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

const gererLangue = createMiddleware(routing);

// Pages du groupe (connecte), écrites sans préfixe de langue
// (les anciennes lignes du matcher, sans « /:path* »).
const PAGES_CONNECTEES = ["/compte"];

export function proxy(request: NextRequest) {
  const { langue, chemin } = separerLangue(request.nextUrl.pathname);
  const estConnectee = PAGES_CONNECTEES.some(
    (page) => chemin === page || chemin.startsWith(`${page}/`),
  );

  // 1. Renvoi rapide vers la connexion, dans la langue de l'adresse (présence du cookie seulement).
  // Seulement l'ouverture d'une page (GET) : une action (POST) continue jusqu'à actionConnectee,
  // qui répond « Connexion requise » dans le formulaire.
  if (request.method === "GET" && estConnectee && !getSessionCookie(request)) {
    return NextResponse.redirect(
      new URL(cheminDansLaLangue(langue, "/connexion"), request.url),
    );
  }
  // 2. Langue : préfixe, détection, puis réécriture vers /[locale]/… par next-intl.
  return gererLangue(request);
}

export const config = {
  // Toutes les pages, sauf /api, /trpc, /_next, /_vercel et les fichiers (adresse avec un point).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
```

