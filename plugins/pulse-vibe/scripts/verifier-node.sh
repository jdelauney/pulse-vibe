#!/bin/sh
# Pulse – Node.js au démarrage d'une session (hook SessionStart en forme shell : il tourne sans Node).
# Les garde-fous de Pulse (secrets, commandes risquées) et ses outils tournent sous Node.js : sans lui,
# Claude Code saute ces hooks sans rien dire. Ce script le dit à Claude, qui prévient la personne.
# MINIMUM : la version la plus ancienne prise en charge (Lighthouse 13, squelette Next) ; les README,
# /pulse:init et la CI la reprennent (tests/verifier-node.test.js).
# PULSE_NODE : le programme essayé à la place de node (tests).
MINIMUM="22.19"
node_cmd="${PULSE_NODE:-node}"

if ! command -v "$node_cmd" >/dev/null 2>&1; then
  echo "Pulse – Node.js est introuvable : les garde-fous de Pulse (secrets, commandes risquées) et ses outils sont à l'arrêt pendant cette session."
  echo "Dites-le à la personne dès votre première réponse : installer Node.js $MINIMUM ou plus (https://nodejs.org, version LTS), puis fermer et relancer Claude Code."
  echo "D'ici là, demandez son accord avant chaque commande qui envoie, publie, supprime ou lit un fichier .env."
  exit 0
fi

version="$("$node_cmd" --version 2>/dev/null)"
version="${version#v}"
majeur="${version%%.*}"
reste="${version#*.}"
mineur="${reste%%.*}"
min_majeur="${MINIMUM%%.*}"
min_mineur="${MINIMUM#*.}"
case "$majeur.$mineur" in
  *[!0-9.]*|.*|*.) exit 0 ;; # version illisible : rien à dire
esac
if [ "$majeur" -lt "$min_majeur" ] || { [ "$majeur" -eq "$min_majeur" ] && [ "$mineur" -lt "$min_mineur" ]; }; then
  echo "Pulse – Node.js $version est trop ancien (il faut $MINIMUM ou plus) : des outils de Pulse peuvent échouer."
  echo "Dites-le à la personne dès votre première réponse : installer la version LTS de Node.js (https://nodejs.org), puis fermer et relancer Claude Code."
fi
exit 0
