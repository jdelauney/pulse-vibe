# Pulse Skills – créer et améliorer vos skills Claude Code

**Pulse-skills** (plugin `pulse-skills`) sert aux personnes qui écrivent leurs propres skills Claude Code. Il est séparé de la méthode ([plugin `pulse`](../pulse-vibe/README.md)) : construire un projet avec Pulse n'en a pas besoin, et la liste des commandes `/pulse:*` reste plus courte.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `/pulse-skills:skill-creator ["…"]` | Créer une skill Claude Code avec vous selon les règles K1 à K14 : questions une à une, plan validé, skill ordinaire écrite au modèle, contrôlée, prête à essayer |
| `/pulse-skills:audit-skill [chemin]` | Auditer une skill, un dossier de skills, un plugin, ou par défaut les skills et agents du projet (`.claude/`) : rapport des corrections et de leur gain, sans rien modifier |
| `/pulse-skills:optimize-skill <chemin>` | Optimiser une skill sans perte de qualité : audit, plan point par point à valider, application, relecture avant / après |

L'agent `pulse-skills:skill-auditor` juge les skills selon les règles K1 à K14 (doublons, utilité, chargement, validations), ou compare une skill avant et après son optimisation, en lecture seule.

## Installation

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse-skills@pulseia
```

L'installation ajoute aussi `pulse` (dépendance), dont vient l'outil de mesure (`pulse-aidd skill mesurer|verifier|empreinte|usage`). Redémarrer Claude Code ensuite.

Ces commandes faisaient partie du plugin `pulse` avant sa version 0.56, sous son préfixe.

## Contenu

```
.claude-plugin/plugin.json   manifeste ; dépend de pulse
bin/pulse-skills             contexte | reference | modele | agent
bin/pulse-skills.ps1         relais pour PowerShell (arguments transmis tels quels) ; bin/pulse-skills.cmd : relais pour l'invite de commandes (cmd)
skills/                      skill-creator, audit-skill, optimize-skill
agents/                      skill-auditor
references/                  regles-skills.md (les règles K1 à K14)
tests/                       tests du plugin
```
