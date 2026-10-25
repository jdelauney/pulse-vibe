---
type: regex
pattern: 'S3\b[\s\S]{0,600}(route|\[id\]|renomm)|(route\.ts|\[id\]|renomm)[\s\S]{0,600}S3\b'
flags: i
---

Le constat S3 cite la route de renommage (`app/api/listes/[id]/route.ts`) : la liste est modifiée sans vérifier qu'elle appartient à la personne connectée.
