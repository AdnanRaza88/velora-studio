(function (root) {
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function fmt(n) {
    return (Math.round(num(n) * 100) / 100).toString();
  }

  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function at(points, i, closed) {
    var n = points.length;
    if (closed) return points[(i + n) % n];
    if (i < 0) return points[0];
    if (i >= n) return points[n - 1];
    return points[i];
  }

  function fit(points, closed) {
    var src = [];
    for (var i = 0; i < (points || []).length; i++) {
      var p = points[i];
      if (!p || !isFinite(p.x) || !isFinite(p.y)) continue;
      src.push({ x: num(p.x), y: num(p.y), corner: !!p.corner });
    }
    if (src.length < 2) return null;
    var loop = !!closed && src.length > 2;
    var parts = ["M" + fmt(src[0].x) + " " + fmt(src[0].y)];
    var last = loop ? src.length : src.length - 1;
    for (var s = 0; s < last; s++) {
      var p0 = at(src, s - 1, loop);
      var p1 = at(src, s, loop);
      var p2 = at(src, s + 1, loop);
      var p3 = at(src, s + 2, loop);
      var c1x = p1.x + (p2.x - p0.x) / 6;
      var c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6;
      var c2y = p2.y - (p3.y - p1.y) / 6;
      if (p1.corner) {
        c1x = p1.x;
        c1y = p1.y;
      }
      if (p2.corner) {
        c2x = p2.x;
        c2y = p2.y;
      }
      if (p1.corner && p2.corner) {
        parts.push("L" + fmt(p2.x) + " " + fmt(p2.y));
      } else {
        parts.push("C" + fmt(c1x) + " " + fmt(c1y) + " " + fmt(c2x) + " " + fmt(c2y) + " " + fmt(p2.x) + " " + fmt(p2.y));
      }
    }
    if (loop) parts.push("Z");
    return { d: parts.join(""), closed: loop, anchors: src.length };
  }

  root.VeloraCurve = { fit: fit, dist: dist };
})(typeof window !== "undefined" ? window : globalThis);
