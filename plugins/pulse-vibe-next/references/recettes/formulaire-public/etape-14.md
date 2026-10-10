### 14. Le widget

<!-- fichier: src/components/shared/elements/widget-turnstile.tsx -->
```tsx
// src/components/shared/elements/widget-turnstile.tsx
"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type OptionsTurnstile = {
  sitekey: string;
  language: string;
  callback: (jeton: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: OptionsTurnstile) => string;
      remove: (id: string) => void;
    };
  }
}

// Widget Cloudflare Turnstile : vérifie sans question qu'une personne remplit le formulaire.
export function WidgetTurnstile({
  cleSite,
  surReponse,
  surErreur,
}: {
  cleSite: string;
  surReponse: (jeton: string | null) => void;
  /** Le script ou le widget n'a pas pu se charger (bloqueur, réseau, erreur Cloudflare). */
  surErreur: () => void;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [scriptCharge, setScriptCharge] = useState(false);

  useEffect(() => {
    if (!scriptCharge || !conteneur.current || !window.turnstile) return;
    const id = window.turnstile.render(conteneur.current, {
      sitekey: cleSite,
      language: "fr",
      callback: (jeton) => surReponse(jeton),
      "expired-callback": () => surReponse(null),
      "error-callback": () => {
        surReponse(null);
        surErreur();
      },
    });
    return () => window.turnstile?.remove(id);
  }, [scriptCharge, cleSite, surReponse, surErreur]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptCharge(true)}
        onError={surErreur}
      />
      <div ref={conteneur} />
    </>
  );
}
```

