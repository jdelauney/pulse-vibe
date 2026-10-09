### 5. Le hook de protection

Appelé par le container. Il demande le jeton, garde la référence du champ piège, et donne `champs()` : les valeurs de protection à ajouter aux données envoyées (`{ ...valeurs, ...protection.champs() }`). Cela fonctionne avec TanStack Form comme avec un formulaire simple.

```ts
// src/hooks/use-protection-formulaire.ts
"use client";

import {
  CHAMP_JETON,
  CHAMP_PIEGE,
} from "@src/lib/helpers/formulaire-public/champs";
import { type RefObject, useEffect, useRef, useState } from "react";

export type ProtectionFormulaire = {
  /** Vrai quand le jeton est arrivé : le bouton d'envoi peut s'activer. */
  pret: boolean;
  /** Vrai si le jeton n'a pas pu être obtenu : la section propose de recharger la page. */
  echec: boolean;
  refPiege: RefObject<HTMLInputElement | null>;
  /** Valeurs de protection à ajouter aux données envoyées : { ...valeurs, ...champs() }. */
  champs: () => Record<string, string>;
};

/** Protection d'un formulaire public : à appeler dans son container. */
export function useProtectionFormulaire(
  formulaire: string,
): ProtectionFormulaire {
  const refPiege = useRef<HTMLInputElement>(null);
  const [jeton, setJeton] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    const controleur = new AbortController();
    fetch(
      `/api/jeton-formulaire?formulaire=${encodeURIComponent(formulaire)}`,
      { cache: "no-store", signal: controleur.signal },
    )
      .then((reponse) => (reponse.ok ? reponse.json() : null))
      .then((corps: { jeton?: string } | null) => {
        if (corps?.jeton) setJeton(corps.jeton);
        else setEchec(true);
      })
      .catch(() => {
        if (!controleur.signal.aborted) setEchec(true);
      });
    return () => controleur.abort();
  }, [formulaire]);

  return {
    pret: jeton !== null,
    echec,
    refPiege,
    champs: () => ({
      [CHAMP_JETON]: jeton ?? "",
      [CHAMP_PIEGE]: refPiege.current?.value ?? "",
    }),
  };
}
```

