---
type: command
run: 'ls docs/design/maquettes/*/v*/mobile.html >/dev/null 2>&1 && for f in docs/design/maquettes/*/v*/mobile.html docs/design/maquettes/*/v*/desktop.html; do grep -q "Historique" "$f" && grep -q "Réglages" "$f" || exit 1; done'
---
