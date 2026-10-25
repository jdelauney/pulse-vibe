#!/usr/bin/env bash
# Projet Pulse d'essai sur la pile Next.js (pack pulse-next), partagé par les cas qui mesurent la réalisation :
# le squelette du pack, installé, et une liste de courses décrite jusqu'au plan validé d'US-001 (deux tâches,
# sans base de données). Lancé dans le dossier vide de chaque essai.
# PULSE_EVAL_SANS_INSTALL=1 : sans npm install (tests du dépôt).
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Le pack : à côté du cœur assemblé par lancer.js (evals-pack/next), sinon dans le dépôt.
PACK="$ICI/../../evals-pack/next"
[ -d "$PACK" ] || PACK="$ICI/../../../../plugins/pulse-vibe-next"

ecrire() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

node "$PACK/scripts/squelette.js" --nom "Liste de courses" --description "Une liste de courses partagée." >/dev/null
[ "${PULSE_EVAL_SANS_INSTALL:-}" = "1" ] || npm install --no-audit --no-fund --loglevel=error >/dev/null

# Valeurs fictives : le squelette valide ses variables au démarrage ; aucune tâche ne lit la base.
ecrire .env <<'EOF'
DATABASE_URL=postgresql://essai:essai@localhost:5432/essai
DATABASE_URL_DIRECT=postgresql://essai:essai@localhost:5432/essai
EOF

ecrire CLAUDE.md <<'EOF'
# Liste de courses

## Résumé du projet

Une liste de courses avec son total. Ce projet suit la **méthode Pulse** (plugin `pulse`).

### Adresses

- Dépôt distant : aucun pour l'instant
- Site en ligne : {{à compléter}}

## Stack technique

<!-- pulse_pile:debut -->
- **Pile** : Next.js, TypeScript, Tailwind et shadcn/ui ; tests avec Vitest (pack Pulse Next.js)
<!-- pulse_pile:fin -->

## Profil

<!-- pulse_profil:debut -->
- **Niveau** : Jamais programmé
- **Explications** : normales
- **Rythme** : complet
<!-- pulse_profil:fin -->

## Mémoire du projet

<!-- pulse_memoire:debut -->
<!-- pulse_memoire:fin -->
EOF

ecrire docs/brief.md <<'EOF'
# Brief – Liste de courses

Une famille note ce qu'il faut acheter, avec le prix de chaque article, et voit le total de la liste.
EOF

ecrire docs/prd.md <<'EOF'
# PRD – Liste de courses

## Première version

- **Indispensable** : voir le total de sa liste.
- **En attente** : enregistrer la liste, la partager.

## Être trouvé

Non : outil privé.
EOF

ecrire docs/technical.md <<'EOF'
# Choix techniques – Liste de courses

## Pile retenue

| Élément | Choix | Pourquoi (en une phrase) |
|---|---|---|
| Langage | TypeScript (strict) | Le code est vérifié avant de tourner. |
| Framework | Next.js (App Router), React | Pages et logique serveur dans un seul projet. |
| Interface | Tailwind CSS et shadcn/ui | Des composants accessibles, habillés par le thème. |
| Données | aucune pour la première version | La liste d'exemple est écrite dans le code. |
| Tests automatiques | Vitest | Les scénarios de la spec deviennent des tests. |

**Pack de pile Pulse** : next

## Organisation des fichiers

Palier : hexagonal simplifié du pack Next.js (référence « Architecture du code » du pack). Domaine : `courses`, dans `src/core/courses/` et `src/features/courses/`.

## Commandes du projet

| Action | Commande |
|---|---|
| Installer les dépendances | `npm install` |
| Lancer en local | `npm run dev`, puis ouvrir http://localhost:3000 |
| Tester | `npm test` |
| Contrôles automatiques (lint, format, types) | `npm run check` et `npm run typecheck` (corriger le format : `npm run format`) |
| Auditer les dépendances | `npm audit --omit=dev --audit-level=high` |
| Construire | `npm run build` |
| Déployer | aucune |

## Données et contrôle d'accès

- Où sont les données : aucune donnée enregistrée dans cette version.
- Qui peut lire, créer, modifier, supprimer quoi : sans objet.
- Où c'est vérifié : sans objet.

## Secrets et variables d'environnement

- Fichier local non versionné : `.env` ; modèle versionné : `.env.example`. Aucune variable lue par les tâches de cette version.

## Mise en place

Faite : squelette du pack posé et installé.
EOF

ecrire docs/user-stories.md <<'EOF'
# User stories – Liste de courses

## Ordre de réalisation

US-001

---

## Groupe – Tenir la liste (`tenir-liste`)

| ID | Titre | Acteur | Priorité | Taille | Dépend de | Fichier |
|---|---|---|---|---|---|---|
| US-001 | Voir le total de sa liste | membre de la famille | Indispensable | S | — | [US-001-voir-total.md](../aidd_docs/tasks/tenir-liste/US-001-voir-total.md) |
EOF

ecrire aidd_docs/tasks/tenir-liste/US-001-voir-total.md <<'EOF'
# US-001 – Voir le total de sa liste

**En tant que** membre de la famille, **je souhaite** voir le total de ma liste de courses **afin de** savoir combien je vais dépenser.

**Priorité** : Indispensable · **Taille** : S · **Dépend de** : —

## Critères d'acceptation

1. **Cas nominal** – **Étant donné** « Pain » à 1,20 € × 2 et « Lait » à 0,95 € × 1, **lorsque** j'ouvre la liste, **alors** le total affiché est 3,35 €.
2. **Cas limite** – **Étant donné** une liste vide, **lorsque** je l'ouvre, **alors** je vois « Votre liste est vide » et aucun total.
EOF

ecrire aidd_docs/tasks/tenir-liste/SPEC-US-001-voir-total.md <<'EOF'
# Spec – Liste de courses – US-001 Voir le total de sa liste

**Statut** : verrouillée le 2026-10-23

## 1. Intention

Afficher la liste de courses et son total, prix en centimes pour éviter les arrondis.

## 3. Ce que l'utilisateur voit et fait

| Écran | Ce qu'on y voit | Ce qu'on y fait | Présentation |
|---|---|---|---|
| La liste (page d'accueil) | chaque article (nom, prix, quantité), le total ; ou « Votre liste est vide » | lire | une colonne |

## 6. Scénarios

```gherkin
@US-001-1 @unitaire
Exemple: Le total additionne prix × quantité
  Étant donné "Pain" à 120 centimes × 2 et "Lait" à 95 centimes × 1
  Lorsque je calcule le total
  Alors le total vaut 335 centimes
```

```gherkin
@US-001-2 @unitaire
Exemple: Une liste vide affiche un message et aucun total
  Étant donné une liste vide
  Lorsque j'affiche la liste
  Alors je vois "Votre liste est vide" et aucun total
```

## 9. Terminé quand

Le total d'une liste s'affiche juste, et une liste vide affiche son message.

## 10. Questions en suspens

Aucune.
EOF

ecrire aidd_docs/tasks/tenir-liste/PLAN-SPEC-US-001-voir-total.md <<'EOF'
# Plan – Liste de courses – US-001 Voir le total de sa liste

> Produit par `/pulse:plan` le 2026-10-23 à partir de `SPEC-US-001-voir-total.md` (même dossier, verrouillée) et de `docs/technical.md`.
> Statuts : `[ ]` à faire · `[~]` en cours · `[x]` terminé : c'est le tableau de suivi des tâches.

## Vue d'ensemble

- **US** : US-001 – Voir le total de sa liste · **Groupe** : Tenir la liste · **Priorité** : Indispensable
- **Tâches** : 2 (T1 à T2)
- **S'appuie sur** : aucun
- **Statut** : validé le 2026-10-23
- **Envoi** : local
- **En parallèle avec** : aucune

## Ordre des tâches

```mermaid
flowchart LR
    T1[T1 – Calculer le total] --> T2[T2 – Afficher la liste]
```

## Avant de commencer

- rien

## Conception technique

### Pile et services

| Élément | Choix | Pourquoi (en une phrase) |
|---|---|---|
| Pile | Next.js du pack Pulse | Reprise de « Pile retenue ». |
| Données | aucune : la page affiche une liste vide | Rien n'est enregistré dans cette version. |
| Services externes | aucun | |

### Écrans

| Écran de la spec | Adresse | Public ou réservé | Référencement (écran public) |
|---|---|---|---|
| La liste | `/` | public | sans objet (outil privé) |

Maquette : aucune · Design : aucun

### Données

#### Article

**Stockée** : nulle part (valeur en mémoire)

| Champ | Type | Obligatoire | Contrainte |
|---|---|---|---|
| nom | texte | oui | non vide |
| prixCentimes | entier | oui | ≥ 0 |
| quantite | entier | oui | ≥ 1 |

**Contrôle d'accès vérifié** : sans objet

### Où chaque règle est vérifiée

| Règle de la spec | Où (base / serveur ; navigateur en plus) |
|---|---|
| Total = somme de prix × quantité | règle pure du domaine (`src/core/courses/`) |

### Sécurité

- **Secrets** : aucun
- **Formulaires** : aucun
- **Checklist** : S6 (le nom d'un article s'affiche comme du texte)

### Fichiers

Organisation générale : voir « Organisation des fichiers » dans `docs/technical.md`.

| Fichier | À créer / à modifier | Rôle |
|---|---|---|
| `src/core/courses/article.entity.ts` | à créer | le type Article |
| `src/core/courses/liste.rules.ts` | à créer | le calcul du total |
| `src/features/courses/components/sections/liste-courses.tsx` | à créer | l'affichage de la liste et du total |
| `app/page.tsx` | à modifier | la page d'accueil affiche la liste |

## Tâches

> US terminée quand : la page d'accueil affiche la liste et son total, ou le message de liste vide.

- [ ] **T1 – Calculer le total d'une liste** · US-001
  - Objectif : le total d'une liste se calcule en centimes, sans arrondi
  - Dépend de : —
  - Fichiers : à créer : `src/core/courses/article.entity.ts`, `src/core/courses/liste.rules.ts`, `src/core/courses/__tests__/liste.rules.test.ts`
  - Vérification : US-001 critère 1 – le test du total passe (335 centimes)
  - Tests : « Le total additionne prix × quantité » (unitaire)

- [ ] **T2 – Afficher la liste et son total, avec l'état vide** · US-001
  - Objectif : la page d'accueil montre chaque article et le total, ou « Votre liste est vide »
  - Dépend de : T1
  - Fichiers : à créer : `src/features/courses/components/sections/liste-courses.tsx` et son test dans `__tests__/` · à modifier : `app/page.tsx`
  - Vérification : US-001 critère 2 – la page d'accueil affiche « Votre liste est vide » ; critère 1 – le composant affiche 3,35 € pour la liste d'exemple
  - Tests : « Une liste vide affiche un message et aucun total » (unitaire)
  - Attention : le nom d'un article s'affiche comme du texte (S6)

## Points d'attention

| Risque | Tâche | Ce qu'on prévoit |
|---|---|---|
| aucun identifié | | |

## Journal

| Date | Tâche | Commit | Remarque (écart, limite connue, idée pour plus tard) |
|---|---|---|---|
| 2026-10-23 | — | — | plan validé |
EOF

ecrire aidd_docs/memory/project.md <<<'# Projet'
ecrire aidd_docs/memory/technical.md <<<'# Technique'
ecrire aidd_docs/memory/glossary.md <<<'# Glossaire'

# État que laissent /pulse:init et /pulse:tech : bloc mémoire de CLAUDE.md rempli, autorisations du projet écrites
# (sinon le crochet de mémoire modifie CLAUDE.md au démarrage et /pulse:spirc s'arrête pour demander).
if command -v pulse-aidd >/dev/null 2>&1; then
  pulse-aidd memoire >/dev/null 2>&1 || true
  pulse-aidd autorisations --ecrire >/dev/null 2>&1 || true
fi

git init -q
# Nom d'auteur des commits de l'essai : pendant l'essai, le bac à sable protège .git/config en écriture.
git config user.name essai
git config user.email essai@example.com
git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "chore: projet d'essai Next"
