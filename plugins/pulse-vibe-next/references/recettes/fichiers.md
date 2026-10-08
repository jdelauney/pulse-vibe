# Recette : fichiers

> Quand l'utiliser : les personnes connectées envoient des fichiers (photos, PDF) et les retrouvent ensuite ; les fichiers sont rangés dans Cloudflare R2.

## Prérequis

- Le squelette du pack est en place (`pulse-aidd pile squelette`) : `src/db/index.ts` (`getDb()`, type `Db`), `src/config/env.ts` (`envServeur()`), `src/core/shared/result.ts` (`Result`, `ok()`, `echec()`), `src/lib/errors/{erreur-service,reponse-erreur}.ts`, `tests/helpers/base-de-test.ts` (`creerBaseDeTest()`).
- La recette `connexion` est faite (`pulse-aidd pile recette connexion`). Elle fournit :
  - `utilisateurConnecte()` dans `src/features/compte/queries/utilisateur-connecte.query.ts` (renvoie `{ id, nom }`, ou redirige vers `/connexion` sans session) ;
  - `actionConnectee` dans `src/lib/safe-action.ts` (`ctx.utilisateur` = `{ id, nom }`) ;
  - la table `user` dans `src/db/compte/auth.table.ts` ;
  - le groupe de routes `app/(connecte)/` et le renvoi rapide `proxy.ts` (racine du projet) ;
  - l'aide de test `e2e/aides/connexion.ts` (`connecterNouvelUtilisateur(page)`).
- Paquets à installer : `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (dernières versions ; recette vérifiée avec 3.1147.0 pour les deux). Le reste vient du squelette (`next`, `next-safe-action`, `zod`, `drizzle-orm`, `sonner`) ; pour les tests : `vitest`, `@electric-sql/pglite`, `@playwright/test`.
- Un compte Cloudflare avec R2. Offre gratuite (stockage Standard) : 10 Go-mois de stockage, 1 million d'opérations d'écriture (classe A) et 10 millions de lectures (classe B) par mois ; la sortie de données est gratuite.
- Dans le tableau de bord Cloudflare :
  1. **R2 object storage** → **Create bucket** → nom du bucket (ex. `mon-projet-fichiers`) → **Location** : **Specify jurisdiction** → **EU**. La juridiction UE garantit que les fichiers restent dans l'Union européenne. Elle se choisit à la création, sans retour possible.
  2. **R2 object storage** → **Manage** (API Tokens) → créer un jeton avec la permission **Object Read & Write**, limité à ce bucket. Copier **Access Key ID** et **Secret Access Key** dans `.env` : la clé secrète s'affiche une seule fois.
  3. Relever l'**Account ID** du compte.
  4. Bucket → **Settings** → **CORS Policy** → **Add CORS policy**, coller (remplacer l'adresse Vercel par celle du projet) :

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://mon-projet.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Le bucket reste **privé** : pas d'accès public, pas de domaine public.

## Variables d'environnement

| Nom | Rôle |
|---|---|
| `R2_ACCOUNT_ID` | Identifiant du compte Cloudflare |
| `R2_ACCESS_KEY_ID` | Identifiant du jeton R2 |
| `R2_SECRET_ACCESS_KEY` | Secret du jeton R2 (`VOTRE_CLE_ICI`) |
| `R2_BUCKET` | Nom du bucket |

Ajoutez ces lignes au schéma de `src/config/env.ts` (`schemaEnvServeur`) :

```ts
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
```

Ajoutez les quatre noms, **sans valeur**, à `.env.example` :

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

Dans Vercel, saisissez-les pour Production et Preview.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/config/env.ts`, `.env.example` (modifiés) | Les quatre variables R2 |
| `src/core/fichiers/fichier.entity.ts` | Types autorisés, taille maximale, statuts, type `Fichier` |
| `src/core/fichiers/fichier.errors.ts` | Codes des erreurs attendues |
| `src/core/fichiers/fichier.rules.ts` | Clé d'objet, propriété de la clé, envoi conforme (fonctions pures) |
| `src/core/fichiers/fichier-repository.port.ts` | Ce que les use-cases attendent de la base |
| `src/core/fichiers/stockage-fichiers.port.ts` | Ce que les use-cases attendent du stockage |
| `src/core/fichiers/use-cases/preparer-envoi.use-case.ts` | Réserve une ligne, signe l'adresse d'envoi |
| `src/core/fichiers/use-cases/confirmer-envoi.use-case.ts` | Compare ce que R2 a reçu, valide ou efface |
| `src/core/fichiers/use-cases/supprimer-fichier.use-case.ts` | Supprime la ligne, puis l'objet |
| `src/db/fichiers/fichier.table.ts` | Table `fichiers` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/db/fichiers/fichier.repository.ts` | `fichierRepository(db)` : écritures et lectures, condition de propriété |
| `src/adapters/storage/storage.adapter.ts` | Client R2, adresses signées, pannes en `ErreurService` |
| `src/features/fichiers/constants/fichiers.ts`, `constants/erreur-messages.ts` | Message d'échec, message de chaque code d'erreur |
| `src/features/fichiers/schemas/fichier.schema.ts` | Types et taille autorisés (Zod) |
| `src/features/fichiers/actions/preparer-envoi.action.ts`, `confirmer-envoi.action.ts`, `supprimer-fichier.action.ts` | Les trois actions |
| `src/features/fichiers/queries/lister-fichiers.query.ts`, `trouver-fichier.query.ts` | Les deux lectures (`server-only`) |
| `src/features/fichiers/components/sections/champ-envoi-fichier.tsx` | Champ d'envoi (props) |
| `src/features/fichiers/components/sections/liste-fichiers.tsx` | Liste des fichiers (props) |
| `src/features/fichiers/components/containers/envoi-fichier.container.tsx` | Branche les actions et l'envoi vers R2 |
| `src/features/fichiers/components/containers/liste-fichiers.container.tsx` | Lit la session et la liste |
| `app/api/fichiers/[id]/route.ts` | Téléchargement par adresse signée |
| `app/(connecte)/fichiers/page.tsx` | Page « Mes fichiers » |
| `proxy.ts` (modifié) | `"/fichiers/:path*"` dans le `matcher` |
| `src/core/fichiers/__tests__/fichier.rules.test.ts` | Tests unitaires des règles |
| `src/core/fichiers/use-cases/__tests__/sut-fichiers.ts` | Doublures en mémoire des deux ports, partagées par les tests des use-cases |
| `src/core/fichiers/use-cases/__tests__/preparer-envoi.use-case.test.ts`, `confirmer-envoi.use-case.test.ts`, `supprimer-fichier.use-case.test.ts` | Tests unitaires des trois use-cases, un fichier chacun |
| `src/features/fichiers/schemas/__tests__/fichier.schema.test.ts` | Tests unitaires du schéma |
| `src/adapters/storage/__tests__/storage.adapter.test.ts` | Tests de l'adapter (SDK doublé) |
| `src/db/fichiers/__tests__/fichier.repository.test.ts` | Tests d'intégration avec PGlite |
| `e2e/fichiers.spec.ts` | Tests de bout en bout Playwright |

## Étapes

Le parcours d'un envoi :

1. Le navigateur demande une adresse d'envoi à l'action `preparerEnvoiAction`, avec le nom, le type et la taille du fichier.
2. Le serveur vérifie la session, le type et la taille. Il réserve une ligne en base (statut `en_attente`), puis signe une adresse **PUT** valable 5 minutes, pour ce type et cette taille exacts.
3. Le navigateur envoie le fichier **directement à R2** : le fichier ne passe pas par Vercel (le corps d'une Server Action est limité à 1 Mo).
4. Le navigateur appelle `confirmerEnvoiAction` : le serveur demande à R2 ce qu'il a reçu, compare, puis passe la ligne en `envoye`.
5. Pour lire, le lien `/api/fichiers/<id>` vérifie la session et la propriétaire, puis redirige vers une adresse **GET** signée de 5 minutes.

Le domaine s'appelle `fichiers` : `src/core/fichiers/` (les règles), `src/db/fichiers/` (le stockage en base), `src/features/fichiers/` (l'écran, les actions, les lectures). Le service R2 vit dans `src/adapters/storage/`.

### 1. Cloudflare et les variables

Faites les réglages Cloudflare (Prérequis), remplissez `.env`, complétez `src/config/env.ts` et `.env.example`.

### 2. Le métier : entité, erreurs, règles et ports

Le métier ne dépend que de `src/core/`. Les deux ports décrivent ce dont les use-cases ont besoin : le repository de l'étape 5 et l'adapter de l'étape 6 les fournissent, et un test passe des doublures en mémoire.

```ts
// src/core/fichiers/fichier.entity.ts
/** Types de fichiers acceptés, avec l'extension donnée à l'objet rangé. */
export const TYPES_AUTORISES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type TypeAutorise = keyof typeof TYPES_AUTORISES;

export const TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo

/** « en_attente » : adresse d'envoi donnée ; « envoye » : présence vérifiée dans le stockage. */
export const STATUTS_FICHIER = ["en_attente", "envoye"] as const;
export type StatutFichier = (typeof STATUTS_FICHIER)[number];

export type Fichier = {
  id: string;
  utilisateurId: string;
  /** Clé de l'objet dans le stockage : « <id utilisateur>/<id fichier>.<extension> ». */
  cle: string;
  nom: string;
  typeMime: string;
  taille: number;
  statut: StatutFichier;
  creeLe: Date;
};
```

```ts
// src/core/fichiers/fichier.errors.ts
export type ErreurFichier = "fichier-introuvable" | "envoi-incomplet";
```

```ts
// src/core/fichiers/fichier.rules.ts
import {
  type Fichier,
  TYPES_AUTORISES,
  type TypeAutorise,
} from "./fichier.entity";

// La clé ne reprend jamais le nom donné par la personne : pas de caractère piégé, pas de collision.
export function construireCle(
  utilisateurId: string,
  idFichier: string,
  typeMime: TypeAutorise,
): string {
  return `${utilisateurId}/${idFichier}.${TYPES_AUTORISES[typeMime]}`;
}

export function appartientA(cle: string, utilisateurId: string): boolean {
  return cle.startsWith(`${utilisateurId}/`);
}

/** L'objet reçu par le stockage est celui qui était annoncé : même taille, même type. */
export function envoiConforme(
  fichier: Pick<Fichier, "taille" | "typeMime">,
  recu: { taille: number; typeMime: string } | null,
): boolean {
  return (
    recu !== null &&
    recu.taille === fichier.taille &&
    recu.typeMime === fichier.typeMime
  );
}
```

```ts
// src/core/fichiers/fichier-repository.port.ts
import type { Fichier, TypeAutorise } from "./fichier.entity";

/** Ce dont les use-cases ont besoin pour ranger les fichiers en base. Chaque méthode filtre par propriétaire. */
export type FichierRepository = {
  reserver(donnees: {
    id: string;
    utilisateurId: string;
    cle: string;
    nom: string;
    typeMime: TypeAutorise;
    taille: number;
  }): Promise<void>;
  trouver(id: string, utilisateurId: string): Promise<Fichier | null>;
  marquerEnvoye(id: string, utilisateurId: string): Promise<void>;
  /** Supprime la ligne et rend sa clé d'objet ; null si elle n'existe pas ou appartient à quelqu'un d'autre. */
  supprimer(id: string, utilisateurId: string): Promise<{ cle: string } | null>;
};
```

```ts
// src/core/fichiers/stockage-fichiers.port.ts
/** Le stockage des objets (Cloudflare R2). L'adapter `storage` l'implémente ; un test passe une doublure. */
export type StockageFichiers = {
  /** Adresse d'envoi courte, pour ce type exact et cette taille exacte. */
  adresseEnvoi(params: {
    cle: string;
    typeMime: string;
    taille: number;
  }): Promise<string>;
  /** Adresse de lecture courte, téléchargement sous le nom d'origine. */
  adresseLecture(params: { cle: string; nom: string }): Promise<string>;
  /** Ce que le stockage a réellement reçu (null si rien). */
  lireObjet(cle: string): Promise<{ taille: number; typeMime: string } | null>;
  supprimerObjet(cle: string): Promise<void>;
};
```

### 3. Les use-cases

Chaque écriture combine la base et le stockage (deux ports) : elle passe par un use-case (architecture.md §5, point 2). Les lectures vont directement au repository (étape 8).

```ts
// src/core/fichiers/use-cases/preparer-envoi.use-case.ts
import type { TypeAutorise } from "../fichier.entity";
import { construireCle } from "../fichier.rules";
import type { FichierRepository } from "../fichier-repository.port";
import type { StockageFichiers } from "../stockage-fichiers.port";

/** Réserve une ligne « en_attente », puis signe une adresse d'envoi courte pour cette clé. */
export async function preparerEnvoi(
  deps: { fichiers: FichierRepository; stockage: StockageFichiers },
  entree: {
    id: string;
    utilisateurId: string;
    nom: string;
    typeMime: TypeAutorise;
    taille: number;
  },
): Promise<{ id: string; adresse: string }> {
  const cle = construireCle(entree.utilisateurId, entree.id, entree.typeMime);
  await deps.fichiers.reserver({ ...entree, cle });
  const adresse = await deps.stockage.adresseEnvoi({
    cle,
    typeMime: entree.typeMime,
    taille: entree.taille,
  });
  return { id: entree.id, adresse };
}
```

`confirmerEnvoi` garde la sécurité du parcours : un objet qui diffère de l'annonce (taille, type) ou qui n'est jamais arrivé est effacé, avec sa ligne.

```ts
// src/core/fichiers/use-cases/confirmer-envoi.use-case.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFichier } from "../fichier.errors";
import { envoiConforme } from "../fichier.rules";
import type { FichierRepository } from "../fichier-repository.port";
import type { StockageFichiers } from "../stockage-fichiers.port";

/** Compare ce que le stockage a reçu à ce qui était annoncé : conforme, la ligne passe à « envoye » ; sinon tout est effacé. */
export async function confirmerEnvoi(
  deps: { fichiers: FichierRepository; stockage: StockageFichiers },
  entree: { id: string; utilisateurId: string },
): Promise<Result<{ id: string }, ErreurFichier>> {
  const fichier = await deps.fichiers.trouver(entree.id, entree.utilisateurId);
  if (!fichier) return echec("fichier-introuvable");

  const recu = await deps.stockage.lireObjet(fichier.cle);
  if (!envoiConforme(fichier, recu)) {
    if (recu) await deps.stockage.supprimerObjet(fichier.cle);
    await deps.fichiers.supprimer(fichier.id, entree.utilisateurId);
    return echec("envoi-incomplet");
  }

  await deps.fichiers.marquerEnvoye(fichier.id, entree.utilisateurId);
  return ok({ id: fichier.id });
}
```

```ts
// src/core/fichiers/use-cases/supprimer-fichier.use-case.ts
import { echec, ok, type Result } from "@src/core/shared/result";
import type { ErreurFichier } from "../fichier.errors";
import type { FichierRepository } from "../fichier-repository.port";
import type { StockageFichiers } from "../stockage-fichiers.port";

/** Supprime la ligne de la propriétaire, puis l'objet rangé dans le stockage. */
export async function supprimerFichier(
  deps: { fichiers: FichierRepository; stockage: StockageFichiers },
  entree: { id: string; utilisateurId: string },
): Promise<Result<void, ErreurFichier>> {
  const ligne = await deps.fichiers.supprimer(entree.id, entree.utilisateurId);
  if (!ligne) return echec("fichier-introuvable");
  await deps.stockage.supprimerObjet(ligne.cle);
  return ok(undefined);
}
```

### 4. La table et sa migration

```ts
// src/db/fichiers/fichier.table.ts
import { STATUTS_FICHIER } from "@src/core/fichiers/fichier.entity";
import { user } from "@src/db/compte/auth.table";
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const fichiers = pgTable("fichiers", {
  id: uuid().primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Clé de l'objet dans R2 : "<id utilisateur>/<id fichier>.<extension>".
  cle: text().notNull().unique(),
  nom: text().notNull(),
  typeMime: text("type_mime").notNull(),
  taille: integer().notNull(),
  statut: text({ enum: STATUTS_FICHIER }).notNull().default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});
```

`drizzle.config.ts` lit déjà `src/db/*/*.table.ts` : rien à déclarer ailleurs. Générez la migration, relisez le SQL créé dans `drizzle/`, puis appliquez-la :

```bash
npm run db:generate
npm run db:migrate
```

### 5. Le repository

Chaque requête commence par la **condition de propriété** (`utilisateurId`, venu de la session). `trouverEnvoye` et `listerEnvoyes` ignorent les lignes `en_attente`. La base arrive en paramètre : `getDb()` dans l'application, PGlite dans les tests. `satisfies FichierRepository` fait vérifier par TypeScript que le repository remplit le port des use-cases, sans cacher ses lectures propres à l'écran (`listerEnvoyes`, `trouverEnvoye`).

```ts
// src/db/fichiers/fichier.repository.ts
import "server-only";
import type { Fichier, TypeAutorise } from "@src/core/fichiers/fichier.entity";
import type { FichierRepository } from "@src/core/fichiers/fichier-repository.port";
import type { Db } from "@src/db";
import { and, desc, eq } from "drizzle-orm";
import { fichiers } from "./fichier.table";

export function fichierRepository(db: Db) {
  // Chaque requête commence par la condition de propriété : une personne ne touche que ses fichiers.
  const proprietaire = (id: string, utilisateurId: string) =>
    and(eq(fichiers.id, id), eq(fichiers.utilisateurId, utilisateurId));

  const repository = {
    async reserver(donnees: {
      id: string;
      utilisateurId: string;
      cle: string;
      nom: string;
      typeMime: TypeAutorise;
      taille: number;
    }): Promise<void> {
      await db.insert(fichiers).values(donnees);
    },

    async trouver(id: string, utilisateurId: string): Promise<Fichier | null> {
      const [ligne] = await db
        .select()
        .from(fichiers)
        .where(proprietaire(id, utilisateurId));
      return ligne ?? null;
    },

    async marquerEnvoye(id: string, utilisateurId: string): Promise<void> {
      await db
        .update(fichiers)
        .set({ statut: "envoye" })
        .where(proprietaire(id, utilisateurId));
    },

    async supprimer(
      id: string,
      utilisateurId: string,
    ): Promise<{ cle: string } | null> {
      const [ligne] = await db
        .delete(fichiers)
        .where(proprietaire(id, utilisateurId))
        .returning({ cle: fichiers.cle });
      return ligne ?? null;
    },

    /** Les fichiers dont l'envoi est vérifié, du plus récent au plus ancien. */
    async listerEnvoyes(utilisateurId: string) {
      return db
        .select({
          id: fichiers.id,
          nom: fichiers.nom,
          taille: fichiers.taille,
          creeLe: fichiers.creeLe,
        })
        .from(fichiers)
        .where(
          and(
            eq(fichiers.utilisateurId, utilisateurId),
            eq(fichiers.statut, "envoye"),
          ),
        )
        .orderBy(desc(fichiers.creeLe), desc(fichiers.id));
    },

    /** Un fichier dont l'envoi est vérifié ; un envoi en attente reste invisible. */
    async trouverEnvoye(id: string, utilisateurId: string) {
      const [ligne] = await db
        .select({ cle: fichiers.cle, nom: fichiers.nom })
        .from(fichiers)
        .where(
          and(proprietaire(id, utilisateurId), eq(fichiers.statut, "envoye")),
        );
      return ligne ?? null;
    },
  };

  // Le repository remplit le port des use-cases ; TypeScript le vérifie ici, sans perdre les lectures propres à l'écran.
  return repository satisfies FichierRepository;
}
```

### 6. L'adapter de stockage

Le client R2 et les adresses signées vivent dans `src/adapters/storage/`. Toute panne du SDK devient une `ErreurService("stockage", …)` : son message est sans secret ni clé d'objet (la clé commence par l'identifiant d'une personne), et sa `cause` garde seulement trois champs techniques (`name`, `Code`, code HTTP), lus un par un, jamais le texte de l'erreur d'origine (architecture.md §8). `safe-action` journalise et affiche un message générique ; le Route Handler de l'étape 9 utilise `reponseErreur()`.

```ts
// src/adapters/storage/storage.adapter.ts
import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { envServeur } from "@src/config/env";
import type { StockageFichiers } from "@src/core/fichiers/stockage-fichiers.port";
import { ErreurService } from "@src/lib/errors/erreur-service";

const DUREE_ADRESSE_SECONDES = 5 * 60;

let client: S3Client | undefined;

function obtenirClient(): S3Client {
  if (!client) {
    const env = envServeur();
    client = new S3Client({
      region: "auto",
      // Bucket créé avec la juridiction UE : adresse en ".eu.". Sans juridiction : retirer ".eu".
      endpoint: `https://${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      // R2 et les adresses signées : pas de somme de contrôle ajoutée d'office.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return client;
}

/**
 * Champs techniques de l'erreur du SDK, sans son texte : le texte peut citer une clé d'objet,
 * qui commence par l'identifiant d'une personne.
 */
function causeTechnique(erreur: unknown) {
  const brute = (erreur ?? {}) as Record<string, unknown>;
  const meta = (brute.$metadata ?? {}) as Record<string, unknown>;
  const texte = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    name: texte(brute.name),
    code: texte(brute.Code),
    httpStatusCode:
      typeof meta.httpStatusCode === "number" ? meta.httpStatusCode : undefined,
  };
}

function panneDeStockage(erreur: unknown): ErreurService {
  return new ErreurService("stockage", "Le stockage des fichiers a échoué", {
    cause: causeTechnique(erreur),
  });
}

/**
 * La seule porte de sortie vers R2 (stockage privé). Toute panne devient une
 * ErreurService("stockage", …) sans secret ni donnée personnelle.
 */
export const stockageFichiers: StockageFichiers = {
  // Adresse d'envoi : valable 5 minutes, pour ce type exact et cette taille exacte.
  async adresseEnvoi(params) {
    try {
      return await getSignedUrl(
        obtenirClient(),
        new PutObjectCommand({
          Bucket: envServeur().R2_BUCKET,
          Key: params.cle,
          ContentType: params.typeMime,
          ContentLength: params.taille,
        }),
        {
          expiresIn: DUREE_ADRESSE_SECONDES,
          signableHeaders: new Set(["content-type"]),
        },
      );
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  },

  // Adresse de lecture : valable 5 minutes, téléchargement sous le nom d'origine.
  async adresseLecture(params) {
    const nomSur = params.nom.replace(/[^\w.\- ]/g, "_");
    try {
      return await getSignedUrl(
        obtenirClient(),
        new GetObjectCommand({
          Bucket: envServeur().R2_BUCKET,
          Key: params.cle,
          ResponseContentDisposition: `attachment; filename="${nomSur}"`,
        }),
        { expiresIn: DUREE_ADRESSE_SECONDES },
      );
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  },

  // Ce que R2 a réellement reçu (null si rien).
  async lireObjet(cle) {
    try {
      const reponse = await obtenirClient().send(
        new HeadObjectCommand({ Bucket: envServeur().R2_BUCKET, Key: cle }),
      );
      return {
        taille: reponse.ContentLength ?? 0,
        typeMime: reponse.ContentType ?? "",
      };
    } catch (erreur) {
      if (erreur instanceof Error && erreur.name === "NotFound") return null;
      throw panneDeStockage(erreur);
    }
  },

  async supprimerObjet(cle) {
    try {
      await obtenirClient().send(
        new DeleteObjectCommand({ Bucket: envServeur().R2_BUCKET, Key: cle }),
      );
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  },
};
```

Vérifié avec `@aws-sdk/client-s3` 3.1147.0 : sans `requestChecksumCalculation: "WHEN_REQUIRED"`, l'adresse PUT contient une somme de contrôle de fichier vide (`x-amz-checksum-crc32=AAAAAA==`) ; avec `signableHeaders`, `content-type` et `content-length` font partie de la signature (`X-Amz-SignedHeaders=content-length;content-type;host`).

### 7. Les constantes et le schéma

`erreur-messages.ts` donne un message à chaque code d'erreur du métier : un code sans message fait échouer `npm run typecheck`.

```ts
// src/features/fichiers/constants/fichiers.ts
export const MESSAGE_ENVOI_ECHOUE = "L'envoi n'a pas abouti. Réessayez.";
```

```ts
// src/features/fichiers/constants/erreur-messages.ts
import type { ErreurFichier } from "@src/core/fichiers/fichier.errors";
import { MESSAGE_ENVOI_ECHOUE } from "./fichiers";

export const MESSAGES_FICHIER: Record<ErreurFichier, string> = {
  "fichier-introuvable": "Fichier introuvable.",
  "envoi-incomplet": MESSAGE_ENVOI_ECHOUE,
};
```

```ts
// src/features/fichiers/schemas/fichier.schema.ts
import {
  TAILLE_MAX,
  TYPES_AUTORISES,
  type TypeAutorise,
} from "@src/core/fichiers/fichier.entity";
import { z } from "zod";

export const demandeEnvoiSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Nom de fichier manquant.")
    .max(200, "Nom de fichier trop long."),
  typeMime: z.enum(
    Object.keys(TYPES_AUTORISES) as [TypeAutorise, ...TypeAutorise[]],
    {
      error: "Type de fichier refusé : JPEG, PNG, WebP ou PDF seulement.",
    },
  ),
  taille: z
    .number()
    .int()
    .min(1, "Le fichier est vide.")
    .max(TAILLE_MAX, "Fichier trop lourd : 5 Mo au maximum."),
});

export const idFichierSchema = z.object({ id: z.uuid() });
```

### 8. Les actions et les lectures

L'identifiant de la propriétaire vient **de la session** (`ctx.utilisateur.id`), jamais de la saisie. Chaque action assemble le use-case avec le repository et l'adapter, traduit un échec en message, puis appelle `refresh()`.

```ts
// src/features/fichiers/actions/preparer-envoi.action.ts
"use server";

import { randomUUID } from "node:crypto";
import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { preparerEnvoi } from "@src/core/fichiers/use-cases/preparer-envoi.use-case";
import { getDb } from "@src/db";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { demandeEnvoiSchema } from "../schemas/fichier.schema";

// 1. Le serveur contrôle le type et la taille (schéma), réserve une ligne, puis signe une adresse d'envoi courte.
export const preparerEnvoiAction = actionConnectee
  .inputSchema(demandeEnvoiSchema)
  .action(async ({ parsedInput, ctx }) =>
    preparerEnvoi(
      { fichiers: fichierRepository(getDb()), stockage: stockageFichiers },
      { ...parsedInput, id: randomUUID(), utilisateurId: ctx.utilisateur.id },
    ),
  );
```

```ts
// src/features/fichiers/actions/confirmer-envoi.action.ts
"use server";

import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { confirmerEnvoi } from "@src/core/fichiers/use-cases/confirmer-envoi.use-case";
import { getDb } from "@src/db";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { MESSAGES_FICHIER } from "../constants/erreur-messages";
import { idFichierSchema } from "../schemas/fichier.schema";

// 2. Après l'envoi par le navigateur : le serveur vérifie ce que R2 a vraiment reçu.
export const confirmerEnvoiAction = actionConnectee
  .inputSchema(idFichierSchema)
  .action(async ({ parsedInput, ctx }) => {
    const resultat = await confirmerEnvoi(
      { fichiers: fichierRepository(getDb()), stockage: stockageFichiers },
      { id: parsedInput.id, utilisateurId: ctx.utilisateur.id },
    );
    if (!resultat.ok) returnServerError(MESSAGES_FICHIER[resultat.raison]);
    refresh();
    return { id: resultat.valeur.id };
  });
```

```ts
// src/features/fichiers/actions/supprimer-fichier.action.ts
"use server";

import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { supprimerFichier } from "@src/core/fichiers/use-cases/supprimer-fichier.use-case";
import { getDb } from "@src/db";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { MESSAGES_FICHIER } from "../constants/erreur-messages";
import { idFichierSchema } from "../schemas/fichier.schema";

export const supprimerFichierAction = actionConnectee
  .inputSchema(idFichierSchema)
  .action(async ({ parsedInput, ctx }) => {
    const resultat = await supprimerFichier(
      { fichiers: fichierRepository(getDb()), stockage: stockageFichiers },
      { id: parsedInput.id, utilisateurId: ctx.utilisateur.id },
    );
    if (!resultat.ok) returnServerError(MESSAGES_FICHIER[resultat.raison]);
    refresh();
    return { ok: true };
  });
```

Les lectures passent directement par le repository, sans use-case (architecture.md §6).

```ts
// src/features/fichiers/queries/lister-fichiers.query.ts
import "server-only";
import { getDb } from "@src/db";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";

export async function listerFichiers(utilisateurId: string) {
  return fichierRepository(getDb()).listerEnvoyes(utilisateurId);
}
```

```ts
// src/features/fichiers/queries/trouver-fichier.query.ts
import "server-only";
import { getDb } from "@src/db";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";

/** Le fichier envoyé de cette personne, ou null (inconnu, en attente, ou à quelqu'un d'autre). */
export async function trouverFichier(id: string, utilisateurId: string) {
  return fichierRepository(getDb()).trouverEnvoye(id, utilisateurId);
}
```

### 9. Le téléchargement

Le Route Handler lit la session hors du `try` (sans session, `utilisateurConnecte()` redirige vers `/connexion`, et un `catch` avalerait cette redirection). Seule la signature, qui appelle le service, est protégée par `reponseErreur()`.

```ts
// app/api/fichiers/[id]/route.ts
import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { trouverFichier } from "@src/features/fichiers/queries/trouver-fichier.query";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";
import { z } from "zod";

// Le lien affiché reste stable ; l'adresse signée (5 minutes) naît au clic, après contrôle.
export async function GET(
  _requete: Request,
  { params }: RouteContext<"/api/fichiers/[id]">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  // Sans session, utilisateurConnecte() renvoie vers /connexion : l'appeler hors du try.
  const utilisateur = await utilisateurConnecte();
  const ligne = await trouverFichier(id, utilisateur.id);
  if (!ligne) {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  try {
    return Response.redirect(await stockageFichiers.adresseLecture(ligne), 303);
  } catch (erreur) {
    return reponseErreur(erreur, "Téléchargement d'un fichier");
  }
}
```

### 10. L'écran : sections, containers et page

La section reçoit tout par props. Le container (client) appelle `useAction` pour les deux actions et envoie le fichier à R2.

```tsx
// src/features/fichiers/components/sections/champ-envoi-fichier.tsx
"use client";

import { Field, FieldLabel } from "@src/components/ui/field";
import { Input } from "@src/components/ui/input";
import { TYPES_AUTORISES } from "@src/core/fichiers/fichier.entity";
import { useId } from "react";

type Props = {
  quandChoisi: (fichier: File) => void;
  enCours: boolean;
  erreur?: string;
};

export function ChampEnvoiFichier({ quandChoisi, enCours, erreur }: Props) {
  const id = useId();

  return (
    <Field>
      <FieldLabel htmlFor={id}>
        Ajouter un fichier (JPEG, PNG, WebP ou PDF, 5 Mo au plus)
      </FieldLabel>
      <Input
        id={id}
        type="file"
        accept={Object.keys(TYPES_AUTORISES).join(",")}
        disabled={enCours}
        onChange={(evenement) => {
          const choisi = evenement.target.files?.[0];
          if (choisi) {
            quandChoisi(choisi);
          }
          evenement.target.value = "";
        }}
      />
      {enCours && (
        <p className="text-sm text-muted-foreground">Envoi en cours…</p>
      )}
      {erreur && (
        <p role="alert" className="text-sm text-destructive">
          {erreur}
        </p>
      )}
    </Field>
  );
}
```

```tsx
// src/features/fichiers/components/containers/envoi-fichier.container.tsx
"use client";

import type { TypeAutorise } from "@src/core/fichiers/fichier.entity";
import { useAction } from "next-safe-action/hooks";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmerEnvoiAction } from "../../actions/confirmer-envoi.action";
import { preparerEnvoiAction } from "../../actions/preparer-envoi.action";
import { MESSAGE_ENVOI_ECHOUE } from "../../constants/fichiers";
import { ChampEnvoiFichier } from "../sections/champ-envoi-fichier";

export function EnvoiFichierContainer() {
  const preparer = useAction(preparerEnvoiAction);
  const confirmer = useAction(confirmerEnvoiAction);
  const [erreur, setErreur] = useState("");
  const [enCours, startTransition] = useTransition();

  function envoyer(choisi: File) {
    startTransition(async () => {
      setErreur("");
      // 1. Le serveur contrôle le fichier et donne une adresse d'envoi de 5 minutes.
      const preparation = await preparer.executeAsync({
        nom: choisi.name,
        typeMime: choisi.type as TypeAutorise,
        taille: choisi.size,
      });
      if (!preparation?.data) {
        const erreurs = preparation?.validationErrors;
        setErreur(
          erreurs?.typeMime?._errors?.[0] ??
            erreurs?.taille?._errors?.[0] ??
            erreurs?.nom?._errors?.[0] ??
            preparation?.serverError ??
            MESSAGE_ENVOI_ECHOUE,
        );
        return;
      }
      // 2. Le navigateur envoie le fichier directement à R2.
      // Une coupure réseau fait échouer fetch par une exception : l'attraper ici,
      // sinon toute la page bascule sur l'écran d'erreur.
      let envoye = false;
      try {
        const reponse = await fetch(preparation.data.adresse, {
          method: "PUT",
          headers: { "Content-Type": choisi.type },
          body: choisi,
        });
        envoye = reponse.ok;
      } catch {
        envoye = false;
      }
      if (!envoye) {
        setErreur(MESSAGE_ENVOI_ECHOUE);
        return;
      }
      // 3. Le serveur vérifie ce que R2 a reçu.
      const confirmation = await confirmer.executeAsync({
        id: preparation.data.id,
      });
      if (confirmation?.data) {
        toast.success("Fichier enregistré.");
      } else {
        setErreur(confirmation?.serverError ?? MESSAGE_ENVOI_ECHOUE);
      }
    });
  }

  return (
    <ChampEnvoiFichier
      quandChoisi={envoyer}
      enCours={enCours}
      erreur={erreur}
    />
  );
}
```

La liste suit le même découpage : une section d'affichage et un container serveur qui lit la session et les fichiers.

```tsx
// src/features/fichiers/components/sections/liste-fichiers.tsx
type Props = {
  fichiers: { id: string; nom: string; taille: number }[];
};

export function ListeFichiers({ fichiers }: Props) {
  if (fichiers.length === 0) {
    return (
      <p className="text-muted-foreground">Aucun fichier pour l'instant.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {fichiers.map((f) => (
        <li key={f.id}>
          <a href={`/api/fichiers/${f.id}`} className="underline">
            {f.nom}
          </a>{" "}
          <span className="text-sm text-muted-foreground">
            ({Math.ceil(f.taille / 1024)} Ko)
          </span>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// src/features/fichiers/components/containers/liste-fichiers.container.tsx
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { listerFichiers } from "../../queries/lister-fichiers.query";
import { ListeFichiers } from "../sections/liste-fichiers";

export async function ListeFichiersContainer() {
  const utilisateur = await utilisateurConnecte();
  const fichiers = await listerFichiers(utilisateur.id);
  return <ListeFichiers fichiers={fichiers} />;
}
```

Le container qui lit des données se place sous `<Suspense>` dans la page.

```tsx
// app/(connecte)/fichiers/page.tsx
import { EnvoiFichierContainer } from "@src/features/fichiers/components/containers/envoi-fichier.container";
import { ListeFichiersContainer } from "@src/features/fichiers/components/containers/liste-fichiers.container";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Mes fichiers" };

export default function PageFichiers() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Mes fichiers</h1>
      <EnvoiFichierContainer />
      <Suspense fallback={<p>Chargement de vos fichiers…</p>}>
        <ListeFichiersContainer />
      </Suspense>
    </main>
  );
}
```

### 11. Le renvoi vers la connexion

Dans `proxy.ts` (racine du projet), ajoutez la page au `matcher` :

```ts
  matcher: ["/compte/:path*", "/fichiers/:path*"],
```

Avec la recette `langues` : voir `connexion`, étape 12.

La page reste protégée par `utilisateurConnecte()`, et le téléchargement par le Route Handler.

### 12. Essayer

Envoyez une image PNG, puis un fichier `.exe`, puis un PDF de plus de 5 Mo ; cliquez sur un fichier de la liste.

### 13. Mettre en ligne

Saisissez les quatre variables dans Vercel, ajoutez l'adresse du site en ligne à la règle CORS du bucket, redéployez.

## Scénarios Gherkin à ajouter à la spec

```gherkin
# language: fr
Fonctionnalité: Fichiers

  Règle: Seuls les types et tailles autorisés sont acceptés

    @US-XXX-1 @unitaire
    Exemple: Une photo PNG de 2 Mo est acceptée
      Étant donné Camille choisit « facture-mars.png », une image PNG de 2 Mo
      Quand le serveur contrôle la demande d'envoi
      Alors la demande est acceptée

    @US-XXX-2 @unitaire @securite
    Plan du scénario: Un fichier interdit ou trop lourd est refusé avec un message clair
      Étant donné Camille choisit « <fichier> »
      Quand le serveur contrôle la demande d'envoi
      Alors Camille lit « <message> »

      Exemples:
        | fichier                     | message                                                    |
        | gros.pdf de 5 Mo et 1 octet | Fichier trop lourd : 5 Mo au maximum.                       |
        | outil.exe                   | Type de fichier refusé : JPEG, PNG, WebP ou PDF seulement.  |

  Règle: La clé d'un fichier commence par l'identifiant de sa propriétaire

    @US-XXX-3 @unitaire @securite
    Exemple: La clé du fichier de Camille commence par l'identifiant de Camille
      Étant donné Camille envoie une image PNG
      Quand la clé de l'objet est construite
      Alors elle commence par l'identifiant de Camille

  Règle: Un envoi se prépare avec une adresse signée et une ligne en attente

    @US-XXX-3 @unitaire
    Exemple: Camille reçoit une adresse d'envoi et une ligne en attente est réservée
      Étant donné Camille choisit une image PNG autorisée
      Quand le serveur prépare l'envoi
      Alors Camille reçoit une adresse d'envoi pour sa clé
      Et une ligne « en_attente » est réservée


  Règle: Une personne accède seulement à ses propres fichiers

    @US-XXX-4 @integration
    Exemple: Camille ouvre sa facture
      Étant donné Camille a envoyé « facture-mars.png »
      Quand Camille ouvre ce fichier
      Alors le fichier est trouvé

    @US-XXX-4 @integration @securite
    Exemple: Léo ne peut pas ouvrir la facture de Camille
      Étant donné Camille a envoyé « facture-mars.png »
      Et Léo est connecté avec son propre compte
      Quand Léo demande ce fichier par son identifiant
      Alors le fichier est introuvable

    @US-XXX-4 @integration @securite
    Exemple: La liste de Léo ne contient pas la facture de Camille
      Étant donné Camille a envoyé « facture-mars.png »
      Et Léo est connecté avec son propre compte
      Quand Léo affiche ses fichiers
      Alors sa liste est vide

    @US-XXX-4 @integration @securite
    Exemple: La base refuse à Léo de confirmer ou d'effacer la ligne de Camille
      Étant donné Camille a réservé un envoi « en_attente »
      Quand la base reçoit de Léo la confirmation puis l'effacement de cette ligne
      Alors rien n'est supprimé
      Et l'envoi de Camille reste « en_attente »

    @US-XXX-4 @unitaire @securite
    Exemple: Léo ne peut pas confirmer l'envoi de Camille
      Étant donné Camille a préparé l'envoi d'une image PNG
      Quand Léo demande au serveur de confirmer cet envoi
      Alors le fichier est introuvable
      Et l'envoi de Camille reste « en_attente »

    @US-XXX-4 @unitaire
    Exemple: Camille supprime son fichier : la ligne et l'objet disparaissent
      Étant donné Camille a envoyé une image PNG
      Quand Camille supprime ce fichier
      Alors la ligne et l'objet sont supprimés

    @US-XXX-4 @unitaire @securite
    Exemple: Léo ne peut pas supprimer le fichier de Camille
      Étant donné Camille a envoyé une image PNG
      Quand Léo essaie de supprimer ce fichier
      Alors le fichier est introuvable
      Et la ligne et l'objet de Camille restent en place

    @US-XXX-4 @manuel @securite
    Exemple: Un lien de téléchargement copié ne sert plus après 5 minutes
      Étant donné Camille a copié l'adresse de téléchargement de sa facture
      Quand quelqu'un ouvre cette adresse 6 minutes plus tard, en navigation privée
      Alors R2 refuse l'accès

  Règle: Un envoi n'est confirmé que s'il correspond à ce qui était annoncé

    @US-XXX-6 @unitaire
    Exemple: L'envoi conforme passe la ligne à « envoye »
      Étant donné Camille a préparé l'envoi d'une image PNG de 1000 octets
      Et R2 a reçu une image PNG de 1000 octets
      Quand le serveur confirme l'envoi
      Alors la ligne est « envoye »

    @US-XXX-6 @unitaire @securite
    Plan du scénario: Un envoi différent de l'annonce est effacé avec sa ligne
      Étant donné Camille a préparé l'envoi d'une image PNG de 1000 octets
      Et <réception>
      Quand le serveur confirme l'envoi
      Alors Camille lit « L'envoi n'a pas abouti. Réessayez. »
      Et la ligne et l'objet sont supprimés

      Exemples:
        | réception                                 |
        | R2 n'a rien reçu                          |
        | R2 a reçu un objet de 999 octets          |
        | R2 a reçu un PDF de 1000 octets           |

  Règle: Un envoi non confirmé reste invisible

    @US-XXX-6 @integration @securite
    Exemple: Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement
      Étant donné Camille a réservé un envoi « en_attente »
      Quand Camille affiche ses fichiers et ouvre ce fichier
      Alors sa liste est vide
      Et le fichier est introuvable

  Règle: Une panne du stockage est signalée comme une panne de service

    @US-XXX-7 @unitaire @securite
    Exemple: Un refus de R2 lève une erreur de service « stockage » sans la clé de l'objet
      Étant donné R2 refuse l'accès à un objet de Camille
      Quand le serveur lit cet objet
      Alors une erreur de service « stockage » est levée
      Et son message et sa cause ne contiennent ni la clé de l'objet ni le texte d'origine

    @US-XXX-7 @unitaire
    Exemple: Un objet absent n'est pas une panne : le stockage répond « rien reçu »
      Étant donné R2 répond « NotFound »
      Quand le serveur lit cet objet
      Alors le serveur obtient « rien reçu »

  Règle: Les adresses signées durent 5 minutes et figent le type et la taille

    @US-XXX-8 @unitaire @securite
    Exemple: L'adresse d'envoi signe le type et la taille exacts
      Quand le serveur signe l'adresse d'envoi d'une image PNG de 1000 octets
      Alors l'adresse expire au bout de 300 secondes
      Et le type et la taille font partie de la signature

    @US-XXX-8 @unitaire @securite
    Exemple: L'adresse de lecture force le téléchargement sous un nom nettoyé
      Quand le serveur signe l'adresse de lecture d'un fichier au nom piégé
      Alors l'adresse expire au bout de 300 secondes
      Et le fichier se télécharge en pièce jointe sous un nom nettoyé

  Règle: Un fichier envoyé apparaît dans la liste

    @US-XXX-5 @bout-en-bout
    Exemple: Camille envoie une photo et la voit dans sa liste
      Étant donné Camille est connectée
      Quand Camille envoie « photo-chantier.png »
      Alors « photo-chantier.png » apparaît dans « Mes fichiers »

    @US-XXX-5 @bout-en-bout
    Exemple: L'envoi échoue en route : un message clair, la page reste en place
      Étant donné Camille est connectée
      Et le stockage des fichiers ne répond pas
      Quand Camille envoie « photo-chantier.png »
      Alors le message « L'envoi n'a pas abouti. Réessayez. » s'affiche
      Et la page « Mes fichiers » reste affichée
```

## Tâches de plan prêtes

> US terminée quand : une personne connectée envoie une image ou un PDF autorisé, le retrouve dans sa liste et le télécharge par un lien temporaire ; personne d'autre n'y accède.

- [ ] **Tn – Relier le projet à R2** · US-XXX
  - Objectif : le projet a un bucket R2 privé, en Europe, une table pour ses fichiers et un adapter de stockage
  - Dépend de : —
  - Fichiers : à créer : `src/core/fichiers/fichier.entity.ts`, `fichier.errors.ts`, `fichier.rules.ts`, `fichier-repository.port.ts`, `stockage-fichiers.port.ts`, `src/db/fichiers/fichier.table.ts`, `src/db/fichiers/fichier.repository.ts`, `src/adapters/storage/storage.adapter.ts`, `src/adapters/storage/__tests__/storage.adapter.test.ts`, `src/db/fichiers/__tests__/fichier.repository.test.ts`, migration dans `drizzle/` · à modifier : `src/config/env.ts`, `.env.example`
  - Vérification : US-XXX critères 4 et 6 – `npm test` passe ; `npm run db:migrate` crée la table `fichiers`
  - Tests : « Camille ouvre sa facture », « Léo ne peut pas ouvrir la facture de Camille », « La liste de Léo ne contient pas la facture de Camille », « La base refuse à Léo de confirmer ou d'effacer la ligne de Camille », « Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement » (intégration) ; « Un refus de R2 lève une erreur de service « stockage » sans la clé de l'objet », « Un objet absent n'est pas une panne : le stockage répond « rien reçu » », « L'adresse d'envoi signe le type et la taille exacts », « L'adresse de lecture force le téléchargement sous un nom nettoyé » (unitaires)
  - Action manuelle : créer le bucket (juridiction UE), le jeton R2 et la règle CORS dans Cloudflare ; remplir `.env`
- [ ] **Tn+1 – Envoyer un fichier** · US-XXX
  - Objectif : une personne connectée envoie une image ou un PDF, contrôlé par le serveur, puis confirmé après vérification dans R2
  - Dépend de : Tn
  - Fichiers : à créer : `src/core/fichiers/use-cases/preparer-envoi.use-case.ts`, `confirmer-envoi.use-case.ts`, `supprimer-fichier.use-case.ts`, `src/features/fichiers/constants/fichiers.ts`, `constants/erreur-messages.ts`, `schemas/fichier.schema.ts`, `actions/preparer-envoi.action.ts`, `actions/confirmer-envoi.action.ts`, `actions/supprimer-fichier.action.ts`, `components/sections/champ-envoi-fichier.tsx`, `components/containers/envoi-fichier.container.tsx`, `src/core/fichiers/__tests__/fichier.rules.test.ts`, `src/core/fichiers/use-cases/__tests__/sut-fichiers.ts`, `preparer-envoi.use-case.test.ts`, `confirmer-envoi.use-case.test.ts`, `supprimer-fichier.use-case.test.ts`, `src/features/fichiers/schemas/__tests__/fichier.schema.test.ts`
  - Vérification : US-XXX critères 1 à 3 – une image PNG passe ; un `.exe` et un PDF de 6 Mo sont refusés avec le message prévu
  - Tests : « Une photo PNG de 2 Mo est acceptée », « Un fichier interdit ou trop lourd est refusé avec un message clair », « La clé du fichier de Camille commence par l'identifiant de Camille », « Camille reçoit une adresse d'envoi et une ligne en attente est réservée », « L'envoi conforme passe la ligne à « envoye » », « Un envoi différent de l'annonce est effacé avec sa ligne », « Léo ne peut pas confirmer l'envoi de Camille », « Camille supprime son fichier : la ligne et l'objet disparaissent », « Léo ne peut pas supprimer le fichier de Camille » (unitaires)
  - Attention : le serveur contrôle le type et la taille, même si le champ `accept` filtre déjà ; un fichier d'`actions/` commence par `"use server"` et n'exporte que son action
- [ ] **Tn+2 – Retrouver et télécharger ses fichiers** · US-XXX
  - Objectif : une personne voit ses fichiers et les télécharge par un lien temporaire
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/features/fichiers/queries/lister-fichiers.query.ts`, `queries/trouver-fichier.query.ts`, `components/sections/liste-fichiers.tsx`, `components/containers/liste-fichiers.container.tsx`, `app/api/fichiers/[id]/route.ts`, `app/(connecte)/fichiers/page.tsx`, `e2e/fichiers.spec.ts` · à modifier : `proxy.ts`
  - Vérification : US-XXX critères 4 et 5 – envoyer un fichier, le voir dans la liste, le télécharger ; connecté avec un autre compte, `/api/fichiers/<id>` répond « Fichier introuvable. »
  - Tests : « Camille envoie une photo et la voit dans sa liste », « L'envoi échoue en route : un message clair, la page reste en place » (bout en bout) ; « Un lien de téléchargement copié ne sert plus après 5 minutes » (manuel : ouvrir le lien copié en navigation privée après 6 minutes)
  - Action manuelle : saisir les variables R2 dans Vercel ; ajouter l'adresse du site en ligne à la règle CORS

## Tests

### Unitaires

Les règles et les use-cases s'essaient sans base ni réseau : le repository et le stockage sont remplacés par des doublures en mémoire.

```ts
// src/core/fichiers/__tests__/fichier.rules.test.ts
import { describe, expect, it } from "vitest";
import { appartientA, construireCle } from "../fichier.rules";

describe("Fichiers", () => {
  describe("La clé d'un fichier commence par l'identifiant de sa propriétaire", () => {
    it("US-XXX-3 – La clé du fichier de Camille commence par l'identifiant de Camille", () => {
      const cle = construireCle(
        "camille-id",
        "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10",
        "image/png",
      );

      expect(cle).toBe("camille-id/0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10.png");
      expect(appartientA(cle, "camille-id")).toBe(true);
      expect(appartientA(cle, "leo-id")).toBe(false);
    });
  });
});
```

Les trois use-cases partagent les mêmes doublures en mémoire, rangées dans un petit fichier d'aide ; chaque use-case a son fichier de tests.

```ts
// src/core/fichiers/use-cases/__tests__/sut-fichiers.ts
import type { Fichier } from "../../fichier.entity";
import type { FichierRepository } from "../../fichier-repository.port";
import type { StockageFichiers } from "../../stockage-fichiers.port";
import { confirmerEnvoi } from "../confirmer-envoi.use-case";
import { preparerEnvoi } from "../preparer-envoi.use-case";
import { supprimerFichier } from "../supprimer-fichier.use-case";

export const ID = "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10";

/** Doublures en mémoire des deux ports, et les trois use-cases branchés dessus. */
export function creerSut() {
  const lignes = new Map<string, Fichier>();
  const objets = new Map<string, { taille: number; typeMime: string }>();

  const fichiers: FichierRepository = {
    async reserver(donnees) {
      lignes.set(donnees.id, {
        ...donnees,
        statut: "en_attente",
        creeLe: new Date(),
      });
    },
    async trouver(id, utilisateurId) {
      const ligne = lignes.get(id);
      return ligne?.utilisateurId === utilisateurId ? ligne : null;
    },
    async marquerEnvoye(id, utilisateurId) {
      const ligne = lignes.get(id);
      if (ligne?.utilisateurId === utilisateurId) ligne.statut = "envoye";
    },
    async supprimer(id, utilisateurId) {
      const ligne = lignes.get(id);
      if (ligne?.utilisateurId !== utilisateurId) return null;
      lignes.delete(id);
      return { cle: ligne.cle };
    },
  };
  const stockage: StockageFichiers = {
    async adresseEnvoi({ cle }) {
      return `https://stockage.exemple/${cle}?signature=1`;
    },
    async adresseLecture({ cle }) {
      return `https://stockage.exemple/${cle}`;
    },
    async lireObjet(cle) {
      return objets.get(cle) ?? null;
    },
    async supprimerObjet(cle) {
      objets.delete(cle);
    },
  };
  const deps = { fichiers, stockage };

  const preparer = (utilisateurId: string) =>
    preparerEnvoi(deps, {
      id: ID,
      utilisateurId,
      nom: "facture-mars.png",
      typeMime: "image/png",
      taille: 1000,
    });

  return {
    lignes,
    objets,
    preparer,
    async givenEnvoiPrepare() {
      await preparer("camille-id");
    },
    givenObjetRecu(taille: number, typeMime: string) {
      objets.set(`camille-id/${ID}.png`, { taille, typeMime });
    },
    confirmer: (utilisateurId: string) =>
      confirmerEnvoi(deps, { id: ID, utilisateurId }),
    supprimer: (utilisateurId: string) =>
      supprimerFichier(deps, { id: ID, utilisateurId }),
  };
}
```

```ts
// src/core/fichiers/use-cases/__tests__/preparer-envoi.use-case.test.ts
import { describe, expect, it } from "vitest";
import { creerSut, ID } from "./sut-fichiers";

describe("Fichiers", () => {
  describe("Un envoi se prépare avec une adresse signée et une ligne en attente", () => {
    it("US-XXX-3 – Camille reçoit une adresse d'envoi et une ligne en attente est réservée", async () => {
      const sut = creerSut();

      const resultat = await sut.preparer("camille-id");

      expect(resultat.adresse).toContain(`camille-id/${ID}.png`);
      expect(sut.lignes.get(ID)).toMatchObject({
        cle: `camille-id/${ID}.png`,
        statut: "en_attente",
      });
    });
  });
});
```

```ts
// src/core/fichiers/use-cases/__tests__/confirmer-envoi.use-case.test.ts
import { describe, expect, it } from "vitest";
import { creerSut, ID } from "./sut-fichiers";

describe("Fichiers", () => {
  describe("Un envoi n'est confirmé que s'il correspond à ce qui était annoncé", () => {
    it("US-XXX-6 – L'envoi conforme passe la ligne à « envoye »", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.confirmer("camille-id");

      expect(resultat).toEqual({ ok: true, valeur: { id: ID } });
      expect(sut.lignes.get(ID)?.statut).toBe("envoye");
    });

    it.each([
      ["rien n'a été reçu", null],
      ["la taille diffère", { taille: 999, typeMime: "image/png" }],
      ["le type diffère", { taille: 1000, typeMime: "application/pdf" }],
    ])(
      "US-XXX-6 – Un envoi différent de l'annonce est effacé avec sa ligne : %s",
      async (_cas, recu) => {
        const sut = creerSut();
        await sut.givenEnvoiPrepare();
        if (recu) sut.givenObjetRecu(recu.taille, recu.typeMime);

        const resultat = await sut.confirmer("camille-id");

        expect(resultat).toEqual({ ok: false, raison: "envoi-incomplet" });
        expect(sut.lignes.size).toBe(0);
        expect(sut.objets.size).toBe(0);
      },
    );
  });

  describe("Une personne accède seulement à ses propres fichiers", () => {
    it("US-XXX-4 – Léo ne peut pas confirmer l'envoi de Camille", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.confirmer("leo-id");

      expect(resultat).toEqual({ ok: false, raison: "fichier-introuvable" });
      expect(sut.lignes.get(ID)?.statut).toBe("en_attente");
    });
  });
});
```

```ts
// src/core/fichiers/use-cases/__tests__/supprimer-fichier.use-case.test.ts
import { describe, expect, it } from "vitest";
import { creerSut } from "./sut-fichiers";

describe("Fichiers", () => {
  describe("Une personne accède seulement à ses propres fichiers", () => {
    it("US-XXX-4 – Camille supprime son fichier : la ligne et l'objet disparaissent", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.supprimer("camille-id");

      expect(resultat.ok).toBe(true);
      expect(sut.lignes.size).toBe(0);
      expect(sut.objets.size).toBe(0);
    });

    it("US-XXX-4 – Léo ne peut pas supprimer le fichier de Camille", async () => {
      const sut = creerSut();
      await sut.givenEnvoiPrepare();
      sut.givenObjetRecu(1000, "image/png");

      const resultat = await sut.supprimer("leo-id");

      expect(resultat).toEqual({ ok: false, raison: "fichier-introuvable" });
      expect(sut.lignes.size).toBe(1);
      expect(sut.objets.size).toBe(1);
    });
  });
});
```

```ts
// src/features/fichiers/schemas/__tests__/fichier.schema.test.ts
import { TAILLE_MAX } from "@src/core/fichiers/fichier.entity";
import { describe, expect, it } from "vitest";
import { demandeEnvoiSchema } from "../fichier.schema";

describe("Fichiers", () => {
  describe("Seuls les types et tailles autorisés sont acceptés", () => {
    it("US-XXX-1 – Une photo PNG de 2 Mo est acceptée", () => {
      const resultat = demandeEnvoiSchema.safeParse({
        nom: "facture-mars.png",
        typeMime: "image/png",
        taille: 2 * 1024 * 1024,
      });

      expect(resultat.success).toBe(true);
    });

    it("US-XXX-2 – Un fichier interdit ou trop lourd est refusé avec un message clair : gros.pdf de 5 Mo et 1 octet", () => {
      const resultat = demandeEnvoiSchema.safeParse({
        nom: "gros.pdf",
        typeMime: "application/pdf",
        taille: TAILLE_MAX + 1,
      });

      expect(resultat.success).toBe(false);
      expect(resultat.error?.issues[0]?.message).toBe(
        "Fichier trop lourd : 5 Mo au maximum.",
      );
    });

    it("US-XXX-2 – Un fichier interdit ou trop lourd est refusé avec un message clair : outil.exe", () => {
      const resultat = demandeEnvoiSchema.safeParse({
        nom: "outil.exe",
        typeMime: "application/x-msdownload",
        taille: 1000,
      });

      expect(resultat.success).toBe(false);
      expect(resultat.error?.issues[0]?.message).toBe(
        "Type de fichier refusé : JPEG, PNG, WebP ou PDF seulement.",
      );
    });
  });
});
```

L'adapter se teste avec le SDK doublé : l'erreur du service est choisie par le test, et les adresses signées (calculées en local, sans réseau) sont relues.

```ts
// src/adapters/storage/__tests__/storage.adapter.test.ts
import { ErreurService } from "@src/lib/errors/erreur-service";
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({ envoi: vi.fn() }));

// SDK doublé : le stockage répond par l'erreur choisie par le test.
vi.mock("@aws-sdk/client-s3", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@aws-sdk/client-s3")>();
  class S3ClientDouble extends reel.S3Client {
    override send = etat.envoi;
  }
  return { ...reel, S3Client: S3ClientDouble };
});
vi.mock("@src/config/env", () => ({
  envServeur: () => ({
    R2_ACCOUNT_ID: "compte",
    R2_ACCESS_KEY_ID: "cle-acces",
    R2_SECRET_ACCESS_KEY: "secret-de-test",
    R2_BUCKET: "bucket-de-test",
  }),
}));

const { stockageFichiers } = await import("../storage.adapter");

describe("Stockage des fichiers", () => {
  beforeEach(() => {
    etat.envoi.mockReset();
  });

  describe("Une panne du stockage est signalée comme une panne de service", () => {
    it("US-XXX-7 – Un refus de R2 lève une erreur de service « stockage » sans la clé de l'objet", async () => {
      etat.envoi.mockRejectedValue(
        Object.assign(
          new Error("Access Denied pour camille-id/f1.pdf (secret-de-test)"),
          {
            name: "AccessDenied",
            Code: "AccessDenied",
            $metadata: { httpStatusCode: 403 },
          },
        ),
      );

      const erreur = await stockageFichiers
        .lireObjet("camille-id/f1.pdf")
        .catch((e: unknown) => e);

      expect(erreur).toBeInstanceOf(ErreurService);
      const service = erreur as ErreurService;
      expect(service.service).toBe("stockage");
      expect(service.message).not.toContain("camille-id");
      // La cause garde les champs techniques, sans le texte de l'erreur d'origine.
      expect(service.cause).toEqual({
        name: "AccessDenied",
        code: "AccessDenied",
        httpStatusCode: 403,
      });
      expect(JSON.stringify(service.cause)).not.toContain("camille-id");
      expect(JSON.stringify(service.cause)).not.toContain("secret-de-test");
    });

    it("US-XXX-7 – Un objet absent n'est pas une panne : le stockage répond « rien reçu »", async () => {
      etat.envoi.mockRejectedValue(
        Object.assign(new Error("NotFound"), { name: "NotFound" }),
      );

      const recu = await stockageFichiers.lireObjet("camille-id/f1.pdf");

      expect(recu).toBeNull();
    });
  });

  describe("Les adresses signées durent 5 minutes et figent le type et la taille", () => {
    it("US-XXX-8 – L'adresse d'envoi signe le type et la taille exacts", async () => {
      const adresse = new URL(
        await stockageFichiers.adresseEnvoi({
          cle: "camille-id/f1.png",
          typeMime: "image/png",
          taille: 1000,
        }),
      );

      expect(adresse.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(adresse.searchParams.get("X-Amz-SignedHeaders")).toBe(
        "content-length;content-type;host",
      );
      expect(adresse.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    });

    it("US-XXX-8 – L'adresse de lecture force le téléchargement sous un nom nettoyé", async () => {
      const adresse = new URL(
        await stockageFichiers.adresseLecture({
          cle: "camille-id/f1.pdf",
          nom: 'fa"ctu<re>.pdf',
        }),
      );

      expect(adresse.searchParams.get("X-Amz-Expires")).toBe("300");
      expect(adresse.searchParams.get("response-content-disposition")).toBe(
        'attachment; filename="fa_ctu_re_.pdf"',
      );
    });
  });
});
```

### Intégration (Vitest + PGlite)

Le repository reçoit la base de test : aucune doublure de session ni de `getDb()`.

```ts
// src/db/fichiers/__tests__/fichier.repository.test.ts
import type { Db } from "@src/db";
import { user } from "@src/db/compte/auth.table";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { creerBaseDeTest } from "../../../../tests/helpers/base-de-test";
import { fichierRepository } from "../fichier.repository";

const ID_FICHIER = "0f8b6c1e-6f0a-4a57-9a4e-2f1f0c7f9b10";

let db: Db;
let fermer: () => Promise<void>;

beforeEach(async () => {
  ({ db, fermer } = await creerBaseDeTest());
  await db.insert(user).values([
    { id: "camille-id", name: "Camille", email: "camille@exemple.fr" },
    { id: "leo-id", name: "Léo", email: "leo@exemple.fr" },
  ]);
});

afterEach(async () => {
  await fermer();
});

/** Camille réserve « facture-mars.pdf » ; `envoye` la fait passer au statut vérifié. */
async function camilleEnvoie(envoye = true) {
  const fichiers = fichierRepository(db);
  await fichiers.reserver({
    id: ID_FICHIER,
    utilisateurId: "camille-id",
    cle: `camille-id/${ID_FICHIER}.png`,
    nom: "facture-mars.png",
    typeMime: "image/png",
    taille: 1000,
  });
  if (envoye) await fichiers.marquerEnvoye(ID_FICHIER, "camille-id");
}

describe("Fichiers", () => {
  describe("Une personne accède seulement à ses propres fichiers", () => {
    it("US-XXX-4 – Camille ouvre sa facture", async () => {
      await camilleEnvoie();

      const ligne = await fichierRepository(db).trouverEnvoye(
        ID_FICHIER,
        "camille-id",
      );

      expect(ligne).toMatchObject({ nom: "facture-mars.png" });
    });

    it("US-XXX-4 – Léo ne peut pas ouvrir la facture de Camille", async () => {
      await camilleEnvoie();

      const ligne = await fichierRepository(db).trouverEnvoye(
        ID_FICHIER,
        "leo-id",
      );

      expect(ligne).toBeNull();
    });

    it("US-XXX-4 – La liste de Léo ne contient pas la facture de Camille", async () => {
      await camilleEnvoie();

      const liste = await fichierRepository(db).listerEnvoyes("leo-id");

      expect(liste).toEqual([]);
    });

    it("US-XXX-4 – La base refuse à Léo de confirmer ou d'effacer la ligne de Camille", async () => {
      await camilleEnvoie(false);
      const fichiers = fichierRepository(db);

      await fichiers.marquerEnvoye(ID_FICHIER, "leo-id");
      const supprime = await fichiers.supprimer(ID_FICHIER, "leo-id");

      expect(supprime).toBeNull();
      expect(await fichiers.trouver(ID_FICHIER, "camille-id")).toMatchObject({
        statut: "en_attente",
      });
    });
  });

  describe("Un envoi non confirmé reste invisible", () => {
    it("US-XXX-6 – Un fichier « en_attente » n'apparaît ni dans la liste ni au téléchargement", async () => {
      await camilleEnvoie(false);
      const fichiers = fichierRepository(db);

      expect(await fichiers.listerEnvoyes("camille-id")).toEqual([]);
      expect(await fichiers.trouverEnvoye(ID_FICHIER, "camille-id")).toBeNull();
    });
  });
});
```

### Bout en bout (Playwright)

Le premier test envoie un vrai fichier vers R2 : en local et en CI, utilisez un bucket de test, distinct de celui de production. Le second coupe l'envoi vers R2 (`page.route`) : il tourne sans compte R2.

```ts
// e2e/fichiers.spec.ts
import { expect, test } from "@playwright/test";
import { connecterNouvelUtilisateur } from "./aides/connexion";

// Plus petite image PNG valide (1 × 1 pixel).
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Fichiers", () => {
  test("US-XXX-5 – Camille envoie une photo et la voit dans sa liste", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/fichiers");

    await page.getByLabel(/Ajouter un fichier/).setInputFiles({
      name: "photo-chantier.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });

    await expect(page.getByText("Fichier enregistré.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "photo-chantier.png" }),
    ).toBeVisible();
  });

  test("US-XXX-5 – L'envoi échoue en route : un message clair, la page reste en place", async ({
    page,
  }) => {
    await connecterNouvelUtilisateur(page);
    await page.goto("/fichiers");
    // Le stockage ne répond pas : l'envoi direct vers R2 est coupé.
    await page.route("**/*.r2.cloudflarestorage.com/**", (route) =>
      route.abort(),
    );

    await page.getByLabel(/Ajouter un fichier/).setInputFiles({
      name: "photo-chantier.png",
      mimeType: "image/png",
      buffer: PNG_1PX,
    });

    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "L'envoi n'a pas abouti. Réessayez." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Mes fichiers" }),
    ).toBeVisible();
  });
});
```

## Points de sécurité

- **S1, S2 – Secrets** : les quatre variables R2 restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). Le navigateur reçoit seulement des adresses signées de 5 minutes. Les pannes du stockage sortent sans secret ni clé d'objet (`ErreurService` à `cause` technique).
- **S3 – Contrôle d'accès** : chaque requête du repository et chaque action filtrent par `utilisateurId` (venu de la session) ; la clé d'objet commence par l'identifiant de la propriétaire.
- **S5, S7 – Fichiers** : type (liste blanche) et taille (5 Mo) contrôlés par le schéma Zod de l'action ; la signature PUT fige le type et la taille ; `confirmerEnvoi` compare ce que R2 a reçu et efface tout écart.
- **S6 – Affichage** : le nom du fichier s'affiche comme du texte ; il n'entre jamais dans la clé d'objet ; il est nettoyé avant l'en-tête de téléchargement.
- **S7 – Stockage privé** : bucket privé ; le Route Handler vérifie la session et la propriétaire avant de signer une adresse GET de 5 minutes. Le fichier est téléchargé (`attachment`), jamais affiché sur le domaine du site.
- **S9 – Données personnelles** : la suppression d'un compte efface ses lignes (`onDelete: "cascade"`) ; prévoyez aussi la suppression des objets R2 du préfixe `<id utilisateur>/`.

## Pièges connus

- **Erreur CORS à l'envoi** : l'adresse de la page (protocole et port compris) doit figurer dans `AllowedOrigins`. Une règle met jusqu'à 30 secondes à s'appliquer. Chaque prévisualisation Vercel a sa propre adresse : ajoutez celles qui servent.
- **403 `SignatureDoesNotMatch`** : le navigateur doit envoyer exactement le `Content-Type` signé (`choisi.type`) et le fichier annoncé (même taille).
- **Bucket UE** : il répond seulement à `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`. Sans juridiction, retirez `.eu` dans `src/adapters/storage/storage.adapter.ts`.
- **Clé secrète perdue** : Cloudflare l'affiche une seule fois. Créez un nouveau jeton, puis supprimez l'ancien.
- **Objet orphelin à la suppression** : `supprimerFichier` efface la ligne, puis l'objet (la personne ne voit plus jamais un fichier cassé). Si l'effacement de l'objet échoue après celui de la ligne, l'objet reste dans R2 sans ligne : il occupe de la place et rien ne le retrouve. Journalisez l'échec avec la clé (l'erreur de service ne la contient pas), puis prévoyez une tâche de ménage qui compare les objets du bucket aux lignes de `fichiers` et efface les objets sans ligne. Inverser l'ordre (objet d'abord) laisserait à la place une ligne qui pointe vers un objet disparu.
- **Lignes « en_attente »** : un envoi abandonné laisse une ligne sans fichier. Elle reste invisible ; une tâche de ménage pourra les effacer plus tard.
- **Type déclaré par le navigateur** : `File.type` vient de l'extension ; le contenu n'est pas inspecté. Le téléchargement forcé (`attachment`) évite qu'un fichier piégé s'exécute dans le site.
- **Les quatre variables R2 deviennent obligatoires** : `envServeur()` valide tout le schéma à sa première lecture, et `next build` passe sans elles. Renseignez-les dans `.env` (une valeur factice suffit tant qu'aucun envoi réel n'a lieu) avant de lancer le site ou les tests de bout en bout.
- **Langues** : avec la recette `langues`, la page va sous `app/[locale]/(connecte)/fichiers/` ; `app/api/fichiers/` reste à sa place.

## Sources

- Cloudflare R2 : https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/ ; https://developers.cloudflare.com/r2/buckets/cors/ ; https://developers.cloudflare.com/r2/api/tokens/ ; https://developers.cloudflare.com/r2/reference/data-location/ ; https://developers.cloudflare.com/r2/pricing/
- AWS SDK 3.1147.0 : adresses signées générées localement et inspectées ; option `signableHeaders` (`@smithy/types`)
- Next.js 16.4, documentation embarquée : `01-app/01-getting-started/15-route-handlers.md` ; `01-app/02-guides/server-actions.md` (corps limité à 1 Mo) ; `01-app/03-api-reference/04-functions/refresh.md`
- next-safe-action 8.7.3 : `dist/index.d.mts` (`returnServerError`), `dist/hooks.d.mts` (`useAction`, `executeAsync`)
- Vérifications locales du 2026-10-08 (squelette du pack + recettes `connexion`, `liste`, `email` + cette recette, dans l'architecture hexagonale) : `npm run check`, `npm run typecheck`, `npm test` et `npm run build` (sans les variables R2, puis avec des valeurs factices) passent ; `next start` : `/fichiers` et `/api/fichiers/<id>` sans session répondent 307 vers `/connexion`, et `/api/fichiers/pas-un-uuid` répond 404.

## Points à vérifier

- Un envoi réel vers R2 (test de bout en bout et parcours manuel) : non exécuté lors de la rédaction (pas de compte R2).
- Le refus par R2 d'un PUT dont la taille diffère de `content-length` signé : attendu d'après la signature SigV4, à constater une fois.
- Le nom d'erreur `NotFound` renvoyé par `HeadObjectCommand` avec R2 : le test de l'adapter le double, un essai réel reste à faire.
- `refresh()` dans une action appelée depuis `startTransition` (hors `<form action>`) : la liste doit se mettre à jour ; sinon, appelez `router.refresh()` après `confirmerEnvoiAction`.
- L'obligation d'enregistrer un moyen de paiement pour activer R2, même avec l'offre gratuite : non précisée par les pages consultées.
- Essai réel du 2026-10-06 (ancienne organisation, base PGlite, R2 factice) : le test « L'envoi échoue en route » passait 3 fois sur 3, sur ordinateur et sur téléphone ; il a révélé qu'une coupure réseau faisait basculer la page sur l'écran d'erreur (corrigé : `try/catch` autour du `fetch`). Parcours Playwright à rejouer dans la nouvelle organisation.
