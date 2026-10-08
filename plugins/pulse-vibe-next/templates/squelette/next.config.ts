import type { NextConfig } from "next";

const enDeveloppement = process.env.NODE_ENV === "development";

// Sources autorisées par la Content-Security-Policy (CSP) : tout le reste est bloqué.
// Une recette qui charge un service externe ajoute ici son adresse exacte.
const sources: Record<string, string[]> = {
  "default-src": ["'self'"],
  // Next.js insère des scripts dans la page. Sans nonce (qui rendrait chaque page dynamique),
  // 'unsafe-inline' est la méthode de sa documentation. 'unsafe-eval' sert aux messages
  // d'erreur de React, en développement seulement.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    ...(enDeveloppement ? ["'unsafe-eval'"] : []),
  ],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "blob:", "data:"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

const csp = [
  ...Object.entries(sources).map(
    ([directive, valeurs]) => `${directive} ${valeurs.join(" ")}`,
  ),
  "upgrade-insecure-requests",
].join("; ");

// En-têtes de sécurité envoyés avec chaque réponse (checklist Pulse, S12).
const entetesDeSecurite = [
  // Seules les sources listées ci-dessus peuvent charger du code, des styles, des images…
  { key: "Content-Security-Policy", value: csp },
  // Toujours en HTTPS, pendant 2 ans, sous-domaines compris.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Une page d'un autre site, ouverte depuis celui-ci, ne peut pas piloter sa fenêtre.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Le navigateur respecte le type annoncé des fichiers.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Les autres sites reçoivent seulement l'adresse du site, sans le chemin de la page.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Le site ne s'affiche dans aucun cadre (anciens navigateurs ; la CSP le dit avec frame-ancestors).
  { key: "X-Frame-Options", value: "DENY" },
  // Caméra, micro, position et suivi publicitaire coupés.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: entetesDeSecurite }];
  },
};

export default nextConfig;
