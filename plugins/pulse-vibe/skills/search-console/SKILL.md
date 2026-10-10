---
description: Relier le site à Google Search Console (et Bing), puis lire ce que Google voit vraiment, en lecture seule — chiffres, requêtes à potentiel, pages oubliées, indexation — et suivre l'évolution tous les 28 jours
argument-hint: "[relier | lire [28j|3m] | suivre | inspecter <adresse>] (détecté si vide)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte *) Bash(pulse-aidd reference *) Bash(pulse-aidd modele *) Bash(pulse-aidd pile recette *) Bash(pulse-aidd pile reference *) Bash(pulse-aidd sonder *) Bash(pulse-aidd search-console lire*) Bash(pulse-aidd search-console suivre*) Bash(pulse-aidd search-console inspecter *) Bash(pulse-aidd search-console proprietes*) Bash(pulse-aidd search-console connecter *) Bash(git status *) Bash(git log *) Bash(pulse-aidd travail-fini) Write(aidd_docs/tasks/in-progress.md) Edit(aidd_docs/tasks/in-progress.md)
---

# /pulse:search-console – Ce que Google voit de votre site

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte search-console`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus (« Search Console : relier, lire, suivre », modèle du rapport, et les consignes du pack de pile s'il y en a un). Si ce contexte est absent, lancer `pulse-aidd contexte search-console`, puis `pulse-aidd reference search-console.md`, et lire leur sortie.

Action demandée (facultative) : `$ARGUMENTS`

## Objectif

Donner à la personne le tableau de bord que Google lui tend, en trois temps : **relier** le site (une fois), **lire** ce que Google en voit, **suivre** l'évolution tous les 28 jours. Tout se fait en lecture seule, avec les droits de la personne. L'analogie à donner au début : « Search Console, c'est le tableau de bord que Google vous tend : ce qu'il a trouvé sur votre site, et ce que les gens ont tapé pour vous trouver. »

## 0. Prérequis et choix de l'action

1. Le site est en ligne : ligne « Site en ligne » de `docs/technical.md` (ou section « Adresses » de `CLAUDE.md`). Absente ou « pas encore en ligne » : proposer `/pulse:deploy`, et s'arrêter.
2. L'adresse est la **définitive** (le domaine que verront les clients). Un changement de domaine prévu bientôt : proposer de relier après ce changement, pour éviter de recommencer.
3. Sans argument, choisir l'action :
   - section « Référencement » absente de `docs/technical.md`, ou Search Console notée « à relier » → `relier` ;
   - aucun rapport dans `docs/referencement/` → `lire` ;
   - dernier rapport de 28 jours ou plus → `suivre` ;
   - dernier rapport plus récent → dire la date du prochain rapport conseillé (écrite à la fin du dernier rapport), puis proposer (AskUserQuestion) : « Inspecter une page », « Relire quand même (Recommandé si vous venez de corriger quelque chose) », « Rien pour l'instant ».

Annoncer le calendrier dès la première utilisation (référence, § 1).

## 1. `relier` – une étape à la fois

Relire d'abord la section « Référencement » de `docs/technical.md` : chaque étape déjà notée comme faite se saute (« déjà fait le … »).

### 1a. Choisir le type de propriété

- Adresse sur un sous-domaine d'hébergeur (`*.vercel.app`, `*.netlify.app`…) → **préfixe d'URL** (`https://<adresse>/`) vérifié par **balise meta** (1b).
- Domaine personnel → **propriété de domaine** vérifiée par **DNS** (1c). Où est géré le DNS : chez l'hébergeur (consignes du pack de pile, s'il y en a un) ou chez le registraire (OVH, Gandi, IONOS…) ? Demander à la personne si `docs/technical.md` ne le dit pas.
- Personne bloquée sur le DNS → repli sur le préfixe d'URL avec balise meta (1b), en expliquant que la propriété ne couvrira que cette adresse exacte.

La personne ouvre Search Console (search.google.com/search-console) avec **son** compte Google, choisit « Ajouter une propriété » et le type retenu. Les libellés de l'interface changent souvent : guider d'après ce qu'elle voit à l'écran et d'après l'aide officielle (règle 15).

### 1b. Balise meta (préfixe d'URL)

1. La personne copie **le contenu** de la balise que montre Search Console et le colle ici. Le dire : ce code est public, il s'écrit dans le code du site.
2. L'écrire à l'endroit indiqué par le pack de pile ; sans pack, dans le `<head>` de la page d'accueil, d'après la documentation officielle de la technologie retenue.
3. Enregistrer et mettre en ligne : `/pulse:commit`, puis l'envoi (`/pulse:deploy`, mise à jour). Prouver que la balise est servie : `pulse-aidd sonder <adresse> --texte "google-site-verification"`.
4. Seulement alors, la personne clique « Vérifier ». Expliquer que la balise reste en place pour toujours (sinon la propriété se perd).

### 1c. Enregistrement DNS (domaine)

1. La personne copie la valeur TXT que montre Search Console (elle n'est pas secrète).
2. DNS chez l'hébergeur : suivre les consignes du pack de pile (tableau de bord, ou commande de l'hébergeur avec l'accord de la personne). DNS chez le registraire : guider pas à pas d'après sa documentation officielle.
3. La propagation peut prendre jusqu'à 24 heures. Si « Vérifier » échoue, noter l'étape dans `aidd_docs/tasks/in-progress.md` (règle commune 16 ; effacé avec `pulse-aidd travail-fini` une fois la propriété vérifiée) et proposer de reprendre plus tard avec `/pulse:search-console relier`.

### 1d. Sitemap

1. `pulse-aidd sonder <adresse>/sitemap.xml --texte "<urlset"` (ou `"<sitemapindex"`) : le sitemap est servi. Lire quelques adresses : elles portent **le domaine définitif**. Sitemap absent ou faux : proposer `/pulse:seo bases`, puis revenir ici.
2. `pulse-aidd sonder <adresse>/robots.txt --texte "Sitemap:"` : la ligne `Sitemap:` est présente ; sinon proposer de l'ajouter.
3. La personne déclare le sitemap dans Search Console (Sitemaps → adresse → Envoyer). Statut attendu : « Réussi » (parfois après quelques heures).

### 1e. Bing

Proposer l'import dans Bing Webmaster Tools (deux minutes) : bing.com/webmasters → connexion → importer depuis Google Search Console. Signaler le rapport « AI Performance » (citations dans Copilot). Si le pack de pile propose IndexNow, le présenter comme facultatif.

### 1f. Accès aux données pour Pulse (facultatif)

Présenter les deux façons (AskUserQuestion) :

- « Un fichier exporté de Search Console, quand vous voulez un rapport (Recommandé pour commencer) » : aucun secret, rien à installer ;
- « Connexion Google en lecture seule » : rapport sans export manuel, avec sitemap et inspection ; demande une configuration d'environ 15 minutes dans la console Google Cloud ;
- « Plus tard ».

Connexion choisie : guider la procédure de la référence (§ 4.2), une étape à la fois. Demander **le chemin** du fichier `client_secret_….json` téléchargé, jamais son contenu, puis lancer `pulse-aidd search-console connecter --client <chemin>`. La personne clique « Autoriser » dans son navigateur ; l'accès va directement du script à son dossier de configuration, hors du projet. Ensuite, `pulse-aidd search-console proprietes` montre les propriétés visibles. Pour retirer l'accès plus tard : `pulse-aidd search-console deconnecter` (Claude Code demande l'autorisation, car le fichier est supprimé).

### 1g. Noter

Écrire ou compléter la section « Référencement » de `docs/technical.md` : propriété, méthode de vérification et emplacement de la balise, date, sitemap, Bing, mode d'accès choisi, dossier des rapports. Proposer `/pulse:memory retenir "balise de vérification Google à garder dans <fichier>"` si une balise a été posée.

Clore avec le calendrier : premières données dans 2 à 3 jours, premier vrai rapport dans 28 jours (`/pulse:search-console lire`).

## 2. `lire [28j | 3m]`

1. Source des données :
   - connexion enregistrée → `pulse-aidd search-console lire --periode <28j|3m> --ecrire` ;
   - sinon, guider l'export (référence, § 4.1), demander le chemin de l'archive, puis `pulse-aidd search-console lire --fichier <chemin> --ecrire` ; proposer la connexion seulement si la personne veut éviter l'export à chaque fois.
2. Le script écrit `docs/referencement/search-console-<date>.md` et l'instantané `docs/referencement/donnees/<date>.json`. Un rapport du même jour existe déjà : demander avant de le remplacer.
3. Selon le code de sortie (tableau de la référence, § 4) : 6 → « pas encore de données, c'est normal », date de retour ; 2, 3, 4, 5 → expliquer simplement et proposer la suite indiquée.
4. Présenter le rapport : d'abord « En bref », puis les **3 actions prioritaires**. Relire chaque action avec le code réel (la page qui répond à la requête existe-t-elle ? son titre ?) ; la reformuler ou la remplacer si le code montre mieux, et mettre à jour le rapport. Chaque chiffre cité est suivi de son sens et de ce qu'il faut faire, ou de « rien à faire, c'est normal ».
5. Échantillon d'indexation : le présenter comme un échantillon, et renvoyer au rapport « Indexation des pages » de l'interface pour la vue complète.
6. Rappeler ce que l'API ne montre pas (référence, § 8 et 9) : rapport IA générative, réglage « Search generative AI » (décision de la personne, à relier à `/pulse:seo ia`), Bing AI Performance.
7. Première écriture dans `docs/referencement/donnees/` d'un dépôt public : proposer de l'ajouter au `.gitignore` (données personnelles possibles dans les requêtes).
8. Proposer d'enregistrer : `/pulse:commit`.

## 3. `suivre`

1. Connexion enregistrée : `pulse-aidd search-console suivre --ecrire` lit les 28 derniers jours et les 28 jours d'avant (mêmes jours de la semaine). Export : la personne exporte la nouvelle période, puis `pulse-aidd search-console suivre --fichier <chemin> --ecrire` compare au dernier instantané.
2. Relier les écarts aux changements du site : `git log --since=<début de la période précédente> --oneline`, les journaux des plans, et le journal du rapport précédent. Compléter la section « Journal des changements du site » du nouveau rapport (date, page, changement). Un écart sans changement connu : le dire simplement (saisonnalité, mise à jour de Google, concurrence), sans inventer de cause.
3. Proposer d'ajouter une **annotation** dans le graphique de Search Console pour chaque changement important (date et texte court, visible par tous les utilisateurs de la propriété).
4. Les 3 actions prioritaires, comme pour `lire`.

## 4. `inspecter <adresse>`

1. Adresse complète d'une page du site. Connexion absente : expliquer que l'inspection passe par la connexion en lecture seule (§ 1f), ou guider l'inspection dans l'interface (barre en haut de Search Console).
2. `pulse-aidd search-console inspecter <adresse>`, puis expliquer l'état (référence, § 6) : ce qu'il veut dire, et quoi faire.
3. Rappeler que c'est l'état de la version déjà indexée, et que la demande d'indexation se fait dans l'interface (Inspection de l'URL → Demander l'indexation), page par page.

## 5. Ce qui reste à la personne

- Se connecter à Google, ajouter la propriété, cliquer « Vérifier », déclarer le sitemap, importer dans Bing, régler « Search generative AI » : dans l'interface, avec son compte.
- Le contenu des fichiers d'identifiants va du téléchargement au script par son chemin ; la conversation reçoit seulement des chemins et des codes publics (balise, TXT).

## 6. Clore

Transformer les actions retenues en demandes (`/pulse:spirc "…"` ou `/pulse:seo textes <page>`). Une page qui change d'adresse reçoit une redirection permanente (301).

Terminer avec le bloc de fin de commande ; « Prochaine étape » donne la date du prochain rapport conseillé (`/pulse:search-console suivre`, dans 28 jours) ou la première action à réaliser.
