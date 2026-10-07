# Recette : mesure-reelle

> Quand l'utiliser : le site est en ligne et la personne veut connaître la vitesse vécue par ses vrais visiteurs (affichage du contenu principal, réaction aux clics, stabilité), page par page, sans attendre les données publiées par Google.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`), mis en ligne sur Vercel (`/pulse:deploy`).
- Deux options ; la personne choisit (AskUserQuestion), après lecture de leurs limites :

| | A. Speed Insights de Vercel | B. Mesure envoyée au site lui-même |
|---|---|---|
| Mise en place | un paquet, une ligne dans le layout, un réglage dans Vercel | une table, une route, un composant (code ci-dessous, testé) |
| Coût | gratuit jusqu'à 10 000 mesures sur 30 jours glissants pour toute l'équipe (une visite en envoie 3 à 6) ; au-delà, collecte arrêtée au moins 14 jours | gratuit (base Neon déjà en place) |
| Ce que l'on voit | offre gratuite : seulement le « Real Experience Score » dans le tableau de bord ; le détail par mesure et par page demande Speed Insights Plus (offre Pro, payante) | le 75e centile de chaque mesure, par page, lu dans Neon (SQL Editor) |
| Navigations internes | premier chargement de la visite seulement | aussi les changements de page sans rechargement (Chrome récents) |
| Données | chez Vercel ; anonymes (ni IP ni identifiant) | dans votre base ; anonymes, effacées après 90 jours |
| Recommandé pour | voir une tendance générale sans code | lire les chiffres par page, garder les données chez soi |

- Option B : `DATABASE_URL` et `DATABASE_URL_DIRECT` remplies (`.env` et Vercel), comme pour toute table.
- Paquets : option A, `npm install @vercel/speed-insights` (dernière version ; recette vérifiée avec 2.0.0). Option B : aucun paquet ; `useReportWebVitals` est fourni par Next.js 16.4.

## Variables d'environnement

Aucune nouvelle variable.

## Fichiers créés ou modifiés

| Fichier | Option | Rôle |
|---|---|---|
| `src/app/layout.tsx` (modifié) | A et B | Ajoute `<SpeedInsights />` (A) ou `<MesureVitesse />` (B) |
| `src/db/schema/vitesse.ts` | B | Table `mesures_vitesse` |
| `src/db/schema/index.ts` (modifié) | B | `export * from "./vitesse";` |
| `drizzle/<numéro>_<nom>.sql` | B | Migration générée par `npm run db:generate` |
| `src/features/vitesse/regles.ts` | B | Mesures acceptées, durée de conservation, chemin sans identifiant (fonction pure) |
| `src/features/vitesse/schemas.ts` | B | Schéma Zod d'une mesure reçue |
| `src/features/vitesse/queries.ts` | B | Enregistrer, effacer les anciennes, 75e centile par page |
| `src/app/api/vitesse/route.ts` | B | Route qui reçoit les mesures des navigateurs |
| `src/features/vitesse/components/mesure-vitesse.tsx` | B | Composant client qui mesure et envoie |
| `src/features/vitesse/regles.test.ts`, `queries.test.ts`, `src/app/api/vitesse/route.test.ts` | B | Tests unitaires et d'intégration |
| Mention de confidentialité du site (modifiée) | A et B | Mesure de la vitesse, anonyme |

## Étapes

### Option A – Speed Insights de Vercel

1. Dans Vercel : le projet → onglet **Speed Insights** → **Enable** (libellés à vérifier à l'écran).
2. `npm install @vercel/speed-insights`.
3. Dans `src/app/layout.tsx`, importer le composant et le placer dans `<body>`, après `{children}` :

```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
```

```tsx
        <Toaster />
        <SpeedInsights />
```

4. `npm run build` (le composant gère seul son `<Suspense>` : la page d'accueil reste statique), `/pulse:commit`, puis mise en ligne (`/pulse:deploy`). Le script se charge depuis le site lui-même (`/_vercel/speed-insights/script.js`) et ne mesure rien en développement.
5. Les premières données apparaissent dans l'onglet Speed Insights après quelques visites réelles.

### Option B – Mesure envoyée au site

#### 1. La table et sa migration

```ts
// src/db/schema/vitesse.ts
import {
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Mesures de vitesse envoyées par les navigateurs des visiteurs : anonymes (ni IP, ni compte, ni adresse complète).
export const mesuresVitesse = pgTable(
  "mesures_vitesse",
  {
    id: uuid().primaryKey().defaultRandom(),
    page: text().notNull(),
    mesure: text().notNull(),
    valeur: doublePrecision().notNull(),
    note: text().notNull(),
    navigation: text(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("mesures_vitesse_cree_le_idx").on(table.creeLe)],
);
```

Ajouter `export * from "./vitesse";` à `src/db/schema/index.ts`. Puis générer la migration, relire le fichier SQL créé dans `drizzle/`, et l'appliquer :

```bash
npm run db:generate
npm run db:migrate
```

#### 2. Les règles et le schéma

Les adresses passent par `normaliserChemin` : un segment qui ressemble à un identifiant devient `[id]`. Les mesures se regroupent ainsi par gabarit, et aucune adresse enregistrée ne désigne une personne ou un document.

```ts
// src/features/vitesse/regles.ts
// Règles pures de la mesure réelle : testées en unitaire.

export const MESURES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export const NOTES = ["good", "needs-improvement", "poor"] as const;
export const DUREE_CONSERVATION_JOURS = 90;

// Un segment d'adresse qui ressemble à un identifiant (nombre, uuid, jeton) devient « [id] » :
// les mesures se regroupent par gabarit, et aucune adresse ne désigne une personne ou un document.
const IDENTIFIANT = /^(\d+|[0-9a-f]{8}-[0-9a-f-]{27}|(?=.*\d)[\w-]{16,})$/i;

export function normaliserChemin(adresse: string): string {
  const chemin = adresse.split(/[?#]/)[0] ?? "";
  const segments = chemin
    .split("/")
    .filter(Boolean)
    .map((s) => (IDENTIFIANT.test(s) ? "[id]" : s.slice(0, 60)));
  return `/${segments.join("/")}`.slice(0, 200);
}
```

```ts
// src/features/vitesse/schemas.ts
import { z } from "zod";
import { MESURES, NOTES } from "./regles";

// Ce que le navigateur envoie pour une mesure (une ligne par mesure et par page vue).
export const schemaMesureVitesse = z.object({
  page: z.string().min(1).max(300),
  mesure: z.enum(MESURES),
  valeur: z.number().finite().min(0).max(600_000),
  note: z.enum(NOTES),
  navigation: z.string().max(30).optional(),
});

export type MesureVitesse = z.infer<typeof schemaMesureVitesse>;
```

#### 3. L'accès à la base

```ts
// src/features/vitesse/queries.ts
import "server-only";
import { lt, sql } from "drizzle-orm";
import { type Db, getDb } from "@/db";
import { mesuresVitesse } from "@/db/schema";
import { DUREE_CONSERVATION_JOURS } from "./regles";
import type { MesureVitesse } from "./schemas";

export async function enregistrerMesure(
  mesure: MesureVitesse,
  db: Db = getDb(),
): Promise<void> {
  await db.insert(mesuresVitesse).values(mesure);
}

/** Efface les mesures plus anciennes que la durée de conservation. */
export async function effacerMesuresAnciennes(
  maintenant: Date,
  db: Db = getDb(),
): Promise<void> {
  const limite = new Date(
    maintenant.getTime() - DUREE_CONSERVATION_JOURS * 86_400_000,
  );
  await db.delete(mesuresVitesse).where(lt(mesuresVitesse.creeLe, limite));
}

export type LigneP75 = {
  page: string;
  mesure: string;
  p75: number;
  nombre: number;
};

/** 75e centile par page et par mesure sur les derniers jours (même calcul que Google). */
export async function p75ParPage(
  depuis: Date,
  db: Db = getDb(),
): Promise<LigneP75[]> {
  return db
    .select({
      page: mesuresVitesse.page,
      mesure: mesuresVitesse.mesure,
      p75: sql<number>`percentile_cont(0.75) within group (order by ${mesuresVitesse.valeur})`.mapWith(
        Number,
      ),
      nombre: sql<number>`count(*)`.mapWith(Number),
    })
    .from(mesuresVitesse)
    .where(sql`${mesuresVitesse.creeLe} >= ${depuis}`)
    .groupBy(mesuresVitesse.page, mesuresVitesse.mesure)
    .orderBy(mesuresVitesse.page, mesuresVitesse.mesure);
}
```

#### 4. La route qui reçoit les mesures

Elle accepte seulement les envois venant des pages du site (en-tête `Origin`), de petite taille, au format attendu ; elle efface au passage les mesures de plus de 90 jours.

```ts
// src/app/api/vitesse/route.ts
import type { NextRequest } from "next/server";
import {
  effacerMesuresAnciennes,
  enregistrerMesure,
} from "@/features/vitesse/queries";
import { normaliserChemin } from "@/features/vitesse/regles";
import { schemaMesureVitesse } from "@/features/vitesse/schemas";
import { logger } from "@/lib/logger";

const TAILLE_MAX = 2_000;

// Reçoit une mesure envoyée par le navigateur d'un visiteur (navigator.sendBeacon).
export async function POST(request: NextRequest) {
  // Seulement depuis les pages du site lui-même.
  const origine = request.headers.get("origin");
  if (origine && origine !== request.nextUrl.origin) {
    return new Response(null, { status: 403 });
  }
  const texte = await request.text();
  if (texte.length > TAILLE_MAX) {
    return new Response(null, { status: 413 });
  }
  let corps: unknown;
  try {
    corps = JSON.parse(texte);
  } catch {
    return new Response(null, { status: 400 });
  }
  const lu = schemaMesureVitesse.safeParse(corps);
  if (!lu.success) {
    return new Response(null, { status: 400 });
  }
  try {
    await enregistrerMesure({
      ...lu.data,
      page: normaliserChemin(lu.data.page),
    });
    await effacerMesuresAnciennes(new Date());
  } catch (erreur) {
    logger.error({ err: erreur }, "Mesure de vitesse non enregistrée");
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
```

#### 5. Le composant qui mesure

`useReportWebVitals` donne les mesures du navigateur ; `navigator.sendBeacon` les envoie même quand le visiteur quitte la page. Rien n'est envoyé en développement.

```tsx
// src/features/vitesse/components/mesure-vitesse.tsx
"use client";

import { useReportWebVitals } from "next/web-vitals";
import { MESURES } from "../regles";

type Rapport = Parameters<typeof useReportWebVitals>[0];

const ADRESSE = "/api/vitesse";

// Fonction définie hors du composant : sa référence ne change pas (évite les envois en double).
const envoyer: Rapport = (metric) => {
  if (process.env.NODE_ENV !== "production") return;
  if (!(MESURES as readonly string[]).includes(metric.name)) return;
  const page = metric.navigationURL
    ? new URL(metric.navigationURL, window.location.href).pathname
    : window.location.pathname;
  const corps = JSON.stringify({
    page,
    mesure: metric.name,
    valeur: metric.value,
    note: metric.rating,
    navigation: metric.navigationType,
  });
  if (navigator.sendBeacon?.(ADRESSE, corps)) return;
  fetch(ADRESSE, { method: "POST", body: corps, keepalive: true }).catch(() => {
    // Mesure perdue : sans effet pour le visiteur.
  });
};

/** Mesure la vitesse vécue par chaque visiteur et l'envoie au site (sans service tiers). */
export function MesureVitesse() {
  useReportWebVitals(envoyer);
  return null;
}
```

Dans `src/app/layout.tsx` :

```tsx
import { MesureVitesse } from "@/features/vitesse/components/mesure-vitesse";
```

```tsx
        <Toaster />
        <MesureVitesse />
```

#### 6. Mettre en ligne, puis lire les chiffres

`npm run build`, `/pulse:commit`, `/pulse:deploy` (la migration s'applique sur la base de production avant, avec l'accord de la personne : `npm run db:migrate`). Après quelques jours de visites, dans la console Neon → **SQL Editor**, la personne colle cette requête (75e centile des 28 derniers jours, par page) :

```sql
select page, mesure,
       round(percentile_cont(0.75) within group (order by valeur)::numeric, 2) as p75,
       count(*) as nombre
from mesures_vitesse
where cree_le >= now() - interval '28 days'
group by page, mesure
order by page, mesure;
```

Lecture : LCP, FCP, TTFB et INP en millisecondes, CLS sans unité ; seuils de `pulse-aidd reference performance.md`. Une ligne avec moins d'une cinquantaine de mesures se lit comme une indication. `p75ParPage` fait le même calcul, pour une future page d'administration.

### Mention de confidentialité (A et B)

Ajouter à la mention de confidentialité du site (modèle : `pulse-aidd modele confidentialite.md`) : « Pour améliorer la vitesse du site, votre navigateur envoie des mesures de temps d'affichage, anonymes : la page vue, la mesure, sa valeur, sans cookie ni adresse IP ni identifiant. » Préciser l'hébergement (option A : Vercel ; option B : la base du site, Neon, Francfort) et la durée (option B : 90 jours). Une mesure d'audience anonyme de ce type relève en principe de l'exemption de consentement de la CNIL ; la formulation reste à valider par la personne.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Mesure réelle de la vitesse

  Règle: Les mesures se regroupent par gabarit, sans identifiant

    @US-XXX-1 @unitaire
    Exemple: Adresse d'une facture : l'identifiant devient [id]
      Étant donné une mesure prise sur « /factures/3f2b8c1e-9d4a-4c7b-a1e2-0b9c8d7e6f50?tri=date »
      Quand l'adresse est préparée pour l'enregistrement
      Alors la page enregistrée est « /factures/[id] »

    @US-XXX-1 @unitaire
    Exemple: Page ordinaire : le chemin reste lisible
      Étant donné une mesure prise sur « /tarifs/offre-pro »
      Quand l'adresse est préparée pour l'enregistrement
      Alors la page enregistrée est « /tarifs/offre-pro »

  Règle: Seules des mesures valides, venues du site, sont acceptées

    @US-XXX-2 @unitaire @securite
    Exemple: Mesure valide envoyée par le site : enregistrée sans identifiant
      Étant donné le navigateur d'un visiteur envoie un INP de 180 ms pour « /factures/1234 »
      Quand la route reçoit la mesure
      Alors elle répond 204 et enregistre la page « /factures/[id] »

    @US-XXX-2 @unitaire @securite
    Exemple: Envoi depuis un autre site ou corps illisible : refusé
      Étant donné un envoi depuis « https://autre.example », un corps qui n'est pas du JSON, ou un corps de 3 000 caractères
      Quand la route le reçoit
      Alors elle répond 403, 400 ou 413 et n'enregistre rien

  Règle: Les chiffres se lisent au 75e centile, et les anciennes mesures s'effacent

    @US-XXX-3 @integration
    Exemple: Quatre LCP sur l'accueil : le 75e centile est calculé par page
      Étant donné des LCP de 1 000, 2 000, 3 000 et 4 000 ms sur « / »
      Quand le 75e centile des 28 derniers jours est calculé
      Alors l'accueil affiche 3 250 ms sur 4 mesures

    @US-XXX-3 @integration
    Exemple: Mesure de plus de 90 jours : effacée
      Étant donné une mesure de 91 jours et une de 89 jours
      Quand les anciennes mesures sont effacées
      Alors seule celle de 89 jours reste

    @US-XXX-4 @manuel
    Exemple: Visite réelle : les mesures arrivent dans la base
      Étant donné le site en ligne avec la mesure réelle
      Quand Camille ouvre deux pages sur son téléphone, puis ferme l'onglet
      Alors la requête du SQL Editor de Neon montre des lignes pour ces deux pages
```

## Tâches de plan prêtes

- [ ] **Tn – Mesurer la vitesse chez les vrais visiteurs** · US-XXX
  - Objectif : chaque visite envoie ses mesures de vitesse au site, anonymes, lisibles par page
  - Dépend de : —
  - Fichiers : à créer : `src/db/schema/vitesse.ts`, `src/features/vitesse/regles.ts`, `schemas.ts`, `queries.ts`, `components/mesure-vitesse.tsx`, `src/app/api/vitesse/route.ts`, les trois fichiers de test, migration dans `drizzle/` · à modifier : `src/db/schema/index.ts`, `src/app/layout.tsx`, mention de confidentialité
  - Vérification : US-XXX critères 1 à 3 – `npm test` passe ; `npm run build` garde l'accueil statique (○)
  - Tests : « Adresse d'une facture… », « Page ordinaire… », « Mesure valide envoyée par le site… », « Envoi depuis un autre site… » (unitaires) ; « Quatre LCP sur l'accueil… », « Mesure de plus de 90 jours… » (intégration) ; « Visite réelle… » (manuel)
  - Action manuelle : appliquer la migration en production (`npm run db:migrate`), puis, après quelques jours, lancer la requête dans le SQL Editor de Neon

## Tests

Unitaires (règles, schéma, route avec l'accès à la base remplacé) et intégration (PGlite, vraies migrations) :

```ts
// src/features/vitesse/regles.test.ts
import { describe, expect, it } from "vitest";
import { normaliserChemin } from "./regles";
import { schemaMesureVitesse } from "./schemas";

describe("Mesure réelle de la vitesse", () => {
  describe("Les mesures se regroupent par gabarit, sans identifiant", () => {
    it("US-XXX-1 – Adresse d'une facture : l'identifiant devient [id]", () => {
      expect(
        normaliserChemin(
          "/factures/3f2b8c1e-9d4a-4c7b-a1e2-0b9c8d7e6f50?tri=date#haut",
        ),
      ).toBe("/factures/[id]");
      expect(normaliserChemin("/commandes/1234/recu")).toBe(
        "/commandes/[id]/recu",
      );
    });

    it("US-XXX-1 – Page ordinaire : le chemin reste lisible", () => {
      expect(normaliserChemin("/")).toBe("/");
      expect(normaliserChemin("/tarifs/offre-pro")).toBe("/tarifs/offre-pro");
    });
  });

  describe("Seules des mesures valides sont acceptées", () => {
    it("US-XXX-2 – Mesure LCP valide : acceptée", () => {
      const lu = schemaMesureVitesse.safeParse({
        page: "/",
        mesure: "LCP",
        valeur: 2100.5,
        note: "good",
        navigation: "navigate",
      });
      expect(lu.success).toBe(true);
    });

    it("US-XXX-2 – Mesure inconnue ou valeur absurde : refusée", () => {
      for (const corps of [
        { page: "/", mesure: "FID", valeur: 10, note: "good" },
        { page: "/", mesure: "LCP", valeur: -1, note: "good" },
        { page: "/", mesure: "LCP", valeur: 9e9, note: "good" },
      ]) {
        expect(schemaMesureVitesse.safeParse(corps).success).toBe(false);
      }
    });
  });
});
```

```ts
// src/app/api/vitesse/route.test.ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enregistrees: unknown[] = [];
vi.mock("@/features/vitesse/queries", () => ({
  enregistrerMesure: async (m: unknown) => {
    enregistrees.push(m);
  },
  effacerMesuresAnciennes: async () => {},
}));

const { POST } = await import("./route");

function requete(corps: string, origine = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/vitesse", {
    method: "POST",
    body: corps,
    headers: { origin: origine, "content-type": "text/plain;charset=UTF-8" },
  });
}

beforeEach(() => {
  enregistrees.length = 0;
});

describe("Route de réception des mesures", () => {
  it("US-XXX-2 – Mesure valide envoyée par le site : enregistrée sans identifiant", async () => {
    const reponse = await POST(
      requete(
        JSON.stringify({
          page: "/factures/1234",
          mesure: "INP",
          valeur: 180,
          note: "good",
        }),
      ),
    );

    expect(reponse.status).toBe(204);
    expect(enregistrees).toEqual([
      { page: "/factures/[id]", mesure: "INP", valeur: 180, note: "good" },
    ]);
  });

  it("US-XXX-2 – Envoi depuis un autre site ou corps illisible : refusé", async () => {
    const corps = JSON.stringify({
      page: "/",
      mesure: "LCP",
      valeur: 1,
      note: "good",
    });

    expect((await POST(requete(corps, "https://autre.example"))).status).toBe(
      403,
    );
    expect((await POST(requete("pas du json"))).status).toBe(400);
    expect((await POST(requete("x".repeat(3000)))).status).toBe(413);
    expect(enregistrees).toEqual([]);
  });
});
```

```ts
// src/features/vitesse/queries.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/db";
import { mesuresVitesse } from "@/db/schema";
import { creerBaseDeTest } from "../../../tests/helpers/base-de-test";
import {
  effacerMesuresAnciennes,
  enregistrerMesure,
  p75ParPage,
} from "./queries";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
});

afterEach(async () => {
  await fermer();
});

const JOUR = 86_400_000;

describe("Mesure réelle : enregistrement et lecture", () => {
  it("US-XXX-3 – Quatre LCP sur l'accueil : le 75e centile est calculé par page", async () => {
    for (const valeur of [1000, 2000, 3000, 4000]) {
      await enregistrerMesure(
        { page: "/", mesure: "LCP", valeur, note: "good" },
        db,
      );
    }
    await enregistrerMesure(
      { page: "/tarifs", mesure: "CLS", valeur: 0.02, note: "good" },
      db,
    );

    const lignes = await p75ParPage(new Date(Date.now() - 28 * JOUR), db);

    expect(lignes).toEqual([
      { page: "/", mesure: "LCP", p75: 3250, nombre: 4 },
      { page: "/tarifs", mesure: "CLS", p75: 0.02, nombre: 1 },
    ]);
  });

  it("US-XXX-3 – Mesure de plus de 90 jours : effacée", async () => {
    const maintenant = new Date();
    await db.insert(mesuresVitesse).values([
      {
        page: "/",
        mesure: "LCP",
        valeur: 1,
        note: "good",
        creeLe: new Date(maintenant.getTime() - 91 * JOUR),
      },
      {
        page: "/",
        mesure: "LCP",
        valeur: 2,
        note: "good",
        creeLe: new Date(maintenant.getTime() - 89 * JOUR),
      },
    ]);

    await effacerMesuresAnciennes(maintenant, db);

    const restantes = await db.select().from(mesuresVitesse);
    expect(restantes.map((m) => m.valeur)).toEqual([2]);
  });
});
```

## Points de sécurité

- **S10 – Abus et coûts** : la route est publique (un navigateur l'appelle sans session). Elle refuse les autres origines, les corps de plus de 2 000 caractères et tout ce qui sort du schéma ; chaque envoi ajoute une petite ligne. Avec la recette `limite`, ajouter en tête de `POST` une vérification `verifierLimite("formulairePublic", ipDepuis(request.headers))` qui répond 429 quand la limite est atteinte.
- **S9 – Données personnelles** : ni IP, ni cookie, ni identifiant de compte, ni adresse complète (les identifiants des adresses deviennent `[id]`) ; effacement après 90 jours ; mention de confidentialité à jour.
- **S11 – Messages d'erreur** : la route répond par un code seul, sans détail ; l'erreur de base va dans le journal du serveur, sans le contenu reçu.
- Option A : les données vont chez Vercel (sous-traitant déjà utilisé pour l'hébergement) ; les citer dans la mention.

## Pièges connus

- **Composant monté hors du layout racine** : `<MesureVitesse />` va dans `src/app/layout.tsx`, une seule fois ; ailleurs, les mesures d'une page arrivent en double ou manquent.
- **Fonction de rappel recréée à chaque rendu** : `envoyer` est définie hors du composant ; une fonction créée dans le composant fait renvoyer les mesures déjà envoyées (documentation de `useReportWebVitals`).
- **Rien en développement** : `npm run dev` n'envoie rien (voulu) ; pour essayer, `npm run build` puis `npx next start`.
- **CLS et INP arrivent à la sortie de la page** : ils partent quand l'onglet est caché ou fermé ; un essai qui reste sur la page voit seulement TTFB, FCP et LCP.
- **Selon le navigateur** : le CLS et les navigations internes se mesurent seulement sous Chrome et Edge ; les autres mesures dépendent de la version du navigateur. Les chiffres décrivent donc surtout les visiteurs de Chrome et Edge.
- **Mesure perdue** : un bloqueur de contenu ou une coupure réseau en perd quelques-unes ; le 75e centile reste fiable avec assez de visites.
- **Speed Insights gratuit** : seulement le score global dans le tableau de bord ; pour lire le LCP par page sans payer, l'option B.

## Sources

- Next.js 16.4, documentation livrée : `01-app/02-guides/analytics.md`, `01-app/03-api-reference/04-functions/use-report-web-vitals.md` (`rating`, `navigationType` dont `soft-navigation`, `navigationURL`, référence de fonction stable).
- `@vercel/speed-insights` 2.0.0, paquet installé : `README.md`, `dist/next/index.d.mts` (`SpeedInsights`, `sampleRate`, `beforeSend`) ; Vercel : https://vercel.com/docs/speed-insights/limits-and-pricing, https://vercel.com/docs/speed-insights/privacy-policy (relevés le 2026-10-06).
- Seuils et 75e centile : web.dev/articles/vitals ; CNIL : cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience.
- Vérifications locales (squelette du pack, 2026-10-07) : `npm run typecheck`, `biome check`, `npm run build` (accueil statique, `/api/vitesse` dynamique) et Vitest passent ; dans Chromium (Playwright), une visite de deux pages envoie TTFB, FCP et LCP avec la page et la note attendues ; `<SpeedInsights />` charge `/_vercel/speed-insights/script.js`.

## Points à vérifier

- L'en-tête `Origin` derrière Vercel : `request.nextUrl.origin` vaut-il bien l'adresse publique du site (domaine personnalisé compris) ? Vérifier la première mesure enregistrée après la mise en ligne ; une réponse 403 sur `/api/vitesse` dans les journaux de Vercel signale l'écart.
- Speed Insights sur l'offre Hobby : les mesures par page sont-elles lisibles avec `vercel metrics` sans Speed Insights Plus ?
- Les libellés exacts de l'onglet Speed Insights dans Vercel.
