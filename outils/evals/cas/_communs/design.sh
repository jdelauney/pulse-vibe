#!/usr/bin/env bash
# Identité retenue et coquille des écrans pour les cas de /pulse:ui, à lancer après projet.sh (dans le dossier de l'essai,
# pulse-aidd dans le PATH) : brandkit retenu, docs/design.md, docs/design/coquille.html (navigation « Ma liste »,
# « Historique », « Réglages »), puis un commit.
set -euo pipefail

ecrire() { mkdir -p "$(dirname "$1")"; cat > "$1"; }

mkdir -p docs/design/identite/retenue
pulse-aidd modele ui/brandkit.json | sed -e 's/Prêts de la bibliothèque du quartier/Liste de courses/' > docs/design/identite/retenue/brandkit.json

{
  cat <<'EOF'
# Design – Liste de courses

> Planche retenue : `docs/design/identite/retenue/` ; ses valeurs : `docs/design/identite/retenue/brandkit.json`.

## 1. Registre

Outil (utiliser).

## 2. Pour qui et dans quelle scène

**Scène d'usage** : un membre de la famille, dans la cuisine ou au magasin, le téléphone dans une main, pressé.

Ce que la scène implique : thème clair, contraste fort, cibles tactiles de 44 px au moins.

## 3. Personnalité

- **Trois mots** : simple · chaleureuse · fiable
- **Ne doit pas évoquer** : une application de banque

## 5. Principes

1. La liste d'abord : ajouter un article se fait en un geste.
2. Rien d'autre à l'écran que ce qui sert aux courses.

EOF
  pulse-aidd brandkit resume docs/design/identite/retenue/brandkit.json
  cat <<'EOF'

## 10. Mouvement

Court, seulement pour signaler un changement d'état.

## 11. À faire / à éviter

- ✅ Des libellés d'action précis (« Ajouter à la liste »).
- ❌ Des cartes pour chaque article.

## 12. Dans le code

à créer à la mise en place
EOF
} > docs/design.md

{
  cat <<'EOF'
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Coquille – Liste de courses</title>
<!-- Coquille Pulse
Vient de : maquette d'essai (2026-11-20)
Icônes : Lucide, en SVG
Logo : le nom « Liste de courses » en police des titres
Navigation : Ma liste, Historique, Réglages
-->
EOF
  pulse-aidd brandkit css docs/design/identite/retenue/brandkit.json
  cat <<'EOF'
<style>
body { margin: 0; background: var(--fond); color: var(--texte); }
.entete { display: flex; align-items: center; justify-content: space-between; padding: var(--e-3) var(--e-4); background: var(--surface); border-bottom: 1px solid var(--filet); }
.logo { font-family: var(--typo-titre-3-police); font-size: 1.25rem; margin: 0; }
.nav { display: flex; gap: var(--e-2); }
.nav a { display: flex; align-items: center; gap: var(--e-1); min-height: var(--cible); padding: 0 var(--e-3); color: var(--texte-secondaire); text-decoration: none; border-radius: var(--rayon-controle); }
.nav a[aria-current="page"] { color: var(--accent); font-weight: 600; background: var(--accent-doux); }
a:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
main { max-width: 40rem; margin: 0 auto; padding: var(--e-4); }
@media (max-width: 767px) {
  .nav { position: fixed; bottom: 0; left: 0; right: 0; justify-content: space-around; background: var(--surface); border-top: 1px solid var(--filet); padding: var(--e-1); }
  .nav a { flex-direction: column; font-size: 0.8rem; }
  main { padding-bottom: calc(var(--cible) + var(--e-6)); }
}
</style>
</head>
<body>
<header class="entete">
  <p class="logo">Liste de courses</p>
  <nav class="nav" aria-label="Navigation principale">
    <a href="#" aria-current="page"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18"/></svg>Ma liste</a>
    <a href="#"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Historique</a>
    <a href="#"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z"/></svg>Réglages</a>
  </nav>
</header>
<main>
  <p>Contenu de l'écran</p>
</main>
</body>
</html>
EOF
} > docs/design/coquille.html

git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "docs(design): identité retenue et coquille"
