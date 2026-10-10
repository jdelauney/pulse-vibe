### 9. Les adresses inconnues

Une adresse qui ne correspond à aucune page affiche ainsi `app/[locale]/not-found.tsx`, dans le layout du site. Cette page ne s'affiche jamais : `noindex` la garde hors de Google.

<!-- fichier: app/[locale]/[...reste]/page.tsx -->
```tsx
// app/[locale]/[...reste]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Cette page ne s'affiche jamais : hors de Google quoi qu'il arrive.
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Adresse inconnue dans une langue : affiche app/[locale]/not-found.tsx, avec le layout du site.
export default function AdresseInconnue() {
  notFound();
}
```

