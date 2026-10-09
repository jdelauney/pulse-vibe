### 8. Les actions et les lectures

L'identifiant de la propriétaire vient **de la session** (`ctx.utilisateur.id`), jamais de la saisie. Chaque action assemble le use-case avec le repository et l'adapter, traduit un échec en message, puis appelle `refresh()`.

<!-- fichier: src/features/fichiers/actions/preparer-envoi.action.ts -->
```ts
// src/features/fichiers/actions/preparer-envoi.action.ts
"use server";

import { randomUUID } from "node:crypto";
import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { preparerEnvoi } from "@src/core/fichiers/use-cases/preparer-envoi.use-case";
import { getDb } from "@src/db/db-client";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { demandeEnvoiSchema } from "../schemas/fichier.schema";

// 1. Le serveur contrôle le type et la taille (schéma), réserve une ligne, puis signe une adresse d'envoi courte.
export const preparerEnvoiAction = actionConnectee
  .metadata({ nom: "preparerEnvoi" })
  .inputSchema(demandeEnvoiSchema)
  .action(async ({ parsedInput, ctx }) =>
    preparerEnvoi(
      { fichiers: fichierRepository(getDb()), stockage: stockageFichiers },
      { ...parsedInput, id: randomUUID(), utilisateurId: ctx.utilisateur.id },
    ),
  );
```

<!-- fichier: src/features/fichiers/actions/confirmer-envoi.action.ts -->
```ts
// src/features/fichiers/actions/confirmer-envoi.action.ts
"use server";

import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { confirmerEnvoi } from "@src/core/fichiers/use-cases/confirmer-envoi.use-case";
import { getDb } from "@src/db/db-client";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { MESSAGES_FICHIER } from "../constants/erreur-messages";
import { idFichierSchema } from "../schemas/fichier.schema";

// 2. Après l'envoi par le navigateur : le serveur vérifie ce que R2 a vraiment reçu.
export const confirmerEnvoiAction = actionConnectee
  .metadata({ nom: "confirmerEnvoi" })
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

<!-- fichier: src/features/fichiers/actions/supprimer-fichier.action.ts -->
```ts
// src/features/fichiers/actions/supprimer-fichier.action.ts
"use server";

import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { supprimerFichier } from "@src/core/fichiers/use-cases/supprimer-fichier.use-case";
import { getDb } from "@src/db/db-client";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";
import { actionConnectee } from "@src/lib/safe-action";
import { refresh } from "next/cache";
import { returnServerError } from "next-safe-action";
import { MESSAGES_FICHIER } from "../constants/erreur-messages";
import { idFichierSchema } from "../schemas/fichier.schema";

export const supprimerFichierAction = actionConnectee
  .metadata({ nom: "supprimerFichier" })
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

<!-- fichier: src/features/fichiers/queries/lister-fichiers.query.ts -->
```ts
// src/features/fichiers/queries/lister-fichiers.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";

export async function listerFichiers(utilisateurId: string) {
  return fichierRepository(getDb()).listerEnvoyes(utilisateurId);
}
```

<!-- fichier: src/features/fichiers/queries/trouver-fichier.query.ts -->
```ts
// src/features/fichiers/queries/trouver-fichier.query.ts
import "server-only";
import { getDb } from "@src/db/db-client";
import { fichierRepository } from "@src/db/fichiers/fichier.repository";

/** Le fichier envoyé de cette personne, ou null (inconnu, en attente, ou à quelqu'un d'autre). */
export async function trouverFichier(id: string, utilisateurId: string) {
  return fichierRepository(getDb()).trouverEnvoye(id, utilisateurId);
}
```

