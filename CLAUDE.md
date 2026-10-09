# Pulse – dépôt des plugins

Ce dépôt est le catalogue Claude Code `pulseia` (méthode Pulse, en français). Ce fichier règle le travail **sur les plugins** ; le `CLAUDE.md` installé dans les projets des utilisateurs est `plugins/pulse-vibe/templates/CLAUDE.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `.claude-plugin/marketplace.json` | Le catalogue : un plugin par entrée, au nom identique au `name` de son manifeste (`pulse`, `pulse-next`), `source` = son dossier dans `plugins/` ; `renames` garde la mise à jour des installations faites sous les anciens noms (`pulse-vibe`, `pulse-vibe-next`) |
| `plugins/pulse-vibe/` | Le cœur, plugin `pulse` : la méthode Pulse, agnostique de la technologie (préfixe `/pulse:*`) |
| `plugins/pulse-vibe-next/` | Le pack de pile Next.js, plugin `pulse-next` : outil `bin/pulse-pile-next` (contrat des packs : `info`, `contexte <commande>`), fiche, recettes découpées en étapes, squelette ; dépend de `pulse` |
| `.github/workflows/` | Tests des plugins à chaque envoi (Ubuntu et Windows) ; squelette Next.js et chaînes de recettes vérifiés chaque semaine aux dernières versions |
| `docs/` | Mémo des commandes (`docs/superpowers/` : conceptions, revues et plans, gardés en local, hors Git) |

Dans un plugin (chemins relatifs à son dossier) :

| Dossier | Contenu |
|---|---|
| `skills/<commande>/SKILL.md` | Les commandes ; `allowed-tools` = commandes autorisées sans demande pendant la commande |
| `agents/` | Les sous-agents ; `tools` ou `disallowedTools` = outils réellement disponibles ; `model` toujours explicite |
| `references/` | Règles partagées, chargées par `pulse-aidd contexte` ou `pulse-aidd reference` (`regles-communes.md` : le noyau commun à toutes les commandes du cœur) |
| `templates/` | Modèles des fichiers produits dans les projets |
| `hooks/hooks.json`, `scripts/` | Hooks et leurs scripts Node ; `garde.js` réunit les deux garde-fous dans un seul processus ; `lecture-commande.js` lit les commandes (bash, PowerShell, cmd) et `chemins-sensibles.js` reconnaît les fichiers `.env` pour eux |
| `bin/` | Outils placés dans le PATH par Claude Code (`pulse-aidd` pour le cœur), chacun avec ses relais `.ps1` (PowerShell : arguments passés par l'environnement, relus par le prologue du script bash) et `.cmd` (cmd), identiques d'un outil à l'autre |
| `tests/` | Tests du plugin |

## Règles d'écriture des consignes

- Formuler chaque consigne **positivement** : dire ce qu'il faut faire. Une interdiction reste réservée à la sécurité ou à l'irréversible, avec son alternative.
- Destinataire final : une personne sans expérience en programmation, vouvoyée, phrases courtes ; questions et descriptions en mots de tous les jours (les termes refusés sont listés dans `tests/coherence.test.js`).
- Un fait, un seul endroit : une règle partagée va dans `plugins/pulse-vibe/references/`, et les skills y renvoient.
- Un outil cité dans les consignes d'un agent doit lui être disponible : listé dans `tools`, ou absent de `disallowedTools`.
- `allowed-tools` d'un skill : seulement des motifs précis (`Bash(pulse-aidd contexte *)`, `Bash(git status *)`). Les envois, suppressions, fusions, envois forcés, changements de configuration et les sous-commandes qui touchent la production (`pulse-aidd secrets generer|envoyer|elaguer|redeployer`) passent par la demande d'autorisation de Claude Code. Le test de couverture de `coherence.test.js` vérifie que chaque `pulse-aidd <sous-commande>` citée est autorisée.
- Fins de ligne LF partout (`.gitattributes`).

## Avant de rendre la main

- `node --test plugins/*/tests/*.test.js` passe (depuis la racine du dépôt). Il comprend :
  - `budget-contexte.test.js` : le contexte chargé par chaque commande reste sous son plafond ; un plafond se relève seulement avec la mesure et la raison ;
  - `documentation.test.js` : README, mémo et ce fichier suivent le code ; une fonction ajoutée s'y documente dans le même commit.
- Avant chaque `git push` : monter `version` dans le `.claude-plugin/plugin.json` de **chaque plugin modifié** (correctif → patch, fonctionnalité ou structure → mineure), sinon `claude plugin update` ne voit pas la mise à jour. Quand la version **mineure** du cœur monte, mettre à jour la dépendance `pulse` déclarée par le pack (`^0.x` exclut la mineure suivante) et monter le pack.
- Après l'envoi, étiqueter chaque version publiée : `pulse--v<version>` et `pulse-next--v<version>` (`claude plugin tag --push` depuis le dossier du plugin). Les dépendances entre plugins se résolvent sur ces étiquettes.
- Squelette de `pulse-vibe-next` modifié : `node plugins/pulse-vibe-next/scripts/verifier-squelette.js --e2e` passe (un test qui passe seulement après une relance le fait échouer ; le dossier temporaire est retiré, sauf `--garder` ou échec). Les dépendances du squelette sont toujours aux dernières versions publiées (`--dernieres --ecrire` les met à jour quand tout passe ; une version majeure arrive par une demande de fusion séparée).
- Recette modifiée : `node plugins/pulse-vibe-next/scripts/verifier-recettes.js --recettes <chaîne>` passe (par exemple `connexion,liste`).
- `claude plugin validate` passe sur le catalogue et sur chaque plugin.
- Essayer les plugins ensemble, sans les installer : `claude --plugin-dir ./plugins`.
