// Tests du garde-fou des commandes (hook PreToolUse sur Bash).
// Lancer : node --test plugins/pulse-vibe/tests/garde-commandes.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const HOOK = path.join(__dirname, "..", "scripts", "garde-commandes.js");

function decision(commande, cwd = os.tmpdir(), env = {}, outil = "Bash") {
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({ tool_name: outil, tool_input: { command: commande }, cwd }),
    encoding: "utf8",
    env: { ...process.env, PULSE_GARDE_COMMANDES_OFF: "", ...env },
  });
  assert.strictEqual(r.status, 0, "le hook sort toujours avec le code 0");
  if (!r.stdout) return null;
  const s = JSON.parse(r.stdout).hookSpecificOutput;
  return { decision: s.permissionDecision, raison: s.permissionDecisionReason };
}

const refus = (c, cwd) => {
  const d = decision(c, cwd);
  assert.ok(d && d.decision === "deny", `refus attendu : ${c} → ${JSON.stringify(d)}`);
  return d;
};
const confirmation = (c, cwd) => {
  const d = decision(c, cwd);
  assert.ok(d && d.decision === "ask", `confirmation attendue : ${c} → ${JSON.stringify(d)}`);
  return d;
};
const refusPs = (c, cwd) => {
  const d = decision(c, cwd, {}, "PowerShell");
  assert.ok(d && d.decision === "deny", `refus attendu (PowerShell) : ${c} → ${JSON.stringify(d)}`);
  return d;
};
const confirmationPs = (c, cwd) => {
  const d = decision(c, cwd, {}, "PowerShell");
  assert.ok(d && d.decision === "ask", `confirmation attendue (PowerShell) : ${c} → ${JSON.stringify(d)}`);
  return d;
};
const passePs = (c, cwd) => assert.strictEqual(decision(c, cwd, {}, "PowerShell"), null, `doit passer (PowerShell) : ${c}`);
const passe = (c, cwd) => assert.strictEqual(decision(c, cwd), null, `doit passer : ${c}`);

function depot({ avecCommit }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-garde-"));
  const git = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
  fs.writeFileSync(path.join(dir, "a.txt"), "a\n");
  if (avecCommit) {
    git("add", "a.txt");
    git("commit", "-q", "-m", "init");
  }
  return dir;
}

// ------------------------------------------------------------ Envois forcés et contournements

test("envoi forcé refusé, sous toutes ses formes, avec l'alternative", () => {
  for (const c of [
    "git push --force",
    "git push -f origin main",
    "git push -uf origin main",
    "git push --force-with-lease",
    "git push origin +main",
    "git -C sous-dossier push --force",
  ]) {
    const d = refus(c);
    assert.match(d.raison, /git pull/);
  }
});

test("contournement des contrôles refusé", () => {
  refus('git commit --no-verify -m "x"');
  refus('git commit -n -m "x"');
  refus("git push --no-verify");
});

test("suppression d'une branche distante : confirmation", () => {
  confirmation("git push origin --delete feat/x");
  confirmation("git push origin :feat/x");
});

// ------------------------------------------------------------ Indexation globale

test("indexation globale refusée dans un dépôt qui a déjà un commit", () => {
  const dir = depot({ avecCommit: true });
  for (const c of ["git add -A", "git add .", "git add --all", "git add -u", "git add :/", "git add '*'", "git add -A -- .", 'git commit -am "x"', "git commit --all -m x"]) {
    const d = refus(c, dir);
    assert.match(d.raison, /git add <fichier/);
  }
});

test("indexation globale permise pour le tout premier commit, et indexation nommée toujours permise", () => {
  const vierge = depot({ avecCommit: false });
  passe("git add -A -- .", vierge);
  passe("git add .", vierge);
  const dir = depot({ avecCommit: true });
  passe("git add a.txt src/b.ts", dir);
  passe("git add -p", dir);
  passe('git commit -m "feat: x"', dir);
});

// ------------------------------------------------------------ Travail jeté

test("commandes qui jettent du travail : confirmation, avec /pulse:annuler", () => {
  for (const c of ["git reset --hard", "git reset --hard HEAD~1", "git checkout .", "git checkout -- .", "git checkout -- src/a.ts", "git restore .", "git restore src/a.ts", "git clean -fd", "git clean -xdf", "git stash drop", "git stash clear"]) {
    const d = confirmation(c);
    assert.match(d.raison, /\/pulse:annuler/);
  }
});

test("variantes sans danger de ces commandes : passent", () => {
  for (const c of ["git reset", "git reset --soft HEAD~1", "git checkout main", "git checkout -b feat/x", "git restore --staged src/a.ts", "git clean -n", "git stash", "git stash pop", "git stash list"]) passe(c);
});

test("branches et worktrees : -D et --force demandent confirmation, -d passe", () => {
  confirmation("git branch -D feat/x");
  confirmation("git branch --delete --force feat/x");
  confirmation("git worktree remove --force .claude/worktrees/x");
  passe("git branch -d feat/x");
  passe("git worktree remove .claude/worktrees/x");
});

test("configuration Git : nom et e-mail passent, le reste demande confirmation", () => {
  passe('git config --global user.name "Camille Martin"');
  passe("git config user.email camille@example.com");
  passe("git config user.name");
  passe("git config --get remote.origin.url");
  passe("git config --list");
  confirmation("git config core.hooksPath /tmp/hooks");
  confirmation("git config --global --unset core.autocrlf");
  confirmation("git config set core.autocrlf true");
});

// ------------------------------------------------------------ Suppressions de fichiers

test("suppression récursive : confirmation, sauf dossiers reconstruits", () => {
  confirmation("rm -rf src");
  confirmation("rm -r docs/");
  confirmation("rm -Rf ~/projet");
  confirmation("npx rimraf src");
  confirmation("find . -name '*.ts' -delete");
  confirmation("find . -name '*.bak' -exec rm -rf {} +");
  passe("rm -rf node_modules .next");
  passe("rm -rf ./dist/ coverage");
  passe("rm fichier.txt");
});

// ------------------------------------------------------------ Bases de données et production

test("bases de données : commandes qui écrasent ou suppriment, confirmation", () => {
  for (const c of [
    "npx drizzle-kit push",
    "pnpm drizzle-kit push",
    "pnpm db:push",
    "npm run db:push",
    "pnpm --filter web db:push",
    "npx prisma db push",
    "npx prisma migrate reset",
    "supabase db reset",
    'psql "$DATABASE_URL" -c "DROP TABLE clients"',
    "psql -c 'truncate factures'",
    "psql -c 'DELETE FROM factures'",
  ]) confirmation(c);
  passe("npx drizzle-kit generate");
  passe("pnpm db:generate");
  passe("psql -c \"DELETE FROM factures WHERE id = 3\"");
  passe("psql -c 'select 1'");
});

test("mises en production directes : confirmation, avec git push en alternative", () => {
  for (const c of ["vercel --prod", "npx vercel deploy --prod", "vercel@latest --prod", "vercel promote https://x.vercel.app", "vercel rollback", "netlify deploy --prod", "npx wrangler deploy", "wrangler secret put CLE", "gh pr merge 12", "glab mr merge 3"]) confirmation(c);
  passe("vercel");
  passe("vercel build --prod");
  passe("vercel env ls");
  passe("netlify deploy");
  passe("wrangler deploy --dry-run");
  passe("gh pr create --draft");
});

// ------------------------------------------------------------ Lecture de la commande

test("la règle regarde la commande, pas son costume", () => {
  for (const c of [
    "sudo git push --force",
    "env FOO=1 git push --force",
    "FOO=1 git push --force",
    "/usr/bin/git push --force",
    "time git push --force",
    "command git push --force",
    "(cd app && git push --force)",
    "{ git push --force; }",
    "if true; then git push --force; fi",
    "npm test && git push --force",
    "echo ok; git push --force",
    "true || git push --force",
    'bash -c "git push --force"',
    "sh -lc 'git push --force'",
    "eval 'git push --force'",
    "bash <<'EOF'\ngit push --force\nEOF",
    "bash <<< 'git push --force'",
    "echo x $(git push --force)",
  ]) refus(c);
});

test("une commande citée dans un texte ne déclenche rien", () => {
  passe('git commit -m "docs: ne jamais faire git push --force ni git add -A"');
  passe("echo 'git push --force'");
  passe("cat <<'EOF' > notes.md\ngit push --force\nrm -rf src\nEOF");
  passe("grep -rn 'reset --hard' references");
  passe("# git push --force\nls");
});

test("commandes courantes : passent", () => {
  for (const c of ["git status --short", "git push", "git push -u origin feat/x", "git log --oneline -5", "npm test", "pnpm dev", "node scripts/verifier.js", "ls -la", "git diff --cached"]) passe(c);
});

// ------------------------------------------------------------ Robustesse

test("entrée invalide, autre outil ou garde-fou désactivé : rien n'est bloqué", () => {
  for (const entree of ["", "pas du json", JSON.stringify({ tool_name: "Write", tool_input: { file_path: "a" } })]) {
    const r = spawnSync("node", [HOOK], { input: entree, encoding: "utf8" });
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout, "");
  }
  assert.strictEqual(decision("git push --force", os.tmpdir(), { PULSE_GARDE_COMMANDES_OFF: "1" }), null);
});

test("un préfixe dans la commande ne désactive pas le garde-fou", () => {
  refus("PULSE_GARDE_COMMANDES_OFF=1 git push --force");
});

// ------------------------------------------------------------ Lecture de .env

test("lire un fichier .env dans le shell : refusé, avec l'alternative ; .env.example permis", () => {
  for (const c of ["cat .env", "cat ./.env.local", "type .env", "Get-Content .env.production", "head -5 .env", "grep DATABASE .env", "less config/.env", "more .env"]) {
    const d = refus(c);
    assert.match(d.raison, /pulse-aidd secrets inventaire/);
  }
  passe("cat .env.example");
  passe("grep DATABASE .env.example");
  passe("cat README.md");
  passe('git commit -m "docs: ne pas faire cat .env"');
});

test("l'outil PowerShell est lu par le même garde-fou", () => {
  const lancerPs = (commande) => {
    const r = spawnSync("node", [HOOK], {
      input: JSON.stringify({ tool_name: "PowerShell", tool_input: { command: commande }, cwd: os.tmpdir() }),
      encoding: "utf8",
      env: { ...process.env, PULSE_GARDE_COMMANDES_OFF: "" },
    });
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : null;
  };
  assert.strictEqual(lancerPs("git push --force origin main"), "deny");
  assert.strictEqual(lancerPs("Get-Content .env"), "deny");
  assert.strictEqual(lancerPs("Get-ChildItem src"), null);
});

// ------------------------------------------------------------ Windows

test("lanceurs Windows : l'envoi forcé reste refusé", () => {
  refus("pwsh -c 'git push --force'");
  refus("cmd.exe /c git push --force");
  refusPs("git push origin main `\n --force");
  refusPs("iex 'git push -f'");
  refusPs("Start-Process git -ArgumentList 'push','--force'");
});

test("PowerShell : un message de commit qui cite une commande passe", () => {
  passePs('git commit -m "ne jamais faire git push --force"');
});

// ------------------------------------------------------------ Git : contournements fermés

test("options globales avec valeur : l'envoi forcé reste refusé", () => {
  refus("git --git-dir .git push --force");
  refus("git --work-tree . push --force");
  refus("git --namespace x push -f");
});

test("options longues abrégées comme Git les accepte", () => {
  refus("git push --forc");
  refus("git push --no-verif");
  refus('git commit --no-veri -m "x"');
  confirmation("git reset --har");
});

test("contrôles désactivés autrement que par --no-verify : refus", () => {
  refus('git -c core.hooksPath=/dev/null commit -m "x"');
  refus('HUSKY=0 git commit -m "x"');
  refus('export HUSKY=0; git commit -m "x"');
  refusPs('$env:HUSKY = 0; git commit -m "x"');
  passe("HUSKY=0 npm ci");
});

test("ce qui jette ou déplace du travail : confirmation", () => {
  confirmation("git switch -f main");
  confirmation("git switch --discard-changes main");
  confirmation("git checkout HEAD~3 src/app.js");
  confirmation("git branch -f main HEAD~5");
  confirmation("git update-ref -d refs/heads/x");
  confirmation("git filter-branch --tree-filter 'rm -f x' HEAD");
  confirmation("git reflog expire --expire=now --all");
  confirmation("git gc --prune=now");
  passe("git checkout -b feat/x origin/main");
  passe("git switch -c feat/x");
});

test("lire .env dans l'historique : refus", () => {
  refus("git show HEAD:.env");
  refus("git cat-file -p HEAD:.env.local");
  passe("git show HEAD:.env.example");
});

test("indexation globale déguisée : refus dans un dépôt qui a un commit", () => {
  const dir = depot({ avecCommit: true });
  for (const c of ["git add *.js", "git add src/..", "git ls-files -m | xargs git add", "git add $(git ls-files -m)"]) refus(c, dir);
  passe("git add -n .", dir);
  passe("git add src/a.js", dir);
});

// ------------------------------------------------------------ Git : corrections de revue

test("chemins à crochets, texte cité et options courtes groupées", () => {
  const dir = depot({ avecCommit: true });
  passe('git add "app/[id]/page.tsx"', dir);
  refus("git add *.js", dir);
  passe('git commit -m "note: export HUSKY=0 desactive"');
  refusPs('$env:HUSKY = 0; git commit -m "x"');
  refus('export HUSKY=0; git commit -m "x"');
  passe("git checkout -qb x origin/main");
  confirmation("git checkout -fq main");
  confirmation("git switch -fq main");
});

// ------------------------------------------------------------ Suppressions

test("suppression de tout le disque, du dossier personnel ou du projet : refus", () => {
  for (const c of ["rm -rf /", "rm -rf ~", 'rm -rf "$HOME"', "rm -rf .", "rm -rf *", "rm -f *"]) {
    const d = refus(c);
    assert.match(d.raison, /nommez précisément/);
  }
  refusPs("Remove-Item C:\\ -Recurse -Force");
  refusPs("Remove-Item D:\\* -Recurse");
});

test("suppressions PowerShell et cmd : confirmation", () => {
  confirmationPs("Remove-Item src -Recurse -Force");
  confirmationPs("ri -r -fo src");
  confirmationPs("Get-ChildItem src | Remove-Item");
  confirmation('cmd //c "rd /s /q src"');
  confirmation('cmd //c "del /s /q src"');
  passePs("Remove-Item dist -Recurse -Force");
  passePs("Remove-Item notes.txt -Force");
});

test("suppressions déguisées : confirmation", () => {
  confirmation("$(echo rm) -rf src");
  confirmation('x=rm; $x -rf src');
  confirmation("busybox rm -rf src");
  confirmation(`node -e "require('fs').rmSync('src',{recursive:true})"`);
  confirmation(`python -c "import shutil; shutil.rmtree('src')"`);
  confirmation(`perl -e 'system("rm -rf src")'`);
  confirmation("find . -name '*.js' -exec rm {} +");
  confirmation("ls src | xargs rm");
  confirmation("rm -f src/*.js");
  passe("rm notes.txt");
  passe("rm -rf node_modules .next");
});

// ------------------------------------------------------------ Lecture de .env

test("lire .env par un chemin détourné : refus", () => {
  for (const c of [
    "cat .ENV",
    "cat < .env",
    "less<.env",
    "cat .env*",
    "head .dev.vars",
    "cat .envrc",
    "source .env && printenv",
    ". .env",
    "cp .env /tmp/x && cat /tmp/x",
    `node -e "console.log(require('fs').readFileSync('.env','utf8'))"`,
    `python -c "print(open('.env').read())"`,
    `node -e "require('dotenv').config(); console.log(process.env)"`,
  ])
    refus(c);
  refusPs("[IO.File]::ReadAllText('.env')");
  refusPs("Get-Content .env");
});

test("recherche récursive dans un dossier qui contient .env : refus avec l'alternative", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-env-"));
  fs.writeFileSync(path.join(dir, ".env"), "API_KEY=1\n");
  fs.mkdirSync(path.join(dir, "src"));
  const d = refus("grep -r API_KEY .", dir);
  assert.match(d.raison, /--exclude/);
  refus("grep -rn API_KEY", dir);
  refus("rg -uu API_KEY", dir);
  passe("grep -r API_KEY src", dir);
  passe("grep -r --exclude='.env*' API_KEY .", dir);
  passe("rg API_KEY", dir);
});

test("créer .env à partir de l'exemple : passe", () => {
  passe("cp .env.example .env");
  passe("cat .env.example");
});

// ------------------------------------------------------------ Services, bases, outils Pulse

test("dépôt distant supprimé ou rendu public : refus", () => {
  refus("gh repo delete moi/projet --yes");
  refus("gh repo edit --visibility public");
  refus("gh repo edit --visibility=public");
  refus("gh repo create projet --public");
  refus("glab repo delete moi/projet");
  passe("gh repo create projet --private --source=. --remote=origin");
});

test("suppression par l'API, variables chez l'hébergeur, base Neon : confirmation", () => {
  confirmation("gh api -X DELETE repos/moi/projet/branches/x");
  confirmation("gh api --method delete /repos/x");
  confirmation("vercel env rm DATABASE_URL production");
  confirmation("vercel env add STRIPE_KEY production");
  confirmation("neonctl branches delete dev");
});

test("SQL envoyé par un tube ou un fichier : lu ou confirmé", () => {
  confirmation("echo 'DROP TABLE users' | psql $DATABASE_URL");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-sql-"));
  fs.writeFileSync(path.join(dir, "drop.sql"), "DROP TABLE users;");
  fs.writeFileSync(path.join(dir, "lecture.sql"), "SELECT 1;");
  confirmation("psql -f drop.sql", dir);
  confirmation("psql < drop.sql", dir);
  passe("psql -f lecture.sql", dir);
});

test("outils Pulse qui modifient la production : confirmation", () => {
  confirmation("pulse-aidd secrets envoyer STRIPE_KEY --env production");
  confirmation("pulse-aidd secrets redeployer");
  confirmation("bash bin/pulse-aidd secrets generer BETTER_AUTH_SECRET");
  confirmation("pulse-aidd search-console deconnecter");
  passe("pulse-aidd secrets inventaire");
  passe("pulse-aidd contexte implement");
});

test("liste blanche : les commandes ordinaires de la méthode passent", () => {
  const dir = depot({ avecCommit: true });
  for (const c of [
    "git add src/a.js",
    'git commit -m "feat(T3): permet de cocher une tâche"',
    "git push -u origin feat/us-003-cocher",
    "git push",
    "npm run build",
    "pnpm drizzle-kit generate",
    "cp .env.example .env",
    "rm -rf node_modules",
    "gh pr create --draft --title x --body y",
  ])
    passe(c, dir);
});

// ------------------------------------------------------------ Historique envoyé et branche de production

function depotAvecDistant() {
  const dir = depot({ avecCommit: true });
  const distant = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-distant-"));
  execFileSync("git", ["init", "-q", "--bare", distant]);
  execFileSync("git", ["remote", "add", "origin", distant], { cwd: dir });
  execFileSync("git", ["push", "-q", "-u", "origin", "main"], { cwd: dir, stdio: "ignore" });
  return dir;
}

test("modifier un commit déjà envoyé : confirmation ; un commit encore local : libre", () => {
  const dir = depotAvecDistant();
  const d = confirmation('git commit --amend -m "x"', dir);
  assert.match(d.raison, /nouveau commit/);
  fs.writeFileSync(path.join(dir, "b.txt"), "b\n");
  execFileSync("git", ["add", "b.txt"], { cwd: dir });
  execFileSync("git", ["commit", "-q", "-m", "local"], { cwd: dir });
  passe('git commit --amend -m "local, corrigé"', dir);
});

test("envoi sur la branche principale d'un site publié : confirmation", () => {
  const dir = depotAvecDistant();
  passe("git push", dir);
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), "## Adresses\n\n- Site en ligne : https://exemple.fr\n");
  confirmation("git push", dir);
  confirmation("git push origin main", dir);
  confirmation("git push origin HEAD:main", dir);
  passe("git push -u origin feat/x", dir);
  fs.writeFileSync(path.join(dir, "CLAUDE.md"), "## Adresses\n\n- Site en ligne : pas encore en ligne\n");
  passe("git push", dir);
  fs.writeFileSync(path.join(dir, "vercel.json"), "{}\n");
  confirmation("git push", dir);
});
