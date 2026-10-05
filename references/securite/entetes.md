# En-têtes de sécurité (`/pulse:security entetes`)

Les en-têtes de sécurité sont des consignes envoyées au navigateur avec chaque page : « n'affiche pas ce site dans un cadre », « ne charge des scripts que depuis ces adresses »… Ils limitent les dégâts d'une faille d'affichage (XSS) ou d'un site piégé.

Concerné seulement si l'application est servie par le web. Lire d'abord « Pile retenue » et « Hébergement et mise en ligne » de `docs/technical.md`.

## 1. Repérer les sources externes (pour la CSP)

La **Content-Security-Policy** (CSP) liste les adresses autorisées. Tout ce qui n'y figure pas est bloqué : il faut donc d'abord repérer ce que l'appli charge.

```bash
git grep -n -E "https?://|wss?://" -- . ":!docs" ":!aidd_docs" ":!*.md"
```

Puis lire chaque résultat du code client et le classer, en ajoutant les services listés dans « Pile retenue » et dans `.env.example` :

| Ce que l'appli charge | Directive de la CSP |
|---|---|
| Scripts externes | `script-src` |
| Feuilles de style externes | `style-src` |
| Polices | `font-src` |
| Images, tuiles de carte, fichiers stockés | `img-src` |
| Appels à une API, connexions en temps réel (`https://`, `wss://`) | `connect-src` |
| Contenus intégrés dans un cadre (paiement, vidéo) | `frame-src` |

Pour chaque service, vérifier dans sa documentation officielle les adresses exactes à autoriser (ne pas les deviner).

Présenter la liste à la personne : « Voici les services que votre appli utilise. Ils seront autorisés, tout le reste sera bloqué. »

## 2. Où configurer les en-têtes

Selon la pile retenue : configuration du serveur, de l'hébergeur ou du framework. Consulter la documentation officielle de l'élément retenu (outil de documentation comme context7 s'il est disponible, sinon WebFetch) pour savoir quel fichier ou quel réglage utiliser et son écriture exacte. Un seul endroit : ne pas déclarer les mêmes en-têtes à deux endroits. Si un fichier de configuration existe déjà, le compléter sans toucher au reste.

Écrire un commentaire en français au-dessus de chaque en-tête pour expliquer son rôle.

## 3. Les en-têtes attendus

| En-tête | Valeur de départ | Rôle |
|---|---|---|
| `Content-Security-Policy` | voir ci-dessous | Seules les sources listées peuvent charger du code, des styles, des images… |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Toujours en HTTPS (2 ans) |
| `X-Frame-Options` | `DENY` | Interdit d'afficher le site dans un cadre (anti-clickjacking) |
| `X-Content-Type-Options` | `nosniff` | Le navigateur ne devine pas le type des fichiers |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | N'envoie que l'origine du site aux autres sites |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Coupe les fonctions sensibles non utilisées |

CSP de départ, directive par directive, à compléter avec les sources repérées à l'étape 1 :

- `default-src 'self'`
- `script-src 'self'` + scripts externes repérés
- `style-src 'self'` + feuilles de style externes repérées
- `img-src 'self' data:` + images externes repérées
- `font-src 'self'` + polices externes repérées
- `connect-src 'self'` + API et connexions en temps réel repérées
- `frame-src` seulement si un contenu intégré est nécessaire
- `frame-ancestors 'none'`
- `base-uri 'self'`
- `form-action 'self'`
- `object-src 'none'`
- `upgrade-insecure-requests`

Les directives sont séparées par `; ` dans la valeur de l'en-tête.

- Pas de `'unsafe-inline'` dans `script-src` si possible : le code doit être dans des fichiers séparés, pas dans des attributs d'événement ni des scripts en ligne. Si la technologie retenue injecte des scripts en ligne, chercher dans sa documentation la méthode recommandée (nonce ou empreinte) ; à défaut, accepter `'unsafe-inline'` en l'expliquant à la personne.
- `'unsafe-eval'` seulement si la documentation l'exige, et uniquement en développement.
- Si l'appli utilise la géolocalisation, la caméra ou le micro, retirer la valeur correspondante de `Permissions-Policy`.
- En développement, la commande « lancer en local » peut nécessiter une connexion locale supplémentaire (rechargement automatique) : l'autoriser seulement en développement.
- `X-XSS-Protection` est **obsolète** (ignoré par les navigateurs récents) : ne pas l'ajouter ; la CSP le remplace.

## 4. Vérifier

1. Lancer l'appli avec la commande « lancer en local » de « Commandes du projet ». Si les en-têtes sont configurés chez l'hébergeur et que l'outil local ne les applique pas, vérifier après la mise en ligne.
2. `curl -sI <adresse>` : les en-têtes apparaissent dans la réponse.
3. Ouvrir l'appli, parcourir les écrans principaux avec la console du navigateur ouverte (F12) : aucune erreur « Content Security Policy » ne doit apparaître. Sinon, ajouter la source légitime bloquée, jamais `*`.
4. Après la mise en ligne : https://securityheaders.com et https://csp-evaluator.withgoogle.com.

## 5. Rapport

```
🛡️ En-têtes de sécurité – <projet>
Fichier ou réglage modifié : <emplacement, selon la pile retenue>
Services autorisés dans la CSP : <liste>
En-têtes : ✅ CSP · ✅ HSTS · ✅ X-Frame-Options · ✅ X-Content-Type-Options · ✅ Referrer-Policy · ✅ Permissions-Policy
À tester : <étapes de la section 4>
```

Prochaine étape : tester (section 4), puis `/pulse:commit`.
