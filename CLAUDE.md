# Pulse – dépôt des plugins

Ce dépôt est le catalogue Claude Code `pulseia` (méthode Pulse, en français). Ce fichier règle le travail **sur les plugins** ; le `CLAUDE.md` installé dans les projets des utilisateurs est `plugins/pulse-vibe/templates/CLAUDE.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `.claude-plugin/marketplace.json` | Le catalogue : un plugin par entrée, `source` = son dossier dans `plugins/` |
| `plugins/pulse-vibe/` | Le cœur : la méthode Pulse, agnostique de la technologie (préfixe `/pulse:*`) |
| `plugins/pulse-vibe-next/` | Le pack de pile Next.js : outil `bin/pulse-pile-next` (contrat des packs : `info`, `contexte <commande>`), fiche, recettes, squelette ; dépend de `pulse-vibe` |
| `.github/workflows/` | Tests des plugins à chaque envoi ; squelette Next.js vérifié chaque semaine aux dernières versions |
| `docs/` | Mémo des commandes (`docs/superpowers/` : conceptions et notes de travail, gardées en local, hors Git) |

Dans un plugin (chemins relatifs à son dossier) :

| Dossier | Contenu |
|---|---|
| `skills/<commande>/SKILL.md` | Les commandes ; `allowed-tools` = commandes autorisées sans demande pendant la commande |
| `agents/` | Les sous-agents ; `tools` ou `disallowedTools` = outils réellement disponibles |
| `references/` | Règles partagées, chargées par `pulse-aidd contexte` ou `pulse-aidd reference` (`regles-communes.md` s'applique à toutes les commandes du cœur) |
| `templates/` | Modèles des fichiers produits dans les projets |
| `hooks/hooks.json`, `scripts/` | Hooks et leurs scripts Node |
| `bin/` | Outils placés dans le PATH par Claude Code (`pulse-aidd` pour le cœur) |
| `tests/` | Tests du plugin |

## Règles d'écriture des consignes

- Formuler chaque consigne **positivement** : dire ce qu'il faut faire. Une interdiction reste réservée à la sécurité ou à l'irréversible, avec son alternative.
- Destinataire final : une personne sans expérience en programmation, vouvoyée, phrases courtes.
- Un fait, un seul endroit : une règle partagée va dans `plugins/pulse-vibe/references/regles-communes.md`, et les skills y renvoient.
- Un outil cité dans les consignes d'un agent doit lui être disponible : listé dans `tools`, ou absent de `disallowedTools`.
- `allowed-tools` d'un skill : seulement des motifs précis ; les suppressions, fusions, envois forcés et changements de configuration passent par la demande d'autorisation de Claude Code.
- Fins de ligne LF partout (`.gitattributes`).

## Avant de rendre la main

- `node --test plugins/*/tests/*.test.js` passe (depuis la racine du dépôt).
- Avant chaque `git push` : monter `version` dans le `.claude-plugin/plugin.json` de **chaque plugin modifié** (correctif → patch, fonctionnalité ou structure → mineure), sinon `claude plugin update` ne voit pas la mise à jour. Après l'envoi, étiqueter chaque version publiée `<plugin>--v<version>` (`claude plugin tag --push` depuis le dossier du plugin) : les dépendances entre plugins se résolvent sur ces étiquettes.
- Squelette de `pulse-vibe-next` modifié : `node plugins/pulse-vibe-next/scripts/verifier-squelette.js --e2e` passe. Les dépendances du squelette sont toujours aux dernières versions publiées (`--dernieres --ecrire` les met à jour quand tout passe).
- Essayer les plugins ensemble, sans les installer : `claude --plugin-dir ./plugins`.
