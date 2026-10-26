# Le plan d'optimisation et le bilan avant / après

Utilisé par `/pulse:optimize-skill`. Les deux parties s'ajoutent, dans cet ordre, à la fin du rapport d'audit de la skill (`docs/audits-skills/<nom>-<AAAA-MM-JJ>.md`).

## Écrire le plan

- Un point par changement, numéroté, les bloquants d'abord, puis les points à corriger, puis les conseils. Chaque point vient d'un constat du rapport et cite sa règle `K<n>`.
- Un point touche un fichier et une règle : la personne peut choisir point par point.
- **Gain attendu** : mesuré avec les tailles de `pulse-aidd skill mesurer` (caractères, et jetons estimés = caractères ÷ 3,5), au lancement ou à la lecture qui change ; un gain qui ne se mesure pas (un risque évité) se dit en une phrase.
- **Risque pour la qualité** : ce qui pourrait se perdre, et ce qui le garde. Chaque point garde chaque question clé, validation, point d'arrêt, refus et garde-fou (K12) ; un texte déplacé dans `references/` se charge à l'étape qui le sert, avec sa condition (K6). Une description changée d'une skill que Claude peut lancer change ce qui la déclenche : le dire.
- **Gardé tel quel** : ce qui reste, et pourquoi (une question clé, une validation, un garde-fou, un texte qui sert à chaque lancement, une correction jugée trop risquée).

```markdown
## Plan d'optimisation

Mesure avant : SKILL.md <car> car · <jetons> jetons estimés ; chargé au lancement <car> car ; fin du Processus <jetons> jetons estimés ; contrôle : <b> bloquants · <c> à corriger · <d> conseils.

| N° | Règle | Changement | Gain attendu | Risque pour la qualité |
|---|---|---|---|---|
| 1 | K<n> | <fichier : ce qui change> | <−<car> car au lancement, ou à l'étape <n>> | <ce qui pourrait se perdre, et ce qui le garde> |

### Gardé tel quel

- <ce qui reste, et pourquoi>
```

## Écrire le bilan

- Les mesures « avant » viennent de l'étape 1, les mesures « après » de l'étape 6 ; l'écart en caractères et en pourcentage.
- La relecture : le verdict de `pulse:skill-auditor`, après la seconde relecture s'il y en a eu une ; chaque perte rendue, ou restante avec le choix de la personne (sauvegarde remise, ou skill gardée ainsi).
- La sauvegarde : son chemin.

```markdown
## Bilan avant / après

Points appliqués : <n°> ; laissés : <n°, et pourquoi>.

| Mesure | Avant | Après | Écart |
|---|---|---|---|
| SKILL.md | <car> car · <jetons> jetons estimés | | |
| Chargé au lancement (SKILL.md et injections) | <car> car | | |
| Fin du Processus | <jetons> jetons estimés | | |
| Plus grande lecture | <fichier> <car> car | | |
| Description chargée en permanence | <car> car, ou « aucune » | | |
| Contrôle par script | <b> bloquants · <c> à corriger · <d> conseils | | |

Relecture avant / après : <aucune perte | pertes (<n>) : rendues, ou restantes (sauvegarde remise | gardée ainsi)>.

Sauvegarde : `<docs/audits-skills/sauvegardes/<nom>-<AAAA-MM-JJ>/ | ~/.claude/skills-sauvegardes/<nom>-<AAAA-MM-JJ>/>`.
```
