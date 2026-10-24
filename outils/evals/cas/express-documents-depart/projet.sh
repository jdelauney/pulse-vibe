#!/usr/bin/env bash
# Un projet Pulse tout neuf (CLAUDE.md seul) et un cahier des charges dans docs/depart/.
set -euo pipefail
mkdir -p docs/depart aidd_docs/memory
cat > CLAUDE.md <<'FIN'
# Salon Lila

## Résumé du projet

Ce projet suit la **méthode Pulse** (plugin `pulse`).

<!-- pulse_pile:debut -->
Pile non choisie : lancer `/pulse:tech`.
<!-- pulse_pile:fin -->

<!-- pulse_profil:debut -->
- **Niveau** : Jamais programmé
- **Explications** : normales
- **Rythme** : complet
<!-- pulse_profil:fin -->
FIN
cat > docs/depart/cahier-des-charges.md <<'FIN'
# Carnet de réservations du Salon Lila

Pour qui : les clientes du salon de coiffure, et la coiffeuse.
Aujourd'hui : les rendez-vous se prennent par téléphone pendant que la coiffeuse coiffe.
Écrans : prise de rendez-vous (prestation, créneau libre, nom, e-mail) ; rendez-vous du jour, réservé au salon.
Apparence : chaleureux, simple, soigné.
Contraintes : nom et e-mail des clientes ; gratuit pour commencer.
FIN
git init -q
# Nom d'auteur des commits de l'essai : pendant l'essai, le bac à sable protège .git/config en écriture.
git config user.name essai
git config user.email essai@example.com
