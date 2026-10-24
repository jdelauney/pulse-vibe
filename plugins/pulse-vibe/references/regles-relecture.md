# Règles de relecture : les constats

Ces règles complètent les « Règles communes Pulse » pour les commandes qui relisent, vérifient ou auditent.

Chaque constat d'une relecture (`pulse:reviewer`, `pulse:verifier`, `pulse:security-auditor`, `pulse:test-runner`) a une gravité : 🔴 **Critique**, 🟠 **Haute**, 🟡 **Moyenne** ou 🔵 **Basse**. Un critère ❌ du verifier, un échec ❌ du test-runner, un test manuel non concluant ou un ⛔ de l'audit de sécurité comptent comme Critique ; un ⚠️ de l'audit de sécurité compte comme Moyenne.

| Gravité | Traitement |
|---|---|
| Critique, Haute, Moyenne | corriger, puis relecture de contrôle |
| Basse | **confronter au code** : relire le passage cité, puis corriger si le problème existe bien dans le code actuel, que la correction reste dans le périmètre de la tâche et qu'elle est petite et sans risque ; sinon l'écarter, avec la raison tirée du code (une idée de fonctionnalité va dans « En attente » de `docs/prd.md`) |

- La confrontation des constats Basse se fait par la commande qui orchestre, en lisant le code ; l'agent qui a écrit le code applique ensuite les corrections retenues.
- Hors mode autonome, proposer d'abord (AskUserQuestion) : « Corriger Critique, Haute, Moyenne et les Basses retenues (Recommandé) » / « Seulement les Critiques » / « Je regarde d'abord ». En mode autonome, appliquer ce traitement directement.
- Un **écart de besoin** (la demande elle-même est à revoir) se tranche toujours avec la personne, quel que soit le mode.
- Chaque décision (corrigé, écarté et pourquoi, reporté, laissé à la demande de la personne) s'écrit dans la section « Suite donnée aux constats » du rapport.
- Deux cycles de correction au plus ; un constat Critique qui persiste arrête la tâche (statut `[~]`) et se présente simplement ; pour préparer une demande d'aide, la personne tape `/pulse:get-help`.
