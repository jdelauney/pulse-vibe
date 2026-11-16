# Générer une entité (`pulse-aidd pile entite`)

**Tout le code d'un type d'information de la spec, écrit d'un coup** : liste filtrée, triée et paginée, création, modification, suppression, avec leurs tests. Le code est celui de la recette `liste`, déjà vérifié, généralisé à 7 types de champs. L'IA écrit ensuite seulement l'écart avec la spec (règle métier, libellé, écran particulier).

Prérequis : le squelette et la recette `connexion` (chaque ligne appartient à la personne connectée).

## 1. La description

Un fichier JSON, écrit d'après les « Informations manipulées » de la spec, hors des dossiers du code (par exemple `aidd_docs/tasks/<epic>/facture.entite.json`) :

```json
{
  "domaine": "factures", "sujet": "facture", "pluriel": "factures",
  "libelle": "facture", "libellePluriel": "factures", "feminin": true,
  "route": "/factures", "titre": "client",
  "champs": [
    { "nom": "client", "libelle": "Client", "type": "texte", "obligatoire": true, "max": 120 },
    { "nom": "notes", "libelle": "Notes", "type": "texte-long", "max": 2000 },
    { "nom": "quantite", "libelle": "Quantité", "type": "nombre", "min": 0, "max": 9999 },
    { "nom": "montant", "libelle": "Montant", "type": "montant", "obligatoire": true },
    { "nom": "echeance", "libelle": "Échéance", "type": "date", "obligatoire": true },
    { "nom": "statut", "libelle": "Statut", "type": "choix", "valeurs": { "brouillon": "Brouillon", "envoyee": "Envoyée" }, "defaut": "brouillon" },
    { "nom": "payee", "libelle": "Payée", "type": "oui-non" }
  ]
}
```

| Clé | Contenu |
|---|---|
| `domaine` | Le domaine du glossaire, en minuscules sans accent, mots séparés par des tirets : les dossiers `src/core/<domaine>/`, `src/db/<domaine>/`, `src/features/<domaine>/` |
| `sujet`, `pluriel` | Un élément et son pluriel, même écriture (`facture`, `factures`) : noms des fichiers, des classes et de la table |
| `libelle`, `libellePluriel` | Les mots affichés, en minuscules comme au milieu d'une phrase (`facture`, `factures`) |
| `feminin` | `true` pour « une facture », `false` pour « un client » : accords des messages (« Facture créée. ») |
| `elision` | Facultatif : `true` ou `false` pour forcer « l'… » ; par défaut, élision devant une voyelle ou un h (« l'article ») |
| `route` | L'adresse de la liste (`/factures`) ; la modification est à `<route>/<id>` ; les deux pages sont dans `app/(connecte)/` |
| `titre` | Le champ `texte` obligatoire qui nomme un élément (20 caractères au moins) : recherche, messages, confirmation de suppression |
| `champs` | Les informations d'un élément, dans l'ordre du formulaire |

Chaque champ : `nom` (camelCase sans accent : `dateEcheance`), `libelle` (le texte affiché au-dessus du champ), `type`, et selon le type :

| Type | Options | Enregistré | Saisi |
|---|---|---|---|
| `texte` | `obligatoire`, `max` (200 par défaut) | `text` | champ d'une ligne |
| `texte-long` | `obligatoire`, `max` (5 000 par défaut) | `text` | zone de texte ; absent du tableau |
| `nombre` | `obligatoire`, `min`, `max` (entiers) | `integer` | nombre entier |
| `montant` | `obligatoire`, `min`, `max` (en euros, 2 décimales) | centimes entiers, colonne `<nom>_centimes` | euros (`120,50`), affiché avec `Intl` |
| `date` | `obligatoire` | `timestamp with time zone`, à midi UTC | champ date, affiché à l'heure de Paris |
| `choix` | `valeurs` (2 au moins : `{ "cle": "Libellé" }`), `defaut` (la première valeur sinon) | énumération Postgres | liste déroulante ; filtre de la liste ; badge |
| `oui-non` | `defaut` (`false` sinon) | `boolean` | case à cocher |

Un champ sans `"obligatoire": true` est facultatif : vide, il s'enregistre vide (`null`). Les colonnes `id`, `utilisateur_id` et `cree_le` s'ajoutent d'office : donnez aux champs un autre nom que `id`, `utilisateurId`, `creeLe`, `recherche`, `tri` et `page` (déjà pris par ces colonnes et par l'adresse de la liste). La description est contrôlée avant toute écriture : chaque problème est nommé, en français.

## 2. Lancer

```bash
pulse-aidd pile entite aidd_docs/tasks/<epic>/facture.entite.json --essai   # la liste des fichiers, sans rien écrire
pulse-aidd pile entite aidd_docs/tasks/<epic>/facture.entite.json --us US-003
```

`--us` place l'étiquette d'US en tête du titre de chaque test de l'entité (« US-003 – … ») ; renommez ensuite les titres d'après les scénarios de la spec (`US-003-2 – …`). Le générateur écrit seulement des fichiers nouveaux : un fichier déjà présent arrête tout (la liste des conflits s'affiche, rien n'est écrit). Les aides communes (`src/lib/helpers/`) déjà présentes sont gardées telles quelles quand elles exportent ce dont l'entité a besoin. Les fichiers écrits passent ensuite par le Biome du projet (`biome check --write`).

Puis les gestes affichés, dans l'ordre : composants shadcn qui manquent (`npx shadcn@latest add …`, en répondant non au remplacement de `button.tsx`), migration (`npm run db:generate`, relecture du SQL, `npm run db:migrate`), adresse ajoutée au `matcher` de `proxy.ts`, puis `npm run check`, `npm run typecheck`, `npm test`.

## 3. Ce qui est écrit

| Couche | Fichiers |
|---|---|
| Métier | `src/core/<d>/<sujet>.entity.ts` (classe avec `versVue()`, type `<Sujet>Vue`, valeurs des choix, tris), `.errors.ts` (`<sujet>-introuvable`), `<sujet>-repository.port.ts` |
| Stockage | `src/db/<d>/<sujet>.table.ts`, `<sujet>.repository.ts` (lister, trouver, insérer, modifier, supprimer : chaque requête porte la condition `utilisateurId`) |
| Écran et actions | `src/features/<d>/` : `constants/<pluriel>.ts`, `constants/erreur-messages.ts`, `schemas/<sujet>.schema.ts` (Zod partagé formulaire ↔ action), `schemas/filtres-<pluriel>.schema.ts` (nuqs), `queries/lister-<pluriel>.query.ts`, `queries/trouver-<sujet>.query.ts` (`notFound()`), `actions/creer-`, `modifier-`, `supprimer-<sujet>.action.ts` (`actionConnectee`), sections `formulaire-<sujet>.tsx` et `tableau-<pluriel>.tsx`, containers de création, modification, suppression (confirmation qui nomme l'élément), filtres, pagination, liste |
| Pages | `app/(connecte)/<route>/page.tsx` et `[id]/page.tsx`, chacune avec son `error.tsx` |
| Tests | schéma (unitaires), repository sur PGlite (dont `@securite` : une autre personne ne lit, ne modifie ni ne supprime une ligne), parcours `e2e/<pluriel>.spec.ts` (créer, modifier, supprimer) |
| Aides communes | `src/lib/helpers/` : `pagination/`, `format/` (`format.ts`, `nombre.ts`), `formulaire/erreurs-de-champs.ts`, `saisie/saisie.ts` (euros ↔ centimes, jour saisi ↔ date) |

Sans règle métier, les actions appellent directement le repository (architecture.md § 5). Une règle de la spec (un montant positif, une transition de statut) s'ajoute ensuite : méthode de l'entité, use-case qui reçoit le port, action qui l'appelle, et ses tests.

## 4. Limites

- Une entité par domaine : `constants/erreur-messages.ts` est propre au domaine ; pour un second sujet du même domaine, le générateur signale ce fichier en conflit. Choisissez alors un autre domaine, ou écrivez le second sujet d'après le premier.
- Pas de relation entre deux entités (une ligne de facture rattachée à sa facture) : la colonne et son choix s'ajoutent à la main.
- Les montants sont positifs ou nuls ; un nombre est entier.

## 5. Dans le plan

Une seule tâche par type d'information, après la recette `connexion`, au titre « Entité : <sujet> » (ou avec la ligne « Entité : <sujet> ») : elle garde le découpage du générateur, comme une tâche de recette (`pulse-aidd verifier-plan` ne la signale pas pour son nombre de fichiers).

- Fichiers : à créer : la description `aidd_docs/tasks/<epic>/<sujet>.entite.json`, puis `src/core/<domaine>/`, `src/db/<domaine>/`, `src/features/<domaine>/`, `app/(connecte)/<route>/`, `e2e/<pluriel>.spec.ts` · à modifier : `proxy.ts`
- Action manuelle : `npm run db:migrate` (la personne, sur sa base de développement)
- Tests : les scénarios de la liste, de la création, de la modification et de la suppression ; ceux qui portent sur la propriété des lignes (`@securite`) sont couverts par le test du repository.

Chaque règle métier de la spec (un montant positif, le passage d'un statut à l'autre) fait ensuite sa propre tâche, ordinaire.
