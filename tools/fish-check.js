var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("fish.js");
load("editor.js");

var flag = VeloraFish.fishShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 42, 1, "h");
assert.ok(flag && flag[0] === "M" && flag.slice(-1) === "Z", "rect fish closes");
assert.ok(flag.indexOf("C") > 0, "fish bakes cubics");

var again = VeloraFish.fishShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 42, 1, "h");
assert.strictEqual(again, flag, "same bend stays stable");

var flipped = VeloraFish.fishShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, -42, 1, "h");
assert.notStrictEqual(flipped, flag, "negative bend flips the swing");

var denser = VeloraFish.fishShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 42, 2, "h");
assert.notStrictEqual(denser, flag, "more waves change the path");

var flat = VeloraFish.fishPath("M0 0L40 0L40 40Z", 0, 1, "h");
assert.ok(!flat, "zero bend is a no-op");

var line = VeloraFish.fishShape({ type: "line", x1: 0, y1: 20, x2: 200, y2: 20 }, 50, 1, "h");
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("C") > 0, "open line bakes cubics");

var circle = VeloraFish.fishShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 30, 1, "v");
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

var doc = { meta: {}, layers: [{ id: "l", shapes: [{ id: "r", type: "rect", x: 10, y: 10, w: 80, h: 40 }] }] };
var n = VeloraEdit.fish(doc, ["r"], 42, 1, "h");
assert.strictEqual(n, 1, "editor bakes one path");
assert.strictEqual(doc.layers[0].shapes[0].type, "path");
assert.ok(doc.layers[0].shapes[0].d.indexOf("C") > 0, "editor path has cubics");
assert.ok(doc.layers[0].shapes[0].w === undefined, "rect fields drop");

console.log("flag ok");
