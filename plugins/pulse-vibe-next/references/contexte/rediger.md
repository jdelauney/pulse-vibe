# Pack Pulse Next.js – pour /pulse:rediger

Intégrer un texte de `docs/textes/<page>.md` dans une page du site :

- **Où va le texte** : dans la section qui affiche ce bloc de la page (`src/features/<domaine>/components/sections/`), ou directement dans `app/…/page.tsx` pour une page simple sans feature (accueil, à propos). Un titre de section devient un `<h2>` (le `<h1>` reste unique par page) ; chaque paragraphe, un `<p>`.
- **Les mots du glossaire** désignent les choses du métier, comme dans le texte validé ; le texte est recopié tel quel, sans reformulation au passage.
- **Le bouton de l'action attendue** : le composant `Button` de shadcn (`@src/components/ui/button`) pour une action dans la page ; pour aller vers une autre page, un lien qui en a l'apparence : `<Link href="…" className={buttonVariants()}>` (`buttonVariants` du même fichier, `Link` de `next/link`).
- **Le titre et la description de la page** (onglet du navigateur, résultats de Google) : `metadonneesDePage({ titre, description, chemin })` de `src/lib/seo/seo.ts` (fiche, règle 43), à accorder avec le texte ; `/pulse:seo textes` les travaille en détail.
- **Rien dans `src/components/ui/`** : ces composants restent génériques ; le texte vit dans la page ou ses sections.
- **Après l'intégration** : `npm run check`, `npm run typecheck`, puis `npm run build` (avec les variables de `.env`, ou `SKIP_ENV_VALIDATION=1 npm run build` pour une construction de vérification) ; ouvrir la page en local (`npm run dev`) et la montrer à la personne.
