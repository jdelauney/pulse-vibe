# Variables d'environnement chez l'hébergeur

Utilisé par `/pulse:deploy` : en première mise en ligne avant le premier déploiement (3b.4), et en mode production (point 2). Avec un pack de pile, lancer d'abord `pulse-aidd pile contexte deploy-variables` : le détail propre à l'hébergeur de la pile.

1. `pulse-aidd secrets inventaire` : noms, présence dans `.env` et chez l'hébergeur, type Secret ou Config, sans aucune valeur.
2. Pour chaque variable absente de la production : appliquer « Garder la valeur d'un secret hors de la conversation » (`pulse-aidd reference secrets/sans-conversation.md`) : envoi par le pack de pile, ou saisie par la personne dans les réglages de l'hébergeur, en type Secret pour les secrets. Chaque envoi change la production : Claude Code demande l'accord de la personne à chaque fois.
3. Une variable modifiée sert au déploiement suivant : `pulse-aidd secrets redeployer --env production` (ou le bouton de l'hébergeur).
4. Proposer ensuite `/pulse:secrets` pour tenir `docs/secrets.md` à jour.
