// Produit par outils/wiki/synchroniser.js depuis les SKILL.md du cœur : modifier les SKILL.md, puis relancer l'outil.
window.PULSE_WIKI = {
  "etapes": [
    {
      "id": "demarrer",
      "numero": 1,
      "nom": "Démarrer",
      "couleur": 1,
      "commandes": [
        "init",
        "express"
      ]
    },
    {
      "id": "decrire",
      "numero": 2,
      "nom": "Décrire",
      "couleur": 1,
      "commandes": [
        "brainstorm",
        "prd",
        "tech",
        "ui",
        "us"
      ]
    },
    {
      "id": "preparer",
      "numero": 3,
      "nom": "Préparer",
      "couleur": 2,
      "commandes": [
        "spec",
        "plan",
        "refine",
        "guide"
      ]
    },
    {
      "id": "construire",
      "numero": 4,
      "nom": "Construire",
      "couleur": 3,
      "commandes": [
        "implement",
        "spirc",
        "review",
        "test",
        "auto-fix",
        "commit",
        "pr"
      ]
    },
    {
      "id": "en-ligne",
      "numero": 5,
      "nom": "Mettre en ligne",
      "couleur": 4,
      "commandes": [
        "cicd",
        "deploy",
        "security",
        "secrets"
      ]
    },
    {
      "id": "visible",
      "numero": 6,
      "nom": "Être trouvé",
      "couleur": 4,
      "commandes": [
        "seo",
        "rediger",
        "perf",
        "search-console"
      ]
    },
    {
      "id": "toujours",
      "numero": 7,
      "nom": "À tout moment",
      "couleur": 0,
      "commandes": [
        "status",
        "explain",
        "learn",
        "fix",
        "annuler",
        "get-help",
        "memory"
      ]
    }
  ],
  "navigation": [
    {
      "titre": "Accueil",
      "href": "index.html"
    },
    {
      "titre": "Prérequis",
      "href": "prerequis.html"
    },
    {
      "titre": "Tutoriels",
      "href": "tutoriels/index.html"
    },
    {
      "titre": "Commandes",
      "href": "commandes/index.html"
    }
  ],
  "commandes": [
    {
      "nom": "annuler",
      "etape": "toujours",
      "description": "Revenir en arrière sans rien perdre - abandonner les changements en cours, annuler une tâche enregistrée, revenir à une version précédente, ou récupérer ce qui a été annulé ; aperçu et accord avant toute opération",
      "forme": "[T3 | US-003]",
      "note": "facultatif : la tâche ou l'US à annuler"
    },
    {
      "nom": "auto-fix",
      "etape": "construire",
      "description": "Faire passer au vert tous les contrôles automatiques du code (syntaxe, règles d'écriture, types, formatage), en confiant les corrections à des agents en parallèle",
      "forme": "[--detail]",
      "note": ""
    },
    {
      "nom": "brainstorm",
      "etape": "decrire",
      "description": "Raconter l'idée par un entretien guidé et approfondi (arbre de décisions), produire le brief et le glossaire du projet",
      "forme": "[votre idée en une phrase]",
      "note": ""
    },
    {
      "nom": "cicd",
      "etape": "en-ligne",
      "description": "Mettre en place les contrôles automatiques - secrets, règles du code, tests et construction vérifiés à chaque envoi et sur chaque proposition de version parallèle, adaptés au fournisseur du dépôt distant ; puis, au choix, protéger la branche principale",
      "forme": "[proteger]",
      "note": "vide : installer ou mettre à jour les contrôles automatiques"
    },
    {
      "nom": "commit",
      "etape": "construire",
      "description": "Enregistrer une version dans Git - un sujet par commit, message clair, après contrôle des secrets ; option push pour l'envoyer",
      "forme": "[push] [\"message\"]",
      "note": "facultatifs"
    },
    {
      "nom": "deploy",
      "etape": "en-ligne",
      "description": "Mettre l'appli en ligne et la mettre à jour automatiquement à chaque envoi, puis passer en mode production (variables, services, retour arrière ; les contrôles automatiques se mettent en place avec /pulse:cicd)",
      "forme": "[premiere | production]",
      "note": "détecté automatiquement si vide"
    },
    {
      "nom": "explain",
      "etape": "toujours",
      "description": "Expliquer simplement un fichier, une fonction ou une ligne de code, avec une question pour vérifier",
      "forme": "[fichier | fichier:ligne | nom de fonction | question]",
      "note": ""
    },
    {
      "nom": "express",
      "etape": "demarrer",
      "description": "Démarrer vite - en une seule conversation, l'idée, les écrans, l'apparence et les contraintes deviennent le brief, le PRD et les user stories ; puis les choix techniques et l'identité visuelle, jusqu'à la première US prête à réaliser",
      "forme": "[votre idée en une phrase]",
      "note": ""
    },
    {
      "nom": "fix",
      "etape": "toujours",
      "description": "Comprendre et corriger une erreur précise (message, console du navigateur, bouton qui ne marche pas), en cherchant la vraie cause, puis expliquer la correction et comment l'éviter",
      "forme": "<message d'erreur ou description du problème> [fichier]",
      "note": ""
    },
    {
      "nom": "get-help",
      "etape": "toujours",
      "description": "Préparer une demande d'aide claire et sans secret, à transmettre à une personne qui programme (forum, communauté de la technologie, freelance) quand Pulse n'arrive pas à débloquer la situation",
      "forme": "[\"ce qui bloque\"]",
      "note": "facultatif"
    },
    {
      "nom": "guide",
      "etape": "preparer",
      "description": "Produire le guide de réalisation pas à pas (docs/guide/) à partir du plan - pour chaque tâche, dans l'ordre, les commandes à copier-coller, ce qu'il faut vérifier et les actions manuelles",
      "forme": "[expliquer]",
      "note": "facultatif : présenter le guide pas à pas"
    },
    {
      "nom": "implement",
      "etape": "construire",
      "description": "Réaliser une tâche d'un plan et l'expliquer, en coulisse ou devant vous, au besoin dans un dossier à part ; sans tâche, boucler sur tout le plan (réaliser, relire et vérifier, corriger, enregistrer, tâche suivante)",
      "forme": "<US-XXX> [T3]",
      "note": "sans tâche : tout le plan"
    },
    {
      "nom": "init",
      "etape": "demarrer",
      "description": "Démarrer ou reprendre un projet Pulse - prépare le dossier (CLAUDE.md, mémoire, Git), montre où en est le projet et guide vers la prochaine étape, en boucle",
      "forme": "[nom du projet]",
      "note": ""
    },
    {
      "nom": "learn",
      "etape": "toujours",
      "description": "Apprendre la programmation avec un professeur patient - leçon, « expliquez-le-moi » pour vérifier ce que vous avez compris, exercices ou parcours, adaptés à votre niveau et illustrés avec votre projet, avec un carnet de progression et des révisions espacées",
      "forme": "[<notion> | feynman <notion> | exercice <notion> | parcours \"<objectif>\"]",
      "note": "vide : réviser ou reprendre"
    },
    {
      "nom": "memory",
      "etape": "toujours",
      "description": "Créer, actualiser, enrichir ou compacter la mémoire du projet (choix, mots du métier, pièges), chargée par l'IA à chaque session",
      "forme": "[creer | actualiser | compacter | retenir \"leçon ou décision\"]",
      "note": ""
    },
    {
      "nom": "perf",
      "etape": "visible",
      "description": "Mesurer et améliorer la vitesse vécue par les visiteurs - chargement simulé en plusieurs passages (médiane), données des vrais visiteurs, 3 priorités corrigées avec avant/après, mesure réelle, budget et suivi automatique",
      "forme": "[mesurer | corriger | suivre]",
      "note": "vide : mesurer"
    },
    {
      "nom": "plan",
      "etape": "preparer",
      "description": "Concevoir comment réaliser la spec d'une user story (pile, données, écrans, sécurité, fichiers), puis la découper en petites tâches ordonnées, chacune testable à l'écran (une spec = un plan, rangé à côté de sa spec), écrit une fois validé avec vous",
      "forme": "<US-XXX [US-YYY…] | chemin de la spec>",
      "note": ""
    },
    {
      "nom": "pr",
      "etape": "construire",
      "description": "Travailler sur une version parallèle et proposer de la rassembler - créer la branche de travail, puis ouvrir sur le site du dépôt la proposition en brouillon, décrite à partir des commits, du plan et des relectures",
      "forme": "[branche [<US-XXX>] | <branche de base>]",
      "note": "vide : ouvrir la demande pour la branche en cours"
    },
    {
      "nom": "prd",
      "etape": "decrire",
      "description": "Produire le PRD - le besoin, les objectifs et le périmètre de la première version, décidés avec vous : ce qui est indispensable, ce qui peut attendre",
      "forme": "",
      "note": ""
    },
    {
      "nom": "rediger",
      "etape": "visible",
      "description": "Écrire les textes de vos pages (accueil, à propos, services…) dans la voix du site, sans tics d'écriture IA, puis les intégrer si vous le souhaitez",
      "forme": "[page] [--humaniser]",
      "note": ""
    },
    {
      "nom": "refine",
      "etape": "preparer",
      "description": "Ajuster le plan à partir des questions ou remarques de la personne - répondre à chaque point, modifier les tâches concernées en respectant les règles du plan, montrer ce qui change, puis faire valider",
      "forme": "[<US-XXX>] \"vos questions ou remarques sur le plan\"",
      "note": ""
    },
    {
      "nom": "review",
      "etape": "construire",
      "description": "Relecture et vérification indépendantes d'une tâche (critères d'acceptation, sécurité, essai de l'application en marche), test manuel, puis corrections",
      "forme": "[T3 | <US-XXX> | tout]",
      "note": ""
    },
    {
      "nom": "search-console",
      "etape": "visible",
      "description": "Relier le site à Google Search Console (et Bing), puis lire ce que Google voit vraiment, en lecture seule — chiffres, requêtes à potentiel, pages oubliées, indexation — et suivre l'évolution tous les 28 jours",
      "forme": "[relier | lire [28j|3m] | suivre | inspecter <adresse>]",
      "note": "détecté si vide"
    },
    {
      "nom": "secrets",
      "etape": "en-ligne",
      "description": "Les secrets du projet - inventaire sans aucune valeur, renouvellement sans coupure, réaction à une fuite de clé (révoquer d'abord) ; la valeur ne passe jamais par la conversation",
      "forme": "[inventaire | renouveler <NOM> | fuite [<NOM>]]",
      "note": "par défaut : inventaire"
    },
    {
      "nom": "security",
      "etape": "en-ligne",
      "description": "Sécurité du projet - audit complet S1 à S13 et test du cambrioleur, contrôle rapide, en-têtes de sécurité, préparation d'un audit outillé",
      "forme": "[audit | rapide | entetes | preparer]",
      "note": "par défaut : audit"
    },
    {
      "nom": "seo",
      "etape": "visible",
      "description": "Être trouvé sur Google et par les assistants IA - audit du site servi, fondations (adresse, titres, sitemap, robots, carte de partage), textes choisis par vous, politique des robots IA, lancement (Search Console, Bing)",
      "forme": "[audit | bases | textes [page] | ia | lancer]",
      "note": "par défaut : audit"
    },
    {
      "nom": "spec",
      "etape": "preparer",
      "description": "Rédiger la spécification d'une user story (une US = une spec, rangée à côté de son US) - l'intention seule, la solution étant laissée au plan - périmètre, hors objectifs, écrans, informations, règles, scénarios, « terminé quand » ; les points encore ouverts notés comme questions ; figée une fois validée",
      "forme": "<US-XXX [US-YYY…] | \"description de la demande\">",
      "note": ""
    },
    {
      "nom": "spirc",
      "etape": "construire",
      "description": "Enchaîner tout le travail d'une user story (spirc = Spécifier, Planifier, Implémenter, Relire, Commiter) - des assistants indépendants explorent, codent, relisent et vérifient ; je m'arrête pour votre accord et vous testez chaque tâche ; la spec et le plan s'écrivent d'abord s'ils manquent",
      "forme": "<US-XXX> [T3 | \"une demande\"]",
      "note": "sans tâche ni demande : tout le plan de l'US"
    },
    {
      "nom": "status",
      "etape": "toujours",
      "description": "Où en suis-je ? Étapes faites, tâches à faire, en cours et terminées, état Git, dossiers à part en cours et prochaine étape conseillée, la même que /pulse:init ; propose de supprimer les dossiers à part déjà rassemblés",
      "forme": "",
      "note": ""
    },
    {
      "nom": "tech",
      "etape": "decrire",
      "description": "Choisir la pile technique à partir du besoin (ou documenter celle d'un projet existant), comparer 2 à 3 options vérifiées sur la documentation officielle, et produire docs/technical.md, le bloc Pile technique de CLAUDE.md, la mémoire technique et la mise en place",
      "forme": "[contrainte ou préférence technique (facultatif)]",
      "note": ""
    },
    {
      "nom": "test",
      "etape": "construire",
      "description": "Lancer les tests automatiques du projet et expliquer chaque échec (lancer), ou écrire les tests d'un code existant à partir des scénarios de la spec (ecrire), par des assistants spécialisés",
      "forme": "[lancer | ecrire <US-XXX | Tn | chemin>]",
      "note": ""
    },
    {
      "nom": "ui",
      "etape": "decrire",
      "description": "Définir et soigner l'interface - identité visuelle (docs/design.md), maquettes d'écrans à comparer pour la spec d'une US, audit et finitions d'une interface existante",
      "forme": "[identite | maquettes <US-XXX> | audit [cible] | polish [cible]]",
      "note": ""
    },
    {
      "nom": "us",
      "etape": "decrire",
      "description": "Écrire les user stories, rangées par groupe (un fichier par US, et le référentiel docs/user-stories.md), avec règles métier, exemples et critères d'acceptation (Étant donné / Lorsque / Alors), chacune vérifiée avant d'être déclarée prête, triées par ordre de réalisation, sauvegardées après validation",
      "forme": "",
      "note": ""
    }
  ]
};
