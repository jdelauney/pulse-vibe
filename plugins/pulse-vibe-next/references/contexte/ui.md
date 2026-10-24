# Pack Pulse Next.js – pour /pulse:ui

- **identite** : une fois `docs/design.md` écrit et le squelette en place, appliquer « Le thème » (`pulse-aidd pile reference theme.md` ; fichier `app/globals.css`, polices dans `app/layout.tsx`), puis remplir « Dans le code » de `docs/design.md` avec le fichier et la correspondance rôle → variable. Le fichier des variables (contrôle `couleurs-variables`) est `app/globals.css`.
- **maquettes** : indiquer à chaque agent `pulse:designer` d'employer les composants courants de shadcn (bouton, champ, carte, liste, message) dans leur apparence par défaut, habillés par les variables CSS de shadcn : la maquette se traduit alors directement en composants. Les maquettes HTML déclarent les **mêmes variables** dans un bloc `:root` : d'abord les nuances (`regles-ui.md` § 1 du cœur), puis les rôles (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--input`, `--destructive`, `--radius`), employés dans leur CSS. L'accent de `docs/design.md` (la couleur d'action) correspond à `--primary` ; `--accent` est, chez shadcn, la surface de survol. La maquette retenue se traduit alors en composants sans réinventer les couleurs : seules les valeurs du thème comptent.
- **polish** : ajouter un composant manquant avec `npx shadcn@latest add <composant>` ; remplacer une couleur en dur par son rôle (`bg-primary`, `text-muted-foreground`…).
- **audit** : signaler toute couleur Tailwind brute (`bg-blue-500`, `text-gray-600`) ou valeur hexadécimale dans un composant, hors `src/components/ui/`. En mode code, relire « Le thème » (`pulse-aidd pile reference theme.md`), règle 2, pour le halo de focus.
- **Motifs d'écrans → composants** (shadcn sur Base UI, vérifiés le 2026-10-08 ; installation : `npx shadcn@latest add <composant>`) :

| Motif (`motifs.md`) | Composant |
|---|---|
| Notification | `sonner` (déjà dans le squelette) : `toast.success(message)` ; annulation : `toast(message, { action: { label: "Annuler", onClick: annuler } })` ; erreur : `toast.error(message, { duration: Infinity, closeButton: true })` |
| Boutons d'option | `radio-group` dans un formulaire ; `toggle-group` pour un filtre ; `checkbox` pour plusieurs choix |
| Liste déroulante | `select`, ou `native-select` |
| Sélection avec recherche | `combobox` |
| Panneau latéral | `sheet`, `side={estTelephone ? "bottom" : "right"}` avec `const estTelephone = useIsMobile()` (`@src/hooks/use-mobile`, installé avec `sidebar`) |
| Fenêtre modale | `dialog` ; action destructive : `alert-dialog`, bouton de l'action en `variant="destructive"` |
| Tableau de données | `table`, avec la recette `liste` (`pulse-aidd pile recette liste`) ; en-tête visible au défilement : dans `table.tsx`, le conteneur (`data-slot="table-container"`) reçoit une hauteur maximale et `overflow-y-auto`, et `TableHeader` reçoit `sticky top-0 bg-background` |
| Squelette de chargement | `skeleton` |
| État vide | `empty` |
| Graphique | `chart`, couleurs `--chart-1` à `--chart-5` du thème ; `accessibilityLayer` sur le graphique (navigation au clavier) |
| Navigation | `sidebar` (barre latérale), `tabs`, `breadcrumb`, `dropdown-menu` |
