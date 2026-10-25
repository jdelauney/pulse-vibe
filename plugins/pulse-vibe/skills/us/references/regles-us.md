# Les règles des user stories (`/pulse:us`, `/pulse:spec`, `/pulse:express`)

## Format

Chaque US suit le modèle de fichier d'US :

- **Identifiant** : `US-001`, `US-002`… dans l'ordre de réalisation ; en complément d'un référentiel, reprendre après le plus grand numéro existant.
- **Fichier** : `aidd_docs/tasks/<epic>/US-XXX-<nom>.md`, `<nom>` tiré du titre court.
- **Phrase** : « En tant que {{acteur}}, je souhaite {{action + objet}} afin de {{objectif}} ».
- **Taille** (S, M ; une US de taille L se découpe) et **Dépend de** (l'US qui doit exister avant, ou « — »).
- **Règle(s) métier** : la règle que l'exemple illustre.
- **Exemple concret** avec des données **réalistes et fictives** (noms et situations plausibles du métier de la personne), plutôt que « élément A ».
- **Critères d'acceptation** : 2 à 4, chacun nommé (cas nominal, cas d'erreur ou limite, cas alternatif, accès), au format « **Étant donné** contexte, **lorsque** action, **alors** résultat attendu ». **Au moins un** couvre un cas d'erreur ou un cas limite (champ vide, texte trop long, élément introuvable, accès non autorisé).
- **Hors périmètre de cette US** : ce qu'elle laisse volontairement de côté, pour que l'IA s'en tienne à son périmètre.

## INVEST

Le seuil de chaque critère → sinon :

- **Indépendante** : réalisable et testable seule, une fois ses « Dépend de » terminées ; dépendances dans un seul sens → regrouper ou redécouper.
- **Négociable** : le besoin dans les mots de l'utilisateur, à la place de « base de données », « API », « composant » → réécrire du point de vue de l'utilisateur.
- **Utile** : son « afin de » apporte une valeur que l'utilisateur reconnaît → la fusionner avec l'US qu'elle sert.
- **Estimable** : taille S ou M sans inconnue majeure → l'inconnue devient une question pour la personne.
- **Petite** : un seul acteur, une seule action (une phrase sans « et » ni « ou »), 4 critères et une règle métier au plus → la découper.
- **Testable** : chaque critère décrit un résultat **visible** par l'utilisateur → le reformuler en résultat observable.

## Bien rangée et US d'accès

- L'US sert l'objectif de son groupe ; sinon, la déplacer ou proposer un autre groupe.
- Données partagées entre plusieurs personnes : des US d'accès, qui voit quoi (« En tant que <acteur>, je vois seulement mes propres <éléments> »). Elles porteront la sécurité.

## Definition of Ready

Une US se sauvegarde seulement **prête** : elle passe INVEST ; ses critères sont écrits, dont au moins un cas d'erreur ou limite ; ses dépendances sont notées (« Dépend de », ou « — ») ; **aucune question bloquante** ne reste. Cocher alors la section « Prête » du modèle d'US.

## Ticketing

Sauvegarder selon la ligne « Outil de ticketing » de `aidd_docs/memory/project.md` :

- **toujours** les fichiers : le référentiel `docs/user-stories.md` (selon son modèle, chaque groupe rangé dans l'ordre de réalisation, avec le lien vers chaque fichier) et les fichiers `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` ;
- **outil indiqué** (GitHub Issues, Jira, Linear…) : aussi un ticket par US détaillée, dans l'ordre de réalisation, avec la phrase, les critères et le lien vers le fichier ; GitHub Issues par `gh issue create`, un autre outil par son connecteur (MCP) s'il est disponible, sinon le signaler et garder les fichiers seuls. Reporter le lien de chaque ticket dans la ligne « Ticket » de son US ;
- **ligne absente** : garder les fichiers, et proposer d'ajouter la ligne à la mémoire projet (`/pulse:memory`).
