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

  function inkMask(luma, level, invert) {
    var mask = new Uint8Array(luma.length);
    for (var i = 0; i < luma.length; i++) {
      var dark = luma[i] <= level;
      mask[i] = invert ? (dark ? 0 : 1) : (dark ? 1 : 0);
    }
    return mask;
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

  function toPath(points, ox, oy, scale) {
    if (points.length < 3) return "";
    var parts = [];
    for (var i = 0; i < points.length; i++) {
      var x = round1(ox + points[i][0] * scale);
      var y = round1(oy + points[i][1] * scale);
      parts.push((i === 0 ? "M" : "L") + x + " " + y);
    }
    parts.push("Z");
    return parts.join(" ");
  }

  function contours(mask, w, h) {
    var seen = new Uint8Array(mask.length);
    var found = [];
    var y;
    var x;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var i = y * w + x;
        if (!mask[i] || seen[i]) continue;
        if (on(mask, w, h, x - 1, y)) continue;
        var raw = walk(mask, w, h, x, y);
        var p;
        for (p = 0; p < raw.length; p++) {
          var px = raw[p][0];
          var py = raw[p][1];
          if (px >= 0 && py >= 0 && px < w && py < h) seen[py * w + px] = 1;
        }
        if (raw.length >= 4) found.push(raw);
        if (found.length >= 24) return found;
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
    var bytes = luma.length === w * h ? luma : luma.subarray(0, w * h);
    var level = otsu(bytes);
    var invert = mean(bytes) < 96;
    if (options && options.invert != null) invert = !!options.invert;
    var mask = inkMask(bytes, level, invert);
    var raw = contours(mask, w, h);
    var eps = options && options.epsilon ? options.epsilon : 1.35;
    var simplified = [];
    var i;
    for (i = 0; i < raw.length; i++) {
      var slim = rdp(raw[i], eps);
      if (slim.length >= 4 && area(slim) >= 6) simplified.push(slim);
    }
    simplified.sort(function (a, b) { return area(b) - area(a); });
    simplified = simplified.slice(0, 8);
    var edge = Math.max(w, h);
    var scale = 1024 / edge;
    var ox = (1024 - w * scale) / 2;
    var oy = (1024 - h * scale) / 2;
    var shapes = [];
    for (i = 0; i < simplified.length; i++) {
      var d = toPath(simplified[i], ox, oy, scale);
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

  function fromRaster(payload) {
    if (!payload || !payload.ok) return { ok: false, error: (payload && payload.error) || "missing raster" };
    return fromLuma(payload.width, payload.height, decodeLuma(payload.luma));
  }

  function fromImage(img, done) {
    var maxEdge = 96;
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
    done(fromLuma(w, h, luma));
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
