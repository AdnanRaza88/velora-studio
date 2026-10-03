var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("scissors.js");

var open = VeloraScissors.cut("M0 0 L100 0 L100 40", 50, 0, 6);
assert.ok(open && open.pieces.length === 2, "open path splits");
assert.ok(open.pieces[0].indexOf("M0 0") === 0, "first piece starts at origin");
assert.ok(open.pieces[1].indexOf("Z") < 0, "split stays open");

var closed = VeloraScissors.cut("M0 0 L80 0 L80 60 L0 60 Z", 40, 0, 6);
assert.ok(closed && closed.opened && closed.pieces.length === 1, "closed path opens");
assert.ok(closed.pieces[0].indexOf("Z") < 0, "opened path has no close");

var miss = VeloraScissors.cut("M0 0 L10 0", 40, 40, 4);
assert.strictEqual(miss, null, "far click misses");

var curve = VeloraScissors.cut("M0 0 C30 40 70 40 100 0", 50, 30, 8);
assert.ok(curve && curve.pieces.length === 2, "cubic splits");
assert.ok(/C/.test(curve.pieces[0]) && /C/.test(curve.pieces[1]), "both pieces keep a cubic");

console.log("scissors-check ok");
