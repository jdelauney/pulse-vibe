// Migrations de la base, lancées par Vercel avant chaque construction (vercel.json : buildCommand).
//
//   node scripts/migrer.mjs --vercel
//
// - Hors Vercel : rien (en local, npm run db:migrate sur la branche dev de .env). Le drapeau --vercel
//   (posé par vercel.json) rend l'absence de VERCEL_ENV bloquante dès qu'une migration existe.
// - Sur Vercel, seule DATABASE_URL_UNPOOLED (intégration Vercel–Neon) désigne la base : une adresse
//   laissée à la main ne peut pas envoyer une prévisualisation vers la production.
// - Prévisualisation : applique les migrations sur la branche Neon de la prévisualisation, après avoir
//   vérifié qu'elle n'est pas la production (NEON_ENDPOINT_PRODUCTION : point d'accès ep-… de la branche
//   principale, enregistré par pulse-aidd secrets envoyer NEON_API_KEY). Même point d'accès, ou repère
//   absent : migrations sautées avec un message, la construction continue (jamais d'arrêt en Preview).
// - Production : si au moins une migration reste à appliquer, crée d'abord une branche Neon de
//   sauvegarde (expire au bout de 7 jours ; NEON_API_KEY et NEON_PROJECT_ID), puis applique.
//   Base jamais migrée (première mise en ligne) : rien à sauvegarder, la sauvegarde est ignorée.
//   Les sauvegardes Pulse (sauvegarde-AAAAMMJJ-HHMM) au-delà des 2 dernières sont supprimées avant (Neon limite le nombre
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
const ATTENTES_423_MS = [2000, 5000, 10000];
const SAUVEGARDE_PULSE = /^sauvegarde-\d{8}-\d{4}$/;

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

/** Identifiant du point d'accès Neon (« ep-… », sans -pooler) d'une adresse, d'un nom d'hôte ou d'un identifiant ; null sinon. */
export function pointDAcces(texte) {
  if (!texte) return null;
  let hote = texte.trim().toLowerCase();
  try {
    hote = new URL(hote).hostname;
  } catch {
    // Déjà un nom d'hôte ou un identifiant.
  }
  const trouve = /^(ep-[a-z0-9-]+?)(?:-pooler)?(?:\.|$)/.exec(hote);
  return trouve ? trouve[1] : null;
}

/** Messages de la garde des prévisualisations : ce qui se passe, ce que cela change, comment y remédier. */
const PREVISUALISATION_SUR_PRODUCTION = [
  "Prévisualisation : migrations non appliquées. Cette prévisualisation utilise la base de production (même point d'accès Neon que NEON_ENDPOINT_PRODUCTION) : la production reste protégée et la construction continue.",
  "Tant que la prévisualisation n'a pas sa propre copie de la base, ses pages qui ont besoin des nouvelles migrations peuvent afficher des erreurs.",
  "Pour lui donner sa copie : console Neon → Integrations → Vercel → Manage ; vérifiez que l'intégration crée bien une branche pour chaque prévisualisation (projet Vercel relié, rôle présent, limite de branches non atteinte), puis redéployez la prévisualisation.",
];
const PREVISUALISATION_SANS_REPERE = [
  "Prévisualisation : migrations non appliquées, par prudence. Le repère de la base de production (NEON_ENDPOINT_PRODUCTION) n'est pas encore enregistré dans Vercel : sans lui, impossible de vérifier que cette prévisualisation a sa propre copie de la base.",
  "La construction continue ; ses pages qui ont besoin des nouvelles migrations peuvent afficher des erreurs.",
  "Pour activer la vérification : relancez /pulse:deploy (à l'étape de la clé Neon, le repère s'enregistre tout seul), ou /pulse:init pour mettre à niveau un projet plus ancien.",
];

const PREVISUALISATION_REPERE_ILLISIBLE = [
  "Prévisualisation : migrations non appliquées, par prudence. Le repère de la base de production (NEON_ENDPOINT_PRODUCTION) est enregistré dans Vercel, mais sa valeur n'a pas la forme d'un point d'accès Neon (ep-…) : impossible de vérifier que cette prévisualisation a sa propre copie de la base.",
  "La construction continue ; ses pages qui ont besoin des nouvelles migrations peuvent afficher des erreurs.",
  "Pour corriger : relancez /pulse:deploy (à l'étape de la clé Neon, le repère s'enregistre de nouveau tout seul).",
];
const PREVISUALISATION_ADRESSE_ILLISIBLE = [
  "Prévisualisation : migrations non appliquées, par prudence. L'adresse de la base de cette prévisualisation n'a pas la forme d'une adresse Neon : impossible de vérifier qu'elle n'est pas celle de la production.",
  "La construction continue ; ses pages qui ont besoin des nouvelles migrations peuvent afficher des erreurs.",
  "Pour corriger : console Neon → Integrations → Vercel → Manage ; vérifiez que l'intégration donne bien sa branche à chaque prévisualisation, puis redéployez la prévisualisation.",
];

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
 * Appel à l'API Neon : délai de 20 s, trois nouveaux essais (après 2, 5 et 10 s) si la ressource est verrouillée (423).
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
    let reponse;
    try {
      reponse = await fetchFn(`${API_NEON}${chemin}`, {
        method: methode,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${cle}`,
          "Content-Type": "application/json",
        },
        body: corps ? JSON.stringify(corps) : undefined,
        signal: AbortSignal.timeout(DELAI_NEON_MS),
      });
    } catch (erreur) {
      if (erreur?.name === "TimeoutError" || erreur?.name === "AbortError") {
        throw new Error(
          `Neon n'a pas répondu en ${DELAI_NEON_MS / 1000} secondes`,
        );
      }
      throw erreur;
    }
    if (reponse.status === 423 && essai < ATTENTES_423_MS.length) {
      await attendre(ATTENTES_423_MS[essai]);
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
      const limite = /branch\w*.*limit|limit.*branch/i.test(message)
        ? " — limite de branches Neon atteinte : supprimez des branches inutiles (anciennes prévisualisations preview/…, branches *_old_* laissées par une restauration) dans la console Neon, puis redéployez"
        : "";
      throw Object.assign(
        new Error(
          `l'API Neon répond ${reponse.status}${message ? ` (${message})` : ""}${limite}`,
        ),
        { status: reponse.status, limiteBranches: limite !== "" },
      );
    }
    return reponse.status === 204 ? {} : await reponse.json().catch(() => ({}));
  }
}

/** Supprime les branches sauvegarde-… au-delà des plus récentes (limite de branches de Neon). */
export async function nettoyerSauvegardes(
  { cle, projet },
  options,
  dire = console.log,
) {
  const liste = await appelNeon(
    {
      cle,
      chemin: `/projects/${projet}/branches?search=sauvegarde-&sort_by=created_at&sort_order=desc&limit=100`,
    },
    options,
  );
  const anciennes = (liste.branches ?? [])
    .filter(
      (b) => SAUVEGARDE_PULSE.test(b.name ?? "") && !b.default && !b.protected,
    )
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(SAUVEGARDES_GARDEES);
  const supprimees = [];
  for (const b of anciennes) {
    try {
      await appelNeon(
        {
          cle,
          methode: "DELETE",
          chemin: `/projects/${projet}/branches/${b.id}`,
        },
        options,
      );
      supprimees.push(b.name);
    } catch (erreur) {
      dire(
        `impossible de supprimer l'ancienne sauvegarde ${b.name} : ${erreur.message} ; on continue`,
      );
    }
  }
  return supprimees;
}

/** Branche Neon de sauvegarde, copie de la branche par défaut (production), sans calcul attaché. Rend l'expiration réellement posée (null si Neon l'a refusée). */
export async function creerSauvegarde(
  { cle, projet, nom, expiration },
  options,
  dire = console.log,
) {
  await nettoyerSauvegardes({ cle, projet }, options, dire);
  const requete = (branch) => ({
    cle,
    methode: "POST",
    chemin: `/projects/${projet}/branches`,
    corps: { branch },
  });
  try {
    await appelNeon(requete({ name: nom, expires_at: expiration }), options);
  } catch (erreur) {
    // expires_at est réservé à certains comptes : un refus (400, 403 ou 422) se
    // rejoue une fois sans expiration. La limite de branches ne se rejoue pas.
    const refus =
      [400, 403, 422].includes(erreur?.status) && !erreur.limiteBranches;
    if (!refus) throw erreur;
    dire(
      "Neon refuse l'expiration automatique de la branche : sauvegarde recréée sans expiration ; le nettoyage qui garde les 2 sauvegardes les plus récentes la supprimera plus tard.",
    );
    await appelNeon(requete({ name: nom }), options);
    return { expiration: null };
  }
  return { expiration };
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
 *   sauvegarder?: (sauvegarde: { cle: string; projet: string; nom: string; expiration: string }) => Promise<{ expiration: string | null } | void>;
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
  if (vercel && !env.VERCEL_ENV) {
    throw new Error(
      "VERCEL_ENV manque : activez l'accès aux variables système de Vercel (Settings → Environment Variables → cochez « Enable access to System Environment Variables »)",
    );
  }
  const adresse = env.DATABASE_URL_UNPOOLED;
  if (!adresse) {
    throw new Error(
      env.VERCEL_ENV === "production"
        ? "la base de production manque (DATABASE_URL_UNPOOLED) : reliez Neon à Vercel (intégration Vercel–Neon, docs/technical.md) puis redéployez"
        : "la base de prévisualisation manque (DATABASE_URL_UNPOOLED) : reliez Neon à Vercel (intégration Vercel–Neon, docs/technical.md) puis redéployez",
    );
  }
  const derniere = await lireDerniere(adresse);
  const enAttente = migrationsEnAttente(journal, derniere);
  if (!enAttente.length) {
    dire("Base à jour : aucune migration à appliquer.");
    return "a-jour";
  }
  dire(`Migrations à appliquer : ${enAttente.map((m) => m.tag).join(", ")}`);
  if (env.VERCEL_ENV === "preview") {
    // L'intégration Vercel–Neon donne sa branche à chaque prévisualisation ; si elle n'a pas pu la
    // créer, l'adresse peut désigner la production : on compare son point d'accès à celui de la production.
    // Dans le doute, on saute les migrations sans arrêter la construction.
    const production = pointDAcces(env.NEON_ENDPOINT_PRODUCTION);
    if (!production) {
      const present = Boolean(env.NEON_ENDPOINT_PRODUCTION?.trim());
      for (const ligne of present
        ? PREVISUALISATION_REPERE_ILLISIBLE
        : PREVISUALISATION_SANS_REPERE)
        dire(ligne);
      return present ? "ignore-repere-illisible" : "ignore-sans-repere";
    }
    const celleDeLApercu = pointDAcces(adresse);
    if (!celleDeLApercu) {
      for (const ligne of PREVISUALISATION_ADRESSE_ILLISIBLE) dire(ligne);
      return "ignore-adresse-illisible";
    }
    if (celleDeLApercu === production) {
      for (const ligne of PREVISUALISATION_SUR_PRODUCTION) dire(ligne);
      return "ignore-production";
    }
  }
  if (env.VERCEL_ENV === "production" && derniere === null) {
    dire("Base jamais migrée : rien à sauvegarder, sauvegarde ignorée.");
  } else if (env.VERCEL_ENV === "production") {
    if (!env.NEON_API_KEY || !env.NEON_PROJECT_ID) {
      throw new Error(
        "NEON_API_KEY et NEON_PROJECT_ID manquent en Production : sans sauvegarde, la migration attend (docs/technical.md, « Mise en place »)",
      );
    }
    const { nom, expiration } = sauvegardePour(maintenant);
    const { expiration: posee = expiration } =
      (await sauvegarder({
        cle: env.NEON_API_KEY,
        projet: env.NEON_PROJECT_ID,
        nom,
        expiration,
      })) ?? {};
    dire(
      posee
        ? `Sauvegarde créée : branche Neon « ${nom} » (gardée jusqu'au ${posee}).`
        : `Sauvegarde créée : branche Neon « ${nom} » (sans date d'expiration : le nettoyage la retire, il garde les 2 plus récentes).`,
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
