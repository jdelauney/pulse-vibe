# Sécurité du code

Points S1 à S12 : `references/checklist-securite.md`. Où se trouvent les données, qui peut lire et écrire quoi, et où c'est vérifié : « Données et contrôle d'accès » de `docs/technical.md`. Pour l'API exacte de la technologie retenue (validation, session, réglages de l'authentification) : documentation officielle, jamais de mémoire.

## Principe directeur

**« Si ce n'est pas interdit côté serveur, c'est autorisé. »**

- Tout ce qui s'exécute chez la personne (navigateur, application installée) se contourne en une requête forgée : champ obligatoire, bouton désactivé, champ caché, validation côté client, écran masqué. C'est un **confort** ou un **frein**, **jamais une barrière**.
- Les vraies barrières sont **le code serveur** (contrôles avant toute action, secrets lus dans l'environnement) et **la base** (contraintes, règles d'accès).
- Tout point d'entrée qui accepte une requête est **public**, même s'il n'est appelé que depuis un écran protégé : chacun fait ses propres contrôles.

## Quand appliquer quoi

| Point d'entrée | Exemples | Protections requises | Points |
|---|---|---|---|
| Formulaire public sans compte | contact, inscription à une lettre d'information, formulaire de demande | Passe par le code serveur ; validation client **et** serveur ; champ piège + délai minimal ; limite de fréquence ; origine vérifiée ; réponse neutre ; données minimales | S5, S9, S10, S11 |
| Connexion / inscription | création de compte, connexion, mot de passe oublié | Délégué à un fournisseur d'authentification éprouvé ou à une bibliothèque reconnue ; longueur minimale ; messages génériques ; limite de fréquence ; anti-robot si abus | S1, S5, S10, S11 |
| Formulaire authentifié | profil, saisie liée au compte, message interne | Identité tirée de la session vérifiée ; contrôle d'accès à chaque lecture et écriture ; règles d'accès dans la base si elle le permet ; validation serveur | S3, S4, S5 |
| Point d'entrée qui coûte | envoi d'email, appel à une IA, paiement, SMS | Code serveur uniquement (clé secrète) ; origine vérifiée ; limite de fréquence **fiable** (stockage partagé) ; utilisateur vérifié si possible ; contrainte d'unicité contre les doublons | S2, S10, S11 |
| Envoi de fichiers | pièce jointe, photo de profil, document | Type et taille contrôlés côté serveur ; stockage privé ; liens temporaires | S7 |
| Tout le site | toutes les pages | En-têtes de sécurité | S12 |

## 1. Validation serveur par liste blanche (S5)

Refuser ce qui est vide, trop long, du mauvais type ou mal formé, **avant** tout enregistrement ou envoi. Toujours côté serveur ; côté client en plus, pour le confort.

- **Liste blanche des champs** : on ne lit que les champs attendus, un par un. Un champ inattendu (`role`, `isAdmin`, `userId`, `price`) est ignoré, jamais copié tel quel dans l'enregistrement.
- **Type** : une chaîne attendue est bien une chaîne, un nombre est un nombre fini dans un intervalle.
- **Longueur** minimale et maximale, après suppression des espaces en début et en fin.
- **Format** : email, téléphone, date, identifiant, valeur parmi une liste fermée.
- **Taille totale de la requête** bornée.
- Si la base le permet, doubler par des contraintes (non nul, longueur, format, unicité).

```
RULES = {
  name:    { requis: vrai, max: 100 },
  email:   { requis: vrai, max: 254, format: EMAIL },
  message: { requis: vrai, max: 2000 }
}

fonction validate(input, rules) :
  data = {}
  POUR CHAQUE (field, rule) DANS rules :              // seuls les champs connus sont lus
    raw = input[field]
    SI raw existe ET n'est pas une chaîne ALORS RETOURNER { error: "Formulaire invalide." }
    value = supprimerEspacesAuxBords(raw SINON "")
    SI rule.requis ET value est vide ALORS RETOURNER { error: "Merci de remplir tous les champs obligatoires." }
    SI longueur(value) > rule.max ALORS RETOURNER { error: "Un des champs est trop long." }
    SI value n'est pas vide ET rule.format ET NON correspond(value, rule.format)
      ALORS RETOURNER { error: "Un des champs n'a pas le bon format." }
    data[field] = value
  RETOURNER { data }
```

Des saisies comme `<script>` ou `' OR 1=1 --` sont acceptées et enregistrées **telles quelles** : la protection vient des requêtes paramétrées (jamais de requête construite en concaténant une saisie) et de l'affichage en texte (section 11).

## 2. Contrôle d'accès à chaque lecture et écriture (S3, S4)

- **L'identité vient du serveur** : de la session ou du jeton vérifié, jamais d'un identifiant, d'un rôle ou d'un champ envoyé par le client (paramètre, champ caché, corps de requête).
- **Chaque** lecture et **chaque** écriture vérifie que la personne a le droit d'agir sur **cette** donnée : appartenance (« cette ligne est-elle à elle ? ») et rôle (« peut-elle faire cette action ? »).
- Le rôle se lit **en base** à partir de l'identité vérifiée.
- Une protection de page (redirection des visiteurs non connectés) ne protège **pas** les actions : chaque point d'entrée vérifie lui-même.
- Réponses : non connecté → 401 ; connecté sans droit → 403 (ou 404 pour ne pas révéler l'existence d'une ressource).

```
fonction updateProfile(request) :
  user = sessionVérifiée(request)                      // jamais request.body.userId
  SI user absent ALORS RETOURNER réponse(401, "Merci de vous reconnecter.")
  { data, error } = validate(request.body, PROFILE_RULES)
  SI error ALORS RETOURNER réponse(400, error)
  mettreÀJour("profiles", OÙ id = user.id, data)       // l'identifiant vient du serveur
  RETOURNER réponse(200, "Profil mis à jour.")
```

## 3. Règles d'accès au niveau des données

Si la base retenue le permet (règles par ligne, politiques d'accès, vues filtrées), **les activer sur chaque table** exposée et écrire des règles explicites : qui peut lire, créer, modifier, supprimer. Une personne ne voit et ne modifie que ses lignes, sauf rôle autorisé. Ces règles sont la dernière barrière si un contrôle applicatif est oublié. Une table qui n'a aucune règle doit être inaccessible avec la clé publique. Test du cambrioleur : connecté en « Client B », changer un identifiant dans l'adresse ou la requête pour viser une donnée du « Client A ».

## 4. Champ piège et délai minimal (S10)

**Champ piège (honeypot)** : un champ au nom crédible (par exemple « site web »), invisible pour les humains et les technologies d'assistance, exclu de la tabulation et du remplissage automatique. Éviter de le masquer d'une façon que certains robots repèrent (champ de type caché, affichage supprimé) : le placer hors de l'écran.

**Délai minimal** : la durée de remplissage est mesurée **côté client** (les horloges diffèrent) et envoyée avec le formulaire ; côté serveur, moins de 2 à 3 secondes ou une valeur illisible = robot probable.

Dans les deux cas : **ne rien faire et répondre comme un succès**, pour que le robot n'apprenne pas qu'il a été repéré. Ne jamais enregistrer la valeur du champ piège. Ces deux mesures n'arrêtent que les robots naïfs (valeurs falsifiables) : les combiner avec la limite de fréquence.

## 5. Limitation de fréquence (S10)

Empêcher qu'un inconnu déclenche mille emails ou appels payants. Clé de comptage : `action + adresse IP` pour un visiteur, `action + identifiant` pour une personne connectée.

- **Honnêteté** : un compteur en mémoire n'est **pas partagé** entre plusieurs instances du serveur et repart à zéro à chaque redémarrage. C'est un **frein**, suffisant pour un formulaire public modeste, pas une garantie.
- **Version fiable**, obligatoire pour un point d'entrée qui coûte : un **stockage partagé** (table de la base, cache partagé), avec une mise à jour **atomique** du compteur, accessible uniquement par le code serveur. En cas de panne du stockage : **refuser** par prudence.
- La plateforme d'hébergement ou le fournisseur d'authentification proposent parfois leurs propres limites : vérifier leur documentation avant de les promettre.
- Seuils raisonnables (par exemple 5 envois par 10 minutes pour un formulaire de contact) : plusieurs personnes peuvent partager une IP.
- Les IP sont des données personnelles (S9) : purge automatique, mention dans la page de confidentialité, jamais dans les journaux.

```
fonction hitRateLimit(key, max, windowSeconds) :           // stockage partagé, opération atomique
  compteur = incrémenterOuCréer(key, fenêtre = windowSeconds)
  RETOURNER compteur <= max
```

## 6. Origine des requêtes et CSRF (S4, S10)

Une requête qui **modifie** quelque chose (création, modification, suppression, envoi) utilise une méthode d'écriture, jamais une simple lecture d'adresse.

- **Authentification par cookie** (envoyé automatiquement par le navigateur) : risque CSRF réel. Vérifier l'origine de la requête (en-tête d'origine comparé à la liste des adresses autorisées) **et**, si la technologie retenue le prévoit, utiliser sa protection CSRF intégrée sans la contourner ; sinon, un jeton anti-CSRF.
- **Authentification par jeton envoyé explicitement** dans un en-tête par le code client : un site tiers ne peut pas l'ajouter, le risque CSRF classique est faible ; vérifier l'origine reste utile pour les formulaires publics et les points d'entrée qui coûtent.
- Liste des adresses autorisées dans une variable d'environnement (production, local, prévisualisations).
- Un appel de service à service (notification d'un prestataire) n'a pas d'origine : il se vérifie par la **signature** du prestataire, selon sa documentation.
- Ne jamais autoriser toutes les origines dans les en-têtes de partage entre origines.
- Limite : un outil en ligne de commande forge l'origine ; ce contrôle bloque les sites tiers, pas les robots.

## 7. Mots de passe et authentification (S1, S5, S11)

- **Déléguer** à un fournisseur d'authentification éprouvé ou à une bibliothèque reconnue (retenus dans « Pile retenue ») : création de compte, connexion, réinitialisation, sessions. Si aucun n'est retenu, ne pas coder de connexion : revenir à `/pulse:tech`.
- **Jamais de stockage en clair**, jamais de hachage maison, jamais de mot de passe dans un journal ni dans une réponse.
- **Longueur plutôt que complexité** : au moins 12 caractères, maximum borné ; pas de règles « 3 majuscules, 2 chiffres » qui poussent à des mots de passe prévisibles. Même valeur dans les réglages du fournisseur et dans le formulaire.
- **Messages génériques** : « Email ou mot de passe incorrect. » ; pour la réinitialisation, dans tous les cas : « Si un compte existe pour cette adresse, un email vient d'être envoyé. » Ne jamais révéler qu'un compte existe.
- Les adresses de redirection après connexion ou réinitialisation sont déclarées dans les réglages du fournisseur, jamais prises telles quelles dans la requête.

## 8. Anti-robot (S10)

Ne pas coder de calcul imposé au navigateur ni de défi maison : long à rendre correct, facile à rater. Ordre recommandé :

1. Champ piège + délai minimal + limite de fréquence : suffisent dans la plupart des cas.
2. Si le spam persiste, après accord de la personne : un **service de challenge** reconnu, dont la réponse est **vérifiée côté serveur** avec la clé secrète, selon sa documentation.
3. Si le fournisseur d'authentification propose une protection anti-robot intégrée, l'activer pour la connexion et l'inscription.

Un service tiers reçoit des données techniques du visiteur : le citer dans la page de confidentialité (S9).

## 9. Secrets (S1, S2)

- Les secrets (clés d'API, clés d'administration de la base, chaînes de connexion) sont lus **uniquement côté serveur**, depuis des **variables d'environnement**. Jamais dans le code, jamais dans l'historique, jamais dans le code envoyé au client.
- Chaque variable est déclarée **sans valeur** dans le fichier d'exemple du projet ; noms et lieu de saisie en production : « Secrets et variables d'environnement » de `docs/technical.md`.
- Seules les valeurs **publiques par nature** (adresse d'un service, clé explicitement publique) peuvent atteindre le client ; un mécanisme qui expose une variable au client ne reçoit jamais un secret.
- Le code serveur vérifie au démarrage de chaque point d'entrée que la configuration nécessaire est présente ; sinon : journal sans détail, réponse 500.
- Ne jamais renvoyer un secret, ni l'erreur brute d'un service, dans une réponse.

## 10. Réponses, codes HTTP et journal (S11, S9)

| Code | Quand | Message affiché |
|---|---|---|
| 200 neutre | Robot repéré (champ piège, délai) | Même message que le succès |
| 400 | Validation échouée, corps illisible | Message simple de la validation |
| 401 | Pas de session ou session invalide | « Merci de vous reconnecter. » |
| 403 | Origine refusée, droit insuffisant | « Action non autorisée. » |
| 405 | Méthode non prévue (avec la liste des méthodes permises) | « Méthode non autorisée. » |
| 429 | Limite de fréquence atteinte | « Trop de tentatives, réessayez dans quelques minutes. » |
| 500 | Configuration manquante, panne d'un service, erreur imprévue | « Une erreur est survenue, réessayez plus tard. » |

- **Jamais dans une réponse** : message brut d'un service, requête à la base, pile d'appels, chemin de fichier, nom de variable d'environnement, clé.
- **Journal minimal** : un préfixe d'action et un code (`"contact: envoi échoué", statut`). Ni email, ni nom, ni message, ni jeton, ni IP.

## 11. Affichage sans injection (S6)

- Toute donnée saisie ou venant de la base s'affiche **comme du texte**, par le mécanisme d'échappement normal de la technologie retenue.
- **Jamais** de balisage construit en assemblant une saisie dans une chaîne, ni d'insertion de balisage brut qui contourne l'échappement. Si un contenu riche est indispensable, le nettoyer avec une bibliothèque reconnue, après accord.
- Une adresse fournie par une personne n'est utilisée comme lien qu'après vérification de son schéma (`https:`).
- Pas d'exécution de code construit à partir d'une chaîne.
- Un sujet ou un en-tête d'email n'est jamais construit avec une saisie (risque d'injection d'en-tête).
- Test : un titre `<img src=x onerror=alert(1)>` s'affiche comme du texte.

## 12. Envoi de fichiers (S7)

- Contrôler **côté serveur** le type réel (pas seulement l'extension ni le type déclaré par le client) et la **taille maximale**.
- Renommer le fichier stocké (identifiant généré) ; ne jamais réutiliser le nom fourni comme chemin.
- **Stockage privé** pour tout document personnel ; téléchargement par **liens temporaires** générés après contrôle d'accès.
- Test : copier un lien de téléchargement, se déconnecter, l'ouvrir en navigation privée.

## 13. Squelette d'un point d'entrée sécurisé

Exemple : formulaire de contact public qui déclenche un envoi d'email. L'ordre des contrôles compte : les moins coûteux d'abord, l'action en dernier.

```
CONSTANTE SERVER_ERROR = "Une erreur est survenue, réessayez plus tard."
CONSTANTE SUCCESS      = "Merci, votre message a bien été envoyé."

fonction handleContact(request) :
  // 0. Configuration présente
  SI une variable requise manque ALORS journaliser("contact: configuration manquante"); RETOURNER réponse(500, SERVER_ERROR)
  // 1. Méthode autorisée
  SI request.méthode ≠ ÉCRITURE ALORS RETOURNER réponse(405, "Méthode non autorisée.")
  // 2. Origine : seulement les adresses autorisées
  SI request.origine ∉ ALLOWED_ORIGINS ALORS RETOURNER réponse(403, "Action non autorisée.")
  // 3. Limite de fréquence (stockage partagé pour un point d'entrée qui coûte)
  résultat = hitRateLimit("contact:" + ipDuVisiteur(request), max = 5, fenêtre = 600)
  SI résultat = panne ALORS RETOURNER réponse(500, SERVER_ERROR)
  SI résultat = refusé ALORS RETOURNER réponse(429, "Trop de tentatives, réessayez dans quelques minutes.")
  // 4. Anti-robot : champ piège et délai minimal → succès neutre, rien n'est fait
  SI champPiègeRempli(request.body) OU envoiTropRapide(request.body) ALORS RETOURNER réponse(200, SUCCESS)
  // 5. Validation par liste blanche
  { data, error } = validate(request.body, RULES)
  SI error ALORS RETOURNER réponse(400, error)
  // 6. Contrôle d'accès (si le formulaire est réservé : identité tirée de la session vérifiée)
  // 7. Action, avec la clé secrète lue côté serveur
  ESSAYER envoyerEmail(sujet = "Nouveau message du site", texte = data)   // sujet fixe
  EN CAS D'ERREUR : journaliser("contact: envoi échoué", code); RETOURNER réponse(500, SERVER_ERROR)
  // 8. Réponse neutre, sans détail
  RETOURNER réponse(200, SUCCESS)
```

## 14. Checklist avant de livrer

- [ ] Secrets uniquement côté serveur, en variables d'environnement déclarées sans valeur dans le fichier d'exemple (S1).
- [ ] Aucune clé secrète dans le code envoyé au client ; les appels qui en ont besoin passent par le serveur (S2).
- [ ] Règles d'accès actives sur chaque table si la base le permet ; « Client B » ne voit pas les données de « Client A » (S3).
- [ ] Chaque action réservée vérifie l'identité (tirée de la session) et le rôle (lu en base) côté serveur ; aucun identifiant ni rôle accepté du client (S4).
- [ ] Chaque contrôle côté client a son équivalent côté serveur, sur une liste blanche de champs ; requêtes paramétrées (S5).
- [ ] Saisies affichées comme du texte, jamais insérées comme du balisage (S6).
- [ ] Fichiers : type et taille vérifiés côté serveur, stockage privé, liens temporaires (S7).
- [ ] Bibliothèques de sécurité reconnues, existantes, version fixée, ajoutées avec accord (S8).
- [ ] Données minimales ; IP stockées purgées ; services tiers cités dans la page de confidentialité (S9).
- [ ] Formulaire public : champ piège + délai minimal + limite de fréquence ; point d'entrée qui coûte : limite fiable en stockage partagé, contrainte d'unicité contre les doublons (S10).
- [ ] Codes HTTP corrects, messages génériques, aucun détail interne, aucun journal de donnée personnelle, de jeton ou d'IP (S11).
- [ ] En-têtes de sécurité en place : voir `/pulse:security entetes` (S12).
- [ ] Testé « en cambrioleur » : formulaire vide, texte énorme, `<img src=x onerror=alert(1)>`, dix envois rapides, appel direct du point d'entrée sans passer par l'interface, action réservée appelée sans être connecté.
