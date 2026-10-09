# Le cycle Pulse en un coup d'œil

```
/pulse:init → /pulse:brainstorm → /pulse:prd → /pulse:tech → (/pulse:ui identite) → /pulse:us
          → /pulse:spec <US-XXX ou demande> → (/pulse:ui maquettes <US-XXX>) → /pulse:plan <US-XXX>
          → /pulse:implement <US-XXX> [tâche] → /pulse:review → (correction) → /pulse:commit
          → (/pulse:cicd) → /pulse:deploy
```

Les étapes entre parenthèses sont facultatives. Pour démarrer vite, `/pulse:express` remplace brainstorm, PRD et US par une seule conversation, puis enchaîne les choix techniques et l'identité visuelle. Pour travailler sur une branche : répondre « Une branche pour l'US et une demande de fusion » à la question d'envoi de `/pulse:implement` ou de `/pulse:spirc` (référence « Le dépôt distant et l'envoi du travail », § 2) ; la branche et la demande de fusion se préparent alors d'elles-mêmes, et `/pulse:pr` permet de le faire à la main.

`/pulse:spirc <US-XXX> [tâche | "demande"]` orchestre Implémentation, Revue et Commit du plan d'une US avec des agents indépendants (et crée la spec et le plan s'ils manquent) ; il accepte aussi une demande libre (« ajouter un filtre… »), ajoutée au plan.
`/pulse:init` (préparer et mettre à niveau), `/pulse:status` (où en suis-je ?), `/pulse:guide` (les prochaines commandes), `/pulse:fix`, `/pulse:annuler` (revenir en arrière sans rien perdre), `/pulse:get-help` (préparer une demande d'aide), `/pulse:refine`, `/pulse:explain`, `/pulse:learn`, `/pulse:pr`, `/pulse:security`, `/pulse:secrets` (les clés du projet, sans jamais afficher leur valeur), `/pulse:seo` (être trouvé sur Google et par les assistants IA), `/pulse:rediger` (les textes des pages, dans la voix du site), `/pulse:perf` (la vitesse vécue par les visiteurs), `/pulse:search-console` (ce que Google voit du site, après la mise en ligne), `/pulse:memory`, `/pulse:auto-fix`, `/pulse:test` et `/pulse:ui` (pour `audit` et `polish`) s'utilisent à tout moment.
