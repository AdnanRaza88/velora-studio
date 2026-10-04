var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("pucker.js");

var bloat = VeloraPucker.puckerShape({ type: "rect", x: 0, y: 0, w: 100, h: 100 }, 50);
assert.ok(bloat && bloat[0] === "M" && bloat.slice(-1) === "Z", "rect bloat closes");
assert.ok(bloat.indexOf("C") > 0, "bloat bakes cubics");

var again = VeloraPucker.puckerShape({ type: "rect", x: 0, y: 0, w: 100, h: 100 }, 50);
assert.strictEqual(again, bloat, "same amount stays stable");

var pucker = VeloraPucker.puckerShape({ type: "rect", x: 0, y: 0, w: 100, h: 100 }, -50);
assert.ok(pucker && pucker.slice(-1) === "Z", "pucker closes");
assert.notStrictEqual(pucker, bloat, "pucker differs from bloat");

var flat = VeloraPucker.puckerPath("M0 0L40 0L40 40Z", 0);
assert.ok(!flat, "zero amount is a no-op");

var line = VeloraPucker.puckerShape({ type: "line", x1: 0, y1: 0, x2: 200, y2: 0 }, 40);
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("C") > 0, "open line bakes cubics");

var circle = VeloraPucker.puckerShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 30);
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");

console.log("pucker ok");
