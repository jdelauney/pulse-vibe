# Pulse-vibe – les plugins PulseIA pour Claude Code

Ce dépôt est le catalogue **`pulseia`** : il contient les plugins de la méthode Pulse, pour construire et mettre en ligne un outil avec l'IA, étape par étape, en français, sans expérience en programmation.

| Plugin | Ce qu'il apporte | Documentation |
|---|---|---|
| `pulse-vibe` | La méthode Pulse : du brief à la mise en ligne, avec garde-fous de sécurité, agents indépendants et mémoire projet. Aucune technologie imposée | [plugins/pulse-vibe/README.md](plugins/pulse-vibe/README.md) |

## Installation

Prérequis : Claude Code (abonnement Pro, Max, Team, Enterprise ou compte Console), Git, Node.js LTS. Sous Windows, **Git for Windows** est indispensable (les plugins utilisent Git Bash).

Dans une session Claude Code :

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse-vibe@pulseia
```

Mise à jour : `claude plugin marketplace update pulseia` puis `claude plugin update pulse-vibe@pulseia`, et redémarrer Claude Code.

## Structure du dépôt

```
.claude-plugin/marketplace.json   le catalogue « pulseia » : la liste des plugins
plugins/<plugin>/                 un dossier par plugin
docs/                             mémo des commandes, conceptions et plans de travail
```

## Licence

Licence MIT (voir [LICENCE.md](./LICENCE.md)).
