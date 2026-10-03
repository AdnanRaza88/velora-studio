(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function tokens(d) {
    return String(d || "").match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  }

  function absolute(d) {
    var parts = tokens(d);
    var out = [];
    var i = 0;
    var x = 0;
    var y = 0;
    var sx = 0;
    var sy = 0;
    var cmd = "";
    function take() { return parseFloat(parts[i++]); }
    function isCmd(t) { return /[a-zA-Z]/.test(t); }
    while (i < parts.length) {
      if (isCmd(parts[i])) cmd = parts[i++];
      if (!cmd) break;
      var op = cmd.toUpperCase();
      var rel = cmd !== op;
      if (op === "Z") {
        out.push({ op: "Z" });
        x = sx;
        y = sy;
        continue;
      }
      if (op === "M" || op === "L") {
        var mx = take();
        var my = take();
        if (rel) { mx += x; my += y; }
        x = mx;
        y = my;
        if (op === "M") { sx = x; sy = y; }
        out.push({ op: op, x: x, y: y });
        cmd = op === "M" ? (rel ? "l" : "L") : cmd;
        continue;
      }
      if (op === "H") {
        var hx = take();
        if (rel) hx += x;
        x = hx;
        out.push({ op: "L", x: x, y: y });
        continue;
      }
      if (op === "V") {
        var vy = take();
        if (rel) vy += y;
        y = vy;
        out.push({ op: "L", x: x, y: y });
        continue;
      }
      if (op === "C") {
        var c1x = take();
        var c1y = take();
        var c2x = take();
        var c2y = take();
        var cx = take();
        var cy = take();
        if (rel) {
          c1x += x; c1y += y; c2x += x; c2y += y; cx += x; cy += y;
        }
        out.push({ op: "C", x1: c1x, y1: c1y, x2: c2x, y2: c2y, x: cx, y: cy });
        x = cx;
        y = cy;
        continue;
      }
      if (op === "S") {
        var sx2 = take();
        var sy2 = take();
        var ex = take();
        var ey = take();
        if (rel) { sx2 += x; sy2 += y; ex += x; ey += y; }
        var prev = out[out.length - 1];
        var rx1 = x;
        var ry1 = y;
        if (prev && prev.op === "C") {
          rx1 = x * 2 - prev.x2;
          ry1 = y * 2 - prev.y2;
        }
        out.push({ op: "C", x1: rx1, y1: ry1, x2: sx2, y2: sy2, x: ex, y: ey });
        x = ex;
        y = ey;
        continue;
      }
      if (op === "Q") {
        var qx = take();
        var qy = take();
        var qex = take();
        var qey = take();
        if (rel) { qx += x; qy += y; qex += x; qey += y; }
        out.push({
          op: "C",
          x1: x + (2 / 3) * (qx - x),
          y1: y + (2 / 3) * (qy - y),
          x2: qex + (2 / 3) * (qx - qex),
          y2: qey + (2 / 3) * (qy - qey),
          x: qex,
          y: qey
        });
        x = qex;
        y = qey;
        continue;
      }
      if (op === "A") {
        i += 5;
        var ax = take();
        var ay = take();
        if (rel) { ax += x; ay += y; }
        out.push({ op: "L", x: ax, y: ay });
        x = ax;
        y = ay;
        continue;
      }
      break;
    }
    return out;
  }

  function openChain(d) {
    var cmds = absolute(d);
    if (cmds.length < 2 || cmds[0].op !== "M") return null;
    var closed = false;
    var chain = [];
    for (var i = 0; i < cmds.length; i++) {
      if (cmds[i].op === "Z") { closed = true; break; }
      if (cmds[i].op === "M" && i > 0) return null;
      chain.push(cmds[i]);
    }
    if (closed || chain.length < 2) return null;
    var a = chain[0];
    var b = chain[chain.length - 1];
    return { cmds: chain, start: { x: a.x, y: a.y }, end: { x: b.x, y: b.y } };
  }

  function reverseChain(cmds) {
    var segs = [];
    var x = cmds[0].x;
    var y = cmds[0].y;
    for (var i = 1; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.op === "C") segs.push({ op: "C", x0: x, y0: y, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, x: c.x, y: c.y });
      else segs.push({ op: "L", x0: x, y0: y, x: c.x, y: c.y });
      x = c.x;
      y = c.y;
    }
    segs.reverse();
    var last = cmds[cmds.length - 1];
    var out = [{ op: "M", x: last.x, y: last.y }];
    segs.forEach(function (s) {
      if (s.op === "C") out.push({ op: "C", x1: s.x2, y1: s.y2, x2: s.x1, y2: s.y1, x: s.x0, y: s.y0 });
      else out.push({ op: "L", x: s.x0, y: s.y0 });
    });
    return out;
  }

  function write(cmds, close) {
    var d = "";
    cmds.forEach(function (c) {
      if (c.op === "M") d += "M" + round(c.x) + " " + round(c.y);
      else if (c.op === "L") d += "L" + round(c.x) + " " + round(c.y);
      else if (c.op === "C") d += "C" + round(c.x1) + " " + round(c.y1) + " " + round(c.x2) + " " + round(c.y2) + " " + round(c.x) + " " + round(c.y);
    });
    if (close) d += "Z";
    return d;
  }

  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function drop(doc, id) {
    var layers = (doc && doc.layers) || [];
    for (var i = 0; i < layers.length; i++) {
      var shapes = layers[i].shapes || [];
      for (var j = 0; j < shapes.length; j++) {
        if (shapes[j].id === id) {
          shapes.splice(j, 1);
          return true;
        }
      }
    }
    return false;
  }

  function stamp(doc) {
    if (doc.meta) doc.meta.updated = new Date().toISOString();
  }

  function apply(doc, ids) {
    if (!doc || !ids || !ids.length) return null;
    var find = root.VeloraEdit && root.VeloraEdit.find
      ? function (id) { return root.VeloraEdit.find(doc, id); }
      : function () { return null; };
    var opens = [];
    ids.forEach(function (id) {
      var shape = find(id);
      if (!shape || shape.type !== "path") return;
      var chain = openChain(shape.d);
      if (!chain) return;
      opens.push({ shape: shape, chain: chain });
    });
    if (!opens.length) return null;
    if (opens.length === 1) {
      var one = opens[0];
      var gap = dist(one.chain.start, one.chain.end);
      var cmds = one.chain.cmds.slice();
      if (gap > 0.75) cmds.push({ op: "L", x: one.chain.start.x, y: one.chain.start.y });
      one.shape.d = write(cmds, true);
      stamp(doc);
      return one.shape;
    }
    var best = null;
    for (var a = 0; a < opens.length; a++) {
      for (var b = a + 1; b < opens.length; b++) {
        var left = opens[a];
        var right = opens[b];
        var pairs = [
          { d: dist(left.chain.end, right.chain.start), flipL: false, flipR: false },
          { d: dist(left.chain.end, right.chain.end), flipL: false, flipR: true },
          { d: dist(left.chain.start, right.chain.start), flipL: true, flipR: false },
          { d: dist(left.chain.start, right.chain.end), flipL: true, flipR: true }
        ];
        pairs.forEach(function (pair) {
          if (!best || pair.d < best.d) best = { d: pair.d, left: left, right: right, flipL: pair.flipL, flipR: pair.flipR };
        });
      }
    }
    if (!best) return null;
    var lc = best.flipL ? reverseChain(best.left.chain.cmds) : best.left.chain.cmds.slice();
    var rc = best.flipR ? reverseChain(best.right.chain.cmds) : best.right.chain.cmds.slice();
    var tail = lc[lc.length - 1];
    var head = rc[0];
    if (dist(tail, head) > 0.75) lc.push({ op: "L", x: head.x, y: head.y });
    else {
      tail.x = (tail.x + head.x) / 2;
      tail.y = (tail.y + head.y) / 2;
    }
    var joined = lc.concat(rc.slice(1));
    best.left.shape.d = write(joined, false);
    drop(doc, best.right.shape.id);
    stamp(doc);
    return best.left.shape;
  }

  root.VeloraJoin = { apply: apply, openChain: openChain };
})(typeof window !== "undefined" ? window : globalThis);
