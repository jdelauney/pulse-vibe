# Le thème : de `docs/design.md` à shadcn

Le thème vit dans **`app/globals.css`**, en variables CSS que shadcn et Tailwind emploient partout (`bg-primary`, `text-muted-foreground`…). Traduire l'identité, c'est remplacer les valeurs de ces variables : les composants suivent seuls.

## Correspondance

| `docs/design.md` (§ 6 Couleur, § 7 Typographie, § 8 Arrondis) | Variables de `:root` dans `globals.css` |
|---|---|
| Fond | `--background` |
| Surface (cartes, menus) | `--card`, `--popover` |
| Texte | `--foreground`, `--card-foreground`, `--popover-foreground` |
| Texte secondaire | `--muted-foreground` |
| Accent (action principale) | `--primary` ; `--primary-foreground` (texte posé sur l'accent) ; `--ring` (contour de focus, accent éclairci) |
| Surface secondaire (boutons secondaires, survols, zones calmes) | `--secondary`, `--muted`, `--accent` (et leurs `-foreground`) |
| Erreur | `--destructive` |
| Bordures et champs | `--border`, `--input` |
| Graphiques (s'il y en a) | `--chart-1` à `--chart-5` |
| Arrondis | `--radius` (les autres rayons en découlent) |
| Police du texte | `Geist` → la police choisie, dans `app/layout.tsx` (`next/font/google`), avec `variable: "--font-sans"` |
| Police des titres | ajouter une seconde police `variable: "--font-titre"` et, dans `@theme inline`, `--font-heading: var(--font-titre);` |

`--sidebar-*` : reprendre les valeurs de fond, texte, accent et bordure si le projet a une barre latérale ; sinon les laisser.

## Règles

1. **Valeurs en OKLCH**, comme shadcn : `oklch(0.55 0.18 250)` (luminosité 0 à 1, chroma, teinte en degrés). Convertir les couleurs de `docs/design.md` (hexadécimal ou nom) en OKLCH, et le noter dans « Dans le code » de `docs/design.md`.
2. **Contrastes vérifiés par le calcul** : texte sur fond, texte secondaire sur fond, `--primary-foreground` sur `--primary` : 4,5:1 au moins. Corriger la luminosité d'une valeur trop faible, et le dire.
3. **Mode sombre** seulement si `docs/design.md` le prévoit : remplir alors le bloc `.dark` et ajouter un sélecteur de thème (`next-themes`) ; sinon, supprimer le bloc `.dark` pour ne pas laisser un mode sombre gris par défaut.
4. **La variable de police s'appelle `--font-sans`** dans `layout.tsx` : `globals.css` l'attend sous ce nom (`@theme inline`), sinon le navigateur retombe sur sa police par défaut.
5. **Les composants n'écrivent aucune couleur en dur** : uniquement les rôles (`bg-primary`, `text-destructive`, `border-border`). Une nuance qui manque devient une variable de plus dans `:root` et `@theme inline`, nommée par son rôle.
6. **Vérifier à l'œil** : `npm run dev`, puis la page d'accueil et un écran avec boutons, champ, carte, message d'erreur ; sur ordinateur et sur téléphone.

## Pour les maquettes de `/pulse:ui maquettes`

Les maquettes HTML déclarent les **mêmes variables** dans un bloc `:root` (`--background`, `--foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--destructive`, `--radius`) et les emploient dans leur CSS. La maquette retenue se traduit alors en composants sans réinventer les couleurs : seules les valeurs du thème comptent.
