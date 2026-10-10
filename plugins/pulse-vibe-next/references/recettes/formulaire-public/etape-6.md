### 6. Le champ piège

Placé hors de l'écran, ignoré au clavier (`tabIndex={-1}`) et par les lecteurs d'écran (`aria-hidden`). Son nom n'est celui d'aucun vrai champ : c'est le seul que le serveur contrôle.

<!-- fichier: src/components/shared/elements/champ-piege.tsx -->
```tsx
// src/components/shared/elements/champ-piege.tsx
import { CHAMP_PIEGE } from "@src/lib/helpers/formulaire-public/champs";
import type { Ref } from "react";

// Champ placé hors de l'écran, ignoré au clavier et par les lecteurs d'écran :
// une personne ne le voit pas, un robot qui remplit tous les champs se trahit.
export function ChampPiege({ ref }: { ref: Ref<HTMLInputElement> }) {
  return (
    <div
      aria-hidden="true"
      className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
    >
      <label htmlFor={CHAMP_PIEGE}>Laissez ce champ vide</label>
      <input
        ref={ref}
        id={CHAMP_PIEGE}
        name={CHAMP_PIEGE}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        // Ignoré par les gestionnaires de mots de passe (1Password, LastPass, Bitwarden).
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore=""
        defaultValue=""
      />
    </div>
  );
}
```

