# Pack Pulse Next.js – pour /pulse:tech

La pile de ce pack est **une option** du tableau « Les options comparées » : une application web avec pages, comptes, données partagées, hébergée en Europe. Elle convient quand le besoin demande une interface web et des données côté serveur ; pour une simple page vitrine sans données, elle est surdimensionnée : le dire, et présenter alors une option plus légère.

À la vérification (étape 4), contrôler en particulier : l'offre gratuite de Neon (stockage, transfert, mise en veille) et de Vercel (Hobby : usage non commercial ; Pro pour un usage commercial), la région Francfort pour les données personnelles, les dernières versions publiées (`npm view next version`).

Une fois la pile choisie :

1. Écrire `docs/technical.md` avec les valeurs de la section « Valeurs de docs/technical.md » ci-dessous, dont la ligne `**Pack de pile Pulse** : next`, adaptées au projet (tableau des données et du contrôle d'accès d'après le PRD).
2. **Mise en place** : suivre la section « Mise en place » des valeurs. Le squelette se pose avec `pulse-aidd pile squelette --nom "<nom>" --description "<phrase>"` : il garde `CLAUDE.md`, `README.md` et les documents Pulse, et complète `.gitignore` et `.env.example`. Puis `npm install` et `npx playwright install chromium`.
3. Vérifier que tout passe : `npm run check`, `npm run typecheck`, `npm test`, puis `npm run dev` (la page d'accueil affiche le nom du projet).
4. Si `docs/design.md` existe : appliquer le thème (référence « Le thème »), puis remplir « Dans le code » de `docs/design.md`.
5. **En ligne dès le premier jour** (si la personne l'accepte) : la page de départ ne demande aucune variable d'environnement ; la première mise en ligne relie le dépôt GitHub à Vercel, puis `pulse-aidd sonder <adresse> --texte "<nom du projet>"`.
