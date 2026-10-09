const ADRESSE = "/api/erreur-client";

/**
 * Signale au serveur une erreur survenue dans le navigateur, sans attendre de réponse : elle
 * apparaît ensuite dans le journal de Vercel. Seulement en production. React transmet la valeur
 * levée telle quelle (texte, null, objet) : elle est lue avec prudence, et le signalement reste
 * silencieux s'il échoue, pour que la page d'erreur s'affiche toujours.
 */
export function signalerErreurClient(
  erreur: Error & { digest?: string },
): void {
  try {
    const lue = erreur as { digest?: unknown; message?: unknown } | null;
    // Une erreur avec référence (digest) vient du serveur, qui l'a déjà journalisée.
    if (lue?.digest || process.env.NODE_ENV !== "production") return;
    const corps = JSON.stringify({
      message: String(lue?.message ?? erreur).slice(0, 200),
      chemin: window.location.pathname,
    });
    if (navigator.sendBeacon?.(ADRESSE, corps)) return;
    fetch(ADRESSE, { method: "POST", body: corps, keepalive: true }).catch(
      () => {},
    );
  } catch {
    // Le signalement est un plus : la page d'erreur reste affichée.
  }
}
