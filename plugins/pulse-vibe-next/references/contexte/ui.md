# Pack Pulse Next.js – pour /pulse:ui

- **identite** : une fois `docs/design.md` écrit et le squelette en place, appliquer le thème selon la référence « Le thème » ci-dessous (fichier `src/app/globals.css`, polices dans `src/app/layout.tsx`), puis remplir « Dans le code » de `docs/design.md` avec le fichier et la correspondance rôle → variable.
- **maquettes** : indiquer à chaque agent `pulse:designer` d'employer les variables CSS de shadcn (section « Pour les maquettes ») et les composants courants de shadcn (bouton, champ, carte, liste, message) dans leur apparence par défaut, habillés par ces variables : la maquette se traduit alors directement en composants.
- **polish** : ajouter un composant manquant avec `npx shadcn@latest add <composant>` ; remplacer une couleur en dur par son rôle (`bg-primary`, `text-muted-foreground`…).
- **audit** : signaler toute couleur Tailwind brute (`bg-blue-500`, `text-gray-600`) ou valeur hexadécimale dans un composant, hors `src/components/ui/`.
