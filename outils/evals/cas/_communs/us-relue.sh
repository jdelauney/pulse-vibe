#!/usr/bin/env bash
# Pour les cas qui commencent en fin de réalisation : les tâches d'US-001 enregistrées comme le ferait /pulse:spirc
# en mode autonome (rapport de relecture validé, test reporté au test groupé, ligne du journal), sans relectures de fin.
# À sourcer après _communs/projet-next.sh ; utilise PLAN et git_essai du script appelant.
# Le code de départ est juste (identifiant par article, tests des deux critères, mise en forme de Biome) : seuls les
# défauts que chaque cas place exprès restent à trouver.

REVUES=aidd_docs/tasks/tenir-liste/revues/PLAN-SPEC-US-001-voir-total

# tache_enregistree <Tn> <message de commit> : met en forme, coche la tâche, écrit son rapport, enregistre, note le journal.
tache_enregistree() {
  local tache="$1" message="$2"
  npx --no-install biome check --write src app >/dev/null 2>&1 || true
  mkdir -p "$REVUES"
  cat > "$REVUES/$tache-2026-11-16.md" <<EOF
# Revue – $tache – 2026-11-16

**Verdict** : ✅ Validé
**Mode** : /pulse:spirc autonome

## Critères d'acceptation

| Critère | Résultat | Commentaire |
|---|---|---|
| US-001 (critères de $tache) | ✅ | réalisés |

## Vérification

- **Verdict** : ✅ Prouvé
- **Filet anti-régression** : tests de la tâche, tous verts (filet limité)

## Constats

aucun

**Blocage** : aucun

## Test par la personne

- **Date** : 2026-11-16
- **Résultat** : ⏳ reporté au test groupé de fin de plan (mode autonome)
- **Remarque** : aucune
EOF
  sed -i "s/^- \[ \] \*\*$tache /- [x] **$tache /" "$PLAN"
  git_essai add -A && git_essai commit -q -m "$message"
  printf '| 2026-11-16 | %s | %s | mode autonome · test reporté |\n' "$tache" "$(git rev-parse --short HEAD)" >> "$PLAN"
  git_essai add -A && git_essai commit -q -m "docs: journal de $tache"
}

# t1_enregistree : l'article (avec son identifiant), la règle du total et son test, puis T1 enregistrée.
t1_enregistree() {
  ecrire src/core/courses/article.entity.ts <<'EOF'
/** Un article de la liste : prix en centimes pour éviter les arrondis. */
export type Article = {
  id: string;
  nom: string;
  prixCentimes: number;
  quantite: number;
};
EOF
  ecrire src/core/courses/liste.rules.ts <<'EOF'
import type { Article } from "./article.entity";

/** Total de la liste, en centimes : somme de prix × quantité. */
export function totalCentimes(articles: readonly Article[]): number {
  return articles.reduce((total, a) => total + a.prixCentimes * a.quantite, 0);
}
EOF
  ecrire src/core/courses/__tests__/liste.rules.test.ts <<'EOF'
import { describe, expect, it } from "vitest";
import { totalCentimes } from "../liste.rules";

describe("Voir le total de sa liste", () => {
  it("US-001-1 – Le total additionne prix × quantité", () => {
    const articles = [
      { id: "a1", nom: "Pain", prixCentimes: 120, quantite: 2 },
      { id: "a2", nom: "Lait", prixCentimes: 95, quantite: 1 },
    ];
    expect(totalCentimes(articles)).toBe(335);
  });
});
EOF
  tache_enregistree T1 "feat(T1): calculer le total d'une liste"
}

# t2_enregistree <props de la liste> : la page affiche la liste, les tests de la liste d'exemple et de la liste vide, puis T2 enregistrée.
# La section src/features/courses/components/sections/liste-courses.tsx est écrite avant par le cas.
t2_enregistree() {
  local props="$1"
  sed -i 's#^import type { Metadata } from "next";#import { ListeCourses } from "@src/features/courses/components/sections/liste-courses";\nimport type { Metadata } from "next";#' app/page.tsx
  sed -i "s#^    </main>#      <ListeCourses articles={[]}$props />\n    </main>#" app/page.tsx
  ecrire src/features/courses/components/sections/__tests__/liste-courses.test.tsx <<EOF
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListeCourses } from "../liste-courses";

// Intl sépare le montant et « € » par une espace insécable : le test la lit comme une espace.
const texte = (html: string) => html.replace(/[\u00A0\u202F]/g, " ");

describe("Voir le total de sa liste", () => {
  it("US-001-1 – La liste d'exemple affiche ses articles et leur total", () => {
    const articles = [
      { id: "a1", nom: "Pain", prixCentimes: 120, quantite: 2 },
      { id: "a2", nom: "Lait", prixCentimes: 95, quantite: 1 },
    ];
    const html = texte(renderToStaticMarkup(<ListeCourses articles={articles}$props />));
    expect(html).toContain("Pain");
    expect(html).toContain("Lait");
    expect(html).toContain("Total : 3,35 €");
  });

  it("US-001-2 – Une liste vide affiche un message et aucun total", () => {
    const html = renderToStaticMarkup(<ListeCourses articles={[]}$props />);
    expect(html).toContain("Votre liste est vide");
    expect(html).not.toContain("Total");
  });
});
EOF
  tache_enregistree T2 "feat(T2): afficher la liste et son total"
}
