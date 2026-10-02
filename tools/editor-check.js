const assert = require("assert");
const path = require("path");

global.window = undefined;
require(path.join(__dirname, "../app/src/main/assets/www/js/vxl.js"));
require(path.join(__dirname, "../app/src/main/assets/www/js/editor.js"));

const V = global.VeloraVxl;
const E = global.VeloraEdit;

const doc = V.validate({
  vxl: 1,
  meta: { name: "Edit", category: "logo" },
  canvas: { viewBox: [0, 0, 200, 200] },
  palette: { ground: "#ffffff", figure: "#111111", accent: "#355e57" },
  layers: [{
    id: "l",
    shapes: [
      { id: "dot", type: "circle", cx: 40, cy: 50, r: 10 },
      { id: "box", type: "rect", x: 10, y: 10, w: 20, h: 30 },
      { id: "line", type: "path", d: "M0 0 L10 0 L10 10 Z" }
    ]
  }]
}).document;

E.apply(doc, "dot", E.moveMatrix(5, -2), "move");
assert.strictEqual(doc.layers[0].shapes[0].cx, 45);
assert.strictEqual(doc.layers[0].shapes[0].cy, 48);

E.apply(doc, "box", E.scaleMatrix(2, 2, 20, 25), "scale");
assert.strictEqual(doc.layers[0].shapes[1].w, 40);
assert.strictEqual(doc.layers[0].shapes[1].h, 60);

E.apply(doc, "box", E.rotateMatrix(90, 20, 25), "rotate");
assert.strictEqual(doc.layers[0].shapes[1].type, "rect");
assert.ok(Math.abs(doc.layers[0].shapes[1].rot - 90) < 0.01);

E.apply(doc, "line", E.moveMatrix(3, 4), "move");
assert.ok(doc.layers[0].shapes[2].d.indexOf("M3 4") === 0);

const hit = E.hitTest(doc, 45, 48);
assert.ok(hit && (hit.id === "dot" || hit.id === "box"));

const checked = V.validate(doc);
assert.strictEqual(checked.ok, true, checked.errors.join("; "));
assert.ok(V.compile(checked.document).indexOf("<circle") >= 0);
console.log("editor checks ok");
