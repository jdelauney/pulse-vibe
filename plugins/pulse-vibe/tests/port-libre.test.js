// Tests de l'écoute sur un port accepté par fetch (scripts/port-libre.js).
// Lancer : node --test plugins/pulse-vibe/tests/port-libre.test.js
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { EventEmitter } = require("events");
const { PORTS_BLOQUES, ecouter } = require("../scripts/port-libre");

test("un port bloqué par fetch (6666) est rendu, puis un autre est tiré", async () => {
  const tires = [6666, 5060, 40123];
  const faux = Object.assign(new EventEmitter(), {
    ouverts: 0,
    fermes: 0,
    listen(port, hote, pret) {
      assert.deepStrictEqual([port, hote], [0, "127.0.0.1"]);
      this.port = tires[this.ouverts++];
      setImmediate(pret);
    },
    address() {
      return { port: this.port };
    },
    close(fini) {
      this.fermes++;
      setImmediate(fini);
    },
  });
  assert.strictEqual(await ecouter(faux), 40123);
  assert.deepStrictEqual([faux.ouverts, faux.fermes], [3, 2]);
});

test("un vrai serveur : port accepté par fetch, qui répond", async () => {
  const s = http.createServer((req, res) => res.end("ok"));
  const port = await ecouter(s);
  assert.ok(!PORTS_BLOQUES.has(port));
  assert.strictEqual(await (await fetch(`http://127.0.0.1:${port}/`)).text(), "ok");
  s.close();
});
