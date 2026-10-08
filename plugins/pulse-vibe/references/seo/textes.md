# Référencement : les textes (`/pulse:seo textes`)

Les titres et descriptions sont **choisis par la personne**. Pulse prépare, propose, vérifie ; le code reprend ensuite les textes validés de `docs/seo.md`, qui en reste la source unique.

## 1. L'entretien, page par page

Une page à la fois (AskUserQuestion pour les choix, réponse libre pour les mots) :

1. **Qui arrive sur cette page, et que cherche-t-il ?** Partir de « Être trouvé » de `docs/prd.md` et des US de la page.
2. **Avec quels mots ?** Ceux que les clients emploient au téléphone ou par e-mail (« réparer une chaise », plutôt que « restauration de mobilier »). Noter 2 ou 3 expressions, validées par la personne.
3. **Quelle promesse ?** Ce que la page apporte, en une phrase.

Puis proposer **2 titres et 2 descriptions** (le premier « (Recommandé) »), la personne choisit, modifie ou écrit le sien.

## 2. Les règles d'un bon titre et d'une bonne description

- **Titre** : court et précis ; les mots des clients au début ; le nom du site une seule fois (le modèle de titre de la pile l'ajoute souvent tout seul) ; unique dans le site ; même langue que la page. Accueil : « Nom – promesse ».
- **Description** : une ou deux phrases propres à la page, avec une information utile pour décider (zone, délai, prix ou « sur devis », public) ; unique dans le site.
- Pas de répétition de mots-clés, pas de liste de villes : une phrase qu'un client lirait volontiers.
- Si une version trop longue risque d'être coupée à l'écran, garder l'essentiel au début ; aucune longueur n'est imposée.

Vérifier l'unicité dans le tableau des pages de `docs/seo.md` avant d'écrire.

## 3. Le contenu qui mérite d'être choisi

Poser ces questions à la personne, sans les noter (Google, « Creating helpful content », 2026-10-05) :
- **Qui** parle ? Un nom, un visage, une expérience réelle, des coordonnées visibles.
- **Comment** le contenu est-il fait ? Si l'IA a aidé, le dire simplement est une bonne pratique.
- **Pourquoi** existe-t-il ? D'abord pour aider un client, pas pour un moteur.
- Le texte apporte-t-il quelque chose qu'on ne trouve pas ailleurs (photos réelles, exemples, prix, délais, avis vrais) ?

Une page n'a pas de longueur cible : elle dit ce dont le lecteur a besoin pour décider.

## 4. Les faits clés

Ce qu'un client (ou un assistant IA) doit trouver écrit en clair, sur l'accueil ou la page « À propos » : **qui** (nom), **quoi** (activité), **où** (zone servie), **pour qui**, **combien** (prix ou « sur devis »), **comment joindre**.
- Les noter dans la section « Faits clés » de `docs/seo.md` et une ligne `fait: …` par fait dans le bloc `pulse-seo` : `pulse-aidd seo --ia` vérifie qu'ils apparaissent dans le texte des pages (contrôle IA11).
- Conseil d'écriture, présenté comme bon pour les **lecteurs** : une réponse claire au début de chaque page, des phrases qui se comprennent seules, des faits vérifiables. Aucune promesse de citation par une IA.

## 5. Les textes générés par l'IA

- Chaque texte proposé par Pulse est un **brouillon** : la personne le relit et vérifie chaque fait (prix, horaires, adresses, chiffres, noms) avant publication.
- Avant de montrer un texte proposé, le passer au contrôle des tics d'écriture IA : `pulse-aidd textes verifier -` (texte sur l'entrée standard) ; corriger les erreurs. Pour le texte complet d'une page : `/pulse:rediger`.
- Relire aussi ce qui ne se voit pas : titres, descriptions, textes alternatifs des images, données structurées.
- Publier peu de pages utiles plutôt que beaucoup de pages semblables (politique « scaled content abuse », 2026-08-28).
- Les avis et témoignages sont réels, avec l'accord de leur auteur ; jamais inventés.

## 6. Écrire

- Mettre à jour le tableau des pages de `docs/seo.md` : adresse, titre, description, indexée (oui ou non), image de partage, données structurées, US.
- Reporter les textes dans le code de la page (consignes de la pile), puis prouver par `pulse-aidd seo <adresse locale> --chemins <la page>` : titre et description présents, uniques.
