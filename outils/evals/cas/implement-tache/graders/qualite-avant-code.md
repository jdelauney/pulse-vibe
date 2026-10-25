---
type: tool_order
strict: true
before: { tool: Bash, input_match: 'pulse-aidd qualite clean-code' }
after: { tool: Write, input_match: '"file_path":"([^"]*/)?(src|app)/' }
---
