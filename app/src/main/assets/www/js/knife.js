(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function cross(ax, ay, bx, by) {
    return ax * by - ay * bx;
  }

  function segmentHit(a, b, c, d) {
    var r = [b[0] - a[0], b[1] - a[1]];
    var s = [d[0] - c[0], d[1] - c[1]];
    var den = cross(r[0], r[1], s[0], s[1]);
    var qp = [c[0] - a[0], c[1] - a[1]];
    if (Math.abs(den) < 1e-8) return null;
    var t = cross(qp[0], qp[1], s[0], s[1]) / den;
    var u = cross(qp[0], qp[1], r[0], r[1]) / den;
    if (t < 1e-4 || t > 1 - 1e-4 || u < 1e-4 || u > 1 - 1e-4) return null;
    return { t: t, u: u, p: [round(a[0] + r[0] * t), round(a[1] + r[1] * t)] };
  }

  function pointInRing(p, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i];
      var b = ring[j];
      var hit = ((a[1] > p[1]) !== (b[1] > p[1])) &&
        (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-9) + a[0]);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function pointOnStroke(stroke, along) {
    var cursor = 0;
    for (var i = 0; i < stroke.length - 1; i++) {
      var a = stroke[i];
      var b = stroke[i + 1];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
      if (cursor + 1 >= along || i === stroke.length - 2) {
        var t = Math.max(0, Math.min(1, along - cursor));
        return [round(a[0] + (b[0] - a[0]) * t), round(a[1] + (b[1] - a[1]) * t)];
      }
      cursor += 1;
    }
    return stroke[stroke.length - 1].slice();
  }

  function crossings(ring, stroke) {
    var hits = [];
    for (var s = 0; s < stroke.length - 1; s++) {
      for (var i = 0; i < ring.length; i++) {
        var hit = segmentHit(ring[i], ring[(i + 1) % ring.length], stroke[s], stroke[s + 1]);
        if (hit) hits.push({ p: hit.p, edge: i, t: hit.t, along: s + hit.u });
      }
    }
    hits.sort(function (a, b) { return a.along - b.along; });
    var unique = [];
    hits.forEach(function (hit) {
      var prev = unique[unique.length - 1];
      if (prev && Math.hypot(prev.p[0] - hit.p[0], prev.p[1] - hit.p[1]) < 0.4) return;
      unique.push(hit);
    });
    return unique;
  }

  function bridge(stroke, from, to) {
    var pts = [from.p.slice()];
    var start = Math.ceil(from.along);
    var end = Math.floor(to.along);
    for (var i = start; i <= end; i++) {
      if (i > 0 && i < stroke.length - 1) pts.push(stroke[i].slice());
    }
    pts.push(to.p.slice());
    return pts;
  }

  function forward(ring, from, to) {
    if (from.edge === to.edge && from.t <= to.t) return [from.p.slice(), to.p.slice()];
    var pts = [from.p.slice()];
    var i = (from.edge + 1) % ring.length;
    var guard = 0;
    while (guard++ <= ring.length + 1) {
      if (i === to.edge) {
        pts.push(to.p.slice());
        return pts;
      }
      pts.push(ring[i].slice());
      i = (i + 1) % ring.length;
    }
    pts.push(to.p.slice());
    return pts;
  }

  function ringPath(pts) {
    if (!pts || pts.length < 3) return "";
    return pts.map(function (p, i) {
      return (i ? "L" : "M") + round(p[0]) + " " + round(p[1]);
    }).join("") + "Z";
  }

  function splitRing(ring, stroke) {
    var hits = crossings(ring, stroke);
    if (hits.length < 2) return null;
    var pair = null;
    for (var i = 0; i < hits.length - 1; i++) {
      var mid = pointOnStroke(stroke, (hits[i].along + hits[i + 1].along) / 2);
      if (pointInRing(mid, ring)) {
        pair = [hits[i], hits[i + 1]];
        break;
      }
    }
    if (!pair) pair = [hits[0], hits[hits.length - 1]];
    var cut = bridge(stroke, pair[0], pair[1]);
    var a = forward(ring, pair[0], pair[1]).concat(cut.slice().reverse().slice(1));
    var b = forward(ring, pair[1], pair[0]).concat(cut.slice(1));
    if (a.length < 3 || b.length < 3) return null;
    return [a, b];
  }

  function asPath(keep, rings, id) {
    var path = {
      id: id,
      type: "path",
      role: keep.role || "figure",
      opacity: keep.opacity == null ? 1 : keep.opacity,
      fill: keep.fill != null ? keep.fill : (keep.role || "figure"),
      d: rings.map(ringPath).join("")
    };
    if (rings.length > 1) path.fillRule = "evenodd";
    if (keep.stroke != null) path.stroke = keep.stroke;
    if (keep.strokeWidth != null) path.strokeWidth = keep.strokeWidth;
    return path;
  }

  function centroid(ring) {
    var x = 0;
    var y = 0;
    ring.forEach(function (p) { x += p[0]; y += p[1]; });
    return [x / ring.length, y / ring.length];
  }

  function splitShape(shape, stroke) {
    if (!shape || shape.type === "text" || shape.type === "blend") return null;
    var rings = VeloraBoolean.ringsOf(shape);
    if (!rings.length) return null;
    var pieces = [];
    var holes = [];
    rings.forEach(function (ring) {
      var parts = splitRing(ring, stroke);
      if (!parts) holes.push(ring);
      else parts.forEach(function (part) { pieces.push(part); });
    });
    if (!pieces.length) return null;
    holes.forEach(function (hole) {
      var mid = centroid(hole);
      for (var i = 0; i < pieces.length; i++) {
        if (pointInRing(mid, pieces[i])) {
          pieces[i] = [pieces[i], hole];
          return;
        }
      }
    });
    return pieces.map(function (part, i) {
      var ringsOfPiece = part[0] && part[0][0] && typeof part[0][0] !== "number" ? part : [part];
      return asPath(shape, ringsOfPiece, shape.id + (i ? "-k" + i : ""));
    });
  }

  function cut(doc, stroke) {
    if (!doc || !stroke || stroke.length < 2) return null;
    var made = [];
    (doc.layers || []).forEach(function (layer) {
      if (layer.locked || layer.hidden) return;
      var next = [];
      (layer.shapes || []).forEach(function (shape) {
        var parts = splitShape(shape, stroke);
        if (!parts) {
          next.push(shape);
          return;
        }
        parts.forEach(function (part) {
          next.push(part);
          made.push(part.id);
        });
      });
      layer.shapes = next;
    });
    return made.length ? made : null;
  }

  root.VeloraKnife = { cut: cut, splitRing: splitRing };
})(typeof window !== "undefined" ? window : globalThis);
