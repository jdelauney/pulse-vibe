# Charte du wiki — adaptation de « PulseIA — Site public »

Charte graphique du wiki. Source : charte « PulseIA — Site public » (« L'Atelier Vivant »), condensée plus bas. Ce fichier n'est pas publié avec le wiki.

## Adaptation au wiki (HTML/CSS/JS sans Tailwind)

La charte décrit un site Next.js + Tailwind. Le wiki en garde les règles et les valeurs, traduites en CSS pur.

| Charte | Wiki |
|---|---|
| Jetons de thème (`bg-primary`…) | Variables CSS dans `wiki/css/base.css` : noms de la charte (`--orange-incandescent`, `--ardoise-vive`…) puis rôles (`--primaire`, `--fond`, `--surface`, `--texte`, `--texte-secondaire`, `--lisere`, `--alerte`). Les pages n'utilisent que les rôles. |
| `data-theme="public"`, pas de mode clair | Un seul thème, sombre. Pas de bascule clair/sombre (remplace le plan initial). |
| Figtree variable auto-hébergée | `wiki/assets/polices/Figtree-Variable.woff2` (licence OFL jointe), `font-display: swap`, repli système. |
| Graisses | 700 titres de section et héros de l'accueil ; 900 héros des autres pages ; 600 titres de carte ; 500 étiquettes ; 400 texte. Aucune autre. |
| Échelle de texte 13/14/16/18 | Variables `--texte-xs/sm/base/lg`, vérifiées dans le navigateur. |
| Rythme de section 64/80/96/112 | `padding-block` par paliers de largeur (640/768/1024 px), une seule classe `.section`. |
| Conteneurs 896/1152/1280 | `.conteneur-lecture` (896), `.conteneur` (1152), `.conteneur-large` (1280). Texte courant borné à `95ch`. |
| En-tête fixe + `scroll-padding-top: 8rem` | En-tête en pilule flottante (Ardoise Vive 50 %, flou moyen : seul flou du wiki) ; `html { scroll-padding-top: 8rem }`, aucun `scroll-margin` par cible. |
| `overflow-x: clip` | Sur `html`. |
| Cartes | Ardoise Vive, 16 px, liseré 1 px, ombre de surface, survol élévation 8 px en 300 ms. |
| Pilule = ce qui s'active | Boutons, liens d'action, pastilles de filtre de l'index des commandes (qui s'activent). Les étiquettes inertes : pastille d'accroche, jamais cliquable. |
| CTA unique (`PulseGlowButton`) | Un par vue au plus : accueil « Commencer le tutoriel rapide », fin de tutoriel rapide « Passer au mode complet ». Ailleurs, boutons applicatifs (plein orange une fois par vue, sinon contour). |
| Vert absent | « Résultat attendu », « Réussi » : liseré mauve + icône + mot. Aucun `green`, `emerald`, `lime`. |
| Rouge d'alerte | Encadré « Risque » seulement, toujours avec le mot « Risque : » ; jamais dans le même bloc qu'un élément orange sans texte. |
| Ordre doublé | Étapes du parcours : échelle de maturité (4 pas) + numéro + nom ; jamais la couleur seule. Les 7 étapes du wiki passent sur 4 couleurs + numéro. |
| Encadrés | Conseil : liseré mauve. Attention : fond Braise Sourde, liseré orange. Risque : liseré rouge d'alerte + mot. |
| Code et commandes | Exception assumée à la famille unique : `ui-monospace, SFMono-Regular, Consolas, monospace` dans les blocs de commande seulement ; surface Ardoise Vive, liseré, bouton Copier en contour. |
| Champs | Recherche : 32 px, Contour de Champ, focus anneau 3 px orange à 50 %. |
| Révélations au défilement | `animation-timeline: view()` + `animation-range` explicite, repli IntersectionObserver ; montée en fondu, fondu flouté, entrée gauche/droite. Une fois, puis rien. |
| Animations des flux | SVG aux couleurs de la traînée (5 arrêts littéraux) et de la maturité ; lancées à l'apparition, jouées une fois ; lecture/pause/étape à la demande de la personne (pas une boucle). `prefers-reduced-motion` : schéma final statique. |
| Séparateur en vague | Entre les sections de l'accueil et des tutoriels seulement, `pointer-events: none`. |
| Visuels biotechnologiques | En motion design (décision du 2026-10-10) : SVG animé dans le héros de l'accueil — un profil de visage mi-humain mi-circuit : le contour humain se trace, des pistes de circuit et des nœuds s'allument depuis l'intérieur, une onde de pouls traverse le visage aux couleurs de la traînée, puis tout se fige. Joué une fois au chargement (Mouvement Utile), schéma final statique en mouvement réduit, `aria-hidden` + texte équivalent. Variantes plus petites en ouverture des tutoriels et de Concepts (humain + machine dans le même objet). Pas de photographie, pas de néon générique. |

Contrôles ajoutés à `wiki.test.js` : aucun `green|emerald|lime` dans `wiki/` ; aucune couleur hors variables dans les pages HTML (`style=` avec couleur littérale) ; graisses employées dans le CSS ∈ {400, 500, 600, 700, 900}.

---

## Charte source (verbatim)

```yaml
name: PulseIA — Site public
description: Un atelier nocturne où quelque chose bat — fond profond, une seule lumière chaude, le mouvement comme preuve de vie.
colors:
  orange-incandescent: "oklch(0.68 0.2 30)"
  braise-sourde: "oklch(0.25 0.03 30)"
  mauve-remanence: "oklch(0.65 0.22 310)"
  noir-de-chambre: "oklch(0.141 0.005 285.823)"
  ardoise-vive: "oklch(0.16 0.02 290)"
  penombre-mauve: "oklch(0.22 0.02 300)"
  gris-de-veille: "oklch(0.7 0.03 300)"
  blanc-de-trait: "oklch(0.96 0 0)"
  blanc-signal: "oklch(0.98 0 0)"
  lisere-remanent: "oklch(0.4 0.08 320 / 30%)"
  contour-de-champ: "oklch(61.479% 0.04075 320.305 / 0.8)"
  rouge-alerte: "oklch(0.65 0.25 25)"
  trainee-1: "#FF6B35"
  trainee-2: "#FF8C42"
  trainee-3: "#C56CF0"
  trainee-4: "#9B59B6"
  trainee-5: "#8E44AD"
  maturite-1: "#FD6844"
  maturite-2: "#FE8C2C"
  maturite-3: "#E068D8"
  maturite-4: "#B96AFF"
typography:
  display: { fontFamily: "Figtree, ui-sans-serif, system-ui, -apple-system, sans-serif", fontSize: "3.75rem", fontWeight: 900, lineHeight: 1.25, letterSpacing: "-0.025em" }
  headline: { fontFamily: "Figtree, …", fontSize: "3rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "normal" }
  title: { fontFamily: "Figtree, …", fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.33, letterSpacing: "-0.025em" }
  body: { fontFamily: "Figtree, …", fontSize: "1rem", fontWeight: 400, lineHeight: 1.75, letterSpacing: "normal" }
  label: { fontFamily: "Figtree, …", fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.25, letterSpacing: "normal" }
rounded: { sm: "6px", md: "8px", lg: "10px", xl: "14px", "2xl": "16px", "3xl": "24px", full: "9999px" }
spacing: { gutter-sm: "12px", gutter: "16px", gutter-md: "24px", gutter-lg: "32px", section-sm: "64px", section: "80px", section-md: "96px", section-lg: "112px" }
components:
  cta-primary: { textColor: blanc-signal, rounded: full, padding: "0 1.75rem", height: "3rem" }
  cta-primary-lg: { textColor: blanc-signal, rounded: full, padding: "0 2.25rem", height: "3.5rem" }
  button-solid: { backgroundColor: orange-incandescent, textColor: blanc-signal, rounded: lg, padding: "0 0.625rem", height: "2rem" }
  button-outline: { backgroundColor: noir-de-chambre, textColor: blanc-de-trait, rounded: lg, padding: "0 0.625rem", height: "2rem" }
  card-surface: { backgroundColor: ardoise-vive, textColor: blanc-de-trait, rounded: 2xl, padding: "1.5rem" }
  eyebrow-badge: { backgroundColor: penombre-mauve, textColor: gris-de-veille, rounded: full, padding: "0.5rem 0.875rem" }
  input-field: { textColor: blanc-de-trait, rounded: lg, padding: "0.25rem 0.625rem", height: "2rem" }
  nav-pill: { backgroundColor: ardoise-vive, textColor: blanc-de-trait, rounded: full, padding: "0.5rem 1rem" }
```

### Règles retenues (texte source condensé, valeurs inchangées)

**North Star — « L'Atelier Vivant ».** Fond profond presque noir, une seule lampe chaude ; le mouvement est la preuve que quelque chose fonctionne, piloté au défilement, jamais en boucle décorative. Anti-références : template SaaS néon générique (néon + verre dépoli + dégradés partout), brochure corporate froide (bleu institutionnel), portfolio de créatif (l'effet avant le message). Lecteur pressé, sans prérequis technique.

**Couleurs.** Orange Incandescent : seule couleur qui dit « c'est ici » (CTA, focus, étape active, liens du contenu). Braise Sourde : l'orange éteint, fonds secondaires. Mauve de Rémanence : accompagne sans être l'action (étiquettes, fin des dégradés), jamais un bouton. Noir de Chambre : fond permanent. Ardoise Vive : surfaces, deux points au-dessus du fond, séparées par le liseré. Pénombre Mauve : zones inertes, pastilles. Gris de Veille : texte secondaire, gris le plus sombre autorisé (7,0:1). Blanc de Trait : texte. Blanc Signal : texte sur orange/mauve. Liseré Rémanent : toutes les bordures, mauve translucide. Contour de Champ : champs de saisie. Rouge d'Alerte : erreurs et destructions, jamais à côté de l'orange sans texte. Traînée (5 arrêts littéraux) : héros et vagues. Maturité (4 pas OKLCH, AA sur pastille) : seule série de données.

**Règles nommées.** Lumière Unique (orange ≤ 10 % d'une vue, jamais deux fois au même niveau ; exception : grille de comparaison d'offres sœurs). Vert Absent. Ordre Doublé (couleur + nom/numéro/position). Jeton (pas de palette brute). Gris Chaud (gris dérivant vers le violet). Trois Graisses (700/600/400 + 500 étiquettes ; 900 héros hors accueil). Quatre Pas (13/14/16/18). Ligne Lisible (95ch). Rythme Non Négociable (64/80/96/112). Ancre Dégagée (`scroll-padding-top: 8rem`, pas de `scroll-mt`). Deux Métiers (ombre neutre = hiérarchie, lueur colorée = état, jamais les deux). Verre Justifié (flou seulement sur la navigation flottante). Pilule (rayon complet = « ceci s'active »). Champ Dense (32 px). CTA Unique. Mouvement Utile (joue une fois ; seules boucles : CTA, éteintes en mouvement réduit).

**Typographie.** Figtree seule ; Display 700, 36→48→60 px, `-0.025em` ; Headline 700, 30→36→48 px, centré, précédé d'une pastille, suivi d'un sous-titre ; Title 600, 24 px, `h2` rédactionnel avec filet bas 1 px liseré ; Body 400, 16 px, interligne 1,75, paragraphes à 24 px d'écart sauf juste après un titre (0) ; Label 500, 14 px, jamais en capitales.

**Mise en page.** Sections pleine largeur, conteneur centré ; `html { overflow-x: clip }`. Conteneurs 1152/1280/896 px ; gouttières 12→16→24→32 px. En-tête de section : pastille, titre centré, sous-titre Gris de Veille borné à 896 px, puis 48 px. Grilles : 1 colonne, 2 dès `lg` (écart 40 → 64 px), cartes 1/2/3 colonnes.

**Profondeur.** Ombre de surface (`0 4px 6px -1px rgb(0 0 0/.1), 0 2px 4px -2px rgb(0 0 0/.1)`) pour les cartes ; ombre de panneau (`shadow-lg`) pour la navigation ; ombre de scène (`shadow-2xl`) une ou deux fois par page. Liseré interne du CTA : `inset 0 1px 0 rgb(255 255 255/.18), inset 0 -2px 6px rgb(0 0 0/.45)`. Halo d'action : `0 0 36px rgb(204 63 71/.38)` au repos, `0 0 56px rgb(240 159 51/.48)` au survol. Flou : `backdrop-blur-md` sur Ardoise Vive 50 %, navigation seulement.

**Formes.** Pilule (9999 px) pour ce qui se clique ; cartes 16 px, projecteur 24 px ; contrôles 10 px (échelle 6/8/10/14). Bordures = liseré 1 px. Séparations de section = vague SVG animée aux arrêts de la traînée, seule géométrie irrégulière.

**Composants.** Sobre sauf au point d'action.
- CTA : pilule, hauteurs 40/48/56 px, rembourrage 20/28/36 px ; fond dégradé symétrique 9 arrêts magenta → orange → magenta (`#880088 … #f09f33 … #880088`), 300 %, calé à gauche ; survol : le fond glisse à droite, échelle 1,05, halo élargi, onde sur les lettres (20 ms par lettre) ; appui : translation 2 px, échelle 1, ombre interne inversée ; focus : anneau 2 px orange décalé ; texte 600 blanc, ombre 1 px.
- Bouton applicatif : 10 px, hauteurs 24/28/32/40 ; plein orange (survol 80 %), contour (transparent + liseré), fantôme ; focus : anneau 3 px à 50 % + bordure colorée.
- Pastilles : pilule, 8 × 14 px, fond teinte 10 %, liseré teinte 25 %, jamais d'action.
- Cartes : 16/24 px, Ardoise Vive (souvent 80 %), liseré, ombre de surface, survol élévation 8 px ou échelle 1,05 en 300 ms, rembourrage 16/24/32 ; projecteur : halo radial qui suit le curseur (opacité, 500 ms), `overflow: hidden`.
- Champs : 10 px, 32 px, fond transparent, Contour de Champ, focus anneau 3 px 50 % (contour natif remplacé), erreur en Rouge d'Alerte piloté par `aria-invalid`.
- Navigation : pilule flottante, Ardoise Vive 50 %, flou moyen, liseré 60 %, ombre de panneau, 8 × 16 px ; liens Blanc de Trait, actif orange.
- Révélations au défilement : `animation-timeline: view()` avec plage explicite ; montée en fondu, fondu flouté, entrée gauche, entrée droite ; repli sans `animation-timeline` ; mouvement réduit neutralise les boucles.

**À faire.** Rôles plutôt que valeurs brutes ; triptyque d'en-tête de section ; rythme constant ; pilule pour ce qui s'active, 16 px pour ce qui contient ; séparer par le liseré ; révélations à plage explicite ; remplacer le contour de focus ; vérifier tout gris de texte contre le fond (AA).

**À éviter (avec l'alternative).** Gris de texte sous Gris de Veille → Gris de Veille. Orange approchant → le jeton primaire. Quatrième dégradé → traînée ou flamme du CTA seulement. Deux CTA orange dans une vue → un seul, les autres en contour. Mauve en bouton → orange ou contour. Flou sur une surface statique → liseré + ombre. Animation en boucle → jouer une fois. Variantes néon (`neon-blur`, `cosmic-border`, `frutiger-aero`, `purple-3d`, `golden-pill`, `sunset-gradient`) → CTA ou bouton applicatif. Graisse hors 400/500/600/700/900 → l'une d'elles.

Parties propres au site Next.js non reprises (sans objet dans le wiki) : `LayoutSection` et son `mt-4`, champs tactiles 44 px des formulaires de conversion (`touch-field.ts`), onglets de `/contact`, dette Tailwind relevée sur la page d'accueil.
