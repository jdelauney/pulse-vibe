### 4. Les pages connectées hors de Google

```tsx
// app/(connecte)/layout.tsx
import type { Metadata } from "next";

// Pages réservées aux personnes connectées : hors de Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LayoutConnecte({ children }: LayoutProps<"/">) {
  return children;
}
```

La protection reste la connexion (`utilisateurConnecte()`, recette `connexion`) ; robots.txt est public et reste ouvert.

