# Les contrôles proposés par Pulse

Utilisé quand une commande propose un contrôle prêt à poser (`/pulse:ui identite`, `/pulse:review`). La syntaxe d'une règle contrôlée est dans `regles-controlees.md`.

Pulse propose lui-même quelques contrôles, au moment où la règle devient utile. Chaque proposition se pose avec AskUserQuestion : « Oui (Recommandé) » / « Non ».

- **Oui** : ajouter la ligne du contrôle dans « Conventions propres au projet » de `aidd_docs/memory/technical.md`.
- **Non** : ajouter dans la même section `- Contrôle écarté : <identifiant> (AAAA-MM-JJ)`. Un contrôle écarté ou déjà présent ne se repropose pas.

## `couleurs-variables`

- **Moment** : `/pulse:ui identite`, une fois `docs/design.md` écrit et l'identité traduite dans le code.
- **Condition** : le projet a un fichier de variables de couleurs (donné par le contexte du pack de pile, sinon le fichier où l'identité vient d'être traduite en code).
- **Phrase** : « Voulez-vous que Pulse refuse, à chaque enregistrement, une couleur écrite en dur dans un style ? Les couleurs restent ainsi dans un seul fichier, et changer l'identité reste simple. »
- **Ligne** (`{{fichier des variables}}` : la portée donnée par le pack) :

```
- Les couleurs viennent des variables de l'identité. — Contrôle : interdit `/#[0-9a-fA-F]{3,8}\b/` dans `*.css` sauf `{{fichier des variables}}`
```

## Contrôles du pack de pile

Le contexte `tech` du pack liste ses propres contrôles (identifiant, moment, phrase, ligne), proposés de la même façon quand leur condition est remplie.

## Constat récurrent

`/pulse:review` propose aussi une règle contrôlée quand la même remarque revient sur deux tâches d'une US et qu'un motif sûr la traduit (`examen.md` § 3). La ligne suit la syntaxe ci-dessus.
