// Migrations de la base, lancées par Vercel avant chaque construction (vercel.json : buildCommand).
//
//   node scripts/migrer.mjs --vercel
//
// - Hors Vercel : rien (en local, npm run db:migrate sur la branche dev de .env). Le drapeau --vercel
//   (posé par vercel.json) rend l'absence de VERCEL_ENV bloquante au lieu de passer en silence.
// - Sur Vercel, seule DATABASE_URL_UNPOOLED (intégration Vercel–Neon) désigne la base : une adresse
//   laissée à la main ne peut pas envoyer une prévisualisation vers la production.
// - Prévisualisation : applique les migrations sur la branche Neon de la prévisualisation.
// - Production : si au moins une migration reste à appliquer, crée d'abord une branche Neon de
//   sauvegarde (expire au bout de 7 jours ; NEON_API_KEY et NEON_PROJECT_ID), puis applique.
//   Les sauvegardes plus anciennes que les 2 dernières sont supprimées avant (Neon limite le nombre
//   de branches : 10 sur les offres Free et Launch).
// Un échec arrête la construction : la version en ligne reste celle d'avant.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const JOURNAL = "drizzle/meta/_journal.json";
const JOURS_DE_SAUVEGARDE = 7;
const SAUVEGARDES_GARDEES = 2;
const API_NEON = "https://console.neon.tech/api/v2";
const DELAI_NEON_MS = 20000;
const REESSAIS_423 = 2;

/** Migrations du dossier drizzle/ : [{ tag, when }] (vide sans migration). */
export function lireJournal(chemin = JOURNAL) {
  if (!existsSync(chemin)) return [];
  return JSON.parse(readFileSync(chemin, "utf8")).entries ?? [];
}

/** Migrations à appliquer, avec la règle de drizzle-orm : `when` plus récent que la dernière appliquée. */
export function migrationsEnAttente(journal, derniereAppliquee) {
  return journal.filter(
    (m) => derniereAppliquee === null || Number(derniereAppliquee) < m.when,
  );
}

/** Nom et date d'expiration (RFC 3339, à la seconde) de la branche de sauvegarde. */
export function sauvegardePour(maintenant) {
  const horodatage = maintenant
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, "")
    .replace("T", "-");
  const expiration = new Date(
    maintenant.getTime() + JOURS_DE_SAUVEGARDE * 24 * 3600 * 1000,
  );
  return {
    nom: `sauvegarde-${horodatage}`,
    expiration: `${expiration.toISOString().slice(0, 19)}Z`,
  };
}

/** Date (created_at) de la dernière migration appliquée, ou null (base neuve). */
async function derniereAppliquee(adresse) {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(adresse);
  try {
    const lignes = await sql.query(
      "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
    );
    return lignes[0]?.created_at ?? null;
  } catch (erreur) {
    // 42P01 : table absente ; 3F000 : schéma absent. La base n'a encore reçu aucune migration.
    if (erreur?.code === "42P01" || erreur?.code === "3F000") return null;
    throw erreur;
  }
}

/**
 * Appel à l'API Neon : délai de 20 s, deux nouveaux essais si la ressource est verrouillée (423).
 * Une réponse en erreur lève un message qui reprend celui de Neon.
 * @param {{ cle: string; methode?: string; chemin: string; corps?: unknown }} requete
 * @param {{ fetchFn?: typeof fetch; attendre?: (ms: number) => Promise<void> }} [options]
 */
export async function appelNeon(
  { cle, methode = "GET", chemin, corps },
  {
    fetchFn = fetch,
    attendre = (ms) => new Promise((fin) => setTimeout(fin, ms)),
  } = {},
) {
  for (let essai = 0; ; essai++) {
    const reponse = await fetchFn(`${API_NEON}${chemin}`, {
      method: methode,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(DELAI_NEON_MS),
    });
    if (reponse.status === 423 && essai < REESSAIS_423) {
      await attendre(1000 * (essai + 1));
      continue;
    }
    if (!reponse.ok) {
      const texte = await reponse.text().catch(() => "");
      let message = texte;
      try {
        message = JSON.parse(texte).message ?? texte;
      } catch {
        // Corps qui n'est pas du JSON : on garde le texte brut.
      }
      const limite = /limit/i.test(message)
        ? " — limite de branches atteinte : supprimez d'anciennes branches sauvegarde-… dans la console Neon"
        : "";
      throw new Error(
        `l'API Neon répond ${reponse.status}${message ? ` (${message})` : ""}${limite}`,
      );
    }
    return reponse.status === 204 ? {} : await reponse.json().catch(() => ({}));
  }
}

/** Supprime les branches sauvegarde-… au-delà des plus récentes (limite de branches de Neon). */
export async function nettoyerSauvegardes({ cle, projet }, options) {
  const liste = await appelNeon(
    {
      cle,
      chemin: `/projects/${projet}/branches?search=sauvegarde-&sort_by=created_at&sort_order=desc&limit=100`,
    },
    options,
  );
  const anciennes = (liste.branches ?? [])
    .filter(
      (b) => b.name?.startsWith("sauvegarde-") && !b.default && !b.protected,
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(SAUVEGARDES_GARDEES);
  for (const b of anciennes) {
    await appelNeon(
      {
        cle,
        methode: "DELETE",
        chemin: `/projects/${projet}/branches/${b.id}`,
      },
      options,
    );
  }
  return anciennes.map((b) => b.name);
}

/** Branche Neon de sauvegarde, copie de la branche par défaut (production), sans calcul attaché. */
export async function creerSauvegarde(
  { cle, projet, nom, expiration },
  options,
) {
  await nettoyerSauvegardes({ cle, projet }, options);
  await appelNeon(
    {
      cle,
      methode: "POST",
      chemin: `/projects/${projet}/branches`,
      corps: { branch: { name: nom, expires_at: expiration } },
    },
    options,
  );
}

function appliquer(adresse) {
  const r = spawnSync("npx", ["drizzle-kit", "migrate"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, DATABASE_URL_DIRECT: adresse },
  });
  if (r.status !== 0) throw new Error("drizzle-kit migrate a échoué");
}

/**
 * Déroulé complet ; les accès extérieurs sont injectables pour les tests.
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   journal?: { tag: string; when: number }[];
 *   maintenant?: Date;
 *   lireDerniere?: (adresse: string) => Promise<string | null>;
 *   sauvegarder?: (sauvegarde: { cle: string; projet: string; nom: string; expiration: string }) => Promise<void>;
 *   appliquerMigrations?: (adresse: string) => void;
 *   dire?: (message: string) => void;
 *   vercel?: boolean;
 * }} [options]
 */
export async function migrer({
  env = process.env,
  journal = lireJournal(),
  maintenant = new Date(),
  lireDerniere = derniereAppliquee,
  sauvegarder = creerSauvegarde,
  appliquerMigrations = appliquer,
  dire = console.log,
  vercel = process.argv.includes("--vercel"),
} = {}) {
  if (vercel && !env.VERCEL_ENV) {
    throw new Error(
      "VERCEL_ENV manque : activez l'accès aux variables système de Vercel (Settings → Environment Variables → Automatically expose System Environment Variables)",
    );
  }
  if (!vercel && env.VERCEL !== "1") {
    dire(
      "Hors Vercel : migrations non lancées (en local : npm run db:migrate).",
    );
    return "hors-vercel";
  }
  if (!journal.length) {
    dire("Aucune migration dans drizzle/ : rien à appliquer.");
    return "rien";
  }
  const adresse = env.DATABASE_URL_UNPOOLED;
  if (!adresse) {
    throw new Error(
      env.VERCEL_ENV === "production"
        ? "la base de production manque (DATABASE_URL_UNPOOLED) : reliez Neon à Vercel (intégration Vercel–Neon, docs/technical.md) puis redéployez"
        : "la base de prévisualisation manque (DATABASE_URL_UNPOOLED) : reliez Neon à Vercel (intégration Vercel–Neon, docs/technical.md) puis redéployez",
    );
  }
  const enAttente = migrationsEnAttente(journal, await lireDerniere(adresse));
  if (!enAttente.length) {
    dire("Base à jour : aucune migration à appliquer.");
    return "a-jour";
  }
  dire(`Migrations à appliquer : ${enAttente.map((m) => m.tag).join(", ")}`);
  if (env.VERCEL_ENV === "production") {
    if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
      throw new Error(
        "NEON_API_KEY et NEON_PROJECT_ID manquent en Production : sans sauvegarde, la migration attend (docs/technical.md, « Mise en place »)",
      );
    }
    const { nom, expiration } = sauvegardePour(maintenant);
    await sauvegarder({
      cle: env.NEON_API_KEY,
      projet: env.NEON_PROJECT_ID,
      nom,
      expiration,
    });
    dire(
      `Sauvegarde créée : branche Neon « ${nom} » (gardée jusqu'au ${expiration}).`,
    );
  }
  appliquerMigrations(adresse);
  dire("Migrations appliquées.");
  return "applique";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  migrer().catch((erreur) => {
    console.error(
      `❌ Migrations : ${erreur.message}. La version en ligne reste celle d'avant.`,
    );
    process.exit(1);
  });
}
