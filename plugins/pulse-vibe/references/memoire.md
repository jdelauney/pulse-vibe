# La mémoire projet Pulse

La mémoire projet, c'est ce que l'IA doit savoir **à chaque session** sans tout redécouvrir : les choix faits, les mots du métier, les pièges déjà rencontrés. Elle vit dans `aidd_docs/memory/` et appartient au projet (elle est enregistrée dans Git).

## Comment elle se charge

```
aidd_docs/memory/*.md            → chargés automatiquement à chaque session (bloc mémoire de CLAUDE.md)
aidd_docs/memory/internal/**     → lus seulement quand la tâche le demande
aidd_docs/memory/external/**     → lus seulement quand la tâche le demande
```

Le bloc mémoire de `CLAUDE.md` se trouve entre `<!-- pulse_memoire:debut -->` et `<!-- pulse_memoire:fin -->`. Il est rempli automatiquement à l'ouverture de chaque session, ou à la demande avec `pulse-aidd memoire`. **Laisser ce remplissage automatique l'écrire.**

## Où va chaque information

| Information | Destination | Chargée |
|---|---|---|
| Vision, public, périmètre MVP, règles produit stables, outils du projet (outil de ticketing) | `aidd_docs/memory/project.md` | à chaque session |
| Stack technique, conventions de code, sécurité, pièges et leçons techniques | `aidd_docs/memory/technical.md` | à chaque session |
| Les mots du métier et leur définition commune | `aidd_docs/memory/glossary.md` | à chaque session |
| Une décision difficile à défaire (voir les 3 critères ci-dessous) | `aidd_docs/memory/internal/decisions/NNNN-titre.md` | à la demande |
| Un document externe utile (doc d'un service, retour client anonymisé) | `aidd_docs/memory/external/<nom>.md` | à la demande |
| Un détail utile mais rarement nécessaire (procédure longue, historique d'un choix), avec une ligne de renvoi dans le fichier chargé | `aidd_docs/memory/internal/<sujet>.md` | à la demande |
| Le détail du besoin, des écrans, des tâches | **hors mémoire** : `docs/` (brief, PRD, US, spec, plan) | — |

Une petite décision tient en **une ligne**, avec sa date, dans « Décisions importantes » de `project.md` ou « Décisions techniques » de `technical.md`. Si elle a aussi un fichier de décision, la ligne renvoie vers lui.

## Règles d'écriture

- **Ce que le code ne montre pas** : une intention, un choix et son *pourquoi*, une convention, un piège. Pointer vers le fichier plutôt que copier le code, un schéma ou l'arborescence.
- **Un fait, un seul endroit.** S'il existe déjà ailleurs (mémoire ou `docs/`), y renvoyer au lieu de le recopier.
- **Court** : des puces brèves, les noms de fichiers et de code entre backticks. Les fichiers chargés à chaque session restent sous **200 lignes au total** : à 95 % (190 lignes), le démarrage et `pulse-aidd memoire` le signalent ; proposer alors `/pulse:memory compacter`, dont l'agent resserre la mémoire et déplace le détail vers `internal/` ou `docs/`.
- **L'état actuel seulement** : des sections remplies, chaque `{{…}}` remplacé, des faits acquis plutôt que des souhaits. Une information devenue fausse est corrigée ou supprimée.
- **Secrets et données personnelles réelles restent hors de la mémoire** : clé, mot de passe, nom ou email de client.
- **En français**, en expliquant chaque terme technique : la personne doit pouvoir relire sa mémoire.
- **La personne approuve** chaque ajout ou modification : montrer la ligne proposée et sa destination avant d'écrire.

## Le glossaire (`glossary.md`)

- **Trancher** : quand plusieurs mots désignent la même chose, retenir le meilleur et lister les autres sous *À éviter*.
- **Définitions courtes** : une ou deux phrases, ce que la chose **est**, plutôt que ce qu'elle fait.
- **Seulement les mots du métier de ce projet** ; les termes techniques généraux (variable, base de données, API) restent en dehors.
- **Uniquement le sens des mots** : les détails techniques vont dans la spec ; le glossaire reste une liste de définitions au propre.
- Format d'une entrée :

```
**<Mot du métier>** :
<Ce que la chose est, en une ou deux phrases.>
_À éviter_ : <autres mots employés pour la même chose>
```

## Les décisions (ADR)

Proposer un fichier de décision **seulement si les trois conditions sont réunies** :

1. **Difficile à défaire** : changer d'avis plus tard coûterait cher.
2. **Surprenante sans contexte** : quelqu'un qui lit le code se demanderait « pourquoi ont-ils fait ça ? ».
3. **Fruit d'un vrai choix** : il y avait de vraies alternatives, et on en a retenu une pour des raisons précises.

Sinon, une ligne dans la section « Décisions » suffit, ou rien du tout.

Exemples qui méritent une décision : « Les données restent dans le navigateur (pas de compte) », « Pas de paiement en ligne : facture envoyée par email », « Données hébergées dans la région exigée par la loi applicable ».

Numérotation : prendre le plus grand numéro de `internal/decisions/` et ajouter 1 (`0001-…`, `0002-…`). Créer le dossier seulement à la première décision.
