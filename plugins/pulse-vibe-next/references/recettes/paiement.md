# Recette : paiement

> Quand l'utiliser : une personne connectée paie un montant fixe (accès, produit, séance) sur la page de paiement de Stripe, en mode test.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `src/db/db-client.ts` (`getDb()`, type `Db`), `src/config/env.ts` (objet `env`, t3 env), `src/core/shared/result.ts` (`Result`, `ok()`, `echec()`), `src/lib/errors/{erreur-service,reponse-erreur}.ts`, `src/lib/logger.ts`, `tests/helpers/base-de-test.ts` (`creerBaseDeTest()`).
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/queries/utilisateur-connecte.query.ts` (renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session) ;
  - `actionConnectee` dans `src/lib/safe-action.ts` (`ctx.utilisateur` = `{ id, nom }`) ;
  - la table `user` dans `src/db/compte/auth.table.ts` ;
  - le groupe de routes `app/(connecte)/` et le renvoi rapide `proxy.ts` (racine du projet) ;
  - la variable `BETTER_AUTH_URL`.
- La recette `liste` fournit `formaterMontant()` dans `src/lib/helpers/format/format.ts` ; sans elle, ajoutez cette fonction (voir l'étape 9).
- Paquet à installer : `npm install stripe` (dernière version ; recette vérifiée avec 23.0.0, qui épingle la version d'API `2026-09-30.endive` et demande Node.js 20 au moins). Pour les tests : `vitest` et `@electric-sql/pglite`, déjà dans le squelette.
- Un compte Stripe, utilisé **en mode test (bac à sable)** : aucune vraie carte, aucun vrai argent.
- Le Stripe CLI, pour recevoir les webhooks en local : `npm install -g @stripe/cli`, puis `stripe login` (le navigateur s'ouvre pour relier le CLI au compte).
- **Le passage en mode réel est une décision de la personne** : activation du compte Stripe (identité, compte bancaire), clés de production, conditions de vente, mentions légales. La recette s'arrête au mode test.

## Variables d'environnement

| Nom | Rôle | Où la trouver |
|---|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète du mode test (commence par `sk_test_`) | Tableau de bord Stripe → Développeurs → Clés API (`VOTRE_CLE_ICI`) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature des webhooks (commence par `whsec_`) | En local : affiché par `stripe listen`. En ligne : page de la destination de webhook |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` reste inutile : la page de paiement est hébergée par Stripe et le navigateur y arrive par une redirection. Elle servira seulement si un formulaire de carte est intégré au site.

Ajoutez ces lignes dans `server: { … }` de `src/config/env.ts` :

<!-- ajout: src/config/env.ts après: server: { -->
```ts
    STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
```

Pour les tests qui vérifient la validation, ajouter des valeurs de test dans `VARIABLES_VALIDES` de `tests/helpers/env-de-test.ts` (aide du squelette) :

<!-- ajout: tests/helpers/env-de-test.ts après: export const VARIABLES_VALIDES: Record<string, string> = { -->
```ts
  STRIPE_SECRET_KEY: "sk_test_cle-de-test",
  STRIPE_WEBHOOK_SECRET: "whsec_secret-de-test",
```

Ajoutez les deux noms, **sans valeur**, à `.env.example` :

<!-- ajout: .env.example -->
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Le secret de webhook du poste et celui du site en ligne sont **différents** : chacun garde le sien.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | Les deux variables Stripe |
| `src/core/paiement/commande.entity.ts` | Statuts, offre, événement de paiement, résultat de confirmation |
| `src/core/paiement/paiement.errors.ts` | Code de l'erreur attendue (signature invalide) |
| `src/core/paiement/commande-repository.port.ts` | Ce que les use-cases attendent de la base |
| `src/core/paiement/passerelle-paiement.port.ts` | Ce que les use-cases attendent de Stripe |
| `src/core/paiement/use-cases/ouvrir-paiement.use-case.ts` | Crée la commande, ouvre la page de paiement, relie les deux |
| `src/core/paiement/use-cases/confirmer-paiement.use-case.ts` | Ne retient qu'un paiement encaissé, une fois par événement |
| `src/db/paiement/commande.table.ts`, `src/db/paiement/evenement-stripe.table.ts` | Tables `commande` et `evenement_stripe` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/db/paiement/commande.repository.ts` | `commandeRepository(db)` : écritures, lecture, condition de propriété |
| `src/adapters/payment/payment.adapter.ts` | Client Stripe, session de paiement, vérification de signature, pannes en `ErreurService` |
| `src/features/paiement/constants/offre.ts` | Libellé et prix, côté serveur |
| `src/features/paiement/actions/payer.action.ts` | Action `payerAction` |
| `src/features/paiement/webhooks/stripe-paiement.webhook.ts` | Reçoit le message de Stripe, vérifie la signature, déclenche le use-case |
| `src/features/paiement/queries/commande-par-session.query.ts` | La commande de la personne pour une session (`server-only`) |
| `src/features/paiement/components/sections/bouton-payer.tsx`, `statut-paiement.tsx` | Bouton « Payer » et message de la page « Merci » (props) |
| `src/features/paiement/components/containers/bouton-payer.container.tsx` | Branche l'action `payerAction` |
| `src/features/paiement/components/containers/statut-paiement.container.tsx` | Lit la session et la commande |
| `app/api/stripe/webhook/route.ts` | Réception des webhooks (délègue à `features/paiement/webhooks/`) |
| `app/(connecte)/paiement/page.tsx`, `app/(connecte)/paiement/merci/page.tsx` | Pages « Paiement » et « Merci » |
| `proxy.ts` (modifié) | `"/paiement/:path*"` dans le `matcher` |
| `src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts`, `confirmer-paiement.use-case.test.ts` | Tests unitaires des use-cases (doublures en mémoire) |
| `src/adapters/payment/__tests__/payment.adapter.test.ts` | Tests de l'adapter (Stripe doublé, signatures réelles) |
| `src/db/paiement/__tests__/commande.repository.test.ts` | Tests d'intégration avec PGlite |
| `src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts` | Tests du webhook (réponses, journal) |

## Étapes

<!-- commande: npm install stripe -->

Le parcours :

1. La personne clique sur « Payer 19,00 € ». L'action `payerAction` crée une commande `en_attente`, puis une session Stripe Checkout, et redirige vers la page de Stripe.
2. Après le paiement, Stripe renvoie la personne sur `/paiement/merci`, **et** envoie un webhook signé à `/api/stripe/webhook`.
3. Le webhook vérifie la signature, note l'identifiant de l'événement (une seule fois), et passe la commande en `payee`. **Seul le webhook décide qu'une commande est payée** : la page « Merci » lit seulement le statut.

Le domaine s'appelle `paiement` : `src/core/paiement/` (les règles et les ports), `src/db/paiement/` (le stockage en base), `src/features/paiement/` (l'action, le webhook, l'écran). Le service Stripe vit dans `src/adapters/payment/`. Le Route Handler `app/api/stripe/webhook/route.ts` reste fin : il passe la requête au webhook de la feature (architecture.md §7).

### 1. Les variables

Remplissez `STRIPE_SECRET_KEY` dans `.env` ; complétez `src/config/env.ts` et `.env.example`. `STRIPE_WEBHOOK_SECRET` vient à l'étape 11.

### 2. Le métier : entité, erreur et ports

Le métier ne dépend que de `src/core/`. Les deux ports décrivent ce dont les use-cases ont besoin : le repository de l'étape 5 et l'adapter de l'étape 6 les fournissent, et un test passe des doublures en mémoire.

Le prix vit côté serveur (`OFFRE`, étape 7) : le navigateur ne choisit jamais le montant. L'`EvenementPaiement` décrit un message de Stripe déjà vérifié, sans vocabulaire Stripe : l'adapter décide si l'événement est un paiement encaissé et remplit `confirmation` dans ce cas seulement.

<!-- fichier: src/core/paiement/commande.entity.ts -->
```ts
// src/core/paiement/commande.entity.ts
/** « en_attente » : paiement demandé ; « payee » : confirmé par le service de paiement. */
export const STATUTS_COMMANDE = ["en_attente", "payee"] as const;
export type StatutCommande = (typeof STATUTS_COMMANDE)[number];

/** Ce que la personne achète. Le prix vit côté serveur : le navigateur ne choisit jamais le montant. */
export type Offre = {
  libelle: string;
  /** Montant en centimes (entier) : 1900 = 19,00 €. */
  montantCentimes: number;
  devise: string;
};

/**
 * Message reçu du service de paiement, déjà vérifié. `confirmation` n'existe que pour un
 * paiement réellement encaissé ; pour tout autre événement, elle vaut null.
 */
export type EvenementPaiement = {
  id: string;
  type: string;
  confirmation: { commandeId: string; montantCentimes: number } | null;
};

/** « payee » : la commande passe payée ; « deja_traite » : événement déjà reçu ; « ignore » : rien à faire. */
export type ResultatConfirmation = "payee" | "deja_traite" | "ignore";
```

<!-- fichier: src/core/paiement/paiement.errors.ts -->
```ts
// src/core/paiement/paiement.errors.ts
export type ErreurPaiement = "signature-invalide";
```

<!-- fichier: src/core/paiement/commande-repository.port.ts -->
```ts
// src/core/paiement/commande-repository.port.ts
import type { Offre, ResultatConfirmation } from "./commande.entity";

/** Ce dont les use-cases ont besoin pour ranger les commandes en base. */
export type CommandeRepository = {
  /** Crée une commande « en_attente » pour cette personne. */
  creer(donnees: {
    utilisateurId: string;
    offre: Offre;
  }): Promise<{ id: string }>;
  /** Relie la commande de cette personne à la session de paiement. */
  attacherSession(
    id: string,
    utilisateurId: string,
    sessionId: string,
  ): Promise<void>;
  /**
   * Note l'événement (une seule fois) et passe la commande en « payee » si elle est
   * « en_attente » et que le montant payé est le sien, le tout d'un seul bloc.
   */
  enregistrerConfirmation(confirmation: {
    evenementId: string;
    type: string;
    commandeId: string;
    montantCentimes: number;
  }): Promise<ResultatConfirmation>;
};
```

<!-- fichier: src/core/paiement/passerelle-paiement.port.ts -->
```ts
// src/core/paiement/passerelle-paiement.port.ts
import type { Result } from "@src/core/shared/result";
import type { EvenementPaiement, Offre } from "./commande.entity";
import type { ErreurPaiement } from "./paiement.errors";

/** Le service de paiement (Stripe). L'adapter `payment` l'implémente ; un test passe une doublure. */
export type PasserellePaiement = {
  /**
   * Ouvre une page de paiement hébergée. `{SESSION_ID}` dans `urlSucces` est remplacé
   * par l'identifiant de la session.
   */
  creerSession(params: {
    commandeId: string;
    offre: Offre;
    urlSucces: string;
    urlAnnulation: string;
  }): Promise<{ id: string; url: string }>;
  /** Vérifie la signature du message reçu (corps brut) puis le décrit. */
  lireEvenement(
    corps: string,
    signature: string,
  ): Result<EvenementPaiement, ErreurPaiement>;
};
```

### 3. Les use-cases

`ouvrirPaiement` combine la base et Stripe (deux ports), et `confirmerPaiement` garde la règle « seul un paiement encaissé compte » : les deux passent par un use-case (architecture.md §5, point 2). La partie atomique de la confirmation (noter l'événement et passer la commande en `payee` d'un seul bloc) reste dans le repository, car une transaction doit envelopper les deux écritures.

<!-- fichier: src/core/paiement/use-cases/ouvrir-paiement.use-case.ts -->
```ts
// src/core/paiement/use-cases/ouvrir-paiement.use-case.ts
import type { Offre } from "../commande.entity";
import type { CommandeRepository } from "../commande-repository.port";
import type { PasserellePaiement } from "../passerelle-paiement.port";

/** Crée la commande « en_attente », ouvre la page de paiement, puis relie les deux. */
export async function ouvrirPaiement(
  deps: { commandes: CommandeRepository; paiement: PasserellePaiement },
  entree: {
    utilisateurId: string;
    offre: Offre;
    urlSucces: string;
    urlAnnulation: string;
  },
): Promise<{ url: string }> {
  const commande = await deps.commandes.creer({
    utilisateurId: entree.utilisateurId,
    offre: entree.offre,
  });
  const session = await deps.paiement.creerSession({
    commandeId: commande.id,
    offre: entree.offre,
    urlSucces: entree.urlSucces,
    urlAnnulation: entree.urlAnnulation,
  });
  await deps.commandes.attacherSession(
    commande.id,
    entree.utilisateurId,
    session.id,
  );
  return { url: session.url };
}
```

<!-- fichier: src/core/paiement/use-cases/confirmer-paiement.use-case.ts -->
```ts
// src/core/paiement/use-cases/confirmer-paiement.use-case.ts
import type {
  EvenementPaiement,
  ResultatConfirmation,
} from "../commande.entity";
import type { CommandeRepository } from "../commande-repository.port";

/** Seul un paiement réellement encaissé compte ; chaque événement n'est traité qu'une fois. */
export async function confirmerPaiement(
  deps: { commandes: CommandeRepository },
  evenement: EvenementPaiement,
): Promise<ResultatConfirmation> {
  if (!evenement.confirmation) return "ignore";
  return deps.commandes.enregistrerConfirmation({
    evenementId: evenement.id,
    type: evenement.type,
    ...evenement.confirmation,
  });
}
```

### 4. Les tables et leur migration

<!-- fichier: src/db/paiement/commande.table.ts -->
```ts
// src/db/paiement/commande.table.ts
import { STATUTS_COMMANDE } from "@src/core/paiement/commande.entity";
import { user } from "@src/db/compte/auth.table";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const commande = pgTable("commande", {
  id: uuid("id").primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  libelle: text("libelle").notNull(),
  // Montant en centimes (entier) : 1900 = 19,00 €.
  montantCentimes: integer("montant_centimes").notNull(),
  devise: text("devise").notNull().default("eur"),
  statut: text("statut", { enum: STATUTS_COMMANDE })
    .notNull()
    .default("en_attente"),
  stripeSessionId: text("stripe_session_id").unique(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  payeeLe: timestamp("payee_le", { withTimezone: true }),
});
```

<!-- fichier: src/db/paiement/evenement-stripe.table.ts -->
```ts
// src/db/paiement/evenement-stripe.table.ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Un événement Stripe déjà traité ne l'est jamais deux fois (Stripe peut le renvoyer).
export const evenementStripe = pgTable("evenement_stripe", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  recuLe: timestamp("recu_le", { withTimezone: true }).notNull().defaultNow(),
});
```

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs. Générez la migration, relisez le SQL créé dans `drizzle/`, puis appliquez-la :

<!-- commande: npm run db:generate -->
```bash
npm run db:generate
npm run db:migrate
```

### 5. Le repository

Chaque requête qui touche la commande d'une personne commence par la **condition de propriété** (`utilisateurId`, venu de la session). La base arrive en paramètre : `getDb()` dans l'application, PGlite dans les tests.

<!-- fichier: src/db/paiement/commande.repository.ts -->
```ts
// src/db/paiement/commande.repository.ts
import "server-only";
import type {
  Offre,
  ResultatConfirmation,
} from "@src/core/paiement/commande.entity";
import type { Db } from "@src/db/db-client";
import { and, eq } from "drizzle-orm";
import { commande } from "./commande.table";
import { evenementStripe } from "./evenement-stripe.table";

export function commandeRepository(db: Db) {
  return {
    async creer(donnees: {
      utilisateurId: string;
      offre: Offre;
    }): Promise<{ id: string }> {
      const [ligne] = await db
        .insert(commande)
        .values({
          utilisateurId: donnees.utilisateurId,
          libelle: donnees.offre.libelle,
          montantCentimes: donnees.offre.montantCentimes,
          devise: donnees.offre.devise,
        })
        .returning({ id: commande.id });
      return ligne;
    },

    async attacherSession(
      id: string,
      utilisateurId: string,
      sessionId: string,
    ): Promise<void> {
      await db
        .update(commande)
        .set({ stripeSessionId: sessionId })
        .where(
          and(eq(commande.id, id), eq(commande.utilisateurId, utilisateurId)),
        );
    },

    // Un seul bloc : l'événement est noté et la commande mise à jour, ou rien du tout.
    async enregistrerConfirmation(confirmation: {
      evenementId: string;
      type: string;
      commandeId: string;
      montantCentimes: number;
    }): Promise<ResultatConfirmation> {
      return db.transaction(async (tx) => {
        const nouveau = await tx
          .insert(evenementStripe)
          .values({ id: confirmation.evenementId, type: confirmation.type })
          .onConflictDoNothing()
          .returning({ id: evenementStripe.id });
        if (nouveau.length === 0) {
          return "deja_traite";
        }
        // Seule une commande « en_attente », au montant payé, passe « payee ».
        const misesAJour = await tx
          .update(commande)
          .set({ statut: "payee", payeeLe: new Date() })
          .where(
            and(
              eq(commande.id, confirmation.commandeId),
              eq(commande.statut, "en_attente"),
              eq(commande.montantCentimes, confirmation.montantCentimes),
            ),
          )
          .returning({ id: commande.id });
        return misesAJour.length > 0 ? "payee" : "ignore";
      });
    },

    /** La commande de cette personne pour cette session de paiement, ou null. */
    async trouverParSession(sessionId: string, utilisateurId: string) {
      const [ligne] = await db
        .select({
          libelle: commande.libelle,
          statut: commande.statut,
          montantCentimes: commande.montantCentimes,
        })
        .from(commande)
        .where(
          and(
            eq(commande.stripeSessionId, sessionId),
            eq(commande.utilisateurId, utilisateurId),
          ),
        );
      return ligne ?? null;
    },
  };
}
```

### 6. L'adapter de paiement

Le client Stripe et la vérification de signature vivent dans `src/adapters/payment/`. Le client est créé à la première utilisation : la construction du site n'a pas besoin de la clé. Toute panne de Stripe devient une `ErreurService("paiement", …)` : son message est sans secret ni donnée personnelle, et sa `cause` garde seulement des champs techniques (`name`, `type`, `code`, `requestId`, code HTTP), lus un par un, jamais le texte de l'erreur d'origine, qui peut citer une adresse e-mail ou une clé (architecture.md §8). `safe-action` journalise et affiche un message générique ; le webhook de l'étape 8 utilise `reponseErreur()`.

`lireEvenement` reçoit le corps **brut** : la signature porte sur ces octets exacts. Une signature fausse donne `echec("signature-invalide")`, sans lever d'exception.

<!-- fichier: src/adapters/payment/payment.adapter.ts -->
```ts
// src/adapters/payment/payment.adapter.ts
import "server-only";
import { env } from "@src/config/env";
import type { EvenementPaiement } from "@src/core/paiement/commande.entity";
import type { PasserellePaiement } from "@src/core/paiement/passerelle-paiement.port";
import { echec, ok } from "@src/core/shared/result";
import { ErreurService } from "@src/lib/errors/erreur-service";
import Stripe from "stripe";

let client: Stripe | undefined;

// Client créé à la première utilisation : la construction du site n'a pas besoin de la clé.
function obtenirClient(): Stripe {
  client ??= new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

const EVENEMENTS_DE_PAIEMENT = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

/** Un paiement encaissé : un événement de paiement dont la session est « paid » et porte une commande. */
function confirmationDe(
  evenement: Stripe.Event,
): EvenementPaiement["confirmation"] {
  if (!EVENEMENTS_DE_PAIEMENT.has(evenement.type)) {
    return null;
  }
  const session = evenement.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" || !session.client_reference_id) {
    return null;
  }
  return {
    commandeId: session.client_reference_id,
    // Sans montant, aucune commande ne correspond : -1 laisse la commande en attente.
    montantCentimes: session.amount_total ?? -1,
  };
}

/**
 * Champs techniques de l'erreur de Stripe, sans son texte : le texte peut citer une adresse
 * e-mail, un nom ou une clé.
 */
function causeTechnique(erreur: unknown) {
  const brute = (erreur ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    name: texte(brute.name),
    type: texte(brute.type),
    code: texte(brute.code),
    requestId: texte(brute.requestId),
    statusCode:
      typeof brute.statusCode === "number" ? brute.statusCode : undefined,
  };
}

function panneDePaiement(erreur: unknown): ErreurService {
  return new ErreurService("paiement", "Le service de paiement a échoué", {
    cause: causeTechnique(erreur),
  });
}

/**
 * La seule porte de sortie vers Stripe. Toute panne devient une ErreurService("paiement", …)
 * sans secret ni donnée personnelle.
 */
export const passerellePaiement: PasserellePaiement = {
  async creerSession(params) {
    let session: Stripe.Checkout.Session;
    try {
      session = await obtenirClient().checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: params.offre.devise,
              unit_amount: params.offre.montantCentimes,
              product_data: { name: params.offre.libelle },
            },
          },
        ],
        client_reference_id: params.commandeId,
        metadata: { commandeId: params.commandeId },
        locale: "fr",
        success_url: params.urlSucces.replace(
          "{SESSION_ID}",
          "{CHECKOUT_SESSION_ID}",
        ),
        cancel_url: params.urlAnnulation,
      });
    } catch (erreur) {
      throw panneDePaiement(erreur);
    }
    if (!session.url) {
      throw new ErreurService(
        "paiement",
        "Le service de paiement n'a pas donné d'adresse de paiement",
      );
    }
    return { id: session.id, url: session.url };
  },

  // La signature porte sur les octets exacts du corps : il arrive brut, jamais relu ni transformé.
  lireEvenement(corps, signature) {
    const stripe = obtenirClient();
    const secret = env.STRIPE_WEBHOOK_SECRET;
    let evenement: Stripe.Event;
    try {
      evenement = stripe.webhooks.constructEvent(corps, signature, secret);
    } catch {
      return echec("signature-invalide");
    }
    return ok({
      id: evenement.id,
      type: evenement.type,
      confirmation: confirmationDe(evenement),
    });
  },
};
```

### 7. L'offre et l'action qui ouvre le paiement

Adaptez le libellé et le prix au projet.

<!-- fichier: src/features/paiement/constants/offre.ts -->
```ts
// src/features/paiement/constants/offre.ts
import type { Offre } from "@src/core/paiement/commande.entity";

// Le prix vit côté serveur : le navigateur ne choisit jamais le montant.
export const OFFRE: Offre = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
};
```

L'action assemble le use-case avec le repository et l'adapter, puis redirige vers la page de Stripe. `{SESSION_ID}` est remplacé par l'adapter avec l'identifiant de la session.

<!-- fichier: src/features/paiement/actions/payer.action.ts -->
```ts
// src/features/paiement/actions/payer.action.ts
"use server";

import { passerellePaiement } from "@src/adapters/payment/payment.adapter";
import { env } from "@src/config/env";
import { ouvrirPaiement } from "@src/core/paiement/use-cases/ouvrir-paiement.use-case";
import { getDb } from "@src/db/db-client";
import { commandeRepository } from "@src/db/paiement/commande.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { OFFRE } from "../constants/offre";

export const payerAction = actionConnectee.action(async ({ ctx }) => {
  // Adresse du site qui appelle l'action (Next.js vérifie qu'elle est bien la sienne),
  // sinon l'adresse publique déclarée pour better-auth.
  const origine = (await headers()).get("origin") ?? env.BETTER_AUTH_URL;
  const { url } = await ouvrirPaiement(
    { commandes: commandeRepository(getDb()), paiement: passerellePaiement },
    {
      utilisateurId: ctx.utilisateur.id,
      offre: OFFRE,
      urlSucces: `${origine}/paiement/merci?session_id={SESSION_ID}`,
      urlAnnulation: `${origine}/paiement?annule=1`,
    },
  );
  redirect(url);
});
```

### 8. Le webhook

Dans un Route Handler de Next.js 16, le corps brut s'obtient avec `await requete.text()`, lu **une seule fois**, avant toute autre lecture. Le fichier du webhook vérifie la signature par l'adapter, puis appelle le use-case. Une signature fausse répond 400, sans rien écrire du message dans le journal. Une panne (base, Stripe) répond avec `reponseErreur()` : Stripe renvoie alors le message plus tard.

<!-- fichier: src/features/paiement/webhooks/stripe-paiement.webhook.ts -->
```ts
// src/features/paiement/webhooks/stripe-paiement.webhook.ts
import { passerellePaiement } from "@src/adapters/payment/payment.adapter";
import { confirmerPaiement } from "@src/core/paiement/use-cases/confirmer-paiement.use-case";
import { getDb } from "@src/db/db-client";
import { commandeRepository } from "@src/db/paiement/commande.repository";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";
import { logger } from "@src/lib/logger";

/** Reçoit un message de Stripe : signature vérifiée par l'adapter, puis traitement une seule fois par événement. */
export async function recevoirWebhookStripe(
  requete: Request,
): Promise<Response> {
  const signature = requete.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Signature absente.", { status: 400 });
  }
  // Corps brut, lu une seule fois et tel quel : la signature porte sur ces octets exacts.
  const corps = await requete.text();

  try {
    const lecture = passerellePaiement.lireEvenement(corps, signature);
    if (!lecture.ok) {
      // Le journal ne reçoit ni le corps ni la signature.
      logger.warn("Webhook Stripe refusé : signature invalide");
      return new Response("Signature invalide.", { status: 400 });
    }
    const evenement = lecture.valeur;
    const resultat = await confirmerPaiement(
      { commandes: commandeRepository(getDb()) },
      evenement,
    );
    logger.info(
      { evenementId: evenement.id, type: evenement.type, resultat },
      "Webhook Stripe traité",
    );
    return Response.json({ recu: true });
  } catch (erreur) {
    // Une panne répond 500 ou 503 : Stripe renvoie le message plus tard.
    return reponseErreur(erreur, "Webhook Stripe");
  }
}
```

<!-- fichier: app/api/stripe/webhook/route.ts -->
```ts
// app/api/stripe/webhook/route.ts
import { recevoirWebhookStripe } from "@src/features/paiement/webhooks/stripe-paiement.webhook";

export async function POST(requete: Request) {
  return recevoirWebhookStripe(requete);
}
```

### 9. Les écrans

La lecture de la commande passe par une query. Le statut vient de la base, jamais de l'arrivée sur la page.

<!-- fichier: src/features/paiement/queries/commande-par-session.query.ts -->
```ts
// src/features/paiement/queries/commande-par-session.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { commandeRepository } from "@src/db/paiement/commande.repository";

/** La commande de cette personne pour cette session de paiement, ou null (inconnue, ou à quelqu'un d'autre). */
export async function commandeParSession(
  sessionId: string,
  utilisateurId: string,
) {
  return commandeRepository(getDb()).trouverParSession(
    sessionId,
    utilisateurId,
  );
}
```

Les sections affichent ce qu'elles reçoivent en props. Le container (client) appelle `useAction` pour l'action `payerAction`. En cas de succès, l'action redirige vers la page de paiement de Stripe : `hasNavigated` garde le bouton bloqué pendant le départ.

<!-- fichier: src/features/paiement/components/sections/bouton-payer.tsx -->
```tsx
// src/features/paiement/components/sections/bouton-payer.tsx
import { Button } from "@src/components/ui/button";

type Props = {
  libelle: string;
  payer: () => void;
  enCours: boolean;
  erreur?: string;
};

export function BoutonPayer({ libelle, payer, enCours, erreur }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" disabled={enCours} onClick={payer}>
        {enCours ? "Redirection vers le paiement…" : libelle}
      </Button>
      <p aria-live="polite" className="text-sm text-destructive">
        {erreur}
      </p>
    </div>
  );
}
```

<!-- fichier: src/features/paiement/components/containers/bouton-payer.container.tsx -->
```tsx
// src/features/paiement/components/containers/bouton-payer.container.tsx
"use client";

import { useAction } from "next-safe-action/hooks";
import { payerAction } from "../../actions/payer.action";
import { BoutonPayer } from "../sections/bouton-payer";

export function BoutonPayerContainer({ libelle }: { libelle: string }) {
  const { execute, result, isPending, hasNavigated } = useAction(payerAction);
  return (
    <BoutonPayer
      libelle={libelle}
      // En cas de succès, l'action redirige vers la page de paiement de Stripe.
      payer={() => execute()}
      enCours={isPending || hasNavigated}
      erreur={result.serverError}
    />
  );
}
```

<!-- fichier: src/features/paiement/components/sections/statut-paiement.tsx -->
```tsx
// src/features/paiement/components/sections/statut-paiement.tsx
import type { StatutCommande } from "@src/core/paiement/commande.entity";
import Link from "next/link";

type Props = {
  commande: { libelle: string; statut: StatutCommande } | null;
  /** Adresse de la page « Merci » de cette commande, pour revérifier le paiement. */
  adresseActualiser?: string;
};

export function StatutPaiement({ commande, adresseActualiser }: Props) {
  if (!commande) {
    return <p>Commande introuvable.</p>;
  }
  if (commande.statut === "payee") {
    return <p>Paiement reçu : « {commande.libelle} » est activé.</p>;
  }
  return (
    <p>
      Paiement en cours de confirmation.{" "}
      {adresseActualiser && (
        <Link href={adresseActualiser} className="underline">
          Actualiser
        </Link>
      )}
    </p>
  );
}
```

Le container de la page « Merci » lit la session et la commande de la personne connectée.

<!-- fichier: src/features/paiement/components/containers/statut-paiement.container.tsx -->
```tsx
// src/features/paiement/components/containers/statut-paiement.container.tsx
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { commandeParSession } from "../../queries/commande-par-session.query";
import { StatutPaiement } from "../sections/statut-paiement";

export async function StatutPaiementContainer({
  searchParams,
}: {
  searchParams: PageProps<"/paiement/merci">["searchParams"];
}) {
  const utilisateur = await utilisateurConnecte();
  const { session_id: sessionId } = await searchParams;
  if (typeof sessionId !== "string") {
    return <StatutPaiement commande={null} />;
  }
  const commande = await commandeParSession(sessionId, utilisateur.id);
  return (
    <StatutPaiement
      commande={commande}
      adresseActualiser={`/paiement/merci?session_id=${encodeURIComponent(sessionId)}`}
    />
  );
}
```

Les pages restent fines : elles rendent les containers, celui qui lit des données sous `<Suspense>`. `formaterMontant` vient de `src/lib/helpers/format/format.ts` (recette `liste`) ; sans cette recette, créez ce fichier :

<!-- fichier: src/lib/helpers/format/format.ts -->
```ts
// src/lib/helpers/format/format.ts
const formatEuros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function formaterMontant(centimes: number): string {
  return formatEuros.format(centimes / 100);
}
```

<!-- fichier: app/(connecte)/paiement/page.tsx -->
```tsx
// app/(connecte)/paiement/page.tsx
import { BoutonPayerContainer } from "@src/features/paiement/components/containers/bouton-payer.container";
import { OFFRE } from "@src/features/paiement/constants/offre";
import { formaterMontant } from "@src/lib/helpers/format/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paiement" };

export default function PagePaiement() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{OFFRE.libelle}</h1>
      <p>Prix : {formaterMontant(OFFRE.montantCentimes)}, paiement unique.</p>
      <BoutonPayerContainer
        libelle={`Payer ${formaterMontant(OFFRE.montantCentimes)}`}
      />
    </main>
  );
}
```

<!-- fichier: app/(connecte)/paiement/merci/page.tsx -->
```tsx
// app/(connecte)/paiement/merci/page.tsx
import { StatutPaiementContainer } from "@src/features/paiement/components/containers/statut-paiement.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Merci" };

export default function PageMerci({
  searchParams,
}: PageProps<"/paiement/merci">) {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Merci</h1>
      <Suspense fallback={<p>Vérification du paiement…</p>}>
        <StatutPaiementContainer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

### 10. Le renvoi vers la connexion

Dans `proxy.ts` (racine du projet), ajoutez la page au `matcher` (ici à la suite de `/compte`, recette `connexion`) :

<!-- remplacer-ligne: proxy.ts début: matcher: -->
```ts
  matcher: ["/compte/:path*", "/paiement/:path*"],
```

`/api/stripe/webhook` reste hors du `matcher` : Stripe n'a pas de cookie de session. Avec la recette `langues` : voir `connexion`, étape 12.

### 11. Recevoir les webhooks en local

Dans un second terminal, pendant `npm run dev` :

```
stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded
```

Le CLI affiche `Ready! Your webhook signing secret is 'whsec_…'`. La personne copie elle-même ce secret dans `STRIPE_WEBHOOK_SECRET` de `.env`, puis relance `npm run dev`.

### 12. Payer avec les cartes de test

Date d'expiration future, n'importe quel code à 3 chiffres :

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | paiement accepté |
| `4000 0000 0000 3220` | authentification 3D Secure demandée, puis paiement accepté |
| `4000 0000 0000 0002` | refusé (`card_declined`) |
| `4000 0000 0000 9995` | refusé, fonds insuffisants |

### 13. Mettre en ligne (toujours en mode test)

Dans le tableau de bord Stripe, mode test, créez une destination de webhook vers `https://<adresse du site>/api/stripe/webhook`, avec les événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Saisissez dans Vercel `STRIPE_SECRET_KEY` et le secret `whsec_…` **de cette destination**, puis redéployez.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Paiement

  Règle: Un paiement confirmé par Stripe marque la commande payée, une seule fois

    @US-XXX-1 @integration
    Exemple: Paiement de 19 € confirmé : la commande de Camille est payée
      Étant donné Camille a une commande de 19 € en attente
      Quand Stripe confirme le paiement de 19 €
      Alors la commande de Camille est payée

    @US-XXX-1 @unitaire
    Exemple: Un paiement encaissé est transmis aux commandes
      Étant donné Stripe annonce un paiement encaissé
      Quand le serveur traite l'événement
      Alors la confirmation est transmise aux commandes

    @US-XXX-1 @unitaire
    Exemple: Un événement sans paiement encaissé est ignoré
      Étant donné Stripe annonce un événement sans paiement encaissé
      Quand le serveur traite l'événement
      Alors rien n'est transmis aux commandes

    @US-XXX-1 @manuel
    Exemple: Camille paie avec la carte de test 4242 et voit la confirmation
      Étant donné Camille est connectée, en mode test
      Quand Camille paie 19 € avec la carte 4242 4242 4242 4242
      Alors Camille lit « Paiement reçu : « Accès complet » est activé. »

    @US-XXX-2 @integration @securite
    Exemple: Le même événement reçu deux fois est traité une seule fois
      Étant donné Camille a une commande de 19 € en attente
      Quand Stripe envoie deux fois la même confirmation
      Alors la confirmation est traitée une fois, puis reconnue comme déjà traitée

  Règle: Le montant payé doit être celui de la commande

    @US-XXX-3 @integration @securite
    Exemple: Un montant différent de la commande laisse la commande en attente
      Étant donné Camille a une commande de 19 € en attente
      Quand Stripe confirme un paiement de 1 €
      Alors la commande de Camille reste en attente

  Règle: Seuls les messages signés par Stripe sont acceptés

    @US-XXX-4 @unitaire @securite
    Exemple: Un message correctement signé est accepté
      Étant donné un message signé avec le secret du webhook
      Quand le message arrive sur le webhook
      Alors le webhook répond 200

    @US-XXX-4 @unitaire @securite
    Exemple: Un message à la signature fausse est refusé
      Étant donné un message signé avec un autre secret
      Quand le message arrive sur le webhook
      Alors le webhook répond 400

    @US-XXX-4 @unitaire @securite
    Exemple: Un corps modifié après la signature est refusé
      Étant donné un message signé avec le secret du webhook
      Et son contenu est modifié après la signature
      Quand le serveur vérifie le message
      Alors le message est refusé

    @US-XXX-4 @unitaire @securite
    Exemple: Un message sans signature est refusé
      Étant donné un message sans en-tête de signature
      Quand le message arrive sur le webhook
      Alors le webhook répond 400

    @US-XXX-4 @unitaire @securite
    Exemple: Un message refusé n'écrit ni son contenu ni sa signature dans le journal
      Étant donné un message signé avec un autre secret, qui contient l'adresse de Camille
      Quand le message arrive sur le webhook
      Alors le journal note seulement « signature invalide »
      Et le journal ne contient ni l'adresse de Camille ni la signature

  Règle: Seul un paiement encaissé confirme la commande

    @US-XXX-8 @unitaire
    Exemple: Un paiement différé (non payé) ne confirme rien
      Étant donné Stripe annonce une session terminée dont le paiement n'est pas encore encaissé
      Quand le serveur lit le message
      Alors aucune confirmation n'en sort

    @US-XXX-8 @unitaire
    Exemple: Le paiement différé réussi confirme la commande
      Étant donné Stripe annonce un paiement différé réussi
      Quand le serveur lit le message
      Alors la confirmation porte la commande de Camille et le montant payé

    @US-XXX-8 @unitaire
    Exemple: Un autre type d'événement ne confirme rien
      Étant donné Stripe envoie un événement d'un autre type
      Quand le serveur lit le message
      Alors aucune confirmation n'en sort

  Règle: La page de paiement s'ouvre avec le prix du serveur

    @US-XXX-6 @unitaire
    Exemple: Camille ouvre le paiement : sa commande est reliée à la session Stripe
      Étant donné Camille est connectée
      Quand Camille ouvre le paiement
      Alors sa commande est créée et reliée à la session de paiement
      Et Camille reçoit l'adresse de la page de Stripe

    @US-XXX-6 @unitaire
    Exemple: La session est ouverte avec le prix du serveur et l'adresse de retour de Stripe
      Étant donné l'offre « Accès complet » à 19 €
      Quand le serveur ouvre la session de paiement
      Alors la session porte le prix de l'offre et la commande
      Et l'adresse de retour reçoit l'identifiant de la session

  Règle: Une panne est signalée sans secret ni donnée personnelle

    @US-XXX-7 @unitaire @securite
    Exemple: Un refus de Stripe lève une erreur de service « paiement » sans donnée personnelle
      Étant donné Stripe refuse la création de la session avec un message qui cite l'adresse de Camille
      Quand le serveur ouvre la session de paiement
      Alors une erreur de service « paiement » est levée
      Et son message et sa cause ne contiennent ni l'adresse de Camille ni la clé secrète

    @US-XXX-7 @unitaire
    Exemple: Une session sans adresse de paiement est une panne de service
      Étant donné Stripe répond sans adresse de paiement
      Quand le serveur ouvre la session de paiement
      Alors une erreur de service « paiement » est levée

    @US-XXX-7 @unitaire @securite
    Exemple: Une panne de la base répond 500 avec un message générique, et Stripe renverra le message
      Étant donné un message correctement signé
      Et la base est en panne
      Quand le message arrive sur le webhook
      Alors le webhook répond 500 avec un message générique

  Règle: Une personne accède seulement à ses propres commandes

    @US-XXX-9 @integration
    Exemple: Camille retrouve sa commande par la session de paiement
      Étant donné Camille a une commande reliée à une session de paiement
      Quand Camille ouvre la page « Merci » de cette session
      Alors la commande est trouvée

    @US-XXX-9 @integration @securite
    Exemple: Léo ne voit pas la commande de Camille
      Étant donné Camille a une commande reliée à une session de paiement
      Quand Léo ouvre la page « Merci » de cette session
      Alors la commande est introuvable

    @US-XXX-9 @integration @securite
    Exemple: Léo ne peut pas relier sa session à la commande de Camille
      Étant donné Camille a une commande reliée à une session de paiement
      Quand Léo essaie de relier sa propre session à cette commande
      Alors la session de la commande de Camille reste la sienne

  Règle: Une carte refusée ne débloque rien

    @US-XXX-5 @manuel
    Exemple: Carte refusée : la commande reste en attente
      Étant donné Camille est connectée, en mode test
      Quand Camille paie avec la carte 4000 0000 0000 0002
      Alors Stripe affiche un refus et la commande de Camille reste en attente
```

## Tâches de plan prêtes

> US terminée quand : une personne connectée paie sur la page de Stripe (mode test), sa commande passe « payée » grâce au webhook signé, une seule fois, et personne d'autre ne voit sa commande.

- [ ] **Tn – Enregistrer les commandes** · US-XXX
  - Objectif : la base garde les commandes et les événements Stripe déjà traités
  - Dépend de : —
  - Fichiers : à créer : `src/core/paiement/commande.entity.ts`, `paiement.errors.ts`, `commande-repository.port.ts`, `src/db/paiement/commande.table.ts`, `evenement-stripe.table.ts`, `commande.repository.ts`, `src/db/paiement/__tests__/commande.repository.test.ts`, migration dans `drizzle/` · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 1 à 3 et 9 – `npm test` passe ; `npm run db:migrate` crée les tables `commande` et `evenement_stripe`
  - Tests : « Paiement de 19 € confirmé… », « Le même événement reçu deux fois… », « Un montant différent… », « Léo ne voit pas la commande de Camille » (intégration)
  - Action manuelle : créer le compte Stripe, rester en mode test, copier la clé secrète de test dans `.env`
- [ ] **Tn+1 – Payer sur la page de Stripe** · US-XXX
  - Objectif : une personne connectée clique sur « Payer » et arrive sur la page de paiement de Stripe
  - Dépend de : Tn
  - Fichiers : à créer : `src/core/paiement/passerelle-paiement.port.ts`, `src/core/paiement/use-cases/ouvrir-paiement.use-case.ts`, `src/adapters/payment/payment.adapter.ts`, `src/features/paiement/constants/offre.ts`, `actions/payer.action.ts`, `components/sections/bouton-payer.tsx`, `components/containers/bouton-payer.container.tsx`, `app/(connecte)/paiement/page.tsx`, `src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts`, `src/adapters/payment/__tests__/payment.adapter.test.ts` · à modifier : `proxy.ts`
  - Vérification : US-XXX critère 6 – « Payer 19,00 € » ouvre la page Stripe avec « Accès complet » et 19,00 €
  - Tests : « Camille ouvre le paiement… », « La session est ouverte avec le prix du serveur… », « Un refus de Stripe lève une erreur de service « paiement »… » (unitaires) ; le parcours Stripe se vérifie à la main (« Camille paie avec la carte de test 4242… »)
- [ ] **Tn+2 – Confirmer le paiement par webhook** · US-XXX
  - Objectif : un paiement réussi passe la commande en « payée », une seule fois, et la page « Merci » l'affiche
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/core/paiement/use-cases/confirmer-paiement.use-case.ts`, `src/features/paiement/webhooks/stripe-paiement.webhook.ts`, `queries/commande-par-session.query.ts`, `components/sections/statut-paiement.tsx`, `components/containers/statut-paiement.container.tsx`, `app/api/stripe/webhook/route.ts`, `app/(connecte)/paiement/merci/page.tsx`, `src/core/paiement/use-cases/__tests__/confirmer-paiement.use-case.test.ts`, `src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts`
  - Vérification : US-XXX critères 1 à 5 – avec `stripe listen`, payer avec 4242 : « Paiement reçu » ; avec 4000 0000 0000 0002 : refus, commande en attente
  - Tests : « Un message correctement signé est accepté », « Un message à la signature fausse est refusé », « Un message refusé n'écrit ni son contenu ni sa signature dans le journal », « Une panne de la base répond 500… », « Un paiement encaissé est transmis aux commandes », « Un événement sans paiement encaissé est ignoré » (unitaires, doublures) ; « Un paiement différé (non payé) ne confirme rien » (unitaire)
  - Attention : lire le corps avec `requete.text()` avant toute autre lecture ; un `JSON.parse` puis `JSON.stringify` casse la signature
  - Action manuelle : lancer `stripe listen` et copier le secret `whsec_…` dans `.env`
- [ ] **Tn+3 – Recevoir les paiements de test sur le site en ligne** · US-XXX
  - Objectif : le site en ligne confirme les paiements de test
  - Dépend de : Tn+2
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – payer avec 4242 sur le site en ligne : « Paiement reçu »
  - Action manuelle : créer la destination de webhook dans Stripe ; saisir `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans Vercel ; redéployer

## Tests

### Unitaires : use-cases

Les use-cases s'essaient sans base ni réseau : le repository et la passerelle de paiement sont remplacés par des doublures en mémoire. Un fichier par use-case, créé avec lui.

<!-- fichier: src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts -->
```ts
// src/core/paiement/use-cases/__tests__/ouvrir-paiement.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { Offre } from "../../commande.entity";
import type { CommandeRepository } from "../../commande-repository.port";
import type { PasserellePaiement } from "../../passerelle-paiement.port";
import { ouvrirPaiement } from "../ouvrir-paiement.use-case";

const OFFRE: Offre = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
};

/** Doublures en mémoire des deux ports. */
function createSut() {
  const commandes: { id: string; utilisateurId: string; sessionId?: string }[] =
    [];
  const sessionsCreees: { commandeId: string; urlSucces: string }[] = [];

  const repository: CommandeRepository = {
    async creer({ utilisateurId }) {
      const id = `commande-${commandes.length + 1}`;
      commandes.push({ id, utilisateurId });
      return { id };
    },
    async attacherSession(id, utilisateurId, sessionId) {
      const ligne = commandes.find(
        (c) => c.id === id && c.utilisateurId === utilisateurId,
      );
      if (ligne) ligne.sessionId = sessionId;
    },
    async enregistrerConfirmation() {
      throw new Error("non utilisé dans ce test");
    },
  };
  const paiement: PasserellePaiement = {
    async creerSession({ commandeId, urlSucces }) {
      sessionsCreees.push({ commandeId, urlSucces });
      return { id: "cs_test_1", url: "https://paiement.exemple/cs_test_1" };
    },
    lireEvenement() {
      throw new Error("non utilisé dans ce test");
    },
  };

  return {
    async whenCamilleOuvreLePaiement() {
      return ouvrirPaiement(
        { commandes: repository, paiement },
        {
          utilisateurId: "camille-id",
          offre: OFFRE,
          urlSucces: "https://site.exemple/paiement/merci",
          urlAnnulation: "https://site.exemple/paiement",
        },
      );
    },
    thenCommandeReliee() {
      expect(commandes).toEqual([
        {
          id: "commande-1",
          utilisateurId: "camille-id",
          sessionId: "cs_test_1",
        },
      ]);
      expect(sessionsCreees).toEqual([
        {
          commandeId: "commande-1",
          urlSucces: "https://site.exemple/paiement/merci",
        },
      ]);
    },
  };
}

describe("Paiement", () => {
  describe("La page de paiement s'ouvre avec le prix du serveur", () => {
    it("US-XXX-6 – Camille ouvre le paiement : sa commande est reliée à la session Stripe", async () => {
      const sut = createSut();

      const { url } = await sut.whenCamilleOuvreLePaiement();

      expect(url).toBe("https://paiement.exemple/cs_test_1");
      sut.thenCommandeReliee();
    });
  });
});
```

<!-- fichier: src/core/paiement/use-cases/__tests__/confirmer-paiement.use-case.test.ts -->
```ts
// src/core/paiement/use-cases/__tests__/confirmer-paiement.use-case.test.ts
import { describe, expect, it } from "vitest";
import type { ResultatConfirmation } from "../../commande.entity";
import type { CommandeRepository } from "../../commande-repository.port";
import { confirmerPaiement } from "../confirmer-paiement.use-case";

/** Doublure en mémoire du repository. */
function createSut() {
  const confirmations: { evenementId: string; commandeId: string }[] = [];

  const commandes: CommandeRepository = {
    async creer() {
      throw new Error("non utilisé dans ce test");
    },
    async attacherSession() {
      throw new Error("non utilisé dans ce test");
    },
    async enregistrerConfirmation(confirmation) {
      confirmations.push(confirmation);
      return "payee" satisfies ResultatConfirmation;
    },
  };

  return {
    async whenStripeEnvoie(confirmation: boolean) {
      return confirmerPaiement(
        { commandes },
        {
          id: "evt_001",
          type: "checkout.session.completed",
          confirmation: confirmation
            ? { commandeId: "commande-1", montantCentimes: 1900 }
            : null,
        },
      );
    },
    thenConfirmationsTransmises(attendu: number) {
      expect(confirmations).toHaveLength(attendu);
    },
  };
}

describe("Paiement", () => {
  describe("Un paiement confirmé par Stripe marque la commande payée, une seule fois", () => {
    it("US-XXX-1 – Un paiement encaissé est transmis aux commandes", async () => {
      const sut = createSut();

      const resultat = await sut.whenStripeEnvoie(true);

      expect(resultat).toBe("payee");
      sut.thenConfirmationsTransmises(1);
    });

    it("US-XXX-1 – Un événement sans paiement encaissé est ignoré", async () => {
      const sut = createSut();

      const resultat = await sut.whenStripeEnvoie(false);

      expect(resultat).toBe("ignore");
      sut.thenConfirmationsTransmises(0);
    });
  });
});
```

### Unitaires : adapter

Le SDK de Stripe est doublé pour la création de session : l'erreur du service est choisie par le test. Les messages de webhook sont signés avec `generateTestHeaderString` de la bibliothèque Stripe, donc la vérification de signature est réelle. Le secret de test est une simple phrase, sans rapport avec une vraie clé.

<!-- fichier: src/adapters/payment/__tests__/payment.adapter.test.ts -->
```ts
// src/adapters/payment/__tests__/payment.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET_DE_TEST = "secret-de-test-du-webhook";

const etat = vi.hoisted(() => ({ creerSession: vi.fn() }));

// SDK doublé : la création de session répond par la valeur choisie par le test.
vi.mock("stripe", async (importOriginal) => {
  const reel = await importOriginal<typeof import("stripe")>();
  class StripeDouble extends reel.default {
    override checkout = {
      sessions: { create: etat.creerSession },
    } as unknown as Stripe["checkout"];
  }
  return { ...reel, default: StripeDouble };
});
vi.mock("@src/config/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_cle-de-test",
    STRIPE_WEBHOOK_SECRET: SECRET_DE_TEST,
  },
}));

const { passerellePaiement } = await import("../payment.adapter");

const outils = new Stripe("sk_test_cle-de-test");

function messageSigne(evenement: object, secret = SECRET_DE_TEST) {
  const corps = JSON.stringify({ object: "event", ...evenement });
  const signature = outils.webhooks.generateTestHeaderString({
    payload: corps,
    secret,
  });
  return { corps, signature };
}

function paiement(
  statut: "paid" | "unpaid",
  type = "checkout.session.completed",
) {
  return {
    id: "evt_001",
    type,
    data: {
      object: {
        payment_status: statut,
        client_reference_id: "commande-1",
        amount_total: 1900,
      },
    },
  };
}

describe("Paiement", () => {
  beforeEach(() => {
    etat.creerSession.mockReset();
  });

  describe("Seuls les messages signés par Stripe sont acceptés", () => {
    it("US-XXX-4 – Un message correctement signé est accepté", () => {
      const { corps, signature } = messageSigne(paiement("paid"));

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture).toEqual({
        ok: true,
        valeur: {
          id: "evt_001",
          type: "checkout.session.completed",
          confirmation: { commandeId: "commande-1", montantCentimes: 1900 },
        },
      });
    });

    it("US-XXX-4 – Un message à la signature fausse est refusé", () => {
      const { corps, signature } = messageSigne(
        paiement("paid"),
        "autre-secret",
      );

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture).toEqual({ ok: false, raison: "signature-invalide" });
    });

    it("US-XXX-4 – Un corps modifié après la signature est refusé", () => {
      const { corps, signature } = messageSigne(paiement("paid"));

      const lecture = passerellePaiement.lireEvenement(
        corps.replace("1900", "100"),
        signature,
      );

      expect(lecture).toEqual({ ok: false, raison: "signature-invalide" });
    });
  });

  describe("Seul un paiement encaissé confirme la commande", () => {
    it("US-XXX-8 – Un paiement différé (non payé) ne confirme rien", () => {
      const { corps, signature } = messageSigne(paiement("unpaid"));

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture.ok && lecture.valeur.confirmation).toBeNull();
    });

    it("US-XXX-8 – Le paiement différé réussi confirme la commande", () => {
      const { corps, signature } = messageSigne(
        paiement("paid", "checkout.session.async_payment_succeeded"),
      );

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture.ok && lecture.valeur.confirmation).toEqual({
        commandeId: "commande-1",
        montantCentimes: 1900,
      });
    });

    it("US-XXX-8 – Un autre type d'événement ne confirme rien", () => {
      const { corps, signature } = messageSigne(paiement("paid", "ping"));

      const lecture = passerellePaiement.lireEvenement(corps, signature);

      expect(lecture.ok && lecture.valeur.confirmation).toBeNull();
    });
  });

  describe("Une panne du service de paiement est signalée comme une panne de service", () => {
    it("US-XXX-7 – Un refus de Stripe lève une erreur de service « paiement » sans donnée personnelle", async () => {
      etat.creerSession.mockRejectedValue(
        Object.assign(
          new Error(
            "Adresse invalide pour camille@exemple.fr (sk_test_cle-de-test)",
          ),
          {
            type: "StripeInvalidRequestError",
            code: "parameter_invalid_empty",
            statusCode: 400,
            requestId: "req_123",
          },
        ),
      );

      const erreur = await passerellePaiement
        .creerSession({
          commandeId: "commande-1",
          offre: {
            libelle: "Accès complet",
            montantCentimes: 1900,
            devise: "eur",
          },
          urlSucces: "https://site.exemple/merci?session_id={SESSION_ID}",
          urlAnnulation: "https://site.exemple/paiement",
        })
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
      const service = erreur as ErreurService;
      expect(service.service).toBe("paiement");
      expect(service.message).not.toContain("camille");
      // La cause garde les champs techniques, sans le texte de l'erreur d'origine.
      expect(service.cause).toEqual({
        name: "Error",
        type: "StripeInvalidRequestError",
        code: "parameter_invalid_empty",
        requestId: "req_123",
        statusCode: 400,
      });
      expect(JSON.stringify(service.cause)).not.toContain("camille");
      expect(JSON.stringify(service.cause)).not.toContain("sk_test");
    });

    it("US-XXX-7 – Une session sans adresse de paiement est une panne de service", async () => {
      etat.creerSession.mockResolvedValue({ id: "cs_test_1", url: null });

      const erreur = await passerellePaiement
        .creerSession({
          commandeId: "commande-1",
          offre: {
            libelle: "Accès complet",
            montantCentimes: 1900,
            devise: "eur",
          },
          urlSucces: "https://site.exemple/merci",
          urlAnnulation: "https://site.exemple/paiement",
        })
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
    });

    it("US-XXX-6 – La session est ouverte avec le prix du serveur et l'adresse de retour de Stripe", async () => {
      etat.creerSession.mockResolvedValue({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
      });

      const session = await passerellePaiement.creerSession({
        commandeId: "commande-1",
        offre: {
          libelle: "Accès complet",
          montantCentimes: 1900,
          devise: "eur",
        },
        urlSucces: "https://site.exemple/merci?session_id={SESSION_ID}",
        urlAnnulation: "https://site.exemple/paiement",
      });

      expect(session).toEqual({
        id: "cs_test_1",
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
      });
      expect(etat.creerSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          client_reference_id: "commande-1",
          success_url:
            "https://site.exemple/merci?session_id={CHECKOUT_SESSION_ID}",
          cancel_url: "https://site.exemple/paiement",
        }),
      );
    });
  });
});
```

### Intégration : repository (Vitest + PGlite)

Le repository reçoit la base de test : aucune doublure de session ni de `getDb()`.

<!-- fichier: src/db/paiement/__tests__/commande.repository.test.ts -->
```ts
// src/db/paiement/__tests__/commande.repository.test.ts
import type { ResultatConfirmation } from "@src/core/paiement/commande.entity";
import { user } from "@src/db/compte/auth.table";
import type { Db } from "@src/db/db-client";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { commandeRepository } from "../commande.repository";
import { commande } from "../commande.table";

const OFFRE = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
};

function createSut(db: Db) {
  const commandes = commandeRepository(db);
  let commandeId = "";
  let resultats: ResultatConfirmation[] = [];

  return {
    async givenCommandeEnAttenteDeCamille() {
      await db.insert(user).values([
        { id: "camille-id", name: "Camille", email: "camille@exemple.fr" },
        { id: "leo-id", name: "Léo", email: "leo@exemple.fr" },
      ]);
      const creee = await commandes.creer({
        utilisateurId: "camille-id",
        offre: OFFRE,
      });
      commandeId = creee.id;
      await commandes.attacherSession(commandeId, "camille-id", "cs_test_1");
    },
    async whenStripeEnvoie(
      evenementId: string,
      montantCentimes: number,
      nombreDeFois: number,
    ) {
      resultats = [];
      for (let i = 0; i < nombreDeFois; i++) {
        resultats.push(
          await commandes.enregistrerConfirmation({
            evenementId,
            type: "checkout.session.completed",
            commandeId,
            montantCentimes,
          }),
        );
      }
    },
    async whenLeoEssaieDeRelierSaSession() {
      await commandes.attacherSession(commandeId, "leo-id", "cs_pirate");
    },
    async thenStatutEst(statut: "en_attente" | "payee") {
      const [ligne] = await db
        .select()
        .from(commande)
        .where(eq(commande.id, commandeId));
      expect(ligne.statut).toBe(statut);
    },
    thenResultatsSont(attendus: ResultatConfirmation[]) {
      expect(resultats).toEqual(attendus);
    },
    async thenSessionDeCommandeEst(attendue: string) {
      const [ligne] = await db
        .select()
        .from(commande)
        .where(eq(commande.id, commandeId));
      expect(ligne.stripeSessionId).toBe(attendue);
    },
    async thenCommandeVisiblePar(utilisateurId: string, visible: boolean) {
      const ligne = await commandes.trouverParSession(
        "cs_test_1",
        utilisateurId,
      );
      expect(ligne !== null).toBe(visible);
    },
  };
}

describe("Paiement", () => {
  let sut: ReturnType<typeof createSut>;
  let fermer: () => Promise<void>;

  beforeEach(async () => {
    const base = await creerBaseDeTest();
    fermer = base.fermer;
    sut = createSut(base.db);
    await sut.givenCommandeEnAttenteDeCamille();
  });
  afterEach(async () => {
    await fermer();
  });

  describe("Un paiement confirmé par Stripe marque la commande payée, une seule fois", () => {
    it("US-XXX-1 – Paiement de 19 € confirmé : la commande de Camille est payée", async () => {
      await sut.whenStripeEnvoie("evt_001", 1900, 1);
      await sut.thenStatutEst("payee");
    });

    it("US-XXX-2 – Le même événement reçu deux fois est traité une seule fois", async () => {
      await sut.whenStripeEnvoie("evt_002", 1900, 2);
      sut.thenResultatsSont(["payee", "deja_traite"]);
    });
  });

  describe("Le montant payé doit être celui de la commande", () => {
    it("US-XXX-3 – Un montant différent de la commande laisse la commande en attente", async () => {
      await sut.whenStripeEnvoie("evt_003", 100, 1);
      await sut.thenStatutEst("en_attente");
    });
  });

  describe("Une personne accède seulement à ses propres commandes", () => {
    it("US-XXX-9 – Camille retrouve sa commande par la session de paiement", async () => {
      await sut.thenCommandeVisiblePar("camille-id", true);
    });

    it("US-XXX-9 – Léo ne voit pas la commande de Camille", async () => {
      await sut.thenCommandeVisiblePar("leo-id", false);
    });

    it("US-XXX-9 – Léo ne peut pas relier sa session à la commande de Camille", async () => {
      await sut.whenLeoEssaieDeRelierSaSession();
      await sut.thenSessionDeCommandeEst("cs_test_1");
    });
  });
});
```

### Unitaires : webhook

Le test appelle le webhook de la feature avec de vraies signatures. La base, le journal et le use-case sont doublés : le test vérifie les réponses, et que le journal ne reçoit ni le contenu du message ni sa signature.

<!-- fichier: src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts -->
```ts
// src/features/paiement/webhooks/__tests__/stripe-paiement.webhook.test.ts
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET_DE_TEST = "secret-de-test-du-webhook";

const etat = vi.hoisted(() => ({
  confirmer: vi.fn(),
  journal: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@src/config/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_cle-de-test",
    STRIPE_WEBHOOK_SECRET: SECRET_DE_TEST,
  },
}));
vi.mock("@src/db/db-client", () => ({ getDb: () => ({}) }));
vi.mock("@src/lib/logger", () => ({ logger: etat.journal }));
vi.mock("@src/core/paiement/use-cases/confirmer-paiement.use-case", () => ({
  confirmerPaiement: etat.confirmer,
}));

const { recevoirWebhookStripe } = await import("../stripe-paiement.webhook");

const outils = new Stripe("sk_test_cle-de-test");
const corps = JSON.stringify({
  id: "evt_001",
  object: "event",
  type: "ping",
  data: { object: { customer_email: "camille@exemple.fr" } },
});

function requete(signature?: string) {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    body: corps,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function signature(secret: string) {
  return outils.webhooks.generateTestHeaderString({ payload: corps, secret });
}

describe("Paiement", () => {
  beforeEach(() => {
    etat.confirmer.mockReset().mockResolvedValue("ignore");
    etat.journal.warn.mockReset();
    etat.journal.info.mockReset();
    etat.journal.error.mockReset();
  });

  describe("Seuls les messages signés par Stripe sont acceptés", () => {
    it("US-XXX-4 – Un message correctement signé est accepté", async () => {
      const reponse = await recevoirWebhookStripe(
        requete(signature(SECRET_DE_TEST)),
      );

      expect(reponse.status).toBe(200);
      expect(etat.confirmer).toHaveBeenCalledOnce();
    });

    it("US-XXX-4 – Un message à la signature fausse est refusé", async () => {
      const reponse = await recevoirWebhookStripe(
        requete(signature("autre-secret")),
      );

      expect(reponse.status).toBe(400);
      expect(etat.confirmer).not.toHaveBeenCalled();
    });

    it("US-XXX-4 – Un message sans signature est refusé", async () => {
      const reponse = await recevoirWebhookStripe(requete());

      expect(reponse.status).toBe(400);
      expect(etat.confirmer).not.toHaveBeenCalled();
    });

    it("US-XXX-4 – Un message refusé n'écrit ni son contenu ni sa signature dans le journal", async () => {
      const fausse = signature("autre-secret");

      await recevoirWebhookStripe(requete(fausse));

      const journal = JSON.stringify([
        etat.journal.warn.mock.calls,
        etat.journal.info.mock.calls,
        etat.journal.error.mock.calls,
      ]);
      expect(journal).toContain("signature invalide");
      expect(journal).not.toContain("camille@exemple.fr");
      expect(journal).not.toContain(fausse);
    });
  });

  describe("Une panne est signalée sans détail", () => {
    it("US-XXX-7 – Une panne de la base répond 500 avec un message générique, et Stripe renverra le message", async () => {
      etat.confirmer.mockRejectedValue(new Error("connexion perdue"));

      const reponse = await recevoirWebhookStripe(
        requete(signature(SECRET_DE_TEST)),
      );

      expect(reponse.status).toBe(500);
      expect(JSON.stringify(await reponse.json())).not.toContain("connexion");
      expect(etat.journal.error).toHaveBeenCalled();
    });
  });
});
```

Le parcours sur la page de Stripe reste un test manuel : cette page appartient à Stripe et peut changer à tout moment.

## Points de sécurité

- **S1, S2 – Secrets** : `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). Les pannes de Stripe sortent sans secret ni donnée personnelle (`ErreurService` à `cause` technique).
- **S3, S4 – Accès** : `payerAction` est une action connectée ; la commande porte `utilisateurId` venu de la session ; le repository filtre par `utilisateurId` ; la page « Merci » lit seulement une commande de la personne connectée.
- **S5 – Validation** : le prix vient de `OFFRE`, côté serveur ; le webhook compare le montant payé (`amount_total`) au montant de la commande.
- **S10 – Doublons** : l'identifiant d'événement est la clé primaire de `evenement_stripe`, écrit dans la même transaction que la mise à jour ; seule une commande `en_attente` passe en `payee`.
- **S11 – Messages d'erreur** : un webhook mal signé reçoit « Signature invalide. », sans détail, et le journal ne reçoit ni le corps ni la signature, seulement l'identifiant de l'événement pour un message accepté (Stripe ne transmet pas les numéros de carte). Une panne répond par un message générique (`reponseErreur()`).
- Le statut « payée » vient **seulement** du webhook signé, jamais de l'arrivée sur `/paiement/merci`.

## Pièges connus

- **Signature toujours invalide** : le corps a été lu deux fois ou transformé. Lire `await requete.text()` une fois et le passer tel quel à l'adapter.
- **Mauvais secret de webhook** : `stripe listen` donne le secret du poste ; la destination du site en ligne a le sien.
- **« Paiement en cours de confirmation » qui reste affiché en local** : `stripe listen` doit tourner pendant le paiement.
- **Événements en double ou dans le désordre** : Stripe peut renvoyer un événement (jusqu'à trois jours en mode réel, trois fois en quelques heures en bac à sable) et ne garantit pas l'ordre. La table `evenement_stripe` absorbe les doublons.
- **Paiements différés** (prélèvement, virement) : `checkout.session.completed` arrive avec `payment_status` à `unpaid` ; la commande passe en `payee` à l'événement `checkout.session.async_payment_succeeded`.
- **`payment_method_types`** : retiré de la création de session dans stripe 23. Les moyens de paiement se règlent dans le tableau de bord Stripe.
- **Client Stripe créé à la première utilisation** : la construction ne contacte jamais Stripe.
- **Les deux variables Stripe deviennent obligatoires** : `env` les valide au chargement. Renseignez-les dans `.env` (une valeur factice commençant par `sk_` et `whsec_` suffit tant qu'aucun paiement réel n'a lieu) avant de construire ou de lancer le site. Construction de vérification sans elles (CI) : `SKIP_ENV_VALIDATION=1 npm run build`.
- **Commande « en_attente » restée seule** : si Stripe échoue après la création de la commande, la ligne reste « en_attente », sans session. Elle est invisible pour la personne et ne passe jamais « payee » ; une tâche de ménage pourra l'effacer plus tard.
- **Événement ignoré, puis renvoyé** : un événement dont le montant ne correspond pas est noté comme reçu, la commande reste « en_attente ». Si Stripe le renvoie, la réponse est « deja_traite » : la commande ne change pas. Corrigez la cause (montant, commande) puis relancez un **nouveau** paiement.
- **Un webhook en panne répond 500 ou 503** : Stripe renvoie le message plus tard ; la table `evenement_stripe` garantit qu'il ne compte qu'une fois.
- **Langues** : avec la recette `langues`, `success_url` et `cancel_url` restent les adresses françaises (sans préfixe), toujours valides ; les pages vont sous `app/[locale]/(connecte)/paiement/` et `app/api/stripe/` reste à sa place.

## Sources

- stripe 23.0.0, paquet installé : `CHANGELOG.md` (version d'API `2026-09-30.endive`, retrait de `payment_method_types`, Node.js 20) ; `README.md` (client créé à la demande) ; `esm/Webhooks.d.ts` (`constructEvent`, `generateTestHeaderString`)
- Stripe : https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted (événements, `payment_status`, traitement unique, `{CHECKOUT_SESSION_ID}`) ; https://docs.stripe.com/webhooks (doublons, ordre, nouvelles tentatives) ; https://docs.stripe.com/testing (cartes) ; https://docs.stripe.com/stripe-cli/install (`npm install -g @stripe/cli`)
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/03-file-conventions/route.md` (« Webhooks », `request.text()`) ; `01-app/01-getting-started/15-route-handlers.md`
- next-safe-action 8.7.3 : `dist/hooks.d.mts` (`useAction`, `hasNavigated`)
- Vérifications locales du 2026-10-08 (squelette du pack + recettes `connexion`, `liste`, `email`, `fichiers` + cette recette, dans l'architecture hexagonale) : `npm run check`, `npm run typecheck`, `npm test` et `npm run build` passent ; `next start` : le webhook répond 400 sans signature, 400 avec une signature fausse, 200 avec un message signé par `generateTestHeaderString` ; `/paiement` et `/paiement/merci` sans session renvoient vers `/connexion`.

## Points à vérifier

- Un paiement complet avec un vrai compte Stripe en mode test (`stripe listen`, carte 4242) : non exécuté lors de la rédaction.
- L'action `payerAction`, appelée par `useAction`, finit par `redirect()` vers une adresse externe (Stripe) : vérifier que le navigateur part bien sur la page de paiement et que `hasNavigated` garde le bouton bloqué.
- Le délai d'attente de Stripe avant la redirection vers `success_url` (jusqu'à 10 secondes pour laisser le webhook répondre, d'après la documentation de Stripe ; immédiat avec `stripe listen`).
