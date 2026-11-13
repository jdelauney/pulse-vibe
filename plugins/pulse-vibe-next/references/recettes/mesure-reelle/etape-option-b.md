### Option B – Mesure envoyée au site

Le domaine `vitesse` a ses trois dossiers miroirs : `src/core/vitesse/` (les règles), `src/db/vitesse/` (le stockage), `src/features/vitesse/` (la réception). Le composant qui mesure sert tout le site : il va dans `src/components/shared/elements/`.

#### 1. Le métier : entité, règles, port et use-case

Le métier est écrit en classes (entité, règles, use-case) ; le port est une `interface`. Les adresses passent par `ReglesMesure.normaliserChemin` : un segment qui ressemble à un identifiant devient `[id]`. Les mesures se regroupent ainsi par gabarit, et aucune adresse enregistrée ne désigne une personne ou un document. Le métier ne dépend de rien d'autre que `src/core/`.

<!-- fichier: src/core/vitesse/mesure.entity.ts -->
```ts
// src/core/vitesse/mesure.entity.ts
export const MESURES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type NomMesure = (typeof MESURES)[number];

export const NOTES = ["good", "needs-improvement", "poor"] as const;
export type NoteMesure = (typeof NOTES)[number];

export const DUREE_CONSERVATION_JOURS = 90;

/** Intervalle minimal entre deux effacements des anciennes mesures. */
export const INTERVALLE_PURGE_MS = 3_600_000;

/** Les données d'une mesure : la forme qui traverse les frontières (navigateur, base). */
export type MesureVitesseVue = {
  page: string;
  mesure: NomMesure;
  valeur: number;
  note: NoteMesure;
  navigation?: string | undefined;
};

/** Une mesure envoyée par le navigateur d'un visiteur : anonyme (ni IP, ni compte, ni adresse complète). */
export class MesureVitesse {
  constructor(private readonly donnees: Readonly<MesureVitesseVue>) {}

  get page(): string {
    return this.donnees.page;
  }

  surPage(page: string): MesureVitesse {
    return new MesureVitesse({ ...this.donnees, page });
  }

  versVue(): MesureVitesseVue {
    return { ...this.donnees };
  }
}

export type LigneP75 = {
  page: string;
  mesure: string;
  p75: number;
  nombre: number;
};
```

<!-- fichier: src/core/vitesse/mesure.rules.ts -->
```ts
// src/core/vitesse/mesure.rules.ts
import { DUREE_CONSERVATION_JOURS, INTERVALLE_PURGE_MS } from "./mesure.entity";

// Un segment d'adresse qui ressemble à un identifiant (nombre, uuid, jeton) devient « [id] » :
// les mesures se regroupent par gabarit, et aucune adresse ne désigne une personne ou un document.
const IDENTIFIANT = /^(\d+|[0-9a-f]{8}-[0-9a-f-]{27}|(?=.*\d)[\w-]{16,})$/i;

/** Les règles qui portent sur des valeurs (adresse, dates), sans état. */
export class ReglesMesure {
  normaliserChemin(adresse: string): string {
    const chemin = adresse.split(/[?#]/)[0] ?? "";
    const segments = chemin
      .split("/")
      .filter(Boolean)
      .map((s) => (IDENTIFIANT.test(s) ? "[id]" : s.slice(0, 60)));
    return `/${segments.join("/")}`.slice(0, 200);
  }

  /** L'effacement a lieu au plus une fois par intervalle : la première fois, ou une heure après la précédente. */
  purgeNecessaire(dernierePurge: Date | null, maintenant: Date): boolean {
    return (
      dernierePurge === null ||
      maintenant.getTime() - dernierePurge.getTime() >= INTERVALLE_PURGE_MS
    );
  }

  /** Les mesures créées avant cette date sont effacées. */
  limiteDeConservation(maintenant: Date): Date {
    return new Date(
      maintenant.getTime() - DUREE_CONSERVATION_JOURS * 86_400_000,
    );
  }
}
```

Enregistrer une mesure applique une règle métier (le chemin sans identifiant) : l'écriture passe donc par un use-case, une classe qui reçoit son repository par le constructeur (architecture.md §5, point 2). L'effacement au plus une fois par heure est un réglage d'exploitation, pas une règle métier : la durée de conservation (90 jours) reste la seule promesse faite aux visiteurs. Le port (une `interface`) décrit seulement ce dont le use-case a besoin ; le repository de l'étape 3 l'implémente.

<!-- fichier: src/core/vitesse/mesure-repository.port.ts -->
```ts
// src/core/vitesse/mesure-repository.port.ts
import type { MesureVitesse } from "./mesure.entity";

/** Ce dont le use-case a besoin pour ranger les mesures (patron Repository). */
export interface MesureVitesseRepository {
  enregistrer(mesure: MesureVitesse): Promise<void>;
  /** Efface les mesures créées avant `limite`. */
  effacerAvant(limite: Date): Promise<void>;
}
```

<!-- fichier: src/core/vitesse/use-cases/enregistrer-mesure.use-case.ts -->
```ts
// src/core/vitesse/use-cases/enregistrer-mesure.use-case.ts
import { MesureVitesse, type MesureVitesseVue } from "../mesure.entity";
import { ReglesMesure } from "../mesure.rules";
import type { MesureVitesseRepository } from "../mesure-repository.port";

/**
 * Enregistre la mesure avec une page sans identifiant. Les mesures trop anciennes s'effacent
 * au plus une fois par heure (`dernierePurge` : date du dernier effacement connu de l'appelant).
 * Renvoie `purge: true` quand l'effacement a eu lieu.
 */
export class EnregistrerMesure {
  private readonly regles = new ReglesMesure();

  constructor(private readonly mesures: MesureVitesseRepository) {}

  async executer(entree: {
    mesure: MesureVitesseVue;
    maintenant: Date;
    dernierePurge: Date | null;
  }): Promise<{ purge: boolean }> {
    const mesure = new MesureVitesse(entree.mesure);
    await this.mesures.enregistrer(
      mesure.surPage(this.regles.normaliserChemin(mesure.page)),
    );
    if (!this.regles.purgeNecessaire(entree.dernierePurge, entree.maintenant)) {
      return { purge: false };
    }
    await this.mesures.effacerAvant(
      this.regles.limiteDeConservation(entree.maintenant),
    );
    return { purge: true };
  }
}
```

#### 2. La table et sa migration

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs.

<!-- fichier: src/db/vitesse/mesure-vitesse.table.ts -->
```ts
// src/db/vitesse/mesure-vitesse.table.ts
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

Générez la migration, relisez le fichier SQL créé dans `drizzle/`, puis appliquez-la :

<!-- commande: npm run db:generate -->

```bash
npm run db:generate
npm run db:migrate
```

#### 3. Le repository

La classe `DrizzleMesureVitesseRepository` implémente le port ; la base arrive par le constructeur (`getDb()` dans l'application, PGlite dans les tests). `p75ParPage`, absente du port (le use-case n'en a pas besoin), sert à une future page d'administration.

<!-- fichier: src/db/vitesse/mesure-vitesse.repository.ts -->
```ts
// src/db/vitesse/mesure-vitesse.repository.ts
import "server-only";
import type { LigneP75, MesureVitesse } from "@src/core/vitesse/mesure.entity";
import type { MesureVitesseRepository } from "@src/core/vitesse/mesure-repository.port";
import type { Db } from "@src/db/db-client";
import { lt, sql } from "drizzle-orm";
import { mesuresVitesse } from "./mesure-vitesse.table";

/** Le stockage des mesures dans Postgres (Drizzle) : implémente le port du métier. */
export class DrizzleMesureVitesseRepository
  implements MesureVitesseRepository
{
  constructor(private readonly db: Db) {}

  async enregistrer(mesure: MesureVitesse): Promise<void> {
    await this.db.insert(mesuresVitesse).values(mesure.versVue());
  }

  async effacerAvant(limite: Date): Promise<void> {
    await this.db
      .delete(mesuresVitesse)
      .where(lt(mesuresVitesse.creeLe, limite));
  }

  /** 75e centile par page et par mesure depuis une date (même calcul que Google). */
  async p75ParPage(depuis: Date): Promise<LigneP75[]> {
    return this.db
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
}
```

#### 4. Le schéma et la réception des mesures

Le schéma Zod décrit ce que le navigateur envoie.

<!-- fichier: src/features/vitesse/schemas/mesure.schema.ts -->
```ts
// src/features/vitesse/schemas/mesure.schema.ts
import { MESURES, NOTES } from "@src/core/vitesse/mesure.entity";
import { z } from "zod";

// Ce que le navigateur envoie pour une mesure (une ligne par mesure et par page vue).
export const mesureVitesseSchema = z.object({
  page: z.string().min(1).max(300),
  mesure: z.enum(MESURES),
  valeur: z.number().finite().min(0).max(600_000),
  note: z.enum(NOTES),
  navigation: z.string().max(30).optional(),
});
```

Le fichier `.webhook.ts` reçoit la requête, comme pour un service externe. Il accepte seulement les envois venant des pages du site (en-tête `Origin`), de petite taille, au format attendu ; le use-case efface au passage les mesures de plus de 90 jours, au plus une fois par heure et par instance du serveur : le webhook garde en mémoire la date du dernier effacement et la passe au use-case, qui décide (règle `purgeNecessaire` de `ReglesMesure`, testable sans horloge réelle). Une panne de la base répond avec `reponseErreur()` : message générique, détail dans le journal du serveur seulement.

<!-- fichier: src/features/vitesse/webhooks/recevoir-mesure.webhook.ts -->
```ts
// src/features/vitesse/webhooks/recevoir-mesure.webhook.ts
import { EnregistrerMesure } from "@src/core/vitesse/use-cases/enregistrer-mesure.use-case";
import { getDb } from "@src/db/db-client";
import { DrizzleMesureVitesseRepository } from "@src/db/vitesse/mesure-vitesse.repository";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";
import type { NextRequest } from "next/server";
import { mesureVitesseSchema } from "../schemas/mesure.schema";

const TAILLE_MAX = 2_000;

// Dernier effacement des anciennes mesures par cette instance du serveur : le use-case l'efface
// au plus une fois par heure, au lieu d'une requête DELETE à chaque mesure reçue.
let dernierePurge: Date | null = null;

/** Reçoit une mesure envoyée par le navigateur d'un visiteur (navigator.sendBeacon). */
export async function recevoirMesure(request: NextRequest): Promise<Response> {
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
  const lu = mesureVitesseSchema.safeParse(corps);
  if (!lu.success) {
    return new Response(null, { status: 400 });
  }
  try {
    const maintenant = new Date();
    const enregistrer = new EnregistrerMesure(
      new DrizzleMesureVitesseRepository(getDb()),
    );
    const { purge } = await enregistrer.executer({
      mesure: lu.data,
      maintenant,
      dernierePurge,
    });
    if (purge) dernierePurge = maintenant;
  } catch (erreur) {
    return reponseErreur(erreur, "Mesure de vitesse non enregistrée");
  }
  return new Response(null, { status: 204 });
}
```

La route reste fine : elle délègue (architecture.md §7).

<!-- fichier: app/api/vitesse/route.ts -->
```ts
// app/api/vitesse/route.ts
import { recevoirMesure } from "@src/features/vitesse/webhooks/recevoir-mesure.webhook";
import type { NextRequest } from "next/server";

export function POST(request: NextRequest) {
  return recevoirMesure(request);
}
```

#### 5. Le composant qui mesure

`useReportWebVitals` donne les mesures du navigateur ; `navigator.sendBeacon` les envoie même quand le visiteur quitte la page. Rien n'est envoyé en développement. Le composant ne lit aucune donnée et n'appelle aucune action : c'est un élément partagé.

<!-- fichier: src/components/shared/elements/mesure-vitesse.tsx -->
```tsx
// src/components/shared/elements/mesure-vitesse.tsx
"use client";

import { MESURES } from "@src/core/vitesse/mesure.entity";
import { useReportWebVitals } from "next/web-vitals";

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

Dans `app/layout.tsx` :

<!-- remplacer-ligne: app/layout.tsx début: import { Toaster } from "@src/components/ui/sonner"; -->
```tsx
import { MesureVitesse } from "@src/components/shared/elements/mesure-vitesse";
import { Toaster } from "@src/components/ui/sonner";
```

<!-- remplacer-ligne: app/layout.tsx début: <Toaster /> -->
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

Lecture : LCP, FCP, TTFB et INP en millisecondes, CLS sans unité ; seuils de `pulse-aidd reference perf/performance.md`. Une ligne avec moins d'une cinquantaine de mesures se lit comme une indication.

