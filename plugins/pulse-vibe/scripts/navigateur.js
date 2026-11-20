#!/usr/bin/env node
// Pulse – le navigateur du poste, pour les mesures de vitesse (/pulse:perf) et les captures des maquettes (/pulse:ui).
//
// trouverNavigateur({ edge }) : CHROME_PATH, puis Google Chrome, puis Microsoft Edge (sauf edge: false), puis Chromium
// (PATH sous Linux), puis le Chromium de Playwright. Rend { chemin, origine }, ou undefined si rien n'est trouvé.
// ouvrir(chemin) : lance le navigateur sans fenêtre et rend une session du protocole DevTools (WebSocket de Node 22).
//
// Module : trouverNavigateur(options), ouvrir(chemin, options).
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { actif: bacASable } = require("./bac-a-sable");

function existe(f) {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}

function dansLePath(noms, env) {
  for (const dossier of (env.PATH || "").split(path.delimiter)) for (const n of noms) if (dossier && existe(path.join(dossier, n))) return path.join(dossier, n);
  return null;
}

function chromiumDePlaywright(env) {
  const racine =
    env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? env.PLAYWRIGHT_BROWSERS_PATH
      : process.platform === "win32"
        ? path.join(env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "ms-playwright")
        : process.platform === "darwin"
          ? path.join(os.homedir(), "Library", "Caches", "ms-playwright")
          : path.join(os.homedir(), ".cache", "ms-playwright");
  let dossiers = [];
  try {
    dossiers = fs.readdirSync(racine).filter((d) => /^chromium-\d+$/.test(d)).sort((x, y) => Number(y.split("-")[1]) - Number(x.split("-")[1]));
  } catch {
    dossiers = [];
  }
  const relatifs = {
    win32: ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"],
    darwin: [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    ],
  }[process.platform] || ["chrome-linux64/chrome", "chrome-linux/chrome"];
  for (const d of dossiers) for (const r of relatifs) if (existe(path.join(racine, d, r))) return path.join(racine, d, r);
  return null;
}

/** Le navigateur à lancer. edge: false écarte Microsoft Edge (Lighthouse vise Chrome). */
function trouverNavigateur({ edge = true, env = process.env } = {}) {
  if (env.CHROME_PATH) return { chemin: env.CHROME_PATH, origine: "CHROME_PATH" };
  const candidats = [];
  if (process.platform === "win32") {
    const bases = [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]].filter(Boolean);
    for (const b of bases) candidats.push(["Chrome", path.join(b, "Google", "Chrome", "Application", "chrome.exe")], ["Chrome", path.join(b, "Google", "Chrome SxS", "Application", "chrome.exe")]);
    if (edge) for (const b of bases) candidats.push(["Edge", path.join(b, "Microsoft", "Edge", "Application", "msedge.exe")]);
  } else if (process.platform === "darwin") {
    for (const b of ["/Applications", path.join(os.homedir(), "Applications")]) candidats.push(["Chrome", path.join(b, "Google Chrome.app/Contents/MacOS/Google Chrome")]);
    if (edge) candidats.push(["Edge", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]);
  } else {
    const chrome = dansLePath(["google-chrome-stable", "google-chrome"], env);
    if (chrome) candidats.push(["Chrome", chrome]);
    const edgeLinux = edge && dansLePath(["microsoft-edge-stable", "microsoft-edge"], env);
    if (edgeLinux) candidats.push(["Edge", edgeLinux]);
    const chromium = dansLePath(["chromium-browser", "chromium"], env);
    if (chromium) candidats.push(["Chromium", chromium]);
  }
  const trouve = candidats.find(([, c]) => existe(c));
  if (trouve) return { chemin: trouve[1], origine: trouve[0] };
  const playwright = chromiumDePlaywright(env);
  return playwright ? { chemin: playwright, origine: "Chromium de Playwright" } : undefined;
}

/**
 * Lance le navigateur sans fenêtre et ouvre une page vide. Rend { envoyer(methode, params), attendre(evenement), fermer() } :
 * envoyer parle à la page (protocole DevTools), attendre résout au prochain événement de ce nom.
 */
async function ouvrir(chemin, { delai = 60000, env = process.env } = {}) {
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-navigateur-"));
  const args = ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profil}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--mute-audio"];
  // Dans le bac à sable de Claude Code (Linux, WSL2), Chromium ne peut pas créer le sien et s'arrête : le bac à sable
  // de Claude Code confine déjà le navigateur, qui se lance alors sans le sien.
  if (bacASable(env)) args.push("--no-sandbox");
  args.push("about:blank");
  const processus = spawn(chemin, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  const nettoyer = () => {
    try {
      processus.kill();
    } catch {
      // déjà arrêté
    }
    setTimeout(() => fs.rm(profil, { recursive: true, force: true, maxRetries: 5 }, () => {}), 300);
  };

  const adresse = await new Promise((resoudre, rejeter) => {
    let erreurs = "";
    const minuteur = setTimeout(() => rejeter(new Error(`le navigateur n'a pas répondu en ${delai / 1000} s`)), delai);
    processus.on("error", (e) => (clearTimeout(minuteur), rejeter(e)));
    processus.on("exit", (code) => {
      clearTimeout(minuteur);
      const aide = /error while loading shared libraries/.test(erreurs)
        ? " ; il manque des bibliothèques du système : sous Linux, lancez « sudo npx playwright install-deps chromium », ou installez Google Chrome"
        : bacASable(env)
          ? " ; le bac à sable de Claude Code refuse le navigateur : lancez « pulse-aidd autorisations --bac-a-sable --ecrire », qui fait passer cette commande hors du bac à sable"
          : "";
      rejeter(new Error(`le navigateur s'est arrêté (code ${code}) : ${erreurs.trim().split("\n").slice(-3).join(" ")}${aide}`));
    });
    processus.stderr.on("data", (d) => {
      erreurs += d;
      const m = erreurs.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(minuteur);
        resoudre(m[1]);
      }
    });
  }).catch((e) => {
    nettoyer();
    throw e;
  });

  const ws = new WebSocket(adresse);
  await new Promise((resoudre, rejeter) => {
    ws.addEventListener("open", resoudre, { once: true });
    ws.addEventListener("error", () => rejeter(new Error("connexion au navigateur impossible")), { once: true });
  }).catch((e) => {
    nettoyer();
    throw e;
  });

  let numero = 0;
  const enAttente = new Map();
  const ecouteurs = [];
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && enAttente.has(msg.id)) {
      const { resoudre, rejeter } = enAttente.get(msg.id);
      enAttente.delete(msg.id);
      if (msg.error) rejeter(new Error(msg.error.message));
      else resoudre(msg.result);
    } else if (msg.method) {
      for (const e of ecouteurs.filter((x) => x.methode === msg.method)) {
        ecouteurs.splice(ecouteurs.indexOf(e), 1);
        e.resoudre(msg.params);
      }
    }
  });
  const brut = (method, params = {}, sessionId) =>
    new Promise((resoudre, rejeter) => {
      const id = ++numero;
      enAttente.set(id, { resoudre, rejeter });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const { targetId } = await brut("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await brut("Target.attachToTarget", { targetId, flatten: true });
  const envoyer = (method, params) => brut(method, params, sessionId);
  const attendre = (methode, ms = delai) =>
    new Promise((resoudre, rejeter) => {
      const minuteur = setTimeout(() => {
        const i = ecouteurs.indexOf(e);
        if (i >= 0) ecouteurs.splice(i, 1);
        rejeter(new Error(`${methode} attendu en vain (${ms / 1000} s)`));
      }, ms);
      const e = { methode, resoudre: (p) => (clearTimeout(minuteur), resoudre(p)) };
      ecouteurs.push(e);
    });
  await envoyer("Page.enable");
  await envoyer("Runtime.enable");

  return {
    envoyer,
    attendre,
    fermer: async () => {
      try {
        await brut("Browser.close");
      } catch {
        // déjà fermé
      }
      ws.close();
      nettoyer();
    },
  };
}

module.exports = { trouverNavigateur, ouvrir };
