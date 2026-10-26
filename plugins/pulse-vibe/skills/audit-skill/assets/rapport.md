# Audit des skills : <nom>

- **Chemin audité** : `<chemin>`
- **Date** : <AAAA-MM-JJ>
- **Plugin Pulse** : <oui | non> (oui : les conventions comptent « à corriger »)
- **Bilan du contrôle par script** : <b> bloquants · <c> à corriger · <d> conseils

## Empreinte

Sert à savoir si les fichiers ont changé depuis l'audit (un rapport du jour se réutilise seulement si l'empreinte est la même).

| Fichier | Empreinte |
|---|---|
| `<skill>/SKILL.md` | <sortie de git hash-object, ou taille en caractères si Git manque> |

## Mesures

Tailles données par `pulse-aidd skill mesurer` (jetons estimés = caractères ÷ 3,5).

| Skill ou agent | Chargé au lancement | Fin du Processus | Plus grande lecture | Description |
|---|---|---|---|---|
| <nom> | <car> car · <jetons> jetons estimés | <jetons> jetons estimés | <fichier ou injection> <car> car | <car> car |

Descriptions chargées en permanence : <car> car. Recoupements : <a> et <b>, <n> lignes identiques (ou « aucun »).

## Usage observé

<Période lue : du <AAAA-MM-JJ> au <AAAA-MM-JJ>, <n> fichiers d'historique. Puis une ligne par skill : lancée <n> fois par vous, <n> fois par Claude, dernière fois le <date> ; ou « non observée sur la période ».>
<Ou : non lu (historique des sessions non consulté).>

## Verdict par règle

Une table par skill ou agent quand il y en a plusieurs.

| Règle | Verdict | Note |
|---|---|---|
| K1 Une skill, un travail | conforme / à revoir / non jugée | <une phrase> |
| K2 La description | | |
| K3 Qui lance la skill | | |
| K4 Des autorisations précises | | |
| K5 Trame et compaction | | |
| K6 Charger à l'étape qui sert | | |
| K7 Sous la limite de lecture | | |
| K8 Un fait, un seul endroit | | |
| K9 Des consignes positives | | |
| K10 Le travail déterministe dans un script | | |
| K11 Les agents | | |
| K12 Les validations gardées | | |
| K13 Parler au destinataire | | |
| K14 Mesurer avant et après | | |

## Constats

Chaque constat : `K<n> · fichier:ligne · ce qui ne va pas · correction proposée · gain estimé`.

### Bloquants

À corriger avant d'utiliser la skill.

- <constat, ou « aucun »>

### À corriger

- <constat, ou « aucun »>

### Conseils

- <constat, ou « aucun »>

## Gain estimé

<Ce que les corrections retireraient du contexte chargé (caractères et jetons estimés, au lancement et par lecture), et les risques évités. Une correction garde chaque question, validation et garde-fou de la skill.>
