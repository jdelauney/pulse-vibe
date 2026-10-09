### 6. L'adapter de stockage

Le client R2 et les adresses signées vivent dans `src/adapters/storage/`. Toute panne du SDK devient une `ErreurService("stockage", …)` : son message est sans secret ni clé d'objet (la clé commence par l'identifiant d'une personne), et sa `cause` garde seulement trois champs techniques (`name`, `Code`, code HTTP), lus un par un, jamais le texte de l'erreur d'origine (architecture.md §8). `safe-action` journalise et affiche un message générique ; le Route Handler de l'étape 9 utilise `reponseErreur()`.

<!-- fichier: src/adapters/storage/storage.adapter.ts -->
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
import { env } from "@src/config/env";
import type { StockageFichiers } from "@src/core/fichiers/stockage-fichiers.port";
import { ErreurService } from "@src/lib/errors/erreur-service";

const DUREE_ADRESSE_SECONDES = 5 * 60;

let client: S3Client | undefined;

function obtenirClient(): S3Client {
  if (!client) {
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
          Bucket: env.R2_BUCKET,
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
          Bucket: env.R2_BUCKET,
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
        new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: cle }),
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
        new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: cle }),
      );
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  },
};
```

Vérifié avec `@aws-sdk/client-s3` 3.1147.0 : sans `requestChecksumCalculation: "WHEN_REQUIRED"`, l'adresse PUT contient une somme de contrôle de fichier vide (`x-amz-checksum-crc32=AAAAAA==`) ; avec `signableHeaders`, `content-type` et `content-length` font partie de la signature (`X-Amz-SignedHeaders=content-length;content-type;host`).

