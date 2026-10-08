# Choix techniques – {{NOM_DU_PROJET}}

> Produit par `/pulse:tech` le {{DATE}}. Ce document explique **avec quoi** l'outil est construit, et **pourquoi**. C'est la source unique pour la spec, le plan et le code. Il reste lisible par une personne non technique.

## En une phrase

{{NOM_DU_PROJET}} est construit avec {{pile retenue, en mots simples}}, hébergé sur {{hébergeur}}, pour un coût mensuel estimé de {{montant}}.

## Les besoins qui guident le choix

| Question | Réponse | Ce que ça implique |
|---|---|---|
| Qui utilise l'outil, et combien de personnes dans 6 mois ? | | |
| Les données sont-elles partagées entre plusieurs personnes ? | | |
| Faut-il des comptes (connexion) ? Des rôles (admin) ? | | |
| Données personnelles ou sensibles ? (loi applicable) | | |
| Services externes (email, paiement, carte, IA…) | | |
| Plateforme (ordinateur, téléphone, hors ligne) | | |
| Visibilité sur les moteurs de recherche importante ? | | |
| Budget mensuel pour les services | | |
| Expérience technique de la personne ou de l'équipe | | |
| Contraintes (localisation des données, outil imposé, exclusion) | | |

## Les options comparées

| Option | Pile | Hébergement | Coût / mois | Points forts | Risques | Verdict |
|---|---|---|---|---|---|---|
| **A** | | | | | | ✅ / ⚠️ / ❌ |
| **B** | | | | | | ✅ / ⚠️ / ❌ |

## Pile retenue

| Élément | Choix | Version | Pourquoi (en une phrase) |
|---|---|---|---|
| Langage(s) | | | |
| Framework (ou aucun) | | | |
| Données (stockage) | | | |
| Connexion des utilisateurs (ou aucune) | | | |
| Code serveur (ou aucun) | | | |
| Hébergement | | | |
| Services externes | | | |
| Tests automatiques | {{outil unitaire et intégration ; bout en bout : outil ou « aucun »}} | | |

<!-- Seulement si la pile retenue est celle d'un pack de pile Pulse (pulse-aidd piles) ; sinon supprimer la ligne suivante, avec ce commentaire. -->
**Pack de pile Pulse** : {{id du pack, ex. next}}

## Comment les pièces s'assemblent

```mermaid
flowchart LR
  user([Utilisateur]) --> client[Interface]
```

{{2 ou 3 phrases : qui parle à qui, où sont les données, où sont les secrets.}}

## Organisation des fichiers

> Projet existant : l'organisation observée dans le code. Projet neuf : l'organisation décidée (les dossiers sont créés au fil des tâches).

```
{{arborescence}}
```

## Commandes du projet

| Action | Commande |
|---|---|
| Installer les dépendances | {{commande ou « aucune »}} |
| Lancer en local | {{commande, et adresse à ouvrir}} |
| Tester | {{commande ou « aucune »}} |
| Contrôles automatiques (lint, format, types) | {{commandes ou « aucune »}} |
| Auditer les dépendances | {{commande ou « aucune » : l'outil d'audit des vulnérabilités de la pile}} |
| Construire | {{commande ou « aucune »}} |
| Déployer | {{automatique à chaque envoi sur la branche principale, ou commande}} |

## Données et contrôle d'accès

- Où sont les données : {{…}}
- Qui peut lire, créer, modifier, supprimer quoi : {{…}}
- Où ce contrôle est vérifié côté serveur ou dans la base : {{…}}
- Sauvegarde et restauration : {{sauvegarde automatique de la base, et comment la restaurer}}

## Secrets et variables d'environnement

- Fichier local non versionné : {{nom du fichier}} ; modèle versionné aux valeurs vides : `.env.example`.
- Variables : {{NOM — rôle — côté serveur ou public}}
- En production : à saisir par la personne dans {{l'hébergeur}}. Les valeurs ne sont jamais collées dans la conversation.

## Hébergement et mise en ligne

- Dépôt distant : {{…}}
- Hébergeur : {{…}} ; mise en ligne : {{automatique à chaque envoi / manuelle}}
- Site en ligne : {{adresse, vérifiée avec `pulse-aidd sonder`, ou « pas encore en ligne »}}
- Contrôle automatique avant mise en ligne (CI) : {{outil, ou « à mettre en place avec /pulse:cicd »}}

## Référencement

<!-- Rempli par /pulse:search-console relier (et /pulse:seo lancer pour la vérification minimale). Les textes et la politique des robots IA sont dans docs/seo.md. -->
- Search Console : {{propriété (`sc-domain:exemple.fr` ou `https://adresse/`) – méthode (balise meta ou DNS) – vérifiée le AAAA-MM-JJ, ou « à relier avec /pulse:search-console relier »}}
- Balise de vérification : {{fichier où elle se trouve, à garder en place, ou « aucune (DNS) »}}
- Sitemap : {{adresse – déclaré le AAAA-MM-JJ}}
- Bing Webmaster Tools : {{importé le AAAA-MM-JJ, ou « pas encore »}}
- Accès aux données pour Pulse : {{export CSV · connexion Google en lecture seule (accès rangé hors du projet) · compte de service en CI}}
- Rapports : `docs/referencement/` ; prochain conseillé : {{date}}

## Mise en place

Ce qu'il faut créer ou installer avant la première tâche (comptes, squelette du projet, commandes). Les clés secrètes ne sont **jamais** collées dans la conversation : la personne les saisit elle-même dans le fichier local ou chez l'hébergeur.

1. {{étape}}

## Ce qu'on a écarté

- {{option}} : {{pourquoi}}
