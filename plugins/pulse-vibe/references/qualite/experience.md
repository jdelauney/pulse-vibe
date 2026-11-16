# Expérience de l'interface

**Ce que vit la personne quand ça charge, quand c'est vide, quand ça rate.** Ces règles disent comment l'interface se comporte et ce qu'elle dit, quelle que soit la technologie. L'apparence de chaque état (couleurs, squelette, focus visible, durées) relève de `/pulse:ui` (`ui/regles-ui.md`, `ui/motifs.md`) ; la structure des composants (présentation, orchestration, état), de `qualite/composants.md`. Le composant réel de chaque règle vient de « Pile retenue » de `docs/technical.md`, ou des consignes du pack de pile.

Chaque règle part d'un réflexe fréquent du code généré : **par défaut**, ce qu'il produit ; **ici**, ce qu'on fait ; **parce que**, la raison, pour juger les cas limites.

## 1. Les états de chaque vue

Par défaut, l'écran traite le cas où les données arrivent et sont là. Ici, chaque vue qui charge des données prévoit ses cinq états, choisis par l'orchestration et affichés par un composant de présentation, parce que la personne passe aussi par les autres, et que ce sont eux qui donnent l'impression d'un outil fini.

| État | Ce qu'on montre | Exemple |
|---|---|---|
| Chargement | La forme du contenu attendu (§ 3) | Trois lignes grises à la place des factures |
| Vide | Pourquoi c'est vide, et l'action qui le remplit quand l'application la propose | « Aucune facture pour l'instant. » + bouton « Créer une facture » |
| Erreur | Le message du § 2, et « Réessayer » | « Impossible de charger vos factures. Vérifiez votre connexion, puis réessayez. » |
| Partiel | Ce qui a marché, et un message à l'endroit de ce qui manque | La liste s'affiche ; le bloc « Totaux du mois » dit qu'il n'a pas pu se calculer |
| Succès | Le résultat à l'endroit de l'action, annoncé aux lecteurs d'écran | La ligne apparaît en tête de liste : « Facture F-2026-014 créée. » |

- **Deux vides différents** : « rien encore » invite à créer ; « aucun résultat pour ce filtre » rappelle le filtre et propose de l'effacer.
- ✗ `SI items.length = 0 ALORS afficher icône` · ✓ `SI filtreActif ALORS « Aucune facture en retard. » + « Voir toutes les factures » SINON « Aucune facture pour l'instant. » + « Créer une facture »`

## 2. Messages d'erreur

Par défaut, l'erreur s'affiche en « Une erreur est survenue. » Ici, un message dit **ce qui s'est passé**, **pourquoi** quand on le sait, et **quoi faire maintenant**, avec les mots de la personne, parce qu'un message vague la laisse sans issue et la fait recommencer à l'aveugle.

- ✗ « Erreur 413. » · ✗ « Une erreur est survenue. » · ✓ « Cette image pèse 14 Mo, au-delà de la limite de 10 Mo. Choisissez une image plus légère. »
- **Une erreur par cause** : le module d'accès aux données renvoie un code par situation attendue (droit refusé, élément disparu, saisie refusée, service indisponible), et chaque code a son message. Le détail technique reste dans le journal (`qualite/clean-code.md` § 8, S11).
- **L'erreur reste là où elle est née** : sous le champ pour une saisie, dans le bloc pour un bloc, en notification qui reste affichée jusqu'à sa fermeture pour une action.
- La saisie et le travail de la personne sont **conservés** : après l'erreur, elle corrige et renvoie, sans rien retaper.

## 3. Latence perçue

Par défaut, chaque attente affiche une roue qui tourne, même pour 80 ms. Ici, l'attente se montre seulement quand elle se voit, parce qu'un indicateur qui clignote donne une impression de lenteur.

- **Sous 300 ms environ** : rien de plus que le bouton en état « en cours ». **Au-delà** : l'indicateur, avec un texte (« Envoi en cours… »). **Au-delà de 10 secondes** : dire où on en est (« Import : 120 lignes sur 450 »).
- **Contenu structuré** (liste, fiche, tableau) : un squelette à la forme du contenu, plutôt qu'une roue au centre ; la place est réservée, et rien ne saute à l'arrivée des données.
- **Mise à jour optimiste** pour une action réversible et presque toujours réussie (cocher, renommer, ranger) : l'écran change tout de suite ; en cas d'échec, il revient à l'état d'avant et le dit. ✗ attendre la réponse du serveur pour cocher une case · ✓ la case se coche, et se décoche avec « La tâche n'a pas pu être enregistrée. Réessayez. » si le serveur refuse. Un paiement, un envoi de message ou une suppression attendent la réponse.
- Le déclencheur d'une action est inactif pendant son traitement, puis réactivé quoi qu'il arrive : elle part une seule fois.

## 4. Annuler plutôt que confirmer

Par défaut, chaque action demande « Êtes-vous sûr ? ». Ici, une action **réversible** se fait tout de suite et propose « Annuler » quelques secondes (notification, `ui/motifs.md` § 1) ; la confirmation est réservée à l'action **destructrice et irréversible**, parce qu'une confirmation à chaque geste s'accepte sans la lire, et ne protège plus le jour où elle compte.

- ✗ « Êtes-vous sûr ? » [OK] [Annuler] avant d'archiver · ✓ archivage immédiat, « Facture archivée. » [Annuler]
- Une confirmation **nomme l'objet** et porte le verbe de l'action sur son bouton : « Supprimer définitivement la facture F-2026-014 ? » [Supprimer la facture] [Garder la facture].
- Une suppression qui peut se défaire (corbeille, suppression différée) est une action réversible : « Annuler », sans confirmation.

## 5. Formulaires

Par défaut, la validation tombe d'un bloc à l'envoi, ou crie dès la première lettre tapée. Ici, parce que la personne a besoin d'un retour au bon moment, sans être interrompue :

- **Quand valider** : à la sortie du champ ; puis, une fois une erreur affichée ou le formulaire envoyé une première fois, à chaque frappe, pour que l'erreur disparaisse dès que le champ est juste. Toujours aussi côté serveur, avec les mêmes règles (S5).
- **À l'envoi refusé** : le focus va au premier champ en erreur ; un long formulaire affiche en plus, en tête, la liste des erreurs, chacune reliée à son champ.
- **Rien ne se perd** : saisie gardée après un refus du serveur, une coupure du réseau ou un retour en arrière dans le parcours.
- **Bouton d'envoi actif** : au clic, le formulaire montre ce qui manque. Il devient inactif seulement pendant le traitement, ou avec la raison écrite à côté (« Acceptez les conditions pour continuer »), parce qu'un bouton grisé sans explication ressemble à une panne.
- Message d'erreur sous le champ, relié à lui pour les lecteurs d'écran, qui dit la règle (« 8 caractères au moins, dont un chiffre ») plutôt que « Champ invalide ».
- Envoi par l'**envoi du formulaire** (la touche Entrée fonctionne) ; types de champ adaptés (e-mail, téléphone, date) et remplissage automatique.
- Après un succès : message bref, formulaire vidé, focus dans le premier champ.

## 6. Clavier et focus

Par défaut, la souris est le seul chemin testé. Ici, tout se fait au clavier, dans l'ordre de l'écran, parce qu'une partie des personnes navigue ainsi et que tout le monde gagne à aller vite.

- Tabulation pour avancer, Entrée et Espace pour agir, **Échap** pour fermer une fenêtre, un menu ou un panneau.
- **Fenêtre modale** : à l'ouverture, le focus va dans la fenêtre (son premier champ, ou son titre) et y reste ; à la fermeture, il revient sur l'élément qui l'a ouverte.
- **Après un ajout**, le focus revient dans le champ ; **après une suppression**, il va sur l'élément suivant (ou sur la liste) ; **après un changement d'écran**, sur son titre.
- Succès et erreurs passent par une zone d'annonce toujours présente (polie pour un succès, immédiate pour une erreur), remplie avec du texte.
- Focus toujours visible ; son apparence : `ui/regles-ui.md` § 7.

## 7. Données réelles

Par défaut, l'écran est pensé avec trois éléments au nom court. Ici, il tient avec les vraies données, parce que ce sont elles qui cassent la mise en page le premier jour.

- **0, 1, beaucoup** : la vue vide (§ 1), un seul élément (« 1 facture », accordé au singulier), et 1 000 éléments (pagination ou chargement par morceaux, nombre total affiché).
- **Textes longs** : un nom de 80 caractères, un mot sans espace, une adresse e-mail longue passent à la ligne ou se coupent avec « … », le texte entier restant lisible (au survol, au focus, ou à l'ouverture).
- **Langues** : une traduction peut être 30 % plus longue que le français ; les boutons et les colonnes s'élargissent plutôt que de couper le texte.
- **Dates, nombres, montants** : mis en forme par l'outil de mise en forme selon la langue de la plateforme (`Intl` en JavaScript), qui connaît les séparateurs, les espaces et l'ordre de chaque langue. ✗ `montant / 100 + " €"` · ✓ `new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(montant / 100)` → « 1 234,50 € ». Dates relatives quand elles aident (« il y a 3 minutes »), date complète au survol.
- Les données fictives des maquettes et des tests contiennent ces cas.

## 8. Les mots de l'interface

Par défaut, les boutons disent « OK », « Valider », « Soumettre », et le même objet change de nom d'un écran à l'autre. Ici, parce que la personne lit les mots pour savoir ce qui va se passer :

- **Bouton = verbe + objet** : « Enregistrer le projet », « Envoyer la facture » ; dans une confirmation, le bouton reprend l'action (§ 4).
- **Un mot par chose, partout** : celui du glossaire (`aidd_docs/memory/glossary.md`) et de « Mots de l'interface » dans `docs/voix.md` ; une « facture » ne devient pas une « note » ailleurs.
- **Succès précis** : « Facture envoyée à Marie Durand. » plutôt que « Opération réussie. »
- **Ton** : celui de `docs/voix.md` ; sans ce fichier, vouvoiement, phrases courtes, ton clair, direct et chaleureux.

## 9. Checklist (implémentation et relecture de fin)

- [ ] Chaque vue qui charge des données a ses états chargement, vide, erreur, partiel (si plusieurs sources) et succès ; le vide explique et propose l'action qui existe ; le vide d'un filtre propose de l'effacer.
- [ ] Chaque message d'erreur dit ce qui s'est passé et quoi faire, à l'endroit concerné ; un code par situation attendue ; aucun message générique seul.
- [ ] La saisie et le travail de la personne restent en place après une erreur.
- [ ] Indicateur d'attente au-delà de 300 ms environ, squelette pour un contenu structuré, mise à jour optimiste (avec retour en arrière) pour les actions réversibles fréquentes ; déclencheur inactif pendant le traitement.
- [ ] Action réversible : « Annuler » plutôt qu'une confirmation ; confirmation seulement pour l'irréversible, qui nomme l'objet, avec le verbe sur le bouton.
- [ ] Formulaires : validation à la sortie du champ, puis en direct après une erreur ou un premier envoi ; focus sur le premier champ en erreur ; bouton inactif seulement pendant le traitement ou avec sa raison écrite.
- [ ] Tout se fait au clavier ; Échap ferme ; focus géré à l'ouverture et à la fermeture des fenêtres, après un ajout, une suppression, un changement d'écran ; messages annoncés.
- [ ] Vues vérifiées avec 0, 1 et beaucoup d'éléments, un nom très long ; dates, nombres et montants mis en forme selon la langue.
- [ ] Boutons en verbe + objet ; mots du glossaire et de `docs/voix.md`, identiques sur tous les écrans ; ton de `docs/voix.md`.
