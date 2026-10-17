# Les règles contrôlées du projet

Utilisé quand une convention du projet s'ajoute à la mémoire (`/pulse:memory`, l'étape « Mémoire » de `/pulse:spirc`). Une règle sans contrôle est une consigne ; avec son contrôle, elle est vérifiée à chaque enregistrement.

Une convention qu'une simple recherche dans le code peut vérifier porte son **contrôle**, à la fin de sa ligne dans « Conventions propres au projet » de `technical.md` :

```
- Les montants s'écrivent en centimes. — Contrôle : interdit `parseFloat(` dans `src/prix/`
- Chaque page déclare son titre. — Contrôle : obligatoire `/export const metadata\b/` dans `app/**/page.tsx`
```

- **interdit** : aucun fichier de la portée ne contient le motif ; **obligatoire** : chaque fichier de la portée le contient.
- Le motif est un texte cherché tel quel, ou une expression entre `/…/`. La portée est un dossier (`src/prix/`), un fichier, ou un modèle de chemin (`*.ts`, `app/**/page.tsx`) ; plusieurs portées se séparent par des virgules.
- **sauf** : une portée qui échappe à la règle se déclare après la portée contrôlée, avec les mêmes formes et les mêmes virgules :

```
- Couleurs en variables. — Contrôle : interdit `/#[0-9a-fA-F]{3,8}\b/` dans `*.css` sauf `app/globals.css`
```

- `pulse-aidd verifier`, le contrôle avant chaque commit et la vérification automatique en ligne refusent alors un fichier qui enfreint la règle, en la citant.
- Proposer un contrôle quand la règle s'y prête, avec la ligne exacte, et seulement si le motif ne peut pas viser du code légitime ; sinon, la règle reste une consigne.
- Une règle porte une seule clause `sauf` ; ses portées s'écrivent entre accents graves (`` ` ``), comme celles de `dans`.
