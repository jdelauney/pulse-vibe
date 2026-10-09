### 12. Le renvoi rapide vers la connexion (`proxy.ts`)

`proxy.ts` se place à la racine du projet, à côté d'`app/`.

<!-- fichier: proxy.ts -->
```ts
// proxy.ts
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Seulement l'ouverture d'une page (GET). Une action (POST) continue jusqu'à
  // actionConnectee, qui répond « Connexion requise » dans le formulaire.
  if (request.method === "GET" && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Une ligne par page du groupe (connecte) : les groupes de routes n'apparaissent pas dans l'adresse.
  matcher: ["/compte/:path*"],
};
```

`getSessionCookie` regarde seulement si le cookie existe (il reconnaît aussi le préfixe `__Secure-` de la production). Il ne le valide pas : la vraie vérification reste dans `utilisateurConnecte()` et `actionConnectee`.

Si la recette `langues` est appliquée, ajoutez plutôt l'adresse à `PAGES_CONNECTEES`, sans `/:path*` (étape 10 de `langues`).

Le test `request.method === "GET"` laisse passer les actions. Une Server Action envoie un POST à l'adresse de la page : redirigée par le proxy, elle s'arrêterait sans aucun message (essai fait : réponse 307, formulaire muet).

