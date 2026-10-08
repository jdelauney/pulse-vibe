# Pack Pulse Next.js – pour Search Console

**Next.js 16** sur **Vercel**. Les étapes générales (propriété, sitemap, Bing, accès en lecture) sont dans `/pulse:search-console` ; voici où elles se font dans cette pile.

## Balise de vérification (préfixe d'URL, ou repli quand le DNS bloque)

Dans l'objet `metadata` du layout racine `app/layout.tsx`, ajouter le champ `verification` (doc Next.js 16.4, `generateMetadata` → `verification`) :

```tsx
export const metadata: Metadata = {
  // … champs existants (title, description, metadataBase…)
  verification: {
    google: "<contenu copié depuis Search Console>",
    other: { "msvalidate.01": "<contenu copié depuis Bing, seulement si Bing est vérifié par balise>" },
  },
};
```

- Next.js produit `<meta name="google-site-verification" content="…">` (et `<meta name="msvalidate.01" content="…">`) dans le `<head>` de chaque page.
- Ce code est public : il se commite. Il reste en place pour toujours ; ajouter un commentaire d'une ligne au-dessus (« vérification Search Console : à garder »).
- Garder les champs existants du layout ; ajouter seulement `verification`.
- Preuve après la mise en ligne : `pulse-aidd sonder <adresse> --texte "google-site-verification"`, puis la personne clique « Vérifier ».

## Domaine personnel : enregistrement DNS

- **DNS chez Vercel** (le domaine utilise les serveurs de noms de Vercel) : la personne ajoute l'enregistrement TXT dans le tableau de bord Vercel (Domains → le domaine → DNS Records → Add, type TXT, valeur copiée depuis Search Console ; le nom de la racine du domaine tel que l'écran le propose). Avec son accord, la commande `vercel dns add` fait la même chose (vercel.com/docs/cli/dns) ; le tableau de bord reste le chemin le plus sûr pour la racine du domaine. Propagation : jusqu'à 24 heures.
- **DNS chez le registraire** : l'enregistrement TXT s'ajoute chez lui, d'après sa documentation.

## Une seule adresse indexée

- Les **prévisualisations** Vercel (branches, demandes de fusion) et les anciens déploiements de production reçoivent l'en-tête `X-Robots-Tag: noindex` : c'est voulu, rien à faire. Une branche de prévisualisation reliée à un domaine personnalisé ne le reçoit pas : la garder sur un sous-domaine privé, ou ajouter `noindex` à ses pages.
- Avec un domaine personnel, l'adresse `<projet>.vercel.app` continue de servir le site : la rediriger vers le domaine. Tableau de bord Vercel : Settings → Domains → l'adresse `vercel.app` → Edit → « Redirect to » le domaine (redirection permanente). Si l'option manque, une redirection permanente par hôte dans `next.config.ts` (`redirects`, avec `has: [{ type: "host", value: "<projet>.vercel.app" }]`).
- Le sitemap (`app/sitemap.ts`) et `robots.ts` tirent l'adresse du site de la même source que `metadataBase` : toujours le domaine définitif (ni une adresse de prévisualisation, ni l'exemple de la documentation). Contrôle : `pulse-aidd sonder <domaine>/sitemap.xml --texte "<domaine>"`.

## IndexNow (facultatif, pour Bing et les moteurs partenaires)

- Clé publique (8 à 128 caractères `a-z A-Z 0-9 -`) servie par `public/<clé>.txt` (le fichier contient la clé seule) ; elle se commite.
- L'envoi se fait **après** la mise en ligne prouvée (`pulse-aidd sonder`), à la fin de `/pulse:deploy`, avec la liste des adresses modifiées : `POST https://api.indexnow.org/indexnow` (JSON : `host`, `key`, `urlList`). La construction sur Vercel a lieu avant la mise en ligne : un envoi pendant la construction (`postbuild`) annoncerait des pages pas encore servies.
- Réponses : 200 ou 202 → reçu ; 422 → hôte ou clé incorrects, à corriger ; 429 → trop d'envois, attendre.
- Google n'utilise pas IndexNow : pour Google, le sitemap suffit.

## Corrections issues d'un rapport

Titres, descriptions, liens internes et redirections suivent la fiche de la pile et la recette `seo` du pack quand elle existe ; une page qui change d'adresse reçoit une redirection permanente dans `next.config.ts` (`redirects`, `permanent: true`).
