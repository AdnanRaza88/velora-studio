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

  function median3(luma, w, h) {
    var out = new Uint8Array(luma.length);
    var y, x, sy, sx, yy, xx, n, buf, k, a, b, tmp;
    buf = new Array(9);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        n = 0;
        for (sy = -1; sy <= 1; sy++) {
          yy = y + sy;
          if (yy < 0 || yy >= h) continue;
          for (sx = -1; sx <= 1; sx++) {
            xx = x + sx;
            if (xx < 0 || xx >= w) continue;
            buf[n++] = luma[yy * w + xx];
          }
        }
        for (a = 1; a < n; a++) {
          tmp = buf[a];
          b = a;
          while (b > 0 && buf[b - 1] > tmp) {
            buf[b] = buf[b - 1];
            b--;
          }
          buf[b] = tmp;
        }
        out[y * w + x] = buf[n >> 1];
      }
    }
    return out;
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

  function borderTone(luma, w, h) {
    var stepX = Math.max(1, (w / 18) | 0);
    var stepY = Math.max(1, (h / 18) | 0);
    var n = 0;
    var light = 0;
    var dark = 0;
    var x, y, v;
    for (x = 0; x < w; x += stepX) {
      v = luma[x];
      if (v >= 214) light++;
      if (v <= 42) dark++;
      v = luma[(h - 1) * w + x];
      if (v >= 214) light++;
      if (v <= 42) dark++;
      n += 2;
    }
    for (y = 0; y < h; y += stepY) {
      v = luma[y * w];
      if (v >= 214) light++;
      if (v <= 42) dark++;
      v = luma[y * w + w - 1];
      if (v >= 214) light++;
      if (v <= 42) dark++;
      n += 2;
    }
    return { light: n ? light / n : 0, dark: n ? dark / n : 0 };
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
          for (k = 0; k < cells.length; k++) out[cells[k][1] * w + cells[k][0]] = 0;
        }
      }
    }
    return out;
  }

  function markExterior(mask, w, h) {
    var ext = new Uint8Array(mask.length);
    var stack = [];
    var x, y, i;
    function push(px, py) {
      if (px < 0 || py < 0 || px >= w || py >= h) return;
      var idx = py * w + px;
      if (mask[idx] || ext[idx]) return;
      ext[idx] = 1;
      stack.push(idx);
    }
    for (x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    while (stack.length) {
      i = stack.pop();
      x = i % w;
      y = (i / w) | 0;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }
    return ext;
  }

  function fillSmallHoles(mask, w, h, turd) {
    var ext = markExterior(mask, w, h);
    var seen = new Uint8Array(mask.length);
    var out = new Uint8Array(mask);
    var y, x, i, stack, area, cells, cx, cy, nx, ny, k, idx;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (mask[i] || ext[i] || seen[i]) continue;
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
          for (k = 0; k < 4; k++) {
            nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
            ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            idx = ny * w + nx;
            if (mask[idx] || ext[idx] || seen[idx]) continue;
            seen[idx] = 1;
            stack.push([nx, ny]);
          }
        }
        if (area < turd) {
          for (k = 0; k < cells.length; k++) out[cells[k][1] * w + cells[k][0]] = 1;
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

  function centroid(points) {
    var n = points.length;
    if (n > 1 && points[0][0] === points[n - 1][0] && points[0][1] === points[n - 1][1]) n--;
    var sx = 0;
    var sy = 0;
    var i;
    for (i = 0; i < n; i++) {
      sx += points[i][0];
      sy += points[i][1];
    }
    return n ? [sx / n, sy / n] : [0, 0];
  }

  function inside(points, p) {
    var n = points.length;
    if (n > 1 && points[0][0] === points[n - 1][0] && points[0][1] === points[n - 1][1]) n--;
    var hit = false;
    var i, j, xi, yi, xj, yj;
    for (i = 0, j = n - 1; i < n; j = i++) {
      xi = points[i][0];
      yi = points[i][1];
      xj = points[j][0];
      yj = points[j][1];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / ((yj - yi) || 1e-9) + xi) hit = !hit;
    }
    return hit;
  }

  function contours(mask, w, h, maxContours) {
    var seen = new Uint8Array(mask.length);
    var found = [];
    var y, x, i, raw, p, px, py;
    var limit = maxContours || 64;
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

  function holeContours(mask, w, h, maxHoles) {
    var ext = markExterior(mask, w, h);
    var seen = new Uint8Array(mask.length);
    var found = [];
    var y, x, i, stack, cells, cx, cy, nx, ny, k, idx, local, raw, sx, sy;
    var limit = maxHoles || 24;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (mask[i] || ext[i] || seen[i]) continue;
        stack = [[x, y]];
        seen[i] = 1;
        cells = [];
        sx = x;
        sy = y;
        while (stack.length) {
          var c = stack.pop();
          cx = c[0];
          cy = c[1];
          cells.push(c);
          if (cx < sx) {
            sx = cx;
            sy = cy;
          }
          for (k = 0; k < 4; k++) {
            nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0);
            ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            idx = ny * w + nx;
            if (mask[idx] || ext[idx] || seen[idx]) continue;
            seen[idx] = 1;
            stack.push([nx, ny]);
          }
        }
        if (cells.length < 8) continue;
        local = new Uint8Array(w * h);
        for (k = 0; k < cells.length; k++) local[cells[k][1] * w + cells[k][0]] = 1;
        raw = walk(local, w, h, sx, sy);
        if (raw.length >= 6) found.push(raw);
        if (found.length >= limit) return found;
      }
    }
    return found;
  }

  function norm(x, y) {
    var l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }

  function tangentAt(pts, i) {
    var a = pts[Math.max(0, i - 1)];
    var b = pts[Math.min(pts.length - 1, i + 1)];
    if (a[0] === b[0] && a[1] === b[1] && pts.length > 2) {
      a = pts[Math.max(0, i - 2)];
      b = pts[Math.min(pts.length - 1, i + 2)];
    }
    return norm(b[0] - a[0], b[1] - a[1]);
  }

  function bezier(p0, p1, p2, p3, t) {
    var u = 1 - t;
    var c0 = u * u * u;
    var c1 = 3 * u * u * t;
    var c2 = 3 * u * t * t;
    var c3 = t * t * t;
    return [
      c0 * p0[0] + c1 * p1[0] + c2 * p2[0] + c3 * p3[0],
      c0 * p0[1] + c1 * p1[1] + c2 * p2[1] + c3 * p3[1]
    ];
  }

  function guessCubic(pts, scale) {
    var a = pts[0];
    var b = pts[pts.length - 1];
    var t1 = tangentAt(pts, 0);
    var t2 = tangentAt(pts, pts.length - 1);
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    var alpha = chord * (scale != null ? scale : 1 / 3);
    return [a, [a[0] + t1[0] * alpha, a[1] + t1[1] * alpha], [b[0] - t2[0] * alpha, b[1] - t2[1] * alpha], b];
  }

  function fitCubic(pts) {
    var scales = [0.18, 0.28, 0.34, 0.45, 0.58];
    var best = guessCubic(pts, scales[2]);
    var bestErr = cubicError(pts, best).max;
    var i, cubic, err;
    for (i = 0; i < scales.length; i++) {
      cubic = guessCubic(pts, scales[i]);
      err = cubicError(pts, cubic).max;
      if (err < bestErr) {
        bestErr = err;
        best = cubic;
      }
    }
    return best;
  }

  function cubicError(pts, cubic) {
    var max = 0;
    var at = 1;
    var i, p, d, t;
    for (i = 1; i < pts.length - 1; i++) {
      t = i / (pts.length - 1);
      p = bezier(cubic[0], cubic[1], cubic[2], cubic[3], t);
      d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]);
      if (d > max) {
        max = d;
        at = i;
      }
    }
    return { max: max, at: at };
  }

  function fitSpan(pts, tol, depth) {
    if (pts.length < 3) return [{ k: "L", p: pts[pts.length - 1] }];
    var cubic = fitCubic(pts);
    var err = cubicError(pts, cubic);
    if (err.max <= tol || depth > 5 || pts.length < 5) return [{ k: "C", c: cubic }];
    var mid = err.at;
    if (mid < 2 || mid > pts.length - 3) mid = (pts.length / 2) | 0;
    return fitSpan(pts.slice(0, mid + 1), tol, depth + 1).concat(fitSpan(pts.slice(mid), tol, depth + 1));
  }

  function turnAt(a, b, c) {
    var v1x = b[0] - a[0];
    var v1y = b[1] - a[1];
    var v2x = c[0] - b[0];
    var v2y = c[1] - b[1];
    return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
  }

  function fitContour(points, alphamax, opttolerance) {
    var ring = points.slice();
    var closed = ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
    if (closed) ring = ring.slice(0, -1);
    if (ring.length < 3) return null;
    var limit = alphamax;
    var corners = [];
    var i, a, b, c;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      if (turnAt(a, b, c) >= limit) corners.push(i);
    }
    if (!corners.length) corners.push(0);
    var segs = [];
    var start = ring[corners[0]];
    for (i = 0; i < corners.length; i++) {
      var from = corners[i];
      var to = corners[(i + 1) % corners.length];
      var span = [];
      var guard = 0;
      var idx = from;
      span.push(ring[idx]);
      do {
        idx = (idx + 1) % ring.length;
        span.push(ring[idx]);
        guard++;
      } while (idx !== to && guard <= ring.length);
      if (span.length < 2) continue;
      if (span.length < 4) segs.push({ k: "L", p: span[span.length - 1] });
      else segs = segs.concat(fitSpan(span, opttolerance, 0));
    }
    return { start: start, segs: segs };
  }

  function xy(p, ox, oy, scale) {
    return round1(ox + p[0] * scale) + " " + round1(oy + p[1] * scale);
  }

  function toPath(points, ox, oy, scale, opts) {
    if (points.length < 3) return "";
    if (opts && opts.smooth === false) {
      var line = [];
      var i;
      for (i = 0; i < points.length; i++) line.push((i === 0 ? "M" : "L") + xy(points[i], ox, oy, scale));
      line.push("Z");
      return line.join(" ");
    }
    var alphamax = opts && opts.alphamax != null ? opts.alphamax : 0.95;
    var opttolerance = opts && opts.opttolerance != null ? opts.opttolerance : 0.55;
    var fit = fitContour(points, alphamax, opttolerance);
    if (!fit || !fit.segs.length) return "";
    var parts = ["M" + xy(fit.start, ox, oy, scale)];
    for (var s = 0; s < fit.segs.length; s++) {
      var seg = fit.segs[s];
      if (seg.k === "C") {
        parts.push("C" + xy(seg.c[1], ox, oy, scale) + " " + xy(seg.c[2], ox, oy, scale) + " " + xy(seg.c[3], ox, oy, scale));
      } else {
        parts.push("L" + xy(seg.p, ox, oy, scale));
      }
    }
    parts.push("Z");
    return parts.join(" ");
  }

  function closedRing(points) {
    var ring = points.slice();
    var closed = ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
    if (closed) ring = ring.slice(0, -1);
    return { ring: ring, closed: closed };
  }

  function settle(points, mask, w, h) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var out = [];
    var i, x, y, ox, oy, n, k, nx, ny;
    for (i = 0; i < ring.length; i++) {
      x = ring[i][0];
      y = ring[i][1];
      ox = 0;
      oy = 0;
      n = 0;
      for (k = 0; k < 4; k++) {
        nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
        ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (on(mask, w, h, nx, ny)) continue;
        ox += nx - x;
        oy += ny - y;
        n++;
      }
      if (!n) out.push([x, y]);
      else out.push([x + (ox / n) * 0.45, y + (oy / n) * 0.45]);
    }
    if (pack.closed && out.length) out.push(out[0].slice());
    return out;
  }

  function smoothChain(points, corner) {
    var pack = closedRing(points);
    var ring = pack.ring;
    if (ring.length < 5) return points.slice();
    var limit = corner != null ? corner : 0.95;
    var out = [];
    var i, a, b, c, turn;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      turn = turnAt(a, b, c);
      if (turn >= limit) out.push(b.slice());
      else out.push([(a[0] + b[0] * 2 + c[0]) / 4, (a[1] + b[1] * 2 + c[1]) / 4]);
    }
    if (pack.closed && out.length) out.push(out[0].slice());
    return out;
  }

  function prepare(raw, mask, w, h, corner) {
    var settled = [];
    var i;
    for (i = 0; i < raw.length; i++) settled.push(smoothChain(settle(raw[i], mask, w, h), corner));
    return settled;
  }

  function simplify(raw, eps, minArea) {
    var out = [];
    var i, slim;
    for (i = 0; i < raw.length; i++) {
      slim = rdp(raw[i], eps);
      if (slim.length >= 4 && area(slim) >= minArea) out.push(slim);
    }
    return out;
  }

  function hexOf(r, g, b) {
    function byte(n) {
      var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return s.length === 1 ? "0" + s : s;
    }
    return "#" + byte(r) + byte(g) + byte(b);
  }

  function paperPixel(r, g, b) {
    var hi = r > g ? r : g;
    if (b > hi) hi = b;
    var lo = r < g ? r : g;
    if (b < lo) lo = b;
    return hi >= 234 && hi - lo < 20;
  }

  function colorDist2(a, b) {
    var dr = a[0] - b[0];
    var dg = a[1] - b[1];
    var db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function quantizeInks(rgb, w, h) {
    var n = w * h;
    var stride = Math.max(1, (n / 3200) | 0);
    var samples = [];
    var i, o, r, g, b, c, s, best, bestD, d, iter, sum, cnt;
    for (i = 0; i < n; i += stride) {
      o = i * 3;
      r = rgb[o];
      g = rgb[o + 1];
      b = rgb[o + 2];
      if (paperPixel(r, g, b)) continue;
      samples.push([r, g, b]);
    }
    if (samples.length < 16) return [];
    var k = 4;
    var centers = [samples[(samples.length / 3) | 0].slice()];
    var far, farD;
    while (centers.length < k) {
      far = 0;
      farD = -1;
      for (s = 0; s < samples.length; s++) {
        bestD = 1e12;
        for (c = 0; c < centers.length; c++) {
          d = colorDist2(samples[s], centers[c]);
          if (d < bestD) bestD = d;
        }
        if (bestD > farD) {
          farD = bestD;
          far = s;
        }
      }
      if (farD < 40 * 40) break;
      centers.push(samples[far].slice());
    }
    for (iter = 0; iter < 6; iter++) {
      sum = [];
      cnt = [];
      for (c = 0; c < centers.length; c++) {
        sum.push([0, 0, 0]);
        cnt.push(0);
      }
      for (s = 0; s < samples.length; s++) {
        best = 0;
        bestD = 1e12;
        for (c = 0; c < centers.length; c++) {
          d = colorDist2(samples[s], centers[c]);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        sum[best][0] += samples[s][0];
        sum[best][1] += samples[s][1];
        sum[best][2] += samples[s][2];
        cnt[best]++;
      }
      for (c = 0; c < centers.length; c++) {
        if (!cnt[c]) continue;
        centers[c] = [sum[c][0] / cnt[c], sum[c][1] / cnt[c], sum[c][2] / cnt[c]];
      }
    }
    var kept = [];
    for (c = 0; c < centers.length; c++) {
      best = false;
      for (s = 0; s < kept.length; s++) {
        if (colorDist2(centers[c], kept[s]) < 34 * 34) best = true;
      }
      if (!best) kept.push(centers[c]);
    }
    return kept.slice(0, 4);
  }

  function dilate(mask, w, h) {
    var out = new Uint8Array(mask);
    var y, x, i;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i]) continue;
        if (x + 1 < w) out[i + 1] = 1;
        if (x > 0) out[i - 1] = 1;
        if (y + 1 < h) out[i + w] = 1;
        if (y > 0) out[i - w] = 1;
      }
    }
    return out;
  }

  function shapesFromMask(mask, w, h, opts, job, idBase) {
    var turd = opts.turdsize != null ? opts.turdsize : Math.max(6, Math.round((w * h) / 14000));
    var ink = despeckle(mask, w, h, turd);
    ink = fillSmallHoles(ink, w, h, turd);
    ink = dilate(ink, w, h);
    var raw = prepare(contours(ink, w, h, opts.maxContours || 16), ink, w, h, opts.alphamax);
    var holes = prepare(holeContours(ink, w, h, opts.maxHoles || 12), ink, w, h, opts.alphamax);
    var eps = opts.epsilon != null ? opts.epsilon : Math.max(0.75, Math.min(1.7, Math.max(w, h) / 280));
    var minArea = opts.minArea != null ? opts.minArea : Math.max(10, (w * h) / 9000);
    var simplified = simplify(raw, eps, minArea);
    var holeSlim = simplify(holes, eps, minArea);
    simplified.sort(function (a, b) { return area(b) - area(a); });
    simplified = simplified.slice(0, opts.maxShapes || 8);
    var edge = Math.max(w, h);
    var scale = 1024 / edge;
    var ox = (1024 - w * scale) / 2;
    var oy = (1024 - h * scale) / 2;
    var shapes = [];
    var used = new Array(holeSlim.length);
    var i, j, parent, holeArea, d, hd;
    var role = job === "accent" ? "accent" : "figure";
    for (i = 0; i < simplified.length; i++) {
      d = toPath(simplified[i], ox, oy, scale, opts);
      if (!d) continue;
      for (j = 0; j < holeSlim.length; j++) {
        if (used[j]) continue;
        if (!inside(simplified[i], centroid(holeSlim[j]))) continue;
        parent = area(simplified[i]);
        holeArea = area(holeSlim[j]);
        if (holeArea >= parent * 0.92) continue;
        hd = toPath(holeSlim[j], ox, oy, scale, opts);
        if (!hd) continue;
        d += " " + hd;
        used[j] = 1;
      }
      shapes.push({
        id: idBase + "-" + (shapes.length + 1),
        type: "path",
        role: role,
        fill: job,
        fillRule: "evenodd",
        d: d
      });
    }
    return shapes;
  }

  function fromRgb(width, height, rgb, options) {
    var w = width | 0;
    var h = height | 0;
    if (!w || !h || !rgb || rgb.length < w * h * 3) return { ok: false, error: "empty raster" };
    var opts = options || {};
    var src = rgb.length === w * h * 3 ? rgb : rgb.subarray(0, w * h * 3);
    var rch = new Uint8Array(w * h);
    var gch = new Uint8Array(w * h);
    var bch = new Uint8Array(w * h);
    var i, o, c;
    for (i = 0; i < w * h; i++) {
      o = i * 3;
      rch[i] = src[o];
      gch[i] = src[o + 1];
      bch[i] = src[o + 2];
    }
    if (opts.blur !== false) {
      rch = median3(rch, w, h);
      gch = median3(gch, w, h);
      bch = median3(bch, w, h);
    }
    var packed = new Uint8Array(w * h * 3);
    for (i = 0; i < w * h; i++) {
      packed[i * 3] = rch[i];
      packed[i * 3 + 1] = gch[i];
      packed[i * 3 + 2] = bch[i];
    }
    var centers = quantizeInks(packed, w, h);
    if (centers.length < 2) {
      var luma = new Uint8Array(w * h);
      for (i = 0; i < w * h; i++) luma[i] = (rch[i] * 54 + gch[i] * 183 + bch[i] * 19) >> 8;
      var mono = fromLuma(w, h, luma, opts);
      if (mono.ok && centers.length === 1) {
        mono.palette = {
          ground: "#f6f1e8",
          figure: hexOf(centers[0][0], centers[0][1], centers[0][2]),
          accent: "#355e57"
        };
        mono.inks = [{ role: "figure", hex: mono.palette.figure }];
        for (i = 0; i < mono.shapes.length; i++) mono.shapes[i].fill = "figure";
      }
      return mono;
    }
    var jobs = ["figure", "accent", "ink2", "ink3"];
    var masks = [];
    var counts = [];
    for (c = 0; c < centers.length; c++) {
      masks.push(new Uint8Array(w * h));
      counts.push(0);
    }
    var cutoff = 58 * 58;
    var best, bestD, d, r, g, b;
    for (i = 0; i < w * h; i++) {
      r = rch[i];
      g = gch[i];
      b = bch[i];
      if (paperPixel(r, g, b)) continue;
      best = -1;
      bestD = cutoff;
      for (c = 0; c < centers.length; c++) {
        d = colorDist2([r, g, b], centers[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best < 0) continue;
      masks[best][i] = 1;
      counts[best]++;
    }
    var order = [];
    for (c = 0; c < centers.length; c++) order.push(c);
    order.sort(function (a, b) { return counts[b] - counts[a]; });
    var shapes = [];
    var inks = [];
    var palette = { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
    var turd = opts.turdsize != null ? opts.turdsize : Math.max(6, Math.round((w * h) / 14000));
    for (c = 0; c < order.length; c++) {
      if (counts[order[c]] < turd) continue;
      if (inks.length >= 4) break;
      var job = jobs[inks.length];
      var hex = hexOf(centers[order[c]][0], centers[order[c]][1], centers[order[c]][2]);
      var batch = shapesFromMask(masks[order[c]], w, h, opts, job, "trace-" + job);
      if (!batch.length) continue;
      palette[job] = hex;
      inks.push({ role: job, hex: hex, contours: batch.length });
      for (i = 0; i < batch.length; i++) shapes.push(batch[i]);
      if (shapes.length >= 20) break;
    }
    if (!shapes.length) return { ok: false, error: "no contours" };
    return {
      ok: true,
      viewBox: [0, 0, 1024, 1024],
      inks: inks,
      palette: palette,
      ignoreWhite: true,
      alphamax: opts.alphamax != null ? opts.alphamax : 0.95,
      opttolerance: opts.opttolerance != null ? opts.opttolerance : 0.55,
      contours: shapes.length,
      shapes: shapes
    };
  }

  function fromLuma(width, height, luma, options) {
    var w = width | 0;
    var h = height | 0;
    if (!w || !h || !luma || luma.length < w * h) return { ok: false, error: "empty raster" };
    var opts = options || {};
    var bytes = luma.length === w * h ? luma : luma.subarray(0, w * h);
    if (opts.blur !== false) bytes = median3(bytes, w, h);
    var tone = borderTone(bytes, w, h);
    var level = opts.threshold != null ? (opts.threshold | 0) : otsu(bytes);
    var invert;
    if (opts.invert != null) invert = !!opts.invert;
    else if (tone.light >= 0.62) invert = false;
    else if (tone.dark >= 0.62) invert = true;
    else invert = mean(bytes) < 96;
    if (!invert && tone.light >= 0.62 && opts.threshold == null && level > 196) level = 196;
    var mask = inkMask(bytes, level, invert);
    var turd = opts.turdsize != null ? opts.turdsize : Math.max(6, Math.round((w * h) / 14000));
    mask = despeckle(mask, w, h, turd);
    mask = fillSmallHoles(mask, w, h, turd);
    var raw = prepare(contours(mask, w, h, opts.maxContours || 64), mask, w, h, opts.alphamax);
    var holes = prepare(holeContours(mask, w, h, opts.maxHoles || 24), mask, w, h, opts.alphamax);
    var eps = opts.epsilon != null ? opts.epsilon : Math.max(0.75, Math.min(1.7, Math.max(w, h) / 280));
    var minArea = opts.minArea != null ? opts.minArea : Math.max(10, (w * h) / 9000);
    var simplified = simplify(raw, eps, minArea);
    var holeSlim = simplify(holes, eps, minArea);
    simplified.sort(function (a, b) { return area(b) - area(a); });
    simplified = simplified.slice(0, opts.maxShapes || 18);
    var edge = Math.max(w, h);
    var scale = 1024 / edge;
    var ox = (1024 - w * scale) / 2;
    var oy = (1024 - h * scale) / 2;
    var shapes = [];
    var used = new Array(holeSlim.length);
    var i, j, parent, holeArea, d, hd;
    for (i = 0; i < simplified.length; i++) {
      d = toPath(simplified[i], ox, oy, scale, opts);
      if (!d) continue;
      for (j = 0; j < holeSlim.length; j++) {
        if (used[j]) continue;
        if (!inside(simplified[i], centroid(holeSlim[j]))) continue;
        parent = area(simplified[i]);
        holeArea = area(holeSlim[j]);
        if (holeArea >= parent * 0.92) continue;
        hd = toPath(holeSlim[j], ox, oy, scale, opts);
        if (!hd) continue;
        d += " " + hd;
        used[j] = 1;
      }
      shapes.push({
        id: "trace-" + (shapes.length + 1),
        type: "path",
        role: shapes.length === 0 ? "figure" : "accent",
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
      alphamax: opts.alphamax != null ? opts.alphamax : 0.95,
      opttolerance: opts.opttolerance != null ? opts.opttolerance : 0.55,
      ignoreWhite: !invert && tone.light >= 0.62,
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
    if (payload.rgb) {
      var rgb = decodeLuma(payload.rgb);
      if (rgb.length >= (payload.width | 0) * (payload.height | 0) * 3) {
        return fromRgb(payload.width, payload.height, rgb, options);
      }
    }
    return fromLuma(payload.width, payload.height, decodeLuma(payload.luma), options);
  }

  function fromImage(img, done, options) {
    var opts = options || {};
    var maxEdge = opts.maxEdge || 640;
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
    var rgb = new Uint8Array(w * h * 3);
    for (var i = 0; i < w * h; i++) {
      var o = i * 4;
      if (data[o + 3] < 16) {
        rgb[i * 3] = 255;
        rgb[i * 3 + 1] = 255;
        rgb[i * 3 + 2] = 255;
      } else {
        rgb[i * 3] = data[o];
        rgb[i * 3 + 1] = data[o + 1];
        rgb[i * 3 + 2] = data[o + 2];
      }
    }
    done(fromRgb(w, h, rgb, opts));
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
      palette: (trace && trace.palette) || { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" },
      layers: [{ id: "trace", name: "Trace", visible: true, opacity: 1, shapes: trace.shapes }]
    };
  }

  root.VeloraTrace = {
    fromLuma: fromLuma,
    fromRgb: fromRgb,
    fromRaster: fromRaster,
    fromImage: fromImage,
    documentFrom: documentFrom,
    decodeLuma: decodeLuma
  };
})(typeof window !== "undefined" ? window : globalThis);
