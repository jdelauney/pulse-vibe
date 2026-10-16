# Les autorisations du projet

Utilisé par `/pulse:init`, `/pulse:tech` et `/pulse:spirc`. Les autorisations d'une commande Pulse valent seulement pendant le tour où elle est lancée, et les assistants qu'elle fait travailler ne les reçoivent pas. Sans règles dans le projet, Claude Code redemande donc l'accord à chaque contrôle, même pendant une réalisation qui tourne seule.

1. Lancer `pulse-aidd autorisations` : il liste les règles qui manquent dans `.claude/settings.json` (lecture des fichiers de clés interdite ; Git sans envoi ; les commandes de Pulse qui lisent ou contrôlent ; les contrôles de « Commandes du projet » : lancer en local, tester, contrôler, auditer, construire). L'envoi, la mise en ligne, l'installation et les clés de production restent toujours soumis à l'accord.
2. `manquantes: 0` : rien à faire. Sinon, l'expliquer en deux phrases (« Ces règles laissent les assistants lancer les contrôles du projet sans vous redemander à chaque fois. L'envoi en ligne, l'installation et vos clés demandent toujours votre accord. »), puis demander (AskUserQuestion) : « Écrire ces règles dans `.claude/settings.json` (Recommandé) » / « Plus tard ». Le bloc des règles s'affiche sur demande.
3. Accepté : annoncer « Claude Code va vous demander l'accord : c'est un changement de configuration », puis `pulse-aidd autorisations --ecrire`.
