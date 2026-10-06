# Recette : fichiers

> Quand l'utiliser : les personnes connectées envoient des fichiers (photos, PDF) et les retrouvent ensuite ; les fichiers sont rangés dans Cloudflare R2.

## Prérequis

- Recette `connexion` appliquée (`utilisateurConnecte()`, `actionConnectee`, groupe `src/app/(connecte)/`, aide Playwright `connecterNouvelUtilisateur`).
- Paquets à installer : `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` (dernières versions ; recette vérifiée avec 3.1146.0 pour les deux).
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

Ajouter ces lignes au schéma de `src/lib/env.ts` :

```ts
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
```

Ajouter les quatre noms, **sans valeur**, à `.env.example` :

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
```

Dans Vercel, les saisir pour Production et Preview.

## Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/lib/env.ts`, `.env.example` (modifiés) | Les quatre variables R2 |
| `src/db/schema/fichiers.ts` | Table `fichier` |
| `src/db/schema/index.ts` (modifié) | `export * from "./fichiers";` |
| `drizzle/<numéro>_<nom>.sql` | Migration générée |
| `src/lib/stockage.ts` | Client R2, adresses signées |
| `src/features/fichiers/schemas.ts` | Types et taille autorisés |
| `src/features/fichiers/regles.ts` | Clé d'objet (fonctions pures) |
| `src/features/fichiers/actions.ts` | `preparerEnvoi`, `confirmerEnvoi`, `supprimerFichier` |
| `src/features/fichiers/queries.ts` | `mesFichiers`, `monFichier` |
| `src/features/fichiers/components/envoi-fichier.tsx` | Champ d'envoi |
| `src/app/api/fichiers/[id]/route.ts` | Téléchargement par adresse signée |
| `src/app/(connecte)/fichiers/page.tsx` | Page « Mes fichiers » |
| `src/proxy.ts` (modifié) | `"/fichiers/:path*"` dans le `matcher` |
| `src/features/fichiers/regles.test.ts`, `queries.test.ts`, `e2e/fichiers.spec.ts` | Tests |

## Étapes

Le parcours d'un envoi :

1. Le navigateur demande une adresse d'envoi à l'action `preparerEnvoi`, avec le nom, le type et la taille du fichier.
2. Le serveur vérifie la session, le type et la taille. Il réserve une ligne en base (statut `en_attente`), puis signe une adresse **PUT** valable 5 minutes, pour ce type et cette taille exacts.
3. Le navigateur envoie le fichier **directement à R2** : le fichier ne passe pas par Vercel (le corps d'une Server Action est limité à 1 Mo).
4. Le navigateur appelle `confirmerEnvoi` : le serveur demande à R2 ce qu'il a reçu, compare, puis passe la ligne en `envoye`.
5. Pour lire, le lien `/api/fichiers/<id>` vérifie la session et la propriétaire, puis redirige vers une adresse **GET** signée de 5 minutes.

### 1. Cloudflare et les variables

Faire les réglages Cloudflare (Prérequis), remplir `.env`, compléter `src/lib/env.ts` et `.env.example`.

### 2. La table

```ts
// src/db/schema/fichiers.ts
import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const fichier = pgTable("fichier", {
  id: uuid("id").primaryKey().defaultRandom(),
  utilisateurId: text("utilisateur_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Clé de l'objet dans R2 : "<id utilisateur>/<id fichier>.<extension>".
  cle: text("cle").notNull().unique(),
  nom: text("nom").notNull(),
  typeMime: text("type_mime").notNull(),
  taille: integer("taille").notNull(),
  // "en_attente" : adresse d'envoi donnée ; "envoye" : présence vérifiée dans R2.
  statut: text("statut", { enum: ["en_attente", "envoye"] })
    .notNull()
    .default("en_attente"),
  creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
});
```

Ajouter `export * from "./fichiers";` à `src/db/schema/index.ts`, puis `npm run db:generate`, relire le SQL créé, et `npm run db:migrate`.

### 3. Le client R2

```ts
// src/lib/stockage.ts
import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { envServeur } from "@/lib/env";

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

// Adresse d'envoi : valable 5 minutes, pour ce type exact et cette taille exacte.
export async function adresseEnvoi(params: {
  cle: string;
  typeMime: string;
  taille: number;
}) {
  return getSignedUrl(
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
}

// Adresse de lecture : valable 5 minutes, téléchargement sous le nom d'origine.
export async function adresseLecture(params: { cle: string; nom: string }) {
  const nomSur = params.nom.replace(/[^\w.\- ]/g, "_");
  return getSignedUrl(
    obtenirClient(),
    new GetObjectCommand({
      Bucket: envServeur().R2_BUCKET,
      Key: params.cle,
      ResponseContentDisposition: `attachment; filename="${nomSur}"`,
    }),
    { expiresIn: DUREE_ADRESSE_SECONDES },
  );
}

// Ce que R2 a réellement reçu (null si rien).
export async function lireObjet(
  cle: string,
): Promise<{ taille: number; typeMime: string } | null> {
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
    throw erreur;
  }
}

export async function supprimerObjet(cle: string): Promise<void> {
  await obtenirClient().send(
    new DeleteObjectCommand({ Bucket: envServeur().R2_BUCKET, Key: cle }),
  );
}
```

Vérifié avec `@aws-sdk/client-s3` 3.1146.0 : sans `requestChecksumCalculation: "WHEN_REQUIRED"`, l'adresse PUT contient une somme de contrôle de fichier vide (`x-amz-checksum-crc32=AAAAAA==`) ; avec `signableHeaders`, `content-type` et `content-length` font partie de la signature (`X-Amz-SignedHeaders=content-length;content-type;host`).

### 4. Les règles

```ts
// src/features/fichiers/schemas.ts
import { z } from "zod";

export const TYPES_AUTORISES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type TypeAutorise = keyof typeof TYPES_AUTORISES;

export const TAILLE_MAX = 5 * 1024 * 1024; // 5 Mo

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

```ts
// src/features/fichiers/regles.ts
import { TYPES_AUTORISES, type TypeAutorise } from "./schemas";

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
```

### 5. Les actions et les lectures

```ts
// src/features/fichiers/actions.ts
"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { getDb } from "@/db";
import { fichier } from "@/db/schema";
import { actionConnectee } from "@/lib/safe-action";
import { adresseEnvoi, lireObjet, supprimerObjet } from "@/lib/stockage";
import { construireCle } from "./regles";
import { demandeEnvoiSchema, idFichierSchema } from "./schemas";

// 1. Le serveur contrôle le type et la taille, réserve une ligne, puis signe une adresse d'envoi courte.
export const preparerEnvoi = actionConnectee
  .inputSchema(demandeEnvoiSchema)
  .action(async ({ parsedInput, ctx }) => {
    const id = randomUUID();
    const cle = construireCle(ctx.utilisateur.id, id, parsedInput.typeMime);
    await getDb().insert(fichier).values({
      id,
      utilisateurId: ctx.utilisateur.id,
      cle,
      nom: parsedInput.nom,
      typeMime: parsedInput.typeMime,
      taille: parsedInput.taille,
    });
    const adresse = await adresseEnvoi({
      cle,
      typeMime: parsedInput.typeMime,
      taille: parsedInput.taille,
    });
    return { id, adresse };
  });

// 2. Après l'envoi par le navigateur : le serveur vérifie ce que R2 a vraiment reçu.
export const confirmerEnvoi = actionConnectee
  .inputSchema(idFichierSchema)
  .action(async ({ parsedInput, ctx }) => {
    const db = getDb();
    const [ligne] = await db
      .select()
      .from(fichier)
      .where(
        and(
          eq(fichier.id, parsedInput.id),
          eq(fichier.utilisateurId, ctx.utilisateur.id),
        ),
      );
    if (!ligne) {
      returnServerError("Fichier introuvable.");
    }
    const recu = await lireObjet(ligne.cle);
    if (
      !recu ||
      recu.taille !== ligne.taille ||
      recu.typeMime !== ligne.typeMime
    ) {
      if (recu) {
        await supprimerObjet(ligne.cle);
      }
      await db.delete(fichier).where(eq(fichier.id, ligne.id));
      returnServerError("L'envoi n'a pas abouti. Réessayez.");
    }
    await db
      .update(fichier)
      .set({ statut: "envoye" })
      .where(eq(fichier.id, ligne.id));
    refresh();
    return { id: ligne.id };
  });

export const supprimerFichier = actionConnectee
  .inputSchema(idFichierSchema)
  .action(async ({ parsedInput, ctx }) => {
    const [ligne] = await getDb()
      .delete(fichier)
      .where(
        and(
          eq(fichier.id, parsedInput.id),
          eq(fichier.utilisateurId, ctx.utilisateur.id),
        ),
      )
      .returning({ cle: fichier.cle });
    if (!ligne) {
      returnServerError("Fichier introuvable.");
    }
    await supprimerObjet(ligne.cle);
    refresh();
    return { ok: true };
  });
```

```ts
// src/features/fichiers/queries.ts
import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fichier } from "@/db/schema";
import { utilisateurConnecte } from "@/features/compte/session";

export async function mesFichiers() {
  const utilisateur = await utilisateurConnecte();
  return getDb()
    .select({
      id: fichier.id,
      nom: fichier.nom,
      taille: fichier.taille,
      creeLe: fichier.creeLe,
    })
    .from(fichier)
    .where(
      and(
        eq(fichier.utilisateurId, utilisateur.id),
        eq(fichier.statut, "envoye"),
      ),
    )
    .orderBy(desc(fichier.creeLe));
}

export async function monFichier(id: string) {
  const utilisateur = await utilisateurConnecte();
  const [ligne] = await getDb()
    .select({ cle: fichier.cle, nom: fichier.nom })
    .from(fichier)
    .where(
      and(
        eq(fichier.id, id),
        eq(fichier.utilisateurId, utilisateur.id),
        eq(fichier.statut, "envoye"),
      ),
    );
  return ligne ?? null;
}
```

### 6. Le téléchargement

```ts
// src/app/api/fichiers/[id]/route.ts
import { z } from "zod";
import { monFichier } from "@/features/fichiers/queries";
import { adresseLecture } from "@/lib/stockage";

// Le lien affiché reste stable ; l'adresse signée (5 minutes) naît au clic, après contrôle.
export async function GET(
  _requete: Request,
  { params }: RouteContext<"/api/fichiers/[id]">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  const ligne = await monFichier(id);
  if (!ligne) {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  return Response.redirect(await adresseLecture(ligne), 303);
}
```

### 7. L'écran

```tsx
// src/features/fichiers/components/envoi-fichier.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { confirmerEnvoi, preparerEnvoi } from "../actions";
import { TYPES_AUTORISES, type TypeAutorise } from "../schemas";

const ECHEC = "L'envoi n'a pas abouti. Réessayez.";

export function EnvoiFichier() {
  const id = useId();
  const [erreur, setErreur] = useState("");
  const [enCours, startTransition] = useTransition();

  function envoyer(choisi: File) {
    startTransition(async () => {
      setErreur("");
      // 1. Le serveur contrôle le fichier et donne une adresse d'envoi de 5 minutes.
      const preparation = await preparerEnvoi({
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
            ECHEC,
        );
        return;
      }
      // 2. Le navigateur envoie le fichier directement à R2.
      const reponse = await fetch(preparation.data.adresse, {
        method: "PUT",
        headers: { "Content-Type": choisi.type },
        body: choisi,
      });
      if (!reponse.ok) {
        setErreur(ECHEC);
        return;
      }
      // 3. Le serveur vérifie ce que R2 a reçu.
      const confirmation = await confirmerEnvoi({ id: preparation.data.id });
      if (confirmation?.data) {
        toast.success("Fichier enregistré.");
      } else {
        setErreur(confirmation?.serverError ?? ECHEC);
      }
    });
  }

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
            envoyer(choisi);
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
// src/app/(connecte)/fichiers/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { EnvoiFichier } from "@/features/fichiers/components/envoi-fichier";
import { mesFichiers } from "@/features/fichiers/queries";

export const metadata: Metadata = { title: "Mes fichiers" };

export default function PageFichiers() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Mes fichiers</h1>
      <EnvoiFichier />
      <Suspense fallback={<p>Chargement de vos fichiers…</p>}>
        <ListeFichiers />
      </Suspense>
    </main>
  );
}

async function ListeFichiers() {
  const fichiers = await mesFichiers();
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

### 8. Le renvoi vers la connexion

Dans `src/proxy.ts`, ajouter la page au `matcher` :

```ts
  matcher: ["/compte/:path*", "/fichiers/:path*"],
```

La page reste protégée par `utilisateurConnecte()`, et le téléchargement par le Route Handler.

### 9. Essayer

Envoyer une image PNG, puis un fichier `.exe`, puis un PDF de plus de 5 Mo ; cliquer sur un fichier de la liste.

### 10. Mettre en ligne

Saisir les quatre variables dans Vercel, ajouter l'adresse du site en ligne à la règle CORS du bucket, redéployer.

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

  Règle: Une personne accède seulement à ses propres fichiers

    @US-XXX-4 @integration
    Exemple: Camille ouvre sa facture
      Étant donné Camille a envoyé « facture-mars.pdf »
      Quand Camille ouvre ce fichier
      Alors le fichier est trouvé

    @US-XXX-4 @integration @securite
    Exemple: Léo ne peut pas ouvrir la facture de Camille
      Étant donné Camille a envoyé « facture-mars.pdf »
      Et Léo est connecté avec son propre compte
      Quand Léo demande ce fichier par son identifiant
      Alors le fichier est introuvable

    @US-XXX-4 @integration @securite
    Exemple: La liste de Léo ne contient pas la facture de Camille
      Étant donné Camille a envoyé « facture-mars.pdf »
      Et Léo est connecté avec son propre compte
      Quand Léo affiche ses fichiers
      Alors sa liste est vide

    @US-XXX-4 @manuel @securite
    Exemple: Un lien de téléchargement copié ne sert plus après 5 minutes
      Étant donné Camille a copié l'adresse de téléchargement de sa facture
      Quand quelqu'un ouvre cette adresse 6 minutes plus tard, en navigation privée
      Alors R2 refuse l'accès

  Règle: Un fichier envoyé apparaît dans la liste

    @US-XXX-5 @bout-en-bout
    Exemple: Camille envoie une photo et la voit dans sa liste
      Étant donné Camille est connectée
      Quand Camille envoie « photo-chantier.png »
      Alors « photo-chantier.png » apparaît dans « Mes fichiers »
```

## Tâches de plan prêtes

- [ ] **Tn – Relier le projet à R2** · US-XXX
  - Objectif : le projet a un bucket R2 privé, en Europe, et une table pour ses fichiers
  - Dépend de : —
  - Fichiers : à créer : `src/lib/stockage.ts`, `src/db/schema/fichiers.ts`, migration · à modifier : `src/db/schema/index.ts`, `src/lib/env.ts`, `.env.example`
  - Vérification : US-XXX critère 1 – `npm run db:migrate` crée la table `fichier`
  - Tests : aucun
  - Action manuelle : créer le bucket (juridiction UE), le jeton R2 et la règle CORS dans Cloudflare ; remplir `.env`
- [ ] **Tn+1 – Envoyer un fichier** · US-XXX
  - Objectif : une personne connectée envoie une image ou un PDF, contrôlé par le serveur
  - Dépend de : Tn
  - Fichiers : à créer : `src/features/fichiers/schemas.ts`, `regles.ts`, `actions.ts`, `components/envoi-fichier.tsx`, `regles.test.ts`
  - Vérification : US-XXX critères 1 à 3 – une image PNG passe ; un `.exe` et un PDF de 6 Mo sont refusés avec le message prévu
  - Tests : « Une photo PNG de 2 Mo est acceptée », « Un fichier interdit ou trop lourd est refusé avec un message clair », « La clé du fichier de Camille commence par l'identifiant de Camille » (unitaires)
  - Attention : le serveur contrôle le type et la taille, même si le champ `accept` filtre déjà
- [ ] **Tn+2 – Retrouver et télécharger ses fichiers** · US-XXX
  - Objectif : une personne voit ses fichiers et les télécharge par un lien temporaire
  - Dépend de : Tn+1
  - Fichiers : à créer : `src/features/fichiers/queries.ts`, `queries.test.ts`, `src/app/api/fichiers/[id]/route.ts`, `src/app/(connecte)/fichiers/page.tsx`, `e2e/fichiers.spec.ts` · à modifier : `src/proxy.ts`
  - Vérification : US-XXX critères 4 et 5 – envoyer un fichier, le voir dans la liste, le télécharger ; connecté avec un autre compte, `/api/fichiers/<id>` répond « Fichier introuvable. »
  - Tests : « Camille ouvre sa facture », « Léo ne peut pas ouvrir la facture de Camille », « La liste de Léo ne contient pas la facture de Camille » (intégration) ; « Camille envoie une photo et la voit dans sa liste » (bout en bout)
  - Action manuelle : saisir les variables R2 dans Vercel ; ajouter l'adresse du site en ligne à la règle CORS

## Tests

### Unitaires

```ts
// src/features/fichiers/regles.test.ts
import { describe, expect, it } from "vitest";
import { appartientA, construireCle } from "./regles";
import { demandeEnvoiSchema, TAILLE_MAX } from "./schemas";

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

### Intégration (Vitest + PGlite)

La base de l'application et la session sont doublées : `getDb()` rend la base de test, `utilisateurConnecte()` rend la personne choisie.

```ts
// src/features/fichiers/queries.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/db";
import { fichier, user } from "@/db/schema";
import { creerBaseDeTest } from "../../../tests/helpers/base-de-test";

// Doublures : la base de l'application devient la base de test, la session devient la personne choisie.
const etat = vi.hoisted(() => ({
  db: undefined as unknown,
  utilisateurId: "",
}));
vi.mock("@/db", () => ({ getDb: () => etat.db }));
vi.mock("@/features/compte/session", () => ({
  utilisateurConnecte: async () => ({ id: etat.utilisateurId, nom: "Test" }),
}));

const { mesFichiers, monFichier } = await import("./queries");

function createSut(db: Db) {
  let idFichier = "";
  let resultat: unknown;

  return {
    async givenFichierDe(utilisateurId: string, nom: string) {
      await db.insert(user).values([
        { id: "camille-id", name: "Camille", email: "camille@exemple.fr" },
        { id: "leo-id", name: "Léo", email: "leo@exemple.fr" },
      ]);
      const [ligne] = await db
        .insert(fichier)
        .values({
          utilisateurId,
          cle: `${utilisateurId}/f1.pdf`,
          nom,
          typeMime: "application/pdf",
          taille: 1000,
          statut: "envoye",
        })
        .returning({ id: fichier.id });
      idFichier = ligne.id;
    },
    givenConnecte(utilisateurId: string) {
      etat.utilisateurId = utilisateurId;
    },
    async whenOuvreLeFichier() {
      resultat = await monFichier(idFichier);
    },
    async whenListeSesFichiers() {
      resultat = await mesFichiers();
    },
    thenFichierTrouve(nom: string) {
      expect(resultat).toMatchObject({ nom });
    },
    thenFichierIntrouvable() {
      expect(resultat).toBeNull();
    },
    thenListeVide() {
      expect(resultat).toEqual([]);
    },
  };
}

describe("Fichiers", () => {
  describe("Une personne accède seulement à ses propres fichiers", () => {
    let sut: ReturnType<typeof createSut>;
    let fermer: () => Promise<void>;

    beforeEach(async () => {
      const base = await creerBaseDeTest();
      etat.db = base.db;
      fermer = base.fermer;
      sut = createSut(base.db);
    });
    afterEach(async () => {
      await fermer();
    });

    it("US-XXX-4 – Camille ouvre sa facture", async () => {
      await sut.givenFichierDe("camille-id", "facture-mars.pdf");
      sut.givenConnecte("camille-id");
      await sut.whenOuvreLeFichier();
      sut.thenFichierTrouve("facture-mars.pdf");
    });

    it("US-XXX-4 – Léo ne peut pas ouvrir la facture de Camille", async () => {
      await sut.givenFichierDe("camille-id", "facture-mars.pdf");
      sut.givenConnecte("leo-id");
      await sut.whenOuvreLeFichier();
      sut.thenFichierIntrouvable();
    });

    it("US-XXX-4 – La liste de Léo ne contient pas la facture de Camille", async () => {
      await sut.givenFichierDe("camille-id", "facture-mars.pdf");
      sut.givenConnecte("leo-id");
      await sut.whenListeSesFichiers();
      sut.thenListeVide();
    });
  });
});
```

### Bout en bout (Playwright)

Le test envoie un vrai fichier vers R2 : en local et en CI, utiliser un bucket de test, distinct de celui de production.

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
});
```

## Points de sécurité

- **S1, S2 – Secrets** : les quatre variables R2 restent côté serveur (`server-only`, sans `NEXT_PUBLIC_`). Le navigateur reçoit seulement des adresses signées de 5 minutes.
- **S3 – Contrôle d'accès** : chaque requête et chaque action filtre par `utilisateurId` (venu de la session) ; la clé d'objet commence par l'identifiant de la propriétaire.
- **S5, S7 – Fichiers** : type (liste blanche) et taille (5 Mo) contrôlés par le schéma Zod de l'action ; la signature PUT fige le type et la taille ; `confirmerEnvoi` compare ce que R2 a reçu et efface tout écart.
- **S6 – Affichage** : le nom du fichier s'affiche comme du texte ; il n'entre jamais dans la clé d'objet ; il est nettoyé avant l'en-tête de téléchargement.
- **S7 – Stockage privé** : bucket privé ; le Route Handler vérifie la session et la propriétaire avant de signer une adresse GET de 5 minutes. Le fichier est téléchargé (`attachment`), jamais affiché sur le domaine du site.
- **S9 – Données personnelles** : la suppression d'un compte efface ses lignes (`onDelete: "cascade"`) ; prévoir aussi la suppression des objets R2 du préfixe `<id utilisateur>/`.

## Pièges connus

- **Erreur CORS à l'envoi** : l'adresse de la page (protocole et port compris) doit figurer dans `AllowedOrigins`. Une règle met jusqu'à 30 secondes à s'appliquer. Chaque prévisualisation Vercel a sa propre adresse : ajouter celles qui servent.
- **403 `SignatureDoesNotMatch`** : le navigateur doit envoyer exactement le `Content-Type` signé (`choisi.type`) et le fichier annoncé (même taille).
- **Bucket UE** : il répond seulement à `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`. Sans juridiction, retirer `.eu` dans `src/lib/stockage.ts`.
- **Clé secrète perdue** : Cloudflare l'affiche une seule fois. Créer un nouveau jeton, puis supprimer l'ancien.
- **Lignes « en_attente »** : un envoi abandonné laisse une ligne sans fichier. Elle reste invisible ; une tâche de ménage pourra les effacer plus tard.
- **Type déclaré par le navigateur** : `File.type` vient de l'extension ; le contenu n'est pas inspecté. Le téléchargement forcé (`attachment`) évite qu'un fichier piégé s'exécute dans le site.
- **Langues** : avec la recette `langues`, la page va sous `src/app/[locale]/(connecte)/fichiers/` ; `src/app/api/fichiers/` reste à sa place.

## Sources

- Cloudflare R2 : https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/ ; https://developers.cloudflare.com/r2/buckets/cors/ ; https://developers.cloudflare.com/r2/api/tokens/ ; https://developers.cloudflare.com/r2/reference/data-location/ ; https://developers.cloudflare.com/r2/pricing/
- AWS SDK 3.1146.0 : adresses signées générées localement et inspectées ; option `signableHeaders` (`@smithy/types`)
- Next.js 16.4, documentation embarquée : `01-app/01-getting-started/15-route-handlers.md` ; `01-app/02-guides/server-actions.md` (corps limité à 1 Mo) ; `01-app/03-api-reference/04-functions/refresh.md`
- next-safe-action 8.7.3 : `dist/index.d.mts` (`returnServerError`)
- Vérifications locales (squelette du pack + recette `connexion`) : `npm run typecheck`, `biome check`, `next build` et Vitest passent ; `next start` : `/fichiers` et `/api/fichiers/<id>` sans session renvoient vers `/connexion`

## Points à vérifier

- Un envoi réel vers R2 (test de bout en bout et parcours manuel) : non exécuté lors de la rédaction (pas de compte R2).
- Le refus par R2 d'un PUT dont la taille diffère de `content-length` signé : attendu d'après la signature SigV4, à constater une fois.
- Le nom d'erreur `NotFound` renvoyé par `HeadObjectCommand` avec R2.
- `refresh()` dans une action appelée depuis `startTransition` (hors `<form action>`) : la liste doit se mettre à jour ; sinon, appeler `router.refresh()` après `confirmerEnvoi`.
- L'obligation d'enregistrer un moyen de paiement pour activer R2, même avec l'offre gratuite : non précisée par les pages consultées.
