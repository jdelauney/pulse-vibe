"use client";

import { Button } from "@src/components/ui/button";
import { useState } from "react";

/** Bouton qui provoque une erreur dans le navigateur : app/error.tsx l'affiche et la signale. */
export function Declencheur() {
  const [declenche, setDeclenche] = useState(false);
  if (declenche) throw new Error("Erreur d'essai de la surveillance");
  return (
    <Button onClick={() => setDeclenche(true)}>
      Déclencher une erreur d'essai
    </Button>
  );
}
