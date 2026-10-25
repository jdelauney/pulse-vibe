# La clé Google (PageSpeed Insights et CrUX)

> Référence de `/pulse:perf`, chargée quand la personne crée sa clé ou quand une clé apparaît dans la conversation.

Une clé personnelle, gratuite, valable pour tous les projets de la personne. Sans clé, PageSpeed Insights refuse en pratique toute demande (erreur 429, quota de 0), et CrUX exige une clé.

**Créer la clé** (une fois, par la personne, guidée pas à pas ; libellés de la console Google Cloud à vérifier à l'écran) :
1. Ouvrir https://console.cloud.google.com et se connecter avec un compte Google.
2. Créer un projet (sélecteur de projet → « Nouveau projet »), par exemple « mesure-vitesse ».
3. « API et services » → « Bibliothèque » : activer **PageSpeed Insights API**, puis **Chrome UX Report API**.
4. « API et services » → « Identifiants » → « Créer des identifiants » → « Clé API ».
5. Restreindre la clé : « Restrictions d'API » → « Restreindre la clé » → cocher seulement **PageSpeed Insights API** et **Chrome UX Report API** → Enregistrer. Une clé restreinte ne sert à rien d'autre si elle fuit.

**La ranger sur le poste**, dans la variable d'environnement `PULSE_PSI_CLE`, hors de tout projet. La personne colle la valeur elle-même, dans la fenêtre de son système ; la clé reste hors de la conversation.
- Windows : menu Démarrer → « Modifier les variables d'environnement pour votre compte » → « Nouvelle… » → nom `PULSE_PSI_CLE`, valeur : la clé → OK.
- macOS et Linux : ouvrir `~/.zshrc` (macOS) ou `~/.bashrc` (Linux) dans un éditeur de texte, ajouter la ligne `export PULSE_PSI_CLE="<la clé>"`, enregistrer.
- Puis fermer et rouvrir le terminal et Claude Code (la variable est lue au démarrage), et lancer `pulse-aidd perf cle` : il vérifie que la clé est présente et acceptée, sans l'afficher.

**Ailleurs** : pour la tâche hebdomadaire de CI, la clé va dans les secrets du dépôt (nom `PULSE_PSI_CLE`), saisie par la personne dans les réglages du dépôt. Le garde-fou anti-secrets de Pulse bloque une clé Google écrite dans un fichier du projet.

**Clé compromise** (collée dans une conversation, un fichier ou un message) : la supprimer dans « Identifiants », en créer une nouvelle, mettre à jour la variable du poste et le secret de CI.

Quota gratuit indiqué dans la console (« Quotas ») ; CrUX : 150 requêtes par minute.
