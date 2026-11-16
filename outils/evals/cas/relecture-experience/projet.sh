#!/usr/bin/env bash
# Projet Next où les deux tâches d'US-001 sont enregistrées (rapports validés, test reporté au test groupé), sans les
# relectures de fin. L'écran de la liste porte TROIS défauts d'expérience placés exprès, qu'une relecture par tâche
# laisse passer et que la relecture de l'expérience de fin (pulse:ux-reviewer) doit trouver :
#   - une erreur affiche « Une erreur est survenue. », sans cause ni issue (experience § 2) ;
#   - le prix de chaque article est assemblé à la main (toFixed + " €"), alors que le total suit la langue (§ 7) ;
#   - un nom d'article long ne passe jamais à la ligne (whitespace-nowrap) et déborde sur téléphone (§ 7).
. "$(dirname "$0")/../_communs/projet-next.sh"

PLAN=aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-voir-total.md
git_essai() { git -c user.email=essai@example.com -c user.name=essai "$@"; }
. "$(dirname "$0")/../_communs/us-relue.sh"

t1_enregistree

ecrire src/features/courses/components/sections/liste-courses.tsx <<'EOF'
import type { Article } from "@src/core/courses/article.entity";
import { totalCentimes } from "@src/core/courses/liste.rules";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

type Props = { articles: readonly Article[]; enErreur: boolean };

/** La liste de courses, le prix de chaque article et le total. */
export function ListeCourses({ articles, enErreur }: Props) {
  if (enErreur) return <p>Une erreur est survenue.</p>;
  if (articles.length === 0) return <p>Votre liste est vide</p>;
  return (
    <section className="flex flex-col gap-2">
      <ul>
        {articles.map((article) => (
          <li key={article.id} className="flex justify-between whitespace-nowrap">
            <span>
              {article.nom} ×{article.quantite}
            </span>
            <span>{(article.prixCentimes / 100).toFixed(2)} €</span>
          </li>
        ))}
      </ul>
      <p className="font-semibold">Total : {euros.format(totalCentimes(articles) / 100)}</p>
    </section>
  );
}
EOF
t2_enregistree " enErreur={false}"
