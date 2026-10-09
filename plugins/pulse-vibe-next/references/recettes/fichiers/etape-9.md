### 9. Le téléchargement

Le Route Handler lit la session hors du `try` (sans session, `utilisateurConnecte()` redirige vers `/connexion`, et un `catch` avalerait cette redirection). Seule la signature, qui appelle le service, est protégée par `reponseErreur()`.

<!-- fichier: app/api/fichiers/[id]/route.ts -->
```ts
// app/api/fichiers/[id]/route.ts
import { stockageFichiers } from "@src/adapters/storage/storage.adapter";
import { utilisateurConnecte } from "@src/features/compte/queries/utilisateur-connecte.query";
import { trouverFichier } from "@src/features/fichiers/queries/trouver-fichier.query";
import { reponseErreur } from "@src/lib/errors/reponse-erreur";
import { z } from "zod";

// Le lien affiché reste stable ; l'adresse signée (5 minutes) naît au clic, après contrôle.
export async function GET(
  _requete: Request,
  { params }: RouteContext<"/api/fichiers/[id]">,
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  // Sans session, utilisateurConnecte() renvoie vers /connexion : l'appeler hors du try.
  const utilisateur = await utilisateurConnecte();
  const ligne = await trouverFichier(id, utilisateur.id);
  if (!ligne) {
    return new Response("Fichier introuvable.", { status: 404 });
  }
  try {
    return Response.redirect(await stockageFichiers.adresseLecture(ligne), 303);
  } catch (erreur) {
    return reponseErreur(erreur, "Téléchargement d'un fichier");
  }
}
```

