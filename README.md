# Pulse-vibe – les plugins PulseIA pour Claude Code

Ce dépôt est le catalogue **`pulseia`** : il contient les plugins de la méthode Pulse, pour construire et mettre en ligne un outil avec l'IA, étape par étape, en français, sans expérience en programmation.

| Plugin | Ce qu'il apporte | Documentation |
|---|---|---|
| `pulse` | La méthode Pulse : du brief à la mise en ligne, avec garde-fous de sécurité, agents indépendants et mémoire projet. Aucune technologie imposée | [plugins/pulse-vibe/README.md](plugins/pulse-vibe/README.md) |
| `pulse-next` | Le pack de pile Next.js (Drizzle + Neon, better-auth, shadcn/ui, Vercel) : code de départ vérifié, conventions, pièges connus et recettes prêtes. Installe aussi `pulse` | [plugins/pulse-vibe-next/README.md](plugins/pulse-vibe-next/README.md) |

**Les noms** : le dépôt GitHub s'appelle `jdelauney/pulse-vibe` et le catalogue `pulseia`. Chaque plugin porte le même nom dans le catalogue et dans son manifeste : `pulse` (dossier `plugins/pulse-vibe/`, commandes `/pulse:*`) et `pulse-next` (dossier `plugins/pulse-vibe-next/`). Les anciens noms `pulse-vibe` et `pulse-vibe-next` sont redirigés automatiquement vers ces noms.

## Installation

Prérequis : Claude Code (abonnement Pro, Max, Team, Enterprise ou compte Console), Git, Node.js 22.19 ou plus (version LTS conseillée). Sous Windows, **Git for Windows** est indispensable (les plugins utilisent Git Bash).

Dans une session Claude Code :

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse@pulseia
```

Pour la pile Next.js prête à l'emploi : `/plugin install pulse-next@pulseia` (installe aussi `pulse`).

Mise à jour : `claude plugin marketplace update pulseia` puis `claude plugin update pulse@pulseia` (et `pulse-next@pulseia`), et redémarrer Claude Code.

## Structure du dépôt

```
.claude-plugin/marketplace.json   le catalogue « pulseia » : la liste des plugins
plugins/<plugin>/                 un dossier par plugin
docs/                             mémo des commandes
.github/workflows/                tests des plugins ; vérification hebdomadaire du squelette Next.js
```

## Licence

Licence MIT (voir [LICENCE.md](./LICENCE.md)).
