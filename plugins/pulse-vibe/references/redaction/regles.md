# Rédiger les textes des pages

Pour `/pulse:rediger` et l'agent `pulse:redacteur`. Un texte de page (accueil, à propos, services, présentation d'une offre) parle au public du site, dans la voix de `docs/voix.md`.

## Ce qu'est un bon texte de page

- **Une idée par section.** Le titre dit le bénéfice, dans les mots du public.
- **La première phrase porte le fait le plus utile** : ce que la personne obtient, pour qui, où, à quel prix ou dans quel délai.
- **Chaque section mène à l'action attendue** (le bouton ou le geste visé par la page).
- **Un fait concret par section** : un chiffre, un nom, un lieu, un exemple vécu.
- **La voix de `docs/voix.md`** : l'adresse (vous ou tu) reste la même du début à la fin ; les trois traits de ton se reconnaissent ; les mots du glossaire désignent les choses du métier.
- **Des phrases de longueurs variées** : des courtes pour marquer un point, des longues pour expliquer.

## Les faits

Le texte emploie seulement les faits fournis par la personne ou présents dans le projet (brief, glossaire, pages existantes). Un fait manquant s'écrit « [à compléter : …] » et se demande à la personne. Un chiffre, un avis client ou une référence ne s'invente jamais.

## Le contrôle

`pulse-aidd textes verifier docs/textes/<page>.md` applique les règles mesurables du détecteur de tics d'écriture IA (`references/redaction/detecteur-tics-llm.json`, seule source des listes). Seul le texte entre `<!-- texte -->` et `<!-- /texte -->` est contrôlé.

- **Erreurs** : corrigées avant de présenter le texte, en suivant la consigne affichée.
- **Avertissements** : jugés un par un ; corrigés, ou gardés avec une raison (un nom propre après deux-points, un mot employé dans son sens précis).

## La relecture à la main

Ces règles demandent un jugement : le contrôle les liste sous « À relire ».

| Règle | La question à se poser |
|---|---|
| SYN-004 Placement de l'adjectif | Un adjectif sonnerait-il plus naturel avant le nom (« un grand défi » plutôt que « un défi majeur ») ? |
| LIM-003 Phrases sans verbe | Le texte compte-t-il plus de deux phrases sans verbe conjugué ? |
| PAT-004 Redondances | Deux sections disent-elles la même chose avec d'autres mots ? Garder la plus précise. |
| INJ-003 Registre | Le ton varie-t-il au moins une fois tous les 400 mots (une question au lecteur, une phrase très courte, une incise) ? |
| BIA-003 Ancrages concrets | Chaque section de 300 mots porte-t-elle un fait situé (date, lieu, nom, chiffre, exemple) ? |

## Humaniser un texte existant

Garder les faits et l'intention de l'original. La nouvelle version fait entre 0,8 et 1,5 fois sa longueur. Même contrôle, même relecture.
