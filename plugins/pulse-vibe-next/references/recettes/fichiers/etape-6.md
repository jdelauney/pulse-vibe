### 6. L'adapter S3

Stockage `s3` (toujours sur Vercel). Stockage `dossier` (docker, serveur) : l'étape « Dossier du serveur », à la place de celle-ci.

Le client S3 et les adresses signées vivent dans `src/adapters/storage/`, dans la classe `StockageS3Adapter` : elle implémente le port `StockageFichiers` (patron Adapter) et reçoit sa configuration par le constructeur (les actions et le Route Handler lui passent l'objet `env`). Elle parle à tout service compatible S3 : l'adresse du service (`S3_ENDPOINT`), la région et le style d'adresse viennent des variables. Toute panne du SDK devient une `ErreurService("stockage", …)` : son message est sans secret ni clé d'objet (la clé commence par l'identifiant d'une personne), et sa `cause` garde seulement trois champs techniques (`name`, `Code`, code HTTP), lus un par un, jamais le texte de l'erreur d'origine (architecture.md §8). `safe-action` journalise et affiche un message générique ; le Route Handler de l'étape 9 utilise `reponseErreur()`.

<!-- fichier: src/adapters/storage/storage.adapter.ts stockage: s3 -->
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
import type { ObjetRecu } from "@src/core/fichiers/fichier.entity";
import type { StockageFichiers } from "@src/core/fichiers/stockage-fichiers.port";
import { ErreurService } from "@src/lib/errors/erreur-service";

const DUREE_ADRESSE_SECONDES = 5 * 60;

/** Ce que l'adapter lit de la configuration : l'objet `env` du squelette convient tel quel. */
export type ConfigurationS3 = {
  S3_ENDPOINT: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_FORCE_PATH_STYLE: boolean;
};

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
 * La seule porte de sortie vers le service S3 (bucket privé), patron Adapter : elle traduit le SDK
 * en mots du projet (le port StockageFichiers). Toute panne devient une
 * ErreurService("stockage", …) sans secret ni donnée personnelle.
 */
export class StockageS3Adapter implements StockageFichiers {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigurationS3) {
    this.client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      // Adresse « <bucket>.<hôte du service> » par défaut ; « <hôte>/<bucket> » si le service le demande.
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      // Adresses signées : pas de somme de contrôle ajoutée d'office (tous les services ne la lisent pas).
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  // Adresse d'envoi : valable 5 minutes, pour ce type exact et cette taille exacte.
  async adresseEnvoi(params: {
    cle: string;
    typeMime: string;
    taille: number;
  }): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new PutObjectCommand({
          Bucket: this.config.S3_BUCKET,
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
  }

  // Adresse de lecture : valable 5 minutes, téléchargement sous le nom d'origine.
  async adresseLecture(params: { cle: string; nom: string }): Promise<string> {
    const nomSur = params.nom.replace(/[^\w.\- ]/g, "_");
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.config.S3_BUCKET,
          Key: params.cle,
          ResponseContentDisposition: `attachment; filename="${nomSur}"`,
        }),
        { expiresIn: DUREE_ADRESSE_SECONDES },
      );
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  }

  // Ce que le service a réellement reçu (null si rien).
  async lireObjet(cle: string): Promise<ObjetRecu | null> {
    try {
      const reponse = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.S3_BUCKET, Key: cle }),
      );
      return {
        taille: reponse.ContentLength ?? 0,
        typeMime: reponse.ContentType ?? "",
      };
    } catch (erreur) {
      if (erreur instanceof Error && erreur.name === "NotFound") return null;
      throw panneDeStockage(erreur);
    }
  }

  async supprimerObjet(cle: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.S3_BUCKET, Key: cle }),
      );
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  }
}

/** Le stockage du projet (patron Factory) : les actions et le Route Handler l'obtiennent ici, avec `env`. */
export function stockageFichiers(config: ConfigurationS3): StockageFichiers {
  return new StockageS3Adapter(config);
}
```

Vérifié avec `@aws-sdk/client-s3` 3.1176.0 : sans `requestChecksumCalculation: "WHEN_REQUIRED"`, l'adresse PUT contient une somme de contrôle de fichier vide (`x-amz-checksum-crc32=AAAAAA==`) ; avec `signableHeaders`, `content-type` et `content-length` font partie de la signature (`X-Amz-SignedHeaders=content-length;content-type;host`). L'adresse signée vise `https://<bucket>.<hôte de S3_ENDPOINT>/<clé>`, ou `https://<hôte>/<bucket>/<clé>` avec `S3_FORCE_PATH_STYLE=true` : la CSP de l'étape 12 autorise les deux.
