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
    next.opttolerance = Math.max(0.24, Math.min(opts.opttolerance != null ? opts.opttolerance : 0.55, width * 0.1));
    next.alphamax = Math.min(opts.alphamax != null ? opts.alphamax : 0.95, 0.7);
    return { points: points, opts: next, thin: true, width: width };
  }

  function fitCubic(pts, ts) {
    var n = pts.length;
    var a = pts[0];
    var b = pts[n - 1];
    var t1 = tangentAt(pts, 0);
    var t2 = tangentAt(pts, n - 1);
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
    for (pass = 0; pass < 2; pass++) {
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

  function opticurve(segs, tol) {
    var cur = [];
    var i, seg, pts, end, merged, fit, err;
    for (i = 0; i < segs.length; i++) {
      seg = segs[i];
      if (seg.k === "C" && flatCubic(seg.c, tol * 0.65)) cur.push({ k: "L", p: seg.c[3], pts: seg.pts });
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
        if (err.max > tol || flatCubic(fit.cubic, tol * 0.65)) break;
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

  function turnAt(a, b, c) {
    var v1x = b[0] - a[0];
    var v1y = b[1] - a[1];
    var v2x = c[0] - b[0];
    var v2y = c[1] - b[1];
    return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
  }

  function fitContour(points, alphamax, opttolerance) {
    var ring = [];
    var i;
    for (i = 0; i < points.length; i++) {
      if (!ring.length || ring[ring.length - 1][0] !== points[i][0] || ring[ring.length - 1][1] !== points[i][1]) ring.push(points[i]);
    }
    while (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) ring.pop();
    if (ring.length < 3) return null;
    var limit = alphamax;
    var corners = [];
    var i, a, b, c;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      if (turnAt(a, b, c) >= limit || axisCorner(a, b, c)) corners.push(i);
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
      if (span.length < 4 || flatSpan(span)) segs.push({ k: "L", p: span[span.length - 1], pts: span });
      else segs = segs.concat(opticurve(fitSpan(span, opttolerance, 0), opttolerance));
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
    return blur3(field, w, h);
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
      var k;
      for (k = 0; k < run.length; k++) vals.push(ax === 1 ? ring[run[k]][1] : ring[run[k]][0]);
      vals.sort(function (a, b) { return a - b; });
      var med = vals[vals.length >> 1];
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
      if (turnAt(a, b, c) < 0.14 && distPointSeg(b, a, c) < 0.45) continue;
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

  function prepare(raw, mask, w, h, corner, field, level, pin) {
    var settled = [];
    var i, chain;
    for (i = 0; i < raw.length; i++) {
      chain = settle(raw[i], mask, w, h);
      if (field) chain = isoPlace(chain, field, w, h, level, pin);
      chain = snapOrthogonal(chain);
      chain = chordStraighten(chain, 0.82);
      settled.push(collapseCollinear(smoothChain(chain, corner)));
    }
    return settled;
  }

  function axisCorner(a, b, c) {
    var inn = axisOf(a, b);
    var out = axisOf(b, c);
    return !!(inn && out && inn !== out);
  }

  function cornerFlags(points, limit) {
    var pack = closedRing(points);
    var ring = pack.ring;
    var flags = [];
    var i, a, b, c;
    for (i = 0; i < points.length; i++) flags.push(0);
    if (ring.length < 3) return flags;
    for (i = 0; i < ring.length; i++) {
      a = ring[(i + ring.length - 1) % ring.length];
      b = ring[i];
      c = ring[(i + 1) % ring.length];
      if (turnAt(a, b, c) < limit && !axisCorner(a, b, c)) continue;
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

  function mergeFringe(labels, counts, centerLab, paper) {
    if (!paper) return labels;
    var alias = [];
    var c, p, parent;
    for (c = 0; c < centerLab.length; c++) alias.push(c);
    for (c = 0; c < centerLab.length; c++) {
      parent = -1;
      for (p = 0; p < centerLab.length; p++) {
        if (p === c || counts[p] <= counts[c]) continue;
        if (blendOff(centerLab[c], paper.lab, centerLab[p]) <= 0.0035) parent = p;
      }
      if (parent >= 0) alias[c] = alias[parent];
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

  function toOpenPath(points, ox, oy, scale, opts, closed) {
    if (!points || points.length < 2) return "";
    points = relaxSpine(points, closed);
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
      if (turnAt(a, b, c) >= alphamax) corners.push(i);
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
    labels = mergeFringe(labels, inkCounts, centerLab, paper);
    labels = snapHalo(labels, rch, gch, bch, w, h, centerLab, paper);
    labels = snapHalo(labels, rch, gch, bch, w, h, centerLab, paper);
    labels = majorityLabels(labels, w, h, centers.length);
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
