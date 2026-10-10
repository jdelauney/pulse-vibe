### 6. Les messages

Dictionnaires dans `src/lib/i18n/messages/` ; les mêmes clés dans les deux langues ; un espace de noms par écran ou par composant.

`src/lib/i18n/messages/fr.json` :

<!-- fichier: src/lib/i18n/messages/fr.json -->
```json
{
  "Accessibilite": {
    "allerAuContenu": "Aller au contenu"
  },
  "ChoixLangue": {
    "libelle": "Langue",
    "fr": "Français",
    "en": "English"
  },
  "Compte": {
    "titre": "Mon compte",
    "connecteEnTantQue": "Connecté en tant que {nom}",
    "chargement": "Chargement…",
    "changerMotDePasse": "Changer mon mot de passe"
  }
}
```

`src/lib/i18n/messages/en.json` :

<!-- fichier: src/lib/i18n/messages/en.json -->
```json
{
  "Accessibilite": {
    "allerAuContenu": "Skip to content"
  },
  "ChoixLangue": {
    "libelle": "Language",
    "fr": "Français",
    "en": "English"
  },
  "Compte": {
    "titre": "My account",
    "connecteEnTantQue": "Signed in as {nom}",
    "chargement": "Loading…",
    "changerMotDePasse": "Change my password"
  }
}
```

