# Recette : suivi-erreurs

> Quand l'utiliser : le site est en ligne, il a des utilisateurs, et la personne veut être prévenue d'une erreur avant qu'un client ne la signale (facultatif ; sans cette recette, les erreurs restent dans le journal de Vercel, avec leur référence).

## Prérequis

- Le squelette du pack est en place et en ligne (`/pulse:deploy`), avec `instrumentation.ts` et `journaliserErreurDeRequete` (`src/lib/errors/erreur-de-requete.ts`).
- Un compte Sentry, créé par la personne, avec un projet « Next.js » dans la **région Union européenne** (données hébergées dans l'UE). L'offre gratuite suffit pour démarrer ; ses limites se lisent sur la page de tarifs de Sentry.
- La mention de confidentialité du site (`docs/` et page publique) cite Sentry comme sous-traitant : `/pulse:rediger` ou la personne la complète.

## Variables d'environnement

| Nom | Où | Secret | Rôle |
|---|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | `.env`, Vercel (Production, Preview) | non : adresse d'envoi, publique par conception | où le navigateur et le serveur envoient les erreurs |
| `SENTRY_AUTH_TOKEN` | Vercel seulement (Production, Preview), type Secret | oui | envoie les « source maps » à la construction, pour lire les erreurs dans le code d'origine |

## Fichiers créés ou modifiés

- `instrumentation-client.ts` (créé) : erreurs du navigateur.
- `sentry.server.config.ts`, `sentry.edge.config.ts` (créés) : erreurs du serveur.
- `instrumentation.ts` (modifié) : charge la configuration serveur, et envoie chaque erreur de requête à Sentry **en plus** du journal pino.
- `next.config.ts` (modifié) : `withSentryConfig`, source CSP `connect-src` de Sentry.
- `app/global-error.tsx` (modifié) : erreur envoyée à Sentry.

## Étapes

### Étape 1 – Installer

<!-- commande: npm install @sentry/nextjs -->
```bash
npm install @sentry/nextjs
```

Dernière version publiée, vérifiée avec `npm view @sentry/nextjs version` : 11.6.0.

### Étape 2 – Configurer

Le navigateur :

<!-- fichier: instrumentation-client.ts -->
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Aucune donnée personnelle envoyée d'office : ni adresse IP, ni cookie, ni en-tête.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

Le serveur et le runtime Edge :

<!-- fichier: sentry.server.config.ts -->
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  tracesSampleRate: 0,
});
```

<!-- fichier: sentry.edge.config.ts -->
```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false },
  tracesSampleRate: 0,
});
```

`instrumentation.ts` charge ces réglages et garde le journal pino. Une panne de Sentry ou du journal est ignorée : la réponse n'est jamais cassée.

<!-- fichier: instrumentation.ts -->
```ts
import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("./sentry.edge.config");
}

// Chaque erreur de requête va à Sentry (alerte) et au journal pino (référence digest).
// digest est la référence affichée à la personne par error.tsx : elle relie l'écran au journal.
export const onRequestError: Instrumentation.onRequestError = async (
  erreur,
  requete,
  contexte,
) => {
  try {
    Sentry.captureRequestError(erreur, requete, contexte);
  } catch {
    // Une panne de Sentry ne doit pas casser la réponse.
  }
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { journaliserErreurDeRequete } = await import(
      "@src/lib/errors/erreur-de-requete"
    );
    journaliserErreurDeRequete(erreur, requete, contexte);
  } catch {
    // Rien d'autre à faire : l'erreur d'origine suit son cours.
  }
};
```

Dans `next.config.ts`, trois changements. D'abord l'import :

<!-- remplacer-ligne: next.config.ts début: import type { NextConfig } -->
```ts
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
```

Ensuite la CSP : l'hôte d'envoi de Sentry est celui du DSN (`https://<clé>@o<id>.ingest.de.sentry.io/<projet>` pour la région UE). Remplacez la ligne `"connect-src": ["'self'"],` par :

<!-- remplacer-ligne: next.config.ts début: "connect-src": -->
```ts
  // Envoi des erreurs à Sentry (recette suivi-erreurs, région UE).
  "connect-src": ["'self'", "https://*.ingest.de.sentry.io"],
```

Enfin, remplacez la dernière ligne (`<organisation>` et `<projet>` se lisent dans l'adresse de votre projet Sentry ; ce ne sont pas des secrets) :

<!-- remplacer-ligne: next.config.ts début: export default nextConfig; -->
```ts
export default withSentryConfig(nextConfig, {
  org: "<organisation>",
  project: "<projet>",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
```

Dans `app/global-error.tsx`, l'erreur part à Sentry. Remplacez la ligne `import "./globals.css";` par :

<!-- remplacer-ligne: app/global-error.tsx début: import "./globals.css"; -->
```tsx
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./globals.css";
```

Puis, juste après la ligne `}) {` de la fonction, ajoutez :

<!-- ajout: app/global-error.tsx après: }) { -->
```tsx
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

```

### Étape 3 – Prouver

En préproduction (adresse de prévisualisation) : provoquer une erreur avec une page de test temporaire, vérifier qu'elle apparaît dans Sentry avec la même référence `digest` que dans le journal Vercel, puis retirer la page. Régler une alerte par e-mail dans Sentry (« première apparition d'une erreur »).

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Être prévenu d'une erreur en production

  Scénario: Une erreur du serveur remonte avec sa référence @manuel
    Étant donné le site de prévisualisation relié à Sentry
    Lorsqu'une page provoque une erreur du serveur
    Alors l'erreur apparaît dans Sentry
    Et sa référence est celle affichée à la personne et écrite dans le journal

  Scénario: Aucune donnée personnelle n'est envoyée @manuel
    Étant donné une erreur provoquée par une personne connectée
    Lorsque j'ouvre l'erreur dans Sentry
    Alors je ne vois ni adresse e-mail, ni cookie, ni adresse IP
```

## Tâches de plan prêtes

- **Tn – Relier le site à Sentry** : étapes 1 et 2 ; critères : construction verte, CSP sans violation (`e2e/securite.spec.ts`), DSN présent en Production et Preview, `SENTRY_AUTH_TOKEN` en type Secret.
- **Tn+1 – Prouver la remontée et régler l'alerte** : étape 3 ; action manuelle de la personne (compte, alerte).

## Tests

- `npm run build` passe avec et sans `SENTRY_AUTH_TOKEN` (sans lui, les source maps ne sont pas envoyées : la construction continue), et sans DSN.
- `npm run test:e2e` : `e2e/securite.spec.ts` ne relève aucune violation de CSP sur l'accueil.
- Les deux scénarios `@manuel` ci-dessus, en prévisualisation.

## Points de sécurité

- S1 : `SENTRY_AUTH_TOKEN` reste chez Vercel, en type Secret ; le DSN est public par conception (il permet seulement d'envoyer des erreurs).
- S9 et S11 : `dataCollection` coupe l'adresse IP, les cookies et les en-têtes ; joindre à une erreur seulement des références (jamais un e-mail, un mot de passe ou un jeton) ; la mention de confidentialité cite Sentry et la région UE.
- S12 : seul l'hôte d'envoi de Sentry est ajouté à `connect-src`.

## Pièges connus

- Sans `register()`, les erreurs du serveur ne partent pas : le navigateur seul remonte.
- `tracesSampleRate` au-dessus de 0 consomme vite le quota gratuit : le garder à 0 tant que la vitesse se suit avec `/pulse:perf`.
- Le journal de Vercel se garde peu de temps sur l'offre gratuite : Sentry garde la trace des erreurs ; pour garder tous les journaux, voir les « Log Drains » de Vercel (offre payante).
- L'hôte d'envoi `ingest.de.sentry.io` est celui des projets en région UE ; la page de Sentry consultée ne le cite pas : le relire dans le DSN du projet.

## Sources

- Sentry, « Manual Setup » pour Next.js (https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/), `@sentry/nextjs` 11.6.0, consultée le 2026-10-09.
- Sentry, options de configuration (`dataCollection`, https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/), consultée le 2026-10-09.
- Sentry, « Data Storage Location » (https://docs.sentry.io/organization/data-storage-location/), consultée le 2026-10-09.
- Next.js 16.4, convention de fichier `instrumentation` (`onRequestError`), documentation livrée dans `node_modules/next/dist/docs`.

## Points à vérifier

- La remontée réelle n'a pas été rejouée dans la CI du pack (compte Sentry nécessaire) : la preuve est l'étape 3, faite par la personne.
