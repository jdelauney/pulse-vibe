# Les gestes de la personne, pas à pas

La personne n'est pas développeuse : elle ne devine rien. Chaque action qu'on lui demande se donne comme une recette, et ce que l'assistant peut faire lui-même, il le fait.

## 1. Faire soi-même d'abord

- Créer un fichier, y écrire une valeur **non secrète**, lancer ou arrêter l'application, lancer un contrôle ou des tests : l'assistant le fait, puis dit en une ligne ce qu'il a fait.
- Restent à la personne seulement : une **valeur secrète** (elle passe par ses mains, référence `secrets/sans-conversation.md`), un **compte** ou un **réglage chez un fournisseur** (site web), un **test dans l'application** (fiche de test), une **décision**.

## 2. Le gabarit d'une action demandée

Une action se présente toujours ainsi, dans la conversation ou dans un fichier :

1. **Pourquoi**, en une phrase (« Les tests de parcours complets ont besoin d'un compte de test pour se connecter. »).
2. **Où** : l'application (navigateur, VS Code, site du fournisseur), et le fichier en lien cliquable (`[.env.e2e](.env.e2e)`).
3. **Les gestes, numérotés** : menu ou raccourci clavier exact, texte du bouton en gras, ce qu'il faut taper mot pour mot. Les gestes courants du § 4 se recopient tels quels.
4. **Ce que vous devez voir** quand c'est réussi.
5. **La vérification** : l'assistant contrôle lui-même (commande, test), puis le dit.

## 3. Un fichier d'environnement (`.env`, `.env.local`, `.env.e2e`, `.env.test`…)

Un nouveau fichier d'environnement ou une nouvelle variable se met en place dans cet ordre :

1. **Expliquer** en une phrase à quoi sert le fichier et qui le lit (l'application, les tests de parcours…), et qu'il reste sur l'ordinateur, hors de Git.
2. **Créer** chaque ligne avec `pulse-aidd secrets preparer <NOM> --fichier <fichier>` (le fichier est créé et gardé hors de Git).
3. **Remplir soi-même** ce qui n'est pas secret (adresse locale, port, nom d'un compte de test fictif) et générer les secrets à inventer (`pulse-aidd secrets generer <NOM> --fichier <fichier>`).
4. **Déclarer** chaque nom dans `.env.example`, avec un commentaire qui dit à quoi il sert et où trouver sa valeur, et dans « Secrets et variables d'environnement » de `docs/technical.md`.
5. **Pour chaque valeur que seule la personne peut obtenir**, donner le gabarit du § 2 :
   - où la trouver, écran par écran (site du fournisseur, menu, bouton, d'après sa documentation officielle) ;
   - « Ouvrez le fichier » (§ 4), « sur la ligne `NOM=`, collez la valeur juste après le signe `=`, sans espace ni guillemets », « Enregistrez », « Fermez l'onglet du fichier ».
6. **Vérifier** : `pulse-aidd secrets verifier <NOM> --fichier <fichier>` pour chaque nom, puis relancer ce qui en avait besoin.

## 4. Les gestes courants, mot pour mot

| Geste | À écrire pour la personne |
|---|---|
| Ouvrir un terminal | « Dans VS Code, menu **Terminal** tout en haut, puis **Nouveau terminal** : un panneau s'ouvre en bas de la fenêtre. » |
| Lancer l'application | « Dans ce terminal, tapez `<commande « lancer en local » de « Commandes du projet »>` puis appuyez sur **Entrée**. Attendez qu'une adresse comme `http://localhost:3000` s'affiche : l'application tourne. Laissez ce terminal ouvert pendant le test. » |
| Arrêter l'application | « Cliquez dans le terminal où elle tourne, puis appuyez sur **Ctrl + C** (Mac : **Control + C**). » |
| Ouvrir une adresse | « Ouvrez votre navigateur, cliquez dans la barre d'adresse tout en haut, tapez `<adresse>` puis appuyez sur **Entrée**. » |
| Navigation privée | « Ouvrez une fenêtre de navigation privée : **Ctrl + Maj + N** dans Chrome ou Edge, **Ctrl + Maj + P** dans Firefox (Mac : **Cmd** au lieu de **Ctrl**). Elle démarre sans connexion enregistrée. » |
| Voir en taille téléphone | « Appuyez sur **F12** (Mac : **Cmd + Option + I**) : un panneau s'ouvre. Appuyez sur **Ctrl + Maj + M** (Mac : **Cmd + Maj + M**), puis choisissez un téléphone dans la liste en haut de la page. **F12** referme le panneau. » |
| Voir les erreurs de la page | « **F12**, puis l'onglet **Console** : les lignes rouges sont des erreurs ; copiez-les dans la conversation. » |
| Ouvrir un fichier du projet | « Dans VS Code, appuyez sur **Ctrl + P** (Mac : **Cmd + P**), tapez `<nom du fichier>` puis **Entrée**. » |
| Enregistrer, fermer un fichier | « **Ctrl + S** pour enregistrer, **Ctrl + W** pour fermer l'onglet (Mac : **Cmd**). » |
| Recharger la page sans mémoire | « **Ctrl + Maj + R** (Mac : **Cmd + Maj + R**). » |

Un geste absent de ce tableau s'écrit avec le même niveau de détail, d'après la documentation officielle de l'outil.
