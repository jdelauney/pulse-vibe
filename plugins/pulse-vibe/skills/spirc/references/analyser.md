# Analyser une demande libre

Utilisé par `/pulse:spirc` quand la portée est une demande libre. À la fin, la demande est une tâche du plan (ou une nouvelle US) : la commande passe à son point de validation 2.

1. **Explorer** : déléguer la demande à `pulse:explorer` ; réserver à la personne les questions qu'il ne peut pas résoudre.
2. **Situer la demande** :
   - **correction** d'un comportement prévu par une US : garder cette US ; la tâche ira dans le plan de **cette** US (si ce n'est pas l'US désignée, le dire et continuer avec son plan) ;
   - **précision** d'une US déjà planifiée (un critère qui manque) : sa spec est verrouillée et reste telle quelle ; la précision devient une **nouvelle US** qui complète l'ancienne (cas suivant), avec sa spec et son plan ;
   - **nouveau comportement** prévu au PRD : créer une **nouvelle US** (numéro suivant ; avant de la rédiger, lancer `pulse-aidd reference us/regles-us.md` et `pulse-aidd modele us.md`) dans l'epic qui convient (la demander : AskUserQuestion, l'epic la plus proche avec « (Recommandé) », « Un nouveau groupe »), écrire son fichier dans `aidd_docs/tasks/<epic>/` et l'ajouter au référentiel `docs/user-stories.md`. Elle aura sa propre spec et son propre plan : passer à § S avec cette US ;
   - **nouveau comportement hors PRD** : c'est une décision de périmètre, la poser (AskUserQuestion) : « La noter « En attente » dans le PRD (Recommandé) » / « L'ajouter au périmètre maintenant ». Dans le premier cas, l'écrire dans `docs/prd.md` et s'arrêter.
3. **Clarifier ce qui change ce qui sera construit**, et seulement cela : poser les questions de la frontière en une ronde (AskUserQuestion, 4 questions au plus, réponse recommandée en premier, « (Recommandé) »), deux rondes au maximum. Employer et respecter les mots du glossaire ; signaler un mot employé dans un autre sens.
4. **Écrire le contrat** (correction ou précision) comme une nouvelle tâche à la fin de la section `## Tâches` du plan de l'US concernée (avant une éventuelle tâche « Mettre en ligne la première version »), numérotée après le plus grand `Tn` de tous les plans de `aidd_docs/tasks/`, au format du plan : objectif vu par l'utilisateur, fichiers, critères d'acceptation **vérifiables**, et une ligne « Hors périmètre » si utile. Si elle touche plus de 3 fichiers ou couvre plus de 3 critères, la découper en plusieurs tâches.
5. La portée devient cette (ou ces) tâche(s). Passer à ✋ 2.
