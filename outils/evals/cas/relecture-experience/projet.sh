#!/usr/bin/env bash
# Projet Next où les deux tâches d'US-001 sont enregistrées. L'écran de la liste porte QUATRE défauts d'expérience
# placés exprès, que la relecture de l'expérience de fin (pulse:ux-reviewer) doit trouver :
#   - l'erreur de chargement affiche « Une erreur est survenue. », sans cause ni issue (experience § 2) ;
#   - la liste vide dit seulement « Votre liste est vide », sans l'action qui la remplit (§ 1) ;
#   - retirer un article demande « Êtes-vous sûr ? » : action réversible, confirmation qui ne nomme rien (§ 4) ;
#   - le total est assemblé à la main (toFixed + " €") au lieu de la mise en forme selon la langue (§ 7).
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

type Props = {
  articles: readonly Article[];
  enErreur: boolean;
  retirer: (nom: string) => void;
};

/** La liste de courses, son total, et le retrait d'un article. */
export function ListeCourses({ articles, enErreur, retirer }: Props) {
  if (enErreur) return <p>Une erreur est survenue.</p>;
  if (articles.length === 0) return <p>Votre liste est vide</p>;
  return (
    <section className="flex flex-col gap-2">
      <ul>
        {articles.map((article) => (
          <li key={article.nom}>
            {article.nom} ×{article.quantite}
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Êtes-vous sûr ?")) retirer(article.nom);
              }}
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <p className="font-semibold">
        Total : {(totalCentimes(articles) / 100).toFixed(2) + " €"}
      </p>
    </section>
  );
}
EOF
sed -i 's/^- \[ \] \*\*T2 /- [x] **T2 /' "$PLAN"
git_essai add -A && git_essai commit -q -m "feat(T2): afficher la liste et son total"
printf '| 2026-11-16 | T1 | — | |\n| 2026-11-16 | T2 | — | |\n' >> "$PLAN"
git_essai add -A && git_essai commit -q -m "docs: journal du plan d'US-001"
