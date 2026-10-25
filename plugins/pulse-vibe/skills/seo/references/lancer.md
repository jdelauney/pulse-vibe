# Référencement : le lancement (`/pulse:seo lancer`)

Après la mise en ligne sur le **domaine définitif**. La personne agit elle-même sur chaque site (ses comptes, ses accès) ; Pulse guide pas à pas, une étape à la fois, et note chaque résultat dans la section « Suivi » de `docs/seo.md`.

## 1. Une seule adresse pour le site

- Choisir l'adresse officielle (avec ou sans `www`) avec la personne ; l'écrire dans `docs/seo.md` (`adresse:` du bloc `pulse-seo`) et dans la variable d'adresse du site de la pile (consignes du pack ou de l'hébergeur).
- Faire rediriger les autres variantes (http, avec ou sans `www`, adresse fournie par l'hébergeur) vers elle par une redirection permanente, dans les réglages de domaine de l'hébergeur.
- Preuve : `pulse-aidd seo <adresse officielle>` (contrôles L2 et L11).

## 2. Google Search Console et Bing

Suivre `pulse-aidd reference search-console/relier.md`, étapes 1a à 1e puis 1g. L'accès aux données (1f) se propose plus tard avec `/pulse:search-console lire`.

Puis, dans Search Console, **Inspection de l'URL** de l'accueil → « Demander une indexation ». Expliquer : l'outil d'inspection reçoit parfois une version plus complète que Googlebot ; un test vert donne une bonne indication, pas une preuve absolue. Noter dans « Suivi » : date, type de propriété, méthode de vérification, état du sitemap, Bing.

## 3. La carte de partage et les données structurées

- **LinkedIn Post Inspector** (linkedin.com/post-inspector) : coller l'adresse de l'accueil ; l'outil vide aussi le cache de LinkedIn.
- **Rich Results Test** (search.google.com/test/rich-results) : éligibilité aux résultats enrichis de Google.
- **Schema Markup Validator** (validator.schema.org) : validité schema.org.
- Noter les résultats dans « Suivi ».

## 4. Les assistants IA

- Rapports à ouvrir une fois avec la personne : Bing Webmaster Tools → **AI Performance** (citations dans Copilot) ; Search Console → rapport des impressions dans les fonctions d'IA générative.
- Statistiques du site : les visites venues de ChatGPT portent `utm_source=chatgpt.com`.

## 5. Les rendez-vous

- **Dans 1 mois** : Search Console → Pages (indexées, exclues et pourquoi), Performance (premières requêtes réelles : ce sont les vrais mots des clients, à reporter dans `docs/seo.md`). Puis `/pulse:seo audit`.
- **Dans 3 mois** : même lecture, et **test manuel** : 5 questions de clients posées à 3 assistants ; noter dans « Suivi » la question, l'assistant, cité oui ou non, la date. Un test isolé ne prouve rien : les réponses varient d'une fois à l'autre.
- Rappeler les délais : quelques jours pour l'indexation, des semaines à des mois pour le classement.

## 6. Pour aller plus loin

Le suivi détaillé (requêtes, pages, évolution d'un mois sur l'autre) : `/pulse:search-console`. Il lit l'export CSV des rapports, sans aucun secret, ou une connexion Google en lecture seule.
