const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const vxlPath = path.join(root, "app/src/main/assets/www/js/vxl.js");
const goldenDir = path.join(root, "docs/spec/golden");

global.window = undefined;
require(vxlPath);
const V = global.VeloraVxl;

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(goldenDir, name), "utf8"));
}

function stable(doc) {
  const copy = JSON.parse(JSON.stringify(doc));
  delete copy.meta.updated;
  delete copy.meta.created;
  return copy;
}

const logo = load("logo.json");
const logoChecked = V.validate(logo.doc);
assert.strictEqual(logoChecked.ok, true, logoChecked.errors.join("; "));
assert.strictEqual(logoChecked.document.meta.skill, "logo");
const logoSvg = V.compile(logoChecked.document);
assert.ok(logoSvg.indexOf('viewBox="0 0 1024 1024"') >= 0);
assert.ok(logoSvg.indexOf("North") >= 0);
assert.strictEqual(V.compile(V.validate(logo.doc).document), logoSvg);

const textile = load("textile.json");
const textileChecked = V.validate(textile.doc);
assert.strictEqual(textileChecked.ok, true, textileChecked.errors.join("; "));
assert.deepStrictEqual(textileChecked.document.canvas.viewBox, [0, 0, 840, 840]);
assert.strictEqual(textileChecked.document.repeat.type, "half-drop");
const textileSvg = V.compile(textileChecked.document);
assert.ok(textileSvg.indexOf("translate(") >= 0);
assert.strictEqual(V.compile(V.validate(textile.doc).document), textileSvg);

const patterned = JSON.parse(JSON.stringify(textile.doc));
patterned.repeat.offset = [12, -4];
patterned.repeat.gap = [8, 6];
patterned.repeat.scale = 0.8;
patterned.repeat.rotate = 15;
patterned.repeat.cols = 3;
patterned.repeat.rows = 2;
const patternedChecked = V.validate(patterned);
assert.strictEqual(patternedChecked.ok, true, patternedChecked.errors.join("; "));
assert.deepStrictEqual(patternedChecked.document.repeat.offset, [12, -4]);
assert.deepStrictEqual(patternedChecked.document.repeat.gap, [8, 6]);
assert.strictEqual(patternedChecked.document.repeat.scale, 0.8);
assert.strictEqual(patternedChecked.document.repeat.rotate, 15);
const patternedSvg = V.compile(patternedChecked.document);
assert.ok(patternedSvg.indexOf("rotate(15)") >= 0);
assert.ok(patternedSvg.indexOf("scale(0.8)") >= 0);
assert.strictEqual(V.compile(V.validate(patterned).document), patternedSvg);

const character = load("character.json");
const characterChecked = V.validate(character.doc);
assert.strictEqual(characterChecked.ok, true, characterChecked.errors.join("; "));
assert.strictEqual(characterChecked.document.meta.category, "illustration");
assert.strictEqual(characterChecked.document.meta.skill, "character");
assert.strictEqual(characterChecked.document.layers[0].shapes[0].children.length, 3);
assert.ok(V.compile(characterChecked.document).indexOf("<circle") >= 0);

const icon = load("icon.json");
const iconChecked = V.validate(icon.doc);
assert.strictEqual(iconChecked.ok, true, iconChecked.errors.join("; "));
assert.strictEqual(iconChecked.document.meta.category, "logo");
assert.strictEqual(iconChecked.document.meta.skill, "icon");
assert.strictEqual(iconChecked.document.palette.ink2, "#8a3b24");
const iconSvg = V.compile(iconChecked.document);
assert.ok(iconSvg.indexOf('fill-rule="evenodd"') >= 0);
assert.ok(iconSvg.indexOf('viewBox="0 0 24 24"') >= 0);

const raster = load("reject-raster.json");
const rasterChecked = V.validate(raster.doc);
assert.strictEqual(rasterChecked.ok, false);
assert.ok(rasterChecked.errors.some((e) => /raster/i.test(e)));

const badPath = load("reject-path.json");
const pathChecked = V.validate(badPath.doc);
assert.strictEqual(pathChecked.ok, false);
assert.ok(pathChecked.errors.some((e) => /path d|raster or script/i.test(e)));

const repaired = V.validate({
  vxl: 1,
  meta: { name: "Repair", category: "icon" },
  canvas: { viewBox: [0, 0, 32, 32] },
  palette: { figure: "#111111" },
  layers: [{ id: "l", shapes: [{ type: "circle", cx: 16, cy: 16, r: 6 }] }]
});
assert.strictEqual(repaired.ok, true, repaired.errors.join("; "));
assert.ok(repaired.warnings.length >= 1);
assert.strictEqual(repaired.document.meta.skill, "icon");
assert.ok(/^#/.test(repaired.document.palette.ground));

const logoDoc = V.buildLogo("Geometric falcon for North");
const textileDoc = V.buildTextile("leaf cloth", "mirror");
assert.strictEqual(V.validate(logoDoc).ok, true);
assert.strictEqual(V.validate(textileDoc).ok, true);
assert.strictEqual(V.compile(logoDoc), V.compile(V.validate(logoDoc).document));
assert.strictEqual(V.compile(textileDoc), V.compile(V.validate(textileDoc).document));
assert.ok(stable(logoChecked.document).meta.skill);

const clipped = V.validate({
  vxl: 1,
  meta: { name: "Clip", category: "logo" },
  canvas: { viewBox: [0, 0, 200, 200] },
  palette: { ground: "#f6f1e8", figure: "#1b3358", accent: "#355e57" },
  layers: [{ id: "l", shapes: [{ id: "mark", type: "rect", x: 20, y: 20, w: 140, h: 80, role: "figure", clip: "M40 40 L160 40 L100 150 Z" }] }]
});
assert.strictEqual(clipped.ok, true, clipped.errors.join("; "));
assert.strictEqual(clipped.document.layers[0].shapes[0].clip, "M40 40 L160 40 L100 150 Z");
const clippedSvg = V.compile(clipped.document);
assert.ok(clippedSvg.indexOf("<clipPath") >= 0);
assert.ok(clippedSvg.indexOf('clip-path="url(#vc_mark)"') >= 0);
assert.strictEqual(V.compile(V.validate(clipped.document).document), clippedSvg);

console.log("vxl golden ok");
console.log(logoSvg.length, textileSvg.length, iconSvg.length);
