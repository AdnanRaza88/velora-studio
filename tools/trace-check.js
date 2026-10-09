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

function trap(pts) {
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}
[[[40, 40], [120, 40], [140, 120], [20, 120]], [[30, 50], [150, 50], [130, 130], [50, 130]], [[50, 35], [140, 35], [160, 125], [30, 125]], [[55, 30], [125, 30], [155, 140], [25, 140]]].forEach((pts, i) => {
  const d = trace(raster(200, 180, trap(pts)), 200, 180);
  const n = counts(d);
  assert.strictEqual(n.c, 0, "trap cubics t" + i + " " + d);
  assert.strictEqual(n.l, 4, "trap lines t" + i + " " + d);
});

function semiDisk(x, y, cx, cy, r, axis) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy > r * r) return false;
  return axis === "v" ? dx >= 0 : dy >= 0;
}
[28, 40, 52].forEach((r) => {
  const semiD = trace(raster(180, 150, (x, y) => semiDisk(x, y, 90, 48, r, "h")), 180, 150);
  const semiN = counts(semiD);
  assert.strictEqual(semiN.c, 2, "semi cubics r" + r + " " + semiD);
  assert.strictEqual(semiN.l, 1, "semi lines r" + r + " " + semiD);
});
[24, 36].forEach((r) => {
  const vSemi = trace(raster(150, 180, (x, y) => semiDisk(x, y, 40, 90, r, "v")), 150, 180);
  const vN = counts(vSemi);
  assert.strictEqual(vN.c, 2, "v-semi cubics r" + r + " " + vSemi);
  assert.strictEqual(vN.l, 1, "v-semi lines r" + r + " " + vSemi);
});

function dCap(x, y, ox, oy, body, r, cap) {
  if (cap === "right" || cap === "left") {
    const wall = cap === "right" ? ox : ox + r;
    const end = cap === "right" ? ox + body : ox + r + body;
    const top = oy;
    const inBody = x >= Math.min(wall, end) && x <= Math.max(wall, end) && y >= top && y < top + 2 * r;
    const ccx = cap === "right" ? ox + body : ox + r;
    const dx = x - ccx;
    const dy = y - (oy + r);
    const toward = cap === "right" ? dx >= -0.5 : dx <= 0.5;
    return inBody || (toward && dx * dx + dy * dy <= r * r);
  }
  const wall = cap === "bottom" ? oy : oy + r;
  const end = cap === "bottom" ? oy + body : oy + r + body;
  const inBody = y >= Math.min(wall, end) && y <= Math.max(wall, end) && x >= ox && x < ox + 2 * r;
  const ccy = cap === "bottom" ? oy + body : oy + r;
  const dx = x - (ox + r);
  const dy = y - ccy;
  const toward = cap === "bottom" ? dy >= -0.5 : dy <= 0.5;
  return inBody || (toward && dx * dx + dy * dy <= r * r);
}
[36, 48].forEach((body) => {
  const d = trace(raster(200, 140, (x, y) => dCap(x, y, 28, 36, body, 28, "right")), 200, 140);
  const n = counts(d);
  assert.strictEqual(n.c, 2, "dcap cubics b" + body + " " + d);
  assert.strictEqual(n.l, 3, "dcap lines b" + body + " " + d);
});
[32, 44].forEach((body) => {
  const d = trace(raster(140, 200, (x, y) => dCap(x, y, 40, 24, body, 26, "bottom")), 140, 200);
  const n = counts(d);
  assert.strictEqual(n.c, 2, "v-dcap cubics b" + body + " " + d);
  assert.strictEqual(n.l, 3, "v-dcap lines b" + body + " " + d);
});

function house(x, y) {
  return (y >= 70 && y < 140 && x >= 30 && x < 130) || (y >= 30 && y < 70 && Math.abs(x - 80) <= (y - 30) * 1.25);
}
const houseD = trace(raster(160, 160, house), 160, 160);
const houseN = counts(houseD);
assert.strictEqual(houseN.c, 0, "house cubics " + houseD);
assert.strictEqual(houseN.l, 5, "house lines " + houseD);

function shield(x, y) {
  if (x < 30 || x > 130 || y < 28 || y > 142) return false;
  if (y <= 88) return true;
  return Math.abs(x - 80) <= 50 * (1 - (y - 88) / 54);
}
const shieldD = trace(raster(160, 170, shield), 160, 170);
const shieldN = counts(shieldD);
assert.strictEqual(shieldN.c, 0, "shield cubics " + shieldD);
assert.strictEqual(shieldN.l, 5, "shield lines " + shieldD);
function shieldWide(x, y) {
  if (x < 18 || x > 150 || y < 24 || y > 150) return false;
  if (y <= 96) return true;
  return Math.abs(x - 84) <= 66 * (1 - (y - 96) / 54);
}
const shieldWideD = trace(raster(180, 180, shieldWide), 180, 180);
const shieldWideN = counts(shieldWideD);
assert.strictEqual(shieldWideN.c, 0, "wide shield cubics " + shieldWideD);
assert.strictEqual(shieldWideN.l, 5, "wide shield lines " + shieldWideD);

function diamond(x, y, cx, cy, r) {
  return Math.abs(x - cx) + Math.abs(y - cy) <= r;
}
[32, 46, 58].forEach((r) => {
  const d = trace(raster(180, 180, (x, y) => diamond(x, y, 90, 90, r)), 180, 180);
  const n = counts(d);
  assert.strictEqual(n.c, 0, "diamond cubics r" + r + " " + d);
  assert.strictEqual(n.l, 4, "diamond lines r" + r + " " + d);
});
const stairDiamond = trace(raster(180, 180, (x, y) => {
  const d = Math.abs(x - 90) + Math.abs(y - 90);
  return d <= 46 || (d <= 49 && ((x * 3 + y) % 5) < 3);
}), 180, 180);
const stairN = counts(stairDiamond);
assert.strictEqual(stairN.c, 0, "stair diamond cubics " + stairDiamond);
assert.strictEqual(stairN.l, 4, "stair diamond lines " + stairDiamond);

function insidePoly(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
[0].forEach((shift) => {
  const chev = trace(raster(180, 140, (x, y) => insidePoly([[30, 28], [112, 28], [150, 70], [112, 112], [30, 112], [68, 70]], x, y)), 180, 140);
  const chevN = counts(chev);
  assert.strictEqual(chevN.c, 0, "chevron cubics " + chev);
  assert.strictEqual(chevN.l, 6, "chevron lines " + chev);
});
const chevShift = trace(raster(180, 140, (x, y) => insidePoly([[31, 28], [112, 28], [150, 70], [112, 112], [30, 112], [68, 70]], x, y)), 180, 140);
const chevShiftN = counts(chevShift);
assert.strictEqual(chevShiftN.c, 0, "chevron shift cubics " + chevShift);
assert.ok(chevShiftN.l >= 6 && chevShiftN.l <= 7, "chevron shift lines " + chevShiftN.l + " " + chevShift);

const segmentD = trace(raster(180, 140, (x, y) => {
  const dx = x - 90;
  const dy = y - 90;
  return dx * dx + dy * dy <= 70 * 70 && y < 70;
}), 180, 140);
const segmentN = counts(segmentD);
assert.strictEqual(segmentN.l, 1, "segment lines " + segmentD);
assert.ok(segmentN.c >= 1 && segmentN.c <= 2, "segment cubics " + segmentN.c + " " + segmentD);
const segmentDeep = trace(raster(180, 160, (x, y) => {
  const dx = x - 90;
  const dy = y - 100;
  return dx * dx + dy * dy <= 64 * 64 && y < 78;
}), 180, 160);
const deepN = counts(segmentDeep);
assert.strictEqual(deepN.l, 1, "deep segment lines " + segmentDeep);
assert.ok(deepN.c >= 1 && deepN.c <= 2, "deep segment cubics " + deepN.c + " " + segmentDeep);
function pie(x, y, cx, cy, r, a0, a1) {
  const dx = x - cx;
  const dy = y - cy;
  const ang = Math.atan2(dy, dx);
  return dx * dx + dy * dy <= r * r && ang >= a0 && ang <= a1;
}
const wedge = trace(raster(180, 180, (x, y) => pie(x, y, 40, 90, 80, -0.5, 0.55)), 180, 180);
const wedgeN = counts(wedge);
assert.strictEqual(wedgeN.l, 2, "wedge lines " + wedge);
assert.strictEqual(wedgeN.c, 1, "wedge cubics " + wedge);
const rightPie = trace(raster(160, 160, (x, y) => {
  const dx = x - 40;
  const dy = y - 80;
  return dx * dx + dy * dy <= 70 * 70 && dx >= 0 && dy <= 0;
}), 160, 160);
const rightN = counts(rightPie);
assert.strictEqual(rightN.l, 2, "right pie lines " + rightPie);
assert.strictEqual(rightN.c, 1, "right pie cubics " + rightPie);

function crescent(x, y, cx, cy, r, ox, oy, r2) {
  const dx = x - cx;
  const dy = y - cy;
  const dx2 = x - ox;
  const dy2 = y - oy;
  return dx * dx + dy * dy <= r * r && dx2 * dx2 + dy2 * dy2 > r2 * r2;
}
const moon = trace(raster(160, 160, (x, y) => crescent(x, y, 80, 80, 48, 98, 74, 36)), 160, 160);
const moonN = counts(moon);
assert.strictEqual(moonN.l, 0, "crescent lines " + moon);
assert.ok(moonN.c >= 2 && moonN.c <= 4, "crescent cubics " + moonN.c + " " + moon);
const moonV = trace(raster(160, 170, (x, y) => crescent(x, y, 80, 88, 50, 80, 108, 34)), 160, 170);
const moonVN = counts(moonV);
assert.strictEqual(moonVN.l, 0, "vertical crescent lines " + moonV);
assert.ok(moonVN.c >= 2 && moonVN.c <= 4, "vertical crescent cubics " + moonVN.c + " " + moonV);

function heart(x, y, cx, cy, s) {
  const nx = (x - cx) / s;
  const ny = (y - cy) / s;
  return Math.pow(nx * nx + ny * ny - 1, 3) - nx * nx * ny * ny * ny < 0;
}
const heartPath = trace(raster(140, 140, (x, y) => heart(x, y, 70, 62, 36)), 140, 140);
const heartN = counts(heartPath);
assert.strictEqual(heartN.l, 0, "heart lines " + heartPath);
assert.ok(heartN.c >= 2 && heartN.c <= 6, "heart cubics " + heartN.c + " " + heartPath);
const heartUp = trace(raster(130, 150, (x, y) => heart(x, 148 - y, 64, 78, 32)), 130, 150);
const heartUpN = counts(heartUp);
assert.strictEqual(heartUpN.l, 0, "tip-up heart lines " + heartUp);
assert.ok(heartUpN.c >= 2 && heartUpN.c <= 6, "tip-up heart cubics " + heartUpN.c + " " + heartUp);

function bubble(x, y, cx, cy, rx, ry, tipY) {
  const dx = x - cx;
  const dy = y - cy;
  if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) return true;
  return y >= cy + ry * 0.55 && y <= tipY && Math.abs(x - cx) <= (tipY - y) * 0.42 + 1;
}
const bubblePath = trace(raster(140, 140, (x, y) => bubble(x, y, 70, 58, 40, 28, 112)), 140, 140);
const bubbleN = counts(bubblePath);
assert.strictEqual(bubbleN.l, 2, "bubble lines " + bubblePath);
assert.ok(bubbleN.c >= 2 && bubbleN.c <= 4, "bubble cubics " + bubbleN.c + " " + bubblePath);
const nums = bubblePath.match(/-?\d+(?:\.\d+)?/g).map(Number);
let minY = nums[1];
for (let i = 1; i < nums.length; i += 2) if (nums[i] < minY) minY = nums[i];
assert.ok(minY < 360, "bubble body " + minY + " " + bubblePath);
function bubbleSide(x, y, cx, cy, rx, ry, tipX) {
  const dx = x - cx;
  const dy = y - cy;
  if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) return true;
  return x >= cx + rx * 0.55 && x <= tipX && Math.abs(y - cy) <= (tipX - x) * 0.42 + 1;
}
const bubbleRight = trace(raster(160, 130, (x, y) => bubbleSide(x, y, 62, 64, 28, 36, 138)), 160, 130);
const bubbleRightN = counts(bubbleRight);
assert.strictEqual(bubbleRightN.l, 2, "bubble right lines " + bubbleRight);
assert.ok(bubbleRightN.c >= 2 && bubbleRightN.c <= 4, "bubble right cubics " + bubbleRightN.c + " " + bubbleRight);
const bubbleUp = trace(raster(140, 150, (x, y) => bubble(x, 149 - y, 70, 58, 40, 28, 112)), 140, 150);
const bubbleUpN = counts(bubbleUp);
assert.strictEqual(bubbleUpN.l, 2, "bubble up lines " + bubbleUp);
assert.ok(bubbleUpN.c >= 2 && bubbleUpN.c <= 4, "bubble up cubics " + bubbleUpN.c + " " + bubbleUp);

function arrowNotch(x, y) {
  const pts = [[16, 20], [120, 20], [120, 40], [148, 50], [120, 60], [120, 80], [16, 80], [40, 50]];
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const arrowD = trace(raster(160, 100, arrowNotch), 160, 100);
const arrowN = counts(arrowD);
assert.strictEqual(arrowN.c, 0, "arrow cubics " + arrowD);
assert.strictEqual(arrowN.l, 8, "arrow lines " + arrowD);
const arrowXs = arrowD.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
const tipCount = arrowXs.filter((x) => x > 900).length;
assert.strictEqual(tipCount, 1, "arrow tip " + arrowD);

function roundedTri(x, y, r) {
  const pts = [[70, 24], [116, 112], [24, 112]];
  if (!insidePoly(pts, x, y)) return false;
  function edge(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = ((x - ax) * dx + (y - ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  }
  const d = Math.min(edge(70, 24, 116, 112), edge(116, 112, 24, 112), edge(24, 112, 70, 24));
  return d >= r;
}
const roundTri = trace(raster(140, 140, (x, y) => roundedTri(x, y, 10)), 140, 140);
const roundTriN = counts(roundTri);
assert.ok(roundTriN.c >= 1 && roundTriN.c <= 3, "rounded tri cubics " + roundTriN.c + " " + roundTri);
assert.ok(roundTriN.l >= 3 && roundTriN.l <= 5, "rounded tri lines " + roundTri);

function mapPin(x, y, cx, cy, r, tipx, tipy) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy <= r * r) return true;
  return insidePoly([[cx - 8, cy - 6], [tipx, tipy], [cx + 8, cy + 6]], x, y);
}
const pinDown = trace(raster(140, 170, (x, y) => mapPin(x, y, 70, 58, 28, 70, 142)), 140, 170);
const pinDownN = counts(pinDown);
assert.strictEqual(pinDownN.l, 2, "pin down lines " + pinDown);
assert.strictEqual(pinDownN.c, 4, "pin down cubics " + pinDown);
const pinUp = trace(raster(140, 170, (x, y) => mapPin(x, y, 70, 112, 28, 70, 24)), 140, 170);
const pinUpN = counts(pinUp);
assert.strictEqual(pinUpN.l, 2, "pin up lines " + pinUp);
assert.strictEqual(pinUpN.c, 4, "pin up cubics " + pinUp);
const pinLeft = trace(raster(170, 140, (x, y) => mapPin(x, y, 100, 70, 28, 22, 70)), 170, 140);
const pinLeftN = counts(pinLeft);
assert.strictEqual(pinLeftN.l, 2, "pin left lines " + pinLeft);
assert.strictEqual(pinLeftN.c, 4, "pin left cubics " + pinLeft);


function arch(x, y, cx, cy, r, body, cap) {
  if (cap === "top") {
    if (x >= cx - r && x <= cx + r && y >= cy && y <= cy + body) return true;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r && y <= cy;
  }
  if (y >= cy - r && y <= cy + r && x >= cx - body && x <= cx) return true;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r && x >= cx;
}
const archTop = trace(raster(160, 180, (x, y) => arch(x, y, 80, 70, 40, 80, "top")), 160, 180);
const archTopN = counts(archTop);
assert.strictEqual(archTopN.c, 2, "arch top cubics " + archTop);
assert.strictEqual(archTopN.l, 3, "arch top lines " + archTop);
const archRight = trace(raster(180, 160, (x, y) => arch(x, y, 70, 80, 36, 70, "right")), 180, 160);
const archRightN = counts(archRight);
assert.strictEqual(archRightN.c, 2, "arch right cubics " + archRight);
assert.strictEqual(archRightN.l, 3, "arch right lines " + archRight);
const archTall = trace(raster(140, 200, (x, y) => arch(x, y, 70, 50, 32, 120, "top")), 140, 200);
const archTallN = counts(archTall);
assert.strictEqual(archTallN.c, 2, "arch tall cubics " + archTall);
assert.strictEqual(archTallN.l, 3, "arch tall lines " + archTall);

function capQuarterError(d) {
  const parts = d.split("C");
  let worst = 0;
  for (let i = 1; i < parts.length; i++) {
    const nums = parts[i].match(/-?\d+(?:\.\d+)?/g).map(Number);
    const prev = parts[i - 1].match(/-?\d+(?:\.\d+)?/g).map(Number);
    const a = [prev[prev.length - 2], prev[prev.length - 1]];
    const c1 = [nums[0], nums[1]];
    const c2 = [nums[2], nums[3]];
    const b = [nums[4], nums[5]];
    if (Math.min(Math.abs(c1[0] - a[0]), Math.abs(c1[1] - a[1])) > 1.4) return 99;
    if (Math.min(Math.abs(c2[0] - b[0]), Math.abs(c2[1] - b[1])) > 1.4) return 99;
    const centers = [[a[0], b[1]], [b[0], a[1]]];
    let best = 1e9;
    centers.forEach((c) => {
      const r0 = Math.hypot(a[0] - c[0], a[1] - c[1]);
      const r1 = Math.hypot(b[0] - c[0], b[1] - c[1]);
      if (Math.abs(r0 - r1) > 1.6) return;
      const u = 0.5;
      const mid = [
        0.125 * a[0] + 0.375 * c1[0] + 0.375 * c2[0] + 0.125 * b[0],
        0.125 * a[1] + 0.375 * c1[1] + 0.375 * c2[1] + 0.125 * b[1]
      ];
      best = Math.min(best, Math.abs(Math.hypot(mid[0] - c[0], mid[1] - c[1]) - r0));
    });
    if (best > worst) worst = best;
  }
  return worst;
}
assert.ok(capQuarterError(archTop) < 1.2, "arch top cap " + capQuarterError(archTop) + " " + archTop);
assert.ok(capQuarterError(archRight) < 1.2, "arch right cap " + capQuarterError(archRight) + " " + archRight);
assert.ok(capQuarterError(archTall) < 1.2, "arch tall cap " + capQuarterError(archTall) + " " + archTall);

console.log("trace-check ok", { circle: counts(circle), ellipse: counts(ellipse), square: counts(square), tri: counts(tri), lobe: lobeN, pent: pentN });

function keyhole(x, y, cx, cy, r, half, dir) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy <= r * r) return true;
  if (dir === "down") return Math.abs(x - cx) <= half && y >= cy && y <= cy + r * 2.4;
  if (dir === "up") return Math.abs(x - cx) <= half && y <= cy && y >= cy - r * 2.4;
  if (dir === "right") return Math.abs(y - cy) <= half && x >= cx && x <= cx + r * 2.4;
  return Math.abs(y - cy) <= half && x <= cx && x >= cx - r * 2.4;
}

function axisLines(d) {
  const nums = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pts = [];
  for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  let axis = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = Math.abs(pts[i][0] - pts[i - 1][0]);
    const dy = Math.abs(pts[i][1] - pts[i - 1][1]);
    if (dx < 1.6 || dy < 1.6) axis++;
  }
  return axis;
}
const keyDown = trace(raster(140, 180, (x, y) => keyhole(x, y, 70, 52, 30, 16, "down")), 140, 180);
const keyDownN = counts(keyDown);
assert.strictEqual(keyDownN.l, 3, "key down lines " + keyDown);
assert.ok(keyDownN.c >= 3 && keyDownN.c <= 4, "key down cubics " + keyDown);
assert.ok(axisLines(keyDown) >= 3, "key down axis " + keyDown);
const keyUp = trace(raster(140, 180, (x, y) => keyhole(x, y, 70, 128, 30, 16, "up")), 140, 180);
const keyUpN = counts(keyUp);
assert.strictEqual(keyUpN.l, 3, "key up lines " + keyUp);
assert.ok(keyUpN.c >= 3 && keyUpN.c <= 4, "key up cubics " + keyUp);
const keyRight = trace(raster(180, 140, (x, y) => keyhole(x, y, 52, 70, 30, 16, "right")), 180, 140);
const keyRightN = counts(keyRight);
assert.strictEqual(keyRightN.l, 3, "key right lines " + keyRight);
assert.ok(keyRightN.c >= 3 && keyRightN.c <= 4, "key right cubics " + keyRight);
const keyLeft = trace(raster(180, 140, (x, y) => keyhole(x, y, 128, 70, 30, 16, "left")), 180, 140);
const keyLeftN = counts(keyLeft);
assert.strictEqual(keyLeftN.l, 3, "key left lines " + keyLeft);
assert.ok(keyLeftN.c >= 3 && keyLeftN.c <= 4, "key left cubics " + keyLeft);

function pacman(x, y, cx, cy, r, mouth) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy > r * r) return false;
  const a = Math.atan2(dy, dx);
  return a < -mouth || a > mouth;
}
const pac = trace(raster(140, 140, (x, y) => pacman(x, y, 70, 70, 48, 0.55)), 140, 140);
const pacN = counts(pac);
assert.ok(pacN.l >= 2 && pacN.l <= 3, "pac lines " + pac);
assert.ok(pacN.c >= 3 && pacN.c <= 4, "pac cubics " + pacN.c + " " + pac);
const pacXs = pac.match(/-?\d+(?:\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
assert.ok(Math.min.apply(null, pacXs) < 280, "pac body " + pac);

function horseshoe(x, y, cx, cy, Ro, Ri, leg, cap) {
  const dx = x - cx;
  const dy = y - cy;
  if (cap === "bottom" || cap === "top") {
    const along = cap === "bottom" ? -dy : dy;
    const inOuter = dx * dx + dy * dy <= Ro * Ro;
    const inInner = dx * dx + dy * dy < Ri * Ri;
    if (along > 0) return Math.abs(dx) >= Ri && Math.abs(dx) <= Ro && along <= leg;
    return inOuter && !inInner;
  }
  const along = cap === "right" ? -dx : dx;
  const inOuter = dx * dx + dy * dy <= Ro * Ro;
  const inInner = dx * dx + dy * dy < Ri * Ri;
  if (along > 0) return Math.abs(dy) >= Ri && Math.abs(dy) <= Ro && along <= leg;
  return inOuter && !inInner;
}
function shoeCounts(tag, w, h, paint) {
  const d = trace(raster(w, h, paint), w, h);
  const n = counts(d);
  assert.strictEqual(n.l, 6, tag + " lines " + d);
  assert.strictEqual(n.c, 4, tag + " cubics " + d);
}
shoeCounts("shoe bottom", 140, 180, (x, y) => horseshoe(x, y, 70, 96, 42, 24, 52, "bottom"));
shoeCounts("shoe top", 140, 180, (x, y) => horseshoe(x, y, 70, 84, 42, 24, 52, "top"));
shoeCounts("shoe right", 180, 140, (x, y) => horseshoe(x, y, 96, 70, 40, 22, 50, "right"));
shoeCounts("shoe left", 180, 140, (x, y) => horseshoe(x, y, 84, 70, 40, 22, 50, "left"));

function reuleaux(x, y, ax, ay, bx, by, cx, cy) {
  const r2ab = (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  const r2bc = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
  const r2ca = (cx - ax) * (cx - ax) + (cy - ay) * (cy - ay);
  const dab = (x - ax) * (x - ax) + (y - ay) * (y - ay) <= r2ab;
  const dbc = (x - bx) * (x - bx) + (y - by) * (y - by) <= r2bc;
  const dca = (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2ca;
  return dab && dbc && dca;
}
function reuCounts(tag, w, h, paint) {
  const d = trace(raster(w, h, paint), w, h);
  const n = counts(d);
  assert.strictEqual(n.l, 0, tag + " lines " + d);
  assert.strictEqual(n.c, 3, tag + " cubics " + d);
}
reuCounts("reuleaux up", 160, 160, (x, y) => reuleaux(x, y, 80, 28, 34, 112, 126, 112));
reuCounts("reuleaux down", 160, 160, (x, y) => reuleaux(x, y, 80, 132, 34, 48, 126, 48));
reuCounts("reuleaux right", 160, 160, (x, y) => reuleaux(x, y, 132, 80, 48, 34, 48, 126));
