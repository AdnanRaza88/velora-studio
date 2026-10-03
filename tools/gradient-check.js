const assert = require("assert");
const path = require("path");

global.window = undefined;
require(path.join(__dirname, "../app/src/main/assets/www/js/vxl.js"));
require(path.join(__dirname, "../app/src/main/assets/www/js/gradient.js"));
require(path.join(__dirname, "../app/src/main/assets/www/js/editor.js"));

const V = global.VeloraVxl;
const G = global.VeloraGradient;
const E = global.VeloraEdit;

const g = G.linear({ x: 10, y: 20, w: 100, h: 40 }, 0, "figure", "accent");
assert.strictEqual(g.type, "linear");
assert.ok(g.x2 > g.x1);

const doc = V.validate({
  vxl: 1,
  canvas: { viewBox: [0, 0, 200, 200] },
  palette: { ground: "#f6f1e8", figure: "#1b3358", accent: "#355e57" },
  layers: [{ id: "l", name: "L", shapes: [{ id: "r", type: "rect", x: 10, y: 20, width: 100, height: 40 }] }]
}).document;

assert.strictEqual(E.paintGradient(doc, ["r"], 90, "figure", "accent"), 1);
assert.ok(doc.layers[0].shapes[0].gradient.y2 !== doc.layers[0].shapes[0].gradient.y1);
const svg = V.compile(doc);
assert.ok(svg.indexOf("linearGradient") >= 0);
assert.ok(svg.indexOf("stop-color=\"#1b3358\"") >= 0);
assert.ok(svg.indexOf("stop-color=\"#355e57\"") >= 0);
assert.strictEqual(E.clearGradient(doc, ["r"]), 1);
assert.ok(!doc.layers[0].shapes[0].gradient);
assert.ok(V.compile(doc).indexOf("linearGradient") < 0);
console.log("gradient-check ok");
