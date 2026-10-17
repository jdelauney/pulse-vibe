# /pulse:implement – la boucle sur tout le plan

Utilisé par `/pulse:implement <US-XXX>` lancé sans tâche : chaque tâche restante du plan est réalisée, relue et vérifiée, corrigée, puis enregistrée, l'une après l'autre. Les étapes 2 à 5 citées ici sont celles de `/pulse:implement`.

**Avant la première tâche**, y compris à une reprise (`/clear`, résumé automatique) quand ces étapes ne figurent plus dans la conversation, charger une seule fois les deux étapes qui servent à chaque tâche : `pulse-aidd etape review --sans-communes` et `pulse-aidd etape commit --sans-communes`. Si elles ne figurent plus dans la conversation (après un résumé automatique), les relancer.

**Travail en cours** (règle commune 16) : à chaque arrêt pour la personne (test manuel, choix de correction, blocage), écrire `aidd_docs/tasks/in-progress.md` avec « Pour reprendre : `/pulse:implement <US-XXX>` » ; l'effacer (`pulse-aidd travail-fini`) dès sa réponse.

**Reprendre une tâche en cours** : pour une tâche `[~]` (reprise après `/clear`, une pause ou une interruption), lancer `pulse-aidd revue <Tn>` et reprendre à l'étape que donne sa ligne `reprendre` :
- `examen` (aucun rapport) : à l'étape 2 (relire et vérifier), sur le code déjà écrit ;
- `correction` : à l'étape 3 (corriger), avec les constats du rapport ;
- `test` : au test manuel de l'étape review (« Le test manuel par la personne »), avec les étapes du rapport : la personne teste, même après une interruption ;
- `commit` : à l'étape 4 (commiter) ;
- `decision` (une question attend dans « Questions en attente » du plan) : s'arrêter et proposer `/pulse:spirc <US-XXX>`, qui pose la question puis reprend la tâche ;
- `aide` : s'arrêter, expliquer simplement le blocage et proposer `/pulse:get-help` ;
- `aucune` (la tâche n'est dans aucun plan) : le dire et demander de quelle tâche il s'agit.

Pour chaque tâche, dans l'ordre du plan :

1. **Réaliser** : étapes 2 à 5 ci-dessus (l'explication reste courte : ce qui a changé et la notion du jour ; le test manuel est donné à l'étape suivante).
2. **Relire et vérifier** (marqueur : `examen`) : appliquer la section « Processus » de l'étape **review** (chargée avant la première tâche) à l'identique pour cette tâche, **hors** son bloc de fin de commande : examen par `pulse:reviewer` et `pulse:verifier` (référence « Examiner une tâche »), rapport, présentation du verdict, **test manuel par la personne**.
3. **Corriger** : appliquer l'étape « Corriger » de la relecture (constats Critique, Haute et Moyenne, constats Basse confrontés au code, test non concluant : règles communes § 6), avec la relecture de contrôle ; après un test de la personne ❌, remettre la ligne « Résultat » de « Test par la personne » à la valeur du modèle (§ 4 de la référence « Examiner une tâche »). En mode sous-agent, relancer `pulse:implementer` **avec la liste des constats** à corriger. **Deux cycles au maximum** : si un constat Critique persiste, arrêter la boucle, laisser la tâche `[~]`, expliquer simplement le blocage et proposer `/pulse:get-help`.
4. **Commiter** (marqueur : `commit`) : appliquer la section « Processus » de l'étape **commit** (chargée avant la première tâche) à l'identique, **hors** son bloc de fin de commande : contrôles de sécurité, message `<type>(<Tâche>): …`, tâche passée à `[x]` avec sa ligne de journal. Le § 2 de l'étape commit donne `commit` (tâche relue, vérifiée et testée, ou test reporté en mode autonome) : passer directement à l'enregistrement.
5. **Passer à la suivante** : annoncer l'avancement en une ligne (`T3 ✅ enregistrée · US-XXX : 3/6 · suite : T4 – <titre>`), puis enchaîner directement. Si la personne demande une pause, s'arrêter : relancer `/pulse:implement <US-XXX>` reprendra à la tâche suivante.

S'arrêter aussi avant une tâche « Mettre en ligne… » (elle se fait avec `/pulse:deploy`) et à tout blocage (§ 1). Après 3 tâches, rappeler qu'on peut faire `/clear` puis relancer `/pulse:implement <US-XXX>` : la boucle reprend grâce aux statuts du plan et aux rapports de revue (une tâche `[~]` reprend là où l'indique `pulse-aidd revue <Tn>`, test de la personne compris).

Plan terminé : lancer « Tester de bout en bout » (§ 2 ter des tests) ; échec = constat Critique.

À la fin, présenter un récapitulatif :

```
| Tâche | Relecture | Test | Commit |
|---|---|---|---|
| T3 – … | ✅ Validé | ✅ | abc1234 |
```

**Dans un worktree** : quand le plan est terminé, ou si la personne s'arrête, appliquer « 3. Terminer : rassembler le travail » de la référence worktree.

Puis le bloc de fin de commande. Prochaine étape : `/pulse:deploy` si le plan est terminé et que la nouvelle version reste à mettre en ligne, sinon `/pulse:implement <US-XXX>` pour reprendre (Pulse propose de revenir dans le dossier à part gardé).
