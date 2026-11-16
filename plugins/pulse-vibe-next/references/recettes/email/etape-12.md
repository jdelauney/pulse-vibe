### 12. « Mon compte »

`CompteContainer` (recette `connexion`) reçoit les deux nouvelles sections : changer d'adresse, supprimer son compte. Remplacez le fichier :

<!-- fichier: src/features/compte/components/containers/compte.container.tsx -->
```tsx
// src/features/compte/components/containers/compte.container.tsx
import { utilisateurConnecte } from "../../queries/utilisateur-connecte.query";
import { BoutonDeconnexionContainer } from "./bouton-deconnexion.container";
import { ChangementAdresseContainer } from "./changement-adresse.container";
import { MotDePasseContainer } from "./mot-de-passe.container";
import { SuppressionCompteContainer } from "./suppression-compte.container";

export async function CompteContainer() {
  const utilisateur = await utilisateurConnecte();
  return (
    <>
      <section className="flex items-center justify-between gap-4">
        <p>Connecté en tant que {utilisateur.nom}</p>
        <BoutonDeconnexionContainer />
      </section>
      <section aria-labelledby="titre-mot-de-passe">
        <h2 id="titre-mot-de-passe" className="mb-4 text-lg font-medium">
          Changer mon mot de passe
        </h2>
        <MotDePasseContainer />
      </section>
      <section aria-labelledby="titre-adresse">
        <h2 id="titre-adresse" className="mb-4 text-lg font-medium">
          Changer mon adresse e-mail
        </h2>
        <ChangementAdresseContainer adresseActuelle={utilisateur.email} />
      </section>
      <section aria-labelledby="titre-suppression">
        <h2 id="titre-suppression" className="mb-4 text-lg font-medium">
          Supprimer mon compte
        </h2>
        <SuppressionCompteContainer />
      </section>
    </>
  );
}
```
