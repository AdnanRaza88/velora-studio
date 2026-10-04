var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("fisheye.js");
load("editor.js");

var risen = VeloraEye.eyeShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 46, 1, "h");
assert.ok(risen && risen[0] === "M" && risen.slice(-1) === "Z", "rect fisheye closes");
assert.ok(risen.indexOf("C") > 0, "fisheye bakes cubics");

var again = VeloraEye.eyeShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 46, 1, "h");
assert.strictEqual(again, risen, "same bend stays stable");

var flipped = VeloraEye.eyeShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, -46, 1, "h");
assert.notStrictEqual(flipped, risen, "negative bend pulls inward");

var denser = VeloraEye.eyeShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 46, 2, "h");
assert.notStrictEqual(denser, risen, "more rings change the path");

var flat = VeloraEye.eyePath("M0 0L40 0L40 40Z", 0, 1, "h");
assert.ok(!flat, "zero bend is a no-op");

var line = VeloraEye.eyeShape({ type: "line", x1: 0, y1: 20, x2: 200, y2: 20 }, 50, 1, "h");
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("C") > 0, "open line bakes cubics");

var circle = VeloraEye.eyeShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 30, 1, "v");
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

var doc = { meta: {}, layers: [{ id: "l", shapes: [{ id: "r", type: "rect", x: 10, y: 10, w: 80, h: 40 }] }] };
var n = VeloraEdit.eye(doc, ["r"], 46, 1, "h");
assert.strictEqual(n, 1, "editor bakes one path");
assert.strictEqual(doc.layers[0].shapes[0].type, "path");
assert.ok(doc.layers[0].shapes[0].d.indexOf("C") > 0, "editor path has cubics");
assert.ok(doc.layers[0].shapes[0].w === undefined, "rect fields drop");

console.log("fisheye ok");
