# Déléguer une tâche à `pulse:implementer`

Utilisé par `/pulse:spirc` et `/pulse:implement`. L'agent lit lui-même `docs/technical.md`, `docs/design.md`, la maquette citée et les règles du plugin : le message porte seulement ce qui est propre à la tâche.

## Le message

- la tâche (identifiant, titre, objectif), ses fichiers concernés et ses critères d'acceptation complets, repris du fichier de l'US ; ce que la conception technique du plan dit de cette tâche ;
- le chemin de la spec de l'US (même dossier que le plan) et, pour chaque écran de la tâche, sa ligne « Présentation » ;
- un écran maquetté : le chemin de `retenue/`, les zones de la maquette que la tâche réalise et la consigne de les reproduire (`pulse-aidd reference fidelite-maquette.md` § 3) ;
- les familles de qualité de la tâche : `clean-code`, plus `composants` (interface), `securite` (point d'entrée serveur, action, route, base), `organisation` (fichier ou dossier créé) ;
- les conventions et pièges de la mémoire du projet (`aidd_docs/memory/technical.md`) et les mots du glossaire utiles à la tâche ;
- rythme rapide : « tests essentiels » (référence « Tests automatiques », § 2 bis) ;
- tests d'abord : les fichiers de test, l'interface attendue et la consigne des tests figés (étape 4 de « Tests d'abord », `pulse-aidd reference tests-dabord.md`) ;
- dossier à part où la session n'est pas entrée (série) : « Dossier de travail : `<chemin absolu>` » en première ligne ;
- une correction : la liste des constats ou des erreurs à corriger, et les familles de qualité qu'ils concernent.

## Au retour

- **Bloqué** sur une question de besoin : la poser à la personne, puis relancer l'agent avec la réponse.
- **Bloqué** sur une action manuelle (schéma dans la console du fournisseur, compte à créer, variable chez l'hébergeur, clé à écrire dans le fichier local) : guider la personne pas à pas (règle commune 20), puis relancer.
- **Bloqué – décision nécessaire** : présenter le choix en langage courant, avec ses options et leurs conséquences (AskUserQuestion) ; noter la réponse dans « Ajouts proposés par Pulse » du plan, puis relancer l'agent avec elle.
- En mode autonome, ces trois cas suivent « Questions en attente » de `/pulse:spirc`.
- **Terminé** : lire son rapport et les changements (`git diff`, `git status`). Une tâche maquettée passe ensuite le contrôle de la maquette (`fidelite-maquette.md` § 3), même en rythme rapide. Les points « À signaler » reviennent à l'appelant : une idée hors périmètre va dans « En attente » de `docs/prd.md` ; un secret à inventer se génère avec `pulse-aidd secrets generer <NOM>`, avec l'accord de la personne.
- Avec un pack de pile, pour confronter un constat Basse à une règle du pack : `pulse-aidd pile reference fiche.md`.
