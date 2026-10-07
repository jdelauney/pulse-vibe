# Réagir à une fuite de clé

Utilisé par `/pulse:secrets fuite`. Une fuite se traite **dans cet ordre**. La priorité absolue est l'étape 2 : révoquer la clé chez son fournisseur.

Image à donner : « Une clé d'API, c'est la clé de votre local. Si elle est perdue, on change la serrure, puis on donne la nouvelle clé aux bonnes personnes. Effacer la photo de la clé ne change pas la serrure. »

## Quand parler de fuite

La clé est **exposée** quand elle a été :

| Vue où | Exposition |
|---|---|
| dans un dépôt **public**, ou signalée par une alerte (GitHub, le fournisseur) | certaine : des robots lisent les dépôts publics en quelques minutes |
| collée dans la conversation avec une IA | certaine : elle est enregistrée dans la transcription et envoyée au service du modèle |
| à l'écran pendant un partage, une vidéo, une capture envoyée | probable |
| dans un e-mail, une messagerie, un document partagé | probable |
| dans un dépôt **privé** | possible : toutes les personnes et intégrations qui y ont accès ont pu la lire, et un dépôt peut devenir public plus tard |

Dans tous ces cas : on révoque et on remplace. En cas de doute, on traite comme une fuite.

## Les étapes

1. **Identifier** (une question à la fois) : quelle clé (menu tiré de `pulse-aidd secrets inventaire`, ou traces trouvées par `pulse-aidd secrets historique`) et où elle a été vue. Premier message court et rassurant : l'action n° 1 arrive dans les 30 premières secondes.
2. **Révoquer d'abord**, chez le fournisseur, avec le chemin exact de la fiche du pack (ou de la documentation officielle) et le réglage **immédiat** (pas de délai de grâce après une fuite). Annoncer la coupure : « Votre site ne pourra plus <payer / envoyer d'e-mails / lire la base> pendant quelques minutes. C'est voulu : cela ferme la porte. »
3. **Remplacer** : nouvelle valeur dans `.env` (gestes de `secrets/sans-conversation.md`), `pulse-aidd secrets verifier <NOM>`, envoi vers l'hébergeur (`pulse-aidd secrets envoyer`), **redéploiement** (`pulse-aidd secrets redeployer`), vérification en production (`pulse-aidd sonder` et le test de la fonction concernée).
4. **Couper ce qui reste ouvert** : un mot de passe de base de données changé laisse les connexions déjà ouvertes actives tant que la base n'est pas redémarrée ; une clé de session changée laisse les sessions en base. La fiche du pack dit quoi faire pour chaque variable.
5. **Chercher des traces d'utilisation** : les journaux du fournisseur sur toute la période d'exposition (requêtes, envois, connexions, dépenses), l'activité de l'hébergeur. Noter ce qui a été regardé et le résultat.
6. **Nettoyer la source** : retirer la clé du fichier (commit normal), supprimer le message ou la capture. L'historique Git : une clé révoquée ne sert plus à rien, donc on le laisse tel quel. Une réécriture d'historique reste un choix de la personne, à faire avec une personne compétente (elle casse les copies existantes et ne protège rien sans révocation).
7. **Données personnelles** : trois questions fermées, une à la fois (section suivante). Pulse informe ; la personne décide.
8. **Écrire le journal d'incident** `docs/incidents/<AAAA-MM-JJ>-<sujet>.md` (`pulse-aidd modele incident.md`) et la ligne du journal des rotations : `pulse-aidd secrets journal <NOM> fuite --revoquee <date> --production oui`.
9. **Prévenir la récidive** : une phrase sur la cause, puis les protections qui manquent (règle `deny` sur `.env`, type Secret chez l'hébergeur, clé à droits restreints, double authentification sur le compte du fournisseur).

## Données personnelles : informer, sans décider à la place de la personne

Les trois questions :
1. La clé donnait-elle accès à des données de personnes (base de données, fichiers déposés, clients d'un service de paiement, carnet d'adresses d'un service d'e-mail) ?
2. L'exposition était-elle publique ?
3. Voit-on un signe d'utilisation par un tiers ?

Information à donner (information générale, pas un avis juridique) :

- Une clé exposée n'est pas, à elle seule, une violation de données. Elle le devient quand un accès non autorisé aux données ne peut pas être exclu.
- **Union européenne (RGPD)** : toute violation de données personnelles se documente dans un registre interne (le journal d'incident en tient lieu). Quand elle présente un risque pour les personnes, elle se notifie à l'autorité de protection des données (la CNIL en France) dans les meilleurs délais, si possible dans les 72 heures après en avoir pris connaissance ; les personnes concernées sont informées quand le risque est élevé. La CNIL conseille de notifier en cas de doute. Téléservice : https://notifications.cnil.fr/notifications/
- **Suisse (nLPD, art. 24)** : annonce au Préposé fédéral (PFPDT) dans les meilleurs délais quand la violation entraîne vraisemblablement un risque élevé pour les personnes.
- Ailleurs : l'autorité de protection des données du pays.
- La décision revient à la personne responsable du traitement, avec un conseil si besoin. Notez-la dans le journal d'incident : ce qui a été décidé, par qui, quand et pourquoi.

## Où regarder les traces, par type de service

| Service | Où regarder |
|---|---|
| Paiement | journal des requêtes de l'API par clé, paiements et remboursements inhabituels |
| Base de données | métriques de connexions et de requêtes, pics d'activité, rôles créés |
| E-mail | journal des envois, volumes, rebonds, plaintes pour spam |
| Stockage de fichiers | métriques de lecture et d'écriture, objets ajoutés ou supprimés |
| Hébergeur | journal d'activité du compte, déploiements inconnus, variables modifiées |
| Dépôt Git | accès, clés de déploiement, intégrations ajoutées |

La fiche du pack donne le chemin exact chez chaque fournisseur de la pile.

## Chiffres qui aident à comprendre

- GitGuardian, *State of Secrets Sprawl 2026* : environ 29 millions de secrets trouvés sur GitHub public en 2025 ; 64 % des secrets valides en 2022 l'étaient encore en 2026. Le danger vient des clés jamais révoquées.
- Le même rapport : les commits faits avec un assistant de code contiennent environ deux fois plus de secrets que la moyenne. D'où les garde-fous de Pulse.
