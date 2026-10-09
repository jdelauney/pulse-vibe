// Pulse – écoute locale sur un port que fetch et les navigateurs acceptent.
//
// listen(0) laisse le système choisir le port. Sous Windows, la plage dynamique peut commencer à 1024
// (netsh int ipv4 show dynamicport tcp) : le port tiré peut alors être un port bloqué par la norme Fetch
// (6666, 5060…), que fetch de Node refuse (« bad port ») comme Chrome ou Firefox. On en tire un autre.
"use strict";

// https://fetch.spec.whatwg.org/#port-blocking
const PORTS_BLOQUES = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135,
  137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720,
  1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080,
]);

/** Met `serveur` (net.Server ou http.Server) à l'écoute sur `hote`, sur un port accepté par fetch ; rend ce port. */
async function ecouter(serveur, hote = "127.0.0.1") {
  for (;;) {
    await new Promise((ok, ko) => {
      const echec = (e) => ko(e);
      serveur.once("error", echec);
      serveur.listen(0, hote, () => {
        serveur.off("error", echec);
        ok();
      });
    });
    const { port } = serveur.address();
    if (!PORTS_BLOQUES.has(port)) return port;
    await new Promise((ok) => serveur.close(() => ok()));
  }
}

module.exports = { PORTS_BLOQUES, ecouter };
