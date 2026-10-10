# Les fichiers du projet Pulse

Dans le projet de la personne, ce que produit chaque commande :

| Fichier | Produit par | Contenu |
|---|---|---|
| `CLAUDE.md` | `/pulse:init` | Règles du projet, lues à chaque session |
| `docs/brief.md` | `/pulse:brainstorm` | L'idée racontée simplement, comme une histoire |
| `docs/prd.md` | `/pulse:prd` | Le besoin produit, le périmètre de la première version (Indispensable, Essentiel, Optionnel, En attente) |
| `docs/technical.md` | `/pulse:tech` | La pile retenue et ses raisons, l'organisation des fichiers, les commandes du projet, les données et le contrôle d'accès, les secrets, l'hébergement. Source unique pour tout ce qui dépend de la technologie |
| `docs/design.md` | `/pulse:ui identite` | L'identité visuelle : registre, scène d'usage, personnalité, couleurs, typographie, composants et leurs états. Facultatif ; s'il existe, les specs, le plan et le code s'y conforment |
| `docs/design/` | `/pulse:ui` | Les planches d'identité et les maquettes d'écrans (`maquettes/US-XXX-<nom>/retenue/` = la maquette choisie pour une US). Référence visuelle, à traduire dans la pile retenue |
| `docs/user-stories.md` | `/pulse:us` | Le référentiel des user stories : les groupes, la vue d'ensemble (priorité, taille, dépendances) et le parcours utilisateur |
| `aidd_docs/tasks/<epic>/US-XXX-<nom>.md` | `/pulse:us` | Une user story : règles métier, exemple, critères d'acceptation |
| `aidd_docs/tasks/<epic>/SPEC-US-XXX-<nom>.md` | `/pulse:spec` | La spécification d'une user story (une US = une spec) : l'intention seule (écrans, informations, règles, scénarios, « terminé quand »), verrouillée une fois validée |
| `aidd_docs/tasks/<epic>/PLAN-SPEC-US-XXX-<nom>.md` | `/pulse:plan` | Le plan d'une spec (une spec = un plan) : les tâches ordonnées, avec leur statut (à faire, en cours, terminé) |
| `aidd_docs/tasks/<epic>/revues/PLAN-SPEC-US-XXX-<nom>/` | `/pulse:review`, `/pulse:spirc` | Les rapports de relecture des tâches de ce plan, un par tâche : `<Tâche>-<AAAA-MM-JJ>.md` |
| `docs/revue-projet-<AAAA-MM-JJ>.md` | `/pulse:review tout` | La relecture de l'ensemble du projet |
| `docs/design/audits/` | `/pulse:ui audit` | Les audits d'interface : `ui-<AAAA-MM-JJ>.md` |
| `docs/securite.md` | `/pulse:security` | Le dernier audit de sécurité |
| `docs/secrets.md` | `/pulse:secrets` | L'inventaire des secrets (noms, fournisseur, où les renouveler) et le journal des rotations. Jamais de valeur |
| `docs/incidents/<AAAA-MM-JJ>-<sujet>.md` | `/pulse:secrets fuite` | Le journal d'un incident de fuite de clé : chronologie, traces cherchées, décision sur les données personnelles. Jamais de valeur |
| `docs/seo.md` | `/pulse:seo` | La fiche de référencement : adresse officielle, titres et descriptions validés des pages publiques, pages privées, faits clés, politique des robots IA, suivi (Search Console, Bing). Source unique des textes pour le code |
| `docs/voix.md` | `/pulse:rediger` | La voix du site : vous ou tu, ton, promesse, mots à employer et à éviter, exemples. Lue avant chaque texte |
| `docs/textes/<page>.md` | `/pulse:rediger` | Le texte d'une page, validé : fiche (objectif, public, action attendue, faits), texte entre `<!-- texte -->` et `<!-- /texte -->`, résultat du contrôle des tics d'écriture IA |
| `docs/seo/audits/` | `/pulse:seo audit` | Les audits de référencement : `seo-<AAAA-MM-JJ>.md` |
| `docs/referencement/search-console-<AAAA-MM-JJ>.md` | `/pulse:search-console` | Ce que Google voit du site sur une période : chiffres, requêtes à potentiel, pages sans impression, 3 actions ; `docs/referencement/donnees/<AAAA-MM-JJ>.json` garde l'instantané qui sert à la comparaison suivante |
| `docs/performance.md`, `docs/performance/mesures/` | `/pulse:perf` | La vitesse du site : pages suivies, dernière mesure (simulation) et vrais visiteurs, priorités, budget, historique ; chaque mesure détaillée dans un fichier JSON daté |
| `docs/aide/demande-<AAAA-MM-JJ>-<sujet>.md` | `/pulse:get-help` | Une demande d'aide prête à transmettre, sans secret |
| `docs/apprentissage.md` | `/pulse:learn` | Le carnet d'apprentissage de la personne : niveau, notions vues, points fragiles, prochains rappels. Facultatif |
| `docs/lexique.md` | toutes les commandes | Les termes techniques déjà expliqués, avec leur image du quotidien et leur statut (vu, maîtrisé) |
| `docs/guide/` | `/pulse:guide` (automatique) | Le guide de réalisation : les commandes à copier, tâche par tâche, un sous-dossier par groupe et un fichier par plan. Généré automatiquement, à laisser tel quel |
| `aidd_docs/tasks/in-progress.md` | `/pulse:express`, `/pulse:brainstorm`, `/pulse:prd`, `/pulse:us`, `/pulse:spirc`, `/pulse:implement`, `/pulse:tech`, `/pulse:ui`, `/pulse:spec`, `/pulse:plan`, `/pulse:search-console` | La décision qui attend la personne, pour la retrouver après une fermeture ou un `/clear`. Supprimé dès la décision prise ; non enregistré dans Git |
| `aidd_docs/memory/project.md`, `technical.md` | `/pulse:init`, `/pulse:memory` | La mémoire durable : vision, choix, conventions, pièges |
| `aidd_docs/memory/glossary.md` | `/pulse:brainstorm`, `/pulse:memory` | Les mots du métier et leur définition commune |
| `aidd_docs/memory/internal/decisions/` | `/pulse:brainstorm`, `/pulse:tech`, `/pulse:memory` | Les décisions difficiles à défaire (lues à la demande) |
