var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("flag.js");
load("editor.js");

var flag = VeloraFlag.flagShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 42, 1, "h");
assert.ok(flag && flag[0] === "M" && flag.slice(-1) === "Z", "rect flag closes");
assert.ok(flag.indexOf("C") > 0, "flag bakes cubics");

var again = VeloraFlag.flagShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 42, 1, "h");
assert.strictEqual(again, flag, "same bend stays stable");

var flipped = VeloraFlag.flagShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, -42, 1, "h");
assert.notStrictEqual(flipped, flag, "negative bend flips the lift");

var denser = VeloraFlag.flagShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 42, 2, "h");
assert.notStrictEqual(denser, flag, "more waves change the path");

var flat = VeloraFlag.flagPath("M0 0L40 0L40 40Z", 0, 1, "h");
assert.ok(!flat, "zero bend is a no-op");

var line = VeloraFlag.flagShape({ type: "line", x1: 0, y1: 20, x2: 200, y2: 20 }, 50, 1, "h");
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("C") > 0, "open line bakes cubics");

var circle = VeloraFlag.flagShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 30, 1, "v");
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

var doc = { meta: {}, layers: [{ id: "l", shapes: [{ id: "r", type: "rect", x: 10, y: 10, w: 80, h: 40 }] }] };
var n = VeloraEdit.flag(doc, ["r"], 42, 1, "h");
assert.strictEqual(n, 1, "editor bakes one path");
assert.strictEqual(doc.layers[0].shapes[0].type, "path");
assert.ok(doc.layers[0].shapes[0].d.indexOf("C") > 0, "editor path has cubics");
assert.ok(doc.layers[0].shapes[0].w === undefined, "rect fields drop");

console.log("flag ok");
