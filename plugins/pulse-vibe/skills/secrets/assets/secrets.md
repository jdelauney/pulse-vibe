# Secrets du projet – {{NOM_DU_PROJET}}

> Produit et tenu à jour par `/pulse:secrets`. Ce document contient des **noms** et des **dates**, jamais une valeur.
> Les valeurs vivent dans `.env` (cet ordinateur, hors de Git), chez l'hébergeur et chez chaque fournisseur.

## Inventaire

| Variable | Rôle (une phrase) | Fournisseur | Où la renouveler | Où elle vit | Valeur distincte par environnement | Montrée une seule fois | Délai de grâce |
|---|---|---|---|---|---|---|---|
| {{NOM}} | {{à quoi elle sert}} | {{fournisseur}} | {{page exacte du fournisseur}} | {{.env · hébergeur Production · Preview · CI}} | {{oui / non}} | {{oui / non}} | {{aucun / 24 h / 7 jours / deux clés en parallèle}} |

Variables liées (à changer ensemble) : {{ex. les deux adresses de la base de données}}.

## Protections en place

- [ ] `.env` et `.env.*` ignorés par Git (`.env.example` seul enregistré)
- [ ] Règle de Claude Code qui interdit la lecture de `.env` (`.claude/settings.json`, `permissions.deny`)
- [ ] Secrets de l'hébergeur en type **Secret** (non relisibles)
- [ ] Valeurs distinctes en Production et en Preview pour les secrets générés
- [ ] Double authentification active sur les comptes des fournisseurs et de l'hébergeur

## Journal des rotations

| Date | Variable | Raison | Ancienne valeur révoquée le | Vérifiée en production |
|---|---|---|---|---|
| {{AAAA-MM-JJ}} | {{NOM}} | {{planifiée · départ d'une personne · fin de mission · revue annuelle · fuite}} | {{AAAA-MM-JJ ou « à faire »}} | {{oui / non}} |

Une rotation liée à une fuite renvoie aussi à son journal d'incident (`docs/incidents/`).
