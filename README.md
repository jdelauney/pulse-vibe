# Pulse-vibe – les plugins PulseIA pour Claude Code

Ce dépôt est le catalogue **`pulseia`** : il contient les plugins de la méthode Pulse, pour construire et mettre en ligne un outil avec l'IA, étape par étape, en français, sans expérience en programmation.

| Plugin | Ce qu'il apporte | Documentation |
|---|---|---|
| `pulse` | La méthode Pulse : du brief à la mise en ligne, avec garde-fous de sécurité, agents indépendants et mémoire projet. Aucune technologie imposée | [plugins/pulse-vibe/README.md](plugins/pulse-vibe/README.md) |
| `pulse-next` | Le pack de pile Next.js (Drizzle + Neon, better-auth, shadcn/ui, Vercel) : code de départ vérifié, conventions, pièges connus et recettes prêtes. Installe aussi `pulse` | [plugins/pulse-vibe-next/README.md](plugins/pulse-vibe-next/README.md) |

**Les noms** : le dépôt GitHub s'appelle `jdelauney/pulse-vibe` et le catalogue `pulseia`. Chaque plugin porte le même nom dans le catalogue et dans son manifeste : `pulse` (dossier `plugins/pulse-vibe/`, commandes `/pulse:*`) et `pulse-next` (dossier `plugins/pulse-vibe-next/`). Les anciens noms `pulse-vibe` et `pulse-vibe-next` sont redirigés automatiquement vers ces noms.

**Le guide complet** (présentation, prérequis, chaque commande expliquée, exemples) : le wiki, en ligne sur [jdelauney.github.io/pulse-vibe](https://jdelauney.github.io/pulse-vibe/), ou à ouvrir directement depuis le dépôt (`docs/index.html`).

Gardez Pulse à jour : voir [Mettre à jour](#mettre-à-jour).

## Installation

Prérequis : Claude Code (abonnement Pro, Max, Team, Enterprise ou compte Console), Git, Node.js 22.19 ou plus (version LTS conseillée). Sous Windows, **Git for Windows** est indispensable (les plugins utilisent Git Bash).

Dans une session Claude Code :

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse@pulseia
```

Pour la pile Next.js prête à l'emploi : `/plugin install pulse-next@pulseia` (installe aussi `pulse`).

## Mettre à jour

Les corrections de Pulse arrivent chez vous seulement après une mise à jour. Faites-la au début de chaque semaine de travail, et dès qu'un message de Pulse semble dépassé.

Dans un terminal :

```bash
claude plugin marketplace update pulseia
claude plugin update pulse@pulseia
claude plugin update pulse-next@pulseia   # seulement avec la pile Next.js
```

Puis fermez et relancez Claude Code : la nouvelle version se charge au démarrage.

Pour ne plus y penser : dans Claude Code, tapez `/plugin`, ouvrez **Marketplaces**, choisissez `pulseia`, puis **Enable auto-update**.

Installé avec les anciens noms (`pulse-vibe@pulseia`, `pulse-vibe-next@pulseia`) : la mise à jour passe aux nouveaux noms toute seule. Si Claude Code signale ensuite « not cached », tapez une fois `/plugin install pulse@pulseia` (et `/plugin install pulse-next@pulseia` si vous aviez la pile Next.js), puis relancez Claude Code.

## Structure du dépôt

```
.claude-plugin/marketplace.json   le catalogue « pulseia » : la liste des plugins
plugins/<plugin>/                 un dossier par plugin
docs/                             le wiki, guide des personnes qui utilisent Pulse (HTML, CSS, JS), publié par GitHub Pages ; et le mémo des commandes
outils/wiki/                      les outils du wiki (synchronisation avec les commandes, charte graphique)
.github/workflows/                tests des plugins (Ubuntu et Windows, Node 22.19 et LTS) ; squelette Next.js vérifié à chaque envoi qui touche le pack ou le cœur, et chaque semaine sous Windows ; chaînes de recettes vérifiées chaque semaine
```

## Licence

Licence MIT (voir [LICENCE.md](./LICENCE.md)).
