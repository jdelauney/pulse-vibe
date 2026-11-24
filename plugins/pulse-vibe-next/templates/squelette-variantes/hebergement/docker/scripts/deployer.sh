#!/usr/bin/env bash
# Mise en ligne sur le serveur (hébergement docker), lancée sur le serveur, dans le dossier du site :
#
#   ./scripts/deployer.sh           dernière version de main : construction (tests compris), sauvegarde de la base
#                                   si elle est sur le serveur, migrations, puis le site ; l'image d'avant est gardée
#   ./scripts/deployer.sh retour    remet en ligne l'image d'avant (le site seulement : la base reste telle quelle)
#   ./scripts/deployer.sh journal   les dernières lignes du journal du site (docker compose logs)
#
# Une étape qui échoue arrête la suite : le site d'avant reste en ligne.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f compose.production.yml)
IMAGE="{{NOM_PAQUET}}"

if [ ! -f .env ]; then
  echo "Le fichier .env manque dans $(pwd) : créez-le d'après la fiche de mise en ligne (pulse-aidd pile reference hebergement-docker.md)." >&2
  exit 1
fi

case "${1:-}" in
  "")
    git pull --ff-only
    # L'image en ligne devient « precedente » : ./scripts/deployer.sh retour la remet en ligne.
    if docker image inspect "$IMAGE:courante" >/dev/null 2>&1; then docker image tag "$IMAGE:courante" "$IMAGE:precedente"; fi
    "${COMPOSE[@]}" up -d --build --wait --remove-orphans
    docker image prune -f >/dev/null
    echo "✅ Site en ligne : $(git log -1 --format='%h %s')"
    ;;
  retour)
    if ! docker image inspect "$IMAGE:precedente" >/dev/null 2>&1; then
      echo "Aucune image précédente sur ce serveur : rien à remettre." >&2
      exit 1
    fi
    docker image tag "$IMAGE:precedente" "$IMAGE:courante"
    "${COMPOSE[@]}" up -d --no-build --no-deps --wait app
    echo "✅ Version précédente remise en ligne. La prochaine mise en ligne reprend la dernière version de main."
    ;;
  journal)
    "${COMPOSE[@]}" logs --tail 200 app
    ;;
  *)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
