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


  function bridgeGaps(mask, w, h) {
    var out = new Uint8Array(mask);
    var y, x, i, left, right, up, down;
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        i = y * w + x;
        if (mask[i]) continue;
        left = mask[i - 1];
        right = mask[i + 1];
        up = mask[i - w];
        down = mask[i + w];
        if (left && right) out[i] = 1;
        else if (up && down) out[i] = 1;
        else if (!left && !right && !up && !down && mask[i - w - 1] && mask[i + w + 1]) out[i] = 1;
        else if (!left && !right && !up && !down && mask[i - w + 1] && mask[i + w - 1]) out[i] = 1;
      }
    }
    return out;
  }

  function degree8(mask, w, h, x, y) {
    var n = 0;
    var k, nx, ny;
    for (k = 0; k < 8; k++) {
      nx = x + DX[k];
      ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (mask[ny * w + nx]) n++;
    }
    return n;
  }

  function smoothMask(mask, w, h) {
    var out = new Uint8Array(mask);
    var y, x, i, n, k, nx, ny, ox, oy;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i]) continue;
        n = 0;
        ox = -1;
        oy = -1;
        for (k = 0; k < 8; k++) {
          nx = x + DX[k];
          ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (!mask[ny * w + nx]) continue;
          n++;
          ox = nx;
          oy = ny;
        }
        if (n !== 1) continue;
        if (degree8(mask, w, h, ox, oy) >= 3) out[i] = 0;
      }
    }
    return out;
  }

  function majorityLabels(labels, w, h, k) {
    var out = new Int8Array(labels);
    var counts = new Array(k);
    var y, x, i, sy, sx, yy, xx, j, best, bestN, n, cur;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        cur = labels[i];
        if (cur < 0) continue;
        for (j = 0; j < k; j++) counts[j] = 0;
        n = 0;
        for (sy = -1; sy <= 1; sy++) {
          yy = y + sy;
          if (yy < 0 || yy >= h) continue;
          for (sx = -1; sx <= 1; sx++) {
            xx = x + sx;
            if (xx < 0 || xx >= w) continue;
            j = labels[yy * w + xx];
            if (j < 0) continue;
            counts[j]++;
            n++;
          }
        }
        if (n < 4) continue;
        best = cur;
        bestN = counts[cur] || 0;
        for (j = 0; j < k; j++) {
          if (counts[j] > bestN) {
            bestN = counts[j];
            best = j;
          }
        }
        if (best !== cur && bestN >= 5) out[i] = best;
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

  function rdpOpen(points, eps, keep) {
    if (points.length < 3) return points.slice();
    var mark = new Array(points.length);
    var stack = [[0, points.length - 1]];
    var lo, hi, max, index, forced, i, d, cut, j, out;
    mark[0] = 1;
    mark[points.length - 1] = 1;
    while (stack.length) {
      var span = stack.pop();
      lo = span[0];
      hi = span[1];
      if (hi <= lo + 1) continue;
      max = 0;
      index = -1;
      forced = -1;
      for (i = lo + 1; i < hi; i++) {
        if (keep && keep[i] && forced < 0) forced = i;
        d = distPointSeg(points[i], points[lo], points[hi]);
        if (d > max) {
          max = d;
          index = i;
        }
      }
      cut = forced >= 0 ? forced : (max > eps ? index : -1);
      if (cut <= lo || cut >= hi) continue;
      mark[cut] = 1;
      stack.push([lo, cut]);
      stack.push([cut, hi]);
    }
    out = [];
    for (j = 0; j < points.length; j++) if (mark[j]) out.push(points[j]);
    return out;
  }

  function rdp(points, eps, keep) {
    if (points.length < 3) return points.slice();
    var closed = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1];
    if (!closed) return rdpOpen(points, eps, keep);
    var ring = points.slice(0, -1);
    var flags = [];
    var i, k, cx, cy, far, farD, dd, opposite, anchors, a, from, to, idx, guard, span, spanKeep, slim, out;
    for (i = 0; i < ring.length; i++) flags.push(keep && keep[i] ? 1 : 0);
    anchors = [];
    for (i = 0; i < ring.length; i++) if (flags[i]) anchors.push(i);
    if (anchors.length < 2) {
      cx = 0;
      cy = 0;
      for (k = 0; k < ring.length; k++) {
        cx += ring[k][0];
        cy += ring[k][1];
      }
      cx /= ring.length;
      cy /= ring.length;
      far = 0;
      farD = -1;
      for (k = 0; k < ring.length; k++) {
        dd = (ring[k][0] - cx) * (ring[k][0] - cx) + (ring[k][1] - cy) * (ring[k][1] - cy);
        if (dd > farD) {
          farD = dd;
          far = k;
        }
      }
      opposite = 0;
      farD = -1;
      for (k = 0; k < ring.length; k++) {
        dd = (ring[k][0] - ring[far][0]) * (ring[k][0] - ring[far][0]) + (ring[k][1] - ring[far][1]) * (ring[k][1] - ring[far][1]);
        if (dd > farD) {
          farD = dd;
          opposite = k;
        }
      }
      anchors = far < opposite ? [far, opposite] : [opposite, far];
      flags[far] = 1;
      flags[opposite] = 1;
    }
    out = [];
    for (a = 0; a < anchors.length; a++) {
      from = anchors[a];
      to = anchors[(a + 1) % anchors.length];
      span = [];
      spanKeep = [];
      idx = from;
      guard = 0;
      while (guard <= ring.length) {
        span.push(ring[idx]);
        spanKeep.push(idx === from || idx === to ? 1 : flags[idx]);
        if (idx === to && span.length > 1) break;
        idx = (idx + 1) % ring.length;
        guard++;
      }
      slim = rdpOpen(span, eps, spanKeep);
      out = out.length ? out.concat(slim.slice(1)) : slim;
    }
    if (out.length) out.push(out[0].slice());
    return out;
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

  function holeSamples(points) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var samples = [];
    var step = Math.max(1, Math.floor(ring.length / 8));
    var i;
    for (i = 0; i < ring.length; i += step) samples.push(ring[i]);
    var c = centroid(points);
    if (c && isFinite(c[0]) && isFinite(c[1])) samples.push(c);
    return samples;
  }

  function containedBy(parent, hole) {
    var samples = holeSamples(hole);
    if (samples.length < 2) return false;
    var hits = 0;
    var i;
    for (i = 0; i < samples.length; i++) if (inside(parent, samples[i])) hits++;
    return hits >= Math.max(2, Math.ceil(samples.length * 0.6));
  }

  function holeParents(outers, holes) {
    var owners = new Array(holes.length);
    var j, i, best, bestArea, parentArea, holeArea;
    for (j = 0; j < holes.length; j++) {
      owners[j] = -1;
      best = -1;
      bestArea = Infinity;
      holeArea = Math.abs(area(holes[j]));
      for (i = 0; i < outers.length; i++) {
        parentArea = Math.abs(area(outers[i]));
        if (holeArea >= parentArea * 0.92) continue;
        if (!containedBy(outers[i], holes[j])) continue;
        if (parentArea < bestArea) {
          bestArea = parentArea;
          best = i;
        }
      }
      owners[j] = best;
    }
    return owners;
  }

  function dropHoleEchoes(outers, holes) {
    var out = [];
    var i, j, aa, ba, ratio, echo, ca, cb;
    for (i = 0; i < outers.length; i++) {
      echo = false;
      aa = Math.abs(area(outers[i]));
      ca = centroid(outers[i]);
      for (j = 0; j < holes.length; j++) {
        ba = Math.abs(area(holes[j]));
        if (aa < 8 || ba < 8) continue;
        ratio = aa / ba;
        if (ratio < 0.62 || ratio > 1.62) continue;
        cb = centroid(holes[j]);
        if (ca && cb && Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) <= 4) {
          echo = true;
          break;
        }
        if (containedBy(outers[i], holes[j]) || containedBy(holes[j], outers[i])) {
          echo = true;
          break;
        }
      }
      if (!echo) out.push(outers[i]);
    }
    return out;
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


  function sealRings(list) {
    var closed = [];
    var pool = [];
    var i, c, a, b, gap, merged, changed;
    function ends(pts) {
      return Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    }
    function shut(pts) {
      if (ends(pts) > 4.2 || pts.length < 6) return pts;
      var out = pts.map(function (p) { return p.slice(); });
      if (out[0][0] !== out[out.length - 1][0] || out[0][1] !== out[out.length - 1][1]) out.push(out[0].slice());
      return out;
    }
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (!c || c.length < 4) continue;
      if (c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1]) closed.push(c);
      else pool.push(c.map(function (p) { return p.slice(); }));
    }
    function near(u, v) {
      return Math.hypot(u[0] - v[0], u[1] - v[1]) <= 4.2;
    }
    changed = true;
    while (changed) {
      changed = false;
      for (i = 0; i < pool.length; i++) {
        for (var j = i + 1; j < pool.length; j++) {
          a = pool[i];
          b = pool[j];
          merged = null;
          if (near(a[a.length - 1], b[0])) merged = a.concat(b.slice(1));
          else if (near(a[a.length - 1], b[b.length - 1])) merged = a.concat(b.slice(0, -1).reverse());
          else if (near(a[0], b[0])) merged = a.slice().reverse().concat(b.slice(1));
          else if (near(a[0], b[b.length - 1])) merged = b.concat(a.slice(1));
          if (!merged) continue;
          pool[i] = merged;
          pool.splice(j, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    for (i = 0; i < pool.length; i++) {
      gap = ends(pool[i]);
      if (gap <= 4.2) closed.push(shut(pool[i]));
      else closed.push(pool[i]);
    }
    return closed;
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

  function chordParams(pts) {
    var t = [0];
    var total = 0;
    var i, d;
    for (i = 1; i < pts.length; i++) {
      d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      total += d;
      t.push(total);
    }
    if (total < 1e-6) {
      for (i = 0; i < t.length; i++) t[i] = i / (pts.length - 1 || 1);
      return t;
    }
    for (i = 0; i < t.length; i++) t[i] /= total;
    return t;
  }

  function ribbonWidth(points, mask, w, h) {
    var pack = closedRing(points);
    var ring = pack.ring;
    if (!mask || ring.length < 6) return 99;
    var samples = [];
    var step = Math.max(1, (ring.length / 28) | 0);
    var i, prev, next, tx, ty, nx, ny, len, px, py, inx, iny, s, dist, sx, sy;
    for (i = 0; i < ring.length; i += step) {
      prev = ring[(i + ring.length - 1) % ring.length];
      next = ring[(i + 1) % ring.length];
      tx = next[0] - prev[0];
      ty = next[1] - prev[1];
      nx = -ty;
      ny = tx;
      len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      px = ring[i][0];
      py = ring[i][1];
      inx = nx;
      iny = ny;
      if (!on(mask, w, h, Math.round(px + nx * 1.4), Math.round(py + ny * 1.4))) {
        inx = -nx;
        iny = -ny;
      }
      dist = 0;
      for (s = 1; s <= 16; s++) {
        sx = Math.round(px + inx * s);
        sy = Math.round(py + iny * s);
        if (!on(mask, w, h, sx, sy)) break;
        dist = s;
      }
      if (dist > 0) samples.push(dist);
    }
    if (samples.length < 4) return 99;
    samples.sort(function (a, b) { return a - b; });
    return samples[samples.length >> 1];
  }

  function thinFit(points, mask, w, h, opts) {
    var width = ribbonWidth(points, mask, w, h);
    var next = {};
    var key;
    opts = opts || {};
    for (key in opts) next[key] = opts[key];
    if (width > 6.5) return { points: points, opts: next, thin: false };
    next.opttolerance = Math.max(0.24, Math.min(opts.opttolerance != null ? opts.opttolerance : 0.36, width * 0.1));
    next.alphamax = Math.min(opts.alphamax != null ? opts.alphamax : 0.95, 0.7);
    return { points: points, opts: next, thin: true, width: width };
  }

  function fitCubic(pts, ts) {
    var n = pts.length;
    var a = pts[0];
    var b = pts[n - 1];
    var t1 = tangentAt(pts, 0);
    var t2 = tangentAt(pts, n - 1);
    var chordDir = norm(b[0] - a[0], b[1] - a[1]);
    if (t1[0] * chordDir[0] + t1[1] * chordDir[1] < 0.2) t1 = chordDir;
    if (t2[0] * chordDir[0] + t2[1] * chordDir[1] < 0.2) t2 = chordDir;
    if (!ts) ts = chordParams(pts);
    var c00 = 0;
    var c01 = 0;
    var c11 = 0;
    var x0 = 0;
    var x1 = 0;
    var dot = t1[0] * -t2[0] + t1[1] * -t2[1];
    var i, t, u, b1, b2, cx, cy, dx, dy;
    for (i = 1; i < n - 1; i++) {
      t = ts[i];
      u = 1 - t;
      b1 = 3 * u * u * t;
      b2 = 3 * u * t * t;
      cx = u * u * (1 + 2 * t) * a[0] + t * t * (3 - 2 * t) * b[0];
      cy = u * u * (1 + 2 * t) * a[1] + t * t * (3 - 2 * t) * b[1];
      dx = pts[i][0] - cx;
      dy = pts[i][1] - cy;
      c00 += b1 * b1;
      c01 += b1 * b2 * dot;
      c11 += b2 * b2;
      x0 += b1 * (dx * t1[0] + dy * t1[1]);
      x1 += b2 * (dx * -t2[0] + dy * -t2[1]);
    }
    var det = c00 * c11 - c01 * c01;
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    var alpha;
    var beta;
    if (det < 1e-8 || n < 4) {
      alpha = chord / 3;
      beta = chord / 3;
    } else {
      alpha = (x0 * c11 - x1 * c01) / det;
      beta = (c00 * x1 - c01 * x0) / det;
    }
    if (!(alpha > 0)) alpha = chord / 3;
    if (!(beta > 0)) beta = chord / 3;
    var cap = chord * 0.8;
    if (alpha > cap) alpha = cap;
    if (beta > cap) beta = cap;
    var c1 = [a[0] + t1[0] * alpha, a[1] + t1[1] * alpha];
    var c2 = [b[0] - t2[0] * beta, b[1] - t2[1] * beta];
    var minX = a[0];
    var maxX = a[0];
    var minY = a[1];
    var maxY = a[1];
    for (i = 0; i < n; i++) {
      if (pts[i][0] < minX) minX = pts[i][0];
      if (pts[i][0] > maxX) maxX = pts[i][0];
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    c1 = [Math.max(minX - 1.5, Math.min(maxX + 1.5, c1[0])), Math.max(minY - 1.5, Math.min(maxY + 1.5, c1[1]))];
    c2 = [Math.max(minX - 1.5, Math.min(maxX + 1.5, c2[0])), Math.max(minY - 1.5, Math.min(maxY + 1.5, c2[1]))];
    return [a, c1, c2, b];
  }

  function cubicVel(cubic, t) {
    var u = 1 - t;
    var d0x = cubic[1][0] - cubic[0][0];
    var d0y = cubic[1][1] - cubic[0][1];
    var d1x = cubic[2][0] - cubic[1][0];
    var d1y = cubic[2][1] - cubic[1][1];
    var d2x = cubic[3][0] - cubic[2][0];
    var d2y = cubic[3][1] - cubic[2][1];
    return [
      3 * u * u * d0x + 6 * u * t * d1x + 3 * t * t * d2x,
      3 * u * u * d0y + 6 * u * t * d1y + 3 * t * t * d2y
    ];
  }

  function cubicAcc(cubic, t) {
    var a0x = cubic[2][0] - 2 * cubic[1][0] + cubic[0][0];
    var a0y = cubic[2][1] - 2 * cubic[1][1] + cubic[0][1];
    var a1x = cubic[3][0] - 2 * cubic[2][0] + cubic[1][0];
    var a1y = cubic[3][1] - 2 * cubic[2][1] + cubic[1][1];
    var u = 1 - t;
    return [6 * u * a0x + 6 * t * a1x, 6 * u * a0y + 6 * t * a1y];
  }

  function projectT(cubic, p, t0) {
    var t = t0;
    var i, pt, vel, acc, dx, dy, num, den;
    if (!(t > 0.001)) t = 0.05;
    if (t > 0.999) t = 0.95;
    for (i = 0; i < 4; i++) {
      pt = bezier(cubic[0], cubic[1], cubic[2], cubic[3], t);
      vel = cubicVel(cubic, t);
      acc = cubicAcc(cubic, t);
      dx = pt[0] - p[0];
      dy = pt[1] - p[1];
      num = dx * vel[0] + dy * vel[1];
      den = vel[0] * vel[0] + vel[1] * vel[1] + dx * acc[0] + dy * acc[1];
      if (Math.abs(den) < 1e-8) break;
      t = t - num / den;
      if (t < 0.001) t = 0.001;
      if (t > 0.999) t = 0.999;
    }
    return t;
  }

  function monotone(ts) {
    var i;
    ts[0] = 0;
    ts[ts.length - 1] = 1;
    for (i = 1; i < ts.length - 1; i++) {
      if (ts[i] <= ts[i - 1]) ts[i] = Math.min(0.999, ts[i - 1] + 0.0001);
    }
    return ts;
  }

  function fitTight(pts) {
    var ts = chordParams(pts);
    var cubic = fitCubic(pts, ts);
    var pass, i;
    for (pass = 0; pass < 3; pass++) {
      for (i = 1; i < pts.length - 1; i++) ts[i] = projectT(cubic, pts[i], ts[i]);
      monotone(ts);
      cubic = fitCubic(pts, ts);
    }
    return { cubic: cubic, ts: ts };
  }

  function cubicError(pts, cubic, ts) {
    var params = ts || chordParams(pts);
    var max = 0;
    var at = 1;
    var i, p, d;
    for (i = 1; i < pts.length - 1; i++) {
      p = bezier(cubic[0], cubic[1], cubic[2], cubic[3], params[i]);
      d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]);
      if (d > max) {
        max = d;
        at = i;
      }
    }
    return { max: max, at: at };
  }

  function fitSpan(pts, tol, depth) {
    if (pts.length < 3) return [{ k: "L", p: pts[pts.length - 1], pts: pts }];
    var fit = fitTight(pts);
    var err = cubicError(pts, fit.cubic, fit.ts);
    if (straightEnough(pts, tol)) return [{ k: "L", p: pts[pts.length - 1], pts: pts }];
    if (err.max <= tol || depth > 5 || pts.length < 5) {
      if (flatCubic(fit.cubic, tol * 0.65)) return [{ k: "L", p: pts[pts.length - 1], pts: pts }];
      return [{ k: "C", c: fit.cubic, pts: pts }];
    }
    var mid = err.at;
    if (mid < 2 || mid > pts.length - 3) mid = (pts.length / 2) | 0;
    return fitSpan(pts.slice(0, mid + 1), tol, depth + 1).concat(fitSpan(pts.slice(mid), tol, depth + 1));
  }

  function flatCubic(cubic, tol) {
    var a = cubic[0];
    var b = cubic[3];
    return distPointSeg(cubic[1], a, b) <= tol && distPointSeg(cubic[2], a, b) <= tol;
  }

  function chordBow(pts) {
    if (!pts || pts.length < 3) return 0;
    var a = pts[0];
    var b = pts[pts.length - 1];
    var bow = 0;
    var i, d;
    for (i = 1; i < pts.length - 1; i++) {
      d = distPointSeg(pts[i], a, b);
      if (d > bow) bow = d;
    }
    return bow;
  }

  function straightEnough(pts, tol) {
    if (!pts || pts.length < 2) return true;
    var a = pts[0];
    var b = pts[pts.length - 1];
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    var bow = chordBow(pts);
    if (chord < 9) return bow <= tol * 0.5;
    return bow <= Math.max(tol, 0.62) && bow <= chord * 0.034;
  }

  function joinPts(a, b) {
    if (!a || !b || !a.length || !b.length) return null;
    var out = a.slice();
    var start = 0;
    var last = out[out.length - 1];
    if (b[0][0] === last[0] && b[0][1] === last[1]) start = 1;
    var i;
    for (i = start; i < b.length; i++) out.push(b[i]);
    return out;
  }

  function spanTurn(pts) {
    if (!pts || pts.length < 3) return 0;
    var max = 0;
    var i, turn;
    for (i = 1; i < pts.length - 1; i++) {
      turn = turnAt(pts[i - 1], pts[i], pts[i + 1]);
      if (turn > max) max = turn;
    }
    return max;
  }

  function opticurve(segs, tol) {
    var cur = [];
    var i, seg, pts, end, merged, fit, err, allow;
    for (i = 0; i < segs.length; i++) {
      seg = segs[i];
      if (seg.k === "C" && (flatCubic(seg.c, tol * 0.65) || straightEnough(seg.pts, tol))) cur.push({ k: "L", p: seg.c[3], pts: seg.pts });
      else cur.push(seg);
    }
    var out = [];
    i = 0;
    while (i < cur.length) {
      seg = cur[i];
      if (seg.k !== "C" || !seg.pts) {
        out.push(seg);
        i++;
        continue;
      }
      pts = seg.pts;
      end = i;
      while (end + 1 < cur.length && cur[end + 1].k === "C" && cur[end + 1].pts) {
        merged = joinPts(pts, cur[end + 1].pts);
        if (!merged || merged.length < 4) break;
        fit = fitTight(merged);
        err = cubicError(merged, fit.cubic, fit.ts);
        allow = tol;
        if (spanTurn(merged) < 0.55 && chordBow(merged) > 0.9) allow = Math.max(tol, 1.15);
        if (err.max > allow || flatCubic(fit.cubic, tol * 0.65) || straightEnough(merged, tol)) break;
        pts = merged;
        end++;
      }
      if (end === i) out.push(seg);
      else {
        fit = fitTight(pts);
        out.push({ k: "C", c: fit.cubic, pts: pts });
      }
      i = end + 1;
    }
    return out;
  }

  function sideRuns(ring) {
    var n = ring.length;
    if (n < 4) return [];
    var cuts = [];
    var seen = new Array(n);
    var i, j, k, span, along, step, bow, back, prev, next, prevLen, nextLen, turnIn, turnOut, ok;
    for (i = 0; i < n; i++) {
      if (seen[i]) continue;
      var run = [i];
      j = (i + 1) % n;
      while (run.indexOf(j) < 0 && run.length < n) {
        span = [];
        for (k = 0; k < run.length; k++) span.push(ring[run[k]]);
        span.push(ring[j]);
        along = 0;
        for (k = 1; k < span.length; k++) along += Math.hypot(span[k][0] - span[k - 1][0], span[k][1] - span[k - 1][1]);
        bow = chordBow(span);
        step = Math.hypot(ring[j][0] - ring[run[run.length - 1]][0], ring[j][1] - ring[run[run.length - 1]][1]);
        if (step < 0.4 || bow > 1.05 || (along > 12 && bow > along * 0.012)) break;
        run.push(j);
        j = (j + 1) % n;
      }
      back = (i + n - 1) % n;
      while (run.indexOf(back) < 0 && run.length < n) {
        span = [ring[back]];
        for (k = 0; k < run.length; k++) span.push(ring[run[k]]);
        along = 0;
        for (k = 1; k < span.length; k++) along += Math.hypot(span[k][0] - span[k - 1][0], span[k][1] - span[k - 1][1]);
        bow = chordBow(span);
        step = Math.hypot(ring[run[0]][0] - ring[back][0], ring[run[0]][1] - ring[back][1]);
        if (step < 0.4 || bow > 1.05 || (along > 12 && bow > along * 0.012)) break;
        run.unshift(back);
        back = (back + n - 1) % n;
      }
      along = 0;
      for (k = 1; k < run.length; k++) along += Math.hypot(ring[run[k]][0] - ring[run[k - 1]][0], ring[run[k]][1] - ring[run[k - 1]][1]);
      ok = along >= 16 && run.length >= 2;
      if (ok && run.length === 2) {
        prev = ring[(run[0] + n - 1) % n];
        next = ring[(run[1] + 1) % n];
        prevLen = Math.hypot(ring[run[0]][0] - prev[0], ring[run[0]][1] - prev[1]);
        nextLen = Math.hypot(next[0] - ring[run[1]][0], next[1] - ring[run[1]][1]);
        if (prevLen > along * 0.7 && nextLen > along * 0.7) ok = false;
        if (along < 24) {
          turnIn = turnAt(prev, ring[run[0]], ring[run[1]]);
          turnOut = turnAt(ring[run[0]], ring[run[1]], next);
          if (turnIn < 0.4 || turnOut < 0.4) ok = false;
        }
      }
      if (ok && run.length >= 2) {
        prev = ring[(run[0] + n - 1) % n];
        next = ring[(run[run.length - 1] + 1) % n];
        turnIn = turnAt(prev, ring[run[0]], ring[run[1]]);
        turnOut = turnAt(ring[run[run.length - 2]], ring[run[run.length - 1]], next);
        var farIn = ring[wrap(run[0] - 5, n)];
        var farOut = ring[wrap(run[run.length - 1] + 5, n)];
        var driftIn = turnAt(farIn, ring[run[0]], ring[run[1]]);
        var driftOut = turnAt(ring[run[run.length - 2]], ring[run[run.length - 1]], farOut);
        if (turnIn < 0.72 && turnOut < 0.72 && driftIn < 0.85 && driftOut < 0.85) ok = false;
      }
      if (!ok) {
        seen[i] = 1;
        continue;
      }
      for (k = 0; k < run.length; k++) seen[run[k]] = 1;
      cuts.push(run[0]);
      cuts.push(run[run.length - 1]);
    }
    return cuts;
  }

  function straightCuts(ring) {
    var n = ring.length;
    if (n < 8) return [];
    var mark = new Array(n);
    var i, a, b, c, inn, out;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      inn = Math.hypot(b[0] - a[0], b[1] - a[1]);
      out = Math.hypot(c[0] - b[0], c[1] - b[1]);
      mark[i] = inn >= 6 && out >= 6 && turnAt(a, b, c) < 0.22;
    }
    var cuts = [];
    var seen = new Array(n);
    for (i = 0; i < n; i++) {
      if (!mark[i] || seen[i]) continue;
      var run = [i];
      seen[i] = 1;
      var j = (i + 1) % n;
      while (mark[j] && !seen[j]) {
        seen[j] = 1;
        run.push(j);
        j = (j + 1) % n;
        if (run.length > n) break;
      }
      var back = (i + n - 1) % n;
      while (mark[back] && !seen[back]) {
        seen[back] = 1;
        run.unshift(back);
        back = (back + n - 1) % n;
        if (run.length > n) break;
      }
      if (run.length < 2) continue;
      var span = [];
      var along = 0;
      var k;
      for (k = 0; k < run.length; k++) span.push(ring[run[k]]);
      for (k = 1; k < span.length; k++) along += Math.hypot(span[k][0] - span[k - 1][0], span[k][1] - span[k - 1][1]);
      if (along < 18 || chordBow(span) > 0.5) continue;
      var turnIn = turnAt(ring[(run[0] + n - 1) % n], ring[run[0]], ring[run[1]]);
      var turnOut = turnAt(ring[run[run.length - 2]], ring[run[run.length - 1]], ring[(run[run.length - 1] + 1) % n]);
      var driftIn = turnAt(ring[wrap(run[0] - 5, n)], ring[run[0]], ring[run[1]]);
      var driftOut = turnAt(ring[run[run.length - 2]], ring[run[run.length - 1]], ring[wrap(run[run.length - 1] + 5, n)]);
      if (turnIn < 0.72 && turnOut < 0.72 && driftIn < 0.85 && driftOut < 0.85) continue;
      cuts.push(run[0]);
      cuts.push(run[run.length - 1]);
    }
    return cuts;
  }

  function wrap(i, n) {
    return ((i % n) + n) % n;
  }

  function turnAt(a, b, c) {
    var v1x = b[0] - a[0];
    var v1y = b[1] - a[1];
    var v2x = c[0] - b[0];
    var v2y = c[1] - b[1];
    return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
  }

  function axisJoin(ring, idx) {
    var n = ring.length;
    var a = ring[(idx + n - 1) % n];
    var b = ring[idx];
    var c = ring[(idx + 1) % n];
    var inn = Math.hypot(b[0] - a[0], b[1] - a[1]);
    var out = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (inn < 6 || out < 6) return false;
    var dot = ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])) / (inn * out);
    var axisIn = Math.abs(b[0] - a[0]) < 1.6 || Math.abs(b[1] - a[1]) < 1.6;
    var axisOut = Math.abs(c[0] - b[0]) < 1.6 || Math.abs(c[1] - b[1]) < 1.6;
    return dot < 0.28 && axisIn && axisOut;
  }

  function flatJoin(ring, from, to) {
    var a = ring[from];
    var b = ring[to];
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord >= 34) return true;
    return axisJoin(ring, from) && axisJoin(ring, to);
  }

  function lineChord(span) {
    if (!span || span.length < 3) return false;
    var a = span[0];
    var b = span[span.length - 1];
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord < 14) return false;
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var maxAbs = 0;
    var changes = 0;
    var prev = 0;
    var peakTurn = 0;
    var i, cross, dist, sign, turn;
    for (i = 1; i < span.length - 1; i++) {
      cross = (span[i][0] - a[0]) * dy - (span[i][1] - a[1]) * dx;
      dist = cross / chord;
      if (Math.abs(dist) > maxAbs) maxAbs = Math.abs(dist);
      sign = dist > 0.35 ? 1 : dist < -0.35 ? -1 : 0;
      if (sign && prev && sign !== prev) changes++;
      if (sign) prev = sign;
      turn = turnAt(span[i - 1], span[i], span[Math.min(i + 1, span.length - 1)]);
      if (turn > peakTurn) peakTurn = turn;
      if (turn > 0.62 && Math.abs(dist) > 1.7) return false;
    }
    if (maxAbs > 2.15) return false;
    if (changes >= 1) return true;
    if (peakTurn < 0.38 && maxAbs <= 1.9) return true;
    return maxAbs <= 1.25;
  }

  function stairLine(span) {
    if (!span || span.length < 3) return false;
    var a = span[0];
    var b = span[span.length - 1];
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord < 12) return false;
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var maxAbs = 0;
    var changes = 0;
    var prev = 0;
    var run = 0;
    var maxRun = 0;
    var i, cross, dist, sign;
    for (i = 1; i < span.length - 1; i++) {
      cross = (span[i][0] - a[0]) * dy - (span[i][1] - a[1]) * dx;
      dist = cross / chord;
      if (Math.abs(dist) > maxAbs) maxAbs = Math.abs(dist);
      sign = dist > 0.28 ? 1 : dist < -0.28 ? -1 : 0;
      if (sign && prev && sign !== prev) changes++;
      run = sign && sign === prev ? run + 1 : sign ? 1 : 0;
      if (run > maxRun) maxRun = run;
      if (sign) prev = sign;
    }
    if (maxAbs > 1.2) return false;
    return changes >= 2 || maxRun <= 3;
  }


  function solve3(a00, a01, a02, a11, a12, a22, b0, b1, b2) {
    var det = a00 * (a11 * a22 - a12 * a12) - a01 * (a01 * a22 - a12 * a02) + a02 * (a01 * a12 - a11 * a02);
    if (Math.abs(det) < 1e-8) return null;
    var dx = (b0 * (a11 * a22 - a12 * a12) - a01 * (b1 * a22 - a12 * b2) + a02 * (b1 * a12 - a11 * b2)) / det;
    var dy = (a00 * (b1 * a22 - a12 * b2) - b0 * (a01 * a22 - a12 * a02) + a02 * (a01 * b2 - b1 * a02)) / det;
    var dr = (a00 * (a11 * b2 - b1 * a12) - a01 * (a01 * b2 - b1 * a02) + b0 * (a01 * a12 - a11 * a02)) / det;
    return [dx, dy, dr];
  }

  function hasSharp(ring) {
    var n = ring.length;
    var i, a, b, c;
    if (n < 4) return false;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      if (turnAt(a, b, c) > 0.62) return true;
    }
    return false;
  }

  function circleFit(ring) {
    var n = ring.length;
    if (n < 8) return null;
    if (hasSharp(ring)) return null;
    var cx = 0;
    var cy = 0;
    var i;
    for (i = 0; i < n; i++) {
      cx += ring[i][0];
      cy += ring[i][1];
    }
    cx /= n;
    cy /= n;
    var r = 0;
    for (i = 0; i < n; i++) r += Math.hypot(ring[i][0] - cx, ring[i][1] - cy);
    r /= n;
    if (r < 3.4 || r > 480) return null;
    var step, dx, dy, dist, ex, ey, err, j00, j01, j02, j11, j12, j22, g0, g1, g2, delta;
    for (step = 0; step < 5; step++) {
      j00 = 0;
      j01 = 0;
      j02 = 0;
      j11 = 0;
      j12 = 0;
      j22 = 0;
      g0 = 0;
      g1 = 0;
      g2 = 0;
      for (i = 0; i < n; i++) {
        dx = ring[i][0] - cx;
        dy = ring[i][1] - cy;
        dist = Math.hypot(dx, dy) || 1e-6;
        ex = dx / dist;
        ey = dy / dist;
        err = dist - r;
        j00 += ex * ex;
        j01 += ex * ey;
        j02 += ex;
        j11 += ey * ey;
        j12 += ey;
        j22 += 1;
        g0 += ex * err;
        g1 += ey * err;
        g2 += err;
      }
      delta = solve3(j00, j01, j02, j11, j12, j22, g0, g1, g2);
      if (!delta) break;
      if (Math.abs(delta[2]) > r * 0.35) break;
      cx += delta[0];
      cy += delta[1];
      r += delta[2];
      if (r < 3.2) return null;
    }
    var worst = 0;
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    for (i = 0; i < n; i++) {
      err = Math.abs(Math.hypot(ring[i][0] - cx, ring[i][1] - cy) - r);
      if (err > worst) worst = err;
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var bw = maxX - minX;
    var bh = maxY - minY;
    if (bw < 6.5 || bh < 6.5) return null;
    if (Math.max(bw, bh) / Math.min(bw, bh) > 1.16) return null;
    var allow = Math.max(0.78, r * 0.062);
    if (worst > allow || worst > 1.35) return null;
    return { cx: cx, cy: cy, r: r, worst: worst };
  }

  function solve4(a, b) {
    var m = [
      [a[0], a[1], a[2], a[3], b[0]],
      [a[4], a[5], a[6], a[7], b[1]],
      [a[8], a[9], a[10], a[11], b[2]],
      [a[12], a[13], a[14], a[15], b[3]]
    ];
    var i, k, j, pivot, f;
    for (i = 0; i < 4; i++) {
      pivot = i;
      for (k = i + 1; k < 4; k++) if (Math.abs(m[k][i]) > Math.abs(m[pivot][i])) pivot = k;
      if (Math.abs(m[pivot][i]) < 1e-8) return null;
      if (pivot !== i) {
        var row = m[i];
        m[i] = m[pivot];
        m[pivot] = row;
      }
      for (k = i + 1; k < 4; k++) {
        f = m[k][i] / m[i][i];
        for (j = i; j < 5; j++) m[k][j] -= f * m[i][j];
      }
    }
    var x = [0, 0, 0, 0];
    for (i = 3; i >= 0; i--) {
      f = m[i][4];
      for (j = i + 1; j < 4; j++) f -= m[i][j] * x[j];
      x[i] = f / m[i][i];
    }
    return x;
  }

  function ellipseFit(ring) {
    var n = ring.length;
    if (n < 12) return null;
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var bw = maxX - minX;
    var bh = maxY - minY;
    if (bw < 10 || bh < 8) return null;
    if (hasSharp(ring)) return null;
    var aspect0 = Math.max(bw, bh) / Math.min(bw, bh);
    if (aspect0 < 1.18 || aspect0 > 4.8) return null;
    var s00 = 0, s01 = 0, s02 = 0, s03 = 0, s11 = 0, s12 = 0, s13 = 0, s22 = 0, s23 = 0, s33 = 0;
    var r0 = 0, r1 = 0, r2 = 0, r3 = 0;
    for (i = 0; i < n; i++) {
      var x = ring[i][0];
      var y = ring[i][1];
      var u = x * x - y * y;
      var v = x;
      var w = y;
      var q = 1;
      var rhs = -y * y;
      s00 += u * u; s01 += u * v; s02 += u * w; s03 += u * q;
      s11 += v * v; s12 += v * w; s13 += v * q;
      s22 += w * w; s23 += w * q;
      s33 += q * q;
      r0 += u * rhs; r1 += v * rhs; r2 += w * rhs; r3 += q * rhs;
    }
    var delta = solve4([s00, s01, s02, s03, s01, s11, s12, s13, s02, s12, s22, s23, s03, s13, s23, s33], [r0, r1, r2, r3]);
    if (!delta) return null;
    var A = delta[0];
    var C = 1 - A;
    var D = delta[1];
    var E = delta[2];
    var F = delta[3];
    if (A < 1e-4 || C < 1e-4) return null;
    var cx = -D / (2 * A);
    var cy = -E / (2 * C);
    var scale = A * cx * cx + C * cy * cy - F;
    if (!(scale > 0.2)) return null;
    var rx2 = scale / A;
    var ry2 = scale / C;
    if (!(rx2 > 9) || !(ry2 > 9)) return null;
    var rx = Math.sqrt(rx2);
    var ry = Math.sqrt(ry2);
    if (cx < minX - 2 || cx > maxX + 2 || cy < minY - 2 || cy > maxY + 2) return null;
    var aspect = Math.max(rx, ry) / Math.min(rx, ry);
    if (aspect < 1.16 || aspect > 4.6) return null;
    if (Math.abs(rx * 2 - bw) > Math.max(3.2, bw * 0.18)) return null;
    if (Math.abs(ry * 2 - bh) > Math.max(3.2, bh * 0.18)) return null;
    var worst = 0;
    for (i = 0; i < n; i++) {
      var dx = ring[i][0] - cx;
      var dy = ring[i][1] - cy;
      var rad = Math.hypot(dx / rx, dy / ry);
      var err = Math.abs(rad - 1) * Math.hypot(dx, dy);
      if (err > worst) worst = err;
    }
    var allow = Math.max(1.35, Math.min(rx, ry) * 0.11);
    if (worst > allow || worst > 2.8) return null;
    if (Math.abs(area(ring)) < rx * ry * 2.2) return null;
    return { cx: cx, cy: cy, rx: rx, ry: ry, worst: worst };
  }

  function kappaEllipse(fit, sign) {
    var kappa = 0.5522847498;
    var cx = fit.cx;
    var cy = fit.cy;
    var rx = fit.rx;
    var ry = fit.ry;
    var poles = sign < 0
      ? [[cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]]
      : [[cx + rx, cy], [cx, cy - ry], [cx - rx, cy], [cx, cy + ry]];
    var segs = [];
    var i;
    for (i = 0; i < 4; i++) {
      var a = poles[i];
      var b = poles[(i + 1) % 4];
      var ax = (a[0] - cx) / rx;
      var ay = (a[1] - cy) / ry;
      var bx = (b[0] - cx) / rx;
      var by = (b[1] - cy) / ry;
      var tax = ay * sign;
      var tay = -ax * sign;
      var tbx = by * sign;
      var tby = -bx * sign;
      segs.push({
        k: "C",
        c: [
          a,
          [a[0] + kappa * rx * tax, a[1] + kappa * ry * tay],
          [b[0] - kappa * rx * tbx, b[1] - kappa * ry * tby],
          b
        ],
        pts: [a, b]
      });
    }
    return { start: poles[0], segs: segs };
  }

  function kappaCircle(fit, sign) {
    var kappa = 0.5522847498;
    var cx = fit.cx;
    var cy = fit.cy;
    var r = fit.r;
    var poles = sign < 0
      ? [[cx + r, cy], [cx, cy + r], [cx - r, cy], [cx, cy - r]]
      : [[cx + r, cy], [cx, cy - r], [cx - r, cy], [cx, cy + r]];
    var segs = [];
    var i;
    for (i = 0; i < 4; i++) {
      var a = poles[i];
      var b = poles[(i + 1) % 4];
      var rax = (a[0] - cx) / r;
      var ray = (a[1] - cy) / r;
      var rbx = (b[0] - cx) / r;
      var rby = (b[1] - cy) / r;
      var tax = ray * sign;
      var tay = -rax * sign;
      var tbx = rby * sign;
      var tby = -rbx * sign;
      segs.push({
        k: "C",
        c: [
          a,
          [a[0] + kappa * r * tax, a[1] + kappa * r * tay],
          [b[0] - kappa * r * tbx, b[1] - kappa * r * tby],
          b
        ],
        pts: [a, b]
      });
    }
    return { start: poles[0], segs: segs };
  }

  function ellipseSlack(ring) {
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < ring.length; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var rx = (maxX - minX) / 2;
    var ry = (maxY - minY) / 2;
    if (rx < 8 || ry < 8) return 1;
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var worst = 0;
    var nx, ny, err;
    for (i = 0; i < ring.length; i++) {
      nx = (ring[i][0] - cx) / rx;
      ny = (ring[i][1] - cy) / ry;
      err = Math.abs(Math.hypot(nx, ny) - 1);
      if (err > worst) worst = err;
    }
    return worst;
  }

  function ellipsePoles(ring) {
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < ring.length; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var rx = (maxX - minX) / 2;
    var ry = (maxY - minY) / 2;
    var poles = [[cx + rx, cy], [cx - rx, cy], [cx, cy - ry], [cx, cy + ry]];
    var order = [];
    for (i = 0; i < poles.length; i++) {
      var best = 0;
      var bestD = 1e12;
      var k, d;
      for (k = 0; k < ring.length; k++) {
        d = Math.hypot(ring[k][0] - poles[i][0], ring[k][1] - poles[i][1]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      order.push({ i: best, p: poles[i] });
    }
    order.sort(function (a, b) { return a.i - b.i; });
    var kappa = 0.5522847498;
    var segs = [];
    for (i = 0; i < order.length; i++) {
      var a = order[i].p;
      var b = order[(i + 1) % order.length].p;
      var ax = (a[0] - cx) / rx;
      var ay = (a[1] - cy) / ry;
      var bx = (b[0] - cx) / rx;
      var by = (b[1] - cy) / ry;
      var sign = ax * by - ay * bx >= 0 ? 1 : -1;
      var tax = -ay * sign;
      var tay = ax * sign;
      var tbx = -by * sign;
      var tby = bx * sign;
      var cubic = [
        a,
        [a[0] + kappa * rx * tax, a[1] + kappa * ry * tay],
        [b[0] - kappa * rx * tbx, b[1] - kappa * ry * tby],
        b
      ];
      segs.push({ k: "C", c: cubic, pts: [a, b] });
    }
    return { start: order[0].p, segs: segs };
  }

  function ovalFit(ring, tol) {
    var n = ring.length;
    if (n >= 8) {
      var fitted = circleFit(ring);
      if (fitted) {
        var wind = 0;
        var wi;
        for (wi = 0; wi < n; wi++) {
          var wj = (wi + 1) % n;
          wind += ring[wi][0] * ring[wj][1] - ring[wj][0] * ring[wi][1];
        }
        return kappaCircle(fitted, wind < 0 ? -1 : 1);
      }
      var oval = ellipseFit(ring);
      if (oval) {
        var owind = 0;
        var oi;
        for (oi = 0; oi < n; oi++) {
          var oj = (oi + 1) % n;
          owind += ring[oi][0] * ring[oj][1] - ring[oj][0] * ring[oi][1];
        }
        return kappaEllipse(oval, owind < 0 ? -1 : 1);
      }
    }
    if (n < 16) return null;
    var slack = ellipseSlack(ring);
    var round = slack <= 0.075 && !hasSharp(ring);
    var i, a, b, c;
    if (!round) {
      for (i = 0; i < n; i++) {
        a = ring[(i + n - 1) % n];
        b = ring[i];
        c = ring[(i + 1) % n];
        if (axisCorner(a, b, c)) return null;
      }
      if (straightCuts(ring).length || sideRuns(ring).length) return null;
    }
    var minX = 0;
    var maxX = 0;
    var minY = 0;
    var maxY = 0;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < ring[minX][0]) minX = i;
      if (ring[i][0] > ring[maxX][0]) maxX = i;
      if (ring[i][1] < ring[minY][1]) minY = i;
      if (ring[i][1] > ring[maxY][1]) maxY = i;
    }
    var poles = [minX, maxX, minY, maxY];
    var uniq = [];
    for (i = 0; i < poles.length; i++) if (uniq.indexOf(poles[i]) < 0) uniq.push(poles[i]);
    if (uniq.length < 4) return null;
    uniq.sort(function (a, b) { return a - b; });
    var bw = ring[maxX][0] - ring[minX][0];
    var bh = ring[maxY][1] - ring[minY][1];
    if (bw < 18 || bh < 18) return null;
    if (Math.abs(area(ring)) < bw * bh * 0.62) return null;
    if (round) return ellipsePoles(ring);
    var segs = [];
    var allow = Math.max(tol, 2.35);
    function fitOvalSpan(span, depth) {
      var fit = fitTight(span);
      var err = cubicError(span, fit.cubic, fit.ts);
      if (err.max <= allow || depth > 1 || span.length < 8) {
        if (err.max > allow * 1.8) return null;
        return [{ k: "C", c: fit.cubic, pts: span }];
      }
      var mid = (span.length / 2) | 0;
      var left = fitOvalSpan(span.slice(0, mid + 1), depth + 1);
      var right = fitOvalSpan(span.slice(mid), depth + 1);
      if (!left || !right) return null;
      return left.concat(right);
    }
    for (i = 0; i < uniq.length; i++) {
      var from = uniq[i];
      var to = uniq[(i + 1) % uniq.length];
      var span = [];
      var idx = from;
      var guard = 0;
      span.push(ring[idx]);
      do {
        idx = (idx + 1) % n;
        span.push(ring[idx]);
        guard++;
      } while (idx !== to && guard <= n);
      if (span.length < 4 || chordBow(span) < 1.4) return null;
      var piece = fitOvalSpan(span, 0);
      if (!piece) return null;
      segs = segs.concat(piece);
    }
    if (segs.length > 8) return null;
    return { start: ring[uniq[0]], segs: segs };
  }



  function stadiumFit(ring) {
    var n = ring.length;
    if (n < 12) return null;
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var bw = maxX - minX;
    var bh = maxY - minY;
    if (bw < 18 || bh < 18) return null;
    var horizontal = bw >= bh * 1.28;
    var vertical = bh >= bw * 1.28;
    if (!horizontal && !vertical) return null;
    var r = (horizontal ? bh : bw) / 2;
    if (r < 8) return null;
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var reach = (horizontal ? bw : bh) / 2 - r;
    if (reach < r * 0.45) return null;
    var c0 = horizontal ? cx - reach : cy - reach;
    var c1 = horizontal ? cx + reach : cy + reach;
    var worst = 0;
    var onSide = 0;
    for (i = 0; i < n; i++) {
      var err;
      if (horizontal) {
        if (ring[i][0] >= c0 - 1.2 && ring[i][0] <= c1 + 1.2) {
          err = Math.min(Math.abs(ring[i][1] - minY), Math.abs(ring[i][1] - maxY));
          onSide++;
        } else {
          var ccx = ring[i][0] < cx ? c0 : c1;
          err = Math.abs(Math.hypot(ring[i][0] - ccx, ring[i][1] - cy) - r);
        }
      } else {
        if (ring[i][1] >= c0 - 1.2 && ring[i][1] <= c1 + 1.2) {
          err = Math.min(Math.abs(ring[i][0] - minX), Math.abs(ring[i][0] - maxX));
          onSide++;
        } else {
          var ccy = ring[i][1] < cy ? c0 : c1;
          err = Math.abs(Math.hypot(ring[i][0] - cx, ring[i][1] - ccy) - r);
        }
      }
      if (err > worst) worst = err;
    }
    if (onSide < 2) return null;
    if (worst > Math.max(1.85, r * 0.09)) return null;
    var wind = 0;
    var wj;
    for (i = 0; i < n; i++) {
      wj = (i + 1) % n;
      wind += ring[i][0] * ring[wj][1] - ring[wj][0] * ring[i][1];
    }
    var sign = wind < 0 ? -1 : 1;
    var segs = [];
    var start;
    if (horizontal) {
      var topL = [c0, minY];
      var topR = [c1, minY];
      var botR = [c1, maxY];
      var botL = [c0, maxY];
      var right = [c1 + r, cy];
      var left = [c0 - r, cy];
      if (sign < 0) {
        start = topL;
        segs.push({ k: "L", p: topR.slice() });
        segs.push(quarterCubic(topR, right, c1, cy, r, sign));
        segs.push(quarterCubic(right, botR, c1, cy, r, sign));
        segs.push({ k: "L", p: botL.slice() });
        segs.push(quarterCubic(botL, left, c0, cy, r, sign));
        segs.push(quarterCubic(left, topL, c0, cy, r, sign));
      } else {
        start = topR;
        segs.push({ k: "L", p: topL.slice() });
        segs.push(quarterCubic(topL, left, c0, cy, r, sign));
        segs.push(quarterCubic(left, botL, c0, cy, r, sign));
        segs.push({ k: "L", p: botR.slice() });
        segs.push(quarterCubic(botR, right, c1, cy, r, sign));
        segs.push(quarterCubic(right, topR, c1, cy, r, sign));
      }
    } else {
      var leftT = [minX, c0];
      var leftB = [minX, c1];
      var rightB = [maxX, c1];
      var rightT = [maxX, c0];
      var bottom = [cx, c1 + r];
      var top = [cx, c0 - r];
      if (sign < 0) {
        start = leftT;
        segs.push({ k: "L", p: leftB.slice() });
        segs.push(quarterCubic(leftB, bottom, cx, c1, r, -sign));
        segs.push(quarterCubic(bottom, rightB, cx, c1, r, -sign));
        segs.push({ k: "L", p: rightT.slice() });
        segs.push(quarterCubic(rightT, top, cx, c0, r, -sign));
        segs.push(quarterCubic(top, leftT, cx, c0, r, -sign));
      } else {
        start = leftB;
        segs.push({ k: "L", p: leftT.slice() });
        segs.push(quarterCubic(leftT, top, cx, c0, r, -sign));
        segs.push(quarterCubic(top, rightT, cx, c0, r, -sign));
        segs.push({ k: "L", p: rightB.slice() });
        segs.push(quarterCubic(rightB, bottom, cx, c1, r, -sign));
        segs.push(quarterCubic(bottom, leftB, cx, c1, r, -sign));
      }
    }
    return { start: start, segs: segs };
  }

  function quarterCubic(a, b, cx, cy, r, sign) {
    var kappa = 0.5522847498;
    var ax = (a[0] - cx) / r;
    var ay = (a[1] - cy) / r;
    var bx = (b[0] - cx) / r;
    var by = (b[1] - cy) / r;
    var tax = ay * sign;
    var tay = -ax * sign;
    var tbx = by * sign;
    var tby = -bx * sign;
    return {
      k: "C",
      c: [a.slice(), [a[0] + kappa * r * tax, a[1] + kappa * r * tay], [b[0] - kappa * r * tbx, b[1] - kappa * r * tby], b.slice()]
    };
  }

  function semicircleFit(ring) {
    var n = ring.length;
    if (n < 12 || n > 240) return null;
    var best = null;
    var i, k, span, along, step, bow, nxt, fit;
    for (i = 0; i < n; i++) {
      span = [ring[i]];
      along = 0;
      k = i;
      while (span.length < n - 5) {
        nxt = (k + 1) % n;
        step = Math.hypot(ring[nxt][0] - ring[k][0], ring[nxt][1] - ring[k][1]);
        span.push(ring[nxt]);
        along += step;
        bow = chordBow(span);
        if (bow > 1.65 || (along > 16 && bow > along * 0.04)) break;
        k = nxt;
        if (along >= 18 && bow <= 1.4) {
          fit = scoreSemi(ring, i, k);
          if (fit && (!best || fit.err < best.err - 0.05 || (Math.abs(fit.err - best.err) <= 0.05 && fit.chord > best.chord))) best = fit;
        }
        if (along > 320) break;
      }
    }
    if (!best) return null;
    return emitSemi(best);
  }

  function scoreSemi(ring, i, k) {
    var a = ring[i];
    var b = ring[k];
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var chord = Math.hypot(dx, dy);
    if (chord < 16) return null;
    var cx = (a[0] + b[0]) / 2;
    var cy = (a[1] + b[1]) / 2;
    var r = chord / 2;
    var arc = [];
    var j = k;
    var guard = 0;
    var arcLen = 0;
    while (j !== i && guard < ring.length) {
      var nxt = (j + 1) % ring.length;
      arcLen += Math.hypot(ring[nxt][0] - ring[j][0], ring[nxt][1] - ring[j][1]);
      arc.push(ring[j]);
      j = nxt;
      guard++;
    }
    if (arc.length < 6 || arcLen < chord * 1.15 || arcLen > chord * 2.4) return null;
    var nx = -dy / chord;
    var ny = dx / chord;
    var side = 0;
    var sideAt = 0;
    var worst = 0;
    var far = 0;
    var t, px, py, cross, err, depth;
    for (t = 0; t < arc.length; t++) {
      px = arc[t][0] - cx;
      py = arc[t][1] - cy;
      cross = px * nx + py * ny;
      if (Math.abs(cross) > Math.abs(sideAt)) {
        sideAt = cross;
        side = cross >= 0 ? 1 : -1;
      }
    }
    if (!side) return null;
    for (t = 0; t < arc.length; t++) {
      px = arc[t][0] - cx;
      py = arc[t][1] - cy;
      cross = px * nx + py * ny;
      if (cross * side < -1.8) return null;
      err = Math.abs(Math.hypot(px, py) - r);
      if (err > worst) worst = err;
      depth = cross * side;
      if (depth > far) far = depth;
    }
    if (worst > Math.max(2.05, r * 0.085)) return null;
    if (far < r * 0.78) return null;
    return {
      a: a,
      b: b,
      pole: [cx + nx * side * r, cy + ny * side * r],
      cx: cx,
      cy: cy,
      r: r,
      err: worst,
      chord: chord
    };
  }

  function emitSemi(fit) {
    var expect = semiMid(fit.a, fit.pole, fit.cx, fit.cy, fit.r);
    var signs = [1, -1];
    var pick = 1;
    var bestErr = 1e9;
    var s, cubic, mid, err;
    for (s = 0; s < signs.length; s++) {
      cubic = quarterCubic(fit.a, fit.pole, fit.cx, fit.cy, fit.r, signs[s]);
      mid = bezier(cubic.c[0], cubic.c[1], cubic.c[2], cubic.c[3], 0.5);
      err = Math.hypot(mid[0] - expect[0], mid[1] - expect[1]);
      if (err < bestErr) {
        bestErr = err;
        pick = signs[s];
      }
    }
    if (bestErr > 2.4) return null;
    return {
      start: fit.a.slice(),
      segs: [
        quarterCubic(fit.a, fit.pole, fit.cx, fit.cy, fit.r, pick),
        quarterCubic(fit.pole, fit.b, fit.cx, fit.cy, fit.r, pick),
        { k: "L", p: fit.a.slice() }
      ]
    };
  }

  function semiMid(a, pole, cx, cy, r) {
    var ax = a[0] - cx;
    var ay = a[1] - cy;
    var px = pole[0] - cx;
    var py = pole[1] - cy;
    var al = Math.hypot(ax, ay) || 1;
    var pl = Math.hypot(px, py) || 1;
    var mx = ax / al + px / pl;
    var my = ay / al + py / pl;
    var ml = Math.hypot(mx, my) || 1;
    return [cx + mx / ml * r, cy + my / ml * r];
  }


  function dCapFit(ring) {
    var n = ring.length;
    if (n < 12) return null;
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var bw = maxX - minX;
    var bh = maxY - minY;
    if (bw < 18 || bh < 18) return null;
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var caps = ["right", "left", "bottom", "top"];
    var best = null;
    var c;
    for (c = 0; c < caps.length; c++) {
      var cap = caps[c];
      var horizontal = cap === "right" || cap === "left";
      var r = (horizontal ? bh : bw) / 2;
      var reach = (horizontal ? bw : bh) - r;
      if (r < 8 || reach < r * 0.55) continue;
      var ccx = cx;
      var ccy = cy;
      if (cap === "right") ccx = maxX - r;
      else if (cap === "left") ccx = minX + r;
      else if (cap === "bottom") ccy = maxY - r;
      else ccy = minY + r;
      var worst = 0;
      var onFlat = 0;
      var onArc = 0;
      var onSide = 0;
      for (i = 0; i < n; i++) {
        var px = ring[i][0];
        var py = ring[i][1];
        var err;
        var onCapSide = horizontal ? ((cap === "right" && px >= ccx - 1.2) || (cap === "left" && px <= ccx + 1.2)) : ((cap === "bottom" && py >= ccy - 1.2) || (cap === "top" && py <= ccy + 1.2));
        if (onCapSide) {
          err = Math.abs(Math.hypot(px - ccx, py - ccy) - r);
          onArc++;
        } else if (horizontal) {
          var flatX = cap === "right" ? minX : maxX;
          var wall = Math.abs(px - flatX);
          var side = Math.min(Math.abs(py - minY), Math.abs(py - maxY));
          err = Math.min(wall, side);
          if (wall <= side + 0.4) onFlat++;
          else onSide++;
        } else {
          var flatY = cap === "bottom" ? minY : maxY;
          var wallY = Math.abs(py - flatY);
          var sideX = Math.min(Math.abs(px - minX), Math.abs(px - maxX));
          err = Math.min(wallY, sideX);
          if (wallY <= sideX + 0.4) onFlat++;
          else onSide++;
        }
        if (err > worst) worst = err;
      }
      if (onFlat < 2 || onArc < 4) continue;
      if (onSide < 1 && reach < r * 1.2) continue;
      if (worst > Math.max(1.85, r * 0.09)) continue;
      if (!best || worst < best.worst) best = { cap: cap, worst: worst, ccx: ccx, ccy: ccy, r: r };
    }
    if (!best) return null;
    var wind = 0;
    var wj;
    for (i = 0; i < n; i++) {
      wj = (i + 1) % n;
      wind += ring[i][0] * ring[wj][1] - ring[wj][0] * ring[i][1];
    }
    var sign = wind < 0 ? -1 : 1;
    var segs = [];
    var start;
    if (best.cap === "right" || best.cap === "left") {
      var wallX = best.cap === "right" ? minX : maxX;
      var capX = best.ccx;
      var topW = [wallX, minY];
      var topC = [capX, minY];
      var botC = [capX, maxY];
      var botW = [wallX, maxY];
      var pole = [best.cap === "right" ? maxX : minX, cy];
      var arcSign = best.cap === "right" ? sign : -sign;
      if ((best.cap === "right" && sign < 0) || (best.cap === "left" && sign > 0)) {
        start = topW;
        segs.push({ k: "L", p: topC.slice() });
        segs.push(quarterCubic(topC, pole, capX, cy, best.r, -arcSign));
        segs.push(quarterCubic(pole, botC, capX, cy, best.r, -arcSign));
        segs.push({ k: "L", p: botW.slice() });
        segs.push({ k: "L", p: topW.slice() });
      } else {
        start = botW;
        segs.push({ k: "L", p: botC.slice() });
        segs.push(quarterCubic(botC, pole, capX, cy, best.r, arcSign));
        segs.push(quarterCubic(pole, topC, capX, cy, best.r, arcSign));
        segs.push({ k: "L", p: topW.slice() });
        segs.push({ k: "L", p: botW.slice() });
      }
    } else {
      var wallY = best.cap === "bottom" ? minY : maxY;
      var capY = best.ccy;
      var leftW = [minX, wallY];
      var leftC = [minX, capY];
      var rightC = [maxX, capY];
      var rightW = [maxX, wallY];
      var vpole = [cx, best.cap === "bottom" ? maxY : minY];
      var vSign = best.cap === "bottom" ? -sign : sign;
      if ((best.cap === "bottom" && sign < 0) || (best.cap === "top" && sign > 0)) {
        start = leftW;
        segs.push({ k: "L", p: leftC.slice() });
        segs.push(quarterCubic(leftC, vpole, cx, capY, best.r, -vSign));
        segs.push(quarterCubic(vpole, rightC, cx, capY, best.r, -vSign));
        segs.push({ k: "L", p: rightW.slice() });
        segs.push({ k: "L", p: leftW.slice() });
      } else {
        start = rightW;
        segs.push({ k: "L", p: rightC.slice() });
        segs.push(quarterCubic(rightC, vpole, cx, capY, best.r, vSign));
        segs.push(quarterCubic(vpole, leftC, cx, capY, best.r, vSign));
        segs.push({ k: "L", p: leftW.slice() });
        segs.push({ k: "L", p: rightW.slice() });
      }
    }
    return { start: start, segs: segs };
  }

  function arcCircle(pts) {
    var n = pts.length;
    if (n < 6) return null;
    var cx = 0;
    var cy = 0;
    var i;
    for (i = 0; i < n; i++) {
      cx += pts[i][0];
      cy += pts[i][1];
    }
    cx /= n;
    cy /= n;
    var r = 0;
    for (i = 0; i < n; i++) r += Math.hypot(pts[i][0] - cx, pts[i][1] - cy);
    r /= n;
    if (r < 8 || r > 480) return null;
    var step, dx, dy, dist, ex, ey, err, j00, j01, j02, j11, j12, j22, g0, g1, g2, delta;
    for (step = 0; step < 6; step++) {
      j00 = 0;
      j01 = 0;
      j02 = 0;
      j11 = 0;
      j12 = 0;
      j22 = 0;
      g0 = 0;
      g1 = 0;
      g2 = 0;
      for (i = 0; i < n; i++) {
        dx = pts[i][0] - cx;
        dy = pts[i][1] - cy;
        dist = Math.hypot(dx, dy) || 1e-6;
        ex = dx / dist;
        ey = dy / dist;
        err = dist - r;
        j00 += ex * ex;
        j01 += ex * ey;
        j02 += ex;
        j11 += ey * ey;
        j12 += ey;
        j22 += 1;
        g0 += ex * err;
        g1 += ey * err;
        g2 += err;
      }
      delta = solve3(j00, j01, j02, j11, j12, j22, g0, g1, g2);
      if (!delta) break;
      if (Math.abs(delta[2]) > r * 0.4) break;
      cx += delta[0];
      cy += delta[1];
      r += delta[2];
      if (r < 6) return null;
    }
    return { cx: cx, cy: cy, r: r };
  }

  function arcSweep(a, b, cx, cy, sign) {
    var a0 = Math.atan2(a[1] - cy, a[0] - cx);
    var a1 = Math.atan2(b[1] - cy, b[0] - cx);
    var sweep = a1 - a0;
    if (sign > 0) {
      while (sweep <= 0.04) sweep += Math.PI * 2;
    } else {
      while (sweep >= -0.04) sweep -= Math.PI * 2;
    }
    return Math.abs(sweep);
  }

  function arcCubics(a, b, cx, cy, r, sign) {
    var a0 = Math.atan2(a[1] - cy, a[0] - cx);
    var left = arcSweep(a, b, cx, cy, sign);
    var ang = a0;
    var segs = [];
    var guard = 0;
    var step, nxt, p0, p1, k, t0x, t0y, t1x, t1y;
    while (left > 0.07 && guard < 5) {
      step = Math.min(left, Math.PI / 2);
      nxt = ang + (sign > 0 ? step : -step);
      p0 = [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
      p1 = [cx + Math.cos(nxt) * r, cy + Math.sin(nxt) * r];
      if (!segs.length) p0 = a.slice();
      if (left - step <= 0.07) p1 = b.slice();
      k = (4 / 3) * Math.tan(step / 4);
      t0x = -Math.sin(ang) * sign;
      t0y = Math.cos(ang) * sign;
      t1x = -Math.sin(nxt) * sign;
      t1y = Math.cos(nxt) * sign;
      segs.push({
        k: "C",
        c: [p0, [p0[0] + k * r * t0x, p0[1] + k * r * t0y], [p1[0] - k * r * t1x, p1[1] - k * r * t1y], p1]
      });
      ang = nxt;
      left -= step;
      guard++;
    }
    return segs;
  }

  function arcSign(arc, a, b, cx, cy) {
    var vx = b[0] - a[0];
    var vy = b[1] - a[1];
    var side = 0;
    var t;
    for (t = 0; t < arc.length; t++) {
      side += (arc[t][0] - a[0]) * vy - (arc[t][1] - a[1]) * vx;
    }
    if (Math.abs(side) < 1) return 0;
    var cross = (a[0] - cx) * (b[1] - cy) - (a[1] - cy) * (b[0] - cx);
    if (Math.abs(cross) < 0.4) return side > 0 ? -1 : 1;
    return (side > 0) === (cross > 0) ? 1 : -1;
  }

  function straightRun(ring, i, dir) {
    var n = ring.length;
    var span = [ring[i]];
    var along = 0;
    var k = i;
    var guard = 0;
    var nxt, step, bow;
    while (guard < n - 4) {
      nxt = (k + dir + n) % n;
      step = Math.hypot(ring[nxt][0] - ring[k][0], ring[nxt][1] - ring[k][1]);
      span.push(ring[nxt]);
      along += step;
      bow = chordBow(span);
      if (bow > 2.2) {
        span.pop();
        break;
      }
      k = nxt;
      guard++;
      if (along > 280) break;
    }
    return { end: k, span: span, along: along, bow: chordBow(span) };
  }

  function circumcircle(a, b, c) {
    var d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-3) return null;
    var a2 = a[0] * a[0] + a[1] * a[1];
    var b2 = b[0] * b[0] + b[1] * b[1];
    var c2 = c[0] * c[0] + c[1] * c[1];
    var cx = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    var cy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    var r = Math.hypot(a[0] - cx, a[1] - cy);
    if (!(r > 8 && r < 900)) return null;
    return { cx: cx, cy: cy, r: r };
  }

  function cuspPairs(ring) {
    var n = ring.length;
    var turns = [];
    var i, prev, next, gap;
    for (i = 0; i < n; i++) {
      prev = ring[(i + n - 1) % n];
      next = ring[(i + 1) % n];
      turns.push(turnAt(prev, ring[i], next));
    }
    var peaks = [];
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.62) continue;
      if (turns[i] + 0.04 < turns[(i + n - 1) % n] || turns[i] + 0.04 < turns[(i + 1) % n]) continue;
      if (!peaks.length || (i - peaks[peaks.length - 1]) > 4) peaks.push(i);
      else if (turns[i] > turns[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i;
    }
    if (peaks.length > 1 && (peaks[0] + n - peaks[peaks.length - 1]) <= 4) {
      if (turns[peaks[0]] > turns[peaks[peaks.length - 1]]) peaks.pop();
      else peaks.shift();
    }
    if (peaks.length !== 2) return null;
    gap = (peaks[1] - peaks[0] + n) % n;
    if (gap < 6 || n - gap < 6) return null;
    if (turns[peaks[0]] < 0.78 || turns[peaks[1]] < 0.78) return null;
    return peaks;
  }

  function spanPoints(ring, from, to) {
    var pts = [ring[from]];
    var i = from;
    var guard = 0;
    while (i !== to && guard < ring.length) {
      i = (i + 1) % ring.length;
      pts.push(ring[i]);
      guard++;
    }
    return pts;
  }

  function scoreArc(pts) {
    var a = pts[0];
    var b = pts[pts.length - 1];
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var chord = Math.hypot(dx, dy);
    if (chord < 8) return null;
    var bowAt = 1;
    var bow = 0;
    var i, cross;
    for (i = 1; i < pts.length - 1; i++) {
      cross = Math.abs((pts[i][0] - a[0]) * dy - (pts[i][1] - a[1]) * dx) / chord;
      if (cross > bow) {
        bow = cross;
        bowAt = i;
      }
    }
    if (bow < 3.2) return null;
    var fit = circumcircle(a, b, pts[bowAt]);
    if (!fit) return null;
    var worst = 0;
    var err;
    for (i = 0; i < pts.length; i++) {
      err = Math.abs(Math.hypot(pts[i][0] - fit.cx, pts[i][1] - fit.cy) - fit.r);
      if (err > worst) worst = err;
    }
    if (worst > Math.max(2.6, fit.r * 0.08)) return null;
    var sign = arcSign(pts, a, b, fit.cx, fit.cy);
    if (!sign) return null;
    var sweep = arcSweep(a, b, fit.cx, fit.cy, sign);
    if (sweep < 0.55 || sweep > 4.7) return null;
    fit.sign = sign;
    fit.err = worst;
    fit.sweep = sweep;
    return fit;
  }


  function heartFit(ring) {
    var n = ring.length;
    if (n < 12 || n > 900) return null;
    var shoelace = 0;
    var i, j;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      shoelace += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
    }
    if (Math.abs(shoelace) < 40) return null;
    var wind = shoelace > 0 ? 1 : -1;
    var turns = new Array(n);
    var signed = new Array(n);
    var a, b, c, v1x, v1y, v2x, v2y, cross, dot;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      v1x = b[0] - a[0];
      v1y = b[1] - a[1];
      v2x = c[0] - b[0];
      v2y = c[1] - b[1];
      cross = v1x * v2y - v1y * v2x;
      dot = v1x * v2x + v1y * v2y;
      signed[i] = Math.atan2(cross, dot);
      turns[i] = Math.abs(signed[i]);
    }
    var peaks = [];
    var best, k, d, stepLen;
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.7) continue;
      best = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 6) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 6) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.04) best = false;
        k = (k + n - 1) % n;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 6) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 6) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.04) best = false;
        k = (k + 1) % n;
      }
      if (best) peaks.push(i);
    }
    var kept = [];
    var gap;
    for (i = 0; i < peaks.length; i++) {
      if (!kept.length) {
        kept.push(peaks[i]);
        continue;
      }
      gap = Math.hypot(ring[peaks[i]][0] - ring[kept[kept.length - 1]][0], ring[peaks[i]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 7) {
        if (turns[peaks[i]] > turns[kept[kept.length - 1]]) kept[kept.length - 1] = peaks[i];
        continue;
      }
      kept.push(peaks[i]);
    }
    if (kept.length > 1) {
      gap = Math.hypot(ring[kept[0]][0] - ring[kept[kept.length - 1]][0], ring[kept[0]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 7) {
        if (turns[kept[kept.length - 1]] > turns[kept[0]]) kept[0] = kept[kept.length - 1];
        kept.pop();
      }
    }
    if (kept.length !== 2) return null;
    if (signed[kept[0]] * wind > 0 && signed[kept[1]] * wind < 0) {
      a = 0;
      b = 1;
    } else if (signed[kept[1]] * wind > 0 && signed[kept[0]] * wind < 0) {
      a = 1;
      b = 0;
    } else return null;
    if (turns[kept[a]] < 0.85 || turns[kept[b]] < 0.7) return null;
    var tip = ring[kept[a]];
    var cleft = ring[kept[b]];
    var minX = ring[0][0];
    var maxX = ring[0][0];
    var minY = ring[0][1];
    var maxY = ring[0][1];
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var bw = maxX - minX;
    var bh = maxY - minY;
    if (bw < 16 || bh < 16) return null;
    if (bh < bw * 0.72 || bh > bw * 1.55) return null;
    if (Math.min(Math.abs(tip[1] - minY), Math.abs(tip[1] - maxY)) > 3.2) return null;
    var farY = Math.abs(tip[1] - minY) < Math.abs(tip[1] - maxY) ? maxY : minY;
    if (Math.abs(cleft[1] - farY) > bh * 0.42) return null;
    if (cleft[0] < minX + bw * 0.28 || cleft[0] > maxX - bw * 0.28) return null;
    if (Math.abs(cleft[0] - tip[0]) > bw * 0.22) return null;
    var lobeA = spanPoints(ring, kept[0], kept[1]);
    var lobeB = spanPoints(ring, kept[1], kept[0]);
    if (chordBow(lobeA) < 6 || chordBow(lobeB) < 6) return null;
    var segsA = fitSpan(lobeA, 2.4, 0);
    var segsB = fitSpan(lobeB, 2.4, 0);
    if (segsA.length < 1 || segsA.length > 3 || segsB.length < 1 || segsB.length > 3) return null;
    for (i = 0; i < segsA.length; i++) if (segsA[i].k !== "C") return null;
    for (i = 0; i < segsB.length; i++) if (segsB[i].k !== "C") return null;
    return { start: ring[kept[0]].slice(), segs: segsA.concat(segsB) };
  }

  function crescentFit(ring) {
    var n = ring.length;
    if (n < 16 || n > 720) return null;
    var peaks = cuspPairs(ring);
    if (!peaks) return null;
    var a = peaks[0];
    var b = peaks[1];
    var fa = scoreArc(spanPoints(ring, a, b));
    var fb = scoreArc(spanPoints(ring, b, a));
    if (!fa || !fb) return null;
    var apart = Math.hypot(fa.cx - fb.cx, fa.cy - fb.cy);
    if (apart < Math.max(4.5, Math.min(fa.r, fb.r) * 0.12)) return null;
    var cubics = arcCubics(ring[a], ring[b], fa.cx, fa.cy, fa.r, fa.sign);
    var back = arcCubics(ring[b], ring[a], fb.cx, fb.cy, fb.r, fb.sign);
    if (cubics.length < 1 || cubics.length > 3 || back.length < 1 || back.length > 3) return null;
    return { start: ring[a].slice(), segs: cubics.concat(back) };
  }

  function segmentFit(ring) {

    var n = ring.length;
    if (n < 14 || n > 720) return null;
    var best = null;
    var i, span, along, k, nxt, step, bow, fit;
    for (i = 0; i < n; i++) {
      span = [ring[i]];
      along = 0;
      k = i;
      while (span.length < n - 6) {
        nxt = (k + 1) % n;
        step = Math.hypot(ring[nxt][0] - ring[k][0], ring[nxt][1] - ring[k][1]);
        span.push(ring[nxt]);
        along += step;
        bow = chordBow(span);
        if (bow > 2.15) break;
        k = nxt;
        if (along >= 14 && bow <= 1.9) {
          fit = scoreSegment(ring, i, k, along);
          if (fit && (!best || fit.chord > best.chord + 0.8 || (Math.abs(fit.chord - best.chord) <= 0.8 && fit.err < best.err))) best = fit;
        }
        if (along > 340) break;
      }
    }
    if (!best) return null;
    return emitSegment(best);
  }

  function scoreSegment(ring, i, k, chordLen) {
    var a = ring[i];
    var b = ring[k];
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord < 14 || chordLen > chord * 1.22) return null;
    var arc = [];
    var j = k;
    var guard = 0;
    var arcLen = 0;
    while (j !== i && guard < ring.length) {
      var nxt = (j + 1) % ring.length;
      arcLen += Math.hypot(ring[nxt][0] - ring[j][0], ring[nxt][1] - ring[j][1]);
      arc.push(ring[j]);
      j = nxt;
      guard++;
    }
    if (arc.length < 6 || arcLen < chord * 0.7) return null;
    var samples = arc.concat([a]);
    var fit = arcCircle(samples);
    if (!fit) return null;
    var worst = 0;
    var t, err, turn;
    for (t = 0; t < arc.length; t++) {
      err = Math.abs(Math.hypot(arc[t][0] - fit.cx, arc[t][1] - fit.cy) - fit.r);
      if (err > worst) worst = err;
    }
    err = Math.abs(Math.hypot(a[0] - fit.cx, a[1] - fit.cy) - fit.r);
    if (err > worst) worst = err;
    err = Math.abs(Math.hypot(b[0] - fit.cx, b[1] - fit.cy) - fit.r);
    if (err > worst) worst = err;
    if (worst > Math.max(2.35, fit.r * 0.08)) return null;
    var sign = arcSign(arc, b, a, fit.cx, fit.cy);
    if (!sign) return null;
    var sweep = arcSweep(b, a, fit.cx, fit.cy, sign);
    if (sweep < 0.58 || sweep > 2.75) return null;
    var depth = Math.abs((a[0] - fit.cx) * (b[1] - a[1]) - (a[1] - fit.cy) * (b[0] - a[0])) / chord;
    if (depth < fit.r * 0.08 || depth > fit.r * 0.82) return null;
    var expect = sweep * fit.r;
    if (arcLen < expect * 0.62 || arcLen > expect * 1.45) return null;
    return { a: a, b: b, cx: fit.cx, cy: fit.cy, r: fit.r, sign: sign, err: worst, chord: chord, sweep: sweep };
  }

  function emitSegment(fit) {
    var cubics = arcCubics(fit.b, fit.a, fit.cx, fit.cy, fit.r, fit.sign);
    if (!cubics.length || cubics.length > 3) return null;
    return {
      start: fit.a.slice(),
      segs: [{ k: "L", p: fit.b.slice() }].concat(cubics)
    };
  }

  function wedgeFit(ring) {
    var n = ring.length;
    if (n < 8 || n > 720) return null;
    var best = null;
    var i, back, fore, fit;
    for (i = 0; i < n; i++) {
      back = straightRun(ring, i, -1);
      fore = straightRun(ring, i, 1);
      if (back.along < 10 || fore.along < 10) continue;
      if (back.bow > 1.9 || fore.bow > 1.9) continue;
      fit = scoreWedge(ring, i, back.end, fore.end);
      if (fit && (!best || fit.err < best.err - 0.04 || (Math.abs(fit.err - best.err) <= 0.04 && fit.r > best.r))) best = fit;
    }
    if (!best) return null;
    return emitWedge(best);
  }

  function scoreWedge(ring, apex, back, fore) {
    var o = ring[apex];
    var a = ring[fore];
    var b = ring[back];
    var ra = Math.hypot(a[0] - o[0], a[1] - o[1]);
    var rb = Math.hypot(b[0] - o[0], b[1] - o[1]);
    if (ra < 12 || rb < 12) return null;
    if (Math.abs(ra - rb) > Math.max(3.2, Math.min(ra, rb) * 0.14)) return null;
    var r = (ra + rb) / 2;
    var dot = ((a[0] - o[0]) * (b[0] - o[0]) + (a[1] - o[1]) * (b[1] - o[1])) / (ra * rb);
    if (dot > 0.9 || dot < -0.2) return null;
    var arc = [];
    var j = fore;
    var guard = 0;
    var arcLen = 0;
    while (j !== back && guard < ring.length) {
      var nxt = (j + 1) % ring.length;
      arcLen += Math.hypot(ring[nxt][0] - ring[j][0], ring[nxt][1] - ring[j][1]);
      if (j !== fore) arc.push(ring[j]);
      j = nxt;
      guard++;
    }
    if (arc.length < 4 || arcLen < r * 0.35) return null;
    var peri = 0;
    var pi;
    for (pi = 0; pi < ring.length; pi++) peri += Math.hypot(ring[(pi + 1) % ring.length][0] - ring[pi][0], ring[(pi + 1) % ring.length][1] - ring[pi][1]);
    if (peri - arcLen > ra + rb + Math.max(6, r * 0.28)) return null;
    var worst = 0;
    var t, err, turn;
    for (t = 0; t < arc.length; t++) {
      err = Math.abs(Math.hypot(arc[t][0] - o[0], arc[t][1] - o[1]) - r);
      if (err > worst) worst = err;
      if (t > 0 && t < arc.length - 1) {
        turn = turnAt(arc[t - 1], arc[t], arc[t + 1]);
        if (turn > 0.9) return null;
      }
    }
    if (worst > Math.max(2.4, r * 0.09)) return null;
    var sign = arcSign(arc.length ? arc : [a], a, b, o[0], o[1]);
    if (!sign) return null;
    var sweep = arcSweep(a, b, o[0], o[1], sign);
    if (Math.abs(arcLen - sweep * r) > Math.abs(arcLen - (Math.PI * 2 - sweep) * r)) {
      sign = -sign;
      sweep = Math.PI * 2 - sweep;
    }
    if (sweep < 0.4 || sweep > 2.7) return null;
    return { o: o, a: a, b: b, cx: o[0], cy: o[1], r: r, sign: sign, err: worst };
  }

  function emitWedge(fit) {
    var cubics = arcCubics(fit.a, fit.b, fit.cx, fit.cy, fit.r, fit.sign);
    if (!cubics.length || cubics.length > 4) return null;
    return {
      start: fit.o.slice(),
      segs: [{ k: "L", p: fit.a.slice() }].concat(cubics).concat([{ k: "L", p: fit.o.slice() }])
    };
  }


  function squircleFit(ring) {
    var n = ring.length;
    if (n < 12) return null;
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var rx = (maxX - minX) / 2;
    var ry = (maxY - minY) / 2;
    if (rx < 12 || ry < 12) return null;
    var aspect = rx > ry ? rx / ry : ry / rx;
    if (aspect > 1.4) return null;
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    var worst = 0;
    var sum = 0;
    for (i = 0; i < n; i++) {
      var nx = (ring[i][0] - cx) / rx;
      var ny = (ring[i][1] - cy) / ry;
      if (Math.abs(nx) > 1.08 || Math.abs(ny) > 1.08) return null;
      var mag = Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4);
      var rad = Math.pow(Math.max(mag, 1e-9), 0.25);
      var err = Math.abs(rad - 1) * Math.min(rx, ry);
      if (err > worst) worst = err;
      sum += err;
    }
    if (worst > 2.6 || sum / n > 0.95) return null;
    function edgeSpan(sel) {
      var idx = [];
      var k;
      for (k = 0; k < n; k++) if (sel(k)) idx.push(k);
      if (idx.length < 2) return 0;
      var best = 0;
      var run = [idx[0]];
      for (k = 1; k <= idx.length; k++) {
        var cur = idx[k % idx.length];
        var prev = idx[(k - 1) % idx.length];
        var gap = (cur - prev + n) % n;
        if (k < idx.length && gap <= 2) run.push(cur);
        else {
          if (run.length >= 2) {
            var a = ring[run[0]];
            var b = ring[run[run.length - 1]];
            var along = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (along > best) best = along;
          }
          run = [cur];
        }
      }
      return best;
    }
    var flat = Math.max(
      edgeSpan(function (k) { return Math.abs(Math.abs(ring[k][0] - cx) / rx - 1) < 0.012; }),
      edgeSpan(function (k) { return Math.abs(Math.abs(ring[k][1] - cy) / ry - 1) < 0.012; })
    );
    if (flat > Math.min(rx, ry) * 0.45) return null;
    var poles = [[cx + rx, cy], [cx - rx, cy], [cx, cy - ry], [cx, cy + ry]];
    var order = [];
    for (i = 0; i < poles.length; i++) {
      var best = 0;
      var bestD = 1e12;
      var k, d;
      for (k = 0; k < n; k++) {
        d = Math.hypot(ring[k][0] - poles[i][0], ring[k][1] - poles[i][1]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      if (bestD > Math.min(rx, ry) * 0.32) return null;
      order.push({ i: best, p: poles[i] });
    }
    order.sort(function (a, b) { return a.i - b.i; });
    for (i = 1; i < order.length; i++) if (order[i].i === order[i - 1].i) return null;
    var h = 0.92;
    var segs = [];
    for (i = 0; i < order.length; i++) {
      var a = order[i].p;
      var b = order[(i + 1) % order.length].p;
      var atx = -(a[1] - cy) / ry * rx;
      var aty = (a[0] - cx) / rx * ry;
      var alen = Math.hypot(atx, aty) || 1;
      atx /= alen;
      aty /= alen;
      if (atx * (b[0] - a[0]) + aty * (b[1] - a[1]) < 0) {
        atx = -atx;
        aty = -aty;
      }
      var btx = -(b[1] - cy) / ry * rx;
      var bty = (b[0] - cx) / rx * ry;
      var blen = Math.hypot(btx, bty) || 1;
      btx /= blen;
      bty /= blen;
      if (btx * (b[0] - a[0]) + bty * (b[1] - a[1]) < 0) {
        btx = -btx;
        bty = -bty;
      }
      var as = Math.abs(a[0] - cx) > Math.abs(a[1] - cy) ? ry : rx;
      var bs = Math.abs(b[0] - cx) > Math.abs(b[1] - cy) ? ry : rx;
      segs.push({
        k: "C",
        c: [a, [a[0] + atx * h * as, a[1] + aty * h * as], [b[0] - btx * h * bs, b[1] - bty * h * bs], b]
      });
    }
    return { start: order[0].p, segs: segs };
  }

  function roundRectFit(ring) {
    var n = ring.length;
    if (n < 6) return null;
    var kind = new Array(n);
    var i, dx, dy, ax, ay;
    for (i = 0; i < n; i++) {
      var nxt = ring[(i + 1) % n];
      dx = nxt[0] - ring[i][0];
      dy = nxt[1] - ring[i][1];
      ax = Math.abs(dx);
      ay = Math.abs(dy);
      if (ax >= 4 && ay <= 1.8 && ax >= ay * 2.6) kind[i] = "h";
      else if (ay >= 4 && ax <= 1.8 && ay >= ax * 2.6) kind[i] = "v";
      else kind[i] = "c";
    }
    var runs = [];
    var seen = new Array(n);
    for (i = 0; i < n; i++) {
      if (kind[i] === "c" || seen[i]) continue;
      var run = [i];
      seen[i] = 1;
      var j = (i + 1) % n;
      while (kind[j] === kind[i] && !seen[j]) {
        seen[j] = 1;
        run.push(j);
        j = (j + 1) % n;
      }
      var back = (i + n - 1) % n;
      while (kind[back] === kind[i] && !seen[back]) {
        seen[back] = 1;
        run.unshift(back);
        back = (back + n - 1) % n;
      }
      var a = ring[run[0]];
      var b = ring[(run[run.length - 1] + 1) % n];
      var along = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (along < 16) continue;
      var levels = [];
      var k;
      for (k = 0; k < run.length; k++) levels.push(kind[i] === "h" ? ring[run[k]][1] : ring[run[k]][0]);
      levels.push(kind[i] === "h" ? b[1] : b[0]);
      levels.sort(function (p, q) { return p - q; });
      runs.push({
        start: run[0],
        end: (run[run.length - 1] + 1) % n,
        axis: kind[i],
        along: along,
        level: levels[levels.length >> 1]
      });
    }
    if (runs.length !== 4) return null;
    var left = runs.slice();
    var ordered = [left.shift()];
    while (left.length) {
      var end = ordered[ordered.length - 1].end;
      var best = -1;
      var bestGap = n;
      for (i = 0; i < left.length; i++) {
        var gap = (left[i].start - end + n) % n;
        if (gap < bestGap) {
          bestGap = gap;
          best = i;
        }
      }
      if (best < 0 || bestGap > 8) return null;
      ordered.push(left.splice(best, 1)[0]);
    }
    var segs = [];
    var start = null;
    var winds = [];
    var fillets = 0;
    for (i = 0; i < 4; i++) {
      var side = ordered[i];
      var next = ordered[(i + 1) % 4];
      if (side.axis === next.axis) return null;
      var a = side.axis === "h" ? [ring[side.end][0], side.level] : [side.level, ring[side.end][1]];
      var origin = side.axis === "h" ? [ring[side.start][0], side.level] : [side.level, ring[side.start][1]];
      var b = next.axis === "h" ? [ring[next.start][0], next.level] : [next.level, ring[next.start][1]];
      var dest = next.axis === "h" ? [ring[next.end][0], next.level] : [next.level, ring[next.end][1]];
      var inDir = norm(a[0] - origin[0], a[1] - origin[1]);
      var outDir = norm(dest[0] - b[0], dest[1] - b[1]);
      if (Math.abs(inDir[0] * outDir[0] + inDir[1] * outDir[1]) > 0.25) return null;
      winds.push(inDir[0] * outDir[1] - inDir[1] * outDir[0]);
      var hit = lineCross(origin, a, b, dest);
      if (!hit) return null;
      var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var inset = Math.hypot(hit[0] - (a[0] + b[0]) * 0.5, hit[1] - (a[1] + b[1]) * 0.5);
      if (!start) start = origin.slice();
      if (chord < 4.6) {
        if (Math.hypot(hit[0] - origin[0], hit[1] - origin[1]) < 1.4) return null;
        segs.push({ k: "L", p: hit.slice() });
        fillets++;
        continue;
      }
      if (chord > 48) return null;
      if (chord > Math.min(side.along, next.along) * 0.85) return null;
      if (inset < 2.2) return null;
      var span = [ring[side.end]];
      var idx = side.end;
      var guard = 0;
      while (idx !== next.start && guard <= n) {
        idx = (idx + 1) % n;
        span.push(ring[idx]);
        guard++;
      }
      var bow = chordBow(span);
      var prevPt = ring[(side.end + n - 1) % n];
      var nextPt = ring[(next.start + 1) % n];
      var driftIn = side.axis === "h" ? Math.abs(prevPt[1] - side.level) : Math.abs(prevPt[0] - side.level);
      var driftOut = next.axis === "h" ? Math.abs(nextPt[1] - next.level) : Math.abs(nextPt[0] - next.level);
      if (chord >= 14 && bow < 0.55 && driftIn < 0.45 && driftOut < 0.45) {
        segs.push({ k: "L", p: a.slice() });
        segs.push({ k: "L", p: b.slice() });
        fillets++;
        continue;
      }
      var h = 0.5522847498 * chord / Math.SQRT2;
      segs.push({ k: "L", p: a.slice() });
      segs.push({
        k: "C",
        c: [a.slice(), [a[0] + inDir[0] * h, a[1] + inDir[1] * h], [b[0] - outDir[0] * h, b[1] - outDir[1] * h], b.slice()]
      });
      fillets++;
    }
    if (!fillets) return null;
    if (winds[0] > 0.7 && winds[1] > 0.7 && winds[2] > 0.7 && winds[3] > 0.7) return { start: start, segs: segs };
    if (winds[0] < -0.7 && winds[1] < -0.7 && winds[2] < -0.7 && winds[3] < -0.7) return { start: start, segs: segs };
    return null;
  }


  function endStair(span) {
    if (!span || span.length < 3) return false;
    var a = span[0];
    var b = span[span.length - 1];
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord < 16) return false;
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var mid = 0;
    var end = 0;
    var i, along, cross, dist;
    for (i = 1; i < span.length - 1; i++) {
      along = ((span[i][0] - a[0]) * dx + (span[i][1] - a[1]) * dy) / chord;
      cross = (span[i][0] - a[0]) * dy - (span[i][1] - a[1]) * dx;
      dist = Math.abs(cross) / chord;
      if (along > 8 && along < chord - 8) {
        if (dist > mid) mid = dist;
      } else if (dist > end) end = dist;
    }
    return mid <= 1.45 && end <= 3.6;
  }

  function quadFit(ring) {
    var n = ring.length;
    if (n < 8 || n > 180) return null;
    var win = 4.6;
    function step(i, dir) {
      var walked = 0;
      var j = i;
      var guard = 0;
      var prev = ring[j];
      while (walked < win && guard < n) {
        j = (j + dir + n) % n;
        walked += Math.hypot(ring[j][0] - prev[0], ring[j][1] - prev[1]);
        prev = ring[j];
        guard++;
      }
      return j;
    }
    var turns = new Array(n);
    var i, best, k, d, stepLen, peaks, span, bow, len, lens, lo, hi, segs, a, b, gap, weak, weakAt;
    for (i = 0; i < n; i++) turns[i] = turnAt(ring[step(i, -1)], ring[i], ring[step(i, 1)]);
    peaks = [];
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.72 || turns[i] > 2.35) continue;
      best = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 5.5) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 5.5) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.05) best = false;
        k = (k + n - 1) % n;
        if (k === i) break;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 5.5) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 5.5) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.05) best = false;
        k = (k + 1) % n;
        if (k === i) break;
      }
      if (best) peaks.push(i);
    }
    if (peaks.length < 4 || peaks.length > 8) return null;
    var kept = [];
    for (i = 0; i < peaks.length; i++) {
      if (!kept.length) {
        kept.push(peaks[i]);
        continue;
      }
      gap = Math.hypot(ring[peaks[i]][0] - ring[kept[kept.length - 1]][0], ring[peaks[i]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 6.4) {
        if (turns[peaks[i]] > turns[kept[kept.length - 1]]) kept[kept.length - 1] = peaks[i];
        continue;
      }
      kept.push(peaks[i]);
    }
    if (kept.length > 1) {
      gap = Math.hypot(ring[kept[0]][0] - ring[kept[kept.length - 1]][0], ring[kept[0]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 6.4) {
        if (turns[kept[kept.length - 1]] > turns[kept[0]]) kept[0] = kept[kept.length - 1];
        kept.pop();
      }
    }
    if (kept.length === 5) {
      weak = 0;
      weakAt = 0;
      for (i = 0; i < kept.length; i++) {
        if (turns[kept[i]] < turns[kept[weakAt]]) weakAt = i;
      }
      a = kept[(weakAt + 4) % 5];
      b = kept[(weakAt + 1) % 5];
      span = [ring[a]];
      k = a;
      while (k !== b) {
        k = (k + 1) % n;
        span.push(ring[k]);
        if (span.length > n) return null;
      }
      if (distPointSeg(ring[kept[weakAt]], ring[a], ring[b]) <= 1.85 && turns[kept[weakAt]] + 0.28 < Math.min(turns[a], turns[b])) {
        kept.splice(weakAt, 1);
      }
    }
    if (kept.length !== 4) return null;
    lens = [];
    for (i = 0; i < 4; i++) {
      if (turns[kept[i]] < 0.78 || turns[kept[i]] > 2.35) return null;
      a = kept[i];
      b = kept[(i + 1) % 4];
      span = [ring[a]];
      k = a;
      while (k !== b) {
        k = (k + 1) % n;
        span.push(ring[k]);
        if (span.length > n) return null;
      }
      bow = chordBow(span);
      len = Math.hypot(ring[b][0] - ring[a][0], ring[b][1] - ring[a][1]);
      if (len < 8) return null;
      if (bow > 1.65 && !endStair(span)) return null;
      lens.push(len);
    }
    lo = lens[0];
    hi = lens[0];
    for (i = 1; i < lens.length; i++) {
      if (lens[i] < lo) lo = lens[i];
      if (lens[i] > hi) hi = lens[i];
    }
    if (hi > lo * 4.8) return null;
    segs = [];
    for (i = 1; i < 4; i++) segs.push({ k: "L", p: ring[kept[i]].slice(), pts: [ring[kept[i - 1]], ring[kept[i]]] });
    segs.push({ k: "L", p: ring[kept[0]].slice(), pts: [ring[kept[3]], ring[kept[0]]] });
    return { start: ring[kept[0]].slice(), segs: segs };
  }

  function polygonFit(ring) {
    var n = ring.length;
    if (n < 6 || n > 96) return null;
    var win = n <= 18 ? 3.4 : 5.4;
    function step(i, dir) {
      var walked = 0;
      var j = i;
      var guard = 0;
      var prev = ring[j];
      while (walked < win && guard < n) {
        j = (j + dir + n) % n;
        walked += Math.hypot(ring[j][0] - prev[0], ring[j][1] - prev[1]);
        prev = ring[j];
        guard++;
      }
      return j;
    }
    var turns = new Array(n);
    var i, best, k, d, stepLen, peaks, span, bow, len, lens, lo, hi, segs, a, b, gap;
    for (i = 0; i < n; i++) turns[i] = turnAt(ring[step(i, -1)], ring[i], ring[step(i, 1)]);
    peaks = [];
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.4 || turns[i] > 1.45) continue;
      best = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 4.2) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 4.2) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.06) best = false;
        k = (k + n - 1) % n;
        if (k === i) break;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 4.2) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 4.2) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.06) best = false;
        k = (k + 1) % n;
        if (k === i) break;
      }
      if (best) peaks.push(i);
    }
    if (peaks.length < 5 || peaks.length > 16) return null;
    var kept = [];
    for (i = 0; i < peaks.length; i++) {
      if (!kept.length) {
        kept.push(peaks[i]);
        continue;
      }
      gap = Math.hypot(ring[peaks[i]][0] - ring[kept[kept.length - 1]][0], ring[peaks[i]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 5.1) {
        if (turns[peaks[i]] > turns[kept[kept.length - 1]]) kept[kept.length - 1] = peaks[i];
        continue;
      }
      kept.push(peaks[i]);
    }
    if (kept.length > 1) {
      gap = Math.hypot(ring[kept[0]][0] - ring[kept[kept.length - 1]][0], ring[kept[0]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 5.1) {
        if (turns[kept[kept.length - 1]] > turns[kept[0]]) kept[0] = kept[kept.length - 1];
        kept.pop();
      }
    }
    if (kept.length !== 5 && kept.length !== 6 && kept.length !== 8) return null;
    peaks = kept;
    var turnLo = peaks.length === 5 ? 0.64 : peaks.length === 6 ? 0.52 : 0.48;
    var turnHi = peaks.length === 5 ? 1.45 : peaks.length === 6 ? 1.22 : 0.95;
    var bowCap = peaks.length === 5 ? 2.05 : peaks.length === 6 ? 1.85 : 1.35;
    var bowRatio = peaks.length === 5 ? 0.13 : peaks.length === 6 ? 0.11 : 0.06;
    for (i = 0; i < peaks.length; i++) {
      if (turns[peaks[i]] < turnLo || turns[peaks[i]] > turnHi) return null;
    }
    lens = [];
    for (i = 0; i < peaks.length; i++) {
      a = peaks[i];
      b = peaks[(i + 1) % peaks.length];
      span = [ring[a]];
      k = a;
      while (k !== b) {
        k = (k + 1) % n;
        span.push(ring[k]);
        if (span.length > n) return null;
      }
      bow = chordBow(span);
      len = Math.hypot(ring[b][0] - ring[a][0], ring[b][1] - ring[a][1]);
      if (len < 5.6) return null;
      if (bow > bowCap && bow > len * bowRatio) return null;
      lens.push(len);
    }
    lo = lens[0];
    hi = lens[0];
    for (i = 1; i < lens.length; i++) {
      if (lens[i] < lo) lo = lens[i];
      if (lens[i] > hi) hi = lens[i];
    }
    if (lo < 5.6 || hi > lo * 1.45) return null;
    segs = [];
    for (i = 1; i < peaks.length; i++) segs.push({ k: "L", p: ring[peaks[i]].slice(), pts: [ring[peaks[i - 1]], ring[peaks[i]]] });
    segs.push({ k: "L", p: ring[peaks[0]].slice(), pts: [ring[peaks[peaks.length - 1]], ring[peaks[0]]] });
    return { start: ring[peaks[0]].slice(), segs: segs };
  }


  function straightPolyFit(ring) {
    var n = ring.length;
    if (n < 6 || n > 980) return null;
    var win = 4.4;
    function step(i, dir) {
      var walked = 0;
      var j = i;
      var guard = 0;
      var prev = ring[j];
      while (walked < win && guard < n) {
        j = (j + dir + n) % n;
        walked += Math.hypot(ring[j][0] - prev[0], ring[j][1] - prev[1]);
        prev = ring[j];
        guard++;
      }
      return j;
    }
    var turns = new Array(n);
    var i, best, k, d, stepLen, peaks, span, bow, len, gap, reflex, segs, a, b;
    for (i = 0; i < n; i++) turns[i] = turnAt(ring[step(i, -1)], ring[i], ring[step(i, 1)]);
    peaks = [];
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.66 || turns[i] > 3.05) continue;
      best = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 6.2) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 6.2) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.04) best = false;
        k = (k + n - 1) % n;
        if (k === i) break;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 6.2) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 6.2) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.04) best = false;
        k = (k + 1) % n;
        if (k === i) break;
      }
      if (best) peaks.push(i);
    }
    var kept = [];
    for (i = 0; i < peaks.length; i++) {
      if (!kept.length) {
        kept.push(peaks[i]);
        continue;
      }
      gap = Math.hypot(ring[peaks[i]][0] - ring[kept[kept.length - 1]][0], ring[peaks[i]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 7.2) {
        if (turns[peaks[i]] > turns[kept[kept.length - 1]]) kept[kept.length - 1] = peaks[i];
        continue;
      }
      kept.push(peaks[i]);
    }
    if (kept.length > 1) {
      gap = Math.hypot(ring[kept[0]][0] - ring[kept[kept.length - 1]][0], ring[kept[0]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 7.2) {
        if (turns[kept[kept.length - 1]] > turns[kept[0]]) kept[0] = kept[kept.length - 1];
        kept.pop();
      }
    }
    if (kept.length < 4 || kept.length > 12) return null;
    reflex = 0;
    var lens = [];
    for (i = 0; i < kept.length; i++) {
      if (turns[kept[i]] > 2.42) reflex++;
      a = kept[i];
      b = kept[(i + 1) % kept.length];
      span = [ring[a]];
      k = a;
      while (k !== b) {
        k = (k + 1) % n;
        span.push(ring[k]);
        if (span.length > n) return null;
      }
      bow = chordBow(span);
      len = Math.hypot(ring[b][0] - ring[a][0], ring[b][1] - ring[a][1]);
      if (len < 8) return null;
      if (bow > (kept.length >= 6 ? 3.35 : 2.65)) return null;
      if (turns[kept[i]] < 0.62) return null;
      lens.push(len);
    }
    if (kept.length <= 5) {
      if (reflex < 1 || reflex > 2) return null;
    } else if (reflex > 6) return null;
    var lo = lens[0];
    var hi = lens[0];
    for (i = 1; i < lens.length; i++) {
      if (lens[i] < lo) lo = lens[i];
      if (lens[i] > hi) hi = lens[i];
    }
    if (kept.length >= 8 && hi < lo * 1.55) return null;
    segs = [];
    for (i = 1; i < kept.length; i++) segs.push({ k: "L", p: ring[kept[i]].slice(), pts: [ring[kept[i - 1]], ring[kept[i]]] });
    segs.push({ k: "L", p: ring[kept[0]].slice(), pts: [ring[kept[kept.length - 1]], ring[kept[0]]] });
    return { start: ring[kept[0]].slice(), segs: segs };
  }

  function dropFit(ring) {
    var n = ring.length;
    if (n < 16 || n > 900) return null;
    var shoelace = 0;
    var i, j;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      shoelace += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
    }
    if (Math.abs(shoelace) < 80) return null;
    var wind = shoelace > 0 ? 1 : -1;
    var turns = new Array(n);
    var signed = new Array(n);
    var a, b, c, v1x, v1y, v2x, v2y, cross, dot;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      v1x = b[0] - a[0];
      v1y = b[1] - a[1];
      v2x = c[0] - b[0];
      v2y = c[1] - b[1];
      cross = v1x * v2y - v1y * v2x;
      dot = v1x * v2x + v1y * v2y;
      signed[i] = Math.atan2(cross, dot);
      turns[i] = Math.abs(signed[i]);
    }
    var tip = -1;
    var tipTurn = 0.82;
    var k, d, stepLen, local;
    for (i = 0; i < n; i++) {
      if (signed[i] * wind <= 0 || turns[i] < tipTurn) continue;
      local = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 5) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 5) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.04) local = false;
        k = (k + n - 1) % n;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 5) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 5) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.04) local = false;
        k = (k + 1) % n;
      }
      if (local) {
        tip = i;
        tipTurn = turns[i];
      }
    }
    if (tip < 0) return null;
    var other = 0;
    for (i = 0; i < n; i++) {
      if (i === tip) continue;
      if (signed[i] * wind > 0 && turns[i] > 0.7) {
        d = Math.min((i - tip + n) % n, (tip - i + n) % n);
        if (d > 4) other++;
      }
    }
    if (other > 0) return null;
    var far = [];
    var tipP = ring[tip];
    var reach = 0;
    for (i = 0; i < n; i++) {
      d = Math.hypot(ring[i][0] - tipP[0], ring[i][1] - tipP[1]);
      if (d > reach) reach = d;
    }
    if (reach < 16) return null;
    for (i = 0; i < n; i++) {
      d = Math.hypot(ring[i][0] - tipP[0], ring[i][1] - tipP[1]);
      if (d > reach * 0.42) far.push(ring[i]);
    }
    if (far.length < 8) return null;
    var fit = dropCircle(far);
    if (!fit || fit.r < 8) return null;
    var on = new Array(n);
    var err, onCount = 0;
    for (i = 0; i < n; i++) {
      err = Math.abs(Math.hypot(ring[i][0] - fit.cx, ring[i][1] - fit.cy) - fit.r);
      on[i] = err < 2.5;
      if (on[i]) onCount++;
    }
    if (onCount < n * 0.45) return null;
    function shoulder(dir) {
      var idx = tip;
      var guard = 0;
      var seen = 0;
      while (guard < n - 1) {
        idx = (idx + dir + n) % n;
        if (on[idx]) seen++;
        else seen = 0;
        if (seen >= 3) return (idx - dir * 2 + n * 3) % n;
        guard++;
      }
      return -1;
    }
    var fore = shoulder(1);
    var back = shoulder(-1);
    if (fore < 0 || back < 0 || fore === back || fore === tip || back === tip) return null;
    var legA = Math.hypot(ring[fore][0] - tipP[0], ring[fore][1] - tipP[1]);
    var legB = Math.hypot(ring[back][0] - tipP[0], ring[back][1] - tipP[1]);
    if (legA < 7 || legB < 7) return null;
    if (legA > legB * 2.8 || legB > legA * 2.8) return null;
    function legBow(from, to) {
      var worst = 0;
      var idx = from;
      var guard = 0;
      while (idx !== to && guard < n) {
        err = distPointSeg(ring[idx], ring[from], ring[to]);
        if (err > worst) worst = err;
        idx = (idx + 1) % n;
        guard++;
      }
      return worst;
    }
    var shortFore = (fore - tip + n) % n;
    var shortBack = (tip - back + n) % n;
    if (shortFore + shortBack > n * 0.55) return null;
    if (legBow(tip, fore) > 3.6 || legBow(back, tip) > 3.6) return null;
    var body = [];
    var idx = fore;
    var guard = 0;
    var bodyWorst = 0;
    while (idx !== back && guard < n) {
      body.push(ring[idx]);
      err = Math.abs(Math.hypot(ring[idx][0] - fit.cx, ring[idx][1] - fit.cy) - fit.r);
      if (err > bodyWorst) bodyWorst = err;
      idx = (idx + 1) % n;
      guard++;
    }
    body.push(ring[back]);
    if (body.length < 8 || bodyWorst > 2.8) return null;
    var tipDist = Math.hypot(tipP[0] - fit.cx, tipP[1] - fit.cy);
    if (tipDist < fit.r + Math.max(5, fit.r * 0.16)) return null;
    return emitDrop(tipP, ring[fore], ring[back], body, fit);
  }

  function dropCircle(pts) {
    var n = pts.length;
    var sx = 0;
    var sy = 0;
    var sxx = 0;
    var syy = 0;
    var sxy = 0;
    var sx3 = 0;
    var sy3 = 0;
    var sxxy = 0;
    var sxyy = 0;
    var i, x, y;
    for (i = 0; i < n; i++) {
      x = pts[i][0];
      y = pts[i][1];
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
      sx3 += x * x * x;
      sy3 += y * y * y;
      sxxy += x * x * y;
      sxyy += x * y * y;
    }
    var a1 = 2 * (sx * sx - n * sxx);
    var b1 = 2 * (sx * sy - n * sxy);
    var c1 = sx * (sxx + syy) - n * (sx3 + sxyy);
    var a2 = b1;
    var b2 = 2 * (sy * sy - n * syy);
    var c2 = sy * (sxx + syy) - n * (sy3 + sxxy);
    var det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-6) return null;
    var cx = (c1 * b2 - c2 * b1) / det;
    var cy = (a1 * c2 - a2 * c1) / det;
    var r = 0;
    for (i = 0; i < n; i++) r += Math.hypot(pts[i][0] - cx, pts[i][1] - cy);
    r /= n;
    if (!isFinite(cx) || !isFinite(cy) || !isFinite(r) || r < 6) return null;
    return { cx: cx, cy: cy, r: r };
  }

  function emitDrop(tip, a, b, body, fit) {
    function onCircle(p) {
      var dx = p[0] - fit.cx;
      var dy = p[1] - fit.cy;
      var len = Math.hypot(dx, dy) || 1;
      return [fit.cx + dx / len * fit.r, fit.cy + dy / len * fit.r];
    }
    var pa = onCircle(a);
    var pb = onCircle(b);
    var angA = Math.atan2(pa[1] - fit.cy, pa[0] - fit.cx);
    var mid = body[body.length >> 1];
    var angM = Math.atan2(mid[1] - fit.cy, mid[0] - fit.cx);
    var angB = Math.atan2(pb[1] - fit.cy, pb[0] - fit.cx);
    function unwrap(from, to) {
      var delta = to - from;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      while (delta > Math.PI) delta -= Math.PI * 2;
      return delta;
    }
    var toMid = unwrap(angA, angM);
    var toEnd = unwrap(angA, angB);
    if (toMid * toEnd < 0) toEnd += toMid > 0 ? Math.PI * 2 : -Math.PI * 2;
    if (Math.abs(toEnd) < 2.2 || Math.abs(toEnd) > 6.05) return null;
    var segs = [{ k: "L", p: pa.slice() }];
    var cursor = 0;
    var steps = Math.ceil(Math.abs(toEnd) / (Math.PI / 2));
    if (steps < 2) steps = 2;
    if (steps > 4) steps = 4;
    var s, next;
    for (s = 1; s <= steps; s++) {
      next = toEnd * s / steps;
      segs.push(dropArc(angA + cursor, angA + next, fit.cx, fit.cy, fit.r));
      cursor = next;
    }
    segs.push({ k: "L", p: tip.slice() });
    return { start: tip.slice(), segs: segs };
  }

  function dropArc(aAng, bAng, cx, cy, r) {
    var a = [cx + Math.cos(aAng) * r, cy + Math.sin(aAng) * r];
    var b = [cx + Math.cos(bAng) * r, cy + Math.sin(bAng) * r];
    var sweep = bAng - aAng;
    var h = 4 / 3 * Math.tan(sweep / 4) * r;
    var tax = -Math.sin(aAng);
    var tay = Math.cos(aAng);
    var tbx = -Math.sin(bAng);
    var tby = Math.cos(bAng);
    return {
      k: "C",
      c: [a, [a[0] + h * tax, a[1] + h * tay], [b[0] - h * tbx, b[1] - h * tby], b],
      pts: [a, b]
    };
  }


  function roundTriFit(ring) {
    var n = ring.length;
if (n < 6 || n > 40) return null;
    var mark = new Array(n);
    var fillets = [];
    var i, a, b, c, ab, bc, bow, turn;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
      bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (ab < 1.15 || ab > 5.5 || bc < 1.15 || bc > 5.5) continue;
      if (Math.abs(ab - bc) > 1.8) continue;
      bow = distPointSeg(b, a, c);
      if (bow < 0.8 || bow > 3.2) continue;
      turn = turnAt(a, b, c);
      if (turn < 0.5 || turn > 2.4) continue;
      var prev = ring[(i + n - 2) % n];
      var next = ring[(i + 2) % n];
      if (Math.hypot(a[0] - prev[0], a[1] - prev[1]) < 8) continue;
      if (Math.hypot(next[0] - c[0], next[1] - c[1]) < 8) continue;
      var hit = lineCross(prev, a, c, next);
      if (!hit) continue;
      var rise = Math.hypot(hit[0] - b[0], hit[1] - b[1]);
      if (rise < 1.45 || rise > 8) continue;
      mark[i] = 1;
      fillets.push(i);
    }
    if (!fillets.length || fillets.length > 3) return null;
    var peaks = 0;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      if (turnAt(a, b, c) < 0.7) continue;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 6 && Math.hypot(c[0] - b[0], c[1] - b[1]) < 6) continue;
      peaks++;
    }
    if (peaks < 2 || peaks > 3) return null;
    var segs = [];
    var start = ring[(fillets[0] + n - 1) % n].slice();
    i = (fillets[0] + n - 1) % n;
    var guard = 0;
    var produced = 0;
    while (guard < n) {
      var at = (i + 1) % n;
      if (mark[at]) {
        a = ring[i];
        b = ring[at];
        c = ring[(at + 1) % n];
        var ix = b[0] - a[0];
        var iy = b[1] - a[1];
        var ox = c[0] - b[0];
        var oy = c[1] - b[1];
        var il = Math.hypot(ix, iy) || 1;
        var ol = Math.hypot(ox, oy) || 1;
        var h = Math.min(il, ol) * 0.55;
        segs.push({
          k: "C",
          c: [a, [a[0] + ix / il * h, a[1] + iy / il * h], [c[0] - ox / ol * h, c[1] - oy / ol * h], c],
          pts: [a, b, c]
        });
        produced++;
        i = (at + 1) % n;
      } else {
        segs.push({ k: "L", p: ring[at].slice(), pts: [ring[i], ring[at]] });
        i = at;
      }
      guard++;
      if (i === (fillets[0] + n - 1) % n) break;
    }
    if (produced !== fillets.length || segs.length < 4) return null;
    return { start: start, segs: segs };
  }


  function bubbleFit(ring) {
    var n = ring.length;
    if (n < 16 || n > 900) return null;
    var shoelace = 0;
    var i, j;
    for (i = 0; i < n; i++) {
      j = (i + 1) % n;
      shoelace += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
    }
    if (Math.abs(shoelace) < 100) return null;
    var wind = shoelace > 0 ? 1 : -1;
    var turns = new Array(n);
    var signed = new Array(n);
    var a, b, c, v1x, v1y, v2x, v2y, cross, dot;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      v1x = b[0] - a[0];
      v1y = b[1] - a[1];
      v2x = c[0] - b[0];
      v2y = c[1] - b[1];
      cross = v1x * v2y - v1y * v2x;
      dot = v1x * v2x + v1y * v2y;
      signed[i] = Math.atan2(cross, dot);
      turns[i] = Math.abs(signed[i]);
    }
    var extremes = [0, 0, 0, 0];
    for (i = 1; i < n; i++) {
      if (ring[i][0] < ring[extremes[0]][0]) extremes[0] = i;
      if (ring[i][0] > ring[extremes[1]][0]) extremes[1] = i;
      if (ring[i][1] < ring[extremes[2]][1]) extremes[2] = i;
      if (ring[i][1] > ring[extremes[3]][1]) extremes[3] = i;
    }
    var tip = -1;
    var tipScore = 0;
    var score, k, j, best;
    for (i = 0; i < 4; i++) {
      best = extremes[i];
      for (k = -4; k <= 4; k++) {
        j = (extremes[i] + k + n) % n;
        if (signed[j] * wind > 0 && turns[j] > turns[best]) best = j;
      }
      if (signed[best] * wind <= 0) continue;
      score = turns[best];
      if (score > tipScore) {
        tip = best;
        tipScore = score;
      }
    }
    if (tip < 0 || turns[tip] < 0.35) return null;
    var other = 0;
    var d;
    for (i = 0; i < n; i++) {
      if (i === tip) continue;
      if (signed[i] * wind > 0 && turns[i] > turns[tip] * 0.85 && turns[i] > 0.7) {
        d = Math.min((i - tip + n) % n, (tip - i + n) % n);
        if (d > 3) other++;
      }
    }
    if (other > 0) return null;
    var fit = bubblePoles(ring, tip);
    if (!fit) return null;
    var tipP = ring[tip];
    if (bubbleRadial(tipP, fit) < 1.22) return null;
    var left = bubbleShoulder(ring, tip, 1, fit);
    var right = bubbleShoulder(ring, tip, -1, fit);
    if (!left || !right) return null;
    if (Math.hypot(left.p[0] - tipP[0], left.p[1] - tipP[1]) < 7) return null;
    if (Math.hypot(right.p[0] - tipP[0], right.p[1] - tipP[1]) < 7) return null;
    if (bubbleBow(ring, tip, left.index, 1) > 2.6) return null;
    if (bubbleBow(ring, tip, right.index, -1) > 2.6) return null;
    var body = [];
    for (i = 0; i < n; i++) {
      if (bubbleRadial(ring[i], fit) < 1.12) body.push(ring[i]);
    }
    if (body.length < 8) return null;
    return emitBubble(tipP, left.p, right.p, body, fit);
  }

  function bubbleRadial(p, fit) {
    return Math.hypot((p[0] - fit.cx) / fit.rx, (p[1] - fit.cy) / fit.ry);
  }

  function bubblePoles(ring, tip) {
    var n = ring.length;
    var tipP = ring[tip];
    var minX = ring[0][0], maxX = minX, minY = ring[0][1], maxY = minY;
    var i;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var dx = tipP[0] - (minX + maxX) / 2;
    var dy = tipP[1] - (minY + maxY) / 2;
    var horizontal = Math.abs(dx) > Math.abs(dy);
    var cx, cy, rx, ry;
    if (!horizontal) {
      cx = (minX + maxX) / 2;
      rx = (maxX - minX) / 2;
      if (dy > 0) {
        var sideY = 0;
        var sideN = 0;
        for (i = 0; i < n; i++) {
          if (Math.abs(ring[i][0] - minX) < 1.4 || Math.abs(ring[i][0] - maxX) < 1.4) {
            sideY += ring[i][1];
            sideN++;
          }
        }
        if (!sideN) return null;
        cy = sideY / sideN;
        ry = cy - minY;
      } else {
        var sideY2 = 0;
        var sideN2 = 0;
        for (i = 0; i < n; i++) {
          if (Math.abs(ring[i][0] - minX) < 1.4 || Math.abs(ring[i][0] - maxX) < 1.4) {
            sideY2 += ring[i][1];
            sideN2++;
          }
        }
        if (!sideN2) return null;
        cy = sideY2 / sideN2;
        ry = maxY - cy;
      }
    } else {
      cy = (minY + maxY) / 2;
      ry = (maxY - minY) / 2;
      var sideX = 0;
      var sideN3 = 0;
      for (i = 0; i < n; i++) {
        if (Math.abs(ring[i][1] - minY) < 1.4 || Math.abs(ring[i][1] - maxY) < 1.4) {
          sideX += ring[i][0];
          sideN3++;
        }
      }
      if (!sideN3) return null;
      cx = sideX / sideN3;
      rx = dx > 0 ? cx - minX : maxX - cx;
    }
    if (!(rx > 10) || !(ry > 8)) return null;
    var aspect = Math.max(rx, ry) / Math.min(rx, ry);
    if (aspect < 1.18 || aspect > 3.2) return null;
    var worst = 0;
    var err, used = 0;
    for (i = 0; i < n; i++) {
      err = bubbleRadial(ring[i], { cx: cx, cy: cy, rx: rx, ry: ry });
      if (err > 1.08) continue;
      err = Math.abs(err - 1) * Math.min(rx, ry);
      used++;
      if (err > worst) worst = err;
    }
    if (used < 8 || worst > 2.8) return null;
    return { cx: cx, cy: cy, rx: rx, ry: ry };
  }

  function bubbleShoulder(ring, tip, dir, fit) {
    var n = ring.length;
    var i = tip;
    var walked = 0;
    var guard = 0;
    var p, prev;
    while (guard < n) {
      prev = ring[i];
      i = (i + dir + n) % n;
      p = ring[i];
      walked += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      guard++;
      if (walked < 5) continue;
      if (bubbleRadial(p, fit) < 1.06) return { p: bubbleOnEllipse(p, fit), index: i };
      if (walked > Math.max(fit.rx, fit.ry) * 1.6) return null;
    }
    return null;
  }

  function bubbleOnEllipse(p, fit) {
    var dx = p[0] - fit.cx;
    var dy = p[1] - fit.cy;
    var rad = Math.hypot(dx / fit.rx, dy / fit.ry) || 1;
    return [fit.cx + dx / rad, fit.cy + dy / rad];
  }

  function bubbleBow(ring, tip, end, dir) {
    var n = ring.length;
    var a = ring[tip];
    var b = ring[end];
    var i = (tip + dir + n) % n;
    var worst = 0;
    var guard = 0;
    var bow;
    while (i !== end && guard < n) {
      bow = distPointSeg(ring[i], a, b);
      if (bow > worst) worst = bow;
      i = (i + dir + n) % n;
      guard++;
    }
    return worst;
  }

  function emitBubble(tip, a, b, body, fit) {
    var angA = Math.atan2((a[1] - fit.cy) / fit.ry, (a[0] - fit.cx) / fit.rx);
    var angB = Math.atan2((b[1] - fit.cy) / fit.ry, (b[0] - fit.cx) / fit.rx);
    var tipAng = Math.atan2((tip[1] - fit.cy) / fit.ry, (tip[0] - fit.cx) / fit.rx);
    function unwrap(from, to) {
      var delta = to - from;
      while (delta <= -Math.PI) delta += Math.PI * 2;
      while (delta > Math.PI) delta -= Math.PI * 2;
      return delta;
    }
    function holds(sweep, ang) {
      var rel = unwrap(angA, ang);
      if (sweep > 0) return rel > 0.04 && rel < sweep - 0.04;
      return rel < -0.04 && rel > sweep + 0.04;
    }
    var short = unwrap(angA, angB);
    var long = short > 0 ? short - Math.PI * 2 : short + Math.PI * 2;
    var toEnd = holds(short, tipAng) ? long : short;
    if (Math.abs(toEnd) < 3.4 || Math.abs(toEnd) > 6.05) return null;
    var segs = [{ k: "L", p: a.slice() }];
    var steps = Math.ceil(Math.abs(toEnd) / (Math.PI / 2));
    if (steps < 2) steps = 2;
    if (steps > 4) steps = 4;
    var s, cursor = 0, next;
    for (s = 1; s <= steps; s++) {
      next = toEnd * s / steps;
      segs.push(bubbleArc(angA + cursor, angA + next, fit));
      cursor = next;
    }
    segs.push({ k: "L", p: tip.slice() });
    return { start: tip.slice(), segs: segs };
  }

  function bubbleArc(aAng, bAng, fit) {
    var a = [fit.cx + Math.cos(aAng) * fit.rx, fit.cy + Math.sin(aAng) * fit.ry];
    var b = [fit.cx + Math.cos(bAng) * fit.rx, fit.cy + Math.sin(bAng) * fit.ry];
    var sweep = bAng - aAng;
    var h = 4 / 3 * Math.tan(sweep / 4);
    var tax = -Math.sin(aAng) * fit.rx;
    var tay = Math.cos(aAng) * fit.ry;
    var tbx = -Math.sin(bAng) * fit.rx;
    var tby = Math.cos(bAng) * fit.ry;
    return {
      k: "C",
      c: [a, [a[0] + h * tax, a[1] + h * tay], [b[0] - h * tbx, b[1] - h * tby], b],
      pts: [a, b]
    };
  }

  function keyholeFit(ring) {
    var n = ring.length;
    if (n < 10 || n > 900) return null;
    function collect(from, to) {
      var span = [ring[from]];
      var p = from;
      var guard = 0;
      while (p !== to && guard <= n) {
        p = (p + 1) % n;
        span.push(ring[p]);
        guard++;
      }
      return span;
    }
    var runs = [];
    var i, run, len;
    for (i = 0; i < n; i++) {
      run = straightRun(ring, i, 1);
      if (run.end === i) continue;
      len = Math.hypot(ring[run.end][0] - ring[i][0], ring[run.end][1] - ring[i][1]);
      if (len < 12 || run.bow > 1.85) continue;
      runs.push({ i: i, end: run.end, len: len, dx: ring[run.end][0] - ring[i][0], dy: ring[run.end][1] - ring[i][1] });
    }
    if (runs.length < 3) return null;
    runs.sort(function (a, b) { return b.len - a.len; });
    var kept = [];
    for (i = 0; i < runs.length; i++) {
      var overlap = false;
      var k;
      for (k = 0; k < kept.length; k++) {
        if (runs[i].i === kept[k].i && runs[i].end === kept[k].end) overlap = true;
      }
      if (overlap) continue;
      kept.push(runs[i]);
      if (kept.length === 5) break;
    }
    if (kept.length < 3) return null;
    var best = null;
    var a, b, c;
    for (a = 0; a < kept.length; a++) {
      for (b = a + 1; b < kept.length; b++) {
        var l1 = kept[a].len;
        var l2 = kept[b].len;
        if (l2 < l1 * 0.62 || l1 < l2 * 0.62) continue;
        var dot = (kept[a].dx * kept[b].dx + kept[a].dy * kept[b].dy) / (l1 * l2);
        if (Math.abs(dot) < 0.88) continue;
        var across = Math.hypot(ring[kept[a].i][0] - ring[kept[b].i][0], ring[kept[a].i][1] - ring[kept[b].i][1]);
        if (across < 8) continue;
        for (c = 0; c < kept.length; c++) {
          if (c === a || c === b) continue;
          var l3 = kept[c].len;
          if (l3 < 8 || l3 > Math.max(l1, l2) * 1.4) continue;
          var capDot = Math.abs(kept[c].dx * kept[a].dx + kept[c].dy * kept[a].dy) / (l3 * l1);
          if (capDot > 0.38) continue;
          var capEnds = {};
          capEnds[kept[c].i] = 1;
          capEnds[kept[c].end] = 1;
          var neck = [];
          var ends = [kept[a].i, kept[a].end, kept[b].i, kept[b].end];
          var e;
          for (e = 0; e < ends.length; e++) {
            if (!capEnds[ends[e]] && neck.indexOf(ends[e]) < 0) neck.push(ends[e]);
          }
          if (neck.length !== 2) continue;
          var forward = collect(neck[0], neck[1]);
          var back = collect(neck[1], neck[0]);
          var head = chordBow(forward) >= chordBow(back) ? forward : back;
          var stem = head === forward ? back : forward;
          if (head.length < 5 || stem.length < 3) continue;
          if (chordBow(stem) < 6) continue;
          var cx = 0;
          var cy = 0;
          var s;
          for (s = 0; s < head.length; s++) {
            cx += head[s][0];
            cy += head[s][1];
          }
          cx /= head.length;
          cy /= head.length;
          var r = 0;
          for (s = 0; s < head.length; s++) r += Math.hypot(head[s][0] - cx, head[s][1] - cy);
          r /= head.length;
          if (r < 8 || r > 420) continue;
          var step, dx, dy, dist, ex, ey, err, j00, j01, j02, j11, j12, j22, g0, g1, g2, delta;
          for (step = 0; step < 6; step++) {
            j00 = 0;
            j01 = 0;
            j02 = 0;
            j11 = 0;
            j12 = 0;
            j22 = 0;
            g0 = 0;
            g1 = 0;
            g2 = 0;
            for (s = 0; s < head.length; s++) {
              dx = head[s][0] - cx;
              dy = head[s][1] - cy;
              dist = Math.hypot(dx, dy) || 1e-6;
              ex = dx / dist;
              ey = dy / dist;
              err = dist - r;
              j00 += ex * ex;
              j01 += ex * ey;
              j02 += ex;
              j11 += ey * ey;
              j12 += ey;
              j22 += 1;
              g0 += ex * err;
              g1 += ey * err;
              g2 += err;
            }
            delta = solve3(j00, j01, j02, j11, j12, j22, g0, g1, g2);
            if (!delta) break;
            if (Math.abs(delta[2]) > r * 0.35) break;
            cx += delta[0];
            cy += delta[1];
            r += delta[2];
            if (r < 7) break;
          }
          if (r < 7) continue;
          var worst = 0;
          for (s = 0; s < head.length; s++) {
            err = Math.abs(Math.hypot(head[s][0] - cx, head[s][1] - cy) - r);
            if (err > worst) worst = err;
          }
          if (worst > Math.max(2.6, r * 0.12)) continue;
          var pa = head[0];
          var pb = head[head.length - 1];
          if (Math.abs(Math.hypot(pa[0] - cx, pa[1] - cy) - r) > 3.4) continue;
          if (Math.abs(Math.hypot(pb[0] - cx, pb[1] - cy) - r) > 3.4) continue;
          var chord = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
          if (chord < r * 0.28 || chord > r * 1.78) continue;
          var walked = 0;
          var s0;
          for (s0 = 1; s0 < head.length; s0++) {
            var a0 = Math.atan2(head[s0 - 1][1] - cy, head[s0 - 1][0] - cx);
            var a1 = Math.atan2(head[s0][1] - cy, head[s0][0] - cx);
            var turn = a1 - a0;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            walked += turn;
          }
          var sign = walked >= 0 ? 1 : -1;
          var sweep = Math.abs(walked);
          if (sweep < 3.25 || sweep > 6.05) continue;
          var arcs = arcCubics(pa, pb, cx, cy, r, sign);
          if (!arcs || arcs.length < 2 || arcs.length > 4) continue;
          var segs = [
            { k: "L", p: stem[1].slice() },
            { k: "L", p: stem[stem.length - 2].slice() },
            { k: "L", p: stem[stem.length - 1].slice() }
          ].concat(arcs);
          if (!best || worst < best.worst) best = { worst: worst, start: stem[0].slice(), segs: segs };
        }
      }
    }
    if (!best) return null;
    return { start: best.start, segs: best.segs };
  }

  function spanArc(span) {
    if (!span || span.length < 8) return null;
    var fit = arcCircle(span);
    if (!fit) return null;
    var a = span[0];
    var b = span[span.length - 1];
    var worst = 0;
    var i, err, turn;
    for (i = 0; i < span.length; i++) {
      err = Math.abs(Math.hypot(span[i][0] - fit.cx, span[i][1] - fit.cy) - fit.r);
      if (err > worst) worst = err;
      if (i > 0 && i < span.length - 1) {
        turn = turnAt(span[i - 1], span[i], span[i + 1]);
        if (turn > 0.85) return null;
      }
    }
    if (worst > Math.max(1.65, fit.r * 0.065)) return null;
    if (chordBow(span) < Math.max(4, fit.r * 0.18)) return null;
    var sign = arcSign(span, a, b, fit.cx, fit.cy);
    if (!sign) return null;
    var sweep = arcSweep(a, b, fit.cx, fit.cy, sign);
    var travel = 0;
    for (i = 1; i < span.length; i++) travel += Math.hypot(span[i][0] - span[i - 1][0], span[i][1] - span[i - 1][1]);
    if (Math.abs(travel - sweep * fit.r) > Math.abs(travel - (Math.PI * 2 - sweep) * fit.r)) {
      sign = -sign;
      sweep = Math.PI * 2 - sweep;
    }
    if (sweep < 3.4 || sweep > 5.6) return null;
    var cubics = arcCubics(a, b, fit.cx, fit.cy, fit.r, sign);
    if (!cubics.length || cubics.length > 4) return null;
    return cubics;
  }


  function horseshoeFit(ring) {
    var n = ring.length;
    if (n < 18 || n > 700) return null;
    var minX = ring[0][0];
    var maxX = minX;
    var minY = ring[0][1];
    var maxY = minY;
    var i;
    for (i = 1; i < n; i++) {
      if (ring[i][0] < minX) minX = ring[i][0];
      if (ring[i][0] > maxX) maxX = ring[i][0];
      if (ring[i][1] < minY) minY = ring[i][1];
      if (ring[i][1] > maxY) maxY = ring[i][1];
    }
    var bw = maxX - minX;
    var bh = maxY - minY;
    if (bw < 16 || bh < 16) return null;
    var dirs = ["bottom", "top", "right", "left"];
    var best = null;
    var d;
    for (d = 0; d < dirs.length; d++) {
      var cap = dirs[d];
      var horizontal = cap === "bottom" || cap === "top";
      var span = horizontal ? bw : bh;
      var reach = horizontal ? bh : bw;
      var Ro = span / 2;
      if (Ro < 10 || reach < Ro * 1.15) continue;
      var cx = (minX + maxX) / 2;
      var cy = (minY + maxY) / 2;
      var cv = cap === "bottom" ? maxY - Ro : cap === "top" ? minY + Ro : cap === "right" ? maxX - Ro : minX + Ro;
      var cu = horizontal ? cx : cy;
      var openEnd = cap === "bottom" ? minY : cap === "top" ? maxY : cap === "right" ? minX : maxX;
      var pole = null;
      var capExtreme = cap === "bottom" ? maxY : cap === "top" ? minY : cap === "right" ? maxX : minX;
      for (i = 0; i < n; i++) {
        var u = horizontal ? ring[i][0] : ring[i][1];
        var v = horizontal ? ring[i][1] : ring[i][0];
        if (Math.abs(u - cu) > Ro * 0.55) continue;
        var fromCap = cap === "bottom" || cap === "right" ? capExtreme - v : v - capExtreme;
        if (fromCap < Ro * 0.22) continue;
        var toward = cap === "bottom" || cap === "right" ? v : -v;
        if (!pole || toward > pole.toward) pole = { u: u, v: v, toward: toward };
      }
      if (!pole) continue;
      var Ri = cap === "bottom" || cap === "right" ? pole.v - cv : cv - pole.v;
      if (Ri < 6 || Ri > Ro * 0.84) continue;
      var leg = cap === "bottom" ? cv - openEnd : cap === "top" ? openEnd - cv : cap === "right" ? cv - openEnd : openEnd - cv;
      if (leg < Math.max(8, Ri * 0.35)) continue;
      var worst = 0;
      var onOuter = 0;
      var onInner = 0;
      var onCap = 0;
      for (i = 0; i < n; i++) {
        var uu = horizontal ? ring[i][0] : ring[i][1];
        var vv = horizontal ? ring[i][1] : ring[i][0];
        var along = cap === "bottom" || cap === "right" ? cv - vv : vv - cv;
        var side = Math.abs(uu - cu);
        var errOuter;
        var errInner;
        if (along >= -1.4) {
          errOuter = Math.abs(side - Ro);
          errInner = Math.abs(side - Ri);
        } else {
          errOuter = Math.abs(Math.hypot(uu - cu, vv - cv) - Ro);
          errInner = Math.abs(Math.hypot(uu - cu, vv - cv) - Ri);
        }
        var endErr = Math.abs(along - leg) + (side >= Ri - 1.6 && side <= Ro + 1.6 ? 0 : 8);
        var err = Math.min(errOuter, errInner, endErr);
        if (err === errOuter && errOuter <= 1.7) onOuter++;
        if (err === errInner && errInner <= 1.7) onInner++;
        if (err === endErr && endErr <= 1.7) onCap++;
        if (err > worst) worst = err;
      }
      if (onOuter < 4 || onInner < 4 || onCap < 2) continue;
      if (worst > Math.max(2.05, Ro * 0.07)) continue;
      if (!best || worst < best.worst) best = { cap: cap, worst: worst, cu: cu, cv: cv, Ro: Ro, Ri: Ri, openEnd: openEnd };
    }
    if (!best) return null;
    var wind = 0;
    var wj;
    for (i = 0; i < n; i++) {
      wj = (i + 1) % n;
      wind += ring[i][0] * ring[wj][1] - ring[wj][0] * ring[i][1];
    }
    var sign = wind < 0 ? -1 : 1;
    var segs = [];
    var start;
    var cap = best.cap;
    var Ro = best.Ro;
    var Ri = best.Ri;
    if (cap === "bottom" || cap === "top") {
      var yOpen = best.openEnd;
      var yCap = best.cv;
      var xL = best.cu - Ro;
      var xR = best.cu + Ro;
      var xLi = best.cu - Ri;
      var xRi = best.cu + Ri;
      var yPole = cap === "bottom" ? yCap + Ro : yCap - Ro;
      var yInner = cap === "bottom" ? yCap + Ri : yCap - Ri;
      var arcSign = cap === "bottom" ? 1 : -1;
      if ((cap === "bottom" && sign < 0) || (cap === "top" && sign > 0)) {
        start = [xL, yOpen];
        segs.push({ k: "L", p: [xL, yCap] });
        segs.push(quarterCubic([xL, yCap], [best.cu, yPole], best.cu, yCap, Ro, arcSign));
        segs.push(quarterCubic([best.cu, yPole], [xR, yCap], best.cu, yCap, Ro, arcSign));
        segs.push({ k: "L", p: [xR, yOpen] });
        segs.push({ k: "L", p: [xRi, yOpen] });
        segs.push({ k: "L", p: [xRi, yCap] });
        segs.push(quarterCubic([xRi, yCap], [best.cu, yInner], best.cu, yCap, Ri, -arcSign));
        segs.push(quarterCubic([best.cu, yInner], [xLi, yCap], best.cu, yCap, Ri, -arcSign));
        segs.push({ k: "L", p: [xLi, yOpen] });
        segs.push({ k: "L", p: [xL, yOpen] });
      } else {
        start = [xR, yOpen];
        segs.push({ k: "L", p: [xR, yCap] });
        segs.push(quarterCubic([xR, yCap], [best.cu, yPole], best.cu, yCap, Ro, -arcSign));
        segs.push(quarterCubic([best.cu, yPole], [xL, yCap], best.cu, yCap, Ro, -arcSign));
        segs.push({ k: "L", p: [xL, yOpen] });
        segs.push({ k: "L", p: [xLi, yOpen] });
        segs.push({ k: "L", p: [xLi, yCap] });
        segs.push(quarterCubic([xLi, yCap], [best.cu, yInner], best.cu, yCap, Ri, arcSign));
        segs.push(quarterCubic([best.cu, yInner], [xRi, yCap], best.cu, yCap, Ri, arcSign));
        segs.push({ k: "L", p: [xRi, yOpen] });
        segs.push({ k: "L", p: [xR, yOpen] });
      }
    } else {
      var xOpen = best.openEnd;
      var xCap = best.cv;
      var yT = best.cu - Ro;
      var yB = best.cu + Ro;
      var yTi = best.cu - Ri;
      var yBi = best.cu + Ri;
      var xPole = cap === "right" ? xCap + Ro : xCap - Ro;
      var xInner = cap === "right" ? xCap + Ri : xCap - Ri;
      var hSign = cap === "right" ? sign : -sign;
      if ((cap === "right" && sign < 0) || (cap === "left" && sign > 0)) {
        start = [xOpen, yT];
        segs.push({ k: "L", p: [xCap, yT] });
        segs.push(quarterCubic([xCap, yT], [xPole, best.cu], xCap, best.cu, Ro, -hSign));
        segs.push(quarterCubic([xPole, best.cu], [xCap, yB], xCap, best.cu, Ro, -hSign));
        segs.push({ k: "L", p: [xOpen, yB] });
        segs.push({ k: "L", p: [xOpen, yBi] });
        segs.push({ k: "L", p: [xCap, yBi] });
        segs.push(quarterCubic([xCap, yBi], [xInner, best.cu], xCap, best.cu, Ri, hSign));
        segs.push(quarterCubic([xInner, best.cu], [xCap, yTi], xCap, best.cu, Ri, hSign));
        segs.push({ k: "L", p: [xOpen, yTi] });
        segs.push({ k: "L", p: [xOpen, yT] });
      } else {
        start = [xOpen, yB];
        segs.push({ k: "L", p: [xCap, yB] });
        segs.push(quarterCubic([xCap, yB], [xPole, best.cu], xCap, best.cu, Ro, hSign));
        segs.push(quarterCubic([xPole, best.cu], [xCap, yT], xCap, best.cu, Ro, hSign));
        segs.push({ k: "L", p: [xOpen, yT] });
        segs.push({ k: "L", p: [xOpen, yTi] });
        segs.push({ k: "L", p: [xCap, yTi] });
        segs.push(quarterCubic([xCap, yTi], [xInner, best.cu], xCap, best.cu, Ri, -hSign));
        segs.push(quarterCubic([xInner, best.cu], [xCap, yBi], xCap, best.cu, Ri, -hSign));
        segs.push({ k: "L", p: [xOpen, yBi] });
        segs.push({ k: "L", p: [xOpen, yB] });
      }
    }
    return { start: start, segs: segs };
  }


  function reuleauxFit(ring) {
    var n = ring.length;
    if (n < 16 || n > 720) return null;
    var turns = new Array(n);
    var i;
    for (i = 0; i < n; i++) turns[i] = turnAt(ring[(i + n - 1) % n], ring[i], ring[(i + 1) % n]);
    var peaks = [];
    var best, k, d, stepLen;
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.45 || turns[i] > 1.35) continue;
      best = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 5) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 5) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.05) best = false;
        k = (k + n - 1) % n;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 5) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 5) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.05) best = false;
        k = (k + 1) % n;
      }
      if (best) peaks.push(i);
    }
    var kept = [];
    var gap;
    for (i = 0; i < peaks.length; i++) {
      if (!kept.length) {
        kept.push(peaks[i]);
        continue;
      }
      gap = Math.hypot(ring[peaks[i]][0] - ring[kept[kept.length - 1]][0], ring[peaks[i]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 8) {
        if (turns[peaks[i]] > turns[kept[kept.length - 1]]) kept[kept.length - 1] = peaks[i];
        continue;
      }
      kept.push(peaks[i]);
    }
    if (kept.length > 1) {
      gap = Math.hypot(ring[kept[0]][0] - ring[kept[kept.length - 1]][0], ring[kept[0]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 8) {
        if (turns[kept[kept.length - 1]] > turns[kept[0]]) kept[0] = kept[kept.length - 1];
        kept.pop();
      }
    }
    if (kept.length !== 3) return null;
    var p0 = ring[kept[0]];
    var p1 = ring[kept[1]];
    var p2 = ring[kept[2]];
    var s0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    var s1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    var s2 = Math.hypot(p0[0] - p2[0], p0[1] - p2[1]);
    var side = (s0 + s1 + s2) / 3;
    if (side < 16) return null;
    if (Math.abs(s0 - side) > side * 0.16 || Math.abs(s1 - side) > side * 0.16 || Math.abs(s2 - side) > side * 0.16) return null;
    var spans = [spanPoints(ring, kept[0], kept[1]), spanPoints(ring, kept[1], kept[2]), spanPoints(ring, kept[2], kept[0])];
    var centers = [p2, p0, p1];
    var segs = [];
    var si, span, center, r, worst, err, bow, sign, sweep, cubics;
    for (si = 0; si < 3; si++) {
      span = spans[si];
      if (span.length < 5) return null;
      center = centers[si];
      r = (Math.hypot(span[0][0] - center[0], span[0][1] - center[1]) + Math.hypot(span[span.length - 1][0] - center[0], span[span.length - 1][1] - center[1])) / 2;
      if (r < 16) return null;
      bow = chordBow(span);
      if (bow < Math.max(4.2, r * 0.07)) return null;
      worst = 0;
      for (i = 0; i < span.length; i++) {
        err = Math.abs(Math.hypot(span[i][0] - center[0], span[i][1] - center[1]) - r);
        if (err > worst) worst = err;
      }
      if (worst > Math.max(2.6, r * 0.08)) return null;
      sign = arcSign(span, span[0], span[span.length - 1], center[0], center[1]);
      if (!sign) return null;
      sweep = arcSweep(span[0], span[span.length - 1], center[0], center[1], sign);
      if (sweep < 0.7 || sweep > 1.5) return null;
      cubics = arcCubics(span[0], span[span.length - 1], center[0], center[1], r, sign);
      if (cubics.length !== 1) return null;
      segs = segs.concat(cubics);
    }
    return { start: p0.slice(), segs: segs };
  }

  function starFit(ring) {
    var n = ring.length;
    if (n < 16 || n > 860) return null;
    var win = n <= 48 ? 3.2 : 5.2;
    function step(i, dir) {
      var walked = 0;
      var j = i;
      var guard = 0;
      var prev = ring[j];
      while (walked < win && guard < n) {
        j = (j + dir + n) % n;
        walked += Math.hypot(ring[j][0] - prev[0], ring[j][1] - prev[1]);
        prev = ring[j];
        guard++;
      }
      return j;
    }
    var turns = new Array(n);
    var i, best, k, d, stepLen, peaks, gap, a, b, span, valley, bestTurn, mid, bow, len, lens, lo, hi, segs, half;
    for (i = 0; i < n; i++) turns[i] = turnAt(ring[step(i, -1)], ring[i], ring[step(i, 1)]);
    peaks = [];
    for (i = 0; i < n; i++) {
      if (turns[i] < 0.5 || turns[i] > 1.5) continue;
      best = true;
      k = (i + n - 1) % n;
      d = 0;
      while (d < 4.4) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + 1) % n][0], ring[k][1] - ring[(k + 1) % n][1]);
        if (d + stepLen > 4.4) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.06) best = false;
        k = (k + n - 1) % n;
        if (k === i) break;
      }
      k = (i + 1) % n;
      d = 0;
      while (d < 4.4) {
        stepLen = Math.hypot(ring[k][0] - ring[(k + n - 1) % n][0], ring[k][1] - ring[(k + n - 1) % n][1]);
        if (d + stepLen > 4.4) break;
        d += stepLen;
        if (turns[k] > turns[i] + 0.06) best = false;
        k = (k + 1) % n;
        if (k === i) break;
      }
      if (best) peaks.push(i);
    }
    var kept = [];
    for (i = 0; i < peaks.length; i++) {
      if (!kept.length) {
        kept.push(peaks[i]);
        continue;
      }
      gap = Math.hypot(ring[peaks[i]][0] - ring[kept[kept.length - 1]][0], ring[peaks[i]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 6.4) {
        if (turns[peaks[i]] > turns[kept[kept.length - 1]]) kept[kept.length - 1] = peaks[i];
        continue;
      }
      kept.push(peaks[i]);
    }
    if (kept.length > 1) {
      gap = Math.hypot(ring[kept[0]][0] - ring[kept[kept.length - 1]][0], ring[kept[0]][1] - ring[kept[kept.length - 1]][1]);
      if (gap < 6.4) {
        if (turns[kept[kept.length - 1]] > turns[kept[0]]) kept[0] = kept[kept.length - 1];
        kept.pop();
      }
    }
    if (kept.length !== 5) return null;
    for (i = 0; i < kept.length; i++) {
      if (turns[kept[i]] < 0.48 || turns[kept[i]] > 1.5) return null;
    }
    var corners = [];
    lens = [];
    for (i = 0; i < kept.length; i++) {
      a = kept[i];
      b = kept[(i + 1) % kept.length];
      span = spanPoints(ring, a, b);
      if (span.length < 3) return null;
      if (chordBow(span) < 3.4) return null;
      valley = -1;
      bestTurn = 0;
      for (k = 1; k < span.length - 1; k++) {
        mid = (a + k) % n;
        if (Math.hypot(ring[mid][0] - ring[a][0], ring[mid][1] - ring[a][1]) < 4) continue;
        if (Math.hypot(ring[mid][0] - ring[b][0], ring[mid][1] - ring[b][1]) < 4) continue;
        if (turns[mid] > bestTurn) {
          bestTurn = turns[mid];
          valley = mid;
        }
      }
      if (valley < 0 || bestTurn < 0.48) return null;
      half = spanPoints(ring, a, valley);
      if (chordBow(half) > 2.4) return null;
      len = Math.hypot(ring[valley][0] - ring[a][0], ring[valley][1] - ring[a][1]);
      if (len < 6) return null;
      lens.push(len);
      half = spanPoints(ring, valley, b);
      if (chordBow(half) > 2.4) return null;
      len = Math.hypot(ring[b][0] - ring[valley][0], ring[b][1] - ring[valley][1]);
      if (len < 6) return null;
      lens.push(len);
      corners.push(valley);
    }
    lo = lens[0];
    hi = lens[0];
    for (i = 1; i < lens.length; i++) {
      if (lens[i] < lo) lo = lens[i];
      if (lens[i] > hi) hi = lens[i];
    }
    if (hi > lo * 1.65) return null;
    segs = [];
    for (i = 0; i < kept.length; i++) {
      segs.push({ k: "L", p: ring[corners[i]].slice(), pts: [ring[kept[i]], ring[corners[i]]] });
      segs.push({ k: "L", p: ring[kept[(i + 1) % kept.length]].slice(), pts: [ring[corners[i]], ring[kept[(i + 1) % kept.length]]] });
    }
    return { start: ring[kept[0]].slice(), segs: segs };
  }

  function fitContour(points, alphamax, opttolerance) {
    var ring = [];
    var i;
    for (i = 0; i < points.length; i++) {
      if (!ring.length || ring[ring.length - 1][0] !== points[i][0] || ring[ring.length - 1][1] !== points[i][1]) ring.push(points[i]);
    }
    while (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3) return null;
    var quad = quadFit(ring);
    if (quad) return quad;
    var poly = polygonFit(ring);
    if (poly) return poly;
    var star = starFit(ring);
    if (star) return star;
    var straight = straightPolyFit(ring);
    if (straight) return straight;
    var stadium = stadiumFit(ring);
    if (stadium) return stadium;
    var semi = semicircleFit(ring);
    if (semi) return semi;
    var wedge = wedgeFit(ring);
    if (wedge) return wedge;
    var segment = segmentFit(ring);
    if (segment) return segment;
    var crescent = crescentFit(ring);
    if (crescent) return crescent;
    var reuleaux = reuleauxFit(ring);
    if (reuleaux) return reuleaux;
    var heart = heartFit(ring);
    if (heart) return heart;
    var drop = dropFit(ring);
    if (drop) return drop;
    var bubble = bubbleFit(ring);
    if (bubble) return bubble;
    var roundTri = roundTriFit(ring);
    if (roundTri) return roundTri;
    var dcap = dCapFit(ring);
    if (dcap) return dcap;
    var keyhole = keyholeFit(ring);
    if (keyhole) return keyhole;
    var shoe = horseshoeFit(ring);
    if (shoe) return shoe;
    var squircle = squircleFit(ring);
    if (squircle) return squircle;
    var rounded = roundRectFit(ring);
    if (rounded) return rounded;
    var oval = ovalFit(ring, opttolerance);
    if (oval) return oval;
    var limit = alphamax;
    var corners = [];
    var i, a, b, c;
    var joints = jointFlags(ring);
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      if (realCorner(a, b, c, limit) || joints[i]) corners.push(i);
    }
    var cuts = straightCuts(ring).concat(sideRuns(ring));
    for (i = 0; i < cuts.length; i++) {
      if (corners.indexOf(cuts[i]) < 0) corners.push(cuts[i]);
    }
    if (!corners.length) corners.push(0);
    else corners.sort(function (a, b) { return a - b; });
    var dropped = true;
    var ci, prevI, nextI, prevP, here, nextP, legIn, legOut;
    while (dropped && corners.length >= 4) {
      dropped = false;
      for (ci = 0; ci < corners.length; ci++) {
        prevI = corners[(ci + corners.length - 1) % corners.length];
        nextI = corners[(ci + 1) % corners.length];
        prevP = ring[prevI];
        here = ring[corners[ci]];
        nextP = ring[nextI];
        legIn = Math.hypot(here[0] - prevP[0], here[1] - prevP[1]);
        legOut = Math.hypot(nextP[0] - here[0], nextP[1] - here[1]);
        if (Math.min(legIn, legOut) < 3.6 && distPointSeg(here, prevP, nextP) < 1.4) {
          corners.splice(ci, 1);
          dropped = true;
          break;
        }
      }
    }
    var missed = true;
    var missGuard = 0;
    var missAt, missIdx, missFrom, missTo, missBow, missPrev, missHere, missNext;
    while (missed && missGuard < 8) {
      missed = false;
      missGuard++;
      for (ci = 0; ci < corners.length && !missed; ci++) {
        missFrom = corners[ci];
        missTo = corners[(ci + 1) % corners.length];
        missIdx = (missFrom + 1) % ring.length;
        missAt = 0;
        while (missIdx !== missTo && missAt < ring.length) {
          missPrev = ring[(missIdx + ring.length - 1) % ring.length];
          missHere = ring[missIdx];
          missNext = ring[(missIdx + 1) % ring.length];
          missBow = distPointSeg(missHere, ring[missFrom], ring[missTo]);
          if (missBow > 1.8 && realCorner(missPrev, missHere, missNext, Math.min(limit, 0.72))) {
            corners.push(missIdx);
            corners.sort(function (a, b) { return a - b; });
            missed = true;
            break;
          }
          missIdx = (missIdx + 1) % ring.length;
          missAt++;
        }
      }
    }
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
      var fillet = cornerFillet(ring, from, to);
      var arcSegs = spanArc(span);
      if (lineChord(span) || stairLine(span) || (flatSpan(span) && flatJoin(ring, from, to))) segs.push({ k: "L", p: span[span.length - 1], pts: span });
      else if (fillet) segs.push(fillet);
      else if (arcSegs) segs = segs.concat(arcSegs);
      else if (span.length >= 3 && span.length <= 6 && !flatSpan(span)) {
        var best = 1;
        var bestTurn = 0;
        var s;
        for (s = 1; s < span.length - 1; s++) {
          var turn = turnAt(span[s - 1], span[s], span[s + 1]);
          if (turn > bestTurn) {
            bestTurn = turn;
            best = s;
          }
        }
        var mid = from;
        var walk = 0;
        while (walk < best) {
          mid = (mid + 1) % ring.length;
          walk++;
        }
        var lead = bestTurn >= 0.45 ? cornerFillet(ring, from, mid) : null;
        if (lead) {
          segs.push(lead);
          segs.push({ k: "L", p: span[span.length - 1], pts: span.slice(best) });
        } else if (span.length < 4 || (flatSpan(span) && flatJoin(ring, from, to))) segs.push({ k: "L", p: span[span.length - 1], pts: span });
        else segs = segs.concat(opticurve(fitSpan(span, opttolerance, 0), opttolerance));
      } else if (span.length < 4 || (flatSpan(span) && flatJoin(ring, from, to))) segs.push({ k: "L", p: span[span.length - 1], pts: span });
      else segs = segs.concat(opticurve(fitSpan(span, opttolerance, 0), opttolerance));
    }
    return { start: start, segs: segs };
  }

  function cornerFillet(ring, from, to) {
    var n = ring.length;
    var a = ring[from];
    var b = ring[to];
    var prev = ring[(from + n - 1) % n];
    var next = ring[(to + 1) % n];
    var inLen = Math.hypot(a[0] - prev[0], a[1] - prev[1]);
    var outLen = Math.hypot(next[0] - b[0], next[1] - b[1]);
    if (inLen < 4 || outLen < 4) return null;
    var ix = (a[0] - prev[0]) / inLen;
    var iy = (a[1] - prev[1]) / inLen;
    var ox = (next[0] - b[0]) / outLen;
    var oy = (next[1] - b[1]) / outLen;
    if (ix * ox + iy * oy > 0.28) return null;
    var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (chord < 2.4 || chord > 26) return null;
    if (Math.abs(b[1] - a[1]) < 1.25 || Math.abs(b[0] - a[0]) < 1.25) return null;
    var span = [a];
    var idx = from;
    var guard = 0;
    while (idx !== to && guard <= n) {
      idx = (idx + 1) % n;
      span.push(ring[idx]);
      guard++;
    }
    var bow = chordBow(span);
    if (bow < Math.max(1.85, chord * 0.18) || bow > Math.max(8.5, chord * 0.55)) return null;
    if (span.length > 8) return null;
    var h = 0.5523 * chord / Math.SQRT2;
    return {
      k: "C",
      c: [a, [a[0] + ix * h, a[1] + iy * h], [b[0] - ox * h, b[1] - oy * h], b]
    };
  }


  function segEnd(seg) {
    return seg.k === "C" ? seg.c[3] : seg.p;
  }

  function lineCross(a, b, c, d) {
    var den = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
    if (Math.abs(den) < 1e-4) return null;
    var t = ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / den;
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }

  function miterChamfers(fit) {
    var segs = fit.segs;
    if (!segs || segs.length < 4) return fit;
    var changed = true;
    var guard = 0;
    while (changed && guard < 8) {
      changed = false;
      guard++;
      var n = segs.length;
      var starts = [];
      var cursor = fit.start.slice();
      var i;
      for (i = 0; i < n; i++) {
        starts.push(cursor.slice());
        cursor = segEnd(segs[i]).slice();
      }
      for (i = 0; i < n; i++) {
        if (segs[i].k !== "L") continue;
        var shortLen = Math.hypot(segEnd(segs[i])[0] - starts[i][0], segEnd(segs[i])[1] - starts[i][1]);
        if (shortLen < 0.4 || shortLen > 7.5) continue;
        var a = i;
        var b = i;
        var shorts = 1;
        var span = shortLen;
        var prev, next, pl, nl;
        while (shorts < 3) {
          prev = (a + n - 1) % n;
          if (segs[prev].k !== "L") break;
          pl = Math.hypot(segEnd(segs[prev])[0] - starts[prev][0], segEnd(segs[prev])[1] - starts[prev][1]);
          if (pl > 6.4) break;
          a = prev;
          shorts++;
          span += pl;
        }
        while (shorts < 3) {
          next = (b + 1) % n;
          if (segs[next].k !== "L") break;
          nl = Math.hypot(segEnd(segs[next])[0] - starts[next][0], segEnd(segs[next])[1] - starts[next][1]);
          if (nl > 6.4) break;
          b = next;
          shorts++;
          span += nl;
        }
        if (span > 7.6) continue;
        var inn = (a + n - 1) % n;
        var out = (b + 1) % n;
        if (inn === b || out === a || segs[inn].k !== "L" || segs[out].k !== "L") continue;
        var innLen = Math.hypot(segEnd(segs[inn])[0] - starts[inn][0], segEnd(segs[inn])[1] - starts[inn][1]);
        var outLen = Math.hypot(segEnd(segs[out])[0] - starts[out][0], segEnd(segs[out])[1] - starts[out][1]);
        if (innLen < 12 || outLen < 12) continue;
        var hit = lineCross(starts[inn], segEnd(segs[inn]), starts[out], segEnd(segs[out]));
        if (!hit) continue;
        var dx1 = segEnd(segs[inn])[0] - starts[inn][0];
        var dy1 = segEnd(segs[inn])[1] - starts[inn][1];
        var dx2 = segEnd(segs[out])[0] - starts[out][0];
        var dy2 = segEnd(segs[out])[1] - starts[out][1];
        var dot = (dx1 * dx2 + dy1 * dy2) / (innLen * outLen);
        if (dot > 0.86 || dot < -0.92) continue;
        var far = 0;
        var k = a;
        var steps = 0;
        var d0, d1;
        while (steps < 5) {
          d0 = Math.hypot(starts[k][0] - hit[0], starts[k][1] - hit[1]);
          d1 = Math.hypot(segEnd(segs[k])[0] - hit[0], segEnd(segs[k])[1] - hit[1]);
          if (d0 > far) far = d0;
          if (d1 > far) far = d1;
          if (k === b) break;
          k = (k + 1) % n;
          steps++;
        }
        var near = Math.hypot(starts[a][0] - hit[0], starts[a][1] - hit[1]);
        var endNear = Math.hypot(segEnd(segs[b])[0] - hit[0], segEnd(segs[b])[1] - hit[1]);
        if (endNear < near) near = endNear;
        if (shortLen > 6.4) {
          if (shorts > 1 || near > 3.2 || far > 8.8) continue;
        } else if (far > 6.2) continue;
        var along = ((hit[0] - segEnd(segs[inn])[0]) * dx1 + (hit[1] - segEnd(segs[inn])[1]) * dy1) / innLen;
        if (along < -1.2 || along > 5.5) continue;
        segs[inn].p = [hit[0], hit[1]];
        var drop = [];
        k = a;
        steps = 0;
        while (steps < 5) {
          drop.push(k);
          if (k === b) break;
          k = (k + 1) % n;
          steps++;
        }
        drop.sort(function (x, y) { return y - x; });
        for (k = 0; k < drop.length; k++) segs.splice(drop[k], 1);
        if (drop.indexOf(0) >= 0) fit.start = [hit[0], hit[1]];
        changed = true;
        break;
      }
    }
    return fit;
  }


  function dropSideJogs(fit) {
    var segs = fit.segs;
    if (!segs || segs.length < 4) return fit;
    var changed = true;
    var guard = 0;
    while (changed && guard < 10) {
      changed = false;
      guard++;
      var n = segs.length;
      if (n < 4) break;
      var starts = [];
      var cursor = fit.start.slice();
      var i;
      for (i = 0; i < n; i++) {
        starts.push(cursor.slice());
        cursor = segEnd(segs[i]).slice();
      }
      for (i = 0; i < n; i++) {
        if (segs[i].k !== "L") continue;
        var prev = (i + n - 1) % n;
        var next = (i + 1) % n;
        if (segs[prev].k !== "L" || segs[next].k !== "L") continue;
        var here = segEnd(segs[i]);
        var a = starts[i];
        var c = segEnd(segs[next]);
        var legIn = Math.hypot(here[0] - a[0], here[1] - a[1]);
        var legOut = Math.hypot(c[0] - here[0], c[1] - here[1]);
        var onChord = distPointSeg(here, a, c) <= 1.35;
        var turn = turnAt(a, here, c);
        var shortJog = Math.min(legIn, legOut) <= 11 && Math.max(legIn, legOut) >= 8 && turn <= 0.62;
        var splitSide = Math.min(legIn, legOut) >= 8 && turn <= 0.22;
        if (!onChord || (!shortJog && !splitSide)) continue;
        segs.splice(i, 1);
        if (i === 0) fit.start = a.slice();
        changed = true;
        break;
      }
    }
    return fit;
  }


  function lineBiasSides(fit) {
    var segs = fit.segs;
    if (!segs || segs.length < 3) return fit;
    var starts = [];
    var cursor = fit.start.slice();
    var i;
    for (i = 0; i < segs.length; i++) {
      starts.push(cursor.slice());
      cursor = segEnd(segs[i]).slice();
    }
    for (i = 0; i < segs.length; i++) {
      if (segs[i].k !== "C") continue;
      var prev = (i + segs.length - 1) % segs.length;
      var next = (i + 1) % segs.length;
      var a = starts[i];
      var b = segEnd(segs[i]);
      var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var stair = false;
      var after = next;
      if (segs[prev].k === "L" && segs[next].k === "C") {
        var nextEnd = segEnd(segs[next]);
        var nextLen = Math.hypot(nextEnd[0] - starts[next][0], nextEnd[1] - starts[next][1]);
        if (nextLen <= 6.2 && segs[(next + 1) % segs.length].k === "L") {
          stair = true;
          after = (next + 1) % segs.length;
        }
      }
      if (!stair && (segs[prev].k !== "L" || segs[next].k !== "L")) continue;
      if (chord < (stair ? 16 : 22)) continue;
      if (distPointSeg(segs[i].c[1], a, b) > (stair ? 1.6 : 3.4)) continue;
      if (distPointSeg(segs[i].c[2], a, b) > (stair ? 1.6 : 3.4)) continue;
      var pin = starts[prev];
      var nout = stair ? segEnd(segs[after]) : segEnd(segs[next]);
      if (turnAt(pin, a, b) < 0.55 || turnAt(a, b, nout) < 0.55) continue;
      segs[i] = { k: "L", p: b.slice() };
    }
    return fit;
  }


  function miterTipCubics(fit) {
    var segs = fit.segs;
    if (!segs || segs.length < 3) return fit;
    var changed = true;
    var guard = 0;
    while (changed && guard < 4) {
      changed = false;
      guard++;
      var n = segs.length;
      var starts = [];
      var cursor = fit.start.slice();
      var i;
      for (i = 0; i < n; i++) {
        starts.push(cursor.slice());
        cursor = segEnd(segs[i]).slice();
      }
      for (i = 0; i < n; i++) {
        if (segs[i].k !== "C") continue;
        var prev = (i + n - 1) % n;
        var next = (i + 1) % n;
        if (segs[prev].k !== "L" || segs[next].k !== "L") continue;
        var a = starts[i];
        var b = segEnd(segs[i]);
        var chord = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (chord < 1.1 || chord > 4.6) continue;
        var pin = starts[prev];
        var nout = segEnd(segs[next]);
        var inLen = Math.hypot(a[0] - pin[0], a[1] - pin[1]);
        var outLen = Math.hypot(nout[0] - b[0], nout[1] - b[1]);
        if (inLen < 18 || outLen < 18) continue;
        var hit = lineCross(pin, a, b, nout);
        if (!hit) continue;
        var da = Math.hypot(hit[0] - a[0], hit[1] - a[1]);
        var db = Math.hypot(hit[0] - b[0], hit[1] - b[1]);
        if (da > 5.2 || db > 5.2) continue;
        var dx1 = a[0] - pin[0];
        var dy1 = a[1] - pin[1];
        var dx2 = nout[0] - b[0];
        var dy2 = nout[1] - b[1];
        var dot = (dx1 * dx2 + dy1 * dy2) / (inLen * outLen);
        if (dot > 0.62) continue;
        var mid = bezier(segs[i].c[0], segs[i].c[1], segs[i].c[2], segs[i].c[3], 0.5);
        if (distPointSeg(mid, a, b) > 0.4) continue;
        if (distPointSeg(segs[i].c[1], a, hit) > 2.6) continue;
        if (distPointSeg(segs[i].c[2], b, hit) > 2.6) continue;
        var along = ((hit[0] - a[0]) * dx1 + (hit[1] - a[1]) * dy1) / inLen;
        if (along < -0.4 || along > 6.4) continue;
        segs[prev].p = [hit[0], hit[1]];
        segs.splice(i, 1);
        if (i === 0) fit.start = [hit[0], hit[1]];
        changed = true;
        break;
      }
    }
    return fit;
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
    var opttolerance = opts && opts.opttolerance != null ? opts.opttolerance : 0.36;
    var fit = fitContour(points, alphamax, opttolerance);

    if (!fit || !fit.segs.length) return "";
    fit = miterChamfers(fit);
    fit = dropSideJogs(fit);
    fit = lineBiasSides(fit);
    fit = miterTipCubics(fit);
    if (!fit.segs.length) return "";
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
      else out.push([x + (ox / n) * 0.5, y + (oy / n) * 0.5]);
    }
    if (pack.closed && out.length) out.push(out[0].slice());
    return out;
  }

  function sampleField(field, w, h, x, y) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x > w - 1) x = w - 1;
    if (y > h - 1) y = h - 1;
    var x0 = x | 0;
    var y0 = y | 0;
    var x1 = x0 + 1 < w ? x0 + 1 : x0;
    var y1 = y0 + 1 < h ? y0 + 1 : y0;
    var tx = x - x0;
    var ty = y - y0;
    var a = field[y0 * w + x0];
    var b = field[y0 * w + x1];
    var c = field[y1 * w + x0];
    var d = field[y1 * w + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  }

  function isoPlace(points, field, w, h, level, pin) {
    if (!field || !points || points.length < 3) return points;
    var pack = closedRing(points);
    var ring = pack.ring;
    var n = ring.length;
    if (n < 3) return points;
    var out = [];
    var i, x, y, step, v, gx, gy, g2, t, dx, dy, move, cap, prev, next, px, py;
    for (i = 0; i < n; i++) {
      x = ring[i][0];
      y = ring[i][1];
      if (pin) {
        px = x | 0;
        py = y | 0;
        if (px >= 0 && py >= 0 && px < w && py < h && pin[py * w + px]) {
          out.push(ring[i].slice());
          continue;
        }
      }
      prev = ring[(i + n - 1) % n];
      next = ring[(i + 1) % n];
      cap = turnAt(prev, ring[i], next) > 1.15 ? 0.32 : 0.85;
      for (step = 0; step < 2; step++) {
        v = sampleField(field, w, h, x, y) - level;
        gx = sampleField(field, w, h, x + 0.5, y) - sampleField(field, w, h, x - 0.5, y);
        gy = sampleField(field, w, h, x, y + 0.5) - sampleField(field, w, h, x, y - 0.5);
        g2 = gx * gx + gy * gy;
        if (g2 < 9) break;
        t = v / g2;
        if (t > 0.65) t = 0.65;
        if (t < -0.65) t = -0.65;
        x -= gx * t;
        y -= gy * t;
      }
      dx = x - ring[i][0];
      dy = y - ring[i][1];
      move = Math.hypot(dx, dy);
      if (move > cap) {
        x = ring[i][0] + dx * (cap / move);
        y = ring[i][1] + dy * (cap / move);
      }
      out.push([x, y]);
    }
    if (pack.closed && out.length) out.push(out[0].slice());
    return out;
  }

  function softField(mask, w, h) {
    var field = new Uint8Array(mask.length);
    var i;
    for (i = 0; i < mask.length; i++) field[i] = mask[i] ? 255 : 0;
    return blur3(blur3(field, w, h), w, h);
  }

  function blendT(pix, a, b) {
    var abx = b[0] - a[0];
    var aby = b[1] - a[1];
    var abz = b[2] - a[2];
    var ab2 = abx * abx + aby * aby + abz * abz;
    if (ab2 < 1e-8) return 1;
    var t = ((pix[0] - a[0]) * abx + (pix[1] - a[1]) * aby + (pix[2] - a[2]) * abz) / ab2;
    if (t < 0) return 0;
    if (t > 1) return 1;
    return t;
  }

  function coverageField(rch, gch, bch, w, h, inkLab, paperLab) {
    var field = new Uint8Array(w * h);
    var i, lab, t, ax, ay, az, dx, dy, dz;
    for (i = 0; i < w * h; i++) {
      lab = toOklab([rch[i], gch[i], bch[i]]);
      t = blendT(lab, paperLab, inkLab);
      ax = paperLab[0] + t * (inkLab[0] - paperLab[0]);
      ay = paperLab[1] + t * (inkLab[1] - paperLab[1]);
      az = paperLab[2] + t * (inkLab[2] - paperLab[2]);
      dx = lab[0] - ax;
      dy = lab[1] - ay;
      dz = lab[2] - az;
      if (dx * dx + dy * dy + dz * dz > 0.008) {
        field[i] = labDist2(lab, inkLab) <= labDist2(lab, paperLab) ? 255 : 0;
      } else {
        field[i] = (t * 255) | 0;
      }
    }
    return blur3(blur3(field, w, h), w, h);
  }

  function seamPin(mask, labels, w, h, inkIndex) {
    var pin = new Uint8Array(mask.length);
    var y, x, i, k, nx, ny, ni;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i]) continue;
        for (k = 0; k < 8; k++) {
          nx = x + DX[k];
          ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          ni = ny * w + nx;
          if (labels[ni] >= 0 && labels[ni] !== inkIndex) {
            pin[i] = 1;
            break;
          }
        }
      }
    }
    return pin;
  }


  function axisOf(a, b) {
    var dx = Math.abs(b[0] - a[0]);
    var dy = Math.abs(b[1] - a[1]);
    if (dx + dy < 0.2) return 0;
    if (dy <= dx * 0.28) return 1;
    if (dx <= dy * 0.28) return 2;
    return 0;
  }

  function straightRuns(ring) {
    var n = ring.length;
    if (n < 8) return [];
    var edge = [];
    var i;
    for (i = 0; i < n; i++) edge.push(axisOf(ring[i], ring[(i + 1) % n]));
    var start = 0;
    for (i = 0; i < n; i++) {
      if (edge[i] !== edge[(i + n - 1) % n]) {
        start = i;
        break;
      }
    }
    var runs = [];
    var k = start;
    var guard = 0;
    while (guard < n) {
      var ax = edge[k];
      var first = k;
      var along = 0;
      var steps = 0;
      var vals = [];
      while (edge[k] === ax && steps < n) {
        vals.push(ax === 1 ? ring[k][1] : ring[k][0]);
        along += Math.hypot(ring[(k + 1) % n][0] - ring[k][0], ring[(k + 1) % n][1] - ring[k][1]);
        k = (k + 1) % n;
        steps++;
        guard++;
        if (k === start) break;
      }
      vals.push(ax === 1 ? ring[k][1] : ring[k][0]);
      var bow = 0;
      var med = 0;
      if (ax) {
        var sorted = vals.slice().sort(function (a, b) { return a - b; });
        med = sorted[sorted.length >> 1];
        var t, cross;
        for (t = 0; t < vals.length; t++) {
          cross = Math.abs(vals[t] - med);
          if (cross > bow) bow = cross;
        }
      }
      runs.push({
        ax: ax && bow <= 0.55 && along >= 12 ? ax : 0,
        first: first,
        end: k,
        along: along,
        med: med
      });
      if (k === start) break;
    }
    return runs;
  }

  function runGap(ring, from, to) {
    var n = ring.length;
    var along = 0;
    var gap = 0;
    var g = from;
    while (g !== to && gap < n) {
      var nxt = (g + 1) % n;
      along += Math.hypot(ring[nxt][0] - ring[g][0], ring[nxt][1] - ring[g][1]);
      g = nxt;
      gap++;
    }
    return { along: along, gap: gap };
  }

  function nextStraight(runs, i) {
    var k;
    for (k = 1; k < runs.length; k++) {
      if (runs[(i + k) % runs.length].ax) return { run: runs[(i + k) % runs.length], steps: k };
    }
    return null;
  }

  function pinAxisCorners(points) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var n = ring.length;
    var runs = straightRuns(ring);
    if (runs.length < 2) return points.slice();
    var replace = new Array(n);
    var drop = new Array(n);
    var i, a, found, b, span, g, cursor;
    for (i = 0; i < runs.length; i++) {
      a = runs[i];
      if (!a.ax) continue;
      found = nextStraight(runs, i);
      if (!found) continue;
      b = found.run;
      if (a.ax === b.ax) continue;
      span = runGap(ring, a.end, b.first);
      if (span.gap > 3 || span.along > 3.2) continue;
      replace[a.end] = a.ax === 1 ? [b.med, a.med] : [a.med, b.med];
      g = a.end;
      cursor = 0;
      while (g !== b.first && cursor < n) {
        g = (g + 1) % n;
        if (g === b.first) break;
        drop[g] = 1;
        cursor++;
      }
    }
    var out = [];
    for (i = 0; i < n; i++) {
      if (drop[i]) continue;
      out.push(replace[i] ? replace[i] : ring[i].slice());
    }
    var slim = [];
    for (i = 0; i < out.length; i++) {
      if (!slim.length || Math.hypot(out[i][0] - slim[slim.length - 1][0], out[i][1] - slim[slim.length - 1][1]) > 0.2) slim.push(out[i]);
    }
    if (slim.length > 2 && Math.hypot(slim[0][0] - slim[slim.length - 1][0], slim[0][1] - slim[slim.length - 1][1]) <= 0.2) slim.pop();
    if (slim.length < 4) return points.slice();
    if (pack.closed) slim.push(slim[0].slice());
    return slim;
  }

  function jointFlags(points) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var flags = [];
    var i;
    for (i = 0; i < points.length; i++) flags.push(0);
    var runs = straightRuns(ring);
    for (i = 0; i < runs.length; i++) {
      var a = runs[i];
      if (!a.ax) continue;
      var found = nextStraight(runs, i);
      if (!found || found.run.ax === a.ax) continue;
      if (runGap(ring, a.end, found.run.first).along > 48) continue;
      flags[a.end] = 1;
      flags[found.run.first] = 1;
      if (pack.closed && points.length > ring.length) {
        if (a.end === 0 || found.run.first === 0) flags[points.length - 1] = 1;
      }
    }
    return flags;
  }

  function snapOrthogonal(points) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var n = ring.length;
    if (n < 6) return points.slice();
    var axis = new Array(n);
    var i, prev, next;
    for (i = 0; i < n; i++) {
      prev = axisOf(ring[(i + n - 1) % n], ring[i]);
      next = axisOf(ring[i], ring[(i + 1) % n]);
      axis[i] = prev && prev === next ? prev : 0;
    }
    var out = [];
    var seen = new Array(n);
    for (i = 0; i < n; i++) out.push(ring[i].slice());
    for (i = 0; i < n; i++) {
      if (!axis[i] || seen[i]) continue;
      var run = [];
      var j = i;
      while (axis[j] === axis[i] && !seen[j]) {
        seen[j] = 1;
        run.push(j);
        j = (j + 1) % n;
        if (run.length > n) break;
      }
      var back = (i + n - 1) % n;
      while (axis[back] === axis[i] && !seen[back]) {
        seen[back] = 1;
        run.unshift(back);
        back = (back + n - 1) % n;
        if (run.length > n) break;
      }
      if (run.length < 4) continue;
      var ax = axis[i];
      var vals = [];
      var along = 0;
      var k, cross, bow;
      for (k = 0; k < run.length; k++) vals.push(ax === 1 ? ring[run[k]][1] : ring[run[k]][0]);
      for (k = 1; k < run.length; k++) {
        along += Math.abs(ax === 1 ? ring[run[k]][0] - ring[run[k - 1]][0] : ring[run[k]][1] - ring[run[k - 1]][1]);
      }
      vals.sort(function (a, b) { return a - b; });
      var med = vals[vals.length >> 1];
      bow = 0;
      for (k = 0; k < run.length; k++) {
        cross = Math.abs(vals[k] - med);
        if (cross > bow) bow = cross;
      }
      if (bow > 0.55 || along < 5) continue;
      for (k = 0; k < run.length; k++) {
        if (ax === 1) out[run[k]][1] = med;
        else out[run[k]][0] = med;
      }
    }
    if (pack.closed && out.length) out.push(out[0].slice());
    return out;
  }

  function flatSpan(span) {
    if (span.length < 2) return false;
    var x0 = span[0][0];
    var y0 = span[0][1];
    var horiz = true;
    var vert = true;
    var i;
    for (i = 1; i < span.length; i++) {
      if (Math.abs(span[i][1] - y0) > 1.25) horiz = false;
      if (Math.abs(span[i][0] - x0) > 1.25) vert = false;
    }
    return horiz || vert;
  }


  function filletBow(ring, i) {
    var n = ring.length;
    var back = i;
    var fore = i;
    var walked = 0;
    var prev = ring[i];
    var guard = 0;
    while (walked < 8 && guard < n) {
      back = (back + n - 1) % n;
      walked += Math.hypot(ring[back][0] - prev[0], ring[back][1] - prev[1]);
      prev = ring[back];
      guard++;
    }
    walked = 0;
    prev = ring[i];
    guard = 0;
    while (walked < 8 && guard < n) {
      fore = (fore + 1) % n;
      walked += Math.hypot(ring[fore][0] - prev[0], ring[fore][1] - prev[1]);
      prev = ring[fore];
      guard++;
    }
    if (back === fore) return 0;
    return distPointSeg(ring[i], ring[back], ring[fore]);
  }

  function smoothChain(points, corner) {
    var pack = closedRing(points);
    var ring = pack.ring;
    if (ring.length < 5) return points.slice();
    if (ring.length < 16) return points.slice();
    var limit = corner != null ? corner : 0.95;
    var joints = jointFlags(ring);
    var out = [];
    var i, a, b, c, turn, inn, outLen;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      turn = turnAt(a, b, c);
      inn = Math.hypot(b[0] - a[0], b[1] - a[1]);
      outLen = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if (turn >= limit || (joints && joints[i]) || (turn >= 0.42 && (inn >= 6 || outLen >= 6))) out.push(b.slice());
      else out.push([(a[0] + b[0] * 2 + c[0]) / 4, (a[1] + b[1] * 2 + c[1]) / 4]);
    }
    if (pack.closed && out.length) out.push(out[0].slice());
    return out;
  }

  function collapseCollinear(points) {
    var pack = closedRing(points);
    var ring = pack.ring;
    if (ring.length < 4) return points.slice();
    var keep = [];
    var i, a, b, c;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      if (filletBow(ring, i) > 0.85) {
        keep.push(b.slice());
        continue;
      }
      if (turnAt(a, b, c) < 0.14 && distPointSeg(b, a, c) < 0.45) continue;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 2.6 && Math.hypot(c[0] - b[0], c[1] - b[1]) < 2.6 && distPointSeg(b, a, c) < 1.15) continue;
      keep.push(b.slice());
    }
    if (keep.length < 3) return points.slice();
    if (pack.closed) keep.push(keep[0].slice());
    return keep;
  }

  function chordStraighten(points, eps) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var n = ring.length;
    if (n < 6) return points.slice();
    var start = 0;
    var i, a, b, c, turn, bestTurn, far, steps, j, ok, k, seen, guard, out;
    bestTurn = -1;
    for (i = 0; i < n; i++) {
      a = ring[(i + n - 1) % n];
      b = ring[i];
      c = ring[(i + 1) % n];
      turn = turnAt(a, b, c);
      if (turn > bestTurn) {
        bestTurn = turn;
        start = i;
      }
    }
    var keep = new Array(n);
    keep[start] = 1;
    i = start;
    guard = 0;
    while (guard < n) {
      far = i;
      steps = 1;
      j = (i + 1) % n;
      while (j !== start && steps < n) {
        ok = true;
        k = (i + 1) % n;
        seen = 0;
        while (k !== j) {
          if (distPointSeg(ring[k], ring[i], ring[j]) > eps) {
            ok = false;
            break;
          }
          k = (k + 1) % n;
          seen++;
          if (seen > n) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
        far = j;
        j = (j + 1) % n;
        steps++;
      }
      if (far === i) far = (i + 1) % n;
      if (far === start) break;
      keep[far] = 1;
      i = far;
      guard++;
    }
    out = [];
    for (i = 0; i < n; i++) if (keep[i]) out.push(ring[i].slice());
    if (out.length < 3) return points.slice();
    if (pack.closed) out.push(out[0].slice());
    return out;
  }

  function dropSpikes(points) {
    var pack = closedRing(points);
    var ring = pack.ring;
    if (ring.length < 6) return points.slice();
    var keep = [];
    var i, a, b, c, inn, out;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      inn = Math.hypot(b[0] - a[0], b[1] - a[1]);
      out = Math.hypot(c[0] - b[0], c[1] - b[1]);
      if ((b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0 && distPointSeg(b, a, c) < 1.35) continue;
      if (inn < 2.2 && out < 2.2 && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) continue;
      keep.push(b.slice());
    }
    if (keep.length < 3) return points.slice();
    if (pack.closed) keep.push(keep[0].slice());
    return keep;
  }

  function prepare(raw, mask, w, h, corner, field, level, pin) {
    var settled = [];
    var i, chain;
    for (i = 0; i < raw.length; i++) {
      chain = settle(raw[i], mask, w, h);
      if (field) chain = isoPlace(chain, field, w, h, level, pin);
      chain = dropSpikes(dropSpikes(chain));
      chain = snapOrthogonal(chain);
      chain = pinAxisCorners(chain);
      chain = chordStraighten(chain, 0.62);
      chain = pinAxisCorners(collapseCollinear(smoothChain(chain, corner)));
      settled.push(chain);
    }
    return settled;
  }

  function axisCorner(a, b, c) {
    var inn = axisOf(a, b);
    var out = axisOf(b, c);
    if (!(inn && out && inn !== out)) return false;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 4.2) return false;
    if (Math.hypot(c[0] - b[0], c[1] - b[1]) < 4.2) return false;
    return true;
  }

  function realCorner(a, b, c, limit) {
    var inn = Math.hypot(b[0] - a[0], b[1] - a[1]);
    var out = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (inn < 3.6 && out < 3.6) return false;
    return turnAt(a, b, c) >= limit || axisCorner(a, b, c);
  }


  function cornerFlags(points, limit) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var flags = [];
    var i, a, b, c;
    for (i = 0; i < points.length; i++) flags.push(0);
    if (ring.length < 3) return flags;
    var joints = jointFlags(ring);
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      if (!realCorner(a, b, c, limit) && !joints[i]) continue;
      flags[i] = 1;
      if (pack.closed && i === 0 && points.length > ring.length) flags[points.length - 1] = 1;
    }
    return flags;
  }

  function simplify(raw, eps, minArea, corner, mask, w, h) {
    var out = [];
    var i, slim, limit, width, useEps, cut;
    limit = corner != null ? corner : 0.95;
    for (i = 0; i < raw.length; i++) {
      width = mask ? ribbonWidth(raw[i], mask, w, h) : 99;
      useEps = eps;
      cut = limit;
      if (width <= 6.5) {
        useEps = Math.min(eps, Math.max(0.32, width * 0.11));
        cut = Math.min(cut, 0.7);
      }
      slim = rdp(raw[i], useEps, cornerFlags(raw[i], cut));
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

  function borderPaper(rch, gch, bch, w, h) {
    var stepX = Math.max(1, (w / 24) | 0);
    var stepY = Math.max(1, (h / 24) | 0);
    var samples = [];
    function push(x, y) {
      var i = y * w + x;
      samples.push([rch[i], gch[i], bch[i]]);
    }
    var x, y;
    for (x = 0; x < w; x += stepX) {
      push(x, 0);
      push(x, h - 1);
    }
    for (y = stepY; y < h - 1; y += stepY) {
      push(0, y);
      push(w - 1, y);
    }
    if (samples.length < 8) return null;
    function mid(ch) {
      var vals = samples.map(function (s) { return s[ch]; });
      vals.sort(function (a, b) { return a - b; });
      return vals[(vals.length / 2) | 0];
    }
    var rgb = [mid(0), mid(1), mid(2)];
    var luma = (rgb[0] * 54 + rgb[1] * 183 + rgb[2] * 19) >> 8;
    if (luma < 168) return null;
    var lab = toOklab(rgb);
    var hit = 0;
    var i;
    for (i = 0; i < samples.length; i++) {
      if (labDist2(toOklab(samples[i]), lab) <= 0.012) hit++;
    }
    if (hit / samples.length < 0.62) return null;
    return { rgb: rgb, lab: lab, luma: luma, tol: 0.009 };
  }

  function isBackdrop(r, g, b, paper) {
    if (paperPixel(r, g, b)) return true;
    if (!paper) return false;
    var luma = (r * 54 + g * 183 + b * 19) >> 8;
    if (luma + 22 < paper.luma) return false;
    return labDist2(toOklab([r, g, b]), paper.lab) <= paper.tol;
  }

  function blendOff(pix, a, b) {
    var abx = b[0] - a[0];
    var aby = b[1] - a[1];
    var abz = b[2] - a[2];
    var ab2 = abx * abx + aby * aby + abz * abz;
    if (ab2 < 1e-8) return 1;
    var t = ((pix[0] - a[0]) * abx + (pix[1] - a[1]) * aby + (pix[2] - a[2]) * abz) / ab2;
    if (t < 0.14 || t > 0.9) return 1;
    var dx = pix[0] - (a[0] + t * abx);
    var dy = pix[1] - (a[1] + t * aby);
    var dz = pix[2] - (a[2] + t * abz);
    return dx * dx + dy * dy + dz * dz;
  }

  function fringeShell(labels, w, h, c) {
    var n = 0;
    var edge = 0;
    var y, x, i, open;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (labels[i] !== c) continue;
        n++;
        open = x === 0 || labels[i - 1] !== c || x + 1 === w || labels[i + 1] !== c || y === 0 || labels[i - w] !== c || y + 1 === h || labels[i + w] !== c;
        if (open) edge++;
      }
    }
    if (!n) return 1;
    return edge / n;
  }

  function mergeFringe(labels, counts, centerLab, paper, w, h) {
    if (!paper) return labels;
    var alias = [];
    var c, p, parent, parentCount, seen, cur;
    for (c = 0; c < centerLab.length; c++) alias.push(c);
    for (c = 0; c < centerLab.length; c++) {
      if (fringeShell(labels, w, h, c) < 0.42) continue;
      parent = -1;
      parentCount = counts[c];
      for (p = 0; p < centerLab.length; p++) {
        if (p === c || counts[p] <= parentCount) continue;
        if (blendOff(centerLab[c], paper.lab, centerLab[p]) > 0.0035) continue;
        parent = p;
        parentCount = counts[p];
      }
      if (parent >= 0) alias[c] = parent;
    }
    for (c = 0; c < alias.length; c++) {
      seen = 0;
      cur = c;
      while (alias[cur] !== cur && seen < alias.length) {
        cur = alias[cur];
        seen++;
      }
      alias[c] = cur;
    }
    for (c = 0; c < labels.length; c++) {
      if (labels[c] >= 0) labels[c] = alias[labels[c]];
    }
    return labels;
  }

  function snapHalo(labels, rch, gch, bch, w, h, centerLab, paper) {
    if (!paper) return labels;
    var out = new Int8Array(labels);
    var y, x, i, k, nx, ny, ni, owner, lab;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (labels[i] >= 0) continue;
        if (isBackdrop(rch[i], gch[i], bch[i], paper)) continue;
        owner = -1;
        for (k = 0; k < 8; k++) {
          nx = x + DX[k];
          ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          ni = ny * w + nx;
          if (labels[ni] < 0) continue;
          owner = labels[ni];
          break;
        }
        if (owner < 0) continue;
        lab = toOklab([rch[i], gch[i], bch[i]]);
        if (blendOff(lab, paper.lab, centerLab[owner]) <= 0.004) out[i] = owner;
      }
    }
    return out;
  }


  function foldSeamFringe(labels, rch, gch, bch, centerLab, w, h) {
    var counts = [];
    var c, i, a, b, shell, seam, out, y, x, k, nx, ny, ni, lab, best, bestD, d, owner;
    for (c = 0; c < centerLab.length; c++) counts.push(0);
    for (i = 0; i < labels.length; i++) {
      if (labels[i] >= 0) counts[labels[i]]++;
    }
    seam = [];
    for (c = 0; c < centerLab.length; c++) seam.push(0);
    for (c = 0; c < centerLab.length; c++) {
      if (counts[c] < 8) continue;
      shell = fringeShell(labels, w, h, c);
      if (shell < 0.48) continue;
      for (a = 0; a < centerLab.length && !seam[c]; a++) {
        if (a === c || counts[a] <= counts[c]) continue;
        for (b = a + 1; b < centerLab.length; b++) {
          if (b === c || counts[b] <= counts[c]) continue;
          if (blendOff(centerLab[c], centerLab[a], centerLab[b]) <= 0.0045) seam[c] = 1;
        }
      }
    }
    out = new Int8Array(labels);
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (labels[i] < 0 || !seam[labels[i]]) continue;
        lab = toOklab([rch[i], gch[i], bch[i]]);
        owner = -1;
        bestD = 1e12;
        for (k = 0; k < 8; k++) {
          nx = x + DX[k];
          ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          ni = ny * w + nx;
          if (labels[ni] < 0 || seam[labels[ni]]) continue;
          d = labDist2(lab, centerLab[labels[ni]]);
          if (d < bestD) {
            bestD = d;
            owner = labels[ni];
          }
        }
        if (owner < 0) {
          for (k = 0; k < centerLab.length; k++) {
            if (seam[k] || counts[k] <= counts[labels[i]]) continue;
            d = labDist2(lab, centerLab[k]);
            if (d < bestD) {
              bestD = d;
              owner = k;
            }
          }
        }
        if (owner >= 0) out[i] = owner;
      }
    }
    return out;
  }

  function colorDist2(a, b) {
    var dr = a[0] - b[0];
    var dg = a[1] - b[1];
    var db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function linChan(c) {
    var x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  }

  function toOklab(rgb) {
    var r = linChan(rgb[0]);
    var g = linChan(rgb[1]);
    var b = linChan(rgb[2]);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }

  function labDist2(a, b) {
    var dl = a[0] - b[0];
    var da = a[1] - b[1];
    var db = a[2] - b[2];
    return dl * dl + da * da + db * db;
  }

  function quantizeInks(rgb, w, h, paper) {
    var n = w * h;
    var stride = Math.max(1, (n / 3200) | 0);
    var samples = [];
    var i, o, r, g, b, c, s, best, bestD, d, iter, sum, cnt;
    for (i = 0; i < n; i += stride) {
      o = i * 3;
      r = rgb[o];
      g = rgb[o + 1];
      b = rgb[o + 2];
      if (isBackdrop(r, g, b, paper)) continue;
      samples.push([r, g, b]);
    }
    if (samples.length < 16) return [];
    var labs = [];
    for (s = 0; s < samples.length; s++) labs.push(toOklab(samples[s]));
    var k = 4;
    var seed = (samples.length / 3) | 0;
    var centers = [samples[seed].slice()];
    var centerLab = [labs[seed].slice()];
    var far, farD;
    while (centers.length < k) {
      far = 0;
      farD = -1;
      for (s = 0; s < samples.length; s++) {
        bestD = 1e12;
        for (c = 0; c < centerLab.length; c++) {
          d = labDist2(labs[s], centerLab[c]);
          if (d < bestD) bestD = d;
        }
        if (bestD > farD) {
          farD = bestD;
          far = s;
        }
      }
      if (farD < 0.014) break;
      centers.push(samples[far].slice());
      centerLab.push(labs[far].slice());
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
        for (c = 0; c < centerLab.length; c++) {
          d = labDist2(labs[s], centerLab[c]);
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
        centerLab[c] = toOklab(centers[c]);
      }
    }
    var kept = [];
    var keptLab = [];
    for (c = 0; c < centers.length; c++) {
      best = false;
      for (s = 0; s < keptLab.length; s++) {
        if (labDist2(centerLab[c], keptLab[s]) < 0.006) best = true;
      }
      if (!best) {
        kept.push(centers[c]);
        keptLab.push(centerLab[c]);
      }
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


  function distMap(mask, w, h) {
    var inf = w + h + 4;
    var d = new Float32Array(mask.length);
    var i, x, y, best;
    for (i = 0; i < mask.length; i++) d[i] = mask[i] ? inf : 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i]) continue;
        best = d[i];
        if (x > 0) best = Math.min(best, d[i - 1] + 1);
        if (y > 0) best = Math.min(best, d[i - w] + 1);
        if (x > 0 && y > 0) best = Math.min(best, d[i - w - 1] + 1.414);
        if (x + 1 < w && y > 0) best = Math.min(best, d[i - w + 1] + 1.414);
        d[i] = best;
      }
    }
    for (y = h - 1; y >= 0; y--) {
      for (x = w - 1; x >= 0; x--) {
        i = y * w + x;
        if (!mask[i]) continue;
        best = d[i];
        if (x + 1 < w) best = Math.min(best, d[i + 1] + 1);
        if (y + 1 < h) best = Math.min(best, d[i + w] + 1);
        if (x + 1 < w && y + 1 < h) best = Math.min(best, d[i + w + 1] + 1.414);
        if (x > 0 && y + 1 < h) best = Math.min(best, d[i + w - 1] + 1.414);
        d[i] = best;
      }
    }
    return d;
  }

  function zhangSuen(mask, w, h) {
    var img = new Uint8Array(mask);
    var changed = true;
    var pass, y, x, i, p, b, a, k, kill;
    function nb(px, py) {
      return [
        on(img, w, h, px, py - 1),
        on(img, w, h, px + 1, py - 1),
        on(img, w, h, px + 1, py),
        on(img, w, h, px + 1, py + 1),
        on(img, w, h, px, py + 1),
        on(img, w, h, px - 1, py + 1),
        on(img, w, h, px - 1, py),
        on(img, w, h, px - 1, py - 1)
      ];
    }
    while (changed) {
      changed = false;
      for (pass = 0; pass < 2; pass++) {
        kill = [];
        for (y = 1; y < h - 1; y++) {
          for (x = 1; x < w - 1; x++) {
            i = y * w + x;
            if (!img[i]) continue;
            p = nb(x, y);
            b = p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7];
            if (b < 2 || b > 6) continue;
            a = 0;
            for (k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++;
            if (a !== 1) continue;
            if (pass === 0) {
              if (p[0] && p[2] && p[4]) continue;
              if (p[2] && p[4] && p[6]) continue;
            } else {
              if (p[0] && p[2] && p[6]) continue;
              if (p[0] && p[4] && p[6]) continue;
            }
            kill.push(i);
          }
        }
        if (!kill.length) continue;
        changed = true;
        for (k = 0; k < kill.length; k++) img[kill[k]] = 0;
      }
    }
    return img;
  }

  function skelNeighbors(img, w, h, x, y) {
    var out = [];
    var k, nx, ny;
    for (k = 0; k < 8; k++) {
      nx = x + DX[k];
      ny = y + DY[k];
      if (on(img, w, h, nx, ny)) out.push([nx, ny]);
    }
    return out;
  }

  function walkSkeleton(img, w, h) {
    var seen = new Uint8Array(img.length);
    var chains = [];
    var y, x, i, deg, nbs, start, pts, prev, cur, nxt, guard, k;
    function degree(px, py) {
      return skelNeighbors(img, w, h, px, py).length;
    }
    function trace(sx, sy, from) {
      var pts = [[sx, sy]];
      var prev = from;
      var cur = [sx, sy];
      var guard = 0;
      seen[sy * w + sx] = 1;
      while (guard++ < w * h) {
        var nbs = skelNeighbors(img, w, h, cur[0], cur[1]);
        var nxt = null;
        for (var k = 0; k < nbs.length; k++) {
          if (prev && nbs[k][0] === prev[0] && nbs[k][1] === prev[1]) continue;
          nxt = nbs[k];
          break;
        }
        if (!nxt) break;
        if (seen[nxt[1] * w + nxt[0]] && !(nxt[0] === sx && nxt[1] === sy)) break;
        pts.push(nxt);
        if (nxt[0] === sx && nxt[1] === sy) break;
        seen[nxt[1] * w + nxt[0]] = 1;
        prev = cur;
        cur = nxt;
        if (degree(cur[0], cur[1]) !== 2 && pts.length > 1) break;
      }
      return pts;
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!img[i] || seen[i]) continue;
        deg = degree(x, y);
        if (deg === 2) continue;
        chains.push(trace(x, y, null));
      }
    }
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!img[i] || seen[i]) continue;
        chains.push(trace(x, y, null));
      }
    }
    return chains;
  }

  function relaxSpine(points, closed) {
    if (!points || points.length < 5) return points;
    var out = points.map(function (p) { return p.slice(); });
    var pass, i, n, a, b, c;
    for (pass = 0; pass < 2; pass++) {
      n = out.length;
      var next = out.map(function (p) { return p.slice(); });
      for (i = 0; i < n; i++) {
        if (!closed && (i === 0 || i === n - 1)) continue;
        a = out[(i + n - 1) % n];
        b = out[i];
        c = out[(i + 1) % n];
        next[i] = [(a[0] + b[0] * 2 + c[0]) / 4, (a[1] + b[1] * 2 + c[1]) / 4];
      }
      out = next;
    }
    return out;
  }

  function flattenStairs(points, closed) {
    if (!points || points.length < 4) return points;
    var eps = 0.78;
    var n = points.length;
    var i, j, k, far, ok, keep, out, packed;
    if (closed) {
      packed = chordStraighten(points.concat([points[0].slice()]), eps);
      if (!packed || packed.length < 4) return points;
      return packed.slice(0, -1);
    }
    keep = [0];
    i = 0;
    while (i < n - 1) {
      far = i + 1;
      for (j = i + 2; j < n; j++) {
        ok = true;
        for (k = i + 1; k < j; k++) {
          if (distPointSeg(points[k], points[i], points[j]) > eps) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
        far = j;
      }
      keep.push(far);
      i = far;
    }
    out = [];
    for (i = 0; i < keep.length; i++) out.push(points[keep[i]].slice());
    return out.length >= 2 ? out : points;
  }

  function miterOpenElbow(points) {
    if (!points || points.length < 4) return points;
    var out = points.map(function (p) { return p.slice(); });
    var changed = true;
    var guard = 0;
    while (changed && guard < 6) {
      changed = false;
      guard++;
      var n = out.length;
      var i, j, k, a, b, c, d, inLen, outLen, elbow, dx1, dy1, dx2, dy2, dot, hit, da, db;
      for (i = 0; i < n - 3; i++) {
        a = out[i];
        b = out[i + 1];
        for (j = i + 2; j <= Math.min(i + 3, n - 2); j++) {
          c = out[j];
          d = out[j + 1];
          inLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
          outLen = Math.hypot(d[0] - c[0], d[1] - c[1]);
          if (inLen < 12 || outLen < 12) continue;
          elbow = 0;
          for (k = i + 1; k < j; k++) elbow += Math.hypot(out[k + 1][0] - out[k][0], out[k + 1][1] - out[k][1]);
          if (elbow > 6.4) continue;
          dx1 = b[0] - a[0];
          dy1 = b[1] - a[1];
          dx2 = d[0] - c[0];
          dy2 = d[1] - c[1];
          dot = (dx1 * dx2 + dy1 * dy2) / (inLen * outLen);
          if (dot > 0.62 || dot < -0.9) continue;
          hit = lineCross(a, b, c, d);
          if (!hit) continue;
          da = Math.hypot(hit[0] - b[0], hit[1] - b[1]);
          db = Math.hypot(hit[0] - c[0], hit[1] - c[1]);
          if (da > 6.2 || db > 6.2) continue;
          out.splice(i + 1, j - i, [hit[0], hit[1]]);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    return out;
  }

  function toOpenPath(points, ox, oy, scale, opts, closed) {
    if (!points || points.length < 2) return "";
    points = flattenStairs(relaxSpine(points, closed), closed);
    if (!closed) points = miterOpenElbow(points);
    var alphamax = 1.15;
    var opttolerance = 0.42;
    var ring = points;
    var corners = [0];
    var i, a, b, c, from, to, span, idx, guard, segs, fit, parts, s, seg;
    if (closed && points.length > 2) {
      fit = fitContour(points.concat([points[0].slice()]), alphamax, opttolerance);
      if (!fit || !fit.segs.length) return "";
      parts = ["M" + xy(fit.start, ox, oy, scale)];
      for (s = 0; s < fit.segs.length; s++) {
        seg = fit.segs[s];
        if (seg.k === "C") parts.push("C" + xy(seg.c[1], ox, oy, scale) + " " + xy(seg.c[2], ox, oy, scale) + " " + xy(seg.c[3], ox, oy, scale));
        else parts.push("L" + xy(seg.p, ox, oy, scale));
      }
      parts.push("Z");
      return parts.join(" ");
    }
    for (i = 1; i < ring.length - 1; i++) {
      a = ring[i - 1];
      b = ring[i];
      c = ring[i + 1];
      if (turnAt(a, b, c) < alphamax) continue;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1.6) continue;
      if (Math.hypot(c[0] - b[0], c[1] - b[1]) < 1.6) continue;
      corners.push(i);
    }
    corners.push(ring.length - 1);
    segs = [];
    for (i = 0; i < corners.length - 1; i++) {
      from = corners[i];
      to = corners[i + 1];
      span = ring.slice(from, to + 1);
      if (span.length < 4 || flatSpan(span)) segs.push({ k: "L", p: span[span.length - 1] });
      else segs = segs.concat(opticurve(fitSpan(span, opttolerance, 0), opttolerance));
    }
    parts = ["M" + xy(ring[0], ox, oy, scale)];
    for (s = 0; s < segs.length; s++) {
      seg = segs[s];
      if (seg.k === "C") parts.push("C" + xy(seg.c[1], ox, oy, scale) + " " + xy(seg.c[2], ox, oy, scale) + " " + xy(seg.c[3], ox, oy, scale));
      else parts.push("L" + xy(seg.p, ox, oy, scale));
    }
    return parts.join(" ");
  }


  function joinChains(chains) {
    var pool = [];
    var i, c;
    for (i = 0; i < chains.length; i++) {
      c = chains[i];
      if (c && c.length >= 2) pool.push(c.map(function (p) { return p.slice(); }));
    }
    function near(a, b) {
      return Math.hypot(a[0] - b[0], a[1] - b[1]) <= 6.5;
    }
    var changed = true;
    while (changed) {
      changed = false;
      for (i = 0; i < pool.length; i++) {
        for (var j = i + 1; j < pool.length; j++) {
          var a = pool[i];
          var b = pool[j];
          var merged = null;
          if (near(a[a.length - 1], b[0])) merged = a.concat(b.slice(1));
          else if (near(a[a.length - 1], b[b.length - 1])) merged = a.concat(b.slice(0, -1).reverse());
          else if (near(a[0], b[0])) merged = a.slice().reverse().concat(b.slice(1));
          else if (near(a[0], b[b.length - 1])) merged = b.concat(a.slice(1));
          if (!merged) continue;
          pool[i] = merged;
          pool.splice(j, 1);
          changed = true;
          break;
        }
        if (changed) break;
      }
    }
    return pool;
  }

  function peelThin(mask, w, h) {
    var seen = new Uint8Array(mask.length);
    var rest = new Uint8Array(mask);
    var strokes = [];
    var y, x, i, stack, cells, cx, cy, nx, ny, k, idx, local, dist, samples, width, skel, chains, best, pts, closed, s;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = y * w + x;
        if (!mask[i] || seen[i]) continue;
        stack = [[x, y]];
        seen[i] = 1;
        cells = [];
        while (stack.length) {
          var c = stack.pop();
          cx = c[0];
          cy = c[1];
          cells.push(c);
          for (k = 0; k < 8; k++) {
            nx = cx + DX[k];
            ny = cy + DY[k];
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            idx = ny * w + nx;
            if (!mask[idx] || seen[idx]) continue;
            seen[idx] = 1;
            stack.push([nx, ny]);
          }
        }
        if (cells.length < 12) continue;
        local = new Uint8Array(w * h);
        for (k = 0; k < cells.length; k++) local[cells[k][1] * w + cells[k][0]] = 1;
        dist = distMap(local, w, h);
        samples = [];
        for (k = 0; k < cells.length; k++) samples.push(dist[cells[k][1] * w + cells[k][0]]);
        samples.sort(function (a, b) { return a - b; });
        width = samples[Math.min(samples.length - 1, (samples.length * 0.9) | 0)] * 2;
        if (width > 6.5 || samples[samples.length - 1] > 5.5) continue;
        skel = zhangSuen(local, w, h);
        chains = joinChains(walkSkeleton(skel, w, h));
        if (!chains.length) continue;
        for (k = 0; k < cells.length; k++) rest[cells[k][1] * w + cells[k][0]] = 0;
        for (k = 0; k < chains.length; k++) {
          best = chains[k];
          if (!best || best.length < 6) continue;
          closed = best.length > 8 && Math.hypot(best[0][0] - best[best.length - 1][0], best[0][1] - best[best.length - 1][1]) <= 6.5;
          pts = [];
          for (s = 0; s < best.length; s++) pts.push([best[s][0] + 0.5, best[s][1] + 0.5]);
          if (closed) pts = pts.slice(0, -1);
          strokes.push({ points: pts, closed: closed, width: width });
        }
      }
    }
    return { rest: rest, strokes: strokes };
  }

  function shapesFromMask(mask, w, h, opts, job, idBase, cover, labels, inkIndex) {
    var turd = opts.turdsize != null ? opts.turdsize : Math.max(6, Math.round((w * h) / 14000));
    var ink = bridgeGaps(mask, w, h);
    ink = smoothMask(ink, w, h);
    ink = despeckle(ink, w, h, turd);
    ink = fillSmallHoles(ink, w, h, turd);
    ink = dilate(ink, w, h);
    var peeled = peelThin(ink, w, h);
    ink = peeled.rest;
    var field = cover || softField(ink, w, h);
    var pin = labels ? seamPin(ink, labels, w, h, inkIndex) : null;
    var rings = dropHoleEchoes(sealRings(contours(ink, w, h, opts.maxContours || 32)), sealRings(holeContours(ink, w, h, opts.maxHoles || 12)));
    var raw = prepare(rings, ink, w, h, opts.alphamax, field, 128, pin);
    var holes = prepare(sealRings(holeContours(ink, w, h, opts.maxHoles || 12)), ink, w, h, opts.alphamax, field, 128, pin);
    var eps = opts.epsilon != null ? opts.epsilon : Math.max(0.65, Math.min(1.25, Math.max(w, h) / 360));
    var minArea = opts.minArea != null ? opts.minArea : Math.max(10, (w * h) / 9000);
    var simplified = simplify(raw, eps, minArea, opts.alphamax, ink, w, h);
    var holeSlim = simplify(holes, eps, minArea, opts.alphamax, ink, w, h);
    simplified.sort(function (a, b) { return area(b) - area(a); });
    simplified = simplified.slice(0, opts.maxShapes || 14);
    var edge = Math.max(w, h);
    var scale = 1024 / edge;
    var ox = (1024 - w * scale) / 2;
    var oy = (1024 - h * scale) / 2;
    var shapes = [];
    var owners = holeParents(simplified, holeSlim);
    var i, j, d, hd, strokePath, sw;
    var role = job === "accent" ? "accent" : "figure";
    for (i = 0; i < peeled.strokes.length; i++) {
      strokePath = toOpenPath(peeled.strokes[i].points, ox, oy, scale, opts, peeled.strokes[i].closed);
      if (!strokePath) continue;
      sw = Math.max(1, round1(peeled.strokes[i].width * scale));
      shapes.push({
        id: idBase + "-stroke-" + (shapes.length + 1),
        type: "path",
        role: role,
        fill: "none",
        stroke: job,
        strokeWidth: sw,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: strokePath
      });
    }
    for (i = 0; i < simplified.length; i++) {
      var fitted = thinFit(simplified[i], ink, w, h, opts);
      d = toPath(fitted.points, ox, oy, scale, fitted.opts);
      if (!d) continue;
      for (j = 0; j < holeSlim.length; j++) {
        if (owners[j] !== i) continue;
        var holeFit = thinFit(holeSlim[j], ink, w, h, opts);
        hd = toPath(holeFit.points, ox, oy, scale, holeFit.opts);
        if (!hd) continue;
        d += " " + hd;
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
    var paper = borderPaper(rch, gch, bch, w, h);
    var centers = quantizeInks(packed, w, h, paper);
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
    var counts = [];
    for (c = 0; c < centers.length; c++) counts.push(0);
    var cutoff = 0.028;
    var centerLab = [];
    for (c = 0; c < centers.length; c++) centerLab.push(toOklab(centers[c]));
    var labels = new Int8Array(w * h);
    for (i = 0; i < labels.length; i++) labels[i] = -1;
    var best, bestD, d, r, g, b, pix;
    for (i = 0; i < w * h; i++) {
      r = rch[i];
      g = gch[i];
      b = bch[i];
      if (isBackdrop(r, g, b, paper)) continue;
      pix = toOklab([r, g, b]);
      best = -1;
      bestD = cutoff;
      for (c = 0; c < centerLab.length; c++) {
        d = labDist2(pix, centerLab[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best < 0) continue;
      labels[i] = best;
    }
    var inkCounts = [];
    for (c = 0; c < centers.length; c++) inkCounts.push(0);
    for (i = 0; i < labels.length; i++) {
      if (labels[i] >= 0) inkCounts[labels[i]]++;
    }
    labels = mergeFringe(labels, inkCounts, centerLab, paper, w, h);
    labels = snapHalo(labels, rch, gch, bch, w, h, centerLab, paper);
    labels = snapHalo(labels, rch, gch, bch, w, h, centerLab, paper);
    labels = majorityLabels(labels, w, h, centers.length);
    labels = foldSeamFringe(labels, rch, gch, bch, centerLab, w, h);
    var masks = [];
    for (c = 0; c < centers.length; c++) masks.push(new Uint8Array(w * h));
    for (i = 0; i < labels.length; i++) {
      if (labels[i] < 0) continue;
      masks[labels[i]][i] = 1;
      counts[labels[i]]++;
    }
    var order = [];
    for (c = 0; c < centers.length; c++) order.push(c);
    order.sort(function (a, b) { return counts[b] - counts[a]; });
    var shapes = [];
    var inks = [];
    var palette = { ground: paper ? hexOf(paper.rgb[0], paper.rgb[1], paper.rgb[2]) : "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
    var turd = opts.turdsize != null ? opts.turdsize : Math.max(6, Math.round((w * h) / 14000));
    for (c = 0; c < order.length; c++) {
      if (counts[order[c]] < turd) continue;
      if (inks.length >= 4) break;
      var job = jobs[inks.length];
      var hex = hexOf(centers[order[c]][0], centers[order[c]][1], centers[order[c]][2]);
      var cover = paper ? coverageField(rch, gch, bch, w, h, centerLab[order[c]], paper.lab) : null;
      var batch = shapesFromMask(masks[order[c]], w, h, opts, job, "trace-" + job, cover, labels, order[c]);
      if (!batch.length) continue;
      palette[job] = hex;
      inks.push({ role: job, hex: hex, contours: batch.length });
      for (i = 0; i < batch.length; i++) shapes.push(batch[i]);
      if (shapes.length >= 32) break;
    }
    if (!shapes.length) return { ok: false, error: "no contours" };
    return {
      ok: true,
      viewBox: [0, 0, 1024, 1024],
      inks: inks,
      palette: palette,
      ignoreWhite: true,
      alphamax: opts.alphamax != null ? opts.alphamax : 0.95,
      opttolerance: opts.opttolerance != null ? opts.opttolerance : 0.36,
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
    mask = bridgeGaps(mask, w, h);
    mask = smoothMask(mask, w, h);
    mask = despeckle(mask, w, h, turd);
    mask = fillSmallHoles(mask, w, h, turd);
    var peeled = peelThin(mask, w, h);
    mask = peeled.rest;
    var rings = dropHoleEchoes(sealRings(contours(mask, w, h, opts.maxContours || 64)), sealRings(holeContours(mask, w, h, opts.maxHoles || 24)));
    var raw = prepare(rings, mask, w, h, opts.alphamax, bytes, level);
    var holes = prepare(sealRings(holeContours(mask, w, h, opts.maxHoles || 24)), mask, w, h, opts.alphamax, bytes, level);
    var eps = opts.epsilon != null ? opts.epsilon : Math.max(0.65, Math.min(1.25, Math.max(w, h) / 360));
    var minArea = opts.minArea != null ? opts.minArea : Math.max(10, (w * h) / 9000);
    var simplified = simplify(raw, eps, minArea, opts.alphamax, mask, w, h);
    var holeSlim = simplify(holes, eps, minArea, opts.alphamax, mask, w, h);
    simplified.sort(function (a, b) { return area(b) - area(a); });
    simplified = simplified.slice(0, opts.maxShapes || 18);
    var edge = Math.max(w, h);
    var scale = 1024 / edge;
    var ox = (1024 - w * scale) / 2;
    var oy = (1024 - h * scale) / 2;
    var shapes = [];
    var owners = holeParents(simplified, holeSlim);
    var i, j, d, hd, strokePath, sw;
    for (i = 0; i < peeled.strokes.length; i++) {
      strokePath = toOpenPath(peeled.strokes[i].points, ox, oy, scale, opts, peeled.strokes[i].closed);
      if (!strokePath) continue;
      sw = Math.max(1, round1(peeled.strokes[i].width * scale));
      shapes.push({
        id: "trace-stroke-" + (shapes.length + 1),
        type: "path",
        role: "figure",
        fill: "none",
        stroke: "figure",
        strokeWidth: sw,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: strokePath
      });
    }
    for (i = 0; i < simplified.length; i++) {
      var fitted = thinFit(simplified[i], mask, w, h, opts);
      d = toPath(fitted.points, ox, oy, scale, fitted.opts);
      if (!d) continue;
      for (j = 0; j < holeSlim.length; j++) {
        if (owners[j] !== i) continue;
        var holeFit = thinFit(holeSlim[j], mask, w, h, opts);
        hd = toPath(holeFit.points, ox, oy, scale, holeFit.opts);
        if (!hd) continue;
        d += " " + hd;
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
      opttolerance: opts.opttolerance != null ? opts.opttolerance : 0.36,
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
    var maxEdge = opts.maxEdge || 1024;
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
