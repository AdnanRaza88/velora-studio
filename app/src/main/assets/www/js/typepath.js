(function (root) {
  function tokens(d) {
    return String(d || "").match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  }

  function cubics(d) {
    var parts = tokens(d);
    var i = 0;
    var cmd = "";
    var cx = 0;
    var cy = 0;
    var sx = 0;
    var sy = 0;
    var segs = [];
    function num() { return parseFloat(parts[i++]); }
    while (i < parts.length) {
      if (/[A-Za-z]/.test(parts[i])) cmd = parts[i++];
      if (cmd === "M" || cmd === "m") {
        var mx = num();
        var my = num();
        if (cmd === "m") { mx += cx; my += cy; }
        cx = sx = mx;
        cy = sy = my;
        cmd = cmd === "m" ? "l" : "L";
      } else if (cmd === "L" || cmd === "l") {
        var lx = num();
        var ly = num();
        if (cmd === "l") { lx += cx; ly += cy; }
        segs.push([cx, cy, cx, cy, lx, ly, lx, ly]);
        cx = lx;
        cy = ly;
      } else if (cmd === "C" || cmd === "c") {
        var c1x = num();
        var c1y = num();
        var c2x = num();
        var c2y = num();
        var ex = num();
        var ey = num();
        if (cmd === "c") {
          c1x += cx; c1y += cy; c2x += cx; c2y += cy; ex += cx; ey += cy;
        }
        segs.push([cx, cy, c1x, c1y, c2x, c2y, ex, ey]);
        cx = ex;
        cy = ey;
      } else if (cmd === "Q" || cmd === "q") {
        var qx = num();
        var qy = num();
        var qex = num();
        var qey = num();
        if (cmd === "q") { qx += cx; qy += cy; qex += cx; qey += cy; }
        segs.push([
          cx, cy,
          cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy),
          qex + (2 / 3) * (qx - qex), qey + (2 / 3) * (qy - qey),
          qex, qey
        ]);
        cx = qex;
        cy = qey;
      } else if (cmd === "Z" || cmd === "z") {
        if (cx !== sx || cy !== sy) segs.push([cx, cy, cx, cy, sx, sy, sx, sy]);
        cx = sx;
        cy = sy;
      } else break;
    }
    return segs;
  }

  function at(seg, t) {
    var u = 1 - t;
    return {
      x: u * u * u * seg[0] + 3 * u * u * t * seg[2] + 3 * u * t * t * seg[4] + t * t * t * seg[6],
      y: u * u * u * seg[1] + 3 * u * u * t * seg[3] + 3 * u * t * t * seg[5] + t * t * t * seg[7],
      dx: 3 * u * u * (seg[2] - seg[0]) + 6 * u * t * (seg[4] - seg[2]) + 3 * t * t * (seg[6] - seg[4]),
      dy: 3 * u * u * (seg[3] - seg[1]) + 6 * u * t * (seg[5] - seg[3]) + 3 * t * t * (seg[7] - seg[5])
    };
  }

  function measure(segs) {
    var total = 0;
    var lens = segs.map(function (seg) {
      var len = 0;
      var prev = at(seg, 0);
      for (var i = 1; i <= 16; i++) {
        var p = at(seg, i / 16);
        len += Math.hypot(p.x - prev.x, p.y - prev.y);
        prev = p;
      }
      total += len;
      return len;
    });
    return { total: total, lens: lens };
  }

  function pointAt(d, t) {
    var segs = cubics(d);
    if (!segs.length) return null;
    var meta = measure(segs);
    if (meta.total < 1) return { x: segs[0][0], y: segs[0][1], angle: 0, length: 0 };
    var dist = Math.max(0, Math.min(1, t)) * meta.total;
    var acc = 0;
    for (var i = 0; i < segs.length; i++) {
      if (acc + meta.lens[i] >= dist || i === segs.length - 1) {
        var local = meta.lens[i] ? (dist - acc) / meta.lens[i] : 0;
        var p = at(segs[i], Math.max(0, Math.min(1, local)));
        return { x: p.x, y: p.y, angle: Math.atan2(p.dy, p.dx) * 180 / Math.PI, length: meta.total };
      }
      acc += meta.lens[i];
    }
    return null;
  }

  function lengthOf(d) {
    var mid = pointAt(d, 0.5);
    return mid ? mid.length : 0;
  }

  function bounds(d, pad) {
    var segs = cubics(d);
    if (!segs.length) return null;
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    segs.forEach(function (seg) {
      for (var i = 0; i <= 8; i++) {
        var p = at(seg, i / 8);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    });
    var extra = pad || 0;
    return {
      x: minX - extra,
      y: minY - extra,
      w: maxX - minX + extra * 2,
      h: maxY - minY + extra * 2,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2
    };
  }

  function placeGlyph(d, x, y, angle) {
    var parts = String(d || "").match(/[MLQHVZ]|-?\d*\.?\d+/g);
    if (!parts) return "";
    var rad = (angle || 0) * Math.PI / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);
    var out = "";
    var cmd = "";
    var pair = [];
    function emit() {
      if (pair.length < 2) return;
      var px = pair[0] * cos - pair[1] * sin + x;
      var py = pair[0] * sin + pair[1] * cos + y;
      out += Math.round(px) + " " + Math.round(py) + " ";
      pair = [];
    }
    parts.forEach(function (tok) {
      if (/[MLQHVZ]/.test(tok)) {
        emit();
        cmd = tok;
        out += tok;
        return;
      }
      var n = parseFloat(tok);
      if (cmd === "H") {
        var hx = n * cos + x;
        var hy = n * sin + y;
        out += Math.round(hx) + " " + Math.round(hy) + " ";
        cmd = "L";
      } else if (cmd === "V") {
        var vx = -n * sin + x;
        var vy = n * cos + y;
        out += Math.round(vx) + " " + Math.round(vy) + " ";
        cmd = "L";
      } else {
        pair.push(n);
        if (pair.length === 2) emit();
      }
    });
    emit();
    return out.trim();
  }

  root.VeloraTypePath = {
    pointAt: pointAt,
    lengthOf: lengthOf,
    bounds: bounds,
    placeGlyph: placeGlyph
  };
})(typeof window !== "undefined" ? window : globalThis);
