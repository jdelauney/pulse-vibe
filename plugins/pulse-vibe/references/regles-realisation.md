# Règles de réalisation : mode découverte, rythme et trace

Ces règles complètent les « Règles communes Pulse » pour les commandes qui réalisent, corrigent ou suivent un plan.

## Mode découverte et rythme

- **Mode découverte** : quand le niveau du profil vaut « Jamais programmé », `/pulse:implement` garde pour elle les choix de façon de travailler (`/pulse:spirc` les pose dans sa ronde de départ, réponses recommandées en premier) (en coulisse ou devant vous, rythme, contrôle de sécurité, tests, dossier à part, envoi) : chacun prend sa réponse recommandée, sauf l'envoi, qui prend « Directement sur la version principale » (référence « Le dépôt distant et l'envoi du travail », § 2) ; le tout est annoncé en une phrase (« J'ai pris les réglages conseillés : je code en coulisse · <tests selon la pile> · envoi : <mode retenu>. Dites-le si vous préférez autre chose. » : l'annonce nomme les choix réellement pris, envoi compris). Les options tapées par la personne (`-a`, `-x`, `-w`, `-t`…) restent appliquées. Les questions de besoin, les validations et le test manuel restent les mêmes.
- **Rythme** (profil) : « à choisir » (demandé à chaque réalisation), « complet », ou « rapide » (posé par `/pulse:express` ou `-f` de `/pulse:spirc` : moins de tests, une fiche de test de l'US à la fin, référence « Tests automatiques », § 2 bis). Il change sur simple demande.

## Garder la trace

Ce qui s'est passé doit se retrouver dans les fichiers du projet, sans dépendre de la conversation :

- **Rapport de relecture** (`aidd_docs/tasks/<epic>/revues/…`) : le verdict, le mode (`Mode`), la suite donnée à chaque constat, et le **résultat du test par la personne** (date, résultat, remarque).
- **Journal du plan** : une ligne par événement, avec la date. La colonne « Remarque » est **obligatoire** quand :
  - le plan est validé (`/pulse:plan`, ou ✋ 2 de `/pulse:spirc`) ou modifié (`/pulse:refine`) : tâche « — », remarque « plan validé » ou « plan modifié : … » ;
  - une tâche est enregistrée sans rapport de relecture (« enregistrée sans relecture, à la demande de la personne ») ;
  - la tâche a été faite en mode autonome ou avec le contrôle de sécurité à chaque tâche ;
  - le test par la personne est reporté (mode autonome), non concluant mais accepté, ou si un constat Critique, Haute ou Moyenne reste sans correction avec l'accord de la personne ;
  - une correction (`/pulse:fix`, `/pulse:auto-fix`) touche une tâche du plan : tâche concernée, « correction : <problème en quelques mots> » ;
  - une tâche est annulée (`/pulse:annuler`).
- **Commit** : le numéro de tâche dans le message (`feat(T3): …`, `fix(T3): …`) relie l'historique Git au plan.
