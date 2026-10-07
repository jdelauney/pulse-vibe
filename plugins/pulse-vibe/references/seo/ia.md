# Référencement : les assistants IA (`/pulse:seo ia`)

Faits vérifiés le 2026-10-07 sur les pages des éditeurs. Chaque conseil donné à la personne porte son niveau de preuve, en clair : « Google l'écrit », « une étude l'a mesuré », « c'est du bon sens, non prouvé ».

## 1. Ce qui est sûr

- **Pour Google, être visible dans les réponses IA, c'est le référencement classique.** « There are no additional requirements to appear in AI Overviews or AI Mode » ; aucun fichier ni balisage spécial n'est nécessaire (appearance/ai-features, 2025-12-10 ; guide « Optimizing for generative AI search », 2026-07-10). Une page doit être indexée et éligible à un extrait.
- **Google-Extended ne règle pas AI Overviews.** C'est un jeton robots.txt qui règle l'entraînement de Gemini et l'ancrage dans l'application Gemini et Vertex AI, sans effet sur la recherche Google (google-common-crawlers, 2026-07-14). AI Overviews et AI Mode passent par Googlebot ; s'en exclure passe par Search Console (réglage des fonctions d'IA générative) ou par `nosnippet`, qui retire aussi l'extrait classique.
- **ChatGPT search** dépend d'`OAI-SearchBot` ; `GPTBot` sert à l'entraînement ; `ChatGPT-User` vient à la demande d'une personne et robots.txt peut ne pas s'appliquer (developers.openai.com/api/docs/bots).
- **La plupart des robots IA lisent le HTML sans exécuter JavaScript** (constat répandu, non déclaré par les éditeurs) : une page construite dans le navigateur leur reste vide. Le contrôle IA5 le vérifie.
- **Personne ne sait garantir une citation par une IA.** Ce qui est sûr : être trouvable par Google et Bing, lisible sans JavaScript, avec les informations essentielles écrites clairement.

## 2. Trois familles de robots

Les dire toujours avec leur nom de famille :
- **ceux qui apprennent** (entraînement) : GPTBot, ClaudeBot, Meta-ExternalAgent, CCBot ; jetons Google-Extended et Applebot-Extended ;
- **ceux qui cherchent** (index des réponses) : OAI-SearchBot, Claude-SearchBot, PerplexityBot, Meta-WebIndexer, Amzn-SearchBot ; et les moteurs classiques Googlebot, Bingbot, Applebot ;
- **ceux qui viennent pour quelqu'un** (à la demande) : ChatGPT-User, Claude-User, Perplexity-User, Meta-ExternalFetcher, Amzn-User. Image : un coursier envoyé par un client.

La liste complète, avec l'éditeur, le rôle, ce que l'éditeur déclare sur robots.txt et la source : `pulse-aidd reference seo/robots-ia.json` (source unique, lue aussi par le script).

Règle de robots.txt à connaître : un robot suit **seulement** le groupe le plus précis qui le nomme (RFC 9309). Un groupe `User-agent: GPTBot` avec `Allow: /` lui fait oublier les `Disallow` du groupe `*` (contrôle IA2). Les robots bloqués reçoivent donc un groupe `Disallow: /`.

## 3. La décision : la politique des robots

Présenter les quatre choix **sans en recommander un** (AskUserQuestion, une question, quatre réponses), avec leurs conséquences honnêtes. Signaler B en le disant : « (le plus courant pour un site vitrine) ». La personne décide. Si une politique existe déjà dans `docs/seo.md`, l'afficher d'abord avec sa date.

| Choix | Effet | Ce que la personne gagne | Ce qu'elle doit savoir |
|---|---|---|---|
| **A. Visible partout, entraînement accepté** | robots.txt ouvert | simplicité ; aucune porte fermée | les pages peuvent servir à entraîner des modèles |
| **B. Visible dans les réponses IA, sans entraînement** (le plus courant pour un site vitrine) | bloque ceux qui apprennent ; laisse ceux qui cherchent et les moteurs ; Amazonbot reste ouvert (il sert aussi Alexa), sauf demande de la personne | présence dans ChatGPT search, Claude, Perplexity, Copilot, AI Overviews | bloquer Google-Extended retire aussi l'ancrage dans l'application Gemini ; vaut pour l'avenir, pas pour ce qui a déjà été collecté ; seuls les robots honnêtes obéissent |
| **C. Hors des réponses IA** | B, plus les robots de recherche IA et ceux qui viennent à la demande ; pour Google : réglage Search Console « Exclure », fait par la personne | contenu non repris dans les réponses | perte des visites venues des IA ; un robot à la demande peut encore lire une page collée par un utilisateur ; une IA peut encore parler de vous d'après d'autres sites |
| **D. Site privé ou outil interne** | `noindex` partout, robots.txt fermé, pages derrière la connexion | rien n'est indexé | la vraie protection est la connexion (`/pulse:security`), pas robots.txt |

Options, à proposer seulement si la personne s'y intéresse :
- **Content-Signal** (`Content-Signal: search=yes, ai-input=yes, ai-train=no`) : une préférence déclarée dans robots.txt (proposée par Cloudflare, 2025-09-24), pas une protection.
- **Amazonbot bloqué** en B : ligne `amazonbot: bloqué` du bloc `pulse-seo`.
- **`nosnippet`** : retire la page des extraits **et** des réponses IA de Google. À noter comme décision (`nosnippet: oui`), sinon le contrôle IA7 le signale.
- **llms.txt** : utile seulement pour un site de documentation lu par des assistants de code ; Google ne l'utilise pas, et une étude (Ahrefs, juin 2026) l'a trouvé rarement lu. Jamais présenté comme un levier de visibilité.

## 4. Appliquer

1. Écrire la décision dans `docs/seo.md` : section « Assistants IA » (choix, date, raison donnée par la personne) et ligne `politique-ia: <A|B|C|D>` du bloc `pulse-seo` (lue par le script).
2. Écrire robots.txt :
   - avec un pack : ses consignes (« Pack de pile ») ;
   - sans pack : `pulse-aidd seo robots <A|B|C|D> --sitemap <adresse complète du sitemap> [--fermes /api/] [--signal "search=yes, ai-input=yes, ai-train=no"] [--bloquer-amazonbot]` affiche le texte de robots.txt pour cette politique ; le placer là où la pile sert robots.txt (documentation officielle).
   Montrer robots.txt à la personne avant de l'écrire.
3. C : guider le réglage Search Console (référence « lancement », § 5). D : `noindex` sur toutes les pages, en plus de la connexion.
4. **Preuve** : construire, servir, puis `pulse-aidd seo <adresse> --ia` : IA1 vert (robots.txt conforme), IA4 vert (le serveur répond aux robots autorisés).

## 5. Les contrôles IA du script

IA1 robots.txt conforme à la politique · IA2 groupe nommé qui rouvre des chemins fermés · IA3 jetons périmés ou sans effet · IA4 le serveur (ou un pare-feu) refuse un robot autorisé · IA5 texte lisible sans JavaScript · IA6 métadonnées dans `<head>` · IA7 `nosnippet` non décidé · IA8 refus d'entraînement incomplet · IA9 Content-Signal · IA10 llms.txt mal formé (s'il existe) · IA11 faits clés absents du texte · IA12 données structurées absentes du texte visible.

IA4 imite un robot sans venir de ses adresses : un vrai robot peut être traité autrement par un pare-feu. Le dire avec le résultat.

## 6. Mesurer

- Bing Webmaster Tools → AI Performance (citations dans Copilot, depuis février 2026) ; Search Console → impressions dans les fonctions d'IA générative.
- Statistiques du site : `utm_source=chatgpt.com` (ChatGPT) ; référents `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, `claude.ai`.
- Test manuel à 1 et 3 mois (référence « lancement », § 6). Les outils payants de suivi posent des questions en série : leurs chiffres varient beaucoup.
- Les assistants ne s'interrogent pas par script : la personne pose ses questions elle-même.

## 7. Le droit (information générale, pas un avis)

- **Union européenne** : la fouille de textes et de données est permise sauf réserve « par des procédés lisibles par machine » (directive 2019/790, art. 4(3)). Le tribunal régional supérieur de Hambourg (10 décembre 2025, 5 U 104/24) a jugé qu'une phrase dans des conditions d'utilisation ne suffit pas : robots.txt, lui, est lisible par machine. Le code de bonnes pratiques des modèles d'IA à usage général (11 juillet 2025) engage ses signataires à respecter robots.txt.
- **Suisse** : pas d'équivalent à ce jour ; un projet est en préparation. Une réserve dans robots.txt vaut pour les fournisseurs soumis au droit européen.
- À retenir : refuser l'entraînement s'écrit dans robots.txt, pas dans les mentions légales ; cela vaut pour l'avenir.

## 8. Les croyances à corriger

| Croyance | Ce qu'il faut faire |
|---|---|
| « Il faut un llms.txt pour être cité » | Soigner les bases du référencement ; réserver llms.txt aux sites de documentation |
| « llms.txt dit aux IA ce qu'elles ont le droit de faire » | Exprimer les permissions dans robots.txt |
| « Bloquer Google-Extended retire d'AI Overviews » | Pour AI Overviews et AI Mode : réglage Search Console ou `nosnippet` |
| « Bloquer GPTBot fait disparaître de ChatGPT » | GPTBot = entraînement ; la présence dans ChatGPT search dépend d'OAI-SearchBot |
| « Autoriser ChatGPT-User fait apparaître dans ChatGPT » | Laisser OAI-SearchBot ouvert ; ChatGPT-User vient à la demande |
| « FAQPage ou JSON-LD font citer par les IA » | Poser les données structurées pour les résultats enrichis encore actifs, conformes au contenu visible (Ahrefs, mai 2026 : pas de hausse mesurée des citations) |
| « Écrire 30 % de titres en questions » | Écrire des titres clairs ; une question quand c'est celle du client |
| « Des chiffres et des citations = +40 % » | Donner des faits exacts et sourcés parce qu'ils aident le lecteur (effet mesuré sur un banc simulé en 2024, contredit en 2025) |
| « Un outil GEO mesure ma visibilité IA » | Lire Bing AI Performance et Search Console |
| « Une phrase dans les mentions légales refuse l'entraînement » | L'écrire dans robots.txt (lisible par machine) |
| « robots.txt protège mes contenus » | Protéger un contenu privé par la connexion ; robots.txt est une demande publique |
| « IndexNow fait apparaître dans ChatGPT » | IndexNow accélère Bing et ses partenaires ; aucun lien documenté avec ChatGPT |

## 9. Délais

robots.txt est relu en environ 24 heures (OpenAI, Meta) et jusqu'à 30 jours (Amazon) ; le réglage de Google se traite en quelques jours. Un agent qui s'annonce GPTBot n'est pas forcément OpenAI : les éditeurs publient la liste de leurs adresses IP.
