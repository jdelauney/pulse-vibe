# Cas limites

**Ce qui arrive quand la personne, le réseau ou les données sortent du cas prévu.** Utilisé par `/pulse:plan` pour remplir la section « Cas limites et états à couvrir » de la conception technique ; l'implementer, le test-writer et les relecteurs lisent ensuite cette section comme une partie de la spec.

Par défaut, le code généré traite le cas nominal et teste le cas nominal. Ici, chaque US passe ses familles de cas une à une, et retient ceux qui peuvent réellement arriver, parce que ce sont eux qui cassent une application le premier jour, et que personne ne les essaie à la main.

## 1. Les familles

| Famille | Cas à se demander | Exemple |
|---|---|---|
| **Entrées** | vide, absente, au maximum et juste au-delà, très grande (10 000 lignes, texte de 5 000 caractères), caractères inattendus (accents, emoji, espaces au début), doublon | un titre de 121 caractères quand la limite est 120 |
| **Temps** | limite exacte (« échue aujourd'hui »), minuit, fuseau horaire, changement d'heure, 29 février | une facture due le jour même : en retard ou non ? |
| **Concurrence** | double clic, double envoi, deux onglets, deux personnes sur la même donnée, donnée supprimée pendant qu'on la regarde | deux clics rapides sur « Créer la facture » |
| **Réseau et services** | coupure pendant l'envoi, réponse lente, service externe en panne, réponse inattendue | l'envoi de l'e-mail échoue après l'enregistrement |
| **Droits** | personne déconnectée, session expirée, donnée d'une autre personne (S3), rôle insuffisant (S4) | l'adresse d'une facture d'un autre compte tapée à la main |
| **Parcours** | première utilisation (aucune donnée), retour arrière du navigateur, rechargement en plein formulaire, lien ancien vers une donnée supprimée | la page d'une facture supprimée ouverte depuis un favori |

## 2. Retenir et prouver

- **Retenir** les cas qui peuvent arriver dans cette US, avec ses données et ses écrans : souvent 3 à 8. Un cas sans rapport (aucune date dans l'US, aucun service externe) ne s'écrit pas.
- **Dire ce que vit la personne**, avec les mots du métier : « une seule facture est créée, le bouton reste inactif pendant l'envoi ». Une réponse que la spec ne donne pas (ce que la personne voit ou ce qui est gardé) va dans « Ajouts proposés par Pulse » du plan, pour sa décision.
- **Rattacher** chaque cas à la tâche qui le traite.
- **Prouver** chaque cas au niveau le plus bas qui suffit (`tests/strategie.md` § 2) : un test unitaire pour une limite de règle, un test d'intégration pour une donnée enregistrée ou refusée, un test de bout en bout pour un parcours, `@manuel` pour ce qui se voit seulement à l'écran ; sans outil de test (« Tester » vaut « aucune »), `@manuel`.
- **Un test vérifie un comportement observable** (le résultat, le message, la donnée enregistrée ou refusée), plutôt que la façon de faire (un appel interne, un nombre d'appels), parce qu'un test qui suit l'implémentation casse à chaque réécriture sans protéger la personne.

```
✗ test : « creerFacture appelle repository.insert une fois »
✓ test : « US-003-4 – Deux envois du même formulaire : une seule facture enregistrée »
```

## 3. Liste de contrôle

- [ ] Chaque famille du § 1 a été passée pour l'US ; les cas retenus peuvent réellement arriver.
- [ ] Chaque cas dit ce que vit la personne ; une réponse absente de la spec est dans « Ajouts proposés par Pulse ».
- [ ] Chaque cas a sa tâche et sa preuve (test du niveau le plus bas qui suffit, ou `@manuel`).
- [ ] Chaque test d'un cas vérifie un comportement observable.
