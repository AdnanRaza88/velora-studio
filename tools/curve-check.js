const assert = require("assert");
const path = require("path");
global.window = undefined;
require(path.join(__dirname, "../app/src/main/assets/www/js/curve.js"));
const C = global.VeloraCurve;
const open = C.fit([
  { x: 0, y: 0 },
  { x: 40, y: 80 },
  { x: 100, y: 20 }
], false);
assert.ok(open.d.indexOf("M0 0") === 0);
assert.ok(open.d.indexOf("C") >= 0);
assert.strictEqual(open.closed, false);
const corner = C.fit([
  { x: 0, y: 0, corner: true },
  { x: 50, y: 0, corner: true },
  { x: 50, y: 40 }
], false);
assert.ok(corner.d.indexOf("L50 0") >= 0);
const loop = C.fit([
  { x: 10, y: 10 },
  { x: 80, y: 10 },
  { x: 40, y: 70 }
], true);
assert.strictEqual(loop.closed, true);
assert.ok(loop.d.endsWith("Z"));
assert.strictEqual(C.fit([{ x: 1, y: 1 }], false), null);
console.log("curve-check ok");
