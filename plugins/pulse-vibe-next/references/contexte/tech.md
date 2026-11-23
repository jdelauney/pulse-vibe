# Pack Pulse Next.js – pour /pulse:tech

Une fois la pile choisie :

1. **Base de développement**, une question : « Neon pour tout » (recommandé, rien à installer) ou « PostgreSQL dans Docker en local, Neon en ligne » (la base de développement sur l'ordinateur ; Docker Desktop à installer). La production reste sur Neon.
2. Écrire `docs/technical.md` avec les valeurs de la section « Valeurs de docs/technical.md » ci-dessous, dont la ligne `**Pack de pile Pulse** : next`, adaptées au projet (tableau des données et du contrôle d'accès d'après le PRD) et à la base choisie.
3. **Mise en place** : suivre la section « Mise en place » des valeurs. Docker : guider Docker Desktop pas à pas (`pulse-aidd pile reference docker.md`). Le squelette se pose avec `pulse-aidd pile squelette --nom "<nom>" --description "<phrase>"` (Docker : `--base postgres`) : il garde `CLAUDE.md`, `README.md` et les documents Pulse, et complète `.gitignore` et `.env.example`. Puis `npm install` et `npx playwright install chromium`. Dans `README.md`, remplacer le contenu de la section « Tester en local » par le bloc de base de `pulse-aidd pile reference readme.md` (ligne 2 selon la base).
4. Vérifier que tout passe : `npm run check`, `npm run typecheck`, `npm test`, puis `npm run dev` (la page d'accueil affiche le nom du projet).
5. Si `docs/design.md` existe : appliquer le thème (`pulse-aidd pile reference theme.md`), puis remplir « Dans le code » de `docs/design.md`.
6. **En ligne dès le premier jour** (si la personne l'accepte) : la page de départ ne demande aucune variable d'environnement ; la première mise en ligne relie le dépôt GitHub à Vercel, puis `pulse-aidd sonder <adresse> --texte "<nom du projet>"`.

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
