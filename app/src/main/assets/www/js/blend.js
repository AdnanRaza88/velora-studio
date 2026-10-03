(function (root) {
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function clampSteps(n) {
    return Math.max(3, Math.min(24, Math.round(num(n, 5))));
  }

  function ringsOf(shape) {
    if (!shape || !root.VeloraBoolean) return [];
    return root.VeloraBoolean.ringsOf(shape);
  }

  function centroid(ring) {
    var x = 0;
    var y = 0;
    if (!ring.length) return [0, 0];
    ring.forEach(function (p) {
      x += p[0];
      y += p[1];
    });
    return [x / ring.length, y / ring.length];
  }

  function resample(ring, count) {
    if (!ring || ring.length < 2) return [];
    var segs = [];
    var total = 0;
    for (var i = 0; i < ring.length; i++) {
      var a = ring[i];
      var b = ring[(i + 1) % ring.length];
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segs.push({ a: a, b: b, len: len, start: total });
      total += len;
    }
    if (total < 1e-6) return ring.slice(0, count);
    var out = [];
    for (var k = 0; k < count; k++) {
      var dist = (total * k) / count;
      var seg = segs[segs.length - 1];
      for (var s = 0; s < segs.length; s++) {
        if (dist <= segs[s].start + segs[s].len) {
          seg = segs[s];
          break;
        }
      }
      var u = seg.len < 1e-6 ? 0 : (dist - seg.start) / seg.len;
      out.push([seg.a[0] + (seg.b[0] - seg.a[0]) * u, seg.a[1] + (seg.b[1] - seg.a[1]) * u]);
    }
    return out;
  }

  function align(base, other) {
    if (!other.length) return other;
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < other.length; i++) {
      var dx = other[i][0] - base[0][0];
      var dy = other[i][1] - base[0][1];
      var d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    var rot = other.slice(best).concat(other.slice(0, best));
    var rev = other.slice(0, best + 1).reverse().concat(other.slice(best + 1).reverse());
    function gap(ring) {
      var g = 0;
      for (var j = 0; j < ring.length; j++) {
        g += Math.hypot(ring[j][0] - base[j][0], ring[j][1] - base[j][1]);
      }
      return g;
    }
    return gap(rev) < gap(rot) ? rev : rot;
  }

  function hexOf(fill, palette) {
    if (fill && palette && palette[fill]) return palette[fill];
    if (typeof fill === "string" && /^#[0-9a-fA-F]{6}$/.test(fill)) return fill.toLowerCase();
    if (typeof fill === "string" && /^#[0-9a-fA-F]{3}$/.test(fill)) {
      return "#" + fill[1] + fill[1] + fill[2] + fill[2] + fill[3] + fill[3];
    }
    return (palette && palette.figure) || "#1e1b16";
  }

  function mix(a, b, t) {
    function ch(i) {
      return Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
    }
    function h(n) {
      return ("0" + n.toString(16)).slice(-2);
    }
    return "#" + h(ch(1)) + h(ch(3)) + h(ch(5));
  }

  function pathOf(ring) {
    return ring.map(function (p, i) {
      return (i ? "L" : "M") + round(p[0]) + " " + round(p[1]);
    }).join("") + "Z";
  }

  function tokens(d) {
    return String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
  }

  function spinePoints(d) {
    var parts = tokens(d);
    var i = 0;
    var cmd = "";
    var x = 0;
    var y = 0;
    var pts = [];
    function take() { return parseFloat(parts[i++]); }
    function isCmd(t) { return /[A-Za-z]/.test(t); }
    function push(px, py) { pts.push([px, py]); }
    while (i < parts.length) {
      if (isCmd(parts[i])) cmd = parts[i++];
      var rel = cmd === cmd.toLowerCase();
      var op = cmd.toUpperCase();
      if (op === "Z" || op === "M" || op === "L") {
        if (op === "Z") continue;
        var px = take();
        var py = take();
        if (rel) { px += x; py += y; }
        x = px;
        y = py;
        push(x, y);
        continue;
      }
      if (op === "C") {
        take(); take(); take(); take();
        var cx = take();
        var cy = take();
        if (rel) { cx += x; cy += y; }
        x = cx;
        y = cy;
        push(x, y);
        continue;
      }
      if (op === "Q") {
        take(); take();
        var ex = take();
        var ey = take();
        if (rel) { ex += x; ey += y; }
        x = ex;
        y = ey;
        push(x, y);
        continue;
      }
      break;
    }
    return pts;
  }

  function pointAt(pts, t) {
    if (!pts.length) return [0, 0];
    if (pts.length === 1) return pts[0];
    var lens = [0];
    var total = 0;
    for (var i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(total);
    }
    if (total < 1e-6) return pts[0];
    var dist = total * t;
    for (var s = 1; s < pts.length; s++) {
      if (dist <= lens[s] || s === pts.length - 1) {
        var span = lens[s] - lens[s - 1] || 1;
        var u = (dist - lens[s - 1]) / span;
        return [
          pts[s - 1][0] + (pts[s][0] - pts[s - 1][0]) * u,
          pts[s - 1][1] + (pts[s][1] - pts[s - 1][1]) * u
        ];
      }
    }
    return pts[pts.length - 1];
  }

  function stepsOf(shape, palette) {
    var count = clampSteps(shape.steps);
    var fromRings = ringsOf(shape.from);
    var toRings = ringsOf(shape.to);
    var nRings = Math.max(fromRings.length, toRings.length);
    var samples = 48;
    var prepared = [];
    for (var r = 0; r < nRings; r++) {
      var a = resample(fromRings[r] || toRings[r] || [], samples);
      var b = resample(toRings[r] || fromRings[r] || [], samples);
      if (a.length && b.length) prepared.push([a, align(a, b)]);
    }
    if (!prepared.length) return [];
    var fromFill = hexOf(shape.from && (shape.from.fill || shape.from.role), palette);
    var toFill = hexOf(shape.to && (shape.to.fill || shape.to.role), palette);
    var spine = shape.spine ? spinePoints(shape.spine) : [];
    var startC = centroid(prepared[0][0]);
    var endC = centroid(prepared[0][1]);
    var out = [];
    for (var s = 0; s < count; s++) {
      var t = count === 1 ? 0 : s / (count - 1);
      var rings = prepared.map(function (pair) {
        return pair[0].map(function (p, i) {
          return [
            p[0] + (pair[1][i][0] - p[0]) * t,
            p[1] + (pair[1][i][1] - p[1]) * t
          ];
        });
      });
      if (spine.length >= 2) {
        var ride = pointAt(spine, t);
        var base = [startC[0] + (endC[0] - startC[0]) * t, startC[1] + (endC[1] - startC[1]) * t];
        var dx = ride[0] - base[0];
        var dy = ride[1] - base[1];
        rings = rings.map(function (ring) {
          return ring.map(function (p) { return [p[0] + dx, p[1] + dy]; });
        });
      }
      out.push({
        id: (shape.id || "blend") + "_" + s,
        type: "path",
        role: shape.role || "figure",
        fill: mix(fromFill, toFill, t),
        opacity: num(shape.from && shape.from.opacity, 1) * (1 - t) + num(shape.to && shape.to.opacity, 1) * t,
        fillRule: rings.length > 1 ? "evenodd" : "nonzero",
        d: rings.map(pathOf).join("")
      });
    }
    return out;
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

  function clone(shape) {
    return JSON.parse(JSON.stringify(shape));
  }

  function apply(doc, id, steps, spine) {
    var found = pair(doc, id);
    if (!found) return null;
    var selected = found.layer.shapes[found.index];
    var neighbor = found.layer.shapes[found.other];
    if (selected.type === "blend" || neighbor.type === "blend") return null;
    var back = found.index > found.other ? neighbor : selected;
    var front = found.index > found.other ? selected : neighbor;
    var node = {
      id: selected.id,
      type: "blend",
      role: selected.role || "figure",
      opacity: 1,
      steps: clampSteps(steps),
      from: clone(back),
      to: clone(front)
    };
    if (spine) node.spine = spine;
    var drop = found.index > found.other ? found.index : found.other;
    var stay = found.index > found.other ? found.other : found.index;
    found.layer.shapes.splice(drop, 1);
    found.layer.shapes.splice(stay, 1, node);
    return node;
  }

  function expand(doc, id, palette) {
    var layer = null;
    var index = -1;
    (doc.layers || []).forEach(function (item) {
      (item.shapes || []).forEach(function (shape, i) {
        if (shape.id === id && shape.type === "blend") {
          layer = item;
          index = i;
        }
      });
    });
    if (!layer || layer.locked || index < 0) return null;
    var node = layer.shapes[index];
    var kids = stepsOf(node, palette || (doc && doc.palette) || {});
    if (!kids.length) return null;
    var group = {
      id: node.id,
      type: "group",
      role: node.role || "figure",
      opacity: 1,
      children: kids
    };
    layer.shapes.splice(index, 1, group);
    return group;
  }

  root.VeloraBlend = {
    stepsOf: stepsOf,
    apply: apply,
    expand: expand
  };
})(typeof window !== "undefined" ? window : globalThis);
