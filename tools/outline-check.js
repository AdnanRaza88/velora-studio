var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("vxl.js");
load("outline.js");

function doc(shapes) {
  return { layers: [{ id: "art", shapes: shapes }] };
}

var line = doc([{ id: "crest", type: "path", fill: "none", stroke: "accent", strokeWidth: 10, d: "M0 0 L100 0" }]);
var ids = VeloraOutline.apply(line, ["crest"]);
assert.deepStrictEqual(ids, ["crest"], "open stroke keeps its id");
assert.strictEqual(line.layers[0].shapes[0].type, "path");
assert.strictEqual(line.layers[0].shapes[0].fill, "accent");
assert.ok(line.layers[0].shapes[0].d.indexOf("Z") > 0, "outline closes");
assert.ok(!line.layers[0].shapes[0].strokeWidth, "stroke width is baked");

var box = doc([{ id: "box", type: "rect", x: 10, y: 20, w: 80, h: 40, fill: "figure", stroke: "accent", strokeWidth: 8 }]);
var both = VeloraOutline.apply(box, ["box"]);
assert.strictEqual(both.length, 1, "filled stroke adds an outline");
assert.strictEqual(box.layers[0].shapes.length, 2);
assert.strictEqual(box.layers[0].shapes[0].type, "rect");
assert.ok(!box.layers[0].shapes[0].strokeWidth, "source stroke clears");
assert.strictEqual(box.layers[0].shapes[0].fill, "figure");
assert.strictEqual(box.layers[0].shapes[1].fill, "accent");
assert.strictEqual(box.layers[0].shapes[1].type, "path");

var taper = doc([{ id: "vein", type: "path", fill: "none", stroke: "figure", strokeWidth: 8, widthProfile: [2, 16, 2], d: "M0 40 L120 40" }]);
VeloraOutline.apply(taper, ["vein"]);
assert.ok(!taper.layers[0].shapes[0].widthProfile, "profile bakes away");
assert.ok(taper.layers[0].shapes[0].d.length > 40, "taper outline has samples");

var locked = doc([{ id: "box", type: "rect", x: 0, y: 0, w: 40, h: 40, stroke: "figure", strokeWidth: 4 }]);
locked.layers[0].locked = true;
assert.deepStrictEqual(VeloraOutline.apply(locked, ["box"]), [], "locked layer is skipped");
assert.strictEqual(locked.layers[0].shapes[0].type, "rect");

var plain = doc([{ id: "box", type: "rect", x: 0, y: 0, w: 40, h: 40, fill: "figure" }]);
assert.deepStrictEqual(VeloraOutline.apply(plain, ["box"]), [], "fill without stroke stays");

console.log("outline-check ok");
