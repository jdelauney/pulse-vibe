# Pack Pulse Next.js – pour /pulse:ui

- **identite** : une fois `docs/design.md` écrit et le squelette en place, appliquer le thème selon la référence « Le thème » ci-dessous (fichier `app/globals.css`, polices dans `app/layout.tsx`), puis remplir « Dans le code » de `docs/design.md` avec le fichier et la correspondance rôle → variable.
- **maquettes** : indiquer à chaque agent `pulse:designer` d'employer les variables CSS de shadcn (section « Pour les maquettes ») et les composants courants de shadcn (bouton, champ, carte, liste, message) dans leur apparence par défaut, habillés par ces variables : la maquette se traduit alors directement en composants.
- **polish** : ajouter un composant manquant avec `npx shadcn@latest add <composant>` ; remplacer une couleur en dur par son rôle (`bg-primary`, `text-muted-foreground`…).
- **audit** : signaler toute couleur Tailwind brute (`bg-blue-500`, `text-gray-600`) ou valeur hexadécimale dans un composant, hors `src/components/ui/`.
- **Motifs d'écrans → composants** (shadcn sur Base UI, vérifiés le 2026-10-08 ; installation : `npx shadcn@latest add <composant>`) :

| Motif (`motifs.md`) | Composant |
|---|---|
| Notification | `sonner` (déjà dans le squelette : `toast()`) |
| Boutons d'option | `radio-group` ou `toggle-group` |
| Liste déroulante | `select`, ou `native-select` |
| Sélection avec recherche | `combobox` |
| Panneau latéral | `sheet` (`side="right"`, ou `"bottom"` sur téléphone) |
| Fenêtre modale | `dialog` ; action destructive : `alert-dialog` |
| Tableau de données | `table`, avec la recette `liste` (`pulse-aidd pile recette liste`) |
| Squelette de chargement | `skeleton` |
| État vide | `empty` |
| Graphique | `chart`, couleurs `--chart-1` à `--chart-5` du thème |
| Navigation | `sidebar` (barre latérale), `tabs`, `breadcrumb`, `dropdown-menu` |
