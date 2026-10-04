var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("boolean.js");
load("divide.js");

function doc(shapes) {
  return { layers: [{ id: "art", shapes: shapes }] };
}

var crossed = doc([
  { id: "back", type: "rect", x: 0, y: 0, w: 80, h: 80, fill: "ground" },
  { id: "front", type: "rect", x: 40, y: 40, w: 80, h: 80, fill: "accent" }
]);
var n = VeloraDivide.divide(crossed, "front");
assert.strictEqual(n, 3, "overlap splits into three faces");
assert.strictEqual(crossed.layers[0].shapes.length, 3, "both sources are replaced");
var fills = crossed.layers[0].shapes.map(function (shape) { return shape.fill; });
assert.ok(fills.indexOf("ground") >= 0, "back-only keeps ground");
assert.ok(fills.indexOf("accent") >= 0, "overlap and front keep accent");
crossed.layers[0].shapes.forEach(function (shape) {
  assert.strictEqual(shape.type, "path", "face is a path");
  assert.ok(shape.d.indexOf("Z") > 0, "face closes");
});

var miss = doc([
  { id: "a", type: "rect", x: 0, y: 0, w: 30, h: 30, fill: "figure" },
  { id: "b", type: "rect", x: 80, y: 80, w: 30, h: 30, fill: "accent" }
]);
assert.strictEqual(VeloraDivide.divide(miss, "b"), 0, "disjoint pair is unchanged");
assert.strictEqual(miss.layers[0].shapes[0].type, "rect", "source stays a rect");

var alone = doc([{ id: "only", type: "rect", x: 0, y: 0, w: 40, h: 40 }]);
assert.strictEqual(VeloraDivide.divide(alone, "only"), 0, "one shape cannot divide");

var locked = doc([
  { id: "back", type: "rect", x: 0, y: 0, w: 50, h: 50 },
  { id: "front", type: "rect", x: 10, y: 10, w: 50, h: 50 }
]);
locked.layers[0].locked = true;
assert.strictEqual(VeloraDivide.divide(locked, "front"), 0, "locked layer is skipped");

console.log("divide-check ok");
