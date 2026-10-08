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
assert.ok(lobeN.l <= 2, "lobe lines " + lobe);

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


function roundRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx;
  const dy = y - cy;
  if (x >= x0 + r && x <= x1 - r) return y >= y0 && y <= y1;
  if (y >= y0 + r && y <= y1 - r) return x >= x0 && x <= x1;
  return dx * dx + dy * dy <= r * r;
}

function axisSides(d) {
  const parts = d.split(/(?=[MLC])/);
  let x = 0;
  let y = 0;
  let axis = 0;
  let lines = 0;
  for (const part of parts) {
    const kind = part[0];
    const n = part.slice(1).trim().split(/\s+/).map(Number);
    if (kind === "M") {
      x = n[0];
      y = n[1];
    } else if (kind === "L") {
      lines++;
      if (Math.abs(n[0] - x) < 9 || Math.abs(n[1] - y) < 9) axis++;
      x = n[0];
      y = n[1];
    } else if (kind === "C") {
      x = n[4];
      y = n[5];
    }
  }
  return { lines, axis };
}

for (const r of [8, 14, 22]) {
  const rr = trace(raster(200, 140, (x, y) => roundRect(x, y, 28, 24, 172, 116, r)), 200, 140);
  const n = counts(rr);
  const sides = axisSides(rr);
  assert.strictEqual(n.c, 4, "round-rect cubics r" + r + " " + rr);
  assert.strictEqual(n.l, 4, "round-rect lines r" + r + " " + rr);
  assert.strictEqual(sides.axis, 4, "round-rect axis r" + r + " " + rr);
}


function pill(x, y, x0, x1, cy, r) {
  const cx = Math.max(x0, Math.min(x, x1));
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}

function vp(x, y, y0, y1, cx, r) {
  const cy = Math.max(y0, Math.min(y, y1));
  return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
}

for (const r of [14, 22, 28]) {
  const pillD = trace(raster(220, 120, (x, y) => pill(x, y, 50, 170, 60, r)), 220, 120);
  const pillN = counts(pillD);
  const pillSides = axisSides(pillD);
  assert.strictEqual(pillN.c, 4, "stadium cubics r" + r + " " + pillD);
  assert.strictEqual(pillN.l, 2, "stadium lines r" + r + " " + pillD);
  assert.strictEqual(pillSides.axis, 2, "stadium axis r" + r + " " + pillD);
}

const vPill = trace(raster(120, 220, (x, y) => vp(x, y, 50, 170, 60, 22)), 120, 220);
const vN = counts(vPill);
const vSides = axisSides(vPill);
assert.strictEqual(vN.c, 4, "v-stadium cubics " + vPill);
assert.strictEqual(vN.l, 2, "v-stadium lines " + vPill);
assert.strictEqual(vSides.axis, 2, "v-stadium axis " + vPill);

console.log("trace-check ok", { circle: counts(circle), ellipse: counts(ellipse), square: counts(square), tri: counts(tri), lobe: lobeN, pent: pentN });
