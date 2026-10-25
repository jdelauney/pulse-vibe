---
type: regex
pattern: 'S13[\s\S]{0,600}(cookie|httpOnly)|(cookie|httpOnly)[\s\S]{0,600}S13'
flags: i
---

Le constat S13 cite le cookie de session posé sans `httpOnly` (`ouvrir-session.action.ts`).
