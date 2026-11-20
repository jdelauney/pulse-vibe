#!/usr/bin/env bash
# Projet d'essai où deux variantes de maquette d'US-001 attendent le choix de la personne (aidd_docs/tasks/in-progress.md),
# avec une identité retenue et une coquille. La personne retient v2 : la maquette retenue est critiquée par ui-critic et
# par deux juges qui ne reçoivent que les captures et le registre.
. "$(dirname "$0")/../_communs/projet.sh"
. "$(dirname "$0")/../_communs/design.sh"

DOSSIER=docs/design/maquettes/US-001-ajouter-article
variante() { # <dossier> <thèse> <contenu de l'écran>
  mkdir -p "$DOSSIER/$1"
  for page in mobile desktop; do
    sed -e "s|  <p>Contenu de l'écran</p>|$3|" -e 's|<title>Coquille – Liste de courses</title>|<title>Ma liste – Liste de courses</title>|' \
      docs/design/coquille.html > "$DOSSIER/$1/$page.html"
  done
  printf '# Variante – %s\n\n**Thèse** : %s\n\n- **Type** : maquette d'"'"'écrans\n- **Écrans couverts** : La liste\n- **États montrés** : normal, vide, erreur\n' "$1" "$2" > "$DOSSIER/$1/note.md"
}
SELECTEUR='<div data-selecteur-etats><button data-etat="normal">Normal</button><button data-etat="vide">Vide</button><button data-etat="erreur">Erreur</button></div>'
FORMULAIRE='<form><label for="nom">Article</label> <input id="nom"> <button>Ajouter à la liste</button></form>'
LISTE='<ul><li>Pain</li><li>Lait</li><li>Pommes</li></ul>'
variante v1-saisie-en-haut "La saisie en haut, la liste dessous." "$SELECTEUR<h1>Ma liste</h1>$FORMULAIRE$LISTE"
variante v2-saisie-au-pouce "La liste d'abord, la saisie en bas, sous le pouce." "$SELECTEUR<h1>Ma liste</h1>$LISTE$FORMULAIRE"

printf '%s\n' "# Travail en cours" "" "**Commande** : /pulse:ui maquettes US-001" "**Étape** : 6, choisir dans le chat" \
  "**Proposées** : v1-saisie-en-haut, v2-saisie-au-pouce (docs/design/maquettes/US-001-ajouter-article/)" > aidd_docs/tasks/in-progress.md

git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "docs(design): variantes de la liste"
