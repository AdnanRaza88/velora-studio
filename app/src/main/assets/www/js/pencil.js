(function (root) {
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function fmt(n) {
    return (Math.round(num(n) * 100) / 100).toString();
  }

  function dist(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clean(points, gap) {
    var out = [];
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (!p || !isFinite(p[0]) || !isFinite(p[1])) continue;
      if (!out.length || dist(out[out.length - 1], p) >= gap) out.push([p[0], p[1]]);
    }
    return out;
  }

  function rdp(points, eps) {
    if (points.length < 3) return points.slice();
    var end = points.length - 1;
    var ax = points[0][0];
    var ay = points[0][1];
    var bx = points[end][0];
    var by = points[end][1];
    var dx = bx - ax;
    var dy = by - ay;
    var span = dx * dx + dy * dy || 1;
    var max = 0;
    var idx = 0;
    for (var i = 1; i < end; i++) {
      var t = ((points[i][0] - ax) * dx + (points[i][1] - ay) * dy) / span;
      var qx = ax + t * dx;
      var qy = ay + t * dy;
      var d = Math.hypot(points[i][0] - qx, points[i][1] - qy);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (max > eps) {
      var left = rdp(points.slice(0, idx + 1), eps);
      var right = rdp(points.slice(idx), eps);
      return left.slice(0, -1).concat(right);
    }
    return [points[0], points[end]];
  }

  function fitOpen(points) {
    var n = points.length;
    if (n < 2) return "";
    var parts = ["M" + fmt(points[0][0]) + " " + fmt(points[0][1])];
    if (n === 2) {
      parts.push("L" + fmt(points[1][0]) + " " + fmt(points[1][1]));
      return parts.join("");
    }
    for (var i = 0; i < n - 1; i++) {
      var p0 = points[Math.max(0, i - 1)];
      var p1 = points[i];
      var p2 = points[i + 1];
      var p3 = points[Math.min(n - 1, i + 2)];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      parts.push("C" + fmt(c1x) + " " + fmt(c1y) + " " + fmt(c2x) + " " + fmt(c2y) + " " + fmt(p2[0]) + " " + fmt(p2[1]));
    }
    return parts.join("");
  }

  function fitClosed(points) {
    var n = points.length;
    if (n < 3) return fitOpen(points);
    var parts = ["M" + fmt(points[0][0]) + " " + fmt(points[0][1])];
    for (var i = 0; i < n; i++) {
      var p0 = points[(i - 1 + n) % n];
      var p1 = points[i];
      var p2 = points[(i + 1) % n];
      var p3 = points[(i + 2) % n];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6;
      var c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6;
      var c2y = p2[1] - (p3[1] - p1[1]) / 6;
      parts.push("C" + fmt(c1x) + " " + fmt(c1y) + " " + fmt(c2x) + " " + fmt(c2y) + " " + fmt(p2[0]) + " " + fmt(p2[1]));
    }
    parts.push("Z");
    return parts.join("");
  }

  function stroke(points, tolerance, closeGap) {
    var raw = clean(points, 1.5);
    if (raw.length < 2) return null;
    var eps = Math.max(1.2, num(tolerance) || 6);
    var simple = rdp(raw, eps);
    if (simple.length < 2) return null;
    var closed = simple.length > 2 && dist(simple[0], simple[simple.length - 1]) <= (closeGap || eps * 3);
    if (closed) simple = simple.slice(0, -1);
    var d = closed ? fitClosed(simple) : fitOpen(simple);
    if (!d) return null;
    return { d: d, closed: closed, anchors: simple.length };
  }

  function tokens(d) {
    return String(d || "").match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  }

  function samplePath(d) {
    var parts = tokens(d);
    var i = 0;
    var cx = 0;
    var cy = 0;
    var sx = 0;
    var sy = 0;
    var pts = [];
    var closed = false;
    function take() { return parseFloat(parts[i++]); }
    function push(x, y) {
      var p = [x, y];
      if (!pts.length || dist(pts[pts.length - 1], p) > 0.4) pts.push(p);
    }
    function cubic(x1, y1, x2, y2, x, y) {
      var p0 = [cx, cy];
      var p1 = [x1, y1];
      var p2 = [x2, y2];
      var p3 = [x, y];
      for (var s = 1; s <= 6; s++) {
        var t = s / 6;
        var u = 1 - t;
        push(
          u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
          u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
        );
      }
      cx = x;
      cy = y;
    }
    while (i < parts.length) {
      var op = parts[i++];
      if (!/[A-Za-z]/.test(op)) continue;
      var rel = op === op.toLowerCase();
      var cmd = op.toUpperCase();
      if (cmd === "M") {
        cx = take() + (rel ? cx : 0);
        cy = take() + (rel ? cy : 0);
        sx = cx;
        sy = cy;
        push(cx, cy);
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          cx = take() + (rel ? cx : 0);
          cy = take() + (rel ? cy : 0);
          push(cx, cy);
        }
      } else if (cmd === "L") {
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          cx = take() + (rel ? cx : 0);
          cy = take() + (rel ? cy : 0);
          push(cx, cy);
        }
      } else if (cmd === "H") {
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          cx = take() + (rel ? cx : 0);
          push(cx, cy);
        }
      } else if (cmd === "V") {
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          cy = take() + (rel ? cy : 0);
          push(cx, cy);
        }
      } else if (cmd === "C") {
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          var x1 = take() + (rel ? cx : 0);
          var y1 = take() + (rel ? cy : 0);
          var x2 = take() + (rel ? cx : 0);
          var y2 = take() + (rel ? cy : 0);
          var x = take() + (rel ? cx : 0);
          var y = take() + (rel ? cy : 0);
          cubic(x1, y1, x2, y2, x, y);
        }
      } else if (cmd === "Q") {
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          var qx = take() + (rel ? cx : 0);
          var qy = take() + (rel ? cy : 0);
          var ex = take() + (rel ? cx : 0);
          var ey = take() + (rel ? cy : 0);
          cubic(cx + (qx - cx) * 2 / 3, cy + (qy - cy) * 2 / 3, ex + (qx - ex) * 2 / 3, ey + (qy - ey) * 2 / 3, ex, ey);
        }
      } else if (cmd === "A") {
        while (i < parts.length && !/[A-Za-z]/.test(parts[i])) {
          take();
          take();
          take();
          take();
          take();
          cx = take() + (rel ? cx : 0);
          cy = take() + (rel ? cy : 0);
          push(cx, cy);
        }
      } else if (cmd === "Z") {
        closed = true;
        cx = sx;
        cy = sy;
        push(cx, cy);
      }
    }
    return { points: pts, closed: closed };
  }

  function chaikin(points, closed) {
    if (points.length < 3) return points.slice();
    var out = [];
    var n = points.length;
    var last = closed ? n : n - 1;
    if (!closed) out.push(points[0]);
    for (var i = 0; i < last; i++) {
      var a = points[i];
      var b = points[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) out.push(points[n - 1]);
    return out;
  }

  function smooth(d, strength) {
    var sampled = samplePath(d);
    if (sampled.points.length < 3) return d || "";
    var amount = Math.max(0.15, Math.min(1, num(strength) || 0.45));
    var span = 0;
    for (var i = 1; i < sampled.points.length; i++) span += dist(sampled.points[i - 1], sampled.points[i]);
    var passes = amount > 0.65 ? 2 : 1;
    var pts = sampled.points;
    for (var p = 0; p < passes; p++) pts = chaikin(pts, sampled.closed);
    var eps = Math.max(1.5, span * (0.008 + amount * 0.02));
    var simple = rdp(pts, eps);
    if (sampled.closed && simple.length > 2) simple = simple.slice(0, -1);
    var next = sampled.closed ? fitClosed(simple) : fitOpen(simple);
    return next || d;
  }

  root.VeloraPencil = {
    stroke: stroke,
    smooth: smooth
  };
})(typeof window !== "undefined" ? window : globalThis);
