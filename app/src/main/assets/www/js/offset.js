(function (root) {
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function dropClose(ring) {
    if (!ring || ring.length < 2) return ring || [];
    var a = ring[0];
    var b = ring[ring.length - 1];
    if (Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05) return ring.slice(0, -1);
    return ring.slice();
  }

  function signedArea(ring) {
    var a = 0;
    for (var i = 0; i < ring.length; i++) {
      var p = ring[i];
      var q = ring[(i + 1) % ring.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  function intersect(prev, cur) {
    var det = prev.dx * cur.dy - prev.dy * cur.dx;
    if (Math.abs(det) < 1e-8) return null;
    var t = ((cur.x - prev.x) * cur.dy - (cur.y - prev.y) * cur.dx) / det;
    return [prev.x + prev.dx * t, prev.y + prev.dy * t];
  }

  function edgesOf(ring, delta) {
    var edges = [];
    var n = ring.length;
    for (var i = 0; i < n; i++) {
      var a = ring[i];
      var b = ring[(i + 1) % n];
      var dx = b[0] - a[0];
      var dy = b[1] - a[1];
      var len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len;
      var ny = dx / len;
      edges.push({ x: a[0] + nx * delta, y: a[1] + ny * delta, dx: dx, dy: dy });
    }
    return edges;
  }

  function offsetClosed(ring, distance, miterLimit) {
    var pts = dropClose(ring);
    if (pts.length < 3 || !distance) return null;
    var sign = signedArea(pts) >= 0 ? 1 : -1;
    var delta = -distance * sign;
    var edges = edgesOf(pts, delta);
    var limit = Math.max(1, num(miterLimit, 4)) * Math.abs(distance);
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var prev = edges[(i + pts.length - 1) % pts.length];
      var cur = edges[i];
      var hit = intersect(prev, cur);
      if (!hit) {
        out.push([round(cur.x), round(cur.y)]);
        continue;
      }
      var miter = Math.hypot(hit[0] - pts[i][0], hit[1] - pts[i][1]);
      if (miter > limit) {
        var endX = prev.x + prev.dx;
        var endY = prev.y + prev.dy;
        out.push([round(endX), round(endY)]);
        out.push([round(cur.x), round(cur.y)]);
      } else {
        out.push([round(hit[0]), round(hit[1])]);
      }
    }
    return out.length >= 3 ? out : null;
  }

  function offsetOpen(ring, distance) {
    var pts = dropClose(ring);
    if (pts.length < 2 || !distance) return null;
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var prev = i === 0 ? null : [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
      var next = i === pts.length - 1 ? null : [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]];
      var nx = 0;
      var ny = 0;
      function add(v) {
        if (!v) return;
        var len = Math.hypot(v[0], v[1]) || 1;
        nx += -v[1] / len;
        ny += v[0] / len;
      }
      add(prev);
      add(next);
      var nlen = Math.hypot(nx, ny) || 1;
      out.push([round(pts[i][0] + (nx / nlen) * distance), round(pts[i][1] + (ny / nlen) * distance)]);
    }
    return out;
  }

  function pathOf(points, closed) {
    if (!points || points.length < 2) return "";
    var d = "M" + points[0][0] + " " + points[0][1];
    for (var i = 1; i < points.length; i++) d += " L" + points[i][0] + " " + points[i][1];
    if (closed) d += " Z";
    return d;
  }

  function ofShape(shape, distance, miterLimit) {
    if (!shape || !root.VeloraBoolean) return "";
    var rings = root.VeloraBoolean.ringsOf(shape);
    if (!rings.length) return "";
    var closed = shape.type !== "path" || /[Zz]/.test(String(shape.d || ""));
    var parts = [];
    rings.forEach(function (ring) {
      var pts = closed ? offsetClosed(ring, distance, miterLimit) : offsetOpen(ring, distance);
      var d = pathOf(pts, closed);
      if (d) parts.push(d);
    });
    return parts.join(" ");
  }

  root.VeloraOffset = {
    closed: offsetClosed,
    open: offsetOpen,
    pathOf: pathOf,
    ofShape: ofShape
  };
})(typeof window !== "undefined" ? window : globalThis);
