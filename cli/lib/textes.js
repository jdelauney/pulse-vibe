// Transformations de texte communes : du format Claude Code vers un texte valable dans chaque outil d'IA.
"use strict";

/** Découpe un fichier Markdown à frontmatter : { champs: Map<clé, valeur brute>, corps }. */
function lireFrontmatter(texte) {
  const t = texte.replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return { champs: new Map(), corps: t };
  const champs = new Map();
  let cle = null;
  for (const ligne of m[1].split("\n")) {
    const c = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(ligne);
    if (c) {
      cle = c[1];
      champs.set(cle, c[2].trim());
    } else if (cle && /^\s+\S/.test(ligne)) {
      champs.set(cle, `${champs.get(cle)} ${ligne.trim()}`.trim());
    }
  }
  return { champs, corps: t.slice(m[0].length) };
}

/** Valeur d'un champ, guillemets retirés. */
function valeur(brute) {
  if (brute === undefined) return undefined;
  const v = brute.trim();
  if (/^".*"$/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}

/** Une chaîne YAML entre guillemets doubles (échappements JSON, valides en YAML). */
const yaml = (texte) => JSON.stringify(String(texte));

/**
 * Réécrit les mentions propres à Claude Code dans un texte de Pulse :
 * `/pulse:spec` → `/pulse-spec`, `pulse:reviewer` → `pulse-reviewer`, AskUserQuestion → question à choix,
 * l'installation par /plugin → npx pulseia.
 */
function reecrire(texte) {
  return texte
    .replace(/\/plugin install pulse(?:-([a-z0-9-]+))?@pulseia/g, (_, id) => (id ? `npx pulseia installer --pack ${id}` : "npx pulseia installer"))
    .replace(/(?:re)?démarrer Claude Code/g, (m) => `${m.startsWith("re") ? "re" : ""}démarrer votre outil d'IA`)
    .replace(/(?<![\w-])pulse:(?=[a-z*<])/g, "pulse-")
    .replace(/AskUserQuestion/g, "question à choix");
}

/** Syntaxe d'appel d'une commande Pulse dans les outils, pour les textes destinés au modèle. */
const appel = (commande) => `\`/pulse-${commande}\` (Codex : \`$pulse-${commande}\`)`;

/** Ajouté à la sortie de `pulse-aidd contexte` et `pulse-aidd etape` hors de Claude Code. */
const NOTE_OUTILS = `
===== Pulse dans votre outil d'IA =====

Les règles de Pulse sont écrites pour Claude Code. Dans votre outil :

- **Commandes Pulse** : \`/pulse-<commande>\` (Codex : \`$pulse-<commande>\`). Les citer ainsi à la personne.
- **« question à choix »** : l'outil de questions à choix de votre environnement (Cursor : AskQuestion ; OpenCode : question ; Copilot : ask_user ou askQuestions ; Codex : request_user_input). S'il manque : écrire la question en texte, les réponses numérotées, la recommandée en premier, puis attendre la réponse de la personne.
- **Sous-agent \`pulse-<nom>\`** : le lancer avec l'outil de délégation de votre environnement (Cursor : Task ; OpenCode : subagent ; Copilot : agent ; Codex : demander l'agent par son nom). Sans sous-agent disponible : faire son travail soi-même en suivant \`pulse-aidd agent <nom>\`, et le dire.
- **Outils cités** (Read, Write, Edit, Glob, Grep, Bash, PowerShell, WebFetch, TodoWrite, Agent) : leurs équivalents dans votre environnement.
- **Sortie en plusieurs parties** (« Partie 1/3 ») : lancer la commande \`pulse-aidd suite\` indiquée pour chaque partie suivante, et tout lire avant de continuer.
- **Instructions du projet** : \`CLAUDE.md\` (\`AGENTS.md\` y renvoie) ; chaque ligne \`@chemin\` de son bloc mémoire est un fichier à lire.
`;

/** Ligne de la note sur les garde-fous, selon qu'ils sont installés dans l'outil (pulseia installer --gardes). */
const noteGardes = (actifs) =>
  actifs
    ? "- **Garde-fous automatiques** de Pulse actifs : un appel refusé par « 🔒 Pulse » s'explique simplement à la personne, puis l'alternative indiquée s'applique. Une commande qui demande l'accord de la personne se lance seulement après son « oui » explicite.\n"
    : "- **Garde-fous automatiques** de Pulse absents de cet outil : appliquer soi-même les règles de sécurité de Pulse, et demander l'accord de la personne avant toute commande qui supprime, écrase, envoie ou publie.\n";

/** Ligne d'injection de Claude Code qui ferme chaque SKILL.md : !`pulse-aidd contexte <commande>`. */
const INJECTION = /^!`((?:pulse-aidd|pulse-pile-[a-z0-9-]+) contexte [a-z0-9-]+)`\s*$/m;

/**
 * Le SKILL.md d'une commande du cœur, au format Agent Skills commun (dossier ~/.agents/skills/pulse-<commande>/).
 * L'injection devient une première étape explicite, $ARGUMENTS le texte écrit après la commande.
 */
function skillPortable(commande, texte) {
  const { champs, corps } = lireFrontmatter(texte);
  const lignes = ["---", `name: pulse-${commande}`, `description: ${yaml(reecrire(valeur(champs.get("description")) || ""))}`];
  if (champs.has("argument-hint")) lignes.push(`argument-hint: ${yaml(valeur(champs.get("argument-hint")))}`);
  if (champs.has("disable-model-invocation")) lignes.push(`disable-model-invocation: ${valeur(champs.get("disable-model-invocation")) === "true"}`);
  lignes.push("---", "");
  const injection = INJECTION.exec(corps);
  const contexte = injection ? injection[1] : `pulse-aidd contexte ${commande}`;
  let c = corps
    .replace(INJECTION, `Contexte chargé à la première étape : \`${contexte}\`.`)
    .replace(/`\$ARGUMENTS`|\$ARGUMENTS/g, "le texte écrit par la personne après le nom de la commande (vide s'il n'y en a pas)");
  const avant =
    `> **Première étape** : lancer \`${contexte}\` et lire sa sortie en entier, toutes ses parties comprises, sauf si elle est déjà dans la conversation. ` +
    `La personne appelle cette commande ${appel(commande)}.`;
  c = /^# .*$/m.test(c) ? c.replace(/^(# .*)$/m, `$1\n\n${avant}`) : `${avant}\n\n${c}`;
  return `${lignes.join("\n")}\n${reecrire(c).replace(/^\n+/, "")}`;
}

module.exports = { lireFrontmatter, valeur, yaml, reecrire, appel, skillPortable, NOTE_OUTILS, noteGardes, INJECTION };
