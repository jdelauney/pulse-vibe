#!/bin/sh
# Hook de démarrage ajouté par lancer.js au cœur assemblé pour les essais, et à lui seul : claude plugin eval ne met pas
# le bin/ des plugins dans le PATH de son bac à sable (pulse-aidd: command not found). CLAUDE_ENV_FILE est relu avant
# chaque commande de la session : y écrire le PATH complété rend pulse-aidd (et pulse-pile-next, relayé depuis bin/) trouvable.
[ -n "${CLAUDE_ENV_FILE:-}" ] && [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] || exit 0
printf 'export PATH="%s/bin:$PATH"\n' "$CLAUDE_PLUGIN_ROOT" >> "$CLAUDE_ENV_FILE"
