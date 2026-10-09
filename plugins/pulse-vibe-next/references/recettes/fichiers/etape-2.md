### 2. Le métier : entité, erreurs, règles et ports

Le métier ne dépend que de `src/core/`. Les deux ports décrivent ce dont les use-cases ont besoin : le repository de l'étape 5 et l'adapter de l'étape 6 les fournissent, et un test passe des doublures en mémoire.

<!-- fichier: src/core/fichiers/fichier.entity.ts -->
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

<!-- fichier: src/core/fichiers/fichier.errors.ts -->
```ts
// src/core/fichiers/fichier.errors.ts
export type ErreurFichier = "fichier-introuvable" | "envoi-incomplet";
```

<!-- fichier: src/core/fichiers/fichier.rules.ts -->
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

<!-- fichier: src/core/fichiers/fichier-repository.port.ts -->
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

<!-- fichier: src/core/fichiers/stockage-fichiers.port.ts -->
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

