### 2. L'envoi, de la recette `envoi-email`

Les e-mails du compte partent par l'envoi de la recette `envoi-email` : le métier et better-auth reçoivent un `EnvoyeurEmail` (`src/core/email/email.port.ts`) ; `getAuth()` lui passe `getEnvoyeurEmail()` (`src/adapters/email/email.adapter.ts`), et un test passe une doublure qui garde les messages. Rien à écrire à cette étape : vérifiez que ces deux fichiers existent et que `npm test` passe.
