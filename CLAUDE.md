# Pulse – dépôt du plugin

Ce dépôt contient le plugin Claude Code `pulse-vibe` (méthode Pulse, en français). Ce fichier règle le travail **sur le plugin** ; le `CLAUDE.md` installé dans les projets des utilisateurs est `templates/CLAUDE.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `skills/<commande>/SKILL.md` | Les commandes `/pulse:*` ; `allowed-tools` = commandes autorisées sans demande pendant la commande |
| `agents/` | Les sous-agents `pulse:*` ; `tools` ou `disallowedTools` = outils réellement disponibles |
| `references/` | Règles partagées, chargées par `pulse-aidd contexte` ou `pulse-aidd reference` (`regles-communes.md` s'applique à toutes les commandes) |
| `templates/` | Modèles des fichiers produits dans les projets |
| `hooks/hooks.json`, `scripts/` | Hooks (anti-secrets, mémoire, sessions, guide) et leurs scripts Node |
| `bin/pulse-aidd` | Outil interne placé dans le PATH par Claude Code |
| `tests/` | Tests des scripts : `node --test tests/*.test.js` |

## Règles d'écriture des consignes

- Formuler chaque consigne **positivement** : dire ce qu'il faut faire. Une interdiction reste réservée à la sécurité ou à l'irréversible, avec son alternative.
- Destinataire final : une personne sans expérience en programmation, vouvoyée, phrases courtes.
- Un fait, un seul endroit : une règle partagée va dans `references/regles-communes.md`, et les skills y renvoient.
- Un outil cité dans les consignes d'un agent doit lui être disponible : listé dans `tools`, ou absent de `disallowedTools`.
- `allowed-tools` d'un skill : seulement des motifs précis ; les suppressions, fusions, envois forcés et changements de configuration passent par la demande d'autorisation de Claude Code.
- Fins de ligne LF partout (`.gitattributes`).

## Avant de rendre la main

- `node --test tests/*.test.js` passe.
- Avant chaque `git push` : monter `version` dans `.claude-plugin/plugin.json` (correctif → patch, fonctionnalité ou structure → mineure), sinon `claude plugin update` ne voit pas la mise à jour.
