# Pulse – dépôt des plugins

Ce dépôt est le catalogue Claude Code `pulseia` (méthode Pulse, en français). Ce fichier règle le travail **sur les plugins** ; le `CLAUDE.md` installé dans les projets des utilisateurs est `plugins/pulse-vibe/templates/CLAUDE.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `.claude-plugin/marketplace.json` | Le catalogue : un plugin par entrée, au nom identique au `name` de son manifeste (`pulse`, `pulse-next`), `source` = son dossier dans `plugins/` ; `renames` garde la mise à jour des installations faites sous les anciens noms (`pulse-vibe`, `pulse-vibe-next`) |
| `plugins/pulse-vibe/` | Le cœur, plugin `pulse` : la méthode Pulse, agnostique de la technologie (préfixe `/pulse:*`) |
| `plugins/pulse-vibe-next/` | Le pack de pile Next.js, plugin `pulse-next` : outil `bin/pulse-pile-next` (contrat des packs : `info`, dont `couvre:` pour les familles de qualité du cœur que le pack remplace, et `contexte <commande>`), fiche, recettes découpées en étapes, squelette ; dépend de `pulse` |
| `.github/workflows/` | Tests des plugins à chaque envoi (Ubuntu et Windows, Node 22.19 et LTS) ; squelette Next.js vérifié à chaque envoi qui touche le pack ou le cœur qu'il utilise, et chaque semaine sous Windows ; chaînes de recettes vérifiées chaque semaine aux dernières versions ; évaluations du cœur (`evals.yml`) lancées à la demande seulement, car facturées |
| `docs/` | Le wiki, guide des personnes qui utilisent Pulse : pages HTML, CSS et JS sans dépendance, ouvrables en local et publiées telles quelles par GitHub Pages depuis `main` (`docs/.nojekyll`) ; et le mémo des commandes (`docs/superpowers/` : conceptions, revues et plans, gardés en local, hors Git) |
| `outils/wiki/` | Les outils du wiki, hors du site publié : `synchroniser.js` recopie la description et les arguments de chaque commande depuis son SKILL.md dans `docs/` ; `indexer.js` construit l'index de la recherche ; `captures.js` liste les captures attendues, prend celles des pages publiques et les intègre ; `CHARTE.md` = la charte graphique du wiki ; `modele-commande.html` = le modèle d'une page de commande |
| `outils/evals/` | `lancer.js` (relais `lancer.sh` pour Linux, macOS et WSL2, `lancer.cmd` pour Windows) : lance les évaluations du cœur ; `--direct` (`direct.js`, le mode qui marche aujourd'hui, aussi en CI) fait tourner chaque cas avec `claude -p` et note ses vérifications automatiques, les juges IA signalés non notés, car dans `claude plugin eval` chaque commande `!` d'un skill échoue ; sans `--direct`, `claude plugin eval`, avec `evals-chemin.sh` qui met le `bin/` du cœur assemblé dans le PATH ; `cas/` = un dossier par cas (`prompt.md`, `case.yaml`, `graders/`), les projets d'essai partagés dans `_communs/` (`projet.sh`, et `projet-next.sh` sur la pile Next), hors du plugin publié ; `PACK=next` ajoute le pack aux essais ; `resultats/` = les rapports et les transcriptions des essais, gardés en local ; `mesurer.js` compte les tokens de chaque essai, sous-agents compris, et compare deux séries (`--comparer`) ; dans le bac à sable de Claude Code : intégré sous macOS, bubblewrap et socat sous Linux et WSL2 ; sous Windows, relance les essais dans WSL2 ; chaque essai est un vrai appel au modèle, facturé |

Dans un plugin (chemins relatifs à son dossier) :

| Dossier | Contenu |
|---|---|
| `skills/<commande>/` | Une commande = un dossier. `SKILL.md` (nom sensible à la casse) suit la trame Objectif, Règles, Contexte, Rôle (facultatif), Processus, Exemples ; `allowed-tools` = commandes autorisées sans demande pendant la commande. À côté, au besoin, ce qui sert à cette commande seule : `references/` (`pulse-aidd reference <commande>/<fichier>`), `assets/` (modèles : `pulse-aidd modele <commande>/<fichier>`), `scripts/` (lancés par `pulse-aidd`) |
| `agents/` | Les sous-agents, moyens de l'orchestration : une commande les appelle et garde la main ; `tools` ou `disallowedTools` = outils réellement disponibles ; `model` toujours explicite |
| `references/` | Règles partagées par plusieurs commandes, chargées par `pulse-aidd contexte` ou `pulse-aidd reference` (`regles-communes.md` : le noyau commun à toutes les commandes du cœur) |
| `templates/` | Modèles partagés des fichiers produits dans les projets ; le `CLAUDE.md` des projets suit la trame Résumé du projet, Stack technique, Architecture, Commandes, Contraintes |
| `hooks/hooks.json`, `scripts/` | Hooks et scripts Node partagés ; `garde.js` réunit les deux garde-fous dans un seul processus ; `lecture-commande.js` lit les commandes (bash, PowerShell, cmd) et `chemins-sensibles.js` reconnaît les fichiers `.env` pour eux ; `apres-ecriture.js` et `tour.js` relèvent les fichiers écrits pendant le tour, `fin-de-tour.js` les contrôle à la fin du tour (règles, secrets, contrôles rapides), `realisation.js` tient le marqueur de réalisation (rappel après compaction), `notifier.js` envoie la notification du bureau, `captures.js` efface les captures d'une US |
| `bin/` | Outils placés dans le PATH par Claude Code (`pulse-aidd` pour le cœur), chacun avec ses relais `.ps1` (PowerShell : arguments passés par l'environnement, relus par le prologue du script bash) et `.cmd` (cmd), identiques d'un outil à l'autre |
| `tests/` | Tests du plugin |

## Règles d'écriture des consignes

- Formuler chaque consigne **positivement** : dire ce qu'il faut faire. Une interdiction reste réservée à la sécurité ou à l'irréversible, avec son alternative.
- Destinataire final : une personne sans expérience en programmation, vouvoyée, phrases courtes ; questions et descriptions en mots de tous les jours (les termes refusés sont listés dans `tests/coherence.test.js`).
- Un fait, un seul endroit : une règle partagée va dans `plugins/pulse-vibe/references/`, une règle propre à une commande dans `skills/<commande>/references/`, et les skills y renvoient.
- Un outil cité dans les consignes d'un agent doit lui être disponible : listé dans `tools`, ou absent de `disallowedTools`.
- `allowed-tools` d'un skill : seulement des motifs précis (`Bash(pulse-aidd contexte *)`, `Bash(git status *)`). Les envois, suppressions, fusions, envois forcés, changements de configuration et les sous-commandes qui touchent la production (`pulse-aidd secrets generer|envoyer|elaguer|redeployer`) passent par la demande d'autorisation de Claude Code. Le test de couverture de `coherence.test.js` vérifie que chaque `pulse-aidd <sous-commande>` citée est autorisée.
- Fins de ligne LF partout (`.gitattributes`).

## Avant de rendre la main

- `node --test plugins/*/tests/*.test.js` passe (depuis la racine du dépôt). Il comprend :
  - `budget-contexte.test.js` : le contexte chargé par chaque commande reste sous son plafond ; un plafond se relève seulement avec la mesure et la raison ;
  - `documentation.test.js` : README, mémo et ce fichier suivent le code ; une fonction ajoutée s'y documente dans le même commit ;
  - `wiki.test.js` : chaque commande a sa page dans le wiki, synchronisée avec son SKILL.md, dans la charte et sans jargon. Commande ajoutée, renommée ou décrite autrement : `node outils/wiki/synchroniser.js` (`--creer` pour la page d'une nouvelle commande), puis rédiger sa page. Page du wiki modifiée : `node outils/wiki/indexer.js`.
- Avant chaque `git push` : monter `version` dans le `.claude-plugin/plugin.json` de **chaque plugin modifié** (correctif → patch, fonctionnalité ou structure → mineure), sinon `claude plugin update` ne voit pas la mise à jour. Quand la version **mineure** du cœur monte, mettre à jour la dépendance `pulse` déclarée par le pack (`^0.x` exclut la mineure suivante) et monter le pack.
- Après l'envoi, étiqueter chaque version publiée : `pulse--v<version>` et `pulse-next--v<version>` (`claude plugin tag --push` depuis le dossier du plugin). Les dépendances entre plugins se résolvent sur ces étiquettes.
- Squelette de `pulse-vibe-next` modifié : `node plugins/pulse-vibe-next/scripts/verifier-squelette.js --e2e` passe (un test qui passe seulement après une relance le fait échouer ; le dossier temporaire est retiré, sauf `--garder` ou échec). Les dépendances du squelette sont toujours aux dernières versions publiées (`--dernieres --ecrire` les met à jour quand tout passe ; une version majeure arrive par une demande de fusion séparée).
- Recette modifiée : `node plugins/pulse-vibe-next/scripts/verifier-recettes.js --depuis main` passe (les chaînes de `CHAINES` qui contiennent une recette modifiée ; une chaîne précise : `--recettes connexion,liste` ; toutes : `--toutes`, que la CI lance chaque semaine).
- `claude plugin validate` passe sur le catalogue et sur chaque plugin.
- Essayer les plugins ensemble, sans les installer : `claude --plugin-dir ./plugins`.
- Commande du cœur dont le déroulé change (spec, plan, réalisation, démarrage) : `outils/evals/lancer.sh --direct` (Linux, macOS, WSL2) ou `outils\evals\lancer.cmd --direct` (Windows) quand c'est possible ; sinon, le dire en rendant la main.
