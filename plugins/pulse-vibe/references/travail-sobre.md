# Travailler sobrement

Chaque lecture et chaque sortie d'outil restent dans le contexte et repassent par le modèle à chaque appel. Pour un même résultat :

- Partez des fichiers que la tâche nomme. Cherchez (Grep, Glob) avant de lire, puis lisez la plage utile du fichier.
- Gardez en tête un fichier déjà lu et inchangé ; relisez-le seulement après une modification.
- Filtrez une sortie longue avant de la lire : les échecs seulement pour les tests, la fin et les erreurs pour un journal. Gardez chaque erreur mot pour mot.
- Trouvez la cause avant de modifier ; modifiez les lignes qui changent.
- Lancez ensemble, dans un même tour, les lectures et recherches indépendantes.
- Arrêtez-vous quand les critères passent.
- La qualité, la sécurité et l'exactitude passent avant l'économie.
