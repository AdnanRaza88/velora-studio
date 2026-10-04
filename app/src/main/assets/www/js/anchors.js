(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function tokens(d) {
    return String(d || "").match(/[MmLlHhVvCcQqZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
  }

  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  function cubicAt(p0, p1, p2, p3, t) {
    var a = lerp(p0, p1, t);
    var b = lerp(p1, p2, t);
    var c = lerp(p2, p3, t);
    var d = lerp(a, b, t);
    var e = lerp(b, c, t);
    return lerp(d, e, t);
  }

  function splitCubic(p0, p1, p2, p3, t) {
    var a = lerp(p0, p1, t);
    var b = lerp(p1, p2, t);
    var c = lerp(p2, p3, t);
    var d = lerp(a, b, t);
    var e = lerp(b, c, t);
    var f = lerp(d, e, t);
    return { left: [p0, a, d, f], right: [f, e, c, p3] };
  }

  function quadToCubic(p0, p1, p2) {
    return [
      p0,
      [p0[0] + (2 / 3) * (p1[0] - p0[0]), p0[1] + (2 / 3) * (p1[1] - p0[1])],
      [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])],
      p2
    ];
  }

  function subpaths(d) {
    var parts = tokens(d);
    var i = 0;
    var cmd = "";
    var x = 0;
    var y = 0;
    var sx = 0;
    var sy = 0;
    var subs = [];
    var cur = null;
    function take() { return parseFloat(parts[i++]); }
    function isCmd(t) { return /[A-Za-z]/.test(t); }
    function start(px, py) {
      cur = { closed: false, segs: [] };
      subs.push(cur);
      x = px;
      y = py;
      sx = px;
      sy = py;
    }
    function line(px, py) {
      if (!cur) start(x, y);
      cur.segs.push({ op: "L", a: [x, y], b: [px, py] });
      x = px;
      y = py;
    }
    function cubic(c1, c2, p) {
      if (!cur) start(x, y);
      cur.segs.push({ op: "C", a: [x, y], c1: c1, c2: c2, b: p });
      x = p[0];
      y = p[1];
    }
    while (i < parts.length) {
      if (isCmd(parts[i])) cmd = parts[i++];
      var rel = cmd === cmd.toLowerCase();
      var op = cmd.toUpperCase();
      if (op === "Z") {
        if (cur && (Math.abs(x - sx) > 0.05 || Math.abs(y - sy) > 0.05)) line(sx, sy);
        if (cur) cur.closed = true;
        x = sx;
        y = sy;
        cur = null;
        continue;
      }
      if (op === "M") {
        var mx = take();
        var my = take();
        if (rel) { mx += x; my += y; }
        start(mx, my);
        op = "L";
        while (i < parts.length && !isCmd(parts[i])) {
          var lx = take();
          var ly = take();
          if (rel) { lx += x; ly += y; }
          line(lx, ly);
        }
        continue;
      }
      if (op === "L") {
        var px = take();
        var py = take();
        if (rel) { px += x; py += y; }
        line(px, py);
        continue;
      }
      if (op === "H") {
        var hx = take();
        if (rel) hx += x;
        line(hx, y);
        continue;
      }
      if (op === "V") {
        var hy = take();
        if (rel) hy += y;
        line(x, hy);
        continue;
      }
      if (op === "C") {
        var c1x = take();
        var c1y = take();
        var c2x = take();
        var c2y = take();
        var cx = take();
        var cy = take();
        if (rel) {
          c1x += x; c1y += y; c2x += x; c2y += y; cx += x; cy += y;
        }
        cubic([c1x, c1y], [c2x, c2y], [cx, cy]);
        continue;
      }
      if (op === "Q") {
        var qx = take();
        var qy = take();
        var ex = take();
        var ey = take();
        if (rel) { qx += x; qy += y; ex += x; ey += y; }
        var cub = quadToCubic([x, y], [qx, qy], [ex, ey]);
        cubic(cub[1], cub[2], cub[3]);
        continue;
      }
      break;
    }
    return subs.filter(function (sub) { return sub.segs.length; });
  }

  function pointAt(seg, t) {
    if (seg.op === "L") return lerp(seg.a, seg.b, t);
    return cubicAt(seg.a, seg.c1, seg.c2, seg.b, t);
  }

  function nearest(seg, x, y) {
    var best = null;
    var steps = seg.op === "L" ? 12 : 24;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var p = pointAt(seg, t);
      var dist = Math.hypot(p[0] - x, p[1] - y);
      if (!best || dist < best.dist) best = { t: t, dist: dist, pt: p };
    }
    return best;
  }

  function splitSeg(seg, t) {
    if (seg.op === "L") {
      var p = lerp(seg.a, seg.b, t);
      return {
        left: { op: "L", a: seg.a, b: p },
        right: { op: "L", a: p, b: seg.b }
      };
    }
    var parts = splitCubic(seg.a, seg.c1, seg.c2, seg.b, t);
    return {
      left: { op: "C", a: parts.left[0], c1: parts.left[1], c2: parts.left[2], b: parts.left[3] },
      right: { op: "C", a: parts.right[0], c1: parts.right[1], c2: parts.right[2], b: parts.right[3] }
    };
  }

  function writeSub(sub) {
    if (!sub.segs.length) return "";
    var d = "M" + round(sub.segs[0].a[0]) + " " + round(sub.segs[0].a[1]);
    sub.segs.forEach(function (seg) {
      if (seg.op === "L") {
        d += "L" + round(seg.b[0]) + " " + round(seg.b[1]);
        return;
      }
      d += "C" + round(seg.c1[0]) + " " + round(seg.c1[1]) + " " + round(seg.c2[0]) + " " + round(seg.c2[1]) + " " + round(seg.b[0]) + " " + round(seg.b[1]);
    });
    if (sub.closed) d += "Z";
    return d;
  }

  function writeAll(subs) {
    return subs.map(writeSub).filter(Boolean).join("");
  }

  function anchorsOf(sub) {
    var pts = [sub.segs[0].a];
    sub.segs.forEach(function (seg) { pts.push(seg.b); });
    if (sub.closed) pts.pop();
    return pts;
  }

  function joinSeg(left, right) {
    if (left.op === "L" && right.op === "L") return { op: "L", a: left.a.slice(), b: right.b.slice() };
    return {
      op: "C",
      a: left.a.slice(),
      c1: left.op === "C" ? left.c1.slice() : left.a.slice(),
      c2: right.op === "C" ? right.c2.slice() : right.b.slice(),
      b: right.b.slice()
    };
  }

  function deleteAt(sub, index) {
    var n = sub.segs.length;
    var count = sub.closed ? n : n + 1;
    if (index < 0 || index >= count) return null;
    if (sub.closed && n < 4) return null;
    if (!sub.closed && n < 2) return null;
    var segs = sub.segs.map(function (seg) {
      return seg.op === "L"
        ? { op: "L", a: seg.a.slice(), b: seg.b.slice() }
        : { op: "C", a: seg.a.slice(), c1: seg.c1.slice(), c2: seg.c2.slice(), b: seg.b.slice() };
    });
    if (!sub.closed && index === 0) {
      segs.shift();
      return { closed: false, segs: segs };
    }
    if (!sub.closed && index === n) {
      segs.pop();
      return { closed: false, segs: segs };
    }
    var left = sub.closed && index === 0 ? n - 1 : index - 1;
    var right = sub.closed && index === 0 ? 0 : index;
    var joined = joinSeg(segs[left], segs[right]);
    if (sub.closed && index === 0) {
      var ring = segs.slice(1, n - 1);
      ring.push(joined);
      return { closed: true, segs: ring };
    }
    var next = segs.slice(0, left).concat([joined], segs.slice(right + 1));
    return { closed: sub.closed, segs: next };
  }

  function edit(d, x, y, radius) {
    var subs = subpaths(d);
    if (!subs.length) return null;
    var anchor = null;
    var segment = null;
    subs.forEach(function (sub, si) {
      anchorsOf(sub).forEach(function (pt, i) {
        var dist = Math.hypot(pt[0] - x, pt[1] - y);
        if (!anchor || dist < anchor.dist) anchor = { si: si, i: i, dist: dist };
      });
      sub.segs.forEach(function (seg, i) {
        var hit = nearest(seg, x, y);
        if (!hit || hit.t < 0.08 || hit.t > 0.92) return;
        if (!segment || hit.dist < segment.dist) segment = { si: si, i: i, t: hit.t, dist: hit.dist };
      });
    });
    if (anchor && anchor.dist <= radius) {
      var removed = deleteAt(subs[anchor.si], anchor.i);
      if (!removed || !removed.segs.length) return null;
      subs[anchor.si] = removed;
      return { d: writeAll(subs), action: "delete", dist: anchor.dist };
    }
    if (!segment || segment.dist > radius) return null;
    var sub = subs[segment.si];
    var split = splitSeg(sub.segs[segment.i], segment.t);
    sub.segs.splice(segment.i, 1, split.left, split.right);
    return { d: writeAll(subs), action: "add", dist: segment.dist };
  }

  root.VeloraAnchors = { edit: edit, subpaths: subpaths };
})(typeof window !== "undefined" ? window : globalThis);
