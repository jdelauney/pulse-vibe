#!/usr/bin/env bash
# Mise en ligne sur le serveur (hébergement serveur, sans Docker), lancée sur le serveur, dans le dossier du site,
# sous le compte qui possède le site (jamais root) :
#
#   ./scripts/deployer.sh            dernière version de main : installation, tests, sauvegarde de la base si elle est
#                                    sur le serveur, migrations, construction, puis le site redémarre sur la nouvelle
#                                    version ; les 3 dernières versions restent dans versions/
#   ./scripts/deployer.sh installer  première fois : Node.js (version de .nvmrc, par nvm) et le service du site
#   ./scripts/deployer.sh retour     remet en ligne la version d'avant (le site seulement : la base reste telle quelle)
#   ./scripts/deployer.sh journal    les dernières lignes du journal du site (journalctl)
#
# La construction se fait ici, sur le serveur : même système que celui qui fait tourner le site (les modules
# compilés, comme celui des images, y sont justes), et rien à copier depuis le poste. Une étape qui échoue arrête
# la suite : le site d'avant reste en ligne.
set -euo pipefail
cd "$(dirname "$0")/.."
DOSSIER="$(pwd)"
NOM="{{NOM_PAQUET}}"
UNITE="$HOME/.config/systemd/user/$NOM.service"
VERSIONS_GARDEES=3
SAUVEGARDES_GARDEES=7

if [ "$(id -u)" = 0 ]; then
  echo "Lancez ce script sous le compte du site, pas en root (le site tourne sans droits d'administration)." >&2
  exit 1
fi
if [ ! -f .env ]; then
  echo "Le fichier .env manque dans $DOSSIER : créez-le d'après la fiche de mise en ligne (pulse-aidd pile reference hebergement-serveur.md)." >&2
  exit 1
fi

# Valeur d'une variable du fichier .env (dernière ligne NOM=…), sans guillemets autour.
lire_variable() {
  sed -n "s/^$1=//p" .env | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# Node.js de la version de .nvmrc, installé par nvm s'il manque (https://github.com/nvm-sh/nvm).
charger_node() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "nvm manque : installez-le d'après la fiche de mise en ligne, puis relancez." >&2
    exit 1
  fi
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install >/dev/null
  nvm use >/dev/null
  set -u
}

# Service du site, réécrit d'après deploiement/site.service (dossier et Node.js de ce serveur).
installer_service() {
  mkdir -p "$(dirname "$UNITE")"
  local nouveau
  nouveau="$(sed -e "s|@DOSSIER@|$DOSSIER|g" -e "s|@NODE@|$(command -v node)|g" deploiement/site.service)"
  if [ ! -f "$UNITE" ] || [ "$(cat "$UNITE")" != "$nouveau" ]; then
    printf '%s\n' "$nouveau" >"$UNITE"
    chmod 0644 "$UNITE"
    systemctl --user daemon-reload
  fi
  systemctl --user enable "$NOM" >/dev/null 2>&1
}

# Copie de la base avant la mise en ligne, si elle est sur le serveur (une base Neon est sauvegardée par
# scripts/migrer.mjs, par une branche Neon). Les 7 plus récentes restent dans sauvegardes/.
sauvegarder() {
  local adresse hote
  adresse="$(lire_variable DATABASE_URL_DIRECT)"
  hote="$(printf '%s' "$adresse" | sed -n 's|^[a-z]*://[^@]*@\([^:/?]*\).*|\1|p')"
  case "$hote" in
    "" | *.neon.tech) return 0 ;;
  esac
  mkdir -p sauvegardes
  local fichier="sauvegardes/avant-mise-en-ligne-$(date -u +%Y%m%d-%H%M%S).dump"
  pg_dump --format=custom --file="$fichier" "$adresse"
  echo "Sauvegarde créée : $fichier"
  ls -1t sauvegardes/*.dump | tail -n +$((SAUVEGARDES_GARDEES + 1)) | xargs -r rm --
  export PULSE_SAUVEGARDE=pg_dump
}

# Attend que le site réponde (la base aussi : /api/sante), une minute au plus.
attendre_le_site() {
  local port
  port="$(lire_variable PORT)"
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${port:-3000}/api/sante"; then return 0; fi
    sleep 2
  done
  echo "❌ Le site ne répond pas sur /api/sante : ./scripts/deployer.sh journal pour lire la cause ; ./scripts/deployer.sh retour remet la version d'avant." >&2
  exit 1
}

basculer_vers() { # basculer_vers <versions/…> : le lien « courante » change d'un coup, puis le site redémarre
  ln -sfn "$1" courante.nouvelle
  mv -T courante.nouvelle courante
  systemctl --user restart "$NOM"
  attendre_le_site
}

case "${1:-}" in
  "")
    git pull --ff-only
    charger_node
    npm ci --no-audit --no-fund
    npm test
    sauvegarder
    node --env-file=.env scripts/migrer.mjs --en-ligne
    PULSE_SORTIE=standalone npm run build
    version="versions/$(date -u +%Y%m%d-%H%M%S)"
    mkdir -p versions
    cp -a .next/standalone "$version"
    cp -a .next/static "$version/.next/static"
    cp -a public "$version/public"
    # La construction recopie .env dans la sortie autonome : le site le lit au démarrage par le service, à sa place.
    rm -f "$version"/.env "$version"/.env.*
    mkdir -p "$version/.next/cache"
    installer_service
    basculer_vers "$version"
    # Les versions au-delà des 3 plus récentes partent (jamais celle en ligne).
    ls -1d versions/*/ | sed 's|/$||' | sort -r | tail -n +$((VERSIONS_GARDEES + 1)) | while read -r ancienne; do
      [ "$(readlink courante)" = "$ancienne" ] || rm -rf -- "$ancienne"
    done
    echo "✅ Site en ligne : $(git log -1 --format='%h %s')"
    ;;
  installer)
    charger_node
    installer_service
    echo "✅ Node.js $(node --version) et le service $NOM sont prêts. Lancez maintenant : ./scripts/deployer.sh"
    if command -v loginctl >/dev/null && [ "$(loginctl show-user "$USER" --property=Linger --value 2>/dev/null)" != "yes" ]; then
      echo "ℹ️ Pour que le site redémarre avec le serveur, sans session ouverte : sudo loginctl enable-linger $USER (une fois, par un compte administrateur)."
    fi
    ;;
  retour)
    actuelle="$(readlink courante 2>/dev/null || true)"
    precedente="$(ls -1d versions/*/ 2>/dev/null | sed 's|/$||' | sort -r | awk -v a="$actuelle" 'trouve { print; exit } $0 == a { trouve = 1 }')"
    if [ -z "$precedente" ]; then
      echo "Aucune version précédente sur ce serveur : rien à remettre." >&2
      exit 1
    fi
    basculer_vers "$precedente"
    echo "✅ Version $precedente remise en ligne. La prochaine mise en ligne reprend la dernière version de main."
    ;;
  journal)
    journalctl --user -u "$NOM" -n 200 --no-pager
    ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
