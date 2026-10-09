# Le thème : de `docs/design.md` à shadcn

Le thème vit dans **`app/globals.css`**, en variables CSS que shadcn et Tailwind emploient partout (`bg-primary`, `text-muted-foreground`…). Traduire l'identité, c'est remplacer les valeurs de ces variables : les composants suivent seuls.

## Correspondance

| `docs/design.md` (§ 6 Couleur, § 7 Typographie, § 8 Arrondis) | Variables de `:root` dans `globals.css` |
|---|---|
| Fond | `--background` |
| Surface (cartes, menus) | `--card`, `--popover` |
| Texte | `--foreground`, `--card-foreground`, `--popover-foreground` |
| Texte secondaire | `--muted-foreground` |
| Accent (action principale) | `--primary` ; `--primary-foreground` (texte posé sur l'accent) ; `--ring` (contour de focus : une nuance de l'accent, voir règle 2) |
| Surface secondaire (boutons secondaires, survols, zones calmes) | `--secondary`, `--muted`, `--accent` (et leurs `-foreground`) |
| Erreur | `--destructive` |
| Bordures et champs | `--border`, `--input` |
| Graphiques (s'il y en a) | `--chart-1` à `--chart-5` |
| Arrondis | `--radius` (les autres rayons en découlent) |
| Police du texte | `Geist` → la police choisie, dans `app/layout.tsx` (`next/font/google`), avec `variable: "--font-sans"` |
| Police des titres | ajouter une seconde police `variable: "--font-titre"` et, dans `@theme inline`, `--font-heading: var(--font-titre);` |

`--sidebar-*` : reprendre les valeurs de fond, texte, accent et bordure si le projet a une barre latérale ; `--sidebar-ring` suit toujours `--ring` (règle 2).

## Règles

1. **Valeurs en OKLCH**, comme shadcn : `oklch(0.55 0.18 250)` (luminosité 0 à 1, chroma, teinte en degrés). Convertir les couleurs de `docs/design.md` (hexadécimal ou nom) en OKLCH, et le noter dans « Dans le code » de `docs/design.md`. **Trois couches** (`regles-ui.md` § 1 du cœur) : les nuances de `docs/design.md` vont dans `:root`, hors de `@theme inline`, donc sans classe Tailwind ; les rôles shadcn les citent (`--primary: var(--ocre-700);`). Les composants n'emploient ainsi que les rôles.
2. **Contrastes mesurés** avec `pulse-aidd contraste <couleur> <fond>` (transparence comprise : `oklch(0.205 0 0 / 50%)`) : texte sur fond, texte secondaire sur fond et sur surface secondaire (`--muted-foreground` sur `--muted` : onglets, badges), `--primary-foreground` sur `--primary` : 4,5:1 au moins. Couleurs de graphique (`--chart-1` à `--chart-5`) sur `--background` et sur `--card` : 3:1 au moins (critère 1.4.11), dans `:root` et dans `.dark`, qui a ses propres valeurs. `--input` et `--ring` sur `--background` : 3:1 au moins (contours de champs et focus, critère 1.4.11). Pour `--ring`, le halo de focus compte : les composants le dessinent à 50 % d'opacité (`ring-ring/50`), et ce mélange avec le fond doit atteindre 3:1. Sur fond clair, il faut en général la nuance la plus foncée de l'accent. Corriger la luminosité d'une valeur trop faible, et le dire.
3. **Mode sombre** seulement si `docs/design.md` le prévoit. Le squelette livre un bloc `.dark` (contrastes vérifiés) que rien n'active : sans mode sombre, le supprimer en appliquant le thème. Avec mode sombre : remplir `.dark` (chaque rôle garde la teinte de sa valeur claire, la luminosité s'inverse, et la saturation (chroma) suit la règle des nuances, `regles-ui.md` § 1 du cœur) ; `npm install next-themes` ; dans `app/layout.tsx`, `suppressHydrationWarning` sur `<html>` et `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` (de `next-themes`) autour du contenu de `<body>` ; dans `src/components/ui/sonner.tsx`, `const { theme = "system" } = useTheme()` (de `next-themes`) et `theme={theme as ToasterProps["theme"]}` à la place de `theme="light"` ; puis un sélecteur de thème (https://ui.shadcn.com/docs/dark-mode/next).
4. **La variable de police s'appelle `--font-sans`** dans `layout.tsx` : `globals.css` l'attend sous ce nom (`@theme inline`), sinon le navigateur retombe sur sa police par défaut.
5. **Les composants n'écrivent aucune couleur en dur** : uniquement les rôles (`bg-primary`, `text-destructive`, `border-border`). Une couleur de rôle qui manque devient une variable de plus dans `:root` et `@theme inline`, nommée par son rôle.
6. **Liens dans le texte** : `underline underline-offset-3` et la couleur d'accent (`text-primary`).
7. **Vérifier à l'œil** : `npm run dev`, puis la page d'accueil et un écran avec boutons, champ, carte, message d'erreur ; sur ordinateur et sur téléphone.
8. **Cibles tactiles de 44 px** sur téléphone : le squelette livre boutons et champs à `h-11` (44 px) ; les tailles compactes (`xs`, `sm`, `icon-xs`, `icon-sm`) le restent à partir de `md:`. Un composant réécrit par `npx shadcn add` reprend ces tailles : `src/components/ui/__tests__/cibles-tactiles.test.ts` signale l'écart.

## Pour les maquettes de `/pulse:ui maquettes`

Les maquettes HTML déclarent les **mêmes variables** dans un bloc `:root` : d'abord les nuances (`regles-ui.md` § 1 du cœur), puis les rôles (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--input`, `--destructive`, `--radius`), employés dans leur CSS. L'accent de `docs/design.md` (la couleur d'action) correspond à `--primary` ; `--accent` est, chez shadcn, la surface de survol. La maquette retenue se traduit alors en composants sans réinventer les couleurs : seules les valeurs du thème comptent.
