# Recette : limite

> Quand l'utiliser : le site a une connexion, une inscription ou un formulaire public, et doit freiner les essais en rafale (devinette de mots de passe, spam, e-mails en boucle).

## Prérequis

- Recette `connexion` appliquée (actions `inscrire` et `connecter`, `actionPublique`).
- Paquets à installer : `npm install @upstash/ratelimit @upstash/redis` (dernières versions ; recette vérifiée avec 2.2.0 et 1.39.0).
- Un compte Upstash (https://console.upstash.com). Offre gratuite : une base, 500 000 commandes par mois, 256 Mo de données, 10 Go de trafic par mois.
- Dans la console Upstash : créer une base Redis **régionale**, région **eu-central-1 (Francfort)**, proche de Vercel `fra1` et de Neon, offre gratuite. Sur la page de la base, section **REST API**, copier l'adresse et le jeton dans `.env`.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `UPSTASH_REDIS_REST_URL` | Adresse REST de la base Redis (commence par `https://`) |
| `UPSTASH_REDIS_REST_TOKEN` | Jeton d'accès à la base (`VOTRE_CLE_ICI`) |

Ajouter ces lignes au schéma de `src/lib/env.ts` :

```ts
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
```

Ajouter les deux noms, **sans valeur**, à `.env.example` :

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Dans Vercel, les saisir pour Production et Preview. Une même base peut servir en local et en ligne : les compteurs sont alors partagés.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/env.ts`, `.env.example` (modifiés) | Les deux variables Upstash |
| `src/lib/limite-regles.ts` | Lecture de l'IP et message (fonctions pures) |
| `src/lib/limite.ts` | Règles, `verifierLimite`, `exigerLimite` |
| `src/lib/limite.test.ts` | Tests unitaires et d'intégration |
| `src/features/compte/actions.ts` (modifié) | `exigerLimite` en tête de `inscrire`, `connecter` (et `demanderNouveauMotDePasse` avec la recette `email`) |
| Actions publiques de `src/features/<domaine>/actions.ts` (modifiées) | `exigerLimite("formulairePublic")` en tête |

## Étapes

### 1. Upstash et les variables

Créer la base (Prérequis), remplir `.env`, compléter `src/lib/env.ts` et `.env.example`.

### 2. Les fonctions pures

```ts
// src/lib/limite-regles.ts
// Fonctions pures de la limite de requêtes, testées en unitaire.

// Sur Vercel, x-forwarded-for est réécrit par la plateforme : la première adresse est celle du visiteur.
export function ipDepuis(entetes: Headers): string {
  const premiere = entetes.get("x-forwarded-for")?.split(",")[0]?.trim();
  return premiere || entetes.get("x-real-ip") || "inconnue";
}

export function messageLimite(reset: number, maintenant: number): string {
  const minutes = Math.max(1, Math.ceil((reset - maintenant) / 60_000));
  return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`;
}
```

### 3. Le limiteur

Une règle par usage, comptée par adresse IP sur une fenêtre glissante :

```ts
// src/lib/limite.ts
import "server-only";
import { type Duration, Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { returnServerError } from "next-safe-action";
import { envServeur } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ipDepuis, messageLimite } from "./limite-regles";

// Une règle par usage : nombre de tentatives par adresse IP, sur une fenêtre glissante.
const REGLES = {
  connexion: { nombre: 5, fenetre: "1 m" },
  inscription: { nombre: 3, fenetre: "10 m" },
  motDePasseOublie: { nombre: 3, fenetre: "10 m" },
  formulairePublic: { nombre: 5, fenetre: "1 m" },
} as const satisfies Record<string, { nombre: number; fenetre: Duration }>;

export type NomLimite = keyof typeof REGLES;

export type Limiteur = Pick<Ratelimit, "limit">;

export type Verdict =
  | { autorise: true }
  | { autorise: false; message: string; reset: number };

let redis: Redis | undefined;
const limiteurs = new Map<NomLimite, Ratelimit>();

function obtenirLimiteur(nom: NomLimite): Ratelimit {
  let limiteur = limiteurs.get(nom);
  if (!limiteur) {
    const env = envServeur();
    redis ??= new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
    limiteur = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(REGLES[nom].nombre, REGLES[nom].fenetre),
      prefix: `limite:${nom}`,
      // Upstash lent : la requête passe au bout de 2 secondes au lieu d'attendre.
      timeout: 2000,
    });
    limiteurs.set(nom, limiteur);
  }
  return limiteur;
}

export async function verifierLimite(
  nom: NomLimite,
  identifiant: string,
  limiteur: Limiteur = obtenirLimiteur(nom),
): Promise<Verdict> {
  try {
    const { success, reset } = await limiteur.limit(identifiant);
    if (success) {
      return { autorise: true };
    }
    return {
      autorise: false,
      message: messageLimite(reset, Date.now()),
      reset,
    };
  } catch (erreur) {
    // Upstash injoignable : le site reste utilisable, et l'incident est journalisé.
    logger.error(
      { err: erreur, limite: nom },
      "Limiteur indisponible : requête laissée passer",
    );
    return { autorise: true };
  }
}

// Pour une action next-safe-action : arrête l'action avec un message clair si la limite est atteinte.
export async function exigerLimite(nom: NomLimite): Promise<void> {
  const verdict = await verifierLimite(nom, ipDepuis(await headers()));
  if (!verdict.autorise) {
    returnServerError(verdict.message);
  }
}
```

### 4. Protéger la connexion, l'inscription et le mot de passe oublié

Les formulaires du compte passent par des actions : la limite se place **dans l'action**, en première ligne (la limite intégrée de better-auth ne s'applique pas aux appels `auth.api` des actions). Dans `src/features/compte/actions.ts`, ajouter l'import puis une ligne en tête de chaque action concernée :

```ts
import { exigerLimite } from "@/lib/limite";
```

```ts
export const inscrire = actionPublique
  .inputSchema(schemaInscription)
  .action(async ({ parsedInput }) => {
    await exigerLimite("inscription");
    // … suite inchangée
```

```ts
export const connecter = actionPublique
  .inputSchema(schemaConnexion)
  .action(async ({ parsedInput }) => {
    await exigerLimite("connexion");
    // … suite inchangée
```

Avec la recette `email` : `await exigerLimite("motDePasseOublie");` en tête de `demanderNouveauMotDePasse`.

Le message de refus arrive dans `result.serverError` : les formulaires de la recette `connexion` l'affichent déjà.

### 5. Protéger chaque formulaire public

Contact, avis, inscription à une lettre : `exigerLimite("formulairePublic")` en première ligne de l'action. Exemple :

```ts
// src/features/contact/actions.ts
"use server";

import { z } from "zod";
import { exigerLimite } from "@/lib/limite";
import { logger } from "@/lib/logger";
import { actionPublique } from "@/lib/safe-action";

const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });

export const envoyerMessage = actionPublique
  .inputSchema(messageSchema)
  .action(async ({ parsedInput }) => {
    await exigerLimite("formulairePublic");
    logger.info({ longueur: parsedInput.message.length }, "Message reçu");
    return { ok: true };
  });
```

### 6. Essayer

Se tromper 6 fois de mot de passe en moins d'une minute : la sixième fois, « Trop de tentatives. Réessayez dans 1 minute. » s'affiche. Les compteurs apparaissent dans la console Upstash (clés `limite:connexion:…`).

### 7. Mettre en ligne

Saisir les deux variables dans Vercel, redéployer, refaire l'essai sur le site en ligne.

### Si Upstash est indisponible

La recette **laisse passer** la requête et écrit une erreur dans le journal. Deux cas, vérifiés dans le code de `@upstash/ratelimit` 2.2.0 :

- Upstash répond trop lentement : au bout de `timeout` (2 secondes), la bibliothèque répond elle-même `success: true` (raison `timeout`).
- Upstash est injoignable (erreur réseau) : `verifierLimite` attrape l'erreur et autorise.

Le site reste ainsi utilisable pendant une panne. Pour un formulaire très exposé, refuser à la place est possible : remplacer le `return { autorise: true }` du `catch` par un refus. C'est une décision de la personne.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Limite de requêtes

  Règle: Au-delà de la limite, la personne reçoit un message clair

    @US-XXX-1 @unitaire @securite
    Exemple: Sixième tentative de connexion en une minute : refusée avec un message en français
      Étant donné 5 tentatives de connexion depuis l'adresse 203.0.113.7 dans la dernière minute
      Quand une sixième tentative arrive, 45 secondes avant la fin de la fenêtre
      Alors elle est refusée avec « Trop de tentatives. Réessayez dans 1 minute. »

    @US-XXX-1 @unitaire
    Exemple: Attente de 9 minutes et demie : le message annonce 10 minutes
      Étant donné la limite se termine dans 9 minutes et 30 secondes
      Quand le message est préparé
      Alors il dit « Trop de tentatives. Réessayez dans 10 minutes. »

    @US-XXX-1 @manuel @securite
    Exemple: Six mots de passe faux de suite sur le site : le sixième essai est bloqué
      Étant donné Camille a un compte
      Quand Camille se trompe de mot de passe six fois en moins d'une minute
      Alors Camille lit « Trop de tentatives. Réessayez dans 1 minute. »

  Règle: La limite s'applique par adresse IP du visiteur

    @US-XXX-2 @unitaire
    Exemple: L'adresse retenue est la première de x-forwarded-for
      Étant donné une requête qui porte « 203.0.113.7, 10.0.0.1 » dans x-forwarded-for
      Quand l'adresse du visiteur est lue
      Alors l'adresse retenue est « 203.0.113.7 »

  Règle: Upstash indisponible : le site reste utilisable

    @US-XXX-3 @integration
    Exemple: Upstash injoignable : la tentative est laissée passer
      Étant donné Upstash ne répond pas
      Quand un formulaire public est envoyé
      Alors l'envoi est accepté et l'incident est journalisé
```

## Tâches de plan prêtes

- [ ] **Tn – Compter les tentatives par adresse IP** · US-XXX
  - Objectif : le site sait compter les tentatives par adresse IP et refuser au-delà de la limite, avec un message clair
  - Dépend de : —
  - Fichiers : à créer : `src/lib/limite-regles.ts`, `src/lib/limite.ts`, `src/lib/limite.test.ts` · à modifier : `src/lib/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1 à 3 – `npm test` passe
  - Tests : « Sixième tentative de connexion en une minute… », « Attente de 9 minutes et demie… », « L'adresse retenue est la première de x-forwarded-for » (unitaires) ; « Upstash injoignable : la tentative est laissée passer » (intégration)
  - Action manuelle : créer la base Upstash (Francfort, offre gratuite) et copier l'adresse et le jeton REST dans `.env`
- [ ] **Tn+1 – Freiner les essais en rafale** · US-XXX
  - Objectif : la connexion, l'inscription, le mot de passe oublié et les formulaires publics refusent les essais en rafale
  - Dépend de : Tn
  - Fichiers : à modifier : `src/features/compte/actions.ts`, les actions publiques
  - Vérification : US-XXX critère 1 – six mots de passe faux en moins d'une minute : le message s'affiche
  - Tests : « Six mots de passe faux de suite sur le site… » (manuel)
  - Action manuelle : saisir `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` dans Vercel, puis redéployer

## Tests

Unitaires, et intégration pour la panne d'Upstash (l'adresse `http://127.0.0.1:9` ne répond jamais) :

```ts
// src/lib/limite.test.ts
import { describe, expect, it, vi } from "vitest";
import { ipDepuis, messageLimite } from "./limite-regles";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/env", () => ({
  envServeur: () => ({
    // Adresse volontairement injoignable : simule une panne d'Upstash.
    UPSTASH_REDIS_REST_URL: "http://127.0.0.1:9",
    UPSTASH_REDIS_REST_TOKEN: "jeton-de-test",
  }),
}));

const { verifierLimite } = await import("./limite");

function limiteurQuiRepond(success: boolean, reset: number) {
  return {
    limit: async () => ({
      success,
      reset,
      limit: 5,
      remaining: 0,
      pending: Promise.resolve(),
    }),
  };
}

describe("Limite de requêtes", () => {
  describe("Au-delà de la limite, la personne reçoit un message clair", () => {
    it("US-XXX-1 – Sixième tentative de connexion en une minute : refusée avec un message en français", async () => {
      const maintenant = Date.now();

      const verdict = await verifierLimite(
        "connexion",
        "203.0.113.7",
        limiteurQuiRepond(false, maintenant + 45_000),
      );

      expect(verdict).toMatchObject({
        autorise: false,
        message: "Trop de tentatives. Réessayez dans 1 minute.",
      });
    });

    it("US-XXX-1 – Attente de 9 minutes et demie : le message annonce 10 minutes", () => {
      expect(messageLimite(1_000_000 + 570_000, 1_000_000)).toBe(
        "Trop de tentatives. Réessayez dans 10 minutes.",
      );
    });
  });

  describe("La limite s'applique par adresse IP du visiteur", () => {
    it("US-XXX-2 – L'adresse retenue est la première de x-forwarded-for", () => {
      const entetes = new Headers({
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
      });

      expect(ipDepuis(entetes)).toBe("203.0.113.7");
    });
  });

  describe("Upstash indisponible : le site reste utilisable", () => {
    it("US-XXX-3 – Upstash injoignable : la tentative est laissée passer", async () => {
      const verdict = await verifierLimite("formulairePublic", "203.0.113.7");

      expect(verdict).toEqual({ autorise: true });
    }, 10_000);
  });
});
```

## Points de sécurité

- **S1, S2 – Secrets** : `UPSTASH_REDIS_REST_TOKEN` reste côté serveur (`server-only`, sans `NEXT_PUBLIC_`).
- **S10 – Abus et coûts** : connexion (5 par minute), inscription et mot de passe oublié (3 par 10 minutes), formulaires publics (5 par minute), comptés par IP. Les e-mails déclenchés par un inconnu restent bornés.
- **S9 – Données personnelles** : Redis garde des compteurs par IP, effacés à la fin de chaque fenêtre ; à citer dans la mention de confidentialité (hébergement Upstash, Francfort). Le journal note la règle, sans l'adresse IP.
- **S11 – Messages d'erreur** : le message dit seulement d'attendre, et pour combien de temps.
- La limite s'ajoute aux autres protections : la session et le schéma Zod restent vérifiés dans chaque action.

## Pièges connus

- **Toutes les requêtes locales comptent pour une seule IP** : en local, `x-forwarded-for` est absent et l'identifiant vaut `inconnue`. C'est normal.
- **IP falsifiable hors de Vercel** : Vercel réécrit `x-forwarded-for`. Chez un autre hébergeur, vérifier qui écrit cet en-tête avant de s'y fier.
- **Plusieurs personnes derrière la même IP** (salle de formation, entreprise) : elles partagent la limite. Pendant un atelier, relever les nombres de `REGLES` si besoin.
- **`exigerLimite` placé après un `try`** : le placer en première ligne de l'action, hors de tout `try … catch` ; il arrête l'action avec `returnServerError`.
- **Limiteur recréé à chaque appel** : `obtenirLimiteur` garde les limiteurs d'une requête à l'autre ; en créer un par appel désactive leur cache local.
- **Offre gratuite dépassée** : chaque vérification consomme des commandes Redis ; surveiller le compteur dans la console Upstash.

## Sources

- @upstash/ratelimit 2.2.0, paquet installé : `dist/index.d.ts` (`timeout`, `ephemeralCache`, `RatelimitResponse`, `Duration`) ; `dist/index.mjs` (au bout du délai : `success: true`, raison `timeout`)
- @upstash/redis 1.39.0 : `nodejs.d.ts` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- Upstash : https://upstash.com/pricing/redis (offre gratuite) ; https://upstash.com/docs/devops/developer-api/redis/create_database_global (régions `eu-central-1`, `eu-west-1`)
- Vercel : https://vercel.com/docs/headers/request-headers (`x-forwarded-for` réécrit par la plateforme, `x-real-ip`)
- better-auth : https://www.better-auth.com/docs/concepts/rate-limit (« Server-side requests using `auth.api` bypass rate limiting »)
- next-safe-action 8.7.3 : `dist/index.d.mts` (`returnServerError`)
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/04-functions/headers.md`
- Vérifications locales (squelette du pack + recettes `connexion` et `email`) : `npm run typecheck`, `biome check`, `next build` et Vitest passent, dont le test de panne d'Upstash

## Points à vérifier

- Les libellés exacts de la console Upstash (création d'une base, section REST API) et le sort d'une base gratuite inutilisée longtemps : non précisés par la page des tarifs.
- Le refus effectif au sixième essai, avec une vraie base Upstash : test manuel prévu (US-XXX-1).
- La durée du test de panne en CI (2 secondes au plus grâce à `timeout`) : à allonger si la CI est lente.
