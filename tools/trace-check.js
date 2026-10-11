const assert = require("assert");
const path = require("path");
global.window = undefined;
require(path.join(__dirname, "../app/src/main/assets/www/js/trace.js"));
const T = global.VeloraTrace;

function raster(w, h, paint) {
  const luma = new Uint8Array(w * h);
  luma.fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (paint(x, y)) luma[y * w + x] = 20;
    }
  }
  return luma;
}

function trace(luma, w, h) {
  const out = T.fromLuma(w, h, luma, { maxEdge: w });
  assert.strictEqual(out.ok, true, out.error);
  return out.shapes[0].d;
}

function counts(d) {
  return {
    c: (d.match(/C/g) || []).length,
    l: (d.match(/L/g) || []).length
  };
}

const circle = trace(raster(160, 160, (x, y) => {
  const dx = x - 80;
  const dy = y - 80;
  return dx * dx + dy * dy <= 36 * 36;
}), 160, 160);
assert.strictEqual(counts(circle).c, 4, "circle " + circle);
assert.strictEqual(counts(circle).l, 0);

const ellipse = trace(raster(180, 120, (x, y) => {
  const nx = (x - 90) / 52;
  const ny = (y - 60) / 28;
  return nx * nx + ny * ny <= 1;
}), 180, 120);
assert.strictEqual(counts(ellipse).c, 4, "ellipse " + ellipse);

const square = trace(raster(140, 140, (x, y) => x >= 30 && x < 110 && y >= 30 && y < 110), 140, 140);
assert.ok(counts(square).l >= 4, "square " + square);
assert.ok(counts(square).c === 0, "square cubics " + square);

const tri = trace(raster(140, 140, (x, y) => {
  if (y < 28 || y > 112) return false;
  const t = (y - 28) / 84;
  const half = 8 + t * 46;
  return Math.abs(x - 70) <= half;
}), 140, 140);
assert.ok(counts(tri).l >= 3, "triangle " + tri);
assert.ok(counts(tri).c <= 1, "triangle cubics " + tri);

const lobe = trace(raster(180, 180, (x, y) => {
  const dx = x - 90;
  const dy = y - 90;
  const r = Math.hypot(dx, dy);
  if (r < 1) return true;
  const ang = Math.atan2(dy, dx);
  const limit = 38 + 12 * Math.cos(3 * ang);
  return r <= limit;
}), 180, 180);
const lobeN = counts(lobe);
assert.ok(lobeN.c >= 6 && lobeN.c <= 16, "lobe cubics " + lobeN.c + " " + lobe);
assert.strictEqual(lobeN.l, 0, "lobe lines " + lobe);

const pent = trace(raster(160, 160, (x, y) => {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
    pts.push([80 + Math.cos(a) * 50, 80 + Math.sin(a) * 50]);
  }
  let inside = false;
  for (let i = 0, j = 4; i < 5; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}), 160, 160);
const pentN = counts(pent);
assert.strictEqual(pentN.c, 0, "pent cubics " + pent);
assert.ok(pentN.l >= 5, "pent lines " + pent);

function gentleOrganic(tag, w, h, paint, minC, maxL) {
  const d = trace(raster(w, h, paint), w, h);
  const n = counts(d);
  assert.ok(n.c >= minC, tag + " cubics " + n.c + " " + d);
  assert.ok(n.l <= maxL, tag + " lines " + n.l + " " + d);
}
gentleOrganic("wave body", 280, 140, (x, y) => {
  const t = (x - 20) / 240;
  if (t < 0 || t > 1) return false;
  const cy = 70 + 18 * Math.sin(t * Math.PI * 1.4);
  const half = 16 + 8 * Math.sin(t * Math.PI);
  return Math.abs(y - cy) <= half;
}, 4, 2);
gentleOrganic("long wave", 360, 160, (x, y) => {
  const t = (x - 20) / 320;
  if (t < 0 || t > 1) return false;
  const cy = 80 + 22 * Math.sin(t * Math.PI * 1.2);
  const half = 18 + 6 * Math.sin(t * Math.PI);
  return Math.abs(y - cy) <= half;
}, 4, 4);
console.log("trace-check ok", {
  circle: counts(circle),
  ellipse: counts(ellipse),
  square: counts(square),
  tri: counts(tri),
  lobe: lobeN,
  pent: pentN
});
