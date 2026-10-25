# L'envoi du travail

Utilisé par `/pulse:commit`, `/pulse:implement`, `/pulse:spirc` et `/pulse:annuler`. Pour relier le projet à un dépôt distant : référence « Le dépôt distant » (`depot-distant.md`).

## 1. Choisir comment envoyer le travail d'un plan

**Quand** : au démarrage de `/pulse:implement` ou `/pulse:spirc` (dans la même ronde de questions que le mode et le worktree), ou au premier commit d'une tâche du plan, si **un dépôt distant existe** (`git remote -v`) et que la ligne « Envoi » de la vue d'ensemble du plan vaut « à choisir » (ou est absente). Une seule fois par plan : ensuite, la ligne fait foi. Sans dépôt distant : tout reste local, la question est sautée.

Demander (AskUserQuestion) « Comment envoyer le travail de US-XXX sur le dépôt distant ? » :
- « Une version parallèle pour l'US, publiée quand vous l'acceptez sur le site du dépôt (Recommandé) » : les commits vont sur `feat/us-xxx-<nom>`, chacun est envoyé et met à jour une demande de fusion (PR) en brouillon ; la version principale, et le site en ligne, changent seulement à la fusion, faite par la personne sur le site du dépôt. → ligne « **Envoi** : version parallèle (branche `feat/us-xxx-<nom>`) » ;
- « Directement sur la version principale » : chaque tâche enregistrée est envoyée sur `<principale>` ; si le déploiement automatique est en place, **chaque tâche est mise en ligne**. → « **Envoi** : branche principale » ;
- « Ne rien envoyer pour l'instant » : tout reste local. → « **Envoi** : local ».

En mode découverte (règles de réalisation), la question n'est pas posée (sauf dans la ronde de départ de `/pulse:spirc`, avec cette réponse recommandée) : l'envoi prend « Directement sur la version principale », annoncé en une phrase. Chaque tâche y part après le test par la personne (en mode autonome, après le test groupé) ; la personne n'a aucune demande de fusion à accepter elle-même sur le site du dépôt. Chaque envoi passe toujours par la demande d'autorisation de Claude Code : la personne garde l'accord, envoi par envoi.

Écrire la ligne dans la vue d'ensemble du plan (elle fait partie du commit suivant). Le **mode PR** désigne « **Envoi** : version parallèle » ; un plan plus ancien l'écrit « **Envoi** : PR », qui se lit pareil. Pour changer de mode ensuite : `/pulse:refine US-XXX "changer l'envoi"`.

**Préparer la branche (mode PR)**, avant de coder la première tâche :
- dans un worktree : sa branche est déjà `feat/us-xxx-<nom>`, elle est prête ;
- sinon, si la branche courante est une autre que `feat/us-xxx-<nom>` : appliquer l'étape **pr** section A (`pulse-aidd etape pr --sans-communes`) avec cette US (la branche existe déjà : y revenir).
- À chaque reprise du plan (`/pulse:implement`, `/pulse:spirc`) : vérifier qu'on est bien sur cette branche, sinon y revenir (`git switch feat/us-xxx-<nom>`, si toutes les modifications sont enregistrées).

## 2. Envoyer après chaque tâche enregistrée

Appliqué par `/pulse:commit` juste après le commit d'une tâche, selon la ligne « Envoi » de son plan (l'argument `push` envoie toujours, quel que soit le mode) :

- **Version parallèle** (ou **PR**, dans un plan plus ancien) : `git push -u origin feat/us-xxx-<nom>`. Si la demande de fusion de cette branche reste à créer (`gh pr view`, `glab mr view`) : appliquer l'étape **pr** section B (`pulse-aidd etape pr --sans-communes`) pour l'ouvrir en brouillon. Sinon, dire en une ligne que la demande est à jour, avec son adresse.
- **Branche principale** : `git push`. La première fois, rappeler que, si le déploiement automatique est en place, la tâche est maintenant en ligne.
- **Local** : tout reste local.
- **Après l'envoi, passer directement à la suite.** La mise en ligne chez l'hébergeur se fait seule ; son suivi (état, journal, adresse) appartient à `/pulse:deploy` et `/pulse:status`. En rythme rapide (règles de réalisation), l'envoi se résume à une ligne : « Envoyé. »
- Envoi refusé (le dépôt distant a des changements plus récents) : Conventions Git § 4 (absentes de la conversation : `pulse-aidd reference git.md`).

## 3. Fin du plan, en mode PR

Quand la dernière tâche du plan est enregistrée et envoyée :
1. Proposer de passer la demande « prête » (`gh pr ready`, `glab mr update --ready`, ou le bouton sur le site), après un dernier coup d'œil à l'adresse de prévisualisation si l'hébergeur en fournit une.
2. Rappeler que **la fusion se fait par la personne**, sur le site du dépôt (bouton « Merge ») : Pulse ne fusionne jamais une demande.
3. Après la fusion : `git switch <principale>`, `git pull`, puis supprimer la branche locale (`git branch -d feat/us-xxx-<nom>` ; jamais `-D`). `/pulse:status` le rappelle si la branche traîne ; pour publier et vérifier la version en ligne : `/pulse:deploy`.
