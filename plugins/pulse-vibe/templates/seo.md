# Référencement – {{NOM_DU_PROJET}}

> Fiche de référencement, tenue par `/pulse:seo`. Source unique des textes : le code reprend les titres et descriptions écrits ici, validés par vous. Dernière mise à jour : {{DATE}}.

<!-- pulse-seo
Ce bloc est lu par pulse-aidd seo : une clé par ligne ; une valeur vide est ignorée.
site: public
adresse:
politique-ia: à décider
content-signal: non
nosnippet: non
amazonbot: autorisé
fait:
privee:
-->

## Le site en une phrase

{{ce que fait le site, pour qui}}

## Être trouvé

- **Par qui** : {{les clients visés, d'après docs/prd.md}}
- **Avec quels mots** (ceux des clients, validés par vous) : {{2 à 5 expressions}}
- **Requêtes réelles** (Search Console, après quelques semaines) : {{à compléter}}

## Adresse officielle

{{https://www.mon-site.fr}} – les autres variantes (http, avec ou sans www, adresse de l'hébergeur) redirigent vers elle.

## Pages publiques

| Adresse | Titre | Description | Indexée | Image de partage | Données structurées | US |
|---|---|---|---|---|---|---|
| `/` | {{Nom – promesse}} | {{une ou deux phrases}} | oui | image du site | WebSite | — |

## Pages privées (hors de Google)

| Adresse | Pourquoi | Protection |
|---|---|---|
| {{/compte}} | {{données de la personne connectée}} | connexion + noindex |

## Faits clés

Écrits en clair sur l'accueil ou la page « À propos » (une ligne `fait:` par fait dans le bloc ci-dessus) :

- **Qui** : {{nom}}
- **Quoi** : {{activité}}
- **Où** : {{zone servie}}
- **Pour qui** : {{public}}
- **Combien** : {{prix ou « sur devis »}}
- **Contact** : {{comment joindre}}

## Assistants IA

- **Politique choisie** : {{A | B | C | D}} – {{intitulé}} – décidée le {{DATE}} ; raison : {{vos mots}}
- **Robots** (d'après `pulse-aidd reference seo/robots-ia.json`, liste vérifiée le {{date de la liste}}) :

  | Robot | Éditeur | Rôle | Autorisé |
  |---|---|---|---|
  | {{OAI-SearchBot}} | {{OpenAI}} | {{recherche}} | {{oui}} |

- **Google (AI Overviews, AI Mode)** : réglage Search Console {{Inclure | Exclure}} ; `nosnippet` : {{non | oui, sur …}}
- **Options** : Content-Signal {{non | la ligne}} ; Amazonbot {{autorisé | bloqué}}

## Suivi

| Date | Quoi | Résultat |
|---|---|---|
| {{DATE}} | Search Console : propriété {{Domaine / Préfixe d'URL}}, vérification par {{DNS / balise}} | {{validée}} |
| | Sitemap soumis | {{Réussite}} |
| | Inspection de l'accueil, demande d'indexation | {{…}} |
| | Bing Webmaster Tools (import) | {{…}} |
| | LinkedIn Post Inspector, Rich Results Test | {{…}} |

**Tests manuels auprès des assistants** (5 questions de clients, à 1 et 3 mois) :

| Date | Question | Assistant | Cité ? |
|---|---|---|---|
| | | | |

**Prochain rendez-vous** : {{date}} – lire Search Console (Pages, Performance), puis `/pulse:seo audit`.
