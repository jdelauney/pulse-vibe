// Instantané des identifiants de règles des familles de qualité, des morceaux de tests et de la checklist sécurité :
//   - titres (## à ####), éléments numérotés (« 3. … ») et cases de checklist (« - [ ] … »), chacun par son début (50 caractères) ;
//   - code-concepts.md (XML) : ses attributs id et name ;
//   - points S<n> cités, rattachés au titre de la section où ils apparaissent ;
//   - marqueurs des sommaires (« Règle de choix »).
// Une famille raccourcie garde tous ses identifiants (en ajouter est permis). Un début d'élément reformulé a un coût voulu :
// on met l'instantané à jour en le disant (node tests/regles-identifiants.test.js --instantane).
// Relevé le 2026-10-24 (pulse 0.50, tâche 2.3 du refactoring d'optimisation).
// Lancer : node --test plugins/pulse-vibe/tests/regles-identifiants.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const REF = path.join(__dirname, "..", "references");
const MARQUEURS = { "qualite/README.md": ["**Règle de choix**"] };
const debut = (l) => l.trim().slice(0, 50);

/** Ce qui identifie les règles d'un fichier de references/ (blocs de code exclus). */
function relever(chemin) {
  const lignes = fs.readFileSync(path.join(REF, chemin), "utf8").split("\n");
  const r = { titres: [], numerotes: [], cases: [], balises: [], securitePar: {} };
  let bloc = false;
  let section = "(avant le premier titre)";
  for (const l of lignes) {
    if (/^\s*```/.test(l)) { bloc = !bloc; continue; }
    if (bloc) continue;
    if (/^#{2,4} /.test(l)) { r.titres.push(l); section = l; }
    else if (/^\d+\. /.test(l)) r.numerotes.push(debut(l));
    else if (/^\s*- \[ \] /.test(l)) r.cases.push(debut(l));
    for (const m of l.matchAll(/\b(?:id|name)="([^"]+)"/g)) r.balises.push(m[0]);
    for (const m of l.matchAll(/\bS\d{1,2}\b/g)) (r.securitePar[section] ||= new Set()).add(m[0]);
  }
  r.securitePar = Object.fromEntries(Object.entries(r.securitePar).map(([k, v]) => [k, [...v].sort((a, b) => a.slice(1) - b.slice(1))]));
  r.marqueurs = (MARQUEURS[chemin] || []).filter((m) => lignes.join("\n").includes(m));
  return r;
}

const fichiers = () =>
  ["qualite", "tests"].flatMap((d) => fs.readdirSync(path.join(REF, d)).filter((f) => f.endsWith(".md")).map((f) => `${d}/${f}`).sort()).concat("checklist-securite.md");

if (process.argv.includes("--instantane")) {
  console.log(JSON.stringify(Object.fromEntries(fichiers().map((f) => [f, relever(f)])), null, 1));
  process.exit(0);
}

const INSTANTANE = {
 "qualite/README.md": {
  "titres": [],
  "numerotes": [
   "1. **Vérifier dans le projet avant d'utiliser** : ",
   "2. **Technologie, organisation et commandes** : « ",
   "3. **Priorité** en cas de conflit : code et conven"
  ],
  "cases": [],
  "balises": [],
  "securitePar": {
   "(avant le premier titre)": [
    "S1",
    "S13"
   ]
  },
  "marqueurs": [
   "**Règle de choix**"
  ]
 },
 "qualite/clean-code.md": {
  "titres": [
   "## 1. Principes",
   "### Limites chiffrées",
   "## 2. Nommage",
   "## 3. Constantes : aucune valeur magique",
   "## 4. Fonctions",
   "## 5. Testabilité, couplage et règles métier",
   "### Règles métier : un seul endroit, sans dépendance extérieure",
   "### Testable",
   "### Faible couplage",
   "## 6. Commentaires : expliquer le pourquoi",
   "## 7. Typage et contrats de données",
   "## 8. Gestion des erreurs",
   "## 9. Asynchrone",
   "## 10. Organisation du code",
   "## 11. Séparer serveur et client",
   "## 12. Dépendances",
   "## 13. Configuration",
   "## 14. Outils de contrôle du projet",
   "## 15. Anti-patterns",
   "## 16. Checklist",
   "### À l'implémentation",
   "### À la relecture"
  ],
  "numerotes": [],
  "cases": [
   "- [ ] Chaque import pointe vers un module qui exis",
   "- [ ] Fonctions ≤ 30 lignes, ≤ 3 niveaux d'imbrica",
   "- [ ] Fichiers placés selon le code existant, `doc",
   "- [ ] Noms explicites, booléens `is/has/should`, c",
   "- [ ] Chaque règle métier est une fonction nommée,",
   "- [ ] Les décisions sont des calculs purs ; heure,",
   "- [ ] Les règles métier ont leurs tests (nominal, ",
   "- [ ] Les dépendances vont vers le métier ; les fo",
   "- [ ] Commentaire en tête de fichier ; commentaire",
   "- [ ] Types stricts si le langage le permet, sinon",
   "- [ ] Chaque erreur est traitée ou remonte au gest",
   "- [ ] Opérations asynchrones toutes attendues ou g",
   "- [ ] Code serveur et code client séparés ; secret",
   "- [ ] Chaque dépendance ou option de configuration",
   "- [ ] Contrôles automatiques de « Commandes du pro",
   "- [ ] Le code fait ce que la spec demande, ni plus",
   "- [ ] Chaque information à un seul endroit ; code ",
   "- [ ] Journaux limités au détail technique : aucun",
   "- [ ] Chaque règle métier dans le module de règles",
   "- [ ] Changer d'affichage, de stockage ou de servi",
   "- [ ] Une personne qui débute peut lire chaque fon"
  ],
  "balises": [],
  "securitePar": {
   "### Règles métier : un seul endroit, sans dépendance extérieure": [
    "S5"
   ],
   "## 8. Gestion des erreurs": [
    "S11"
   ],
   "## 11. Séparer serveur et client": [
    "S5"
   ],
   "## 12. Dépendances": [
    "S8"
   ],
   "### À la relecture": [
    "S11"
   ]
  },
  "marqueurs": []
 },
 "qualite/code-concepts.md": {
  "titres": [],
  "numerotes": [],
  "cases": [],
  "balises": [
   "id=\"KISS\"",
   "name=\"Keep It Simple, Stupid\"",
   "id=\"DRY\"",
   "name=\"Don't Repeat Yourself\"",
   "id=\"YAGNI\"",
   "name=\"You Ain't Gonna Need It\"",
   "id=\"SOLID\"",
   "name=\"SOLID Design Principles\"",
   "id=\"SRP\"",
   "name=\"Single Responsibility Principle\"",
   "id=\"OCP\"",
   "name=\"Open/Closed Principle\"",
   "id=\"LSP\"",
   "name=\"Liskov Substitution Principle\"",
   "id=\"ISP\"",
   "name=\"Interface Segregation Principle\"",
   "id=\"DIP\"",
   "name=\"Dependency Inversion Principle\"",
   "id=\"SoC\"",
   "name=\"Separation of Concerns\"",
   "id=\"bloaters\"",
   "name=\"Bloaters\"",
   "id=\"long_method\"",
   "id=\"large_class\"",
   "id=\"long_parameter_list\"",
   "id=\"primitive_obsession\"",
   "id=\"data_clumps\"",
   "id=\"oo_abusers\"",
   "name=\"Object-Orientation Abusers\"",
   "id=\"switch_statements\"",
   "id=\"refused_bequest\"",
   "id=\"temporary_field\"",
   "id=\"change_preventers\"",
   "name=\"Change Preventers\"",
   "id=\"divergent_change\"",
   "id=\"shotgun_surgery\"",
   "id=\"parallel_inheritance\"",
   "id=\"dispensables\"",
   "name=\"Dispensables\"",
   "id=\"dead_code\"",
   "id=\"speculative_generality\"",
   "id=\"lazy_class\"",
   "id=\"duplicate_code\"",
   "id=\"comments\"",
   "id=\"couplers\"",
   "name=\"Couplers\"",
   "id=\"feature_envy\"",
   "id=\"inappropriate_intimacy\"",
   "id=\"message_chains\"",
   "id=\"middle_man\"",
   "id=\"composing_methods\"",
   "name=\"Composing Methods\"",
   "id=\"extract_method\"",
   "id=\"inline_method\"",
   "id=\"extract_variable\"",
   "id=\"replace_temp_with_query\"",
   "id=\"moving_features\"",
   "name=\"Moving Features\"",
   "id=\"move_method\"",
   "id=\"move_field\"",
   "id=\"extract_class\"",
   "id=\"inline_class\"",
   "id=\"hide_delegate\"",
   "id=\"organizing_data\"",
   "name=\"Organizing Data\"",
   "id=\"replace_primitive_with_object\"",
   "id=\"replace_magic_number\"",
   "id=\"encapsulate_field\"",
   "id=\"replace_type_code_with_class\"",
   "id=\"simplifying_conditionals\"",
   "name=\"Simplifying Conditionals\"",
   "id=\"decompose_conditional\"",
   "id=\"consolidate_conditional\"",
   "id=\"replace_nested_with_guard\"",
   "id=\"replace_conditional_with_polymorphism\"",
   "id=\"introduce_null_object\"",
   "id=\"simplifying_calls\"",
   "name=\"Simplifying Method Calls\"",
   "id=\"rename_method\"",
   "id=\"introduce_parameter_object\"",
   "id=\"preserve_whole_object\"",
   "id=\"replace_parameter_with_method\"",
   "id=\"separate_query_from_modifier\""
  ],
  "securitePar": {},
  "marqueurs": []
 },
 "qualite/composants.md": {
  "titres": [
   "## 1. Présentation et orchestration",
   "## 2. Niveaux de composants",
   "## 3. État",
   "## 4. Accès aux données centralisé",
   "## 5. Flux de données",
   "## 6. Les quatre états d'interface",
   "## 7. Formulaires",
   "## 8. Accessibilité",
   "## 9. Nommage",
   "## 10. Découpage et regroupement",
   "## 11. Entrées d'un composant et composition",
   "## 12. Tests",
   "## 13. Sécurité de l'affichage",
   "## 14. Checklist (implémentation et relecture)"
  ],
  "numerotes": [],
  "cases": [
   "- [ ] Chaque module importé existe ou a été créé d",
   "- [ ] Composants de présentation qui reçoivent des",
   "- [ ] Seule l'orchestration lit l'état, appelle l'",
   "- [ ] Source unique de vérité ; état dérivé calcul",
   "- [ ] Accès aux données centralisé par fonctionnal",
   "- [ ] Données descendantes, événements montants pa",
   "- [ ] Les quatre états (chargement, vide, erreur, ",
   "- [ ] Formulaires : validation client et serveur, ",
   "- [ ] Accessibilité : libellés, noms accessibles p",
   "- [ ] Saisies affichées comme du texte, jamais ins",
   "- [ ] Découpage proportionné, regroupé par fonctio",
   "- [ ] Contrôles automatiques de « Commandes du pro"
  ],
  "balises": [],
  "securitePar": {
   "## 7. Formulaires": [
    "S5"
   ],
   "## 13. Sécurité de l'affichage": [
    "S6"
   ],
   "## 14. Checklist (implémentation et relecture)": [
    "S6"
   ]
  },
  "marqueurs": []
 },
 "qualite/organisation.md": {
  "titres": [
   "## 1. Quand appliquer ce guide",
   "## 2. Nommage des fichiers et des dossiers",
   "### Exceptions : quand le langage ou l'outil impose autre chose",
   "## 3. Catalogue des suffixes",
   "## 4. La racine du dépôt",
   "## 5. Le code : des paliers progressifs, découpés par fonctionnalité",
   "### Palier 1 — simple",
   "### Palier 2 — métier",
   "### Palier 3 — hexagonal",
   "### Choisir et changer de palier",
   "## 6. Règles de dépendance",
   "### L'index public d'une feature",
   "## 7. Tests",
   "## 8. Anti-patterns",
   "## 9. Checklist"
  ],
  "numerotes": [
   "1. **Le code existant** : dans un projet qui a déj",
   "2. **Les conventions imposées par le framework** r",
   "3. **« Organisation des fichiers » de `docs/techni",
   "4. **Ce guide** : il sert à **décider** « Organisa"
  ],
  "cases": [
   "- [ ] Chaque nouveau fichier est à l'emplacement p",
   "- [ ] Nom en kebab-case, avec un suffixe du catalo",
   "- [ ] Code rangé par feature, puis par couche (§5)",
   "- [ ] Imports dans le sens permis (§6) : le domain",
   "- [ ] Tests au même nom avec `.test`, à l'emplacem",
   "- [ ] Organisation existante suivie, sans fichier "
  ],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "qualite/securite-code.md": {
  "titres": [
   "## Principe directeur",
   "## Quand appliquer quoi",
   "## 1. Validation serveur par liste blanche (S5)",
   "## 2. Contrôle d'accès à chaque lecture et écriture (S3, S4)",
   "## 3. Règles d'accès au niveau des données",
   "## 4. Champ piège et délai minimal (S10)",
   "## 5. Limitation de fréquence (S10)",
   "## 6. Origine des requêtes et CSRF (S4, S10)",
   "## 7. Mots de passe et authentification (S1, S5, S11)",
   "## 8. Anti-robot (S10)",
   "## 9. Secrets (S1, S2)",
   "## 10. Réponses, codes HTTP et journal (S11, S9)",
   "## 11. Affichage sans injection (S6)",
   "## 12. Envoi de fichiers (S7)",
   "## 13. Squelette d'un point d'entrée sécurisé",
   "## 14. Checklist avant de livrer"
  ],
  "numerotes": [
   "1. Champ piège + délai minimal + limite de fréquen",
   "2. Si le spam persiste, après accord de la personn",
   "3. Si le fournisseur d'authentification propose un"
  ],
  "cases": [
   "- [ ] Secrets uniquement côté serveur, en variable",
   "- [ ] Aucune clé secrète dans le code envoyé au cl",
   "- [ ] Règles d'accès actives sur chaque table si l",
   "- [ ] Chaque action réservée vérifie l'identité (t",
   "- [ ] Chaque contrôle côté client a son équivalent",
   "- [ ] Saisies affichées comme du texte, jamais ins",
   "- [ ] Fichiers : type et taille vérifiés côté serv",
   "- [ ] Bibliothèques de sécurité reconnues, existan",
   "- [ ] Données minimales ; IP stockées purgées ; se",
   "- [ ] Formulaire public : champ piège + délai mini",
   "- [ ] Codes HTTP corrects, messages génériques, au",
   "- [ ] En-têtes de sécurité en place : voir `/pulse",
   "- [ ] Actions qui modifient : origine vérifiée (CS",
   "- [ ] Testé « en cambrioleur » : formulaire vide, "
  ],
  "balises": [],
  "securitePar": {
   "(avant le premier titre)": [
    "S1",
    "S13"
   ],
   "## Quand appliquer quoi": [
    "S1",
    "S2",
    "S3",
    "S4",
    "S5",
    "S7",
    "S9",
    "S10",
    "S11",
    "S12",
    "S13"
   ],
   "## 1. Validation serveur par liste blanche (S5)": [
    "S5"
   ],
   "## 2. Contrôle d'accès à chaque lecture et écriture (S3, S4)": [
    "S3",
    "S4"
   ],
   "## 4. Champ piège et délai minimal (S10)": [
    "S10"
   ],
   "## 5. Limitation de fréquence (S10)": [
    "S9",
    "S10"
   ],
   "## 6. Origine des requêtes et CSRF (S4, S10)": [
    "S4",
    "S10"
   ],
   "## 7. Mots de passe et authentification (S1, S5, S11)": [
    "S1",
    "S5",
    "S11"
   ],
   "## 8. Anti-robot (S10)": [
    "S9",
    "S10"
   ],
   "## 9. Secrets (S1, S2)": [
    "S1",
    "S2"
   ],
   "## 10. Réponses, codes HTTP et journal (S11, S9)": [
    "S9",
    "S11"
   ],
   "## 11. Affichage sans injection (S6)": [
    "S6"
   ],
   "## 12. Envoi de fichiers (S7)": [
    "S7"
   ],
   "## 14. Checklist avant de livrer": [
    "S1",
    "S2",
    "S3",
    "S4",
    "S5",
    "S6",
    "S7",
    "S8",
    "S9",
    "S10",
    "S11",
    "S12",
    "S13"
   ]
  },
  "marqueurs": []
 },
 "tests/README.md": {
  "titres": [],
  "numerotes": [
   "1. **Outil et commandes** : l'outil de test, la co",
   "2. **Emplacement et nommage des fichiers de test**",
   "3. **Code testable** (décider / agir séparés, dépe",
   "4. **Dans Pulse** : les scénarios Gherkin de la sp",
   "5. **Priorité** en cas de conflit : code et conven"
  ],
  "cases": [],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "tests/bout-en-bout.md": {
  "titres": [
   "## 1. Caractéristiques",
   "## 2. Quels parcours",
   "## 3. Écrire un test de bout en bout",
   "## 4. Stabilité",
   "## 5. Après un déploiement",
   "## 6. Liste de contrôle"
  ],
  "numerotes": [],
  "cases": [
   "- [ ] Chaque test correspond à un parcours critiqu",
   "- [ ] Éléments repérés par rôle, nom accessible ou",
   "- [ ] Aucune pause de durée fixe ; attente d'un ét",
   "- [ ] Données créées et nettoyées par le test, ou ",
   "- [ ] Aucun appel réel vers un service tiers (paie",
   "- [ ] Capture et trace conservées en cas d'échec."
  ],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "tests/ecrire-un-test.md": {
  "titres": [
   "## 1. F.I.R.S.T : les cinq qualités d'un test",
   "## 2. Structure : Fonctionnalité / Règle / Exemple",
   "## 3. Le corps du test : Étant donné / Quand / Alors",
   "## 4. L'objet SUT : un test qui se lit comme une phrase",
   "## 5. Z.O.M.B.I.E.S : la liste des cas à couvrir",
   "## 6. Données de test",
   "## 7. Assertions",
   "## 8. Doublures",
   "### Où doubler",
   "### Les cinq sortes",
   "## 9. Préparation et nettoyage",
   "## 10. Erreurs attendues",
   "## 11. Signaux d'alerte",
   "## 12. Liste de contrôle",
   "## 13. Vocabulaire"
  ],
  "numerotes": [],
  "cases": [
   "- [ ] Le comportement à prouver est formulé en une",
   "- [ ] Le niveau de test est choisi : le plus bas q",
   "- [ ] Les cas Z.O.M.B.I.E.S pertinents sont listés",
   "- [ ] Les données et doublures nécessaires sont id",
   "- [ ] Fonctionnalité / Règle / Exemple, titres en ",
   "- [ ] Étant donné / Quand / Alors, une seule actio",
   "- [ ] SUT neuf par test dès qu'il y a de la prépar",
   "- [ ] Doublures aux frontières seulement.",
   "- [ ] Cas nominal **et** cas refusés.",
   "- [ ] Chaque test a été vu échouer pour la bonne r",
   "- [ ] La suite passe, dans n'importe quel ordre, e",
   "- [ ] Les règles métier et parcours critiques sont",
   "- [ ] Un scénario de test inhabituel porte un comm"
  ],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "tests/gherkin.md": {
  "titres": [
   "## 1. Les mots-clés en français",
   "## 2. Écrire un bon scénario",
   "## 3. Choisir les exemples",
   "## 4. Étiquettes",
   "## 5. Exemple complet",
   "## 6. Du scénario au test"
  ],
  "numerotes": [],
  "cases": [],
  "balises": [],
  "securitePar": {
   "## 4. Étiquettes": [
    "S1",
    "S13"
   ]
  },
  "marqueurs": []
 },
 "tests/integration.md": {
  "titres": [
   "## 1. Caractéristiques",
   "## 2. Ce qu'on teste en intégration",
   "## 3. Préparation, nettoyage et données",
   "## 4. Pannes et erreurs",
   "## 5. Liste de contrôle"
  ],
  "numerotes": [],
  "cases": [
   "- [ ] Chaque test d'intégration prouve un assembla",
   "- [ ] Base de test dédiée, remise à zéro entre deu",
   "- [ ] Services tiers doublés ; aucun appel réel ve",
   "- [ ] Points d'entrée : cas autorisé, non connecté",
   "- [ ] Ressources fermées après chaque test (connex"
  ],
  "balises": [],
  "securitePar": {
   "## 2. Ce qu'on teste en intégration": [
    "S1",
    "S13"
   ]
  },
  "marqueurs": []
 },
 "tests/strategie.md": {
  "titres": [
   "## 1. La pyramide",
   "## 2. Choisir le niveau",
   "## 3. Couverture",
   "## 4. Quand lancer quoi"
  ],
  "numerotes": [],
  "cases": [],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "tests/tdd.md": {
  "titres": [
   "## 1. Le cycle : rouge, vert, remaniement",
   "## 2. Les 5 étapes pour écrire un exemple",
   "### Étape 1 : raconter l'histoire avec un exemple concret",
   "### Étape 2 : écrire l'histoire en code DAMP",
   "### Étape 3 : écrire le « Alors » avec la valeur attendue en dur",
   "### Étape 4 : relier le « Quand » au « Alors »",
   "### Étape 5 : relier le « Étant donné » au « Quand »",
   "## 3. Faire grandir le code par les exemples",
   "## 4. Ordre des exemples : Z.O.M.B.I.E.S",
   "## 5. Règles clés"
  ],
  "numerotes": [
   "1. **Zéro** : aucune facture à examiner, liste de ",
   "2. **Un** : une facture en retard, une relance.",
   "3. **Plusieurs** : plusieurs factures, certaines e",
   "4. **Limites** : échéance aujourd'hui, échéance hi",
   "5. **Interface** : forme exacte de la relance renv",
   "6. **Exceptions** : facture sans date d'échéance, "
  ],
  "cases": [],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "tests/test-manuel.md": {
  "titres": [
   "## 1. Préparer la fiche",
   "## 2. Exemple de fiche : créer, consulter, modifier, supprimer",
   "### Créer",
   "### Consulter",
   "### Modifier",
   "### Supprimer",
   "### Erreurs",
   "### Affichage",
   "### Rapidité et propreté",
   "## 3. Vérification dans le navigateur par l'assistant",
   "## 4. Résultat attendu avant de valider"
  ],
  "numerotes": [
   "1. Ouvrir la fonctionnalité.",
   "2. Suivre les parcours de la fiche.",
   "3. Essayer les cas limites et les cas refusés.",
   "4. Vérifier l'affichage sur plusieurs tailles d'éc",
   "5. Vérifier l'accessibilité de base : navigation a"
  ],
  "cases": [
   "- [ ] Le formulaire s'ouvre.",
   "- [ ] Tous les champs se remplissent.",
   "- [ ] Une saisie invalide affiche un message à côt",
   "- [ ] Un champ obligatoire vide empêche l'enregist",
   "- [ ] Un message confirme l'enregistrement.",
   "- [ ] L'application mène à la bonne page après l'e",
   "- [ ] Le nouvel élément apparaît dans la liste.",
   "- [ ] La liste s'affiche correctement.",
   "- [ ] Chaque élément est visible.",
   "- [ ] La page de détail montre toutes les informat",
   "- [ ] Un indicateur de chargement apparaît pendant",
   "- [ ] Sans aucun élément, un message explique que ",
   "- [ ] Le formulaire s'ouvre avec les valeurs actue",
   "- [ ] Les changements s'enregistrent.",
   "- [ ] Une saisie invalide est refusée avec un mess",
   "- [ ] Un message confirme la modification.",
   "- [ ] Les nouvelles valeurs s'affichent.",
   "- [ ] Une confirmation est demandée avant de suppr",
   "- [ ] La suppression fonctionne.",
   "- [ ] Un message confirme la suppression.",
   "- [ ] L'élément disparaît de la liste.",
   "- [ ] Sans connexion internet, un message clair s'",
   "- [ ] Une erreur du serveur affiche un message com",
   "- [ ] Les erreurs de saisie s'affichent à côté des",
   "- [ ] Les notifications de succès apparaissent pui",
   "- [ ] Sur téléphone, tout est lisible et utilisabl",
   "- [ ] Sur tablette, tout est lisible et utilisable",
   "- [ ] Sur ordinateur, la mise en page est correcte",
   "- [ ] Le mode sombre fonctionne (si prévu).",
   "- [ ] Un indicateur de chargement apparaît pendant",
   "- [ ] Les boutons sont désactivés pendant un envoi",
   "- [ ] La page s'affiche en moins de 2 secondes.",
   "- [ ] La console du navigateur ne montre ni erreur",
   "- [ ] Les interactions sont fluides."
  ],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "tests/unitaires.md": {
  "titres": [
   "## 1. Caractéristiques",
   "## 2. Ce qu'on teste en unitaire",
   "## 3. Exemples",
   "### Règle métier pure : appel direct",
   "### Cas d'usage : SUT et doublures aux frontières",
   "## 4. Interface",
   "## 5. Code exécuté côté serveur",
   "## 6. Liste de contrôle"
  ],
  "numerotes": [],
  "cases": [
   "- [ ] Chaque règle métier a ses exemples : nominal",
   "- [ ] Aucun test ne touche une base, le réseau, de",
   "- [ ] Les doublures se limitent aux frontières ; l",
   "- [ ] La suite unitaire complète tourne en quelque"
  ],
  "balises": [],
  "securitePar": {},
  "marqueurs": []
 },
 "checklist-securite.md": {
  "titres": [
   "## S1 – Secrets hors du code",
   "## S2 – Clés côté client (si l'application appelle un service avec une clé)",
   "## S3 – Contrôle d'accès aux données (si l'application a une base partagée ou des comptes)",
   "## S4 – Pages et actions réservées (si l'application a des comptes ou des rôles)",
   "## S5 – Validation des entrées",
   "## S6 – Affichage sans injection (XSS)",
   "## S7 – Fichiers (si l'application stocke des fichiers envoyés)",
   "## S8 – Dépendances",
   "## S9 – Données personnelles",
   "## S10 – Abus et coûts",
   "## S11 – Messages d'erreur",
   "## S12 – En-têtes de sécurité (si l'application est servie par le web)",
   "## S13 – CSRF, sessions et cookies (si l'application a des comptes ou des actions qui modifient des données)",
   "## Fiche du cambrioleur (tests manuels, sans compétence technique)"
  ],
  "numerotes": [
   "1. **Sans être connecté** : en navigation privée, ",
   "2. **Changer de compte** : connectez-vous avec le ",
   "3. **Action interdite** : avec un compte simple, e",
   "4. **Secrets** : sur le dépôt en ligne, ouvrez les",
   "5. **Formulaire malmené** : envoyez un formulaire ",
   "6. **Doublon** : essayez de faire deux fois la mêm",
   "7. **Déconnexion** : déconnectez-vous, revenez en "
  ],
  "cases": [],
  "balises": [],
  "securitePar": {
   "## S1 – Secrets hors du code": [
    "S1"
   ],
   "## S2 – Clés côté client (si l'application appelle un service avec une clé)": [
    "S2"
   ],
   "## S3 – Contrôle d'accès aux données (si l'application a une base partagée ou des comptes)": [
    "S3"
   ],
   "## S4 – Pages et actions réservées (si l'application a des comptes ou des rôles)": [
    "S4"
   ],
   "## S5 – Validation des entrées": [
    "S5"
   ],
   "## S6 – Affichage sans injection (XSS)": [
    "S6"
   ],
   "## S7 – Fichiers (si l'application stocke des fichiers envoyés)": [
    "S7"
   ],
   "## S8 – Dépendances": [
    "S8"
   ],
   "## S9 – Données personnelles": [
    "S9"
   ],
   "## S10 – Abus et coûts": [
    "S10"
   ],
   "## S11 – Messages d'erreur": [
    "S11"
   ],
   "## S12 – En-têtes de sécurité (si l'application est servie par le web)": [
    "S12"
   ],
   "## S13 – CSRF, sessions et cookies (si l'application a des comptes ou des actions qui modifient des données)": [
    "S13"
   ]
  },
  "marqueurs": []
 }
};

for (const [chemin, attendu] of Object.entries(INSTANTANE)) {
  test(`${chemin} : aucun identifiant de règle n'a disparu`, () => {
    const actuel = relever(chemin);
    for (const cle of ["titres", "numerotes", "cases", "balises", "marqueurs"]) {
      for (const x of attendu[cle]) assert.ok(actuel[cle].includes(x), `${cle} disparu : ${x}`);
    }
    for (const [section, points] of Object.entries(attendu.securitePar)) {
      for (const s of points) assert.ok((actuel.securitePar[section] || []).includes(s), `${s} n'est plus dans la section ${section}`);
    }
  });
}

test("l'instantané couvre chaque fichier de references/qualite et references/tests, et la checklist sécurité", () => {
  assert.deepStrictEqual(Object.keys(INSTANTANE).sort(), fichiers().sort());
});

test("la checklist sécurité garde ses treize points S1 à S13 et la fiche du cambrioleur", () => {
  const titres = relever("checklist-securite.md").titres;
  for (let n = 1; n <= 13; n++) assert.ok(titres.some((t) => t.startsWith(`## S${n} – `)), `## S${n} – …`);
  assert.ok(titres.some((t) => t.startsWith("## Fiche du cambrioleur")));
});
