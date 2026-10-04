var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("zigzag.js");

var wave = VeloraZigzag.waveShape({ type: "rect", x: 10, y: 20, w: 100, h: 40 }, 12, 4);
assert.ok(wave && wave[0] === "M" && wave.slice(-1) === "Z", "rect wave closes");
assert.ok(wave.indexOf("L") > 0, "ridges become segments");
assert.ok(wave.length > 40, "wave has points");

var line = VeloraZigzag.waveShape({ type: "line", x1: 0, y1: 0, x2: 200, y2: 0 }, 10, 3);
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("200") >= 0, "end stays on the spine");
assert.ok(/L\d+ -?1?\d/.test(line), "peaks leave the spine");

var flat = VeloraZigzag.wavePath("M0 0L40 0", 0, 4);
assert.ok(!flat, "zero size is a no-op");

var circle = VeloraZigzag.waveShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 8, 5);
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

console.log("zigzag ok");
