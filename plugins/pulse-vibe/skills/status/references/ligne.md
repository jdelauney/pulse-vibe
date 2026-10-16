# La ligne d'état de Pulse

Utilisé par `/pulse:status ligne` et `/pulse:status ligne retirer`. Un plugin ne peut pas régler lui-même la ligne d'état de Claude Code : Pulse la règle dans les réglages locaux du projet, avec l'accord de la personne.

Une ligne en bas de l'écran de Claude Code, mise à jour toute seule : l'US et la tâche en cours, l'avancement, la décision qui vous attend (« Pulse · US-002 · T5 en cours · 7/12 tâches · ⏸ test manuel de T4 »). Utile pendant une longue réalisation, ou une série (`/pulse:spirc version`).

1. L'expliquer en deux phrases, puis demander (AskUserQuestion) : « L'afficher (Recommandé) » / « Ne rien changer ». Elle se règle dans `.claude/settings.local.json`, propre à cet ordinateur, et ajoute la copie `.claude/pulse-ligne-etat.js` (deux lignes ajoutées au `.gitignore`, s'il les lui manque).
2. Accepté : annoncer « Claude Code va vous demander l'accord : c'est un réglage de Claude Code », puis `pulse-aidd ligne-etat --installer`. Réponse `deja:` : une autre ligne d'état est réglée ; demander « Garder la vôtre (Recommandé) » / « La remplacer par celle de Pulse » (`pulse-aidd ligne-etat --installer --remplacer`). La ligne apparaît après le prochain message.
3. `ligne retirer` : `pulse-aidd ligne-etat --retirer`, après le même accord.
