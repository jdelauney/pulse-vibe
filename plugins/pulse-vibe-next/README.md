# Pulse-vibe-next – le pack de pile Next.js de Pulse

**Pulse-vibe-next** ajoute à la méthode Pulse ([pulse-vibe](../pulse-vibe/README.md)) le savoir-faire d'une pile précise, pour construire une application web avec comptes et données : un code de départ vérifié, des conventions, les pièges connus des versions actuelles et des recettes prêtes. Objectif : un code juste du premier coup.

Il n'a pas de commande à lui : il s'utilise à travers les commandes `/pulse:*`, qui reçoivent ses consignes quand le projet l'a choisi.

## La pile

Next.js 16 (App Router, Cache Components, React Compiler), React 19, TypeScript, Tailwind CSS 4 et shadcn/ui, Drizzle ORM et Neon (Postgres, Francfort), better-auth, next-safe-action et Zod, TanStack Form, nuqs, pino, Biome, Vitest (avec PGlite pour la base de test), Playwright, Vercel (fonctions à Francfort). Toujours aux **dernières versions publiées** : une vérification automatique hebdomadaire les met à jour quand tout passe.

## Comment il s'utilise

1. `/pulse:tech` (ou `/pulse:express`) le propose comme option quand le projet a des écrans, des comptes ou des données partagées. La personne choisit.
2. `docs/technical.md` reçoit la ligne `**Pack de pile Pulse** : next`. Dès lors, chaque commande Pulse et chaque agent reçoivent les consignes du pack.
3. Le squelette se pose avec `pulse-aidd pile squelette --nom "<nom>" --description "<phrase>"` : page de départ, thème, configuration complète, un test unitaire et un test de bout en bout. Il garde les fichiers déjà présents.
4. Les specs et les plans s'appuient sur les **recettes** (`pulse-aidd pile recettes`, `pulse-aidd pile recette <nom>`).

| Recette | Ce qu'elle apporte |
|---|---|
| `connexion` | Inscription, connexion, déconnexion, page « mon compte » (better-auth), actions et pages réservées |
| `liste` | Liste filtrée, triée et paginée (état dans l'adresse), états vide / chargement / erreur, formulaire de création |
| `email` | Envoi d'e-mails (nodemailer, SMTP), Mailpit en local, vérification d'adresse et mot de passe oublié |
| `fichiers` | Dépôt de fichiers sur Cloudflare R2 par adresse signée, type et taille contrôlés |
| `paiement` | Stripe Checkout en mode test, webhook vérifié |
| `langues` | Plusieurs langues avec next-intl |
| `limite` | Limite de requêtes sur les formulaires publics (Upstash) |
| `seo` | Référencement : adresse du site, métadonnées complètes par page, robots.txt selon la politique IA, sitemap aux vraies dates, image de partage, données structurées typées (`schema-dts`), pages connectées hors de Google, vrai 404 |
| `mesure-reelle` | Vitesse vécue par les vrais visiteurs : Speed Insights de Vercel, ou mesures envoyées au site (table Neon, 75e centile par page) |

**Secrets** : `/pulse:secrets` reçoit la fiche de chaque variable du squelette et des recettes (où la renouveler, effet, délai de grâce, test). Avec le Vercel CLI connecté (`vercel login`, `vercel link`), les valeurs partent vers Vercel par l'entrée standard, sans passer par la conversation.

**Référencement, vitesse, Search Console** : le squelette pose déjà l'adresse du site, les métadonnées, `robots.txt`, le sitemap, l'image de partage et les icônes ; `/pulse:seo`, `/pulse:perf` et `/pulse:search-console` reçoivent les consignes propres à Next.js et Vercel.

## Contenu

```
.claude-plugin/plugin.json   manifeste ; dépend de pulse-vibe
bin/pulse-pile-next          info | contexte <commande> | reference <chemin> | recettes | recette <nom> | squelette | seo-code | secrets | hebergeur
references/                  fiche.md (règles de la pile), technical.md (valeurs de docs/technical.md),
                             theme.md (de docs/design.md à shadcn), contexte/ (consignes par commande), recettes/
templates/squelette/         le projet de départ
scripts/                     squelette.js (pose le squelette), verifier-squelette.js (vérification, référencement du squelette servi, mise à jour des versions),
                             seo-code.js (contrôles du code pour le référencement), sondes-secrets.js (règles et tests réels des secrets),
                             secrets-vercel.js (adaptateur Vercel de pulse-aidd secrets)
tests/                       tests du pack
```

## Installation

```
/plugin marketplace add jdelauney/pulse-vibe
/plugin install pulse-vibe-next@pulseia
```

L'installation ajoute aussi `pulse-vibe` (dépendance). Redémarrer Claude Code ensuite.

## Maintenance

- `node plugins/pulse-vibe-next/scripts/verifier-squelette.js [--dernieres] [--ecrire] [--e2e]` : crée un projet avec le squelette (dernières versions avec `--dernieres`), puis installe, contrôle, teste et construit. La CI du dépôt le lance chaque semaine et propose une demande de fusion quand des versions plus récentes passent.
- Un piège découvert à l'usage devient une ligne de `references/fiche.md`, avec sa raison.
