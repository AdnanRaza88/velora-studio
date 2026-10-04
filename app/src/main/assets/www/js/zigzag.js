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
      if (!isCmd(cmd)) break;
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
      } else if (op === "Q") {
        while (i < parts.length && !isCmd(parts[i])) {
          var qx = take();
          var qy = take();
          var qex = take();
          var qey = take();
          if (rel) { qx += cx; qy += cy; qex += cx; qey += cy; }
          out.push({
            op: "C",
            x1: cx + (2 / 3) * (qx - cx),
            y1: cy + (2 / 3) * (qy - cy),
            x2: qex + (2 / 3) * (qx - qex),
            y2: qey + (2 / 3) * (qy - qey),
            x: qex,
            y: qey
          });
          cx = qex;
          cy = qey;
        }
      } else if (op === "Z") {
        out.push({ op: "Z" });
        cx = sx;
        cy = sy;
      } else if (op === "A") {
        while (i < parts.length && !isCmd(parts[i])) {
          i += 5;
          var ax = take();
          var ay = take();
          if (rel) { ax += cx; ay += cy; }
          out.push({ op: "L", x: ax, y: ay });
          cx = ax;
          cy = ay;
        }
      } else {
        break;
      }
    }
    return out;
  }

  function ellipsePath(cx, cy, rx, ry) {
    var k = 0.5522847498;
    var kx = rx * k;
    var ky = ry * k;
    return "M" + fmt(cx + rx) + " " + fmt(cy) +
      "C" + fmt(cx + rx) + " " + fmt(cy + ky) + " " + fmt(cx + kx) + " " + fmt(cy + ry) + " " + fmt(cx) + " " + fmt(cy + ry) +
      "C" + fmt(cx - kx) + " " + fmt(cy + ry) + " " + fmt(cx - rx) + " " + fmt(cy + ky) + " " + fmt(cx - rx) + " " + fmt(cy) +
      "C" + fmt(cx - rx) + " " + fmt(cy - ky) + " " + fmt(cx - kx) + " " + fmt(cy - ry) + " " + fmt(cx) + " " + fmt(cy - ry) +
      "C" + fmt(cx + kx) + " " + fmt(cy - ry) + " " + fmt(cx + rx) + " " + fmt(cy - ky) + " " + fmt(cx + rx) + " " + fmt(cy) + "Z";
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
    if (shape.type === "circle") return ellipsePath(shape.cx || 0, shape.cy || 0, shape.r || 0, shape.r || 0);
    if (shape.type === "ellipse") return ellipsePath(shape.cx || 0, shape.cy || 0, shape.rx || 0, shape.ry || 0);
    return shape.d || "";
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var a = u * u * u;
    var b = 3 * u * u * t;
    var c = 3 * u * t * t;
    var d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
    };
  }

  function flatten(cmds, step) {
    var subs = [];
    var cur = null;
    var cx = 0;
    var cy = 0;
    var sx = 0;
    var sy = 0;
    cmds.forEach(function (cmd) {
      if (cmd.op === "M") {
        if (cur && cur.pts.length) subs.push(cur);
        cur = { pts: [{ x: cmd.x, y: cmd.y }], closed: false };
        cx = sx = cmd.x;
        cy = sy = cmd.y;
      } else if (!cur) {
        return;
      } else if (cmd.op === "L") {
        cur.pts.push({ x: cmd.x, y: cmd.y });
        cx = cmd.x;
        cy = cmd.y;
      } else if (cmd.op === "C") {
        var p0 = { x: cx, y: cy };
        var p1 = { x: cmd.x1, y: cmd.y1 };
        var p2 = { x: cmd.x2, y: cmd.y2 };
        var p3 = { x: cmd.x, y: cmd.y };
        for (var s = 1; s <= step; s++) cur.pts.push(cubicPoint(p0, p1, p2, p3, s / step));
        cx = cmd.x;
        cy = cmd.y;
      } else if (cmd.op === "Z") {
        cur.closed = true;
        if (Math.hypot(cur.pts[0].x - cx, cur.pts[0].y - cy) > 0.4) cur.pts.push({ x: sx, y: sy });
        cx = sx;
        cy = sy;
      }
    });
    if (cur && cur.pts.length) subs.push(cur);
    return subs;
  }

  function lengthOf(pts, closed) {
    var n = pts.length;
    var last = closed ? n : n - 1;
    var total = 0;
    var marks = [0];
    for (var i = 0; i < last; i++) {
      var a = pts[i];
      var b = pts[(i + 1) % n];
      total += Math.hypot(b.x - a.x, b.y - a.y);
      marks.push(total);
    }
    return { total: total, marks: marks };
  }

  function pointAt(pts, closed, marks, dist) {
    var n = pts.length;
    var last = closed ? n : n - 1;
    if (dist <= 0) return { x: pts[0].x, y: pts[0].y, tx: 1, ty: 0 };
    var span = marks[marks.length - 1] || 1;
    if (dist >= span) dist = Math.max(0, span - 0.001);
    var i = 0;
    while (i < last - 1 && marks[i + 1] < dist) i++;
    var a = pts[i];
    var b = pts[(i + 1) % n];
    var seg = marks[i + 1] - marks[i] || 1;
    var t = (dist - marks[i]) / seg;
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var len = Math.hypot(dx, dy) || 1;
    return { x: a.x + dx * t, y: a.y + dy * t, tx: dx / len, ty: dy / len };
  }

  function waveSub(sub, size, ridges) {
    var pts = sub.pts.filter(function (p, i) {
      if (!i) return true;
      var prev = sub.pts[i - 1];
      return Math.hypot(p.x - prev.x, p.y - prev.y) > 0.2;
    });
    if (pts.length < 2) return "";
    var closed = sub.closed;
    if (closed && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.4) pts = pts.slice(0, -1);
    if (pts.length < 2) return "";
    var span = lengthOf(pts, closed);
    if (span.total < 1) return "";
    var count = Math.max(16, ridges * 8);
    var out = [];
    for (var i = 0; i < count; i++) {
      var t = i / count;
      var at = pointAt(pts, closed, span.marks, t * span.total);
      var amp = size * Math.sin(Math.PI * 2 * ridges * t);
      if (!closed && i === 0) amp = 0;
      out.push({ x: at.x + (-at.ty) * amp, y: at.y + at.tx * amp });
    }
    if (!closed) {
      var end = pointAt(pts, false, span.marks, span.total);
      out.push({ x: end.x, y: end.y });
    }
    var d = "M" + fmt(out[0].x) + " " + fmt(out[0].y);
    for (var j = 1; j < out.length; j++) d += "L" + fmt(out[j].x) + " " + fmt(out[j].y);
    if (closed) d += "Z";
    return d;
  }

  function wavePath(d, size, ridges) {
    var amp = Number(size);
    var peaks = Math.round(Number(ridges));
    if (!isFinite(amp) || amp === 0) return "";
    if (!isFinite(peaks) || peaks < 1) peaks = 6;
    peaks = Math.max(1, Math.min(48, peaks));
    var cmds = toAbsolute(d);
    if (!cmds.length) return "";
    return flatten(cmds, 8).map(function (sub) { return waveSub(sub, amp, peaks); }).filter(Boolean).join("");
  }

  function waveShape(shape, size, ridges) {
    return wavePath(primitive(shape), size, ridges);
  }

  root.VeloraZigzag = { wavePath: wavePath, waveShape: waveShape };
})(typeof window !== "undefined" ? window : globalThis);
