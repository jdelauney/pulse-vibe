### 3. Les use-cases

Chaque écriture combine la base et le stockage (deux ports) : elle passe par un use-case (architecture.md §5, point 2). Les lectures vont directement au repository (étape 8).

<!-- fichier: src/core/fichiers/use-cases/preparer-envoi.use-case.ts -->
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

<!-- fichier: src/core/fichiers/use-cases/confirmer-envoi.use-case.ts -->
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

<!-- fichier: src/core/fichiers/use-cases/supprimer-fichier.use-case.ts -->
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

