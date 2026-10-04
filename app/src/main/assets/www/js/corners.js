(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function fmt(n) {
    return String(round(n));
  }

  function tokens(d) {
    return String(d || "").match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  }

  function toAbsolute(d) {
    var parts = tokens(d);
    var i = 0;
    var cx = 0;
    var cy = 0;
    var sx = 0;
    var sy = 0;
    var out = [];
    function take() { return parseFloat(parts[i++]); }
    function isCmd(t) { return t && /[a-zA-Z]/.test(t); }
    while (i < parts.length) {
      var cmd = parts[i++];
      var rel = cmd === cmd.toLowerCase();
      var op = cmd.toUpperCase();
      if (op === "M") {
        var mx = take();
        var my = take();
        if (rel) { mx += cx; my += cy; }
        cx = sx = mx;
        cy = sy = my;
        out.push({ op: "M", x: mx, y: my });
        while (i < parts.length && !isCmd(parts[i])) {
          var lx = take();
          var ly = take();
          if (rel) { lx += cx; ly += cy; }
          cx = lx;
          cy = ly;
          out.push({ op: "L", x: lx, y: ly });
        }
      } else if (op === "L") {
        while (i < parts.length && !isCmd(parts[i])) {
          var x = take();
          var y = take();
          if (rel) { x += cx; y += cy; }
          cx = x;
          cy = y;
          out.push({ op: "L", x: x, y: y });
        }
      } else if (op === "H") {
        while (i < parts.length && !isCmd(parts[i])) {
          var hx = take();
          if (rel) hx += cx;
          cx = hx;
          out.push({ op: "L", x: cx, y: cy });
        }
      } else if (op === "V") {
        while (i < parts.length && !isCmd(parts[i])) {
          var hy = take();
          if (rel) hy += cy;
          cy = hy;
          out.push({ op: "L", x: cx, y: cy });
        }
      } else if (op === "C") {
        while (i < parts.length && !isCmd(parts[i])) {
          var c1x = take();
          var c1y = take();
          var c2x = take();
          var c2y = take();
          var ex = take();
          var ey = take();
          if (rel) {
            c1x += cx; c1y += cy;
            c2x += cx; c2y += cy;
            ex += cx; ey += cy;
          }
          out.push({ op: "C", x1: c1x, y1: c1y, x2: c2x, y2: c2y, x: ex, y: ey });
          cx = ex;
          cy = ey;
        }
      } else if (op === "Z") {
        out.push({ op: "Z" });
        cx = sx;
        cy = sy;
      } else {
        break;
      }
    }
    return out;
  }

  function subpaths(cmds) {
    var subs = [];
    var cur = null;
    cmds.forEach(function (c) {
      if (c.op === "M") {
        if (cur && cur.pts.length) subs.push(cur);
        cur = { closed: false, pts: [{ x: c.x, y: c.y, sharp: true }] };
      } else if (!cur) {
        return;
      } else if (c.op === "L") {
        cur.pts.push({ x: c.x, y: c.y, sharp: true });
      } else if (c.op === "C") {
        var prev = cur.pts[cur.pts.length - 1];
        var startSharp = Math.hypot(c.x1 - prev.x, c.y1 - prev.y) < 0.4;
        if (!startSharp) prev.sharp = false;
        cur.pts.push({ x: c.x, y: c.y, sharp: Math.hypot(c.x2 - c.x, c.y2 - c.y) < 0.4 });
      } else if (c.op === "Z") {
        cur.closed = true;
      }
    });
    if (cur && cur.pts.length) subs.push(cur);
    return subs;
  }

  function fillet(prev, curr, next, radius) {
    var v1x = prev.x - curr.x;
    var v1y = prev.y - curr.y;
    var v2x = next.x - curr.x;
    var v2y = next.y - curr.y;
    var l1 = Math.hypot(v1x, v1y);
    var l2 = Math.hypot(v2x, v2y);
    if (l1 < 1 || l2 < 1) return null;
    v1x /= l1;
    v1y /= l1;
    v2x /= l2;
    v2y /= l2;
    var dot = Math.max(-1, Math.min(1, v1x * v2x + v1y * v2y));
    var phi = Math.acos(dot);
    if (phi < 0.18 || phi > Math.PI - 0.12) return null;
    var cut = radius / Math.tan(phi / 2);
    var maxCut = Math.min(l1, l2) * 0.45;
    var r = radius;
    if (cut > maxCut) {
      cut = maxCut;
      r = cut * Math.tan(phi / 2);
    }
    if (r < 0.5) return null;
    var t1 = { x: curr.x + v1x * cut, y: curr.y + v1y * cut };
    var t2 = { x: curr.x + v2x * cut, y: curr.y + v2y * cut };
    var bx = v1x + v2x;
    var by = v1y + v2y;
    var bl = Math.hypot(bx, by) || 1;
    bx /= bl;
    by /= bl;
    var dist = r / Math.sin(phi / 2);
    var cx = curr.x + bx * dist;
    var cy = curr.y + by * dist;
    var sweep = Math.PI - phi;
    var k = (4 / 3) * Math.tan(sweep / 4);
    var r1x = t1.x - cx;
    var r1y = t1.y - cy;
    var r2x = t2.x - cx;
    var r2y = t2.y - cy;
    var cross = r1x * r2y - r1y * r2x;
    var s = cross >= 0 ? 1 : -1;
    var n1 = Math.hypot(r1x, r1y) || 1;
    var n2 = Math.hypot(r2x, r2y) || 1;
    var tx1 = s * (-r1y) / n1;
    var ty1 = s * r1x / n1;
    var tx2 = s * (-r2y) / n2;
    var ty2 = s * r2x / n2;
    return {
      t1: t1,
      t2: t2,
      c1: { x: t1.x + tx1 * k * r, y: t1.y + ty1 * k * r },
      c2: { x: t2.x - tx2 * k * r, y: t2.y - ty2 * k * r }
    };
  }

  function writeSub(sub, radius) {
    var pts = sub.pts.slice();
    if (pts.length < 2) return "";
    if (sub.closed && pts.length > 2) {
      var a = pts[0];
      var b = pts[pts.length - 1];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.4) pts.pop();
    }
    if (pts.length < (sub.closed ? 3 : 2)) return "";
    var n = pts.length;
    var cuts = [];
    for (var i = 0; i < n; i++) {
      var end = !sub.closed && (i === 0 || i === n - 1);
      if (end || !pts[i].sharp) {
        cuts.push(null);
        continue;
      }
      var prev = pts[(i - 1 + n) % n];
      var next = pts[(i + 1) % n];
      cuts.push(fillet(prev, pts[i], next, radius));
    }
    if (!cuts.some(function (c) { return c; })) return "";
    function leave(i) {
      return cuts[i] ? cuts[i].t2 : pts[i];
    }
    function arrive(i) {
      return cuts[i] ? cuts[i].t1 : pts[i];
    }
    var start = leave(0);
    var d = "M" + fmt(start.x) + " " + fmt(start.y);
    var last = sub.closed ? n : n - 1;
    for (var j = 1; j <= last; j++) {
      var idx = j % n;
      var hit = arrive(idx);
      d += "L" + fmt(hit.x) + " " + fmt(hit.y);
      if (cuts[idx]) {
        var c = cuts[idx];
        d += "C" + fmt(c.c1.x) + " " + fmt(c.c1.y) + " " + fmt(c.c2.x) + " " + fmt(c.c2.y) + " " + fmt(c.t2.x) + " " + fmt(c.t2.y);
      }
    }
    if (sub.closed) d += "Z";
    return d;
  }

  function primitive(shape) {
    if (!shape) return "";
    if (shape.type === "path") return shape.d || "";
    if (shape.type === "rect") {
      var x = shape.x || 0;
      var y = shape.y || 0;
      var w = shape.w || 0;
      var h = shape.h || 0;
      return "M" + fmt(x) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y + h) + "L" + fmt(x) + " " + fmt(y + h) + "Z";
    }
    if (shape.type === "polygon" && shape.points && shape.points.length) {
      var d = "";
      shape.points.forEach(function (pt, i) {
        d += (i ? "L" : "M") + fmt(pt[0]) + " " + fmt(pt[1]);
      });
      return d + "Z";
    }
    if (shape.type === "line") {
      return "M" + fmt(shape.x1 || 0) + " " + fmt(shape.y1 || 0) + "L" + fmt(shape.x2 || 0) + " " + fmt(shape.y2 || 0);
    }
    return shape.d || "";
  }

  function roundPath(d, radius) {
    var r = Number(radius);
    if (!isFinite(r) || r <= 0) return "";
    var cmds = toAbsolute(d);
    var parts = subpaths(cmds).map(function (sub) { return writeSub(sub, r); }).filter(Boolean);
    return parts.join("");
  }

  function roundShape(shape, radius) {
    return roundPath(primitive(shape), radius);
  }

  root.VeloraCorners = { roundPath: roundPath, roundShape: roundShape };
})(typeof window !== "undefined" ? window : globalThis);
