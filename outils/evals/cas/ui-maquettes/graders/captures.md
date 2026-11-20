---
type: command
run: 'n=0; for d in docs/design/maquettes/*/v*/; do [ -f "$d/captures/mobile-390-1.png" ] && n=$((n+1)); done; [ "$n" -ge 2 ]'
---
