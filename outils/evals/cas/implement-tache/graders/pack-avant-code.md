---
type: tool_order
strict: true
before: { tool: Bash, input_match: 'pulse-aidd (pile contexte implement|realisation etape T\d+ realisation)' }
after: { tool: Write, input_match: '"file_path":"([^"]*/)?(src|app)/(?![^"]*(__tests__/|\.test\.))' }
---
