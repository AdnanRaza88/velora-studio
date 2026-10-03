var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("boolean.js");
load("knife.js");

function doc(shapes) {
  return { layers: [{ id: "art", shapes: shapes }] };
}

var sliced = doc([{ id: "box", type: "rect", x: 0, y: 0, w: 100, h: 60, fill: "figure" }]);
var ids = VeloraKnife.cut(sliced, [[-10, 30], [110, 30]]);
assert.ok(ids && ids.length === 2, "horizontal knife splits the rect");
assert.strictEqual(sliced.layers[0].shapes.length, 2, "two paths replace the rect");
sliced.layers[0].shapes.forEach(function (shape) {
  assert.strictEqual(shape.type, "path", "piece is a path");
  assert.ok(shape.d.indexOf("Z") > 0, "piece closes");
});

var miss = doc([{ id: "box", type: "rect", x: 0, y: 0, w: 40, h: 40 }]);
assert.strictEqual(VeloraKnife.cut(miss, [[80, 0], [90, 10]]), null, "miss leaves the document");
assert.strictEqual(miss.layers[0].shapes[0].type, "rect", "untouched shape stays a rect");

var locked = doc([{ id: "box", type: "rect", x: 0, y: 0, w: 40, h: 40 }]);
locked.layers[0].locked = true;
assert.strictEqual(VeloraKnife.cut(locked, [[-5, 20], [50, 20]]), null, "locked layer is skipped");

var triangle = doc([{ id: "tri", type: "path", d: "M0 0 L80 0 L40 70 Z", fill: "accent" }]);
var tri = VeloraKnife.cut(triangle, [[10, -5], [70, 80]]);
assert.ok(tri && tri.length === 2, "closed path splits");
assert.ok(triangle.layers[0].shapes.every(function (shape) { return shape.fill === "accent"; }), "ink stays");

console.log("knife-check ok");
