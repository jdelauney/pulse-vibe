type LireEntete = (nom: string) => string | string[] | null | undefined;

/**
 * L'identifiant de la requête donné par l'hébergeur, le même que dans ses journaux :
 * x-vercel-id chez Vercel, x-request-id derrière un proxy qui le pose (autres hébergeurs), sinon aucun.
 */
export function identifiantDeRequete(lire: LireEntete): string | undefined {
  for (const nom of ["x-vercel-id", "x-request-id"]) {
    const valeur = lire(nom);
    const premiere = Array.isArray(valeur) ? valeur[0] : valeur;
    if (premiere) return premiere;
  }
  return undefined;
}
