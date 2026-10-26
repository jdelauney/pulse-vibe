---
description: Les secrets du projet - inventaire sans aucune valeur, renouvellement sans coupure, réaction à une fuite de clé (révoquer d'abord) ; la valeur ne passe jamais par la conversation
argument-hint: "[inventaire | renouveler <NOM> | fuite [<NOM>]] (par défaut : inventaire)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte secrets) Bash(pulse-aidd reference secrets/*) Bash(pulse-aidd reference fichiers-projet.md) Bash(pulse-aidd reference cycle.md) Bash(pulse-aidd modele *) Bash(pulse-aidd secrets inventaire*) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd secrets verifier *) Bash(pulse-aidd secrets historique*) Bash(pulse-aidd secrets journal *) Bash(pulse-aidd pile secrets fiche *) Bash(pulse-aidd sonder *) Bash(pulse-aidd verifier) Bash(git status *) Bash(git log *) Bash(git ls-files *) Bash(git check-ignore *) Bash(git remote -v) Bash(git remote get-url *) Write(docs/secrets.md) Edit(docs/secrets.md) Write(docs/incidents/**) Edit(docs/incidents/**) Write(docs/lexique.md) Edit(docs/lexique.md) Bash(pulse-aidd reference gestes.md)
---

# /pulse:secrets – Les secrets du projet

## Objectif

Tenir l'inventaire des secrets du projet dans `docs/secrets.md`, sans aucune valeur ; les renouveler sans coupure ; réagir à une fuite de clé en la révoquant d'abord. La valeur d'un secret reste hors de la conversation.

## Règles

Appliquer les « Règles communes Pulse » (chargées en fin de fichier, dans « Références de la commande » ; absentes de la conversation : lancer `pulse-aidd contexte secrets` et lire sa sortie en entier, fichier enregistré compris) pendant toute la commande.

### Principe

Un secret (clé d'API, mot de passe, adresse de base de données avec son mot de passe, clé de signature) permet d'agir à la place de la personne. Trois règles tiennent toute la commande :

1. **La valeur reste hors de la conversation** : « Garder la valeur d'un secret hors de la conversation » (chargée en fin de fichier, dans « Références de la commande »).
2. **Deux ordres à retenir.** Renouvellement planifié : la nouvelle serrure d'abord, l'ancienne ensuite. Fuite : l'ancienne serrure condamnée tout de suite.
3. **Une variable modifiée sert au déploiement suivant.** Après chaque envoi vers l'hébergeur : redéployer, puis vérifier en production.

Le rôle, le fournisseur et la page de renouvellement de chaque variable viennent de l'index du pack de pile, sous « Pack de pile » dans « Références de la commande ». Les détails propres à une variable (page exacte du fournisseur, effet, délai de grâce, préfixe attendu, test) : `pulse-aidd pile secrets fiche <NOM>`, lancé à l'étape 1 de `renouveler` et au moment d'identifier la clé en `fuite`. Sans pack : « Secrets et variables d'environnement » de `docs/technical.md` et la documentation officielle du fournisseur (règle 15), dont vous tirez chaque libellé et chaque menu.

`generer`, `envoyer`, `elaguer` et `redeployer` modifient une valeur ou la production : Claude Code demande l'accord de la personne. Avant, dites en une phrase ce qu'elle va autoriser.

## Contexte

Action demandée : `$ARGUMENTS` (vide = `inventaire`)

### Choisir l'action

| Action | Quand |
|---|---|
| `fuite [<NOM>]` (**prioritaire**) | Une clé a été vue ailleurs que dans `.env` : dépôt, conversation avec l'IA, écran, capture, e-mail, alerte de GitHub ou d'un fournisseur. Aussi pour « j'ai collé ma clé dans le chat », « GitHub m'a envoyé une alerte » |
| `renouveler <NOM>` | Rotation planifiée : départ d'une personne, fin de mission d'un prestataire, revue annuelle, clé montrée par erreur sans exposition publique |
| `inventaire` (par défaut) | À tout moment ; avant une mise en ligne ; proposé par `/pulse:deploy` et `/pulse:security` |

Une demande ambiguë qui évoque une exposition va vers `fuite`. En cas de doute entre `renouveler` et `fuite`, posez la question des lieux d'exposition (tableau « Quand parler de fuite » de `pulse-aidd reference secrets/fuite.md`) et traitez comme une fuite au moindre doute.

## Processus

### inventaire

1. Lancer `pulse-aidd secrets inventaire`. Le script lit les noms dans `.env.example`, `.env`, le code (pack) et chez l'hébergeur (pack), sans aucune valeur.
2. Présenter le tableau tel quel, puis chaque alerte du script, du plus grave au moins grave, avec l'action qu'il indique. Une règle à ajouter (`deny`) se propose en une phrase (« Cette règle empêche l'IA de lire vos clés ») et s'écrit dans `.claude/settings.json` après accord, le bloc sur demande ; un secret en type Config, la personne le recrée en type Secret chez l'hébergeur ; une variable présente en Production et en Preview : demander si les valeurs diffèrent, et proposer `renouveler` pour un secret généré.
3. Écrire ou mettre à jour `docs/secrets.md` (modèle « docs/secrets.md ») : l'inventaire avec le rôle de chaque variable, le fournisseur et la page où la renouveler (index du pack), les variables liées. Les noms et les dates seulement. Demander avant de remplacer un fichier existant ; le journal des rotations se garde.
4. Proposer `pulse-aidd secrets historique` si aucun contrôle de l'historique n'a été fait : une clé passée un jour dans Git reste lisible dans l'historique.

### renouveler <NOM>

Objectif : aucune coupure. L'ancienne valeur reste valide jusqu'à la preuve que la nouvelle marche en production.

1. **Lire la fiche** de la variable (`pulse-aidd pile secrets fiche <NOM>`) : effet du renouvellement, délai de grâce, valeur montrée une seule fois, variables liées, test. Résumer en trois lignes à la personne. Si le fournisseur n'a pas de délai de grâce (la fiche le dit), annoncer la coupure courte et proposer une heure creuse ; préparer tout avant (page de l'hébergeur ouverte, commandes prêtes), puis enchaîner sans pause.
2. **Créer la nouvelle valeur à côté de l'ancienne** :
   - secret du fournisseur : la personne crée la nouvelle clé en gardant l'ancienne active (délai de grâce, deuxième clé, nouvel identifiant), d'après le chemin exact de la fiche ; si la valeur n'est montrée qu'une fois, elle garde l'onglet ouvert jusqu'à l'étape 3 ;
   - secret inventé par le projet : `pulse-aidd secrets generer <NOM>` ; avec une forme versionnée prévue par la fiche (`--versionne`), l'ancienne valeur reste lisible pendant la transition.
3. **Saisie** : `pulse-aidd secrets preparer <NOM>` (ou `--fichier .env.envoi` pour une valeur propre à la production), saisie par la personne dans son éditeur, onglet fermé, puis `pulse-aidd secrets verifier <NOM>` (même `--fichier`). Un ❌ se corrige avant d'aller plus loin. Les variables liées suivent le même chemin, ensemble.
4. **Envoyer** vers l'hébergeur : `pulse-aidd secrets envoyer <NOM> --env production,preview` (avec `--depuis .env.envoi --vider` pour une valeur propre à la production). Secret généré : une valeur par environnement, avec `pulse-aidd secrets generer <NOM> --envoyer production,preview`. Un envoi incomplet arrête la rotation : on relance avant toute révocation.
5. **Redéployer** : `pulse-aidd secrets redeployer --env production` (et `preview` si la fiche le conseille). Expliquer : « Le site en ligne garde l'ancienne valeur tant qu'il n'est pas reconstruit. »
6. **Vérifier en production** : `pulse-aidd sonder <adresse du site>` (section « Adresses » de `CLAUDE.md`), puis le test fonctionnel de la fiche, fait par la personne (se connecter, un paiement de test, un e-mail, un dépôt de fichier). Demander le résultat (AskUserQuestion : « Ça marche ✅ » / « Ça ne marche pas ❌ » / « Je ne sais pas comment tester »). Un ❌ : l'ancienne valeur est toujours active, rien n'est cassé ; chercher la cause avant d'aller plus loin.
7. **Révoquer l'ancienne valeur**, seulement après le ✅ de l'étape 6 : chemin exact de la fiche (ou laisser expirer le délai de grâce choisi). Forme versionnée : retirer l'ancienne version au moment indiqué par la fiche (`pulse-aidd secrets elaguer <NOM>`, envoi, redéploiement).
8. **Journal** : `pulse-aidd secrets journal <NOM> <raison> --revoquee <AAAA-MM-JJ> --production oui` ; compléter `docs/secrets.md` si la variable y manque.

### fuite [<NOM>]

Avant le premier message, lancer `pulse-aidd reference secrets/fuite.md`, puis l'appliquer étape par étape, dans son ordre : un premier message court et calme avec l'action n° 1, la clé révoquée d'abord. Au moment d'écrire le journal d'incident (étape 8 de la référence), partir du modèle `pulse-aidd modele secrets/incident.md`, sans aucune valeur.

### Lexique

Termes à expliquer selon le profil, puis à ajouter au lexique : *secret*, *révoquer*, *rotation*, *délai de grâce*, *redéployer*, *variable Secret / Config*, *variable d'environnement*.

Terminer avec le bloc de fin de commande. Prochaine étape : après `inventaire`, la correction du point le plus grave (ou `/pulse:deploy`) ; après `renouveler` ou `fuite`, `/pulse:commit` pour enregistrer `docs/secrets.md` (et le journal d'incident).

## Exemples

- `/pulse:secrets` : le tableau de vos clés, sans aucune valeur, et les points à corriger, du plus grave au moins grave.
- `/pulse:secrets renouveler STRIPE_SECRET_KEY` : la nouvelle clé est créée à côté de l'ancienne, envoyée en ligne et testée ; l'ancienne est coupée seulement après votre « Ça marche ».
- `/pulse:secrets fuite` après avoir collé une clé dans le chat : d'abord la rendre inutilisable chez le fournisseur, puis la remplacer, pas à pas.

## Références de la commande

!`pulse-aidd contexte secrets`

Ce contexte contient aussi « Garder la valeur d'un secret hors de la conversation », « Modèle : docs/secrets.md » et « Modèle : docs/lexique.md » ; la branche fuite lance `pulse-aidd reference secrets/fuite.md` et `pulse-aidd modele secrets/incident.md` à son premier geste. Si ce contexte est absent, lancer `pulse-aidd contexte secrets` et lire sa sortie en entier, fichier enregistré compris.
