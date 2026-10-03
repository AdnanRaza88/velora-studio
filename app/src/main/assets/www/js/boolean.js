(function (root) {
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function tokens(d) {
    return String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
  }

  function sampleCubic(ax, ay, bx, by, cx, cy, dx, dy, steps, out) {
    for (var i = 1; i <= steps; i++) {
      var u = i / steps;
      var k = 1 - u;
      out.push([
        k * k * k * ax + 3 * k * k * u * bx + 3 * k * u * u * cx + u * u * u * dx,
        k * k * k * ay + 3 * k * k * u * by + 3 * k * u * u * cy + u * u * u * dy
      ]);
    }
  }

  function sampleQuad(ax, ay, bx, by, cx, cy, steps, out) {
    for (var i = 1; i <= steps; i++) {
      var u = i / steps;
      var k = 1 - u;
      out.push([
        k * k * ax + 2 * k * u * bx + u * u * cx,
        k * k * ay + 2 * k * u * by + u * u * cy
      ]);
    }
  }

  function ringsFromPath(d) {
    var parts = tokens(d);
    var i = 0;
    var cmd = "";
    var x = 0;
    var y = 0;
    var sx = 0;
    var sy = 0;
    var ring = [];
    var rings = [];
    function take() { return parseFloat(parts[i++]); }
    function isCmd(t) { return /[A-Za-z]/.test(t); }
    function push(px, py) {
      if (!ring.length || Math.abs(ring[ring.length - 1][0] - px) > 0.05 || Math.abs(ring[ring.length - 1][1] - py) > 0.05) {
        ring.push([px, py]);
      }
    }
    function close() {
      if (ring.length >= 3) rings.push(ring);
      ring = [];
    }
    while (i < parts.length) {
      if (isCmd(parts[i])) cmd = parts[i++];
      var rel = cmd === cmd.toLowerCase();
      var op = cmd.toUpperCase();
      if (op === "Z") {
        close();
        x = sx;
        y = sy;
        continue;
      }
      if (op === "M") {
        if (ring.length >= 3) close();
        else ring = [];
        var mx = take();
        var my = take();
        if (rel) { mx += x; my += y; }
        x = mx;
        y = my;
        sx = x;
        sy = y;
        push(x, y);
        op = "L";
        while (i < parts.length && !isCmd(parts[i])) {
          var lx = take();
          var ly = take();
          if (rel) { lx += x; ly += y; }
          x = lx;
          y = ly;
          push(x, y);
        }
        continue;
      }
      if (op === "L") {
        var px = take();
        var py = take();
        if (rel) { px += x; py += y; }
        x = px;
        y = py;
        push(x, y);
        continue;
      }
      if (op === "H") {
        var hx = take();
        if (rel) hx += x;
        x = hx;
        push(x, y);
        continue;
      }
      if (op === "V") {
        var hy = take();
        if (rel) hy += y;
        y = hy;
        push(x, y);
        continue;
      }
      if (op === "C") {
        var c1x = take();
        var c1y = take();
        var c2x = take();
        var c2y = take();
        var cx = take();
        var cy = take();
        if (rel) { c1x += x; c1y += y; c2x += x; c2y += y; cx += x; cy += y; }
        sampleCubic(x, y, c1x, c1y, c2x, c2y, cx, cy, 8, ring);
        x = cx;
        y = cy;
        continue;
      }
      if (op === "Q") {
        var qx = take();
        var qy = take();
        var ex = take();
        var ey = take();
        if (rel) { qx += x; qy += y; ex += x; ey += y; }
        sampleQuad(x, y, qx, qy, ex, ey, 6, ring);
        x = ex;
        y = ey;
        continue;
      }
      if (op === "A") {
        take(); take(); take(); take(); take();
        var ax = take();
        var ay = take();
        if (rel) { ax += x; ay += y; }
        x = ax;
        y = ay;
        push(x, y);
        continue;
      }
      break;
    }
    if (ring.length >= 3) rings.push(ring);
    return rings;
  }

  function ellipseRing(cx, cy, rx, ry) {
    var pts = [];
    var n = 24;
    for (var i = 0; i < n; i++) {
      var a = (Math.PI * 2 * i) / n;
      pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return [pts];
  }

  function ringsOf(shape) {
    if (!shape) return [];
    if (shape.type === "circle") return ellipseRing(shape.cx, shape.cy, shape.r, shape.r);
    if (shape.type === "ellipse") return ellipseRing(shape.cx, shape.cy, shape.rx, shape.ry);
    if (shape.type === "rect") {
      return [[[shape.x, shape.y], [shape.x + shape.w, shape.y], [shape.x + shape.w, shape.y + shape.h], [shape.x, shape.y + shape.h]]];
    }
    if (shape.type === "polygon" && shape.points && shape.points.length >= 3) {
      return [shape.points.map(function (p) { return [p[0], p[1]]; })];
    }
    if (shape.type === "path") return ringsFromPath(shape.d);
    if (shape.type === "group") {
      var all = [];
      (shape.children || []).forEach(function (child) {
        ringsOf(child).forEach(function (ring) { all.push(ring); });
      });
      return all;
    }
    return [];
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

  function ensureWinding(ring, positive) {
    var area = signedArea(ring);
    if ((positive && area < 0) || (!positive && area > 0)) return ring.slice().reverse();
    return ring.slice();
  }

  function keyOf(p) {
    return round(p[0]) + "," + round(p[1]);
  }

  function pointInRing(p, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i];
      var b = ring[j];
      var hit = ((a[1] > p[1]) !== (b[1] > p[1])) &&
        (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function pointInRings(p, rings) {
    var hits = 0;
    for (var i = 0; i < rings.length; i++) if (pointInRing(p, rings[i])) hits++;
    return hits % 2 === 1;
  }

  function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  function snap(p) {
    return [round(p[0]), round(p[1])];
  }

  function segmentHit(a, b, c, d) {
    var r = [b[0] - a[0], b[1] - a[1]];
    var s = [d[0] - c[0], d[1] - c[1]];
    var den = cross(r[0], r[1], s[0], s[1]);
    var qp = [c[0] - a[0], c[1] - a[1]];
    if (Math.abs(den) < 1e-8) return null;
    var t = cross(qp[0], qp[1], s[0], s[1]) / den;
    var u = cross(qp[0], qp[1], r[0], r[1]) / den;
    if (t < -1e-6 || t > 1 + 1e-6 || u < -1e-6 || u > 1 + 1e-6) return null;
    t = Math.max(0, Math.min(1, t));
    u = Math.max(0, Math.min(1, u));
    return { t: t, u: u, p: snap([a[0] + r[0] * t, a[1] + r[1] * t]) };
  }

  function collinearCuts(a, b, c, d) {
    var r = [b[0] - a[0], b[1] - a[1]];
    var s = [d[0] - c[0], d[1] - c[1]];
    if (Math.abs(cross(r[0], r[1], s[0], s[1])) > 1e-4) return [];
    var qp = [c[0] - a[0], c[1] - a[1]];
    if (Math.abs(cross(qp[0], qp[1], r[0], r[1])) > 0.05) return [];
    var len2 = r[0] * r[0] + r[1] * r[1];
    if (len2 < 1e-6) return [];
    function proj(p) {
      return ((p[0] - a[0]) * r[0] + (p[1] - a[1]) * r[1]) / len2;
    }
    var t0 = proj(c);
    var t1 = proj(d);
    var lo = Math.max(0, Math.min(t0, t1));
    var hi = Math.min(1, Math.max(t0, t1));
    if (hi - lo < 1e-4) return [];
    var cuts = [];
    [lo, hi].forEach(function (t) {
      if (t > 1e-4 && t < 1 - 1e-4) cuts.push({ t: t, p: snap([a[0] + r[0] * t, a[1] + r[1] * t]) });
    });
    return cuts;
  }

  function splitRing(ring, other) {
    var edges = [];
    for (var i = 0; i < ring.length; i++) {
      var a = ring[i];
      var b = ring[(i + 1) % ring.length];
      var cuts = [{ t: 0, p: snap(a) }, { t: 1, p: snap(b) }];
      for (var j = 0; j < other.length; j++) {
        other[j].forEach(function (clip, k, poly) {
          var hit = segmentHit(a, b, clip, poly[(k + 1) % poly.length]);
          if (hit && hit.t > 1e-4 && hit.t < 1 - 1e-4) cuts.push(hit);
          collinearCuts(a, b, clip, poly[(k + 1) % poly.length]).forEach(function (cut) { cuts.push(cut); });
        });
      }
      cuts.sort(function (p, q) { return p.t - q.t; });
      var unique = [];
      cuts.forEach(function (cut) {
        if (!unique.length || cut.t - unique[unique.length - 1].t > 1e-4) unique.push(cut);
      });
      for (var c = 0; c < unique.length - 1; c++) {
        edges.push([snap(unique[c].p), snap(unique[c + 1].p)]);
      }
    }
    return edges;
  }

  function keepEdge(edge, rings, wantInside) {
    var mid = [(edge[0][0] + edge[1][0]) / 2, (edge[0][1] + edge[1][1]) / 2];
    return pointInRings(mid, rings) === wantInside;
  }

  function stitch(edges) {
    var bag = edges.map(function (e) {
      return { a: e[0], b: e[1], used: false };
    }).filter(function (e) {
      return Math.abs(e.a[0] - e.b[0]) > 0.05 || Math.abs(e.a[1] - e.b[1]) > 0.05;
    });
    var rings = [];
    for (var i = 0; i < bag.length; i++) {
      if (bag[i].used) continue;
      var start = bag[i].a;
      var cur = bag[i].b;
      bag[i].used = true;
      var ring = [start, cur];
      var guard = 0;
      while (keyOf(cur) !== keyOf(start) && guard < bag.length + 2) {
        guard++;
        var found = false;
        for (var j = 0; j < bag.length; j++) {
          if (bag[j].used) continue;
          if (keyOf(bag[j].a) === keyOf(cur)) {
            bag[j].used = true;
            cur = bag[j].b;
            ring.push(cur);
            found = true;
            break;
          }
          if (keyOf(bag[j].b) === keyOf(cur)) {
            bag[j].used = true;
            cur = bag[j].a;
            ring.push(cur);
            found = true;
            break;
          }
        }
        if (!found) break;
      }
      if (ring.length >= 4 && keyOf(ring[0]) === keyOf(ring[ring.length - 1])) ring.pop();
      if (ring.length >= 3 && keyOf(ring[0]) === keyOf(cur) && Math.abs(signedArea(ring)) > 1) rings.push(ring);
    }
    return rings;
  }

  function combine(subject, clip, op) {
    var a = subject.map(function (ring) { return ensureWinding(ring.map(snap), true); });
    var b = clip.map(function (ring) { return ensureWinding(ring.map(snap), true); });
    if (!a.length || !b.length) return a.length ? a : b;
    var disjoint = true;
    var aInside = true;
    var bInside = true;
    a.forEach(function (ring) {
      ring.forEach(function (p) { if (!pointInRings(p, b)) aInside = false; });
    });
    b.forEach(function (ring) {
      ring.forEach(function (p) { if (!pointInRings(p, a)) bInside = false; });
    });
    a.forEach(function (ring) {
      ring.forEach(function (p) { if (pointInRings(p, b)) disjoint = false; });
    });
    b.forEach(function (ring) {
      ring.forEach(function (p) { if (pointInRings(p, a)) disjoint = false; });
    });
    if (disjoint) {
      if (op === "unite" || op === "exclude") return a.concat(b);
      if (op === "intersect") return [];
      return a;
    }
    if (aInside) {
      if (op === "unite") return b;
      if (op === "intersect") return a;
      if (op === "subtract") return [];
      if (op === "exclude") return b.concat(a.map(function (ring) { return ensureWinding(ring, false); }));
    }
    if (bInside) {
      if (op === "unite") return a;
      if (op === "intersect") return b;
      if (op === "subtract" || op === "exclude") return a.concat(b.map(function (ring) { return ensureWinding(ring, false); }));
    }
    if (op === "exclude") {
      return combine(subject, clip, "subtract").concat(combine(clip, subject, "subtract"));
    }
    var edges = [];
    splitRing(a[0], b).forEach(function (edge) {
      var inside = keepEdge(edge, b, true);
      if ((op === "unite" || op === "subtract") && !inside) edges.push(edge);
      if (op === "intersect" && inside) edges.push(edge);
    });
    splitRing(b[0], a).forEach(function (edge) {
      var inside = keepEdge(edge, a, true);
      if (op === "unite" && !inside) edges.push(edge);
      if (op === "subtract" && inside) edges.push([edge[1], edge[0]]);
      if (op === "intersect" && inside) edges.push(edge);
    });
    var rings = stitch(edges);
    if (!rings.length) {
      if (op === "intersect") return [];
      return op === "subtract" ? a : a.concat(b);
    }
    return rings;
  }

  function pathFromRings(rings) {
    return rings.map(function (ring) {
      return ring.map(function (p, i) {
        return (i ? "L" : "M") + round(p[0]) + " " + round(p[1]);
      }).join("") + "Z";
    }).join("");
  }

  function pair(doc, id) {
    var layer = null;
    var index = -1;
    (doc.layers || []).forEach(function (item) {
      (item.shapes || []).forEach(function (shape, i) {
        if (shape.id === id) {
          layer = item;
          index = i;
        }
      });
    });
    if (!layer || layer.locked || index < 0) return null;
    var other = index > 0 ? index - 1 : 1;
    if (other === index || other < 0 || other >= layer.shapes.length) return null;
    return { layer: layer, index: index, other: other };
  }

  function apply(doc, id, op) {
    var found = pair(doc, id);
    if (!found) return null;
    var selected = found.layer.shapes[found.index];
    var neighbor = found.layer.shapes[found.other];
    var front = found.index > found.other ? selected : neighbor;
    var back = found.index > found.other ? neighbor : selected;
    var mode = op === "subtract" || op === "intersect" || op === "exclude" ? op : "unite";
    var subject = mode === "subtract" ? back : selected;
    var clip = mode === "subtract" ? front : neighbor;
    var forward = combine(ringsOf(subject), ringsOf(clip), mode);
    var rings = forward;
    if (mode === "unite") {
      var backward = combine(ringsOf(clip), ringsOf(subject), "unite");
      if (backward.length && backward.length < forward.length) rings = backward;
    }
    if (!rings.length) return null;
    var keep = selected;
    var path = {
      id: keep.id,
      type: "path",
      role: keep.role || "figure",
      opacity: keep.opacity == null ? 1 : keep.opacity,
      fill: keep.fill != null ? keep.fill : (keep.role || "figure"),
      d: pathFromRings(rings)
    };
    if (rings.length > 1) path.fillRule = "evenodd";
    if (keep.stroke != null) path.stroke = keep.stroke;
    if (keep.strokeWidth != null) path.strokeWidth = keep.strokeWidth;
    var drop = found.index > found.other ? found.index : found.other;
    var stay = found.index > found.other ? found.other : found.index;
    found.layer.shapes.splice(drop, 1);
    found.layer.shapes.splice(stay, 1, path);
    return path;
  }

  root.VeloraBoolean = {
    ringsOf: ringsOf,
    combine: combine,
    apply: apply
  };
})(typeof window !== "undefined" ? window : globalThis);
