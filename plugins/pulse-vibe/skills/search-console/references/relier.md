# Search Console : relier le site (une fois)

> Procédure unique, suivie par `/pulse:search-console relier` (étapes 1a à 1g) et par `/pulse:seo lancer` (étapes 1a à 1e puis 1g). La personne fait chaque geste avec **son** compte ; Pulse guide une étape à la fois. Les libellés des interfaces changent souvent : guider d'après ce que la personne voit à l'écran et d'après l'aide officielle (règle 15).

Relire d'abord la section « Référencement » de `docs/technical.md` : chaque étape déjà notée comme faite se saute (« déjà fait le … »).

## 1a. Choisir le type de propriété

- Adresse sur un sous-domaine d'hébergeur (`*.vercel.app`, `*.netlify.app`…), dont le DNS appartient à l'hébergeur → **préfixe d'URL** (`https://<adresse>/`) vérifié par **balise meta** (1b). Il couvre seulement les adresses qui commencent exactement par ce préfixe, protocole et `www` compris : déclarer l'adresse **réellement servie après redirection** (`https://www.` et `https://` font deux propriétés différentes).
- Domaine personnel → **propriété de domaine** (`sc-domain:exemple.fr`, tous les sous-domaines et protocoles), vérifiée par **enregistrement DNS** TXT seulement (1c). Où est géré le DNS : chez l'hébergeur (consignes du pack de pile, s'il y en a un) ou chez le registraire (OVH, Gandi, IONOS…) ? Demander à la personne si `docs/technical.md` ne le dit pas.
- Personne bloquée sur le DNS → repli sur le préfixe d'URL avec balise meta (1b), en expliquant que la propriété ne couvrira que cette adresse exacte.

La personne ouvre Search Console (search.google.com/search-console) avec son compte Google, choisit « Ajouter une propriété » et le type retenu.

Partager la propriété (« Utilisateurs et autorisations » : propriétaire, utilisateur complet ou restreint) devient possible seulement pour un propriétaire, une fois la propriété vérifiée : vérifier d'abord, partager ensuite.

## 1b. Balise meta (préfixe d'URL)

1. La personne copie **le contenu** de la balise que montre Search Console et le colle ici. Le dire : ce code est public, il s'écrit dans le code du site et s'enregistre dans Git.
2. L'écrire à l'endroit indiqué par le pack de pile ; sans pack, dans le `<head>` de la page d'accueil, d'après la documentation officielle de la technologie retenue.
3. Enregistrer et mettre en ligne comme le dit la commande en cours, puis prouver que la balise est servie : `pulse-aidd sonder <adresse> --texte "google-site-verification"`.
4. Seulement alors, la personne clique « Vérifier ». Expliquer que la balise reste en place pour toujours : si elle disparaît, la propriété se perd après un délai de grâce.

## 1c. Enregistrement DNS (domaine)

1. La personne copie la valeur TXT que montre Search Console (elle n'est pas secrète).
2. DNS chez l'hébergeur : suivre les consignes du pack de pile (tableau de bord, ou commande de l'hébergeur avec l'accord de la personne). DNS chez le registraire : guider pas à pas d'après sa documentation officielle.
3. La propagation peut prendre jusqu'à 24 heures. Si « Vérifier » échoue, noter l'étape en attente comme le dit la commande en cours, et proposer de reprendre plus tard avec `/pulse:search-console relier`.

## 1d. Sitemap

1. `pulse-aidd sonder <adresse>/sitemap.xml --texte "<urlset"` (ou `"<sitemapindex"`) : le sitemap est servi. Lire quelques adresses : elles portent **le domaine définitif** (ni adresse de prévisualisation, ni exemple recopié). Sitemap absent ou faux : proposer `/pulse:seo bases`, puis revenir ici.
2. `pulse-aidd sonder <adresse>/robots.txt --texte "Sitemap:"` : la ligne `Sitemap: https://…/sitemap.xml` est présente ; sinon proposer de l'ajouter.
3. La personne déclare le sitemap dans Search Console (Sitemaps → adresse → Envoyer). Statut attendu : « Réussi » (parfois après quelques heures). Une déclaration reste une indication pour Google, pas un ordre ; le nombre d'adresses « découvertes » ne dit pas combien sont indexées.

## 1e. Bing

1. Proposer l'import dans Bing Webmaster Tools (deux minutes, juste après la vérification Google) : bing.com/webmasters → connexion → Mes sites → importer depuis Google Search Console. Les sites importés sont vérifiés d'office, leurs sitemaps repris. Sans import : balise meta `msvalidate.01`, fichier `BingSiteAuth.xml` ou DNS.
2. Signaler le rapport **AI Performance** (aperçu public depuis le 2026-02-10) : nombre de citations du site dans Microsoft Copilot et les résumés IA de Bing, pages citées, requêtes d'ancrage ; ni clics ni classement. À regarder dans l'interface.
3. **IndexNow** (facultatif, si le pack de pile le propose) : un envoi qui prévient Bing, Yandex, Seznam, Naver, Yep, Internet Archive et Amazonbot qu'une page a changé ; Google n'y participe pas. La clé est publique par conception (fichier `<clé>.txt` servi par le site). L'envoi se fait **après** la mise en ligne prouvée par `pulse-aidd sonder`. Réponse 422 : hôte ou clé incorrects (une erreur de configuration à corriger) ; 429 : trop d'envois.

## 1f. Accès aux données pour Pulse (facultatif)

Présenter les trois réponses (AskUserQuestion) :

- « Un fichier exporté de Search Console, quand vous voulez un rapport (Recommandé pour commencer) » : aucun secret, rien à installer ;
- « Connexion Google en lecture seule » : rapport sans export manuel, avec sitemap et inspection ; demande une configuration d'environ 15 minutes dans la console Google Cloud ;
- « Plus tard ».

**Connexion choisie.** Les droits sont exactement ceux de la personne, en lecture seule ; aucun compte technique à ajouter dans Search Console, aucune clé privée. Ce que la personne fait, une fois, une étape à la fois (libellés à relire sur la documentation Google au moment de le faire) :

1. Console Google Cloud : créer un projet à elle ; activer « Google Search Console API ».
2. Google Auth Platform : configurer l'écran de consentement. Audience **Externe** (compte Gmail) ou **Interne** (compte Google Workspace : aucun avertissement, aucune limite). Ajouter son propre compte comme utilisateur de test.
3. Accès aux données : ajouter la seule portée `https://www.googleapis.com/auth/webmasters.readonly`.
4. Clients → créer un client de type **Application de bureau** → télécharger le JSON (`client_secret_….json`).
5. Publier l'application (**En production**). Demander **le chemin** du fichier téléchargé, jamais son contenu, puis lancer `pulse-aidd search-console connecter --client <chemin>`. Le navigateur s'ouvre sur l'écran Google ; la personne choisit son compte et clique « Autoriser ». L'accès va directement du script à son dossier de configuration, hors du projet.
6. `pulse-aidd search-console proprietes` montre les propriétés visibles. Le fichier téléchargé peut ensuite être supprimé : il n'est plus utile.

Pourquoi publier : en statut « Testing » avec une audience Externe, Google limite l'accès durable à **7 jours** (developers.google.com/identity/protocols/oauth2, màj 2026-05-26) ; il faudrait se reconnecter chaque semaine. Une application à usage personnel (moins de 100 utilisateurs) est dispensée de vérification (support.google.com/cloud/answer/13464323). ⚠️ à vérifier : le classement de `webmasters.readonly` (sensible ou non) n'est publié dans aucune documentation officielle consultée ; si la console la classe « sensible », l'écran « Google n'a pas validé cette application » apparaît à la connexion. C'est l'application de la personne elle-même : elle peut continuer (« Paramètres avancés » → « Accéder à … »). La console affiche la catégorie de la portée à l'étape 3.

Où va l'accès, combien de temps il dure, comment le retirer : « Connexion enregistrée » de `pulse-aidd reference search-console/search-console.md`.

**Pour aller plus loin : compte de service** (automatisation seulement, par exemple un rapport mensuel en CI) :
- seulement si l'organisation Google Cloud autorise les clés de compte de service (bloquées par défaut dans les organisations créées depuis le 2024-05-03) ;
- ajouté dans Search Console comme utilisateur **restreint** (ou complet si l'inspection l'exige), jamais propriétaire ;
- la clé va dans un secret de la CI, désignée par la variable `PULSE_GSC_COMPTE_SERVICE` (chemin du fichier) ; renouvelée chaque année.

## 1g. Noter

Écrire ou compléter la section « Référencement » de `docs/technical.md` : propriété, méthode de vérification et emplacement de la balise, date, sitemap, Bing, mode d'accès choisi, dossier des rapports. Proposer `/pulse:memory retenir "balise de vérification Google à garder dans <fichier>"` si une balise a été posée.

Clore avec le calendrier : premières données dans 2 à 3 jours, premier vrai rapport dans 28 jours (`/pulse:search-console lire`).

## Sources (consultées le 2026-10-07)

- Aide Search Console : vérification (answer/9008080), propriétés (answer/34592), droits (answer/7687615).
- OAuth 2.0 Google (màj 2026-05-26) ; applications natives (màj 2026-09-14) ; exceptions à la vérification (support.google.com/cloud/answer/13464323) ; applications non vérifiées (answer/7454865).
- Bing : vérification et import (bing.com/webmasters/help), blog Bing Webmaster (2026-02-10) ; indexnow.org/documentation.
