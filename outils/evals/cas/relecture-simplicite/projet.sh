#!/usr/bin/env bash
# Projet Next où les deux tâches d'US-001 sont enregistrées (rapports validés, test reporté au test groupé), sans les
# relectures de fin. T2 ajoute QUATRE sur-constructions placées exprès, que la relecture de la simplicité de fin
# (pulse:simplicity-reviewer) doit trouver :
#   - une interface ListeSource à une seule implémentation, qu'aucun test ne double (clean-code § 5) ;
#   - une fabrique FabriqueDeListe qui crée un seul type (§ 5 bis, Factory) ;
#   - un cas d'usage AfficherListe qui relaie un appel sans règle métier (§ 5) ;
#   - une erreur avalée : lire() renvoie une liste vide sans trace quand la lecture échoue (§ 8).
. "$(dirname "$0")/../_communs/projet-next.sh"

PLAN=aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-voir-total.md
git_essai() { git -c user.email=essai@example.com -c user.name=essai "$@"; }
. "$(dirname "$0")/../_communs/us-relue.sh"

t1_enregistree

ecrire src/features/courses/liste-source.ts <<'EOF'
import type { Article } from "@src/core/courses/article.entity";

/** Source des articles de la liste. */
export interface ListeSource {
  lire(): Promise<Article[]>;
}

/** Source en mémoire : la seule de cette version. */
export class ListeSourceMemoire implements ListeSource {
  constructor(private readonly articles: Article[]) {}

  async lire(): Promise<Article[]> {
    try {
      return [...this.articles];
    } catch {
      return [];
    }
  }
}

/** Fabrique de la source de la liste. */
export class FabriqueDeListe {
  static creer(articles: Article[]): ListeSource {
    return new ListeSourceMemoire(articles);
  }
}
EOF

ecrire src/features/courses/afficher-liste.use-case.ts <<'EOF'
import type { Article } from "@src/core/courses/article.entity";
import type { ListeSource } from "./liste-source";

/** Cas d'usage : afficher la liste. */
export class AfficherListe {
  constructor(private readonly source: ListeSource) {}

  /** Lit la liste et la renvoie. */
  async executer(): Promise<Article[]> {
    // Renvoie les articles de la source.
    return this.source.lire();
  }
}
EOF

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
