# Conventions Git (/pulse:commit, /pulse:pr)

Ces conventions s'appliquent **par défaut** ; celles que fixe le projet passent avant : « Conventions propres au projet » de `aidd_docs/memory/technical.md`, un fichier `CONTRIBUTING.md`, ou les habitudes visibles dans `git log`. Dans un projet existant, ses conventions priment (règle commune 13).

## 1. Un commit = un sujet

- Un commit regroupe **une seule raison de changer** : une tâche du plan, une mise à jour de la mémoire, une correction isolée. Deux sujets mélangés font deux commits.
- On ajoute **seulement** les fichiers du sujet (`git add <fichiers>`), jamais `git add -A` à l'aveugle. Un fichier déjà préparé par la personne (`git diff --cached`) est respecté ; un fichier hors du sujet, qu'elle n'a pas cité, s'ajoute seulement avec son accord.
- Pourquoi : un commit propre se relit, s'annule et s'explique facilement (« revenir sur la tâche T4 » sans perdre le reste).

## 2. Le message

Format :

```
<type>(<Tâche>): <description>

<corps facultatif : pourquoi ce changement, si ce n'est pas évident>

Réf. : <US-03, ticket…>   (facultatif)
```

- **Description** : en français, à l'impératif (« ajoute », « corrige »), en minuscules, sans point final, **72 caractères au plus** pour toute la première ligne. Elle dit ce que la personne de l'appli y gagne, plutôt que le détail technique.
- **`(<Tâche>)`** : le numéro de tâche du plan (`T3`). Sans tâche, omettre la parenthèse, ou mettre une zone courte du projet (`docs`, `memoire`).
- **Corps** : seulement s'il apporte le **pourquoi** (une contrainte, un choix, un piège évité). Une ligne vide le sépare de la description.
- **Réf.** : les US concernées (identifiants `US-XXX` du référentiel `docs/user-stories.md`), ou un ticket.

Types :

| Type | Quand |
|---|---|
| `feat` | Nouvelle fonctionnalité visible |
| `fix` | Correction d'un problème |
| `docs` | Documentation, plans, mémoire |
| `style` | Présentation du code ou de l'interface, sans changement de comportement |
| `refactor` | Réorganisation du code sans changement visible |
| `test` | Ajout ou modification de tests |
| `perf` | Rendre plus rapide |
| `ci` | Contrôles automatiques, mise en ligne automatique |
| `chore` | Entretien : configuration, dépendances |
| `revert` | Annuler un commit précédent |

Exemples : `feat(T3): permet de cocher une tâche terminée` · `fix(T7): empêche l'envoi d'un formulaire vide` · `docs(memoire): note le piège des dates`.
À éviter : `modifs`, `WIP`, `fix`, `mise à jour`.

## 3. Quand un contrôle refuse le commit

Un contrôle automatique (garde-fou anti-secrets, lint, format…) peut refuser le commit.

- **Secret détecté** : retirer la clé du code, la placer dans le fichier d'environnement local, puis recommencer ; jamais de contournement.
- **Correction mécanique** (formatage, import inutilisé…) dans les **fichiers de ce commit** : corriger, ajouter de nouveau ces fichiers, recommencer. **3 essais au plus.**
- Arrêter et expliquer le blocage si la correction demande un choix, touche d'autres fichiers, ne progresse pas, ou échoue une troisième fois. Le commit attend alors la solution.
- Faire passer les contrôles en corrigeant ce commit lui-même : **jamais** `--no-verify`, jamais élargir le changement pour faire passer un contrôle.

## 4. Envoyer (push)

- `git push` envoie la branche courante ; la première fois pour une branche : `git push -u origin <branche>`.
- **Jamais `--force`.** `--force-with-lease` seulement si la personne le demande explicitement, après explication du risque.
- Le garde-fou anti-secrets bloque un envoi si un fichier d'environnement local est suivi par Git.

## 5. Les branches

Une **branche** est une copie de travail du projet : on y avance sans toucher à la version publiée, puis on propose de la fusionner (demande de fusion, ou PR). La **branche principale** (souvent `main`) est celle que l'hébergeur publie.

Nom : `<type>/<sujet-court>`, en minuscules, sans accent, mots séparés par des tirets, 40 caractères au plus.

| Préfixe | Quand |
|---|---|
| `feat/` | Nouvelle fonctionnalité (souvent l'US du plan : `feat/us-003-<nom>`) |
| `fix/` | Correction |
| `docs/` | Documentation |
| `refactor/` | Réorganisation |
| `chore/` | Entretien |
| `hotfix/` | Correction urgente du site en ligne |

Exemples : `feat/us-03-filtre-par-date`, `fix/formulaire-vide`. À éviter : `ma-branche`, `test`, `nouveau`.

**Branche principale** : toujours la lire avec `git symbolic-ref --short refs/remotes/origin/HEAD` (résultat `origin/<nom>`), sinon `gh repo view --json defaultBranchRef` ou `glab repo view`, sinon la demander.

## 6. Les demandes de fusion (PR)

- Toujours créée **en brouillon** : la personne la passe « prête » elle-même.
- **Base** : celle donnée par la personne, sinon la convention du projet, sinon la branche principale du dépôt distant.
- **Outil** : déduit de l'adresse du dépôt distant (`git remote get-url origin`) : `github.com` → `gh pr create --draft` ; `gitlab` → `glab mr create --draft`. Outil absent ou non connecté (`gh auth status`, `glab auth status`) : donner le lien de création à ouvrir et le texte à coller, en laissant toute installation à la personne.
- **Description** : le modèle du dépôt s'il en a un (`.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/`, `.gitlab/merge_request_templates/`), sinon le modèle Pulse.
- La fusion se fait sur le site du dépôt, par la personne ; la commande ne fusionne jamais.
