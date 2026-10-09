const ADRESSE = "/api/erreur-client";

/**
 * Signale au serveur une erreur survenue dans le navigateur, sans attendre de réponse : elle
 * apparaît ensuite dans le journal de Vercel. Seulement en production.
 */
export function signalerErreurClient(
  erreur: Error & { digest?: string },
): void {
  // Une erreur avec référence (digest) vient du serveur, qui l'a déjà journalisée.
  if (erreur.digest || process.env.NODE_ENV !== "production") return;
  const corps = JSON.stringify({
    message: erreur.message.slice(0, 200),
    chemin: window.location.pathname,
  });
  if (navigator.sendBeacon?.(ADRESSE, corps)) return;
  fetch(ADRESSE, { method: "POST", body: corps, keepalive: true }).catch(
    () => {},
  );
}
