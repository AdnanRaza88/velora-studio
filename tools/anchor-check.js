var assert = require("assert");
var fs = require("fs");
var vm = require("vm");
var path = require("path");

function load(file) {
  var code = fs.readFileSync(path.join(__dirname, "../app/src/main/assets/www/js", file), "utf8");
  vm.runInThisContext(code, { filename: file });
}

load("anchors.js");

var added = VeloraAnchors.edit("M0 0 L100 0 L100 40", 50, 0, 6);
assert.ok(added && added.action === "add", "segment click adds");
assert.ok(added.d.indexOf("L50 0") >= 0, "new anchor sits on the segment");

var deleted = VeloraAnchors.edit("M0 0 L50 0 L100 0", 50, 0, 6);
assert.ok(deleted && deleted.action === "delete", "anchor click deletes");
assert.ok(deleted.d.indexOf("L50 0") < 0, "middle anchor is gone");
assert.ok(deleted.d.indexOf("L100 0") >= 0, "far end stays");

var closed = VeloraAnchors.edit("M0 0 L80 0 L80 60 L0 60 Z", 80, 0, 6);
assert.ok(closed && closed.action === "delete", "corner of a closed path deletes");
assert.ok(closed.d.indexOf("Z") >= 0, "shape stays closed");

var curve = VeloraAnchors.edit("M0 0 C30 40 70 40 100 0", 50, 30, 8);
assert.ok(curve && curve.action === "add", "cubic gains an anchor");
assert.ok((curve.d.match(/C/g) || []).length === 2, "split keeps two cubics");

var miss = VeloraAnchors.edit("M0 0 L10 0", 40, 40, 4);
assert.strictEqual(miss, null, "far click misses");

var thin = VeloraAnchors.edit("M0 0 L40 0 L40 40 Z", 40, 0, 6);
assert.strictEqual(thin, null, "triangle corner is not deleted");

console.log("anchor-check ok");
