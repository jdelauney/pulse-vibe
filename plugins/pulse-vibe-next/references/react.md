# React dans la pile Next.js

**Les réflexes React du code généré, et ce qu'on fait ici.** React 19.3 avec React Compiler, Next.js 16 (App Router, Cache Components). Le rôle de chaque composant (container, section, composite, élément) est dans « Architecture du code » § 4 ; le comportement vu par la personne dans `pulse-aidd qualite experience` ; l'apparence (thème, rôles de couleur, composants shadcn) dans `theme.md` et `/pulse:ui`. Doute sur une API : `node_modules/next/dist/docs/` et la documentation officielle de React.

Chaque règle part d'un réflexe : **par défaut**, ce qu'il produit ; **ici**, ce qu'on fait ; **parce que**, la raison.

## 1. Serveur par défaut, client au plus bas

Par défaut, `"use client"` se pose en tête de la page dès qu'un bouton réagit. Ici, la page, les containers qui lisent et les sections sans interaction restent des composants serveur ; `"use client"` va sur le plus petit composant qui a un état, un effet ou un gestionnaire d'événement, parce que tout ce qui est sous `"use client"` part dans le code envoyé au navigateur, et que les lectures de données ne peuvent plus s'y faire.

```tsx
// ✗ toute la page devient client pour un seul bouton
"use client";
export default function PageFactures() { /* liste, filtres, bouton « Archiver » */ }

// ✓ la page et la liste restent serveur ; seul le bouton est client
export default function PageFactures() {
  return <Suspense fallback={<ListeFacturesSquelette />}><ListeFacturesContainer /></Suspense>;
}
// src/features/factures/components/elements/bouton-archiver.tsx
"use client";
export function BoutonArchiver({ id }: { id: string }) { /* useAction(archiverFacture) */ }
```

Un composant serveur peut être passé en `children` à un composant client : il reste serveur.

## 2. État : au plus près, dérivé plutôt que copié

Par défaut, chaque valeur affichée reçoit son `useState`, et une prop est recopiée dans un état. Ici, parce que deux copies d'une même donnée finissent par se contredire :

- **Une valeur qui se calcule** (total, liste filtrée, libellé) se calcule pendant l'affichage, sans état : React Compiler évite le recalcul inutile.
- **Une prop reste une prop** : un état initialisé depuis une prop ne suit plus ses changements.
- **L'état vit dans le plus petit composant qui en a besoin** ; il remonte au parent commun seulement quand deux composants le partagent.
- **État dans l'adresse avec nuqs** (filtres, tri, page, onglet) : il survit au rechargement et se partage par lien ; le composant client qui l'utilise est sous `<Suspense>`. **Zustand** seulement pour un état d'interface partagé entre composants clients sans lien direct. **TanStack Query** seulement pour un écran très interactif (rafraîchissement automatique, défilement infini), sous `<Suspense>`.

```tsx
// ✗ copie à synchroniser
const [total, setTotal] = useState(0);
useEffect(() => setTotal(totalCentimes(articles)), [articles]);

// ✓ calculé à l'affichage
const total = totalCentimes(articles);
```

## 3. Effets : seulement pour parler à l'extérieur

Par défaut, `useEffect` sert à tout. Ici, un effet synchronise le composant avec quelque chose **hors de React** (abonnement, minuterie, API du navigateur, bibliothèque non React), parce qu'un effet qui modifie un état provoque un second affichage, des valeurs fausses entre les deux, et des boucles difficiles à suivre.

| Réflexe | Ici |
|---|---|
| Effet qui calcule une valeur depuis l'état ou les props | Calcul pendant l'affichage (§ 2) |
| Effet qui réagit à un clic ou à un envoi (« quand `envoye` passe à vrai, afficher… ») | Le code va dans le gestionnaire de l'événement |
| Effet qui remet un état à zéro quand une prop change | `key={id}` sur le composant : React le recrée avec un état neuf |
| Effet qui lit des données au montage | Lecture côté serveur (container + query, sous `<Suspense>`) |
| Effet qui prévient le parent d'un changement | Le parent passe un rappel (`onChange`), appelé dans l'événement |

```tsx
// ✗ remise à zéro par effet : un affichage avec l'ancien brouillon, puis un second
useEffect(() => setBrouillon(""), [factureId]);

// ✓ un composant neuf par facture
<FormulaireCommentaire key={factureId} factureId={factureId} />
```

## 4. Mémoïsation : React Compiler s'en charge

Par défaut, `useMemo`, `useCallback` et `React.memo` s'ajoutent par précaution. Ici, React Compiler est actif : les composants restent simples, sans ces trois outils, parce qu'ajoutés sans mesure ils compliquent la lecture et ne gagnent rien. Une exception s'écrit avec sa raison en commentaire et la mesure qui la justifie (`/pulse:perf`).

## 5. API des composants : composition avant les booléens

Par défaut, un composant gagne une prop booléenne à chaque variante (`avecIcone`, `compact`, `sansBordure`), et elles finissent par se contredire. Ici, parce qu'un composant à dix booléens a des centaines de combinaisons jamais essayées :

- **Contenu par `children`** (ou une prop par emplacement : `actions`, `titre`) plutôt qu'une prop par morceau de texte ou d'icône.
- **Variantes par `cva`** (`variant: "defaut" | "danger"`), une seule prop qui choisit, plutôt que des booléens.
- **Props typées et minimales** : le composant reçoit ce qu'il affiche (`facture`), pas tout l'objet de la page ; un rappel se nomme `onX` (`onArchiver`).
- Un composant se définit **au niveau du module**, parce que défini dans un autre composant, il est recréé à chaque affichage et perd son état.

```tsx
// ✗
<CarteFacture facture={f} avecBoutonArchiver avecBadge compact />
// ✓
<CarteFacture facture={f} actions={<BoutonArchiver id={f.id} />} />
```

## 6. HTML d'abord, ARIA ensuite

Par défaut, un `<div onClick>` fait office de bouton et des attributs ARIA compensent. Ici, l'élément HTML qui porte déjà le rôle (`<button>`, `<a>`, `<label>`, `<ul>`, `<nav>`, titres dans l'ordre) vient d'abord, parce qu'il apporte le clavier, le focus et la lecture d'écran sans code en plus. ARIA complète seulement ce que le HTML ne dit pas (`aria-label` d'un bouton-icône, `aria-invalid`, zone d'annonce). Les composants shadcn sur Base UI le font déjà : les garder plutôt que les réécrire.

## 7. Checklist (implémentation et relecture)

- [ ] `"use client"` seulement sur le plus petit composant interactif ; pages, containers de lecture et sections sans interaction restent serveur.
- [ ] Aucune valeur calculable gardée dans un état ; aucune prop recopiée dans un état ; état dans le plus petit composant qui en a besoin ; filtres, tri et page dans l'adresse (nuqs).
- [ ] Chaque `useEffect` synchronise avec l'extérieur de React ; aucune remise à zéro ni réaction à un événement par effet (`key`, gestionnaire d'événement).
- [ ] Ni `useMemo`, ni `useCallback`, ni `React.memo` sans raison écrite et mesure.
- [ ] Variantes par `cva`, contenu par `children` ou emplacements nommés ; props typées et minimales ; composants définis au niveau du module.
- [ ] Éléments HTML porteurs du rôle (bouton, lien, libellé, liste, titres) ; ARIA seulement en complément.
