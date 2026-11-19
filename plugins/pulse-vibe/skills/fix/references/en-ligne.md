# Corriger un problème du site en ligne

Utilisé par `/pulse:fix en-ligne "<ce qui se passe>"`, ou quand la personne décrit un problème vu sur le site publié (« le site ne s'ouvre plus », « mes clients ne peuvent plus se connecter », alerte de la sonde). Avec un pack de pile, ses consignes s'appliquent à chaque temps (`pulse-aidd pile contexte fix-en-ligne`). Une fuite de clé suit `/pulse:secrets fuite`, pas cette référence.

Phrase à dire, au début : « Le site en ligne a un problème. On regarde d'abord ce qui se passe, on remet le site en état si besoin, puis on corrige la cause tranquillement. »

## 1. Constater

1. L'adresse du site : ligne « Site en ligne » de `CLAUDE.md`. Lancer `pulse-aidd sonder <adresse>` (et l'adresse surveillée de la ligne « Surveillance » de `docs/technical.md`, quand elle existe) : le site répond-il, avec quel code ?
2. Depuis quand : la personne le dit (« depuis ce matin », heure de l'alerte de la sonde) ; le comparer à la date de la dernière mise en ligne (`git log -1 --format=%ci origin/main`, ou le journal de l'hébergeur).
3. Les erreurs : guider la personne vers les journaux de l'hébergeur (consignes du pack, sinon sa documentation) et lui faire copier la ligne d'erreur ou la référence affichée à l'écran. Les journaux se gardent peu de temps : les ouvrir tout de suite. La personne colle le message, jamais une valeur de clé.

Résumer en deux phrases : ce qui ne marche pas, et depuis quand.

## 2. Contenir

Si le problème est apparu juste après la dernière mise en ligne et qu'il empêche d'utiliser le site (page qui ne s'ouvre plus, connexion impossible, paiement en échec) : proposer d'abord de revenir à la version précédente (AskUserQuestion) : « Revenir à la version d'avant, le temps de corriger (Recommandé) » / « Corriger directement ». Le retour arrière suit la section « Retour arrière » de `docs/technical.md`, déjà essayée avec `/pulse:deploy production` ; vérifier ensuite que le site répond (`pulse-aidd sonder`). Les données ne se restaurent qu'avec l'accord explicite de la personne, quand une migration ou une écriture les a abîmées.

Un problème mineur (un texte, une page secondaire) : passer directement au temps 3.

## 3. Corriger

Reprendre les étapes 2 à 5 de `/pulse:fix` en local, avec les données fictives : trouver la cause, choisir la correction, **reproduire par un test** quand la cause tient dans une règle (`fix/test-regression.md`), corriger. Une cause propre à la production (variable absente ou différente chez l'hébergeur, service tiers en panne, limite d'une offre gratuite atteinte) se règle chez l'hébergeur ou le service, guidée pas à pas, sans changer le code.

La correction trop large pour une correction (un comportement à changer, plusieurs écrans) : la noter comme une demande, `/pulse:spirc <US-XXX> "<demande>"`, et s'en tenir ici au plus petit changement qui remet le site en état.

## 4. Vérifier en ligne

Enregistrer et envoyer la correction (étape commit, accord de Claude Code pour l'envoi), attendre la mise en ligne (journal de l'hébergeur), puis :

- `pulse-aidd sonder <adresse>` : le site répond comme avant ;
- la personne refait en ligne le geste qui échouait, avec un compte d'essai : « Est-ce que ça fonctionne maintenant ? » ;
- après un retour arrière au temps 2 : remettre la mise en ligne automatique (consignes du pack ou de l'hébergeur), et le vérifier.

## 5. Retenir

- Écrire la fiche `docs/incidents/<AAAA-MM-JJ>-<sujet>.md` d'après `pulse-aidd modele fix/incident.md`, montrée à la personne avant d'être enregistrée avec la correction.
- La cause peut revenir : proposer la ligne de la mémoire (« Pièges et leçons » de `aidd_docs/memory/technical.md`), montrée avant d'écrire.
- Pas de sonde de disponibilité (« Surveillance » vaut « aucune ») : proposer de la poser avec `/pulse:deploy production`, pour être prévenu la prochaine fois avant les visiteurs.
