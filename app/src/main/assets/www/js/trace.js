(function (root) {
  var DX = [1, 1, 0, -1, -1, -1, 0, 1];
  var DY = [0, 1, 1, 1, 0, -1, -1, -1];

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function otsu(luma) {
    var hist = new Array(256);
    var i;
    for (i = 0; i < 256; i++) hist[i] = 0;
    for (i = 0; i < luma.length; i++) hist[luma[i]]++;
    var total = luma.length;
    var sum = 0;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0;
    var wB = 0;
    var best = 0;
    var level = 128;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB;
      var mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between >= best) {
        best = between;
        level = i;
      }
    }
    return level;
  }

  function mean(luma) {
    var s = 0;
    for (var i = 0; i < luma.length; i++) s += luma[i];
    return luma.length ? s / luma.length : 128;
  }

  function blur3(luma, w, h) {
    var out = new Uint8Array(luma.length);
    var y, x, sy, sx, sum, n, yy, xx;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        sum = 0;
        n = 0;
        for (sy = -1; sy <= 1; sy++) {
          yy = y + sy;
          if (yy < 0 || yy >= h) continue;
          for (sx = -1; sx <= 1; sx++) {
            xx = x + sx;
            if (xx < 0 || xx >= w) continue;
            sum += luma[yy * w + xx];
            n++;
          }
        }
        out[y * w + x] = (sum / n) | 0;
      }
    }
    return out;
  }

  function inkMask(luma, level, invert) {
    var mask = new Uint8Array(luma.length);
    for (var i = 0; i < luma.length; i++) {
      var dark = luma[i] <= level;
      mask[i] = invert ? (dark ? 0 : 1) : (dark ? 1 : 0);
    }
    return mask;
  }

  function despeckle(mask, w, h, turd) {
    var out = new Uint8Array(mask);
    var seen = new Uint8Array(mask.length);
    var y, x, i, stack, area, cells, cx, cy, nx, ny, k, idx;
    var N8X = [1, 1, 0, -1, -1, -1, 0, 1];
    var N8Y = [0, 1, 1, 1, 0, -1, -1, -1];
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i] || seen[i]) continue;
        stack = [[x, y]];
        seen[i] = 1;
        area = 0;
        cells = [];
        while (stack.length) {
          var c = stack.pop();
          cx = c[0];
          cy = c[1];
          cells.push(c);
          area++;
          for (k = 0; k < 8; k++) {
            nx = cx + N8X[k];
            ny = cy + N8Y[k];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            idx = ny * w + nx;
            if (!mask[idx] || seen[idx]) continue;
            seen[idx] = 1;
            stack.push([nx, ny]);
          }
        }
        if (area < turd) {
          for (k = 0; k < cells.length; k++) {
            out[cells[k][1] * w + cells[k][0]] = 0;
          }
        }
      }
    }
    return out;
  }

  function on(mask, w, h, x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return mask[y * w + x];
  }

  function walk(mask, w, h, sx, sy) {
    var pts = [];
    var x = sx;
    var y = sy;
    var prev = 6;
    var guard = 0;
    var limit = w * h * 2;
    do {
      pts.push([x, y]);
      var found = false;
      var k;
      for (k = 0; k < 8; k++) {
        var d = (prev + 5 + k) & 7;
        var nx = x + DX[d];
        var ny = y + DY[d];
        if (on(mask, w, h, nx, ny)) {
          prev = d;
          x = nx;
          y = ny;
          found = true;
          break;
        }
      }
      if (!found) break;
      guard++;
    } while ((x !== sx || y !== sy) && guard < limit);
    if (x === sx && y === sy && pts.length > 2) pts.push([sx, sy]);
    return pts;
  }

  function distPointSeg(p, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function rdp(points, eps) {
    if (points.length < 3) return points.slice();
    var max = 0;
    var index = 0;
    var end = points.length - 1;
    var i;
    for (i = 1; i < end; i++) {
      var d = distPointSeg(points[i], points[0], points[end]);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (max > eps) {
      var left = rdp(points.slice(0, index + 1), eps);
      var right = rdp(points.slice(index), eps);
      return left.slice(0, -1).concat(right);
    }
    return [points[0], points[end]];
  }

  function area(points) {
    var a = 0;
    for (var i = 0; i < points.length - 1; i++) {
      a += points[i][0] * points[i + 1][1] - points[i + 1][0] * points[i][1];
    }
    return Math.abs(a) / 2;
  }

  function chaikin(points, rounds) {
    if (points.length < 3) return points.slice();
    var pts = points.slice();
    var closed = pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1];
    if (closed) pts = pts.slice(0, -1);
    var r, i, next, a, b;
    for (r = 0; r < rounds; r++) {
      next = [];
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        b = pts[(i + 1) % pts.length];
        next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      pts = next;
    }
    if (closed && pts.length) pts.push([pts[0][0], pts[0][1]]);
    return pts;
  }

  function toPath(points, ox, oy, scale, smooth) {
    if (points.length < 3) return "";
    var pts = smooth ? chaikin(points, 1) : points;
    if (pts.length < 3) pts = points;
    var parts = [];
    var i, x, y, x1, y1, x2, y2;
    if (pts.length >= 4 && smooth) {
      x = round1(ox + pts[0][0] * scale);
      y = round1(oy + pts[0][1] * scale);
      parts.push("M" + x + " " + y);
      for (i = 1; i < pts.length - 2; i += 2) {
        x1 = round1(ox + pts[i][0] * scale);
        y1 = round1(oy + pts[i][1] * scale);
        x2 = round1(ox + pts[Math.min(i + 1, pts.length - 1)][0] * scale);
        y2 = round1(oy + pts[Math.min(i + 1, pts.length - 1)][1] * scale);
        parts.push("Q" + x1 + " " + y1 + " " + x2 + " " + y2);
      }
      parts.push("Z");
    } else {
      for (i = 0; i < pts.length; i++) {
        x = round1(ox + pts[i][0] * scale);
        y = round1(oy + pts[i][1] * scale);
        parts.push((i === 0 ? "M" : "L") + x + " " + y);
      }
      parts.push("Z");
    }
    return parts.join(" ");
  }

  function contours(mask, w, h, maxContours) {
    var seen = new Uint8Array(mask.length);
    var found = [];
    var y, x, i, raw, p, px, py;
    var limit = maxContours || 48;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i] || seen[i]) continue;
        if (on(mask, w, h, x - 1, y)) continue;
        raw = walk(mask, w, h, x, y);
        for (p = 0; p < raw.length; p++) {
          px = raw[p][0];
          py = raw[p][1];
          if (px >= 0 && py >= 0 && px < w && py < h) seen[py * w + px] = 1;
        }
        if (raw.length >= 6) found.push(raw);
        if (found.length >= limit) return found;
      }
    }
    return found;
  }

  function fromLuma(width, height, luma, options) {
    var w = width | 0;
    var h = height | 0;
    if (!w || !h || !luma || luma.length < w * h) {
      return { ok: false, error: "empty raster" };
    }
    var opts = options || {};
    var bytes = luma.length === w * h ? luma : luma.subarray(0, w * h);
    if (opts.blur !== false) bytes = blur3(bytes, w, h);
    var level = opts.threshold != null ? (opts.threshold | 0) : otsu(bytes);
    var invert = opts.invert != null ? !!opts.invert : mean(bytes) < 96;
    var mask = inkMask(bytes, level, invert);
    var turd = opts.turdsize != null ? opts.turdsize : Math.max(4, Math.round((w * h) / 12000));
    mask = despeckle(mask, w, h, turd);
    var raw = contours(mask, w, h, opts.maxContours || 48);
    var eps = opts.epsilon != null ? opts.epsilon : Math.max(0.9, Math.min(2.4, Math.max(w, h) / 180));
    var minArea = opts.minArea != null ? opts.minArea : Math.max(8, (w * h) / 8000);
    var simplified = [];
    var i, slim;
    for (i = 0; i < raw.length; i++) {
      slim = rdp(raw[i], eps);
      if (slim.length >= 4 && area(slim) >= minArea) simplified.push(slim);
    }
    simplified.sort(function (a, b) { return area(b) - area(a); });
    simplified = simplified.slice(0, opts.maxShapes || 16);
    var edge = Math.max(w, h);
    var scale = 1024 / edge;
    var ox = (1024 - w * scale) / 2;
    var oy = (1024 - h * scale) / 2;
    var smooth = opts.smooth !== false;
    var shapes = [];
    for (i = 0; i < simplified.length; i++) {
      var d = toPath(simplified[i], ox, oy, scale, smooth);
      if (!d) continue;
      shapes.push({
        id: "trace-" + (i + 1),
        type: "path",
        role: i === 0 ? "figure" : "accent",
        fill: "figure",
        fillRule: "evenodd",
        d: d
      });
    }
    if (!shapes.length) return { ok: false, error: "no contours" };
    return {
      ok: true,
      viewBox: [0, 0, 1024, 1024],
      threshold: level,
      invert: invert,
      turdsize: turd,
      contours: shapes.length,
      shapes: shapes
    };
  }

  function decodeLuma(b64) {
    var raw = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i) & 255;
    return out;
  }

  function fromRaster(payload, options) {
    if (!payload || !payload.ok) return { ok: false, error: (payload && payload.error) || "missing raster" };
    return fromLuma(payload.width, payload.height, decodeLuma(payload.luma), options);
  }

  function fromImage(img, done, options) {
    var opts = options || {};
    var maxEdge = opts.maxEdge || 384;
    var sw = img.naturalWidth || img.width;
    var sh = img.naturalHeight || img.height;
    if (!sw || !sh) {
      done({ ok: false, error: "unreadable" });
      return;
    }
    var scale = Math.min(1, maxEdge / Math.max(sw, sh));
    var w = Math.max(1, Math.round(sw * scale));
    var h = Math.max(1, Math.round(sh * scale));
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;
    var luma = new Uint8Array(w * h);
    for (var i = 0; i < luma.length; i++) {
      var o = i * 4;
      luma[i] = (data[o] * 54 + data[o + 1] * 183 + data[o + 2] * 19) >> 8;
    }
    done(fromLuma(w, h, luma, opts));
  }

  function documentFrom(trace, brief, name) {
    return {
      vxl: 1,
      meta: {
        name: name || "Trace",
        category: "illustration",
        skill: "character",
        purpose: "trace",
        brief: brief || "Autotrace"
      },
      canvas: { viewBox: trace.viewBox, units: "px" },
      palette: { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" },
      layers: [{ id: "trace", name: "Trace", visible: true, opacity: 1, shapes: trace.shapes }]
    };
  }

  root.VeloraTrace = {
    fromLuma: fromLuma,
    fromRaster: fromRaster,
    fromImage: fromImage,
    documentFrom: documentFrom,
    decodeLuma: decodeLuma
  };
})(typeof window !== "undefined" ? window : globalThis);
