// Wiki Pulse – gabarit commun : en-tête, navigation latérale des commandes, sommaire, boutons Copier, pied de page.
// La page indique sa racine relative dans <html data-racine="../"> et, pour une commande, data-commande="init".
// Le contenu reste lisible sans JavaScript : seuls la navigation et les boutons manquent alors.
(function () {
  "use strict";

  var donnees = window.PULSE_WIKI || { etapes: [], navigation: [], commandes: [] };
  var html = document.documentElement;
  var racine = html.getAttribute("data-racine") || "";
  var commande = html.getAttribute("data-commande");
  var ici = location.pathname.replace(/\\/g, "/");

  function el(balise, attributs, enfants) {
    var n = document.createElement(balise);
    Object.keys(attributs || {}).forEach(function (k) {
      if (k === "texte") n.textContent = attributs[k];
      else n.setAttribute(k, attributs[k]);
    });
    (enfants || []).forEach(function (e) { if (e) n.appendChild(e); });
    return n;
  }

  // Une page est « la page actuelle » quand l'adresse se termine par son chemin depuis la racine du wiki.
  function estIci(href) {
    var cible = href.replace(/^\.\//, "");
    return ici.slice(-cible.length) === cible || (cible === "index.html" && /\/wiki\/?$/.test(ici));
  }

  // Logo : une onde de pouls dans un cercle, aux couleurs de la traînée.
  function logo() {
    var svg = '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="logo-trainee" x1="0" x2="1">'
      + '<stop offset="0" stop-color="#FF6B35"/><stop offset=".5" stop-color="#C56CF0"/><stop offset="1" stop-color="#8E44AD"/></linearGradient></defs>'
      + '<circle cx="16" cy="16" r="15" fill="none" stroke="url(#logo-trainee)" stroke-width="1.5" opacity=".6"/>'
      + '<path d="M4 17h6l2.5-6 4 12 3-9 1.8 3H28" fill="none" stroke="url(#logo-trainee)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var s = document.createElement("span");
    s.innerHTML = svg;
    return s.firstChild;
  }

  function entete() {
    var liste = el("ul", { id: "menu-principal" });
    donnees.navigation.forEach(function (p) {
      var a = el("a", { href: racine + p.href, texte: p.titre });
      if (estIci(p.href) || (p.href === "commandes/index.html" && commande)) a.setAttribute("aria-current", "page");
      liste.appendChild(el("li", {}, [a]));
    });
    var nav = el("nav", { class: "navigation", "aria-label": "Navigation principale" }, [liste]);
    var bouton = el("button", { class: "bouton bouton-fantome bouton-menu", type: "button", "aria-expanded": "false", "aria-controls": "menu-principal", texte: "Menu" });
    bouton.addEventListener("click", function () {
      var ouvert = nav.classList.toggle("ouverte");
      bouton.setAttribute("aria-expanded", ouvert ? "true" : "false");
    });
    var marque = el("a", { class: "marque", href: racine + "index.html" }, [logo(), el("span", { texte: "Pulse" }), el("span", { class: "visuellement-cache", texte: " – accueil du wiki" })]);
    var barre = el("div", { class: "barre" }, [marque, bouton, nav]);
    var header = el("header", { class: "entete-site" }, [barre]);
    var evitement = el("a", { class: "lien-evitement", href: "#contenu", texte: "Aller au contenu" });
    document.body.insertBefore(header, document.body.firstChild);
    document.body.insertBefore(evitement, header);
  }

  // Navigation latérale des pages de commandes : les commandes groupées par étape.
  function laterale() {
    var cible = document.querySelector("[data-laterale]");
    if (!cible) return;
    donnees.etapes.forEach(function (etape) {
      cible.appendChild(el("h2", { texte: etape.numero + ". " + etape.nom }));
      var ul = el("ul");
      etape.commandes.forEach(function (nom) {
        var a = el("a", { href: racine + "commandes/" + nom + ".html", texte: "/pulse:" + nom });
        if (nom === commande) a.setAttribute("aria-current", "page");
        ul.appendChild(el("li", {}, [a]));
      });
      cible.appendChild(ul);
    });
  }

  // Sommaire : les titres h2 portant un id dans le contenu.
  function sommaire() {
    var cible = document.querySelector("[data-sommaire]");
    if (!cible) return;
    document.querySelectorAll(".typographie h2").forEach(function (h) {
      var section = h.closest("section[id]");
      var id = h.id || (section && section.id);
      if (!id) return;
      cible.appendChild(el("li", {}, [el("a", { href: "#" + id, texte: h.textContent })]));
    });
  }

  // Commande précédente et suivante dans l'ordre du parcours.
  function suite() {
    var cible = document.querySelector("[data-suite]");
    if (!cible || !commande) return;
    var ordre = [];
    donnees.etapes.forEach(function (e) { ordre = ordre.concat(e.commandes); });
    var i = ordre.indexOf(commande);
    if (i > 0) cible.appendChild(el("a", { class: "bouton bouton-grand", href: ordre[i - 1] + ".html", texte: "← /pulse:" + ordre[i - 1] }));
    if (i >= 0 && i < ordre.length - 1) cible.appendChild(el("a", { class: "bouton bouton-grand", href: ordre[i + 1] + ".html", texte: "/pulse:" + ordre[i + 1] + " →" }));
  }

  function boutonsCopier() {
    document.querySelectorAll("pre.commande").forEach(function (pre) {
      var code = pre.querySelector("code");
      if (!code || !navigator.clipboard) return;
      var b = el("button", { class: "bouton bouton-copier", type: "button", texte: "Copier" });
      b.addEventListener("click", function () {
        navigator.clipboard.writeText(code.textContent.trim()).then(function () {
          b.textContent = "Copié";
          setTimeout(function () { b.textContent = "Copier"; }, 1600);
        });
      });
      pre.appendChild(b);
    });
  }

  // CTA à flamme : chaque lettre du libellé reçoit son rang, pour l'onde au survol.
  function lettresCta() {
    document.querySelectorAll(".cta[data-onde]").forEach(function (cta) {
      var texte = cta.textContent;
      cta.setAttribute("aria-label", texte.trim());
      cta.textContent = "";
      Array.prototype.forEach.call(texte, function (c, i) {
        var s = el("span", { class: "lettre", "aria-hidden": "true", texte: c });
        s.style.setProperty("--i", i);
        cta.appendChild(s);
      });
    });
  }

  function pied() {
    var liens = el("p", {}, [
      el("a", { href: racine + "commandes/index.html", texte: "Toutes les commandes" }),
    ]);
    var texte = el("p", { texte: "Wiki de la méthode Pulse pour Claude Code. Les commandes se tapent dans Claude Code, puis on se laisse guider." });
    document.body.appendChild(el("footer", { class: "pied-site" }, [el("div", { class: "conteneur" }, [texte, liens])]));
  }

  entete();
  laterale();
  sommaire();
  suite();
  boutonsCopier();
  lettresCta();
  pied();
})();
