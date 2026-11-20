---
type: command
run: 'for f in docs/design/maquettes/*/v*/mobile.html; do grep -q "data-etat=" "$f" || exit 1; done'
---
