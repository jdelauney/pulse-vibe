#!/usr/bin/env bash
# Projet d'essai : US-002 (cocher un article) n'a pas de spec, et deux exigences se contredisent. Le brief veut qu'un
# article coché disparaisse aussitôt de la liste ; un critère de l'US veut qu'on le décoche en le touchant à nouveau,
# ce qui demande qu'il reste visible. La spec doit rester en brouillon et poser cette contradiction en tête de ses
# questions, avec un choix proposé, au lieu de trancher seule.
. "$(dirname "$0")/../_communs/projet.sh"

cat >> docs/brief.md <<'EOT'

Un article coché disparaît aussitôt de la liste : elle reste courte pendant les courses.
EOT

sed -i 's/^US-001$/US-001 → US-002/' docs/user-stories.md
echo '| US-002 | Cocher un article acheté | membre de la famille | Indispensable | S | US-001 | [US-002-cocher-article.md](../aidd_docs/tasks/tenir-liste/US-002-cocher-article.md) |' >> docs/user-stories.md

ecrire aidd_docs/tasks/tenir-liste/US-002-cocher-article.md <<'EOT'
# US-002 – Cocher un article acheté

**En tant que** membre de la famille, **je souhaite** cocher un article mis dans le panier **afin que** les autres ne l'achètent pas une seconde fois.

**Priorité** : Indispensable · **Taille** : S · **Dépend de** : US-001

## Critères d'acceptation

1. **Cas nominal** – **Étant donné** « Pain » dans la liste, **lorsque** je le coche, **alors** il est marqué comme acheté.
2. **Cas limite** – **Étant donné** « Pain » coché par erreur, **lorsque** je le touche à nouveau, **alors** il redevient à acheter.
EOT

git -c user.email=essai@example.com -c user.name=essai add -A
git -c user.email=essai@example.com -c user.name=essai commit -q -m "docs: US-002"
