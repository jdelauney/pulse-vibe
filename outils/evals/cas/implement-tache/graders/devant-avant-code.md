---
type: tool_order
strict: true
before: { tool: Bash, input_match: 'pulse-aidd realisation debut[^"]*--devant' }
after: { tool: Write, input_match: '"file_path":"([^"]*/)?(src|app)/(?![^"]*(__tests__/|\.test\.))' }
---

Le marqueur de réalisation est posé avec `--devant` avant le premier fichier de code écrit : c'est lui qui fait donner la fiche du pack par `realisation etape`.
