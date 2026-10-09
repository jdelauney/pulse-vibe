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

Ajoutez le DSN, **sans valeur**, à `.env.example` (`SENTRY_AUTH_TOKEN` reste chez Vercel seulement) :

<!-- ajout: .env.example -->
```
# Suivi des erreurs Sentry (recette suivi-erreurs) : adresse d'envoi du projet, publique par conception.
NEXT_PUBLIC_SENTRY_DSN=
```

## Fichiers créés ou modifiés

- `instrumentation-client.ts` (créé) : erreurs du navigateur.
- `sentry.server.config.ts`, `sentry.edge.config.ts` (créés) : erreurs du serveur.
- `instrumentation.ts` (modifié) : charge la configuration serveur, et envoie chaque erreur de requête à Sentry **en plus** du journal pino.
- `next.config.ts` (modifié) : `withSentryConfig`, source CSP `connect-src` de Sentry.
- `app/global-error.tsx` (modifié) : erreur envoyée à Sentry.

## Étapes

- Étape 1 – Installer : `pulse-aidd pile recette suivi-erreurs etape 1`
- Étape 2 – Configurer : `pulse-aidd pile recette suivi-erreurs etape 2`
- Étape 3 – Prouver : `pulse-aidd pile recette suivi-erreurs etape 3`
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
Le code des tests : `pulse-aidd pile recette suivi-erreurs tests`
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
