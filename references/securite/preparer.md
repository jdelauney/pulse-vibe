# Préparer un audit de sécurité outillé (`/pulse:security preparer`)

Produit deux fichiers utiles à un audit plus poussé (développeur, outil d'analyse dynamique, outil de recherche de secrets). Concerne surtout les applications qui ont un serveur, une base ou des comptes ; sans serveur, l'expliquer et proposer seulement la configuration de recherche de secrets.

Lire d'abord « Pile retenue », « Commandes du projet » et « Données et contrôle d'accès » de `docs/technical.md`. La façon de repérer les points d'entrée dépend de la technologie retenue : consulter sa documentation officielle pour savoir comment elle déclare ses routes, fonctions serveur ou actions.

## 1. Repérer les points d'entrée

- Code serveur réellement présent (`git ls-files`, puis lecture) : chaque route, fonction serveur ou action. Pour chacune : l'adresse, la méthode attendue (GET, POST…), le corps attendu, et si elle exige un utilisateur connecté (et comment : jeton, cookie de session).
- Segments variables dans les adresses (identifiant, nom) : à noter, ce sont les cibles du test du cambrioleur.
- Actions sans adresse fixe (appelées par le framework) : à lister à part, avec le fichier où elles sont définies.
- Connexion : les adresses du service d'authentification retenu (selon sa documentation).
- Webhooks : les adresses appelées par un service externe, et la vérification de signature attendue.
- Pages publiques principales et page d'administration éventuelle.
- Adresse locale : celle affichée par la commande « lancer en local » de « Commandes du projet ».
- Services externes utilisés : variables de `.env.example` et « Pile retenue ».

## 2. Écrire `endpoints.txt` (racine du projet)

Format ci-dessous ; n'y lister que les points d'entrée **réellement trouvés** dans le projet. Les chemins entre `< >` sont à remplacer par les vrais.

```
# ============================================================
# <Projet> – points d'entrée pour les tests de sécurité
# Généré le <date> · pile : <résumé de « Pile retenue »> · base http://localhost:<port>
# Données de test uniquement : jamais de vraie donnée ni de vraie clé.
# ============================================================

# --- Publics (sans connexion) ---
http://localhost:<port>/
http://localhost:<port>/<chemin du formulaire de contact> POST {"name":"Test","email":"test@example.com","message":"Bonjour"}

# --- Connexion ---
# <adresse de connexion du service retenu> POST {"email":"test@example.com","password":"…"}

# --- Protégés (<jeton ou cookie de session de test>) ---
# http://localhost:<port>/<chemin protégé>/<identifiant> GET

# --- Administration ---
# http://localhost:<port>/<chemin de la page admin>

# --- Webhooks ---
# http://localhost:<port>/<chemin du webhook> POST <signature du service requise>

# --- Actions sans adresse fixe ---
# <nomDeLAction> (<fichier où elle est définie>) – exige un utilisateur connecté
```

Règles : tous les points d'entrée trouvés ; méthode indiquée pour POST/PUT/PATCH/DELETE ; valeurs de test réalistes et **fictives** ; lignes protégées commentées avec `#` ; sections vides supprimées.

## 3. Configurer la recherche de secrets dans l'historique

Le garde-fou Pulse bloque les nouveaux secrets ; un outil de recherche de secrets parcourt **tout l'historique Git**. Si gitleaks est disponible (ou un outil équivalent), écrire sa configuration à la racine du projet (pour gitleaks : `.gitleaks.toml`), qui évite les fausses alertes sans masquer les vraies :

```toml
title = "<Projet> – configuration gitleaks"

[extend]
useDefault = true

[allowlist]
description = "Exclusions propres au projet"
paths = [
  # Dossiers de dépendances et de construction de la pile retenue (à adapter).
  '''<dossier des dépendances>''', '''<dossier de construction>''',
]
regexes = [
  '''YOUR_.*_HERE''', '''<your[-_].*>''', '''CHANGEME''', '''xxx+''',
  # Clés publiques des services retenus, par motif précis (à adapter).
]
```

- N'exclure que des dossiers générés (dépendances installées, résultats de construction) et des valeurs factices.
- Seules des clés **publiques** (prévues par le service pour être visibles côté client, selon sa documentation) peuvent être exclues, **par motif précis**, jamais par fichier entier.
- **Ne jamais exclure** une clé secrète, même de test, une clé privée, une clé d'accès complet à une base, ni le dossier `docs/`, ni `.env.example`, ni le fichier d'environnement (une clé y est vite collée par erreur).

Lancer ensuite, si l'outil est installé (pour gitleaks : `gitleaks detect --config .gitleaks.toml --redact`). Sinon : `pulse-aidd verifier` couvre les fichiers actuels (pas l'historique).

## 4. Rapport

```
🛡️ Préparation de l'audit – <projet> (pile : <résumé de « Pile retenue »>)
✅ endpoints.txt – <n> points d'entrée : publics <a> · connexion <b> · protégés <c> · admin <d> · webhooks <e> · actions <f>
✅ <fichier de configuration de recherche de secrets> – adapté à : <services>
⚠️ Alertes : <ex. point d'entrée d'envoi de fichier sans validation apparente, fichier d'environnement absent de .gitignore…>
Prochaines étapes : relire endpoints.txt ; lancer l'outil de recherche de secrets si disponible ; dérouler le test du cambrioleur avec /pulse:security.
```

`endpoints.txt` et la configuration de recherche de secrets ne contiennent aucun secret : ils peuvent être enregistrés dans Git.
