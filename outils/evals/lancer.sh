#!/usr/bin/env bash
# Lance la suite d'évaluations du cœur (plugins/pulse-vibe/evals/) avec `claude plugin eval` : de vrais essais des
# commandes Pulse sur un petit projet préparé d'avance, notés par des vérifications (outils appelés, fichiers écrits)
# et par un juge. Chaque essai est un vrai appel au modèle, facturé sur votre compte.
#
#   outils/evals/lancer.sh [options de claude plugin eval]     ex. --case plan-controle, --runs 3
#
# Variables : RUNS (essais par cas, 1 par défaut), PLAFOND (coût maximal en dollars, 5 par défaut).
# Les essais lancent des commandes : Claude Code les fait tourner dans son bac à sable, absent sous Windows.
# Lancer depuis Linux ou WSL2, avec bubblewrap et socat installés (sudo apt install bubblewrap socat).
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/../.." && pwd)"
if [ "$(uname -s)" = "Linux" ]; then
  for outil in bwrap socat claude; do
    command -v "$outil" >/dev/null 2>&1 || { echo "Il manque « $outil » (bubblewrap et socat : sudo apt install bubblewrap socat ; claude : npm i -g @anthropic-ai/claude-code)."; exit 1; }
  done
else
  echo "Les essais lancent des commandes, que Claude Code fait tourner dans son bac à sable : lancez ce script depuis Linux ou WSL2."
  exit 1
fi

exec claude plugin eval "$RACINE/plugins/pulse-vibe" \
  --scaffold --trust-plugin --no-publish \
  --runs "${RUNS:-1}" --max-cost-usd "${PLAFOND:-5}" \
  --allow-tools Write Edit "Bash(pulse-aidd *)" "Bash(git *)" "Bash(node *)" \
  "$@"
