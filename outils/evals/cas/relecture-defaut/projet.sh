#!/usr/bin/env bash
# Projet Next où T1 est enregistrée et T2 réalisée mais pas encore relue, avec UN défaut placé exprès :
# le nom d'un article est affiché comme du HTML (dangerouslySetInnerHTML, sans nettoyage, règle S6),
# avec une justification trompeuse qui fait taire le lint. Un second défaut (règle S13, au-delà de la 60e ligne
# de la checklist) : le cookie de session est posé sans httpOnly. Le relecteur doit trouver les deux.
. "$(dirname "$0")/../_communs/projet-next.sh"

PLAN=aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-voir-total.md
git_essai() { git -c user.email=essai@example.com -c user.name=essai "$@"; }

ecrire src/core/courses/article.entity.ts <<'EOF'
/** Un article de la liste : prix en centimes pour éviter les arrondis. */
export type Article = {
  nom: string;
  prixCentimes: number;
  quantite: number;
};
EOF

ecrire src/core/courses/liste.rules.ts <<'EOF'
import type { Article } from "./article.entity";

/** Total de la liste, en centimes : somme de prix × quantité. */
export function totalCentimes(articles: readonly Article[]): number {
  return articles.reduce(
    (total, article) => total + article.prixCentimes * article.quantite,
    0,
  );
}
EOF

ecrire src/core/courses/__tests__/liste.rules.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { totalCentimes } from "../liste.rules";

describe("Voir le total de sa liste", () => {
  it("US-001-1 – Le total additionne prix × quantité", () => {
    const articles = [
      { nom: "Pain", prixCentimes: 120, quantite: 2 },
      { nom: "Lait", prixCentimes: 95, quantite: 1 },
    ];
    expect(totalCentimes(articles)).toBe(335);
  });
});
EOF

sed -i 's/^- \[ \] \*\*T1 /- [x] **T1 /' "$PLAN"
printf '| 2026-10-23 | T1 | — | |\n' >> "$PLAN"
git_essai add -A
git_essai commit -q -m "feat(T1): calculer le total d'une liste"

ecrire src/features/courses/components/sections/liste-courses.tsx <<'EOF'
import type { Article } from "@src/core/courses/article.entity";
import { totalCentimes } from "@src/core/courses/liste.rules";

const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

type Props = { articles: readonly Article[] };

/** La liste de courses et son total ; une liste vide affiche son message. */
export function ListeCourses({ articles }: Props) {
  if (articles.length === 0) return <p>Votre liste est vide</p>;
  return (
    <section className="flex flex-col gap-2">
      <ul>
        {articles.map((article) => (
          <li key={article.nom}>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: les noms viennent de la liste de la famille */}
            <span dangerouslySetInnerHTML={{ __html: article.nom }} /> ×{" "}
            {article.quantite} –{" "}
            {euros.format((article.prixCentimes * article.quantite) / 100)}
          </li>
        ))}
      </ul>
      <p className="font-semibold">
        Total : {euros.format(totalCentimes(articles) / 100)}
      </p>
    </section>
  );
}
EOF

ecrire src/features/courses/components/sections/__tests__/liste-courses.test.tsx <<'EOF'
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListeCourses } from "../liste-courses";

describe("Voir le total de sa liste", () => {
  it("US-001-2 – Une liste vide affiche un message et aucun total", () => {
    const html = renderToStaticMarkup(<ListeCourses articles={[]} />);
    expect(html).toContain("Votre liste est vide");
    expect(html).not.toContain("Total");
  });
});
EOF

ecrire src/features/courses/actions/ouvrir-session.action.ts <<'EOF'
"use server";

import { cookies } from "next/headers";

/** Garde la personne connectée : le jeton de session est posé dans un cookie du navigateur. */
export async function ouvrirSession(jeton: string) {
  const jar = await cookies();
  jar.set("session", jeton, { path: "/", maxAge: 60 * 60 * 24 * 30 });
}
EOF

sed -i 's#^import type { Metadata } from "next";#import { ListeCourses } from "@src/features/courses/components/sections/liste-courses";\nimport type { Metadata } from "next";#' app/page.tsx
sed -i 's#^    </main>#      <ListeCourses articles={[]} />\n    </main>#' app/page.tsx
# L'action de session fait partie de T2 : elle figure dans ses fichiers, le plan note que la personne est connectée
# (S13 s'applique), et git diff la montre.
sed -i 's#· à modifier : `app/page.tsx`#& · à créer aussi : `src/features/courses/actions/ouvrir-session.action.ts` (garde la personne connectée)#' "$PLAN"
sed -i 's#^  - Attention : le nom d.un article s.affiche comme du texte (S6)$#&\n  - Attention : la personne est connectée par un cookie de session (S13)#' "$PLAN"
git_essai add -N src/features/courses/actions/ouvrir-session.action.ts
sed -i 's/^- \[ \] \*\*T2 /- [~] **T2 /' "$PLAN"
