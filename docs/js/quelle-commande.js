// Wiki Pulse – assistant « Quelle commande pour… ? » : quelques questions à choix mènent à une commande conseillée.
// L'arbre est déclaré plus bas (QUESTIONS, CONSEILS). Une feuille dont la commande est absente de window.PULSE_WIKI est
// ignorée. Sans JavaScript, la page garde son tableau statique (bloc [data-statique]).
(function () {
  "use strict";

  var zone = document.querySelector("[data-assistant]");
  var donnees = window.PULSE_WIKI;
  if (!zone || !donnees || !donnees.commandes) return;

  // --- L'arbre ----------------------------------------------------------------------------------------------
  // Une question : { question, choix: [[texte du bouton, id de la cible], …] }. La cible est une question ou un conseil.
  var DEPART = "ou";
  var QUESTIONS = {
    "ou": {
      question: "Où en êtes-vous ?",
      choix: [
        ["Je démarre", "demarre"],
        ["J'ai une idée à décrire", "idee"],
        ["Je construis mon appli", "construis"],
        ["Mon site est en ligne, ou presque", "en-ligne"],
        ["J'ai un problème", "probleme"],
        ["Je veux comprendre ou apprendre", "apprendre"]
      ]
    },
    "demarre": {
      question: "Qu'avez-vous déjà ?",
      choix: [
        ["Rien encore : je pars de zéro", "demarre-rythme"],
        ["Un projet qui a déjà du code", "init-existant"],
        ["Un projet Pulse, que je reprends après une pause", "init-reprise"]
      ]
    },
    "demarre-rythme": {
      question: "Comment voulez-vous avancer ensuite ?",
      choix: [
        ["Vite : voir une première version aujourd'hui", "init-express"],
        ["Pas à pas, en prenant le temps", "init-complet"]
      ]
    },
    "idee": {
      question: "Où en est votre idée ?",
      choix: [
        ["Elle est dans ma tête, je veux aller vite", "express"],
        ["Elle est dans ma tête, je veux la creuser", "brainstorm"],
        ["Elle est racontée : je veux fixer l'indispensable", "prd"],
        ["Je veux choisir les outils de mon appli", "tech"],
        ["Je veux choisir l'apparence de mon appli", "ui-identite"],
        ["Je veux découper mon appli en fonctionnalités", "us"]
      ]
    },
    "construis": {
      question: "Que voulez-vous faire maintenant ?",
      choix: [
        ["Réaliser une fonctionnalité", "construis-facon"],
        ["Préparer une fonctionnalité avant de la réaliser", "spec"],
        ["Faire vérifier le travail fait", "review"],
        ["Enregistrer une version", "commit"],
        ["Soigner l'apparence d'un écran", "ui-polish"],
        ["Savoir quelle est la prochaine tâche", "status"]
      ]
    },
    "construis-facon": {
      question: "Comment voulez-vous travailler ?",
      choix: [
        ["Pulse enchaîne tout et s'arrête pour mon accord", "spirc"],
        ["Une tâche à la fois, en suivant de près", "implement"],
        ["Avec un guide écrit, à suivre pas à pas", "guide"]
      ]
    },
    "en-ligne": {
      question: "Que voulez-vous faire ?",
      choix: [
        ["Le mettre en ligne pour la première fois", "deploy-premiere"],
        ["Publier une nouvelle version", "deploy"],
        ["Accueillir de vrais clients", "deploy-production"],
        ["Être trouvé sur Google", "seo"],
        ["Écrire les textes de mes pages", "rediger"],
        ["Rendre le site plus rapide", "perf"],
        ["Vérifier la sécurité", "security"]
      ]
    },
    "probleme": {
      question: "Que se passe-t-il ?",
      choix: [
        ["Un message d'erreur, un bouton qui ne marche pas", "fix"],
        ["Des erreurs rouges partout dans le code", "auto-fix"],
        ["Les tests automatiques échouent", "test"],
        ["J'ai tout cassé, je veux revenir en arrière", "annuler"],
        ["Une clé secrète a été vue", "secrets-fuite"],
        ["Le site en ligne ne marche plus", "fix-en-ligne"],
        ["Je suis perdu, je ne sais plus quoi faire", "status"],
        ["Pulse n'y arrive pas, j'ai besoin d'une personne", "get-help"]
      ]
    },
    "annuler": {
      question: "Que voulez-vous défaire ?",
      choix: [
        ["Les changements en cours, pas encore enregistrés", "annuler-en-cours"],
        ["Une tâche précise, déjà enregistrée", "annuler-tache"],
        ["Tout ce qui a été fait depuis hier", "annuler-version"],
        ["Je regrette une annulation", "annuler-recuperer"]
      ]
    },
    "apprendre": {
      question: "Que voulez-vous ?",
      choix: [
        ["Comprendre un morceau de code", "explain"],
        ["Apprendre une notion de programmation", "learn"],
        ["Vérifier que j'ai bien compris une notion", "learn-verifier"],
        ["Que l'IA se souvienne de quelque chose", "memory"],
        ["Savoir où j'en suis dans la méthode", "status"]
      ]
    }
  };

  // Un conseil : { commande, arguments, pourquoi, note (facultative), autre: { commande, arguments, pourquoi } }.
  var CONSEILS = {
    "init-express": {
      commande: "init", arguments: "mon-projet",
      pourquoi: "Elle prépare votre dossier de projet : les règles lues par l'IA, la mémoire du projet et l'historique des versions. Puis elle vous propose de démarrer vite.",
      note: "Remplacez mon-projet par le nom de votre projet, ou tapez la commande seule : Pulse vous le demandera.",
      autre: { commande: "express", arguments: "\"un carnet de réservations pour mon salon\"", pourquoi: "Juste après, une seule conversation transforme votre idée en documents prêts, jusqu'à la première fonctionnalité à réaliser." }
    },
    "init-complet": {
      commande: "init", arguments: "mon-projet",
      pourquoi: "Elle prépare votre dossier de projet, puis vous guide étape par étape, en vous disant toujours quoi faire ensuite.",
      note: "Remplacez mon-projet par le nom de votre projet, ou tapez la commande seule : Pulse vous le demandera.",
      autre: { commande: "brainstorm", arguments: "", pourquoi: "La première étape du parcours complet : un entretien guidé pour raconter votre idée en détail." }
    },
    "init-existant": {
      commande: "init", arguments: "",
      pourquoi: "Pulse accueille votre projet tel quel : il ajoute ses règles et sa mémoire en gardant tout ce qui existe.",
      autre: { commande: "memory", arguments: "creer", pourquoi: "Pour remplir la mémoire du projet à partir de votre code et de vos documents." }
    },
    "init-reprise": {
      commande: "init", arguments: "",
      pourquoi: "Elle fait le point sur votre projet, vous montre la prochaine étape conseillée, puis la lance avec vous.",
      autre: { commande: "status", arguments: "", pourquoi: "Le même point, en lecture seule, sans rien lancer." }
    },
    "express": {
      commande: "express", arguments: "\"votre idée en une phrase\"",
      pourquoi: "En une seule conversation, vos réponses deviennent les documents du projet et les fonctionnalités à réaliser.",
      autre: { commande: "brainstorm", arguments: "", pourquoi: "Si vous préférez prendre le temps de creuser votre idée." }
    },
    "brainstorm": {
      commande: "brainstorm", arguments: "\"votre idée en une phrase\"",
      pourquoi: "Un entretien guidé, question par question, pour raconter votre idée en détail. Il produit le brief et les mots de votre métier.",
      autre: { commande: "express", arguments: "", pourquoi: "Si vous voulez aller plus vite, en une seule conversation." }
    },
    "prd": {
      commande: "prd", arguments: "",
      pourquoi: "Elle décide avec vous du besoin et du contenu de la première version : ce qui est indispensable, ce qui peut attendre.",
      autre: { commande: "tech", arguments: "", pourquoi: "L'étape suivante : choisir les outils de votre appli." }
    },
    "tech": {
      commande: "tech", arguments: "",
      pourquoi: "Elle compare deux ou trois choix d'outils adaptés à votre besoin, vérifiés sur leur documentation officielle, et vous aide à décider.",
      autre: { commande: "ui", arguments: "identite", pourquoi: "Pour choisir aussi l'apparence de votre appli." }
    },
    "ui-identite": {
      commande: "ui", arguments: "identite",
      pourquoi: "Elle définit l'identité visuelle de votre appli : couleurs, polices, style. Chaque écran la suivra ensuite.",
      autre: { commande: "ui", arguments: "maquettes US-001", pourquoi: "Pour comparer des maquettes d'un écran avant de le réaliser." }
    },
    "us": {
      commande: "us", arguments: "",
      pourquoi: "Elle découpe votre appli en fonctionnalités, avec leurs règles et des exemples, triées dans l'ordre de réalisation.",
      autre: { commande: "spec", arguments: "US-001", pourquoi: "L'étape suivante : décrire précisément la première fonctionnalité." }
    },
    "spec": {
      commande: "spec", arguments: "US-001",
      pourquoi: "Elle décrit précisément ce que doit faire la fonctionnalité : écrans, règles, cas à vérifier. La façon de la réaliser vient ensuite.",
      note: "Remplacez US-001 par le numéro de votre fonctionnalité (user story).",
      autre: { commande: "plan", arguments: "US-001", pourquoi: "Ensuite, le plan découpe le travail en petites tâches, chacune testable à l'écran." }
    },
    "spirc": {
      commande: "spirc", arguments: "US-001",
      pourquoi: "Elle enchaîne tout le travail d'une fonctionnalité : préparer, réaliser, relire, enregistrer. Elle s'arrête pour votre accord et vous testez chaque tâche.",
      note: "Remplacez US-001 par le numéro de votre fonctionnalité (user story).",
      autre: { commande: "implement", arguments: "US-001 T1", pourquoi: "Si vous préférez avancer une tâche à la fois." }
    },
    "implement": {
      commande: "implement", arguments: "US-001 T1",
      pourquoi: "Elle réalise une tâche du plan et vous l'explique. Vous la testez avant de passer à la suivante.",
      note: "Remplacez US-001 et T1 par votre fonctionnalité et votre tâche. Sans tâche, Pulse enchaîne tout le plan.",
      autre: { commande: "spirc", arguments: "US-001", pourquoi: "Si vous préférez que Pulse enchaîne tout le travail de la fonctionnalité." }
    },
    "guide": {
      commande: "guide", arguments: "",
      pourquoi: "Elle écrit un guide pas à pas à partir du plan : pour chaque tâche, la commande à copier, ce qu'il faut vérifier et ce que vous faites vous-même.",
      autre: { commande: "implement", arguments: "US-001 T1", pourquoi: "Pour réaliser ensuite chaque tâche du guide." }
    },
    "review": {
      commande: "review", arguments: "T3",
      pourquoi: "Une relecture indépendante de la tâche : ce qui était demandé, la sécurité, un essai de l'appli en marche, puis les corrections.",
      note: "Remplacez T3 par votre tâche, ou tapez tout pour relire l'ensemble.",
      autre: { commande: "test", arguments: "", pourquoi: "Pour lancer aussi tous les tests automatiques du projet." }
    },
    "commit": {
      commande: "commit", arguments: "",
      pourquoi: "Elle enregistre une version de votre travail avec un message clair, après avoir vérifié qu'aucune clé secrète ne s'y trouve.",
      autre: { commande: "commit", arguments: "push", pourquoi: "Pour enregistrer et envoyer la version en ligne d'un seul coup." }
    },
    "ui-polish": {
      commande: "ui", arguments: "polish",
      pourquoi: "Elle soigne les finitions de votre interface : lisibilité, espacements, cohérence.",
      autre: { commande: "ui", arguments: "audit", pourquoi: "Pour obtenir d'abord la liste de ce qui peut être amélioré." }
    },
    "status": {
      commande: "status", arguments: "",
      pourquoi: "Elle résume votre projet sur un seul écran : ce qui est fait, ce qui reste, et la prochaine étape conseillée avec sa raison. Elle ne change rien.",
      autre: { commande: "init", arguments: "", pourquoi: "Le même point, puis Pulse lance avec vous l'action que vous choisissez." }
    },
    "deploy-premiere": {
      commande: "deploy", arguments: "premiere",
      pourquoi: "Elle relie votre projet à un dépôt en ligne et vous guide écran par écran chez l'hébergeur. Ensuite, chaque envoi met le site à jour tout seul.",
      autre: { commande: "cicd", arguments: "", pourquoi: "Pour que vos tests et vos clés soient vérifiés automatiquement à chaque envoi." }
    },
    "deploy": {
      commande: "deploy", arguments: "",
      pourquoi: "Elle vérifie que tout est prêt, envoie votre nouvelle version, puis prouve que le site répond.",
      autre: { commande: "commit", arguments: "", pourquoi: "À faire avant : enregistrer la version à publier." }
    },
    "deploy-production": {
      commande: "deploy", arguments: "production",
      pourquoi: "Elle prépare le site pour de vrai : clés chez l'hébergeur, services connectés, surveillance et plan de retour arrière.",
      autre: { commande: "security", arguments: "", pourquoi: "Pour vérifier que vos données et celles de vos clients sont bien protégées." }
    },
    "seo": {
      commande: "seo", arguments: "",
      pourquoi: "Elle vérifie que Google et les assistants IA peuvent trouver et comprendre votre site, puis vous propose les corrections.",
      autre: { commande: "search-console", arguments: "", pourquoi: "Pour relier votre site à Google et voir ce que Google voit vraiment." }
    },
    "rediger": {
      commande: "rediger", arguments: "accueil",
      pourquoi: "Elle écrit le texte de vos pages dans la voix de votre site, sans les tics d'écriture des IA, puis l'intègre si vous le souhaitez.",
      note: "Remplacez accueil par la page voulue : à propos, services…",
      autre: { commande: "seo", arguments: "textes", pourquoi: "Pour que vos textes aident aussi votre site à être trouvé." }
    },
    "perf": {
      commande: "perf", arguments: "",
      pourquoi: "Elle mesure la vitesse de votre site telle que vos visiteurs la vivent et vous montre les trois priorités.",
      autre: { commande: "perf", arguments: "corriger", pourquoi: "Pour corriger ces priorités, avec un avant et un après chiffrés." }
    },
    "security": {
      commande: "security", arguments: "",
      pourquoi: "Elle vérifie la sécurité de votre projet point par point, et vous explique chaque correction à faire.",
      note: "Pour un contrôle en deux minutes : /pulse:security rapide.",
      autre: { commande: "secrets", arguments: "", pourquoi: "Pour faire l'inventaire de vos clés secrètes, sans jamais afficher leur valeur." }
    },
    "fix": {
      commande: "fix", arguments: "\"le bouton Réserver ne fait rien\"",
      pourquoi: "Pulse cherche la vraie cause avant de toucher au code, corrige, puis vous fait refaire l'action pour prouver que ça marche.",
      note: "Collez le message d'erreur tel quel, ou décrivez le problème avec vos mots.",
      autre: { commande: "get-help", arguments: "", pourquoi: "Si Pulse a déjà essayé deux fois sans succès : une demande d'aide prête à envoyer à une personne." }
    },
    "auto-fix": {
      commande: "auto-fix", arguments: "",
      pourquoi: "Elle corrige d'un coup toutes les erreurs que les contrôles automatiques repèrent, sans changer ce que fait votre appli.",
      autre: { commande: "test", arguments: "", pourquoi: "Pour vérifier ensuite que tout fonctionne encore." }
    },
    "test": {
      commande: "test", arguments: "",
      pourquoi: "Elle lance tous les tests et explique chaque échec en une ligne simple, avec sa cause et la bonne suite.",
      autre: { commande: "fix", arguments: "", pourquoi: "Pour corriger un échec précis." }
    },
    "annuler-en-cours": {
      commande: "annuler", arguments: "",
      pourquoi: "Choisissez « abandonner les changements en cours ». Pulse vous montre ce qui sera défait et attend votre accord. Rien n'est perdu : tout se récupère.",
      autre: { commande: "fix", arguments: "", pourquoi: "Si un seul petit détail ne va pas, une correction est souvent plus simple." }
    },
    "annuler-tache": {
      commande: "annuler", arguments: "T3",
      pourquoi: "Pulse ajoute une nouvelle version qui défait cette tâche, sans rien effacer. La tâche repasse « à faire » dans son plan.",
      note: "Remplacez T3 par votre tâche, ou par le numéro d'une fonctionnalité entière (US-003).",
      autre: { commande: "fix", arguments: "", pourquoi: "Si un seul petit détail ne va pas, une correction est souvent plus simple." }
    },
    "annuler-version": {
      commande: "annuler", arguments: "",
      pourquoi: "Choisissez « revenir à une version précédente ». Pulse vous présente vos versions en mots simples, puis attend votre accord.",
      autre: { commande: "status", arguments: "", pourquoi: "Pour revoir ensuite où en est votre projet." }
    },
    "annuler-recuperer": {
      commande: "annuler", arguments: "",
      pourquoi: "Choisissez « récupérer » : ce qui avait été annulé revient.",
      autre: null
    },
    "secrets-fuite": {
      commande: "secrets", arguments: "fuite",
      pourquoi: "Pulse vous guide dans le bon ordre : rendre l'ancienne clé inutilisable d'abord, puis la remplacer partout. La valeur de la clé ne passe jamais par la conversation.",
      note: "Agissez tout de suite, même en cas de doute.",
      autre: null
    },
    "fix-en-ligne": {
      commande: "fix", arguments: "\"le site en ligne affiche une erreur\"",
      pourquoi: "Pulse cherche la cause, souvent une clé ou un réglage absent chez l'hébergeur, et corrige avec vous.",
      autre: { commande: "annuler", arguments: "", pourquoi: "Pour remettre vite le site d'avant : annulez la dernière version, puis envoyez-la." }
    },
    "get-help": {
      commande: "get-help", arguments: "\"ce qui bloque\"",
      pourquoi: "Elle prépare une demande d'aide claire pour une personne qui programme, sans vos clés ni vos vraies données. C'est vous qui l'envoyez.",
      autre: null
    },
    "explain": {
      commande: "explain", arguments: "app.js",
      pourquoi: "Elle vous explique simplement un fichier, une fonction ou une ligne, puis vous pose une question pour vérifier.",
      note: "Remplacez app.js par le fichier qui vous intrigue, ou posez votre question.",
      autre: { commande: "learn", arguments: "", pourquoi: "Pour apprendre la notion qui se cache derrière." }
    },
    "learn": {
      commande: "learn", arguments: "les fonctions",
      pourquoi: "Un professeur patient vous explique la notion à votre niveau, avec des exemples tirés de votre projet.",
      autre: { commande: "learn", arguments: "exercice les fonctions", pourquoi: "Pour vous entraîner avec des exercices." }
    },
    "learn-verifier": {
      commande: "learn", arguments: "feynman les fonctions",
      pourquoi: "Vous expliquez la notion avec vos mots, et Pulse vous dit ce qui est juste et ce qui manque.",
      autre: { commande: "learn", arguments: "", pourquoi: "Sans rien après la commande : réviser ce que vous avez déjà appris." }
    },
    "memory": {
      commande: "memory", arguments: "retenir \"un rendez-vous dure 30 minutes\"",
      pourquoi: "Pulse note la leçon ou la décision dans la mémoire du projet, que l'IA relit à chaque session.",
      autre: { commande: "memory", arguments: "compacter", pourquoi: "Si Pulse vous dit que la mémoire est presque pleine." }
    }
  };

  // --- Vérification : chaque feuille cite une commande qui existe -------------------------------------------
  var connues = {};
  donnees.commandes.forEach(function (c) { connues[c.nom] = true; });

  var valides = {};
  function estValide(id) {
    if (id in valides) return valides[id];
    valides[id] = false; // protège d'une boucle dans l'arbre
    if (CONSEILS[id]) {
      var c = CONSEILS[id];
      if (c.autre && !connues[c.autre.commande]) c.autre = null;
      valides[id] = !!connues[c.commande];
    } else if (QUESTIONS[id]) {
      var q = QUESTIONS[id];
      q.choix = q.choix.filter(function (ch) { return estValide(ch[1]); });
      valides[id] = q.choix.length > 0;
    }
    return valides[id];
  }
  if (!estValide(DEPART)) return;

  // --- Affichage --------------------------------------------------------------------------------------------
  var fil = zone.querySelector("[data-fil]");
  var zoneQuestion = zone.querySelector("[data-question]");
  var resultat = zone.querySelector("[data-resultat]");
  var actions = zone.querySelector("[data-actions]");
  var boutonRetour = zone.querySelector("[data-retour]");
  var parcours = []; // [{ question: id, choix: index }]
  var compteur = 0;

  function el(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte) n.textContent = texte;
    return n;
  }

  function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function ligneCommande(nom, args) { return "/pulse:" + nom + (args ? " " + args : ""); }

  function blocCommande(texte) {
    var pre = el("pre", "commande");
    var code = el("code", "", texte);
    pre.appendChild(code);
    if (navigator.clipboard) {
      var b = el("button", "bouton bouton-copier", "Copier");
      b.type = "button";
      b.setAttribute("aria-label", "Copier la commande " + texte);
      b.addEventListener("click", function () {
        navigator.clipboard.writeText(texte).then(function () {
          b.textContent = "Copié";
          setTimeout(function () { b.textContent = "Copier"; }, 1600);
        });
      });
      pre.appendChild(b);
    }
    return pre;
  }

  function lienPage(nom, classe, texte) {
    var a = el("a", classe, texte);
    a.href = "commandes/" + nom + ".html";
    return a;
  }

  // Le fil des réponses déjà données.
  function afficherFil() {
    vider(fil);
    parcours.forEach(function (p) {
      var q = QUESTIONS[p.question];
      var li = el("li");
      li.appendChild(el("span", "assistant-fil-question", q.question + " "));
      li.appendChild(el("strong", "", q.choix[p.choix][0]));
      fil.appendChild(li);
    });
    fil.hidden = parcours.length === 0;
  }

  // Flèches du clavier : passer d'un choix à l'autre dans le groupe.
  function clavier(evenement) {
    var boutons = Array.prototype.slice.call(evenement.currentTarget.querySelectorAll("button"));
    var i = boutons.indexOf(document.activeElement);
    if (i < 0) return;
    var suivant = null;
    if (evenement.key === "ArrowRight" || evenement.key === "ArrowDown") suivant = (i + 1) % boutons.length;
    else if (evenement.key === "ArrowLeft" || evenement.key === "ArrowUp") suivant = (i - 1 + boutons.length) % boutons.length;
    else if (evenement.key === "Home") suivant = 0;
    else if (evenement.key === "End") suivant = boutons.length - 1;
    if (suivant === null) return;
    evenement.preventDefault();
    boutons[suivant].focus();
  }

  function afficherQuestion(id, sansFocus) {
    var q = QUESTIONS[id];
    compteur++;
    vider(resultat);
    vider(zoneQuestion);
    afficherFil();

    var titre = el("h2", "", q.question);
    titre.id = "assistant-question-" + compteur;
    titre.tabIndex = -1;
    zoneQuestion.appendChild(el("p", "legende", "Question " + (parcours.length + 1)));
    zoneQuestion.appendChild(titre);

    var groupe = el("div", "filtres-etapes assistant-choix");
    groupe.setAttribute("role", "group");
    groupe.setAttribute("aria-labelledby", titre.id);
    q.choix.forEach(function (ch, n) {
      var b = el("button", "filtre", ch[0]);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        b.setAttribute("aria-pressed", "true");
        parcours.push({ question: id, choix: n });
        aller(ch[1]);
      });
      groupe.appendChild(b);
    });
    groupe.addEventListener("keydown", clavier);
    zoneQuestion.appendChild(groupe);
    zoneQuestion.hidden = false;

    actions.hidden = parcours.length === 0;
    boutonRetour.hidden = parcours.length === 0;
    if (!sansFocus) titre.focus();
  }

  function afficherConseil(id) {
    var c = CONSEILS[id];
    vider(zoneQuestion);
    zoneQuestion.hidden = true;
    afficherFil();
    vider(resultat);

    var carte = el("div", "carte assistant-conseil");
    carte.appendChild(el("p", "pastille", "Notre conseil"));
    var titre = el("h2", "");
    titre.tabIndex = -1;
    titre.appendChild(document.createTextNode("Lancez "));
    titre.appendChild(el("code", "", "/pulse:" + c.commande));
    carte.appendChild(titre);
    carte.appendChild(blocCommande(ligneCommande(c.commande, c.arguments)));
    carte.appendChild(el("p", "", c.pourquoi));
    if (c.note) carte.appendChild(el("p", "legende", c.note));
    var lien = el("p");
    lien.appendChild(lienPage(c.commande, "bouton bouton-plein", "Lire la page de /pulse:" + c.commande));
    carte.appendChild(lien);

    if (c.autre) {
      carte.appendChild(el("h3", "", "Possible aussi"));
      carte.appendChild(blocCommande(ligneCommande(c.autre.commande, c.autre.arguments)));
      carte.appendChild(el("p", "", c.autre.pourquoi));
      var lienAutre = el("p");
      lienAutre.appendChild(lienPage(c.autre.commande, "", "La page de /pulse:" + c.autre.commande));
      carte.appendChild(lienAutre);
    }
    resultat.appendChild(carte);

    actions.hidden = false;
    boutonRetour.hidden = false;
    titre.focus();
  }

  function aller(id) {
    if (CONSEILS[id]) afficherConseil(id);
    else afficherQuestion(id);
  }

  boutonRetour.addEventListener("click", function () {
    var precedent = parcours.pop();
    afficherQuestion(precedent ? precedent.question : DEPART);
  });
  zone.querySelector("[data-recommencer]").addEventListener("click", function () {
    parcours = [];
    afficherQuestion(DEPART);
  });

  // Le script prend la main : l'assistant remplace le tableau statique.
  var statique = document.querySelector("[data-statique]");
  if (statique) statique.hidden = true;
  zone.hidden = false;

  // Premier affichage, sans voler le focus au chargement de la page.
  afficherQuestion(DEPART, true);
})();
