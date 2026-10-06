# Recette : paiement

> Quand l'utiliser : une personne connectée paie un montant fixe (accès, produit, séance) sur la page de paiement de Stripe, en mode test.

## Prérequis

- Recette `connexion` appliquée (`utilisateurConnecte()`, `actionConnectee`, groupe `src/app/(connecte)/`, variable `BETTER_AUTH_URL`).
- Paquet à installer : `npm install stripe` (dernière version ; recette vérifiée avec 23.0.0, qui épingle la version d'API `2026-09-30.endive` et demande Node.js 20 au moins).
- Un compte Stripe, utilisé **en mode test (bac à sable)** : aucune vraie carte, aucun vrai argent.
- Le Stripe CLI, pour recevoir les webhooks en local : `npm install -g @stripe/cli`, puis `stripe login` (le navigateur s'ouvre pour relier le CLI au compte).
- **Le passage en mode réel est une décision de la personne** : activation du compte Stripe (identité, compte bancaire), clés de production, conditions de vente, mentions légales. La recette s'arrête au mode test.

## Variables d'environnement

| Nom | Rôle | Où la trouver |
|---|---|---|
| `STRIPE_SECRET_KEY` | Clé secrète du mode test (commence par `sk_test_`) | Tableau de bord Stripe → Développeurs → Clés API (`VOTRE_CLE_ICI`) |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature des webhooks (commence par `whsec_`) | En local : affiché par `stripe listen`. En ligne : page de la destination de webhook |

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` reste inutile : la page de paiement est hébergée par Stripe et le navigateur y arrive par une redirection. Elle servira seulement si un formulaire de carte est intégré au site.

Ajouter ces lignes au schéma de `src/lib/env.ts` :

```ts
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
```

Ajouter les deux noms, **sans valeur**, à `.env.example` :

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Le secret de webhook du poste et celui du site en ligne sont **différents** : chacun garde le sien.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/env.ts`, `.env.example` (modifiés) | Les deux variables Stripe |
| `src/db/schema/paiements.ts` | Tables `commande` et `evenement_stripe` |
| `src/db/schema/index.ts` (modifié) | `export * from "./paiements";` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/lib/stripe.ts` | Client Stripe |
| `src/features/paiement/offre.ts` | Libellé et prix, côté serveur |
| `src/features/paiement/actions.ts` | Action `payer` |
| `src/features/paiement/webhook.ts` | `traiterEvenementStripe` |
| `src/features/paiement/queries.ts` | `maCommandeParSession` |
| `src/features/paiement/components/bouton-payer.tsx` | Bouton « Payer » |
| `src/app/api/stripe/webhook/route.ts` | Réception des webhooks |
| `src/app/(connecte)/paiement/page.tsx`, `src/app/(connecte)/paiement/merci/page.tsx` | Pages « Paiement » et « Merci » |
| `src/proxy.ts` (modifié) | `"/paiement/:path*"` dans le `matcher` |
| `src/features/paiement/webhook.test.ts`, `src/app/api/stripe/webhook/route.test.ts` | Tests d'intégration |

## Étapes

Le parcours :

1. La personne clique sur « Payer 19,00 € ». L'action `payer` crée une commande `en_attente`, puis une session Stripe Checkout, et redirige vers la page de Stripe.
2. Après le paiement, Stripe renvoie la personne sur `/paiement/merci`, **et** envoie un webhook signé à `/api/stripe/webhook`.
3. Le webhook vérifie la signature, note l'identifiant de l'événement (une seule fois), et passe la commande en `payee`. **Seul le webhook décide qu'une commande est payée** : la page « Merci » lit seulement le statut.

### 1. Les variables

Remplir `STRIPE_SECRET_KEY` dans `.env` ; compléter `src/lib/env.ts` et `.env.example`. `STRIPE_WEBHOOK_SECRET` vient à l'étape 8.

### 2. Les tables

```ts
// src/db/schema/paiements.ts
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const commande = pgTable("commande", {
  id: uuid("id").primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  libelle: text("libelle").notNull(),
  // Montant en centimes (entier) : 1900 = 19,00 €.
  montantCentimes: integer("montant_centimes").notNull(),
  devise: text("devise").notNull().default("eur"),
  statut: text("statut", { enum: ["en_attente", "payee"] })
    .notNull()
    .default("en_attente"),
  stripeSessionId: text("stripe_session_id").unique(),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  payeeLe: timestamp("payee_le", { withTimezone: true }),
});

// Un événement Stripe déjà traité ne l'est jamais deux fois (Stripe peut le renvoyer).
export const evenementStripe = pgTable("evenement_stripe", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  recuLe: timestamp("recu_le", { withTimezone: true }).notNull().defaultNow(),
});
```

Ajouter `export * from "./paiements";` à `src/db/schema/index.ts`, puis `npm run db:generate`, relire le SQL créé, et `npm run db:migrate`.

### 3. Le client Stripe et l'offre

```ts
// src/lib/stripe.ts
import "server-only";
import Stripe from "stripe";
import { envServeur } from "@/lib/env";

let client: Stripe | undefined;

// Client créé à la première utilisation : la construction du site n'a pas besoin de la clé.
export function stripe(): Stripe {
  client ??= new Stripe(envServeur().STRIPE_SECRET_KEY);
  return client;
}
```

Adapter le libellé et le prix au projet :

```ts
// src/features/paiement/offre.ts
// Le prix vit côté serveur : le navigateur ne choisit jamais le montant.
export const OFFRE = {
  libelle: "Accès complet",
  montantCentimes: 1900,
  devise: "eur",
} as const;

export function formaterMontant(centimes: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(centimes / 100);
}
```

### 4. L'action qui ouvre le paiement

```ts
// src/features/paiement/actions.ts
"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { returnServerError } from "next-safe-action";
import { getDb } from "@/db";
import { commande } from "@/db/schema";
import { envServeur } from "@/lib/env";
import { actionConnectee } from "@/lib/safe-action";
import { stripe } from "@/lib/stripe";
import { OFFRE } from "./offre";

export const payer = actionConnectee.action(async ({ ctx }) => {
  // Adresse du site qui appelle l'action (Next.js vérifie qu'elle est bien la sienne),
  // sinon l'adresse publique déclarée pour better-auth.
  const origine =
    (await headers()).get("origin") ?? envServeur().BETTER_AUTH_URL;
  const db = getDb();
  const [nouvelle] = await db
    .insert(commande)
    .values({
      utilisateurId: ctx.utilisateur.id,
      libelle: OFFRE.libelle,
      montantCentimes: OFFRE.montantCentimes,
      devise: OFFRE.devise,
    })
    .returning({ id: commande.id });

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: OFFRE.devise,
          unit_amount: OFFRE.montantCentimes,
          product_data: { name: OFFRE.libelle },
        },
      },
    ],
    client_reference_id: nouvelle.id,
    metadata: { commandeId: nouvelle.id },
    locale: "fr",
    success_url: `${origine}/paiement/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origine}/paiement?annule=1`,
  });
  if (!session.url) {
    returnServerError("Paiement indisponible pour le moment.");
  }
  await db
    .update(commande)
    .set({ stripeSessionId: session.id })
    .where(eq(commande.id, nouvelle.id));
  redirect(session.url);
});
```

### 5. Le traitement des webhooks

La fonction reçoit la base en paramètre : les tests lui passent une base PGlite.

```ts
// src/features/paiement/webhook.ts
import "server-only";
import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import type { Db } from "@/db";
import { commande, evenementStripe } from "@/db/schema";

export type ResultatTraitement = "payee" | "deja_traite" | "ignore";

const EVENEMENTS_DE_PAIEMENT = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

// Marque la commande payée, une seule fois par événement, quel que soit le nombre d'envois de Stripe.
export async function traiterEvenementStripe(
  db: Db,
  evenement: Stripe.Event,
): Promise<ResultatTraitement> {
  if (!EVENEMENTS_DE_PAIEMENT.has(evenement.type)) {
    return "ignore";
  }
  const session = evenement.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid" || !session.client_reference_id) {
    return "ignore";
  }
  const commandeId = session.client_reference_id;

  return db.transaction(async (tx) => {
    const nouveau = await tx
      .insert(evenementStripe)
      .values({ id: evenement.id, type: evenement.type })
      .onConflictDoNothing()
      .returning({ id: evenementStripe.id });
    if (nouveau.length === 0) {
      return "deja_traite";
    }
    const misesAJour = await tx
      .update(commande)
      .set({ statut: "payee", payeeLe: new Date() })
      .where(
        and(
          eq(commande.id, commandeId),
          eq(commande.statut, "en_attente"),
          eq(commande.montantCentimes, session.amount_total ?? -1),
        ),
      )
      .returning({ id: commande.id });
    return misesAJour.length > 0 ? "payee" : "ignore";
  });
}
```

Dans un Route Handler de Next.js 16, le corps brut s'obtient avec `await requete.text()`, lu **une seule fois**, avant toute autre lecture :

```ts
// src/app/api/stripe/webhook/route.ts
import type Stripe from "stripe";
import { getDb } from "@/db";
import { traiterEvenementStripe } from "@/features/paiement/webhook";
import { envServeur } from "@/lib/env";
import { logger } from "@/lib/logger";
import { stripe } from "@/lib/stripe";

export async function POST(requete: Request) {
  const signature = requete.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Signature absente.", { status: 400 });
  }
  // Corps brut, lu une seule fois et tel quel : la signature porte sur ces octets exacts.
  const corps = await requete.text();

  let evenement: Stripe.Event;
  try {
    evenement = stripe().webhooks.constructEvent(
      corps,
      signature,
      envServeur().STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    logger.warn("Webhook Stripe refusé : signature invalide");
    return new Response("Signature invalide.", { status: 400 });
  }

  const resultat = await traiterEvenementStripe(getDb(), evenement);
  logger.info(
    { evenementId: evenement.id, type: evenement.type, resultat },
    "Webhook Stripe traité",
  );
  return Response.json({ recu: true });
}
```

### 6. Les écrans

```ts
// src/features/paiement/queries.ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { commande } from "@/db/schema";
import { utilisateurConnecte } from "@/features/compte/session";

export async function maCommandeParSession(stripeSessionId: string) {
  const utilisateur = await utilisateurConnecte();
  const [ligne] = await getDb()
    .select({
      libelle: commande.libelle,
      statut: commande.statut,
      montantCentimes: commande.montantCentimes,
    })
    .from(commande)
    .where(
      and(
        eq(commande.stripeSessionId, stripeSessionId),
        eq(commande.utilisateurId, utilisateur.id),
      ),
    );
  return ligne ?? null;
}
```

```tsx
// src/features/paiement/components/bouton-payer.tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { payer } from "../actions";

export function BoutonPayer({ libelle }: { libelle: string }) {
  const [message, setMessage] = useState("");
  const [enCours, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={enCours}
        onClick={() =>
          startTransition(async () => {
            // En cas de succès, l'action redirige vers la page de paiement de Stripe.
            const resultat = await payer();
            if (resultat?.serverError) {
              setMessage(resultat.serverError);
            }
          })
        }
      >
        {enCours ? "Redirection vers le paiement…" : libelle}
      </Button>
      <p aria-live="polite" className="text-sm text-destructive">
        {message}
      </p>
    </div>
  );
}
```

```tsx
// src/app/(connecte)/paiement/page.tsx
import type { Metadata } from "next";
import { BoutonPayer } from "@/features/paiement/components/bouton-payer";
import { formaterMontant, OFFRE } from "@/features/paiement/offre";

export const metadata: Metadata = { title: "Paiement" };

export default function PagePaiement() {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">{OFFRE.libelle}</h1>
      <p>Prix : {formaterMontant(OFFRE.montantCentimes)}, paiement unique.</p>
      <BoutonPayer
        libelle={`Payer ${formaterMontant(OFFRE.montantCentimes)}`}
      />
    </main>
  );
}
```

```tsx
// src/app/(connecte)/paiement/merci/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { maCommandeParSession } from "@/features/paiement/queries";

export const metadata: Metadata = { title: "Merci" };

export default function PageMerci({
  searchParams,
}: PageProps<"/paiement/merci">) {
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Merci</h1>
      <Suspense fallback={<p>Vérification du paiement…</p>}>
        <StatutPaiement searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function StatutPaiement({
  searchParams,
}: Pick<PageProps<"/paiement/merci">, "searchParams">) {
  const { session_id: sessionId } = await searchParams;
  const commande =
    typeof sessionId === "string"
      ? await maCommandeParSession(sessionId)
      : null;
  if (!commande) {
    return <p>Commande introuvable.</p>;
  }
  if (commande.statut === "payee") {
    return <p>Paiement reçu : « {commande.libelle} » est activé.</p>;
  }
  return (
    <p>
      Paiement en cours de confirmation.{" "}
      <Link
        href={`/paiement/merci?session_id=${encodeURIComponent(sessionId as string)}`}
        className="underline"
      >
        Actualiser
      </Link>
    </p>
  );
}
```

### 7. Le renvoi vers la connexion

Dans `src/proxy.ts`, ajouter la page au `matcher` : `"/paiement/:path*"`. `/api/stripe/webhook` reste hors du `matcher` : Stripe n'a pas de cookie de session.

### 8. Recevoir les webhooks en local

Dans un second terminal, pendant `npm run dev` :

```
stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded
```

Le CLI affiche `Ready! Your webhook signing secret is 'whsec_…'`. La personne copie elle-même ce secret dans `STRIPE_WEBHOOK_SECRET` de `.env`, puis relance `npm run dev`.

### 9. Payer avec les cartes de test

Date d'expiration future, n'importe quel code à 3 chiffres :

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | paiement accepté |
| `4000 0000 0000 3220` | authentification 3D Secure demandée, puis paiement accepté |
| `4000 0000 0000 0002` | refusé (`card_declined`) |
| `4000 0000 0000 9995` | refusé, fonds insuffisants |

### 10. Mettre en ligne (toujours en mode test)

Dans le tableau de bord Stripe, mode test, créer une destination de webhook vers `https://<adresse du site>/api/stripe/webhook`, avec les événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Saisir dans Vercel `STRIPE_SECRET_KEY` et le secret `whsec_…` **de cette destination**, puis redéployer.

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

    @US-XXX-4 @integration @securite
    Exemple: Un message correctement signé est accepté
      Étant donné un message signé avec le secret du webhook
      Quand le message arrive sur le webhook
      Alors le webhook répond 200

    @US-XXX-4 @integration @securite
    Exemple: Un message à la signature fausse est refusé
      Étant donné un message signé avec un autre secret
      Quand le message arrive sur le webhook
      Alors le webhook répond 400

  Règle: Une carte refusée ne débloque rien

    @US-XXX-5 @manuel
    Exemple: Carte refusée : la commande reste en attente
      Étant donné Camille est connectée, en mode test
      Quand Camille paie avec la carte 4000 0000 0000 0002
      Alors Stripe affiche un refus et la commande de Camille reste en attente
```

## Tâches de plan prêtes

- [ ] **Tn – Enregistrer les commandes** · US-XXX
  - Objectif : la base garde les commandes et les événements Stripe déjà traités
  - Dépend de : —
  - Fichiers : à créer : `src/db/schema/paiements.ts`, migration, `src/lib/stripe.ts`, `src/features/paiement/offre.ts` · à modifier : `src/db/schema/index.ts`, `src/lib/env.ts`, `.env.example`
  - Vérification : US-XXX critère 1 – `npm run db:migrate` crée les tables `commande` et `evenement_stripe`
  - Tests : aucun
  - Action manuelle : créer le compte Stripe, rester en mode test, copier la clé secrète de test dans `.env`
- [ ] **Tn+1 – Payer sur la page de Stripe** · US-XXX
  - Objectif : une personne connectée clique sur « Payer » et arrive sur la page de paiement de Stripe
  - Dépend de : Tn
  - Fichiers : à créer : `src/features/paiement/actions.ts`, `components/bouton-payer.tsx`, `src/app/(connecte)/paiement/page.tsx` · à modifier : `src/proxy.ts`
  - Vérification : US-XXX critère 1 – « Payer 19,00 € » ouvre la page Stripe avec « Accès complet » et 19,00 €
  - Tests : aucun automatique (parcours Stripe vérifié à la main : « Camille paie avec la carte de test 4242… »)
- [ ] **Tn+2 – Confirmer le paiement par webhook** · US-XXX
  - Objectif : un paiement réussi passe la commande en « payée », une seule fois, et la page « Merci » l'affiche
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/features/paiement/webhook.ts`, `webhook.test.ts`, `queries.ts`, `src/app/api/stripe/webhook/route.ts`, `route.test.ts`, `src/app/(connecte)/paiement/merci/page.tsx`
  - Vérification : US-XXX critères 1 à 5 – avec `stripe listen`, payer avec 4242 : « Paiement reçu » ; avec 4000 0000 0000 0002 : refus, commande en attente
  - Tests : « Paiement de 19 € confirmé… », « Le même événement reçu deux fois… », « Un montant différent… », « Un message correctement signé… », « Un message à la signature fausse… » (intégration)
  - Attention : lire le corps avec `requete.text()` avant toute autre lecture ; un `JSON.parse` puis `JSON.stringify` casse la signature
  - Action manuelle : lancer `stripe listen` et copier le secret `whsec_…` dans `.env`
- [ ] **Tn+3 – Recevoir les paiements de test sur le site en ligne** · US-XXX
  - Objectif : le site en ligne confirme les paiements de test
  - Dépend de : Tn+2
  - Fichiers : aucun
  - Vérification : US-XXX critère 1 – payer avec 4242 sur le site en ligne : « Paiement reçu »
  - Action manuelle : créer la destination de webhook dans Stripe ; saisir `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` dans Vercel ; redéployer

## Tests

### Intégration : traitement des événements (Vitest + PGlite)

```ts
// src/features/paiement/webhook.test.ts
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { commande, user } from "@/db/schema";
import { creerBaseDeTest } from "../../../tests/helpers/base-de-test";
import { type ResultatTraitement, traiterEvenementStripe } from "./webhook";

function createSut(db: Db) {
  let commandeId = "";
  let resultats: ResultatTraitement[] = [];

  function evenement(id: string, montant: number): Stripe.Event {
    return {
      id,
      type: "checkout.session.completed",
      data: {
        object: {
          payment_status: "paid",
          client_reference_id: commandeId,
          amount_total: montant,
        },
      },
    } as unknown as Stripe.Event;
  }

  return {
    async givenCommandeEnAttenteDe(montantCentimes: number) {
      await db.insert(user).values({
        id: "camille-id",
        name: "Camille",
        email: "camille@exemple.fr",
      });
      const [ligne] = await db
        .insert(commande)
        .values({
          utilisateurId: "camille-id",
          libelle: "Accès complet",
          montantCentimes,
        })
        .returning({ id: commande.id });
      commandeId = ligne.id;
    },
    async whenStripeEnvoie(
      evenementId: string,
      montantCentimes: number,
      nombreDeFois: number,
    ) {
      resultats = [];
      for (let i = 0; i < nombreDeFois; i++) {
        resultats.push(
          await traiterEvenementStripe(
            db,
            evenement(evenementId, montantCentimes),
          ),
        );
      }
    },
    async thenStatutEst(statut: "en_attente" | "payee") {
      const [ligne] = await db
        .select()
        .from(commande)
        .where(eq(commande.id, commandeId));
      expect(ligne.statut).toBe(statut);
    },
    thenResultatsSont(attendus: ResultatTraitement[]) {
      expect(resultats).toEqual(attendus);
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
  });
  afterEach(async () => {
    await fermer();
  });

  describe("Un paiement confirmé par Stripe marque la commande payée, une seule fois", () => {
    it("US-XXX-1 – Paiement de 19 € confirmé : la commande de Camille est payée", async () => {
      await sut.givenCommandeEnAttenteDe(1900);
      await sut.whenStripeEnvoie("evt_001", 1900, 1);
      await sut.thenStatutEst("payee");
    });

    it("US-XXX-2 – Le même événement reçu deux fois est traité une seule fois", async () => {
      await sut.givenCommandeEnAttenteDe(1900);
      await sut.whenStripeEnvoie("evt_002", 1900, 2);
      sut.thenResultatsSont(["payee", "deja_traite"]);
    });
  });

  describe("Le montant payé doit être celui de la commande", () => {
    it("US-XXX-3 – Un montant différent de la commande laisse la commande en attente", async () => {
      await sut.givenCommandeEnAttenteDe(1900);
      await sut.whenStripeEnvoie("evt_003", 100, 1);
      await sut.thenStatutEst("en_attente");
    });
  });
});
```

### Intégration : signature du webhook

Le message est signé avec `generateTestHeaderString` de la bibliothèque Stripe. Le secret de test est une simple phrase, sans rapport avec une vraie clé.

```ts
// src/app/api/stripe/webhook/route.test.ts
import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

const SECRET_DE_TEST = "secret-de-test-du-webhook";

vi.mock("@/lib/env", () => ({
  envServeur: () => ({
    STRIPE_SECRET_KEY: "cle-de-test",
    STRIPE_WEBHOOK_SECRET: SECRET_DE_TEST,
  }),
}));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/features/paiement/webhook", () => ({
  traiterEvenementStripe: async () => "ignore",
}));

const { POST } = await import("./route");

function requete(corps: string, signature: string) {
  return new Request("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    body: corps,
    headers: { "stripe-signature": signature },
  });
}

describe("Paiement", () => {
  describe("Seuls les messages signés par Stripe sont acceptés", () => {
    const corps = JSON.stringify({
      id: "evt_001",
      object: "event",
      type: "ping",
      data: { object: {} },
    });
    const outils = new Stripe("cle-de-test");

    it("US-XXX-4 – Un message correctement signé est accepté", async () => {
      const signature = outils.webhooks.generateTestHeaderString({
        payload: corps,
        secret: SECRET_DE_TEST,
      });

      const reponse = await POST(requete(corps, signature));

      expect(reponse.status).toBe(200);
    });

    it("US-XXX-4 – Un message à la signature fausse est refusé", async () => {
      const signature = outils.webhooks.generateTestHeaderString({
        payload: corps,
        secret: "autre-secret",
      });

      const reponse = await POST(requete(corps, signature));

      expect(reponse.status).toBe(400);
    });
  });
});
```

Le parcours sur la page de Stripe reste un test manuel : cette page appartient à Stripe et peut changer à tout moment.

## Points de sécurité

- **S1, S2 – Secrets** : `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`).
- **S3, S4 – Accès** : `payer` est une action connectée ; la commande porte `utilisateurId` venu de la session ; la page « Merci » lit seulement une commande de la personne connectée.
- **S5 – Validation** : le prix vient de `OFFRE`, côté serveur ; le webhook compare le montant payé (`amount_total`) au montant de la commande.
- **S10 – Doublons** : l'identifiant d'événement est la clé primaire de `evenement_stripe`, écrit dans la même transaction que la mise à jour ; seule une commande `en_attente` passe en `payee`.
- **S11 – Messages d'erreur** : un webhook mal signé reçoit « Signature invalide. », sans détail ; le journal note l'identifiant de l'événement (Stripe ne transmet pas les numéros de carte).
- Le statut « payée » vient **seulement** du webhook signé, jamais de l'arrivée sur `/paiement/merci`.

## Pièges connus

- **Signature toujours invalide** : le corps a été lu deux fois ou transformé. Lire `await requete.text()` une fois et le passer tel quel à `constructEvent`.
- **Mauvais secret de webhook** : `stripe listen` donne le secret du poste ; la destination du site en ligne a le sien.
- **« Paiement en cours de confirmation » qui reste affiché en local** : `stripe listen` doit tourner pendant le paiement.
- **Événements en double ou dans le désordre** : Stripe peut renvoyer un événement (jusqu'à trois jours en mode réel, trois fois en quelques heures en bac à sable) et ne garantit pas l'ordre. La table `evenement_stripe` absorbe les doublons.
- **Paiements différés** (prélèvement, virement) : `checkout.session.completed` arrive avec `payment_status` à `unpaid` ; la commande passe en `payee` à l'événement `checkout.session.async_payment_succeeded`.
- **`payment_method_types`** : retiré de la création de session dans stripe 23. Les moyens de paiement se règlent dans le tableau de bord Stripe.
- **Clé lue pendant la construction** : `stripe()` crée le client à la première utilisation ; `next build` passe sans `STRIPE_SECRET_KEY`.
- **Langues** : avec la recette `langues`, `success_url` et `cancel_url` restent les adresses françaises (sans préfixe), toujours valides.

## Sources

- stripe 23.0.0, paquet installé : `CHANGELOG.md` (version d'API `2026-09-30.endive`, retrait de `payment_method_types`, Node.js 20) ; `README.md` (client créé à la demande) ; `esm/Webhooks.d.ts` (`constructEvent`, `generateTestHeaderString`)
- Stripe : https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted (événements, `payment_status`, traitement unique, `{CHECKOUT_SESSION_ID}`) ; https://docs.stripe.com/webhooks (doublons, ordre, nouvelles tentatives) ; https://docs.stripe.com/testing (cartes) ; https://docs.stripe.com/stripe-cli/install (`npm install -g @stripe/cli`)
- Next.js 16.4, documentation embarquée : `01-app/03-api-reference/03-file-conventions/route.md` (« Webhooks », `request.text()`) ; `01-app/01-getting-started/15-route-handlers.md`
- Vérifications locales (squelette du pack + recette `connexion`) : `npm run typecheck`, `biome check`, `next build` et Vitest passent ; `next start` : le webhook répond 400 sans signature, 400 avec une signature fausse, 200 avec un message signé par `generateTestHeaderString` ; `/paiement` sans session renvoie vers `/connexion`

## Points à vérifier

- Un paiement complet avec un vrai compte Stripe en mode test (`stripe listen`, carte 4242) : non exécuté lors de la rédaction.
- L'action `payer`, appelée dans `startTransition`, finit par `redirect()` vers une adresse externe (Stripe) : vérifier que le navigateur part bien sur la page de paiement.
- Le délai d'attente de Stripe avant la redirection vers `success_url` (jusqu'à 10 secondes pour laisser le webhook répondre, d'après la documentation de Stripe ; immédiat avec `stripe listen`).
