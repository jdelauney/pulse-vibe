---
type: command
run: 'awk "/^## .*Questions en suspens/{q=1; next} q && /^## /{exit} q && /^[-0-9]/{print; exit}" aidd_docs/tasks/tenir-liste/SPEC-US-002-*.md | grep -Eiq "dispar|visible|d[ée]coch|barr|retir"'
---

La première question en suspens est la contradiction entre « un article coché disparaît aussitôt » (brief) et « je le touche à nouveau pour le décocher » (US).
