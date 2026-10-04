var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("roughen.js");

var rough = VeloraRoughen.roughShape({ type: "rect", x: 10, y: 20, w: 100, h: 40 }, 8, 4, "corner");
assert.ok(rough && rough[0] === "M" && rough.slice(-1) === "Z", "rect roughen closes");
assert.ok(rough.indexOf("L") > 0, "corner points stay segments");
assert.ok(rough.length > 40, "detail adds points");

var again = VeloraRoughen.roughShape({ type: "rect", x: 10, y: 20, w: 100, h: 40 }, 8, 4, "corner");
assert.strictEqual(again, rough, "same size and detail stay stable");

var line = VeloraRoughen.roughShape({ type: "line", x1: 0, y1: 0, x2: 200, y2: 0 }, 12, 3, "corner");
assert.ok(line && line.slice(-1) !== "Z", "open line stays open");
assert.ok(line.indexOf("M0 0") === 0, "open start stays put");
assert.ok(line.indexOf("200") >= 0, "open end stays on the spine");

var flat = VeloraRoughen.roughPath("M0 0L40 0", 0, 4, "corner");
assert.ok(!flat, "zero size is a no-op");

var circle = VeloraRoughen.roughShape({ type: "circle", cx: 40, cy: 40, r: 30 }, 6, 5, "smooth");
assert.ok(circle && circle.slice(-1) === "Z", "circle bakes closed");
assert.ok(circle.indexOf("C") > 0, "smooth points become cubics");

console.log("roughen ok");
