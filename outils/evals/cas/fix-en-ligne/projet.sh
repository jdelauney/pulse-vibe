#!/usr/bin/env bash
# Projet d'essai « en ligne » : l'adresse du site (127.0.0.1:9) ne répond pas. /pulse:fix en-ligne doit constater
# d'abord (sonde de l'adresse), avant toute correction, et suivre sa référence du mode en ligne.
. "$(dirname "$0")/../_communs/projet.sh"
sed -i 's#^- Site en ligne : .*#- Site en ligne : http://127.0.0.1:9#' CLAUDE.md
git -c user.email=essai@example.com -c user.name=essai commit -qam "docs: adresse du site"
