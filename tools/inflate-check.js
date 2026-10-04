var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("inflate.js");
load("editor.js");

var risen = VeloraInflate.inflateShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 48, 1, "h");
assert.ok(risen && risen[0] === "M" && risen.slice(-1) === "Z", "rect inflate closes");
assert.ok(risen.indexOf("C") > 0, "inflate bakes cubics");

var again = VeloraInflate.inflateShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 48, 1, "h");
assert.strictEqual(again, risen, "same bend stays stable");

var flipped = VeloraInflate.inflateShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, -48, 1, "h");
assert.notStrictEqual(flipped, risen, "negative bend pulls edges in");

var denser = VeloraInflate.inflateShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 48, 2, "h");
assert.notStrictEqual(denser, risen, "more lobes change the path");

var flat = VeloraInflate.inflatePath("M0 0L40 0L40 40Z", 0, 1, "h");
assert.ok(!flat, "zero bend is a no-op");

var line = VeloraInflate.inflateShape({ type: "line", x1: 0, y1: 20, x2: 200, y2: 20 }, 50, 1, "h");
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("C") > 0, "open line bakes cubics");

var circle = VeloraInflate.inflateShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 30, 1, "v");
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

var doc = { meta: {}, layers: [{ id: "l", shapes: [{ id: "r", type: "rect", x: 10, y: 10, w: 80, h: 40 }] }] };
var n = VeloraEdit.inflate(doc, ["r"], 48, 1, "h");
assert.strictEqual(n, 1, "editor bakes one path");
assert.strictEqual(doc.layers[0].shapes[0].type, "path");
assert.ok(doc.layers[0].shapes[0].d.indexOf("C") > 0, "editor path has cubics");
assert.ok(doc.layers[0].shapes[0].w === undefined, "rect fields drop");

console.log("inflate ok");
