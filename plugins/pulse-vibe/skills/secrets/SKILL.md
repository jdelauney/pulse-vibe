---
description: Les secrets du projet - inventaire sans aucune valeur, renouvellement sans coupure, réaction à une fuite de clé (révoquer d'abord) ; la valeur ne passe jamais par la conversation
argument-hint: "[inventaire | renouveler <NOM> | fuite [<NOM>]] (par défaut : inventaire)"
disable-model-invocation: true
allowed-tools: Bash(pulse-aidd contexte secrets) Bash(pulse-aidd reference secrets/*) Bash(pulse-aidd reference fichiers-projet.md) Bash(pulse-aidd reference cycle.md) Bash(pulse-aidd modele *) Bash(pulse-aidd secrets inventaire*) Bash(pulse-aidd secrets preparer *) Bash(pulse-aidd secrets verifier *) Bash(pulse-aidd secrets historique*) Bash(pulse-aidd secrets journal *) Bash(pulse-aidd pile secrets fiche *) Bash(pulse-aidd sonder *) Bash(pulse-aidd verifier) Bash(git status *) Bash(git log *) Bash(git ls-files *) Bash(git check-ignore *) Bash(git remote -v) Bash(git remote get-url *)
---

# /pulse:secrets – Les secrets du projet

## Contexte Pulse (chargé automatiquement)

!`pulse-aidd contexte secrets`

Appliquer les « Règles communes Pulse » ci-dessus pendant toute la commande. Les références et modèles cités plus bas figurent ci-dessus. Si ce contexte est absent, lancer `pulse-aidd contexte secrets` et lire sa sortie.

Action demandée : `$ARGUMENTS` (vide = `inventaire`)

## Principe

Un secret (clé d'API, mot de passe, adresse de base de données avec son mot de passe, clé de signature) permet d'agir à la place de la personne. Trois règles tiennent toute la commande :

1. **La valeur reste hors de la conversation.** Elle va du fournisseur au fichier `.env` par les mains de la personne, puis du fichier à l'hébergeur par `pulse-aidd secrets envoyer`. Vous travaillez avec les noms. Les gestes exacts : « Garder la valeur d'un secret hors de la conversation » ci-dessus.
2. **Deux ordres à retenir.** Renouvellement planifié : la nouvelle serrure d'abord, l'ancienne ensuite. Fuite : l'ancienne serrure condamnée tout de suite.
3. **Une variable modifiée sert au déploiement suivant.** Après chaque envoi vers l'hébergeur : redéployer, puis vérifier en production.

Les détails propres à chaque variable (page exacte du fournisseur, effet, délai de grâce, préfixe attendu, test) viennent de la fiche du pack de pile, sous « Pack de pile » ci-dessus, ou de `pulse-aidd pile secrets fiche <NOM>`. Sans pack : « Secrets et variables d'environnement » de `docs/technical.md` et la documentation officielle du fournisseur (règle 15), dont vous tirez chaque libellé et chaque menu.

`generer`, `envoyer`, `elaguer` et `redeployer` modifient une valeur ou la production : Claude Code demande l'accord de la personne. Avant, dites en une phrase ce qu'elle va autoriser.

## Choisir l'action

| Action | Quand |
|---|---|
| `fuite [<NOM>]` (**prioritaire**) | Une clé a été vue ailleurs que dans `.env` : dépôt, conversation avec l'IA, écran, capture, e-mail, alerte de GitHub ou d'un fournisseur. Aussi pour « j'ai collé ma clé dans le chat », « GitHub m'a envoyé une alerte » |
| `renouveler <NOM>` | Rotation planifiée : départ d'une personne, fin de mission d'un prestataire, revue annuelle, clé montrée par erreur sans exposition publique |
| `inventaire` (par défaut) | À tout moment ; avant une mise en ligne ; proposé par `/pulse:deploy` et `/pulse:security` |

Une demande ambiguë qui évoque une exposition va vers `fuite`. En cas de doute entre `renouveler` et `fuite`, posez la question des lieux d'exposition (tableau de la référence « Réagir à une fuite de clé ») et traitez comme une fuite au moindre doute.

## inventaire

1. Lancer `pulse-aidd secrets inventaire`. Le script lit les noms dans `.env.example`, `.env`, le code (pack) et chez l'hébergeur (pack), sans aucune valeur.
2. Présenter le tableau tel quel, puis les points d'attention, du plus grave au moins grave, chacun avec sa correction en une ligne :
   - ⛔ `.env` suivi par Git ou non ignoré → corriger `.gitignore`, puis `pulse-aidd secrets historique` et, si une valeur est partie, `fuite` ;
   - ⛔ secret en type Config chez l'hébergeur → le recréer en type Secret (la personne le fait dans les réglages de l'hébergeur ; un Secret ne se relit pas) ;
   - ⚠️ règle `deny` absente → proposer d'ajouter à `.claude/settings.json` : `"permissions": { "deny": ["Read(./.env)", "Read(./.env.local)", "Read(./.env.*.local)", "Read(./.env.envoi)"] }` (proposer en une phrase, « Cette règle empêche l'IA de lire vos clés », le bloc sur demande seulement ; écrire après accord ; `.env.example` reste lisible, car les recettes y ajoutent des noms) ;
   - ⚠️ variable à remplir → `pulse-aidd secrets preparer <NOM>` puis la saisie par la personne ;
   - ❓ même nom en Production et Preview → demander si les valeurs diffèrent ; pour un secret généré, proposer `renouveler` avec une valeur par environnement.
3. Écrire ou mettre à jour `docs/secrets.md` (modèle « docs/secrets.md ») : l'inventaire avec le rôle de chaque variable, le fournisseur et la page où la renouveler (fiche du pack), les variables liées. Les noms et les dates seulement. Demander avant de remplacer un fichier existant ; le journal des rotations se garde.
4. Proposer `pulse-aidd secrets historique` si aucun contrôle de l'historique n'a été fait : une clé passée un jour dans Git reste lisible dans l'historique.

## renouveler <NOM>

Objectif : aucune coupure. L'ancienne valeur reste valide jusqu'à la preuve que la nouvelle marche en production.

1. **Lire la fiche** de la variable : effet du renouvellement, délai de grâce, valeur montrée une seule fois, variables liées, test. Résumer en trois lignes à la personne. Si le fournisseur n'a pas de délai de grâce (la fiche le dit), annoncer la coupure courte et proposer une heure creuse ; préparer tout avant (page de l'hébergeur ouverte, commandes prêtes), puis enchaîner sans pause.
2. **Créer la nouvelle valeur à côté de l'ancienne** :
   - secret du fournisseur : la personne crée la nouvelle clé en gardant l'ancienne active (délai de grâce, deuxième clé, nouvel identifiant), d'après le chemin exact de la fiche ; si la valeur n'est montrée qu'une fois, elle garde l'onglet ouvert jusqu'à l'étape 3 ;
   - secret inventé par le projet : `pulse-aidd secrets generer <NOM>` ; avec une forme versionnée prévue par la fiche (`--versionne`), l'ancienne valeur reste lisible pendant la transition.
3. **Saisie** : `pulse-aidd secrets preparer <NOM>` (ou `--fichier .env.envoi` pour une valeur propre à la production), saisie par la personne dans son éditeur, onglet fermé, puis `pulse-aidd secrets verifier <NOM>` (même `--fichier`). Un ❌ se corrige avant d'aller plus loin. Les variables liées suivent le même chemin, ensemble.
4. **Envoyer** vers l'hébergeur : `pulse-aidd secrets envoyer <NOM> --env production,preview` (avec `--depuis .env.envoi --vider` pour une valeur propre à la production). Secret généré : une valeur par environnement, avec `pulse-aidd secrets generer <NOM> --envoyer production,preview`. Un envoi incomplet arrête la rotation : on relance avant toute révocation.
5. **Redéployer** : `pulse-aidd secrets redeployer --env production` (et `preview` si la fiche le conseille). Expliquer : « Le site en ligne garde l'ancienne valeur tant qu'il n'est pas reconstruit. »
6. **Vérifier en production** : `pulse-aidd sonder <adresse du site>` (section « Adresses » de `CLAUDE.md`), puis le test fonctionnel de la fiche, fait par la personne (se connecter, un paiement de test, un e-mail, un dépôt de fichier). Demander le résultat (AskUserQuestion : « Ça marche ✅ » / « Ça ne marche pas ❌ » / « Je ne sais pas comment tester »). Un ❌ : l'ancienne valeur est toujours active, rien n'est cassé ; chercher la cause avant d'aller plus loin.
7. **Révoquer l'ancienne valeur**, seulement après le ✅ de l'étape 6 : chemin exact de la fiche (ou laisser expirer le délai de grâce choisi). Forme versionnée : retirer l'ancienne version au moment indiqué par la fiche (`pulse-aidd secrets elaguer <NOM>`, envoi, redéploiement).
8. **Journal** : `pulse-aidd secrets journal <NOM> <raison> --revoquee <AAAA-MM-JJ> --production oui` ; compléter `docs/secrets.md` si la variable y manque.

## fuite [<NOM>]

Appliquer la référence « Réagir à une fuite de clé » ci-dessus, étape par étape, dans son ordre. Points propres à la commande :

- **Premier message** : court, calme, avec l'action n° 1. Exemple : « On s'en occupe tout de suite. Première chose : rendre l'ancienne clé inutilisable chez le fournisseur. Je vous guide. » Puis une seule question : quelle clé (menu tiré de l'inventaire, avec « Je ne sais pas laquelle »).
- **Quelle clé ?** Si la personne ne sait pas : `pulse-aidd secrets historique` (traces dans Git) et la question des lieux d'exposition. Une clé collée dans cette conversation se reconnaît à son fournisseur, sans la répéter.
- **Révoquer** : chemin exact de la fiche, réglage immédiat. Attendre la confirmation de la personne (« C'est fait ») avant de passer au remplacement.
- **Remplacer, redéployer, vérifier** : étapes 3 à 6 de `renouveler`, sans délai de grâce. Secret inventé par le projet après une fuite : `pulse-aidd secrets generer <NOM>` sans `--versionne` (ou avec `--seul`) : l'ancienne valeur ne doit plus rien ouvrir.
- **Couper ce qui reste ouvert** : action de la fiche (sessions, redémarrage de la base).
- **Journal d'incident** : `docs/incidents/<AAAA-MM-JJ>-<sujet>.md` à partir du modèle « journal d'incident », sans aucune valeur ; puis `pulse-aidd secrets journal <NOM> fuite --revoquee <AAAA-MM-JJ> --production oui`.
- Terminer par la prévention : la cause en une phrase, les protections manquantes de l'inventaire, et `/pulse:security` si aucun audit récent n'existe.

## Lexique

Termes à expliquer selon le profil, puis à ajouter au lexique : *secret*, *révoquer*, *rotation*, *délai de grâce*, *redéployer*, *variable Secret / Config*, *variable d'environnement*.

Terminer avec le bloc de fin de commande. Prochaine étape : après `inventaire`, la correction du point le plus grave (ou `/pulse:deploy`) ; après `renouveler` ou `fuite`, `/pulse:commit` pour enregistrer `docs/secrets.md` (et le journal d'incident).
