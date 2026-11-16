# La vitesse du code

Utilisé par `/pulse:perf code` et l'agent `pulse:perf-auditor`. La vitesse vécue au chargement d'une page reste à `/pulse:perf mesurer` ; ici, une partie précise du code : une fonction, une requête, une action, un calcul, la mémoire.

Par défaut, le code généré « optimise » à l'œil : un cache, une mémoïsation, un algorithme plus malin, sans chiffre avant ni après. Ici, **aucune optimisation sans mesure de départ**, parce qu'une optimisation non mesurée complique le code sans preuve de gain, et vise souvent le mauvais endroit.

## 1. La procédure

1. **La métrique** : ce qui est lent, en une phrase de la personne (« la liste des factures met 3 secondes à s'afficher »), traduit en une mesure : temps d'une fonction ou d'une action, durée d'une requête, nombre de requêtes par écran, mémoire, poids du code envoyé au navigateur, temps de réaction à un clic. L'objectif vient de la spec quand elle en donne un (« en moins de 500 ms »), sinon de la personne.
2. **La mesure de départ** : sur des données réalistes (le volume attendu dans un an, pas trois lignes), 5 mesures au moins après une mesure de chauffe ; on garde la **médiane** et l'écart. Le protocole s'écrit (commande, données, machine) pour être rejoué à l'identique.
3. **Le goulot** : l'endroit qui prend le temps, trouvé par la mesure (profilage, chronométrage par étape, plan d'exécution d'une requête), pas deviné.
4. **Une seule optimisation à la fois**, la plus simple qui vise le goulot, avec le gain attendu.
5. **La mesure d'après**, même protocole, et les tests du projet toujours verts.
6. **Le rapport** : avant, après, gain, en chiffres (médianes et écarts).

## 2. Le seuil

Une optimisation qui rend le code plus difficile à lire ou à changer (cache à invalider, code dupliqué, algorithme plus compliqué) se garde seulement si le gain atteint **20 % de la métrique, ou 50 ms sur une action de la personne**. En dessous, elle se retire, et le rapport le dit avec les chiffres. Une optimisation qui simplifie le code, ou le laisse aussi simple, se garde dès qu'elle ne ralentit rien.

Un gain inférieur à l'écart entre les mesures est « dans le bruit » : il ne compte pas, la mesure se refait avec plus de passages.

## 3. Les goulots fréquents

| Signe mesuré | Cause fréquente | Version simple |
|---|---|---|
| Une requête par élément d'une liste | requêtes en boucle (N+1) | une seule requête avec une jointure, ou une lecture groupée |
| Requête lente sur une grande table | colonne filtrée ou triée sans index | un index sur cette colonne, vérifié par le plan d'exécution |
| Temps qui quadruple quand les données doublent | double boucle (recherche dans un tableau à chaque tour) | une table de correspondance (`Map`, `Set`) construite une fois |
| Le même calcul refait pour chaque affichage ou chaque appel | résultat recalculé sans changement des entrées | calcul déplacé hors de la boucle ; un cache seulement si la mesure le demande |
| Appels réseau qui s'attendent l'un l'autre sans raison | `await` en série d'appels indépendants | appels lancés ensemble, puis attendus ensemble |
| Mémoire qui grandit à chaque action | écouteur ou minuterie jamais retirés, liste qui s'accumule | retrait à la fin, taille bornée |

## 4. Le rapport

`docs/performance/code-<AAAA-MM-JJ>.md` (suffixe `-2` si le fichier existe) :

```
# Vitesse du code – <ce qui est mesuré> – <date>

**Verdict** : <✅ gardée | ↩️ retirée (sous le seuil) | ⏸ aucune optimisation utile>
**Métrique** : <…> · **Objectif** : <…, ou « aucun »> · **Protocole** : <commande, données, machine, n mesures>

| Mesure | Médiane | Écart |
|---|---|---|
| Avant | | |
| Après | | |

**Goulot** : <où, et la mesure qui le montre> · **Optimisation** : <une seule, et ce qu'elle change dans le code> · **Gain** : <x % / x ms> · **Seuil** : 20 % ou 50 ms
```

## 5. Liste de contrôle

- [ ] La métrique est une mesure précise, sur des données réalistes ; l'objectif est écrit.
- [ ] La mesure de départ existe : médiane et écart de 5 mesures au moins, après une chauffe ; protocole écrit.
- [ ] Le goulot est montré par une mesure.
- [ ] Une seule optimisation a changé ; les tests du projet restent verts.
- [ ] Avant et après sont mesurés par le même protocole ; un gain dans le bruit ne compte pas.
- [ ] Une optimisation qui complique le code sous le seuil (20 % ou 50 ms) est retirée, et le rapport le dit.
