# Incident – {{sujet en quelques mots}} – {{AAAA-MM-JJ}}

> Produit par `/pulse:secrets fuite`. Ce journal sert de registre interne des incidents. Il ne contient **aucune valeur** de clé.

## En bref

- **Clé concernée** : {{NOM de la variable}} ({{fournisseur}})
- **Où elle a été vue** : {{dépôt public · dépôt privé · conversation avec l'IA · écran ou capture · e-mail ou messagerie · alerte d'un fournisseur}}
- **Exposition** : {{certaine / probable / peu probable}}
- **Ce que la clé permettait** : {{lire ou modifier la base · envoyer des e-mails · encaisser ou rembourser · déposer ou lire des fichiers · se faire passer pour un utilisateur…}}
- **État** : {{clé révoquée et remplacée · en cours}}

## Chronologie

| Date et heure | Étape | Détail |
|---|---|---|
| {{AAAA-MM-JJ HH:MM}} | Découverte | {{comment la fuite a été repérée}} |
| | Première exposition (estimée) | {{date du commit, du message, de la capture}} |
| | Révocation chez le fournisseur | {{réglage choisi : immédiat}} |
| | Coupure des accès en cours | {{sessions supprimées, calcul de la base redémarré, ou « sans objet »}} |
| | Nouvelle valeur en place | {{.env, hébergeur Production et Preview}} |
| | Redéploiement | {{adresse du déploiement}} |
| | Vérification en production | {{test fait et résultat}} |

**Durée d'exposition** : {{de la première exposition à la révocation}}.

## Traces d'utilisation frauduleuse

| Où regarder | Période | Résultat |
|---|---|---|
| {{journaux du fournisseur : requêtes, envois, connexions, factures}} | {{du … au …}} | {{rien d'anormal / anomalie : …}} |
| {{activité de l'hébergeur}} | | |

## Données personnelles

- La clé donnait-elle accès à des données de personnes ? {{oui / non}}
- L'exposition était-elle publique ? {{oui / non}}
- Un signe d'utilisation par un tiers ? {{oui / non / inconnu}}
- **Décision sur la notification** : {{aucune notification nécessaire · notification à l'autorité de protection des données · information des personnes}}, prise par {{nom et rôle}} le {{AAAA-MM-JJ}}, pour la raison suivante : {{…}}

## Nettoyage de la source

- {{fichier retiré par un commit, message supprimé, capture effacée}}
- Historique Git : {{laissé tel quel, car la clé est révoquée · réécrit par … le …}}

## Prévention

- {{une phrase : pourquoi la fuite a eu lieu}}
- {{mesures prises : règle deny sur .env, type Secret chez l'hébergeur, clé à droits restreints, double authentification…}}
