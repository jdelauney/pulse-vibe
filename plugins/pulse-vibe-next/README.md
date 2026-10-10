# Pulse Next – le pack de pile Next.js de Pulse

**Pulse-next** (plugin `pulse-next`) ajoute à la méthode Pulse ([plugin `pulse`](../pulse-vibe/README.md)) le savoir-faire d'une pile précise, pour construire une application web avec comptes et données : un code de départ vérifié, des conventions, les pièges connus des versions actuelles et des recettes prêtes. Objectif : un code juste du premier coup.

Il n'a pas de commande à lui : il s'utilise à travers les commandes `/pulse:*`, qui reçoivent ses consignes quand le projet l'a choisi.

## La pile

Next.js 16 (App Router, Cache Components, React Compiler), React 19, TypeScript, Tailwind CSS 4 et shadcn/ui, Drizzle ORM et Neon (Postgres, Francfort), better-auth, next-safe-action et Zod, TanStack Form, nuqs, pino, Biome, Vitest (avec PGlite pour la base de test), Playwright, Vercel (fonctions à Francfort). Toujours aux **dernières versions publiées** : une vérification automatique hebdomadaire les met à jour quand tout passe.

## Comment il s'utilise

1. `/pulse:tech` (ou `/pulse:express`) le propose comme option quand le projet a des écrans, des comptes ou des données partagées. La personne choisit.
2. `docs/technical.md` reçoit la ligne `**Pack de pile Pulse** : next`. Dès lors, chaque commande Pulse et chaque agent reçoivent les consignes du pack.
3. Le squelette se pose avec `pulse-aidd pile squelette --nom "<nom>" --description "<phrase>"` : page de départ, thème, configuration complète, un test unitaire et un test de bout en bout. Il garde les fichiers déjà présents.
4. Les specs et les plans s'appuient sur les **recettes** (`pulse-aidd pile recettes`, `pulse-aidd pile recette <nom>`). Chaque recette est découpée en étapes : la vue d'ensemble d'abord, puis une étape à la fois (`pulse-aidd pile recette <nom> etape <id>`) et le code de ses tests (`pulse-aidd pile recette <nom> tests`). Le pack répond de la même façon à `pulse-pile-next recette`.
5. **Deux bases séparées** : la production (branche principale de Neon) et une base de développement (branche `dev`). Les **migrations** (dossier `drizzle/`, générées puis relues) s'appliquent à la base de développement pendant le travail ; en ligne, chaque construction sur Vercel les applique avant de publier, après une sauvegarde de la base. Le retour arrière est écrit dans `docs/technical.md` du projet (section « Retour arrière ») : le site d'abord, puis les données si besoin. Un projet plus ancien se met à niveau avec `/pulse:init`.
6. **Surveillance sans service tiers** : le squelette journalise les erreurs du serveur et celles du navigateur (Vercel → Logs → filtre Level « Error » ; 1 heure de conservation sur l'offre Hobby), sans les valeurs des requêtes SQL ni les adresses e-mail dans les journaux, et répond sur `/api/sante` pour la sonde de disponibilité. Chaque construction sur Vercel lance les tests avant les migrations ; une prévisualisation ne migre jamais la base de production (le repère `NEON_ENDPOINT_PRODUCTION` est enregistré par l'envoi de la clé Neon).
7. **Recettes vérifiées** : chaque semaine, la CI pose chaque recette sur le squelette aux dernières versions, puis contrôle, teste et construit le projet (`verifier-recettes.js --toutes`) ; à chaque modification du pack, elle vérifie les chaînes qui contiennent une recette modifiée (`--depuis`). Ce qui ne se vérifie pas hors ligne est nommé dans l'index de la recette.
8. **Accessibilité mesurée** : cibles tactiles de 44 px sur téléphone, contrastes du texte secondaire et des graphiques, en clair et en sombre, contrôlés par les tests du pack ; axe et tailles des cibles contrôlés par `accessibilite.spec.ts`. Le test de bout en bout lit le port dans la variable `PORT` (3000 par défaut).

| Recette | Ce qu'elle apporte |
|---|---|
| `connexion` | Inscription, connexion, déconnexion, page « mon compte » (better-auth), actions et pages réservées |
| `liste` | Liste filtrée, triée et paginée (état dans l'adresse), états vide / chargement / erreur, formulaire de création |
| `email` | Envoi d'e-mails (nodemailer, SMTP), Mailpit en local, vérification d'adresse et mot de passe oublié |
| `fichiers` | Dépôt de fichiers sur Cloudflare R2 par adresse signée, type et taille contrôlés |
| `paiement` | Stripe Checkout en mode test, webhook vérifié |
| `langues` | Plusieurs langues avec next-intl |
| `limite` | Limite de requêtes : connexion, inscription, formulaires (base Neon par défaut, Upstash en option) |
| `formulaire-public` | Protection des formulaires ouverts à tous : champ piège, délai signé, limite, Turnstile en option |
| `seo` | Référencement : adresse du site, métadonnées complètes par page, robots.txt selon la politique IA, sitemap aux vraies dates, image de partage, données structurées typées (`schema-dts`), pages connectées hors de Google, vrai 404 |
| `mesure-reelle` | Vitesse vécue par les vrais visiteurs : Speed Insights de Vercel, ou mesures envoyées au site (table Neon, 75e centile par page) |

**Secrets** : `/pulse:secrets` reçoit la fiche de chaque variable du squelette et des recettes (où la renouveler, effet, délai de grâce, test). Avec le Vercel CLI connecté (`vercel login`, `vercel link`), les valeurs partent vers Vercel par l'entrée standard, sans passer par la conversation.

**Référencement, vitesse, Search Console** : le squelette pose déjà l'adresse du site, les métadonnées, `robots.txt`, le sitemap, l'image de partage et les icônes ; `/pulse:seo`, `/pulse:perf` et `/pulse:search-console` reçoivent les consignes propres à Next.js et Vercel.

## Contenu

```
.claude-plugin/plugin.json   manifeste ; dépend de pulse
bin/pulse-pile-next          info | contexte <commande> | reference <chemin> | recettes | recette <nom> [etape <id> | tests] | squelette | seo-code | secrets | hebergeur
bin/pulse-pile-next.ps1      relais pour PowerShell (arguments transmis tels quels) ; bin/pulse-pile-next.cmd : relais pour l'invite de commandes (cmd)
references/                  fiche.md (règles de la pile), technical.md (valeurs de docs/technical.md),
                             theme.md (de docs/design.md à shadcn), architecture.md (structure hexagonale et règles de dépendance), contexte/ (consignes par commande), recettes/<nom>/ (index.md, une étape par fichier, tests.md),
                             migrations.md (mettre à niveau un projet plus ancien), readme.md (section « Tester en local » du README du projet)
templates/squelette/         le projet de départ
scripts/                     squelette.js (pose le squelette), verifier-squelette.js (vérification, référencement du squelette servi sur un port libre, mise à jour des versions ; un test instable fait échouer ; dossier temporaire retiré, sauf --garder),
                             seo-code.js (contrôles du code pour le référencement), sondes-secrets.js (règles, tests réels des secrets envoyés seulement aux serveurs reconnus, et variables déduites : « suites »),
                             secrets-vercel.js (adaptateur Vercel de pulse-aidd secrets),
                             decouper-recette.js (découpe une recette rédigée d'un seul tenant en index, étapes et tests ; vérifie la recomposition exacte)
tests/                       tests du pack
```

## Installation

Prérequis : ceux de la méthode Pulse (Git, Node.js 22.19 ou plus), et npm, livré avec Node.js.

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse-next@pulseia
```

L'installation ajoute aussi `pulse` (dépendance). Redémarrer Claude Code ensuite.

## Maintenance

- `node plugins/pulse-vibe-next/scripts/verifier-squelette.js [--dernieres] [--ecrire] [--e2e]` : crée un projet avec le squelette (dernières versions avec `--dernieres`), puis installe, contrôle, teste et construit. La CI du dépôt le lance chaque semaine et propose une demande de fusion quand des versions plus récentes passent.
- `node plugins/pulse-vibe-next/scripts/verifier-recettes.js --recettes connexion,liste` : pose les recettes balisées dans l'ordre sur le squelette, puis contrôle, teste et construit le projet. `--toutes` vérifie chaque chaîne de `CHAINES` (toutes les recettes du pack) : la CI du dépôt le lance chaque semaine et à la demande. À chaque modification du pack, `--depuis <base>` vérifie seulement les chaînes qui contiennent une recette modifiée (toutes si le squelette, `squelette.js`, `decouper-recette.js`, `verifier-recettes.js` ou le workflow changent). Balises : `fichier`, `ajout`, `remplacer`, `remplacer-ligne`, `commande`, `supprimer`, `deplacer`, et `sans-verification` pour un bloc impossible à construire hors ligne (sa raison est listée à la fin).
- Un piège découvert à l'usage devient une ligne de `references/fiche.md`, avec sa raison.
