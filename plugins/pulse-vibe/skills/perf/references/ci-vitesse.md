# Vérification automatique de la vitesse

Utilisé par `/pulse:perf suivre` (volet 3) et par `/pulse:cicd`, une fois le budget écrit dans « Budget » de `docs/performance.md`. La syntaxe vient de la documentation officielle du fournisseur de CI de « Hébergement et mise en ligne ».

`pulse-aidd perf installer` copie le script de mesure dans `scripts/perf.js` du projet ; la CI l'appelle avec `node scripts/perf.js`. Deux façons, au choix de la personne :

- **Chaque semaine, sur le site en ligne (Recommandé)** : tâche planifiée et déclenchable à la main ; Node.js LTS ; `node scripts/perf.js mesurer <adresse du site> --pages docs/performance.md --source psi --passages 3 --json mesure.json`, puis `node scripts/perf.js budget mesure.json docs/performance.md` ; `mesure.json` gardé comme fichier joint du passage. La clé va dans les secrets du dépôt sous le nom `PULSE_PSI_CLE`, saisie par la personne. Un budget dépassé fait échouer la tâche : le fournisseur prévient par e-mail ; les fusions restent libres.
- **Sur chaque proposition de version parallèle** : installer, construire, servir la construction en mode production en arrière-plan, attendre qu'elle réponde, puis `node scripts/perf.js mesurer http://localhost:<port> --pages docs/performance.md --source local --passages 3 --json mesure.json` et `budget`. La machine de CI diffère du poste : commencer en mode informatif (l'échec de cette étape laisse la CI verte), puis rendre l'étape bloquante quand les chiffres sont stables. PageSpeed Insights ne sert pas ici : les adresses de prévisualisation sont souvent protégées.
