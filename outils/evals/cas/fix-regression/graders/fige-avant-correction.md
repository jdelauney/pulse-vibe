---
type: tool_order
strict: true
before: { tool: Bash, input_match: "pulse-aidd tests-figes figer" }
after: { tool: Agent, input_match: "fixer" }
---

Le test est figé avant que le fixer corrige le code.
