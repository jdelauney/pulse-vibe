// Tests de la lecture de commande partagée par les garde-fous.
// Lancer : node --test plugins/pulse-vibe/tests/lecture-commande.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { decouper, commandesSimples, optionsGlobalesGit } = require("../scripts/lecture-commande");

const noms = (script, dialecte) => commandesSimples(script, dialecte).map((c) => [c.cmd, ...c.args].join(" "));

test("segments : &&, ;, |, retours à la ligne", () => {
  assert.deepStrictEqual(noms("git add a.js && git commit -m 'x'; echo fin"), ["git add a.js", "git commit -m x", "echo fin"]);
});

test("un texte cité ne devient jamais une commande", () => {
  assert.deepStrictEqual(noms('git commit -m "git push --force && rm -rf /"'), ["git commit -m git push --force && rm -rf /"]);
  assert.deepStrictEqual(noms("echo 'git push -f'"), ["echo git push -f"]);
});

test("préfixes retirés : sudo, env, affectations, nohup, timeout", () => {
  const [c] = commandesSimples("sudo env FOO=1 nohup timeout 5 git push");
  assert.strictEqual(c.cmd, "git");
  assert.deepStrictEqual(c.args, ["push"]);
  assert.deepStrictEqual(c.affectations, ["FOO=1"]);
});

test("lanceurs dépliés : bash -c, eval, heredoc lu par un shell, $(…)", () => {
  assert.ok(noms('bash -c "git push -f"').includes("git push -f"));
  assert.ok(noms("eval git push -f").includes("git push -f"));
  assert.ok(noms("bash <<'FIN'\ngit push -f\nFIN").includes("git push -f"));
  assert.ok(noms("echo $(git push -f)").includes("git push -f"));
});

test("heredoc écrit dans un fichier : son texte n'est pas une commande", () => {
  assert.deepStrictEqual(noms("cat > notes.md <<'FIN'\ngit push -f\nFIN"), ["cat"]);
});

test("redirection d'entrée et tube notés sur le segment", () => {
  const { segments } = decouper("cat < .env; echo x | psql");
  assert.deepStrictEqual(segments[0].lectures, [".env"]);
  assert.strictEqual(segments[2].apresTube, true);
  assert.strictEqual(segments[1].apresTube, false);
});

test("gestionnaires : npm run reste npm, pnpm <binaire> est déplié", () => {
  assert.deepStrictEqual(noms("npm run db:push"), ["npm run db:push"]);
  assert.ok(noms("pnpm drizzle-kit push").includes("drizzle-kit push"));
  assert.ok(noms("npx drizzle-kit push").includes("drizzle-kit push"));
});

test("find -exec : la commande lancée est marquée viaFind", () => {
  const rm = commandesSimples("find . -name '*.log' -exec rm {} +").find((c) => c.cmd === "rm");
  assert.ok(rm && rm.viaFind);
});

test("xargs : la commande lancée est marquée viaXargs", () => {
  const add = commandesSimples("git ls-files -m | xargs git add").find((c) => c.cmd === "git" && c.args[0] === "add");
  assert.ok(add && add.viaXargs);
});

test("options globales de git : -C, -c, --git-dir avec valeur séparée", () => {
  assert.deepStrictEqual(optionsGlobalesGit(["--git-dir", ".git", "push", "--force"]), { k: 2, prefixe: ["--git-dir=.git"], configs: [] });
  assert.deepStrictEqual(optionsGlobalesGit(["-c", "core.hooksPath=/dev/null", "commit"]), { k: 2, prefixe: [], configs: ["core.hooksPath=/dev/null"] });
  assert.deepStrictEqual(optionsGlobalesGit(["-C", "sous", "--no-pager", "log"]), { k: 3, prefixe: ["-C", "sous"], configs: [] });
});

test("PowerShell : la barre oblique inverse est un caractère ordinaire", () => {
  const [c] = commandesSimples("Remove-Item C:\\Users\\x\\projet\\dist -Recurse", "powershell");
  assert.strictEqual(c.cmd, "remove-item");
  assert.deepStrictEqual(c.args, ["C:\\Users\\x\\projet\\dist", "-Recurse"]);
});

test("PowerShell : l'accent grave en fin de ligne continue la commande", () => {
  assert.deepStrictEqual(noms("git push origin main `\n  --force", "powershell"), ["git push origin main --force"]);
});

test("PowerShell : un here-string reste un texte cité", () => {
  assert.deepStrictEqual(noms("$m = @'\ngit push --force\n'@\ngit commit -m $m", "powershell").filter((x) => x.startsWith("git")), ["git commit -m $m"]);
});

test("lanceurs Windows : pwsh -c, powershell -EncodedCommand, cmd /c, iex, Start-Process", () => {
  assert.ok(noms("pwsh -c 'git push --force'").includes("git push --force"));
  const code = Buffer.from("git push --force", "utf16le").toString("base64");
  assert.ok(noms(`powershell -EncodedCommand ${code}`).includes("git push --force"));
  assert.ok(noms('cmd //c "rd /s /q src"').includes("rd /s /q src"));
  assert.ok(noms("cmd.exe /c git push --force").includes("git push --force"));
  assert.ok(noms("iex 'git push -f'", "powershell").includes("git push -f"));
  assert.ok(noms("Start-Process git -ArgumentList 'push','--force'", "powershell").includes("git push --force"));
});

test("code d'un interpréteur : les textes cités sont lus comme des commandes", () => {
  assert.ok(noms(`node -e "require('child_process').execSync('git push -f')"`).includes("git push -f"));
  assert.ok(noms(`perl -e 'system("rm -rf src")'`).includes("rm -rf src"));
  const [n] = commandesSimples(`node -e "fs.rmSync('src',{recursive:true})"`);
  assert.strictEqual(n.code, "fs.rmSync('src',{recursive:true})");
});

test("cmd : l'accent circonflexe échappe, l'apostrophe est ordinaire", () => {
  assert.deepStrictEqual(noms("echo l'^&x", "cmd"), ["echo l'&x"]);
});

test("env -S déplie la chaîne en commande", () => {
  assert.ok(noms('env -S "git push -f"').includes("git push -f"));
});

test("segment sans commande : redirection d'entrée et affectation gardées", () => {
  const boucle = commandesSimples("while read l; do echo $l; done < .env").find((c) => c.cmd === "");
  assert.ok(boucle, "pseudo-commande de « done < .env »");
  assert.deepStrictEqual(boucle.lectures, [".env"]);
  const [a] = commandesSimples("f=.env");
  assert.deepStrictEqual([a.cmd, a.affectations], ["", ["f=.env"]]);
  const sous = commandesSimples("export $(xargs < .env) && env").find((c) => c.cmd === "" && c.lectures.length);
  assert.deepStrictEqual(sous.lectures, [".env"]);
});

test("redirections de sortie notées (ecritures)", () => {
  const [c] = commandesSimples("echo x > .git/hooks/pre-commit");
  assert.deepStrictEqual(c.ecritures, [".git/hooks/pre-commit"]);
  const [seule] = commandesSimples("> src/app.ts");
  assert.deepStrictEqual([seule.cmd, seule.ecritures], ["", ["src/app.ts"]]);
  assert.deepStrictEqual(commandesSimples("cat a.txt").map((x) => x.ecritures), [[]]);
});

test("redirection >&N : la cible n'est pas un fichier écrit", () => {
  assert.deepStrictEqual(commandesSimples("echo x >&2")[0].ecritures, []);
  assert.deepStrictEqual(commandesSimples("ls 2>&1")[0].ecritures, []);
  assert.deepStrictEqual(commandesSimples("ls > f.txt 2>&1")[0].ecritures, ["f.txt"]);
});

test("wsl : la commande lancée est lue", () => {
  assert.ok(noms("wsl git push --force").includes("git push --force"));
  assert.ok(noms("wsl.exe -d Ubuntu git push -f").includes("git push -f"));
  assert.ok(noms("wsl git push --force", "powershell").includes("git push --force"));
});

test("tube ou redirection vers un shell : marqué scriptInconnu", () => {
  for (const [s, d] of [
    ["echo 'git push --force' | bash", "bash"],
    ["echo Z2l0 | base64 -d | sh", "bash"],
    ["bash < installer.sh", "bash"],
    ["Get-Content x.ps1 | iex", "powershell"],
    ["iex $code", "powershell"],
    ["'git push' | pwsh", "powershell"],
  ])
    assert.ok(commandesSimples(s, d).some((c) => c.scriptInconnu), s);
  for (const s of ["bash -c 'ls'", "bash <<< 'ls'", "bash scripts/x.sh", "echo ok | cat"]) assert.ok(!commandesSimples(s).some((c) => c.scriptInconnu), s);
});

test("commandes d'une substitution $(…) : marquées dansSubstitution", () => {
  assert.ok(commandesSimples("cat $(echo .env)").find((c) => c.cmd === "echo").dansSubstitution);
  assert.ok(!commandesSimples("echo .env").find((c) => c.cmd === "echo").dansSubstitution);
});

test("tsx -e et ts-node -e : le code est lu", () => {
  const [c] = commandesSimples('npx tsx -e "await db.execute(sql`DROP TABLE x`)"').filter((x) => x.cmd === "tsx");
  assert.match(c.code, /DROP TABLE x/);
  assert.match(commandesSimples("ts-node -e 'console.log(1)'")[0].code, /console\.log/);
});
