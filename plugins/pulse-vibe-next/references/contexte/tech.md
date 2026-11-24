# Pack Pulse Next.js – pour /pulse:tech

Une fois la pile choisie :

1. **Base de développement**, une question : « Neon pour tout » (recommandé, rien à installer) ou « PostgreSQL dans Docker en local, Neon en ligne » (la base de développement sur l'ordinateur ; Docker Desktop à installer).
2. **Hébergement**, une question : « Vercel » (recommandé, rien à entretenir), « un serveur avec Docker » ou « un serveur sans Docker » (loué quelques euros par mois ; la personne le tient à jour et y lance chaque mise en ligne ; un serveur géré par son fournisseur : « sans Docker »). Avant la réponse, dire ce qu'un serveur demande (« Ce qu'il faut » de `pulse-aidd pile reference hebergement-docker.md` ou `hebergement-serveur.md`). Sur un serveur, une question de plus : base en ligne Neon ou PostgreSQL sur ce serveur.
3. Écrire `docs/technical.md` avec les valeurs ci-dessous (ligne `**Hébergement**` comprise ; serveur : avec les remplacements de sa fiche), adaptées au projet (données et contrôle d'accès d'après le PRD) et à la base choisie.
4. **Mise en place** : suivre la section « Mise en place » des valeurs. Docker : guider Docker Desktop pas à pas (`pulse-aidd pile reference docker.md`). Le squelette se pose avec `pulse-aidd pile squelette --nom "<nom>" --description "<phrase>"` (Docker en local : `--base postgres` ; serveur : `--hebergement docker|serveur`) : il garde `CLAUDE.md`, `README.md` et les documents Pulse, et complète `.gitignore` et `.env.example`. Puis `npm install` et `npx playwright install chromium`. Dans `README.md`, remplacer le contenu de la section « Tester en local » par le bloc de base de `pulse-aidd pile reference readme.md` (ligne 2 selon la base).
5. Vérifier que tout passe : `npm run check`, `npm run typecheck`, `npm test`, puis `npm run dev` (la page d'accueil affiche le nom du projet).
6. Si `docs/design.md` existe : appliquer le thème (`pulse-aidd pile reference theme.md`), puis remplir « Dans le code » de `docs/design.md`.
7. **En ligne dès le premier jour** (si la personne l'accepte) : la page de départ ne demande aucune variable d'environnement ; la première mise en ligne relie le dépôt GitHub à Vercel (serveur : suit sa fiche, « Première mise en ligne »), puis `pulse-aidd sonder <adresse> --texte "<nom du projet>"`.

## Contrôles proposés (Next.js)

Proposés selon `pulse-aidd reference controles-proposes.md`, une fois la mise en place faite.

- **`secrets-publics`** : une variable publique ne porte jamais un secret.
  - Condition : le dossier `app/` ou `src/` existe.
  - Phrase : « Voulez-vous que Pulse refuse qu'un mot de passe ou une clé secrète soit mis dans une variable visible par tous les visiteurs ? »
  - Ligne :

```
- Aucun secret dans une variable publique. — Contrôle : interdit `/NEXT_PUBLIC_\w*(SECRET|PRIVATE)/` dans `app/`, `src/`
```

Les autres motifs étudiés (balises `<img>`, `console.log`, `dangerouslySetInnerHTML`) peuvent viser du code légitime : ils restent des consignes.
