# Critiquer la maquette retenue

**Celui qui a fait la maquette la juge mal : la note vient de juges qui n'ont vu que les captures.** Sert à `/pulse:ui maquettes`, étape « Critiquer ». Le contrôle des règles reste à `pulse:ui-critic` ; l'évaluation d'ensemble (5 dimensions sur 10, `ui/heuristiques.md`) vient de deux agents `pulse:ui-juge`.

## 1. Capturer

Lancer `pulse-aidd maquettes capturer docs/design/maquettes/<spec>/retenue`, seule (sans `cd`, `;` ni `&&` : ainsi elle passe hors du bac à sable de Claude Code, où le navigateur est refusé). Garder sa sortie : la liste des captures et les constats du rendu.

Code 3 (aucun navigateur, ou lancement impossible) : sauter les juges ; ui-critic fait aussi l'évaluation d'ensemble, et le rapport le dit sous son titre « Évaluation d'ensemble » : « Notée sans juge : aucune capture possible sur ce poste. »

## 2. Lancer ui-critic et les juges, en parallèle

Dans le même message :
- **`pulse:ui-critic` en mode maquette** : la cible `retenue/`, le chemin de `docs/design.md` (ou la direction provisoire), la spec de l'US, les constats du rendu de l'étape 1, et la consigne « Évaluation d'ensemble : faite par les juges ». S'il n'est pas disponible : `pulse-aidd agent ui-critic`, consignes appliquées soi-même, en lecture seule.
- **Deux `pulse:ui-juge`**, chacun avec ce message seulement : le dossier `retenue/captures/` et le registre de l'écran (outil ou vitrine). Laisser hors du message la thèse, la spec, `docs/design.md`, l'auteur de la maquette, le temps passé et votre avis : un juge note ce qu'il voit, pour la première fois.

Sans sous-agents, les juges ne peuvent pas être neufs : ui-critic fait l'évaluation d'ensemble, et le rapport porte « Notée sans juge ».

## 3. Calculer la note

- Chaque dimension : la moyenne des deux juges, arrondie à l'entier inférieur.
- Deux notes d'une même dimension écartées de plus de 2 points : lancer un troisième juge (même message), puis prendre la médiane des trois.
- Le total sur 50 est la somme des cinq notes. Une note que l'auteur de la maquette se donne n'entre pas dans le calcul.

## 4. Écrire le rapport

Dans `retenue/critique.md` (ou `critique-<k>.md`), d'après la réponse d'ui-critic, à partir de sa deuxième ligne :
- **Évaluation d'ensemble** : les notes calculées ; pour « Pourquoi », la phrase du juge dont la note est la plus proche ; sous le titre, « Notée par deux juges qui n'ont vu que les captures » (trois, le cas échéant).
- **Verdict** : la note sur 50 calculée, avec les nombres de constats d'ui-critic.
- **Constats** : ajouter les écarts des juges, rubrique `Hiérarchie` ou `Usage` selon ce qu'ils décrivent, la capture en colonne « Fichier » (`captures/<fichier>.png`). Un écart déjà relevé par ui-critic ne s'ajoute pas une seconde fois.
- **Fait par une IA** : si un juge répond « oui », ajouter un constat 🟠, rubrique `Anti-pattern`, avec les signes qu'il cite.
- **Compositions** : une section qu'un juge relève comme « gabarit » devient un constat 🟠, rubrique `Hiérarchie`, avec la composition du catalogue (`composition.md`) qui lui conviendrait.
