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


function boxCorner(x, y, x0, y0, x1, y1, corners) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  for (const c of corners) {
    const cx = c.right ? x1 - c.r : x0 + c.r;
    const cy = c.bottom ? y1 - c.r : y0 + c.r;
    const inX = c.right ? x > x1 - c.r : x < x0 + c.r;
    const inY = c.bottom ? y > y1 - c.r : y < y0 + c.r;
    if (inX && inY) {
      const dx = x - cx;
      const dy = y - cy;
      return dx * dx + dy * dy <= c.r * c.r;
    }
  }
  return true;
}

for (const r of [10, 16, 22]) {
  const one = trace(raster(180, 150, (x, y) => boxCorner(x, y, 28, 24, 152, 126, [{ r: r, right: true, bottom: true }])), 180, 150);
  const oneN = counts(one);
  const oneSides = axisSides(one);
  assert.strictEqual(oneN.c, 1, "one-fillet cubics r" + r + " " + one);
  assert.strictEqual(oneN.l, 4, "one-fillet lines r" + r + " " + one);
  assert.strictEqual(oneSides.axis, 4, "one-fillet axis r" + r + " " + one);
}

const two = trace(raster(200, 150, (x, y) => boxCorner(x, y, 24, 22, 176, 128, [
  { r: 18, right: true, bottom: false },
  { r: 18, right: false, bottom: true }
])), 200, 150);
const twoN = counts(two);
assert.strictEqual(twoN.c, 2, "two-fillet cubics " + two);
assert.strictEqual(twoN.l, 4, "two-fillet lines " + two);
assert.strictEqual(axisSides(two).axis, 4, "two-fillet axis " + two);

function chamferBox(x, y, x0, y0, x1, y1, cut) {
  if (x < x0 || y < y0 || x > x1 || y > y1) return false;
  if (x < x0 + cut && y < y0 + cut && (x0 + cut - x) + (y0 + cut - y) > cut) return false;
  if (x > x1 - cut && y < y0 + cut && (x - (x1 - cut)) + (y0 + cut - y) > cut) return false;
  if (x < x0 + cut && y > y1 - cut && (x0 + cut - x) + (y - (y1 - cut)) > cut) return false;
  if (x > x1 - cut && y > y1 - cut && (x - (x1 - cut)) + (y - (y1 - cut)) > cut) return false;
  return true;
}
[12, 18].forEach((cut) => {
  const box = trace(raster(180, 160, (x, y) => chamferBox(x, y, 28, 24, 152, 136, cut)), 180, 160);
  const boxN = counts(box);
  assert.strictEqual(boxN.c, 0, "chamfer-box cubics c" + cut + " " + box);
  assert.strictEqual(boxN.l, 8, "chamfer-box lines c" + cut + " " + box);
});

function chamfer(x, y, x0, y0, x1, y1, cut) {
  if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
  if (x > x1 - cut && y < y0 + cut && (x - (x1 - cut)) + (y0 + cut - y) > cut) return false;
  return true;
}

for (const cut of [12, 18, 24]) {
  const ch = trace(raster(180, 150, (x, y) => chamfer(x, y, 24, 22, 156, 128, cut)), 180, 150);
  const chN = counts(ch);
  assert.strictEqual(chN.c, 0, "chamfer cubics c" + cut + " " + ch);
  assert.strictEqual(chN.l, 5, "chamfer lines c" + cut + " " + ch);
}

function star(x, y) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? 62 : 26;
    pts.push([90 + Math.cos(a) * r, 90 + Math.sin(a) * r]);
  }
  let inside = false;
  for (let i = 0, j = 9; i < 10; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const starD = trace(raster(180, 180, star), 180, 180);
const starN = counts(starD);
assert.strictEqual(starN.c, 0, "star cubics " + starD);
assert.ok(starN.l >= 10 && starN.l <= 14, "star lines " + starN.l + " " + starD);


function pentagon(cx, cy, r, rot) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + i * 2 * Math.PI / 5;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = 4; i < 5; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
[[15, -Math.PI / 2], [22, 0.3], [28, -Math.PI / 2], [33, 0.3], [41, 0.3], [18, Math.PI / 5], [36, Math.PI / 10], [16, -Math.PI / 2], [24, Math.PI / 5]].forEach((spec) => {
  const r = spec[0];
  const rot = spec[1];
  const tag = "p" + r;
  const pent = trace(raster(200, 200, pentagon(100, 100, r, rot)), 200, 200);
  const pentN = counts(pent);
  assert.strictEqual(pentN.c, 0, "pentagon cubics " + tag + " " + pent);
  assert.strictEqual(pentN.l, 5, "pentagon lines " + tag + " " + pent);
});

function octagon(cx, cy, r, rot) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = rot + i * Math.PI / 4;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = 7; i < 8; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
function hexagon(cx, cy, r, rot) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = rot + i * Math.PI / 3;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = 5; i < 6; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
[[12, -Math.PI / 2], [16, -Math.PI / 2], [18, -Math.PI / 2], [20, -Math.PI / 2], [28, -Math.PI / 2], [40, -Math.PI / 2], [18, Math.PI / 6], [30, Math.PI / 6]].forEach((spec) => {
  const r = spec[0];
  const rot = spec[1];
  const tag = (rot < 0 ? "v" : "f") + r;
  const hex = trace(raster(200, 200, hexagon(100, 100, r, rot)), 200, 200);
  const hexN = counts(hex);
  assert.strictEqual(hexN.c, 0, "hexagon cubics " + tag + " " + hex);
  assert.strictEqual(hexN.l, 6, "hexagon lines " + tag + " " + hex);
});

[[18, -Math.PI / 2], [28, -Math.PI / 2], [30, -Math.PI / 2], [12, -Math.PI / 2], [20, Math.PI / 8], [16, Math.PI / 8]].forEach((spec) => {
  const r = spec[0];
  const rot = spec[1];
  const tag = (rot < 0 ? "v" : "f") + r;
  const oct = trace(raster(200, 200, octagon(100, 100, r, rot)), 200, 200);
  const octN = counts(oct);
  assert.strictEqual(octN.c, 0, "octagon cubics " + tag + " " + oct);
  assert.strictEqual(octN.l, 8, "octagon lines " + tag + " " + oct);
});

console.log("trace-check ok", { circle: counts(circle), ellipse: counts(ellipse), square: counts(square), tri: counts(tri), lobe: lobeN, pent: pentN });
