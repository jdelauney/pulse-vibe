### 10. L'écran : sections, containers et page

La section reçoit tout par props. Le container (client) appelle `useAction` pour les deux actions et envoie le fichier à R2.

<!-- fichier: src/features/fichiers/components/sections/champ-envoi-fichier.tsx -->
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

<!-- fichier: src/features/fichiers/components/containers/envoi-fichier.container.tsx -->
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

<!-- fichier: src/features/fichiers/components/sections/liste-fichiers.tsx -->
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

<!-- fichier: src/features/fichiers/components/containers/liste-fichiers.container.tsx -->
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

<!-- fichier: app/(connecte)/fichiers/page.tsx -->
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

