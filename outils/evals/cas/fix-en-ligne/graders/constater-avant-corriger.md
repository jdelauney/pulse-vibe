---
type: tool_order
strict: true
before: { tool: Bash, input_match: "pulse-aidd sonder" }
after: { tool: Edit, input_match: '"file_path":"([^"]*/)?(src|index\.html)' }
---

Le site est sondé avant toute modification du code.
