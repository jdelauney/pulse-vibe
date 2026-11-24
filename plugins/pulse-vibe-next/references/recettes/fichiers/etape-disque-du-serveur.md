### Disque du serveur (docker, serveur)

Hébergements docker et serveur, à la place de l'étape 6 : la classe `StockageDisqueAdapter` implémente le même port. Les fichiers vont dans `FICHIERS_DOSSIER`, hors de `public/` : rien ne les sert sans passer par le site. Les adresses d'envoi et de lecture sont des routes du site, avec un jeton signé (HMAC-SHA256, clé `FICHIERS_SECRET`) qui fige la clé, le type, la taille ou le nom, et expire au bout de 5 minutes, comme une adresse signée de R2. La clé d'objet est contrôlée avant tout accès au disque : jamais de chemin qui sorte du dossier. Le type reçu est gardé à côté du fichier (`<clé>.type`).

<!-- fichier: src/adapters/storage/storage.adapter.ts hebergement: docker,serveur -->
```ts
// src/adapters/storage/storage.adapter.ts
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ObjetRecu } from "@src/core/fichiers/fichier.entity";
import type { StockageFichiers } from "@src/core/fichiers/stockage-fichiers.port";
import { ErreurService } from "@src/lib/errors/erreur-service";

const DUREE_ADRESSE_MS = 5 * 60 * 1000;
// Clé construite par ReglesFichier : « <id utilisateur>/<id fichier>.<extension> ». Rien d'autre n'atteint le disque.
const CLE_VALIDE = /^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.[a-z0-9]+$/;

/** Ce que l'adapter lit de la configuration : l'objet `env` du squelette convient tel quel. */
export type ConfigurationDisque = {
  FICHIERS_DOSSIER: string;
  FICHIERS_SECRET: string;
};

/** Ce qu'un jeton autorise, pendant 5 minutes. */
export type Autorisation =
  | {
      usage: "envoi";
      cle: string;
      typeMime: string;
      taille: number;
      expire: number;
    }
  | { usage: "lecture"; cle: string; nom: string; expire: number };

/** Une panne du disque, sans le chemin (il contient l'identifiant d'une personne) : seulement le code système. */
function panneDeStockage(erreur: unknown): ErreurService {
  const code = (erreur as { code?: unknown } | null)?.code;
  return new ErreurService("stockage", "Le stockage des fichiers a échoué", {
    cause: { code: typeof code === "string" ? code : undefined },
  });
}

const absent = (erreur: unknown) =>
  (erreur as { code?: unknown } | null)?.code === "ENOENT";

/**
 * Le stockage sur le disque du serveur, patron Adapter : il traduit le système de fichiers en mots du
 * projet (le port StockageFichiers). Les routes d'envoi et de lecture lui présentent les jetons qu'il a signés.
 */
export class StockageDisqueAdapter implements StockageFichiers {
  constructor(
    private readonly config: ConfigurationDisque,
    private readonly maintenant: () => number = Date.now,
  ) {}

  async adresseEnvoi(params: {
    cle: string;
    typeMime: string;
    taille: number;
  }): Promise<string> {
    const jeton = this.signer({
      usage: "envoi",
      ...params,
      expire: this.maintenant() + DUREE_ADRESSE_MS,
    });
    return `/api/fichiers/envoi?jeton=${jeton}`;
  }

  async adresseLecture(params: { cle: string; nom: string }): Promise<string> {
    const jeton = this.signer({
      usage: "lecture",
      ...params,
      expire: this.maintenant() + DUREE_ADRESSE_MS,
    });
    return `/api/fichiers/lecture?jeton=${jeton}`;
  }

  async lireObjet(cle: string): Promise<ObjetRecu | null> {
    const chemin = this.chemin(cle);
    try {
      const [infos, typeMime] = await Promise.all([
        stat(chemin),
        readFile(`${chemin}.type`, "utf8"),
      ]);
      return { taille: infos.size, typeMime };
    } catch (erreur) {
      if (absent(erreur)) return null;
      throw panneDeStockage(erreur);
    }
  }

  async supprimerObjet(cle: string): Promise<void> {
    const chemin = this.chemin(cle);
    try {
      await rm(chemin, { force: true });
      await rm(`${chemin}.type`, { force: true });
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  }

  /** Ce qu'un jeton autorise, s'il est signé par ce serveur, de cet usage et pas encore expiré ; sinon null. */
  verifier(jeton: string, usage: Autorisation["usage"]): Autorisation | null {
    const [corps, signature] = jeton.split(".");
    if (!corps || !signature) return null;
    const attendue = Buffer.from(this.signature(corps));
    const recue = Buffer.from(signature);
    if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue))
      return null;
    let autorisation: Autorisation;
    try {
      autorisation = JSON.parse(
        Buffer.from(corps, "base64url").toString("utf8"),
      );
    } catch {
      return null;
    }
    if (autorisation.usage !== usage || autorisation.expire < this.maintenant())
      return null;
    return CLE_VALIDE.test(autorisation.cle) ? autorisation : null;
  }

  /** Route d'envoi : écrit le fichier s'il correspond exactement au jeton (type et taille). */
  async recevoir(params: {
    jeton: string;
    typeMime: string;
    contenu: Uint8Array;
  }): Promise<"enregistre" | "refuse"> {
    const autorisation = this.verifier(params.jeton, "envoi");
    if (
      autorisation?.usage !== "envoi" ||
      autorisation.typeMime !== params.typeMime ||
      autorisation.taille !== params.contenu.byteLength
    ) {
      return "refuse";
    }
    const chemin = this.chemin(autorisation.cle);
    try {
      await mkdir(path.dirname(chemin), { recursive: true });
      // Écrit à côté puis renomme : jamais de fichier à moitié écrit sous son vrai nom.
      await writeFile(`${chemin}.envoi`, params.contenu);
      await writeFile(`${chemin}.type`, autorisation.typeMime);
      await rename(`${chemin}.envoi`, chemin);
      return "enregistre";
    } catch (erreur) {
      throw panneDeStockage(erreur);
    }
  }

  /** Route de lecture : le fichier, son type et son nom d'origine, ou null (jeton refusé, fichier absent). */
  async ouvrir(
    jeton: string,
  ): Promise<{ contenu: Uint8Array; typeMime: string; nom: string } | null> {
    const autorisation = this.verifier(jeton, "lecture");
    if (autorisation?.usage !== "lecture") return null;
    const chemin = this.chemin(autorisation.cle);
    try {
      const [contenu, typeMime] = await Promise.all([
        readFile(chemin),
        readFile(`${chemin}.type`, "utf8"),
      ]);
      return { contenu, typeMime, nom: autorisation.nom };
    } catch (erreur) {
      if (absent(erreur)) return null;
      throw panneDeStockage(erreur);
    }
  }

  private signer(autorisation: Autorisation): string {
    const corps = Buffer.from(JSON.stringify(autorisation)).toString(
      "base64url",
    );
    return `${corps}.${this.signature(corps)}`;
  }

  private signature(corps: string): string {
    return createHmac("sha256", this.config.FICHIERS_SECRET)
      .update(corps)
      .digest("base64url");
  }

  /** Chemin d'une clé, toujours dans FICHIERS_DOSSIER. */
  private chemin(cle: string): string {
    if (!CLE_VALIDE.test(cle)) {
      throw new ErreurService("stockage", "Clé de fichier invalide");
    }
    return path.join(
      path.resolve(this.config.FICHIERS_DOSSIER),
      ...cle.split("/"),
    );
  }
}

/** Le stockage du projet (patron Factory) : les actions et le Route Handler l'obtiennent ici, avec `env`. */
export function stockageFichiers(
  config: ConfigurationDisque,
): StockageFichiers {
  return new StockageDisqueAdapter(config);
}
```

Les deux routes ne font que présenter le jeton à l'adapter. La taille annoncée par le navigateur est contrôlée avant de lire le corps (5 Mo au plus) ; le téléchargement part toujours en pièce jointe, jamais affiché sur le domaine du site.

<!-- fichier: app/api/fichiers/envoi/route.ts hebergement: docker,serveur -->
```ts
// app/api/fichiers/envoi/route.ts
import { StockageDisqueAdapter } from "@src/adapters/storage/storage.adapter";
import { env } from "@src/config/env";
import { TAILLE_MAX } from "@src/core/fichiers/fichier.entity";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";

// Envoi d'un fichier (hébergement sur un serveur) : le jeton signé par preparerEnvoiAction fige la clé, le type et la taille.
export async function PUT(requete: Request) {
  const jeton = new URL(requete.url).searchParams.get("jeton") ?? "";
  const annoncee = Number(requete.headers.get("content-length"));
  if (!Number.isInteger(annoncee) || annoncee > TAILLE_MAX) {
    return new Response("Fichier trop lourd.", { status: 413 });
  }
  try {
    const resultat = await new StockageDisqueAdapter(env).recevoir({
      jeton,
      typeMime: requete.headers.get("content-type") ?? "",
      contenu: new Uint8Array(await requete.arrayBuffer()),
    });
    return resultat === "enregistre"
      ? new Response(null, { status: 204 })
      : new Response("Envoi refusé.", { status: 403 });
  } catch (erreur) {
    return reponseErreur(erreur, "Envoi d'un fichier");
  }
}
```

<!-- fichier: app/api/fichiers/lecture/route.ts hebergement: docker,serveur -->
```ts
// app/api/fichiers/lecture/route.ts
import { StockageDisqueAdapter } from "@src/adapters/storage/storage.adapter";
import { env } from "@src/config/env";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";

// Téléchargement d'un fichier (hébergement sur un serveur), sur présentation du jeton signé par /api/fichiers/<id>.
export async function GET(requete: Request) {
  const jeton = new URL(requete.url).searchParams.get("jeton") ?? "";
  try {
    const fichier = await new StockageDisqueAdapter(env).ouvrir(jeton);
    if (!fichier) return new Response("Fichier introuvable.", { status: 404 });
    const nomSur = fichier.nom.replace(/[^\w.\- ]/g, "_");
    return new Response(new Uint8Array(fichier.contenu), {
      headers: {
        "Content-Type": fichier.typeMime,
        "Content-Disposition": `attachment; filename="${nomSur}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (erreur) {
    return reponseErreur(erreur, "Téléchargement d'un fichier");
  }
}
```
