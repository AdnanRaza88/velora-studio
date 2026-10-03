var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("boolean.js");
load("shape.js");

function doc(shapes) {
  return { layers: [{ id: "art", shapes: shapes }] };
}

var merged = VeloraShape.mergeAt(doc([
  { id: "a", type: "rect", x: 0, y: 0, w: 80, h: 60, fill: "figure" },
  { id: "b", type: "rect", x: 40, y: 20, w: 80, h: 60, fill: "accent" }
]), 50, 30);
assert.ok(merged && merged.type === "path", "overlap click merges");
assert.ok(merged.d.indexOf("Z") > 0, "merged path closes");

var erased = doc([
  { id: "a", type: "rect", x: 0, y: 0, w: 80, h: 60, fill: "figure" },
  { id: "b", type: "rect", x: 40, y: 20, w: 80, h: 60, fill: "accent" }
]);
var face = VeloraShape.eraseAt(erased, 50, 30);
assert.ok(face && face.erased === "b", "alt click drops the overlap face");
assert.strictEqual(erased.layers[0].shapes.length, 2, "both leftovers stay");

var lone = doc([{ id: "only", type: "rect", x: 0, y: 0, w: 40, h: 40 }]);
assert.ok(VeloraShape.eraseAt(lone, 10, 10), "lone face deletes");
assert.strictEqual(lone.layers[0].shapes.length, 0, "layer is empty");

var dragged = doc([
  { id: "a", type: "rect", x: 0, y: 0, w: 40, h: 40, fill: "figure" },
  { id: "b", type: "rect", x: 30, y: 0, w: 40, h: 40, fill: "ground" },
  { id: "c", type: "rect", x: 60, y: 0, w: 40, h: 40, fill: "accent" }
]);
var chain = VeloraShape.mergeIds(dragged, ["a", "b", "c"]);
assert.ok(chain && dragged.layers[0].shapes.length === 1, "drag merges the crossed shapes");

var miss = VeloraShape.mergeAt(doc([{ id: "a", type: "rect", x: 0, y: 0, w: 20, h: 20 }]), 5, 5);
assert.strictEqual(miss, null, "one shape does not merge");

console.log("shape-check ok");
