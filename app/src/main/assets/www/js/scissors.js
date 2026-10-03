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
      cur = { closed: false, segs: [], x: px, y: py };
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

  function nearest(seg, x, y) {
    var best = null;
    var steps = seg.op === "L" ? 12 : 24;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var p = seg.op === "L" ? lerp(seg.a, seg.b, t) : cubicAt(seg.a, seg.c1, seg.c2, seg.b, t);
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

  function write(segs) {
    if (!segs.length) return "";
    var d = "M" + round(segs[0].a[0]) + " " + round(segs[0].a[1]);
    segs.forEach(function (seg) {
      if (seg.op === "L") {
        d += "L" + round(seg.b[0]) + " " + round(seg.b[1]);
        return;
      }
      d += "C" + round(seg.c1[0]) + " " + round(seg.c1[1]) + " " + round(seg.c2[0]) + " " + round(seg.c2[1]) + " " + round(seg.b[0]) + " " + round(seg.b[1]);
    });
    return d;
  }

  function lengthOf(segs) {
    var n = 0;
    segs.forEach(function (seg) {
      n += Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
    });
    return n;
  }

  function cut(d, x, y, radius) {
    var subs = subpaths(d);
    if (!subs.length) return null;
    var best = null;
    subs.forEach(function (sub, si) {
      sub.segs.forEach(function (seg, i) {
        var hit = nearest(seg, x, y);
        if (!hit) return;
        if (!best || hit.dist < best.dist) best = { si: si, i: i, t: hit.t, dist: hit.dist };
      });
    });
    if (!best || best.dist > radius) return null;
    var sub = subs[best.si];
    var split = splitSeg(sub.segs[best.i], Math.min(0.98, Math.max(0.02, best.t)));
    var before = sub.segs.slice(0, best.i);
    var after = sub.segs.slice(best.i + 1);
    var pieces = [];
    var opened = false;
    if (sub.closed) {
      var ring = [split.right].concat(after, before, [split.left]);
      if (lengthOf(ring) < 1) return null;
      pieces.push(write(ring));
      opened = true;
    } else {
      var left = before.concat([split.left]);
      var right = [split.right].concat(after);
      if (lengthOf(left) < 1 || lengthOf(right) < 1) return null;
      pieces.push(write(left), write(right));
    }
    var rest = subs.filter(function (_, i) { return i !== best.si; }).map(function (other) {
      return write(other.segs) + (other.closed ? "Z" : "");
    }).filter(Boolean);
    if (rest.length) pieces[0] = pieces[0] + rest.join("");
    return { pieces: pieces, opened: opened };
  }

  root.VeloraScissors = { cut: cut, subpaths: subpaths };
})(typeof window !== "undefined" ? window : globalThis);
