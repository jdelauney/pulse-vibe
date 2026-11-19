---
type: command
run: 'node -e "const { ajouter } = require(\"./src/liste.js\"); let r; try { r = ajouter([], \"  \"); } catch (e) { process.exit(0); } const l = Array.isArray(r) ? r : (r && (r.liste || r.articles)) || []; process.exit(l.length === 0 ? 0 : 1)"'
---

Un nom vide (ou fait d'espaces) n'ajoute plus rien à la liste.
