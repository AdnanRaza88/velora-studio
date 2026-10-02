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

const curve = V.validate({
  vxl: 1,
  meta: { name: "Pen", category: "logo" },
  canvas: { viewBox: [0, 0, 200, 200] },
  palette: { ground: "#ffffff", figure: "#111111", accent: "#355e57" },
  layers: [{ id: "l", shapes: [
    { id: "curve", type: "path", d: "M10 10 C30 10 40 40 60 40" },
    { id: "box2", type: "rect", x: 80, y: 80, w: 20, h: 20 }
  ]}]
}).document;
const before = E.handles(curve.layers[0].shapes[0]);
assert.strictEqual(before.filter(function (h) { return h.role === "anchor"; }).length, 2);
assert.ok(E.hitHandle(curve.layers[0].shapes[0], 60, 40, 8).role === "anchor");
E.moveHandle(curve, "curve", 1, "anchor", 70, 50);
assert.ok(curve.layers[0].shapes[0].d.indexOf("70 50") >= 0);
assert.ok(curve.layers[0].shapes[0].d.indexOf("C30 10") === -1 || curve.layers[0].shapes[0].d.indexOf("50 50") >= 0);
E.moveHandle(curve, "curve", 1, "out", 42, 55);
assert.ok(curve.layers[0].shapes[0].d.indexOf("42 55") >= 0);
assert.ok(E.penReady(curve.layers[0].shapes[1]).type === "path");
assert.ok(curve.layers[0].shapes[1].d.indexOf("M80 80") === 0);
const penChecked = V.validate(curve);
assert.strictEqual(penChecked.ok, true, penChecked.errors.join("; "));

const stroke = V.validate({
  vxl: 1,
  meta: { name: "Width", category: "illustration" },
  canvas: { viewBox: [0, 0, 200, 80] },
  palette: { ground: "#ffffff", figure: "#111111", accent: "#355e57" },
  layers: [{ id: "l", shapes: [
    { id: "vein", type: "path", fill: "none", stroke: "figure", strokeWidth: 12, d: "M10 40 C50 10 90 70 150 40", widthProfile: "taper" }
  ]}]
}).document;
assert.ok(stroke.layers[0].shapes[0].widthProfile.length >= 3);
assert.strictEqual(stroke.layers[0].shapes[0].profile, "taper");
E.applyWidth(stroke, "vein", "swell");
assert.strictEqual(stroke.layers[0].shapes[0].profile, "swell");
const handles = E.widthHandles(stroke.layers[0].shapes[0]);
assert.ok(handles.length >= 3);
E.setWidthSample(stroke, "vein", 2, 20);
assert.strictEqual(stroke.layers[0].shapes[0].widthProfile[2], 20);
const svg = V.compile(stroke);
assert.ok(svg.indexOf("<path") >= 0);
assert.ok(svg.indexOf("stroke-width") < 0);
assert.ok(svg.indexOf(" Z") >= 0 || svg.indexOf("Z") >= 0);

console.log("editor checks ok");

