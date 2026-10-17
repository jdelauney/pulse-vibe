#!/usr/bin/env bash
# Projet Pulse d'essai, partagé par les cas d'évaluation : une liste de courses en HTML et JavaScript,
# décrite jusqu'à la spec verrouillée d'US-001 (sans plan). Lancé dans le dossier vide de chaque essai.
set -euo pipefail

ecrire() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

ecrire CLAUDE.md <<'EOF'
# Liste de courses

## Résumé du projet

Une liste de courses partagée dans le navigateur. Ce projet suit la **méthode Pulse** (plugin `pulse`).

### Adresses

- Dépôt distant : aucun pour l'instant
- Site en ligne : {{à compléter}}

## Stack technique

<!-- pulse_pile:debut -->
- **Pile** : HTML, CSS et JavaScript, sans bibliothèque ; tests avec `node --test`
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

Une famille note ce qu'il faut acheter ; chacun coche ce qu'il a mis dans le panier.
EOF

ecrire docs/prd.md <<'EOF'
# PRD – Liste de courses

## Première version

- **Indispensable** : ajouter un article, cocher un article acheté.
- **En attente** : partager la liste.

## Être trouvé

Non : outil privé.
EOF

ecrire docs/technical.md <<'EOF'
# Choix techniques – Liste de courses

## Pile retenue

HTML, CSS et JavaScript, sans bibliothèque. Les données restent dans le navigateur (`localStorage`).

## Organisation des fichiers

- `index.html` : la page ; `src/liste.js` : les règles de la liste ; `tests/` : les tests.

## Commandes du projet

| Action | Commande |
|---|---|
| Installer les dépendances | aucune |
| Lancer en local | `npx serve .`, puis ouvrir http://localhost:3000 |
| Tester | `node --test` |
| Contrôles automatiques (lint, format, types) | aucune |
| Auditer les dépendances | aucune |
| Construire | aucune |
| Déployer | aucune |

## Données et contrôle d'accès

- Où sont les données : dans le navigateur de chaque personne.
- Qui peut lire, créer, modifier, supprimer quoi : la personne, sur son propre appareil.
- Où ce contrôle est vérifié : sans objet (aucun serveur).

## Secrets et variables d'environnement

Aucun.

## Mise en place

Faite : `index.html` existe.
EOF

ecrire docs/user-stories.md <<'EOF'
# User stories – Liste de courses

## Ordre de réalisation

US-001

---

## Groupe – Tenir la liste (`tenir-liste`)

| ID | Titre | Acteur | Priorité | Taille | Dépend de | Fichier |
|---|---|---|---|---|---|---|
| US-001 | Ajouter un article | membre de la famille | Indispensable | S | — | [US-001-ajouter-article.md](../aidd_docs/tasks/tenir-liste/US-001-ajouter-article.md) |
EOF

ecrire aidd_docs/tasks/tenir-liste/US-001-ajouter-article.md <<'EOF'
# US-001 – Ajouter un article

**En tant que** membre de la famille, **je souhaite** ajouter un article à la liste **afin de** ne pas l'oublier.

**Priorité** : Indispensable · **Taille** : S · **Dépend de** : —

## Critères d'acceptation

1. **Cas nominal** – **Étant donné** une liste vide, **lorsque** j'ajoute « Pain », **alors** « Pain » apparaît dans la liste.
2. **Cas limite** – **Étant donné** la liste, **lorsque** j'ajoute un article vide, **alors** rien n'est ajouté et un message demande un nom.
EOF

ecrire aidd_docs/tasks/tenir-liste/SPEC-US-001-ajouter-article.md <<'EOF'
# Spec – Liste de courses – US-001 Ajouter un article

**Statut** : verrouillée le 2026-10-16

## 1. Intention

Ajouter un article à la liste, qui reste affichée après un rechargement.

## 3. Ce que l'utilisateur voit et fait

| Écran | Ce qu'on y voit | Ce qu'on y fait | Présentation |
|---|---|---|---|
| La liste | les articles, un champ et un bouton « Ajouter » | taper un nom, ajouter | une colonne |

## 6. Scénarios

```gherkin
@US-001-1 @unitaire
Exemple: Un article ajouté apparaît dans la liste
  Étant donné une liste vide
  Lorsque j'ajoute "Pain"
  Alors la liste contient "Pain"
```

```gherkin
@US-001-2 @unitaire
Exemple: Un nom vide est refusé
  Étant donné une liste vide
  Lorsque j'ajoute ""
  Alors la liste reste vide et le message "Indiquez un nom" s'affiche
```

## 9. Terminé quand

Un article ajouté apparaît, et un nom vide est refusé avec un message.

## 10. Questions en suspens

Aucune.
EOF

ecrire aidd_docs/memory/project.md <<<'# Projet'
ecrire aidd_docs/memory/technical.md <<<'# Technique'
ecrire aidd_docs/memory/glossary.md <<<'# Glossaire'
ecrire index.html <<<'<!doctype html><title>Liste de courses</title><ul id="liste"></ul>'

git init -q
git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "chore: projet d'essai"
