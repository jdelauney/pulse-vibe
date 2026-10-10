# Le cycle Pulse en un coup d'œil

```
/pulse:init → /pulse:brainstorm → /pulse:prd → /pulse:tech → (/pulse:ui identite) → /pulse:us
   (ou, pour démarrer vite : /pulse:init → /pulse:express, qui fait tout cela en une conversation)
   → pour chaque US : /pulse:spec <US-XXX ou demande> → (/pulse:ui maquettes <US-XXX>) → /pulse:plan <US-XXX>
   → pour chaque tâche : /pulse:implement <US-XXX> [tâche] → /pulse:review → (correction) → /pulse:commit
     (ou tout d'un coup : /pulse:spirc <US-XXX>)
   → (/pulse:cicd) → /pulse:deploy
```

Les étapes entre parenthèses sont facultatives. Pour démarrer vite, `/pulse:express` remplace brainstorm, PRD et US par une seule conversation, puis enchaîne les choix techniques et l'identité visuelle. Pour travailler sur une version parallèle : répondre « Une version parallèle pour l'US, publiée quand vous l'acceptez sur le site du dépôt » à la question d'envoi de `/pulse:implement` ou de `/pulse:spirc` (référence « Le dépôt distant et l'envoi du travail », § 2) ; la version parallèle et sa proposition se préparent alors d'elles-mêmes, et `/pulse:pr` permet de le faire à la main.

`/pulse:spirc <US-XXX> [tâche | "demande"]` orchestre Implémentation, Revue et Commit du plan d'une US avec des agents indépendants (et crée la spec et le plan s'ils manquent) ; il accepte aussi une demande libre (« ajouter un filtre… »), ajoutée au plan.
`/pulse:init` (préparer et mettre à niveau), `/pulse:status` (où en suis-je ?), `/pulse:guide` (les prochaines commandes), `/pulse:fix`, `/pulse:annuler` (revenir en arrière sans rien perdre), `/pulse:get-help` (préparer une demande d'aide), `/pulse:refine`, `/pulse:explain`, `/pulse:learn`, `/pulse:pr`, `/pulse:security`, `/pulse:secrets` (les clés du projet, sans jamais afficher leur valeur), `/pulse:seo` (être trouvé sur Google et par les assistants IA), `/pulse:rediger` (les textes des pages, dans la voix du site), `/pulse:perf` (la vitesse vécue par les visiteurs), `/pulse:search-console` (ce que Google voit du site, après la mise en ligne), `/pulse:memory`, `/pulse:auto-fix`, `/pulse:test` et `/pulse:ui` (pour `audit` et `polish`) s'utilisent à tout moment.
