var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("wave.js");
load("editor.js");

var wave = VeloraWave.waveShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 40, 2, "h");
assert.ok(wave && wave[0] === "M" && wave.slice(-1) === "Z", "rect wave closes");
assert.ok(wave.indexOf("C") > 0, "wave bakes cubics");

var again = VeloraWave.waveShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 40, 2, "h");
assert.strictEqual(again, wave, "same bend stays stable");

var flipped = VeloraWave.waveShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, -40, 2, "h");
assert.notStrictEqual(flipped, wave, "negative bend flips the sine");

var denser = VeloraWave.waveShape({ type: "rect", x: 0, y: 0, w: 200, h: 40 }, 40, 4, "h");
assert.notStrictEqual(denser, wave, "more waves change the path");

var flat = VeloraWave.wavePath("M0 0L40 0L40 40Z", 0, 2, "h");
assert.ok(!flat, "zero bend is a no-op");

var line = VeloraWave.waveShape({ type: "line", x1: 0, y1: 20, x2: 200, y2: 20 }, 50, 2, "h");
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("C") > 0, "open line bakes cubics");

var circle = VeloraWave.waveShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 30, 1, "v");
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

var doc = { meta: {}, layers: [{ id: "l", shapes: [{ id: "r", type: "rect", x: 10, y: 10, w: 80, h: 40 }] }] };
var n = VeloraEdit.wave(doc, ["r"], 36, 2, "h");
assert.strictEqual(n, 1, "editor bakes one path");
assert.strictEqual(doc.layers[0].shapes[0].type, "path");
assert.ok(doc.layers[0].shapes[0].d.indexOf("C") > 0, "editor path has cubics");
assert.ok(doc.layers[0].shapes[0].w === undefined, "rect fields drop");

console.log("wave ok");
