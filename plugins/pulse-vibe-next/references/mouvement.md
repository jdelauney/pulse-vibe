# Le mouvement : du brandkit au code

**Le système de mouvement de l'identité se traduit une fois, puis chaque composant l'emploie.** Les règles (durées, courbes, micro-interactions, chorégraphie, « réduire les animations ») sont dans `regles-ui.md` § 6 du cœur ; les valeurs dans la ligne « Mouvement » de `docs/design.md` § 8 ; la chorégraphie de chaque écran dans `docs/design.md` § 10 et le `note.md` de la maquette retenue. Le CSS suffit aux micro-interactions ; la bibliothèque `motion` sert aux entrées, aux révélations et aux sorties.

## 1. Les valeurs

- **CSS** : la ligne « Mouvement » de `pulse-aidd brandkit css` (`--duree-rapide`, `--duree-moyenne`, `--duree-lente`, `--courbe-entree`, `--courbe-sortie`, `--decalage`) va dans `:root` de `app/globals.css`, avec les nuances. Dans `@theme inline` : `--ease-entree: var(--courbe-entree); --ease-sortie: var(--courbe-sortie);`, qui donnent les classes `ease-entree` et `ease-sortie`. Les durées s'écrivent `duration-(--duree-rapide)`.
- **JavaScript** : `src/config/mouvement.ts` reprend les mêmes valeurs pour `motion`, en secondes :

```ts
// Valeurs de docs/design.md § 8 (ligne « Mouvement ») : un changement d'identité se reporte ici et dans globals.css.
type Courbe = [number, number, number, number];
export const MOUVEMENT: { rapide: number; moyenne: number; lente: number; decalage: number; entree: Courbe; sortie: Courbe } = {
  rapide: 0.15, moyenne: 0.3, lente: 0.7, decalage: 0.06,
  entree: [0.25, 1, 0.5, 1], sortie: [0.5, 0, 0.75, 0],
};
```

## 2. Micro-interactions en CSS

Chaque élément interactif répond au survol, au focus et à la pression (`regles-ui.md` § 6), avec les classes Tailwind ; les déplacements passent sous `motion-safe:`, les changements de couleur restent pour tous.

- **Bouton** : dans la classe de base du `cva` de `src/components/ui/button.tsx`, `transition-[color,background-color,box-shadow,transform] duration-(--duree-rapide) ease-entree motion-safe:active:scale-[0.98]`.
- **Bloc ou ligne cliquable** : `transition-transform duration-(--duree-moyenne) ease-entree motion-safe:hover:translate-x-1`, ou un filet révélé (`scale-x-0` vers `group-hover:scale-x-100`, `origin-left`).
- **Lien qui se souligne** : une classe commune dans `app/globals.css`, employée partout :

```css
@utility lien-trace {
  background: linear-gradient(currentColor, currentColor) no-repeat 0 100% / 0 1px;
  transition: background-size var(--duree-moyenne) var(--courbe-entree);
  &:hover, &:focus-visible { background-size: 100% 1px; }
}
```

- Chaque transition nomme ses propriétés (`transition-[…]`, `transition-transform`, `transition-opacity`) : `transition-all` anime aussi la mise en page.

## 3. Entrées, révélations et sorties avec `motion`

Bibliothèque retenue : **`motion`** (anciennement Framer Motion), licence MIT, React 18 et 19 ; version 14.14.0 vérifiée le 2026-11-23 sur le registre npm et sur https://motion.dev/docs/react. L'installer quand la maquette retenue prévoit une séquence d'ouverture, des révélations au défilement ou des sorties animées : `npm install motion` (dernière version publiée).

- **Préférence « réduire les animations »** : un seul `MotionConfig reducedMotion="user"` autour du contenu, dans `app/layout.tsx` : `motion` y coupe les déplacements et garde les fondus, ce que demande `regles-ui.md` § 6. Ce fournisseur est un composant client, `src/components/shared/elements/mouvement-config.tsx` (`"use client"`, il reçoit `children`).
- **Composants clients au plus bas** (`react.md` § 1) : la page et les sections restent serveur et passent en `children` aux composants de mouvement, qui seuls portent `"use client"` :

```tsx
// src/components/shared/elements/revelation.tsx
"use client";
import { motion, stagger } from "motion/react";
import { MOUVEMENT } from "@src/config/mouvement";

const groupe = { cache: {}, visible: { transition: { delayChildren: stagger(MOUVEMENT.decalage) } } };
const element = {
  cache: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: MOUVEMENT.lente, ease: MOUVEMENT.entree } },
};

// Révèle ses enfants une seule fois, en décalé, quand le groupe entre à l'écran.
export function Revelation({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial="cache" whileInView="visible" viewport={{ once: true }} variants={groupe}>
      {children}
    </motion.div>
  );
}

export function ElementRevele({ children }: { children: React.ReactNode }) {
  return <motion.div variants={element}>{children}</motion.div>;
}
```

- **Ouverture** (titre d'affiche, image principale) : `initial={{ y: 24 }}` et `animate={{ y: 0 }}`, sans `opacity: 0`, pour que l'élément qui mesure la vitesse d'affichage (LCP) se voie dès le premier rendu ; le texte d'appui et l'action suivent en `Revelation`.
- **Effet lié au défilement** (un ou deux par page) : `useScroll` et `useTransform` de `motion/react`, sur `transform` seulement, 10 % de la hauteur de l'image au plus ; une colonne fixe de défilement narratif se fait en CSS (`sticky top-…`).
- **Sorties** (menu, panneau, notification) : `AnimatePresence` de `motion/react` autour de l'élément qui disparaît, `exit` avec `MOUVEMENT.sortie` et `MOUVEMENT.moyenne`. Les composants shadcn animent déjà leurs fenêtres et menus : les garder tels quels.
- Animer `transform` et `opacity` ; une mise en page qui change (largeur, hauteur, position) s'anime avec la propriété `layout` de `motion`, qui passe par `transform`.

## 4. Checklist

- [ ] Valeurs du mouvement dans `:root` de `app/globals.css` et `src/config/mouvement.ts`, identiques à `docs/design.md` § 8 ; aucune durée ni courbe écrite en dur dans un composant.
- [ ] Survol, focus visible et pression sur chaque élément interactif ; déplacements sous `motion-safe:` ; propriétés animées nommées.
- [ ] `MotionConfig reducedMotion="user"` dans `app/layout.tsx` dès que `motion` est installé.
- [ ] `"use client"` seulement sur les composants de mouvement ; pages et sections serveur passées en `children`.
- [ ] Titre d'ouverture et image principale visibles dès le premier rendu (aucune opacité de départ à 0).
- [ ] Chorégraphie conforme à `docs/design.md` § 10 : ordre de lecture, décalage, révélation une seule fois.
