import type { MetadataRoute } from "next";

/**
 * La politique des robots IA, décidée par la personne avec /pulse:seo ia et notée dans docs/seo.md :
 * A : visible partout, entraînement accepté · B : visible dans les réponses IA, sans entraînement ·
 * C : hors des réponses IA · D : site privé, rien n'est exploré.
 */
export type PolitiqueRobotsIa = "A" | "B" | "C" | "D";

/** A tant que rien n'est décidé : robots.txt ouvert, comme sans fichier. */
export const politiqueRobotsIa: PolitiqueRobotsIa = "A";

/** Préférence facultative (Content-Signal), par exemple "search=yes, ai-input=yes, ai-train=no". */
export const signalDeContenu: string | null = null;

/** Chemins à ne pas explorer, pour tous les robots. robots.txt est public : rien de secret ici. */
export const cheminsFermes: string[] = [];

// Liste tirée de la référence du plugin Pulse (robots-ia.json, vérifiée le 2026-10-07).
/** Robots qui apprennent à partir des pages : bloqués par B, C et D. */
export const ROBOTS_ENTRAINEMENT = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "CCBot",
];

/** Robots des réponses des assistants (index et visites à la demande) : bloqués par C et D. */
export const ROBOTS_REPONSES_IA = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Meta-WebIndexer",
  "Meta-ExternalFetcher",
  "Amazonbot",
  "Amzn-SearchBot",
  "Amzn-User",
];

/**
 * Les groupes de robots.txt pour une politique. Les robots bloqués reçoivent « Disallow: / » :
 * un groupe à leur nom ne rouvre ainsi aucun chemin fermé pour tous.
 */
export function reglesRobots(
  politique: PolitiqueRobotsIa,
  options: { fermes?: string[]; signal?: string | null } = {},
): MetadataRoute.Robots["rules"] {
  if (politique === "D") {
    return [{ userAgent: "*", disallow: "/" }];
  }
  const { fermes = [], signal = null } = options;
  const tous = {
    userAgent: "*",
    allow: "/",
    ...(fermes.length > 0 ? { disallow: fermes } : {}),
    ...(signal ? { other: { "Content-Signal": signal } } : {}),
  };
  const bloques =
    politique === "A"
      ? []
      : politique === "B"
        ? ROBOTS_ENTRAINEMENT
        : [...ROBOTS_ENTRAINEMENT, ...ROBOTS_REPONSES_IA];
  return bloques.length > 0
    ? [tous, { userAgent: bloques, disallow: "/" }]
    : [tous];
}
