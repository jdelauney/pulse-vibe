#!/usr/bin/env bash
# Projet Next où les deux tâches d'US-001 sont enregistrées (rapports validés, test reporté au test groupé), sans les
# relectures de fin, et sans aucun défaut : une règle pure, un composant qui l'appelle, les tests des deux critères.
# La relecture de la simplicité de fin doit répondre « Rien à signaler » : rien n'est corrigé.
. "$(dirname "$0")/../_communs/projet-next.sh"

PLAN=aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-voir-total.md
git_essai() { git -c user.email=essai@example.com -c user.name=essai "$@"; }
. "$(dirname "$0")/../_communs/us-relue.sh"

t1_enregistree

ecrire src/features/courses/components/sections/liste-courses.tsx <<'EOF'
import type { Article } from "@src/core/courses/article.entity";
import { totalCentimes } from "@src/core/courses/liste.rules";

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** La liste de courses, le prix de chaque article et le total ; les montants suivent la mise en forme française. */
export function ListeCourses({ articles }: { articles: readonly Article[] }) {
  if (articles.length === 0) return <p>Votre liste est vide pour l'instant.</p>;
  return (
    <section className="flex flex-col gap-2">
      <ul>
        {articles.map((article) => (
          <li key={article.id} className="flex justify-between gap-4">
            <span className="min-w-0 break-words">
              {article.nom} × {article.quantite}
            </span>
            <span>{euros.format(article.prixCentimes / 100)} l’unité</span>
          </li>
        ))}
      </ul>
      <p className="font-semibold">Total : {euros.format(totalCentimes(articles) / 100)}</p>
    </section>
  );
}
EOF
t2_enregistree ""
