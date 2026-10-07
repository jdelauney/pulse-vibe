import "server-only";

type Environnement = Record<string, string | undefined>;

/**
 * L'adresse publique du site, sans barre finale (ex. https://www.mon-site.fr).
 * Elle sert à l'adresse officielle de chaque page, au sitemap, à robots.txt et aux images de partage.
 * Ordre : SITE_URL (votre domaine définitif, à saisir chez l'hébergeur), sinon le domaine de
 * production fourni par Vercel, sinon http://localhost:3000 (en local).
 */
export function adresseDuSite(env: Environnement = process.env): string {
  const brute =
    env.SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  let adresse: URL;
  try {
    adresse = new URL(brute);
  } catch {
    throw new Error(
      `SITE_URL invalide : « ${brute} ». Exemple attendu : https://www.mon-site.fr`,
    );
  }
  return `${adresse.origin}${adresse.pathname}`.replace(/\/+$/, "");
}
