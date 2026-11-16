#!/usr/bin/env bash
# Projet Next où les deux tâches d'US-001 sont enregistrées, avec un écran de liste SANS défaut d'expérience :
# erreur expliquée avec « Réessayer », vide avec son action, retrait immédiat avec « Annuler », total mis en forme
# selon la langue. La relecture de l'expérience de fin doit répondre « Rien à signaler » (une fausse alerte coûte plus
# qu'elle ne rapporte).
. "$(dirname "$0")/../_communs/projet-next.sh"

PLAN=aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-voir-total.md
git_essai() { git -c user.email=essai@example.com -c user.name=essai "$@"; }

ecrire src/core/courses/article.entity.ts <<'EOF'
/** Un article de la liste : prix en centimes pour éviter les arrondis. */
export type Article = { nom: string; prixCentimes: number; quantite: number };
EOF

ecrire src/core/courses/liste.rules.ts <<'EOF'
import type { Article } from "./article.entity";

/** Total de la liste, en centimes : somme de prix × quantité. */
export function totalCentimes(articles: readonly Article[]): number {
  return articles.reduce((total, a) => total + a.prixCentimes * a.quantite, 0);
}
EOF
sed -i 's/^- \[ \] \*\*T1 /- [x] **T1 /' "$PLAN"
git_essai add -A && git_essai commit -q -m "feat(T1): calculer le total d'une liste"

ecrire src/features/courses/components/sections/liste-courses.tsx <<'EOF'
"use client";

import type { Article } from "@src/core/courses/article.entity";
import { totalCentimes } from "@src/core/courses/liste.rules";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

type Props = {
  articles: readonly Article[];
  enErreur: boolean;
  recharger: () => void;
  retirer: (nom: string) => void;
  ajouterUnArticle: () => void;
};

/** La liste de courses et son total ; retirer un article se fait tout de suite, « Annuler » le remet (notification du container). */
export function ListeCourses({ articles, enErreur, recharger, retirer, ajouterUnArticle }: Props) {
  if (enErreur)
    return (
      <div role="alert">
        <p>Impossible de charger votre liste. Vérifiez votre connexion, puis réessayez.</p>
        <button type="button" onClick={recharger}>
          Réessayer
        </button>
      </div>
    );
  if (articles.length === 0)
    return (
      <div>
        <p>Votre liste est vide pour l'instant.</p>
        <button type="button" onClick={ajouterUnArticle}>
          Ajouter un article
        </button>
      </div>
    );
  return (
    <section className="flex flex-col gap-2">
      <ul>
        {articles.map((article) => (
          <li key={article.nom} className="break-words">
            {article.nom} ×{article.quantite}
            <button type="button" onClick={() => retirer(article.nom)} aria-label={`Retirer ${article.nom} de la liste`}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <p className="font-semibold">Total : {euros.format(totalCentimes(articles) / 100)}</p>
    </section>
  );
}
EOF
sed -i 's/^- \[ \] \*\*T2 /- [x] **T2 /' "$PLAN"
git_essai add -A && git_essai commit -q -m "feat(T2): afficher la liste et son total"
printf '| 2026-11-16 | T1 | — | |\n| 2026-11-16 | T2 | — | |\n' >> "$PLAN"
git_essai add -A && git_essai commit -q -m "docs: journal du plan d'US-001"
