(function (root) {
  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function applyPoint(m, x, y) {
    return {
      x: m[0] * x + m[2] * y + m[4],
      y: m[1] * x + m[3] * y + m[5]
    };
  }

  function multiply(a, b) {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }

  function identity() {
    return [1, 0, 0, 1, 0, 0];
  }

  function moveMatrix(dx, dy) {
    return [1, 0, 0, 1, dx, dy];
  }

  function scaleMatrix(sx, sy, ox, oy) {
    return multiply(multiply(moveMatrix(ox, oy), [sx, 0, 0, sy, 0, 0]), moveMatrix(-ox, -oy));
  }

  function rotateMatrix(deg, ox, oy) {
    var r = deg * Math.PI / 180;
    var c = Math.cos(r);
    var s = Math.sin(r);
    return multiply(multiply(moveMatrix(ox, oy), [c, s, -s, c, 0, 0]), moveMatrix(-ox, -oy));
  }

  function tokens(d) {
    return String(d || "").match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
  }

  function toAbsolute(d) {
    var parts = tokens(d);
    var i = 0;
    var cmd = "";
    var x = 0;
    var y = 0;
    var sx = 0;
    var sy = 0;
    var out = [];
    function take() { return parseFloat(parts[i++]); }
    function isCmd(t) { return /[A-Za-z]/.test(t); }
    while (i < parts.length) {
      if (isCmd(parts[i])) cmd = parts[i++];
      var rel = cmd === cmd.toLowerCase();
      var op = cmd.toUpperCase();
      if (op === "Z") {
        out.push({ op: "Z" });
        x = sx;
        y = sy;
        continue;
      }
      if (op === "M") {
        var mx = take();
        var my = take();
        if (rel) { mx += x; my += y; }
        x = mx;
        y = my;
        sx = x;
        sy = y;
        out.push({ op: "M", x: x, y: y });
        op = "L";
        while (i < parts.length && !isCmd(parts[i])) {
          var lx = take();
          var ly = take();
          if (rel) { lx += x; ly += y; }
          x = lx;
          y = ly;
          out.push({ op: "L", x: x, y: y });
        }
        continue;
      }
      if (op === "L") {
        var px = take();
        var py = take();
        if (rel) { px += x; py += y; }
        x = px;
        y = py;
        out.push({ op: "L", x: x, y: y });
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
        var hy = take();
        if (rel) hy += y;
        y = hy;
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
      if (op === "Q") {
        var qx = take();
        var qy = take();
        var ex = take();
        var ey = take();
        if (rel) { qx += x; qy += y; ex += x; ey += y; }
        out.push({ op: "Q", x1: qx, y1: qy, x: ex, y: ey });
        x = ex;
        y = ey;
        continue;
      }
      if (op === "A") {
        var rx = take();
        var ry = take();
        var ang = take();
        var large = take();
        var sweep = take();
        var ax = take();
        var ay = take();
        if (rel) { ax += x; ay += y; }
        out.push({ op: "A", rx: rx, ry: ry, ang: ang, large: large, sweep: sweep, x: ax, y: ay, x0: x, y0: y });
        x = ax;
        y = ay;
        continue;
      }
      if (i < parts.length && !isCmd(parts[i])) i++;
    }
    return out;
  }

  function fmt(n) {
    var v = round(n);
    if (Object.is(v, -0)) v = 0;
    return String(v);
  }

  function writePath(cmds, m) {
    var d = "";
    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.op === "Z") {
        d += "Z";
        continue;
      }
      if (c.op === "M" || c.op === "L") {
        var p = applyPoint(m, c.x, c.y);
        d += c.op + fmt(p.x) + " " + fmt(p.y);
        continue;
      }
      if (c.op === "C") {
        var p1 = applyPoint(m, c.x1, c.y1);
        var p2 = applyPoint(m, c.x2, c.y2);
        var p3 = applyPoint(m, c.x, c.y);
        d += "C" + fmt(p1.x) + " " + fmt(p1.y) + " " + fmt(p2.x) + " " + fmt(p2.y) + " " + fmt(p3.x) + " " + fmt(p3.y);
        continue;
      }
      if (c.op === "Q") {
        var q1 = applyPoint(m, c.x1, c.y1);
        var q2 = applyPoint(m, c.x, c.y);
        d += "Q" + fmt(q1.x) + " " + fmt(q1.y) + " " + fmt(q2.x) + " " + fmt(q2.y);
        continue;
      }
      if (c.op === "A") {
        var start = applyPoint(m, c.x0, c.y0);
        var end = applyPoint(m, c.x, c.y);
        var sx = Math.hypot(m[0], m[1]);
        var sy = Math.hypot(m[2], m[3]);
        var rot = Math.atan2(m[1], m[0]) * 180 / Math.PI;
        d += "M" + fmt(start.x) + " " + fmt(start.y);
        d += "A" + fmt(c.rx * sx) + " " + fmt(c.ry * sy) + " " + fmt(c.ang + rot) + " " + c.large + " " + c.sweep + " " + fmt(end.x) + " " + fmt(end.y);
      }
    }
    return d;
  }

  function ellipsePath(cx, cy, rx, ry) {
    var k = 0.5522847498;
    return "M" + fmt(cx + rx) + " " + fmt(cy) +
      "C" + fmt(cx + rx) + " " + fmt(cy + ry * k) + " " + fmt(cx + rx * k) + " " + fmt(cy + ry) + " " + fmt(cx) + " " + fmt(cy + ry) +
      "C" + fmt(cx - rx * k) + " " + fmt(cy + ry) + " " + fmt(cx - rx) + " " + fmt(cy + ry * k) + " " + fmt(cx - rx) + " " + fmt(cy) +
      "C" + fmt(cx - rx) + " " + fmt(cy - ry * k) + " " + fmt(cx - rx * k) + " " + fmt(cy - ry) + " " + fmt(cx) + " " + fmt(cy - ry) +
      "C" + fmt(cx + rx * k) + " " + fmt(cy - ry) + " " + fmt(cx + rx) + " " + fmt(cy - ry * k) + " " + fmt(cx + rx) + " " + fmt(cy) + "Z";
  }

  function rectPath(shape) {
    var x = shape.x;
    var y = shape.y;
    var w = shape.w;
    var h = shape.h;
    return "M" + fmt(x) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y + h) + "L" + fmt(x) + " " + fmt(y + h) + "Z";
  }

  function boundsOf(shape) {
    if (!shape) return null;
    if (shape.type === "circle") return { x: shape.cx - shape.r, y: shape.cy - shape.r, w: shape.r * 2, h: shape.r * 2, cx: shape.cx, cy: shape.cy };
    if (shape.type === "ellipse") return { x: shape.cx - shape.rx, y: shape.cy - shape.ry, w: shape.rx * 2, h: shape.ry * 2, cx: shape.cx, cy: shape.cy };
    if (shape.type === "rect") return { x: shape.x, y: shape.y, w: shape.w, h: shape.h, cx: shape.x + shape.w / 2, cy: shape.y + shape.h / 2 };
    if (shape.type === "line") {
      var x1 = Math.min(shape.x1, shape.x2);
      var y1 = Math.min(shape.y1, shape.y2);
      return { x: x1, y: y1, w: Math.abs(shape.x2 - shape.x1), h: Math.abs(shape.y2 - shape.y1), cx: (shape.x1 + shape.x2) / 2, cy: (shape.y1 + shape.y2) / 2 };
    }
    if (shape.type === "text" && shape.onPath && typeof VeloraTypePath !== "undefined") {
      var along = VeloraTypePath.bounds(shape.onPath, shape.size * 0.6);
      if (along) return along;
    }
    if (shape.type === "text") return { x: shape.x - shape.size, y: shape.y - shape.size, w: shape.size * 2, h: shape.size, cx: shape.x, cy: shape.y };
    if (shape.type === "polygon") {
      var minX = Infinity;
      var minY = Infinity;
      var maxX = -Infinity;
      var maxY = -Infinity;
      shape.points.forEach(function (p) {
        minX = Math.min(minX, p[0]);
        minY = Math.min(minY, p[1]);
        maxX = Math.max(maxX, p[0]);
        maxY = Math.max(maxY, p[1]);
      });
      if (!isFinite(minX)) return null;
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    }
    if (shape.type === "path") {
      var cmds = toAbsolute(shape.d);
      var bx = Infinity;
      var by = Infinity;
      var ex = -Infinity;
      var ey = -Infinity;
      cmds.forEach(function (c) {
        ["x", "x0", "x1", "x2"].forEach(function (k) {
          if (c[k] != null) { bx = Math.min(bx, c[k]); ex = Math.max(ex, c[k]); }
        });
        ["y", "y0", "y1", "y2"].forEach(function (k) {
          if (c[k] != null) { by = Math.min(by, c[k]); ey = Math.max(ey, c[k]); }
        });
      });
      if (!isFinite(bx)) return null;
      return { x: bx, y: by, w: ex - bx, h: ey - by, cx: (bx + ex) / 2, cy: (by + ey) / 2 };
    }
    if (shape.type === "blend") {
      var fb = boundsOf(shape.from);
      var tb = boundsOf(shape.to);
      if (!fb) return tb;
      if (!tb) return fb;
      var x = Math.min(fb.x, tb.x);
      var y = Math.min(fb.y, tb.y);
      var r = Math.max(fb.x + fb.w, tb.x + tb.w);
      var t = Math.max(fb.y + fb.h, tb.y + tb.h);
      return { x: x, y: y, w: r - x, h: t - y, cx: (x + r) / 2, cy: (y + t) / 2 };
    }
    if (shape.type === "group") {
      var box = null;
      (shape.children || []).forEach(function (child) {
        var b = boundsOf(child);
        if (!b) return;
        if (!box) box = { x: b.x, y: b.y, w: b.w, h: b.h };
        else {
          var x = Math.min(box.x, b.x);
          var y = Math.min(box.y, b.y);
          var r = Math.max(box.x + box.w, b.x + b.w);
          var t = Math.max(box.y + box.h, b.y + b.h);
          box = { x: x, y: y, w: r - x, h: t - y };
        }
      });
      if (!box) return null;
      box.cx = box.x + box.w / 2;
      box.cy = box.y + box.h / 2;
      return box;
    }
    return null;
  }

  function asPath(shape) {
    var d = "";
    if (shape.type === "path") d = shape.d;
    else if (shape.type === "circle") d = ellipsePath(shape.cx, shape.cy, shape.r, shape.r);
    else if (shape.type === "ellipse") d = ellipsePath(shape.cx, shape.cy, shape.rx, shape.ry);
    else if (shape.type === "rect") d = rectPath(shape);
    else if (shape.type === "polygon") {
      d = shape.points.map(function (p, i) { return (i ? "L" : "M") + fmt(p[0]) + " " + fmt(p[1]); }).join("") + "Z";
    } else if (shape.type === "line") {
      d = "M" + fmt(shape.x1) + " " + fmt(shape.y1) + "L" + fmt(shape.x2) + " " + fmt(shape.y2);
    }
    if (!d) return shape;
    shape.type = "path";
    shape.d = writePath(toAbsolute(d), identity());
    delete shape.cx;
    delete shape.cy;
    delete shape.r;
    delete shape.rx;
    delete shape.ry;
    delete shape.x;
    delete shape.y;
    delete shape.w;
    delete shape.h;
    delete shape.rot;
    delete shape.points;
    delete shape.x1;
    delete shape.y1;
    delete shape.x2;
    delete shape.y2;
    return shape;
  }

  function transformShape(shape, m, mode) {
    if (!shape) return shape;
    if (shape.type === "group") {
      (shape.children || []).forEach(function (child) { transformShape(child, m, mode); });
      return shape;
    }
    if (shape.type === "blend") {
      transformShape(shape.from, m, mode);
      transformShape(shape.to, m, mode);
      return shape;
    }
    if (shape.type === "text" && shape.onPath) {
      shape.onPath = writePath(toAbsolute(shape.onPath), m);
      var mid = typeof VeloraTypePath !== "undefined" ? VeloraTypePath.pointAt(shape.onPath, 0.5) : null;
      if (mid) {
        shape.x = round(mid.x);
        shape.y = round(mid.y);
      }
      if (mode === "scale") shape.size = round(Math.max(8, shape.size * Math.abs(m[0])));
      shape.rot = 0;
      return shape;
    }
    if (mode === "move" && shape.type === "circle") {
      var c = applyPoint(m, shape.cx, shape.cy);
      shape.cx = round(c.x);
      shape.cy = round(c.y);
      return shape;
    }
    if (mode === "move" && shape.type === "ellipse") {
      var e = applyPoint(m, shape.cx, shape.cy);
      shape.cx = round(e.x);
      shape.cy = round(e.y);
      return shape;
    }
    if (mode === "move" && shape.type === "rect") {
      var r = applyPoint(m, shape.x, shape.y);
      shape.x = round(r.x);
      shape.y = round(r.y);
      return shape;
    }
    if (mode === "move" && shape.type === "text") {
      var t = applyPoint(m, shape.x, shape.y);
      shape.x = round(t.x);
      shape.y = round(t.y);
      return shape;
    }
    if (mode === "move" && shape.type === "line") {
      var a = applyPoint(m, shape.x1, shape.y1);
      var b = applyPoint(m, shape.x2, shape.y2);
      shape.x1 = round(a.x);
      shape.y1 = round(a.y);
      shape.x2 = round(b.x);
      shape.y2 = round(b.y);
      return shape;
    }
    if (mode === "move" && shape.type === "polygon") {
      shape.points = shape.points.map(function (p) {
        var q = applyPoint(m, p[0], p[1]);
        return [round(q.x), round(q.y)];
      });
      return shape;
    }
    if (mode === "scale" && shape.type === "circle" && Math.abs(m[0] - m[3]) < 0.001 && Math.abs(m[1]) < 0.001 && Math.abs(m[2]) < 0.001) {
      var cc = applyPoint(m, shape.cx, shape.cy);
      shape.cx = round(cc.x);
      shape.cy = round(cc.y);
      shape.r = round(Math.abs(shape.r * m[0]));
      return shape;
    }
    if (mode === "scale" && shape.type === "ellipse" && Math.abs(m[1]) < 0.001 && Math.abs(m[2]) < 0.001) {
      var ee = applyPoint(m, shape.cx, shape.cy);
      shape.cx = round(ee.x);
      shape.cy = round(ee.y);
      shape.rx = round(Math.abs(shape.rx * m[0]));
      shape.ry = round(Math.abs(shape.ry * m[3]));
      return shape;
    }
    if (mode === "scale" && shape.type === "rect" && !shape.rot && Math.abs(m[1]) < 0.001 && Math.abs(m[2]) < 0.001) {
      var p0 = applyPoint(m, shape.x, shape.y);
      var p1 = applyPoint(m, shape.x + shape.w, shape.y + shape.h);
      shape.x = round(Math.min(p0.x, p1.x));
      shape.y = round(Math.min(p0.y, p1.y));
      shape.w = round(Math.abs(p1.x - p0.x));
      shape.h = round(Math.abs(p1.y - p0.y));
      return shape;
    }
    if (mode === "scale" && shape.type === "text") {
      var tp = applyPoint(m, shape.x, shape.y);
      shape.x = round(tp.x);
      shape.y = round(tp.y);
      shape.size = round(Math.max(1, shape.size * Math.abs(m[0])));
      return shape;
    }
    if (mode === "rotate" && shape.type === "rect") {
      var center = applyPoint(m, shape.x + shape.w / 2, shape.y + shape.h / 2);
      var delta = Math.atan2(m[1], m[0]) * 180 / Math.PI;
      shape.x = round(center.x - shape.w / 2);
      shape.y = round(center.y - shape.h / 2);
      shape.rot = round((num(shape.rot, 0) + delta) % 360);
      return shape;
    }
    if (mode === "rotate" && shape.type === "text") {
      var tc = applyPoint(m, shape.x, shape.y);
      shape.x = round(tc.x);
      shape.y = round(tc.y);
      shape.rot = round((num(shape.rot, 0) + Math.atan2(m[1], m[0]) * 180 / Math.PI) % 360);
      return shape;
    }
    if (shape.type !== "path") asPath(shape);
    if (shape.type === "path") shape.d = writePath(toAbsolute(shape.d), m);
    return shape;
  }

  function find(doc, id, bag) {
    if (!doc || !id) return null;
    var layers = doc.layers || [];
    for (var i = 0; i < layers.length; i++) {
      var found = walk(layers[i].shapes || [], id, bag);
      if (found) return found;
    }
    return null;
  }

  function walk(shapes, id, bag) {
    for (var i = 0; i < shapes.length; i++) {
      if (shapes[i].id === id) return shapes[i];
      if (shapes[i].type === "group") {
        var hit = walk(shapes[i].children || [], id, bag);
        if (hit) return hit;
      }
    }
    return null;
  }

  function hitTest(doc, x, y) {
    var layers = (doc && doc.layers) || [];
    for (var i = layers.length - 1; i >= 0; i--) {
      if (layers[i].visible === false || layers[i].locked) continue;
      var hit = hitShapes(layers[i].shapes || [], x, y);
      if (hit) return hit;
    }
    return null;
  }

  function contains(box, x, y) {
    if (!box) return false;
    var pad = Math.max(6, Math.min(box.w, box.h) * 0.04);
    return x >= box.x - pad && x <= box.x + box.w + pad && y >= box.y - pad && y <= box.y + box.h + pad;
  }

  function hitShapes(shapes, x, y) {
    for (var i = shapes.length - 1; i >= 0; i--) {
      var shape = shapes[i];
      if (shape.type === "group") {
        var child = hitShapes(shape.children || [], x, y);
        if (child) return child;
      }
      if (contains(boundsOf(shape), x, y)) return shape;
    }
    return null;
  }

  function hostLayer(doc, id) {
    var layers = (doc && doc.layers) || [];
    for (var i = 0; i < layers.length; i++) {
      if (walk(layers[i].shapes || [], id)) return layers[i];
    }
    return null;
  }

  function apply(doc, id, m, mode) {
    var shape = find(doc, id);
    var host = hostLayer(doc, id);
    if (!shape || (host && host.locked)) return null;
    transformShape(shape, m, mode);
    if (doc.meta) doc.meta.updated = new Date().toISOString();
    return shape;
  }


  var JOBS = ["ground", "figure", "accent", "ink2", "ink3", "ink4"];

  function isHex(v) {
    return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
  }

  function expandHex(v) {
    if (!isHex(v)) return "";
    var s = v.toLowerCase();
    if (s.length === 4) return "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
    return s;
  }

  function sameInk(a, b) {
    var left = expandHex(a);
    return left && left === expandHex(b);
  }

  function eachShape(shapes, fn) {
    (shapes || []).forEach(function (shape) {
      fn(shape);
      if (shape.type === "group") eachShape(shape.children, fn);
    });
  }

  function recolor(doc, job, hex) {
    if (!doc || JOBS.indexOf(job) < 0) return null;
    var next = expandHex(hex);
    if (!next) return null;
    if (!doc.palette) doc.palette = {};
    var prev = doc.palette[job];
    doc.palette[job] = next;
    var linked = 0;
    (doc.layers || []).forEach(function (layer) {
      eachShape(layer.shapes, function (shape) {
        if (shape.role === job) linked++;
        ["fill", "stroke"].forEach(function (key) {
          if (shape[key] === job) return;
          if (prev && sameInk(shape[key], prev)) shape[key] = job;
        });
      });
    });
    if (doc.meta) doc.meta.updated = new Date().toISOString();
    return { job: job, color: next, linked: linked };
  }

  function serialize(cmds) {
    var d = "";
    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.op === "Z") { d += "Z"; continue; }
      if (c.op === "M" || c.op === "L") {
        d += c.op + fmt(c.x) + " " + fmt(c.y);
        continue;
      }
      if (c.op === "C") {
        d += "C" + fmt(c.x1) + " " + fmt(c.y1) + " " + fmt(c.x2) + " " + fmt(c.y2) + " " + fmt(c.x) + " " + fmt(c.y);
        continue;
      }
      if (c.op === "Q") {
        d += "Q" + fmt(c.x1) + " " + fmt(c.y1) + " " + fmt(c.x) + " " + fmt(c.y);
        continue;
      }
      if (c.op === "A") {
        d += "A" + fmt(c.rx) + " " + fmt(c.ry) + " " + fmt(c.ang) + " " + c.large + " " + c.sweep + " " + fmt(c.x) + " " + fmt(c.y);
      }
    }
    return d;
  }

  function penReady(shape) {
    if (!shape || shape.type === "group" || shape.type === "text") return null;
    if (shape.type !== "path") asPath(shape);
    return shape.type === "path" ? shape : null;
  }

  function handlesOf(shape) {
    if (!shape || shape.type !== "path") return [];
    var cmds = toAbsolute(shape.d);
    var out = [];
    for (var i = 0; i < cmds.length; i++) {
      var c = cmds[i];
      if (c.op === "C") {
        out.push({ i: i, role: "in", x: c.x1, y: c.y1 });
        out.push({ i: i, role: "out", x: c.x2, y: c.y2 });
      } else if (c.op === "Q") {
        out.push({ i: i, role: "ctrl", x: c.x1, y: c.y1 });
      }
      if (c.x != null && c.y != null) out.push({ i: i, role: "anchor", x: c.x, y: c.y });
    }
    return out;
  }

  function shiftHandle(cmds, index, role, dx, dy) {
    var c = cmds[index];
    if (!c) return;
    if (role === "anchor") {
      if (c.x == null) return;
      c.x = round(c.x + dx);
      c.y = round(c.y + dy);
      if (c.op === "C") { c.x2 = round(c.x2 + dx); c.y2 = round(c.y2 + dy); }
      if (c.op === "Q") { c.x1 = round(c.x1 + dx); c.y1 = round(c.y1 + dy); }
      var next = cmds[index + 1];
      if (next && next.op === "C") { next.x1 = round(next.x1 + dx); next.y1 = round(next.y1 + dy); }
      if (next && next.op === "Q") { next.x1 = round(next.x1 + dx); next.y1 = round(next.y1 + dy); }
      return;
    }
    if (role === "in" && c.op === "C") { c.x1 = round(c.x1 + dx); c.y1 = round(c.y1 + dy); }
    if (role === "out" && c.op === "C") { c.x2 = round(c.x2 + dx); c.y2 = round(c.y2 + dy); }
    if (role === "ctrl" && c.op === "Q") { c.x1 = round(c.x1 + dx); c.y1 = round(c.y1 + dy); }
  }

  function moveHandle(doc, id, index, role, x, y) {
    var shape = penReady(find(doc, id));
    if (!shape) return null;
    var cmds = toAbsolute(shape.d);
    var c = cmds[index];
    if (!c) return null;
    var ox = role === "anchor" ? c.x : (role === "out" ? c.x2 : c.x1);
    var oy = role === "anchor" ? c.y : (role === "out" ? c.y2 : c.y1);
    if (ox == null || oy == null) return null;
    shiftHandle(cmds, index, role, x - ox, y - oy);
    shape.d = serialize(cmds);
    if (doc.meta) doc.meta.updated = new Date().toISOString();
    return shape;
  }

  function hitHandle(shape, x, y, radius) {
    var list = handlesOf(shape);
    var best = null;
    var bestD = radius;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var dist = Math.hypot(h.x - x, h.y - y);
      var limit = h.role === "anchor" ? radius : radius * 0.8;
      if (dist <= limit && (best == null || dist < bestD)) {
        best = h;
        bestD = dist;
      }
    }
    return best;
  }


  function applyWidth(doc, id, name) {
    var shape = find(doc, id);
    if (!shape || (shape.type !== "path" && shape.type !== "line")) return null;
    var units = (typeof VeloraVxl !== "undefined" && VeloraVxl.profileUnits) || {
      taper: [0.12, 0.55, 1, 0.4, 0.08],
      swell: [0.22, 0.85, 1, 0.45, 0.22],
      point: [0.06, 0.28, 1, 0.28, 0.06]
    };
    if (!units[name]) return shape;
    var base = shape.strokeWidth > 0 ? shape.strokeWidth : 14;
    shape.strokeWidth = base;
    shape.profile = name;
    shape.widthProfile = units[name].map(function (n) { return Math.round(n * base * 100) / 100; });
    if (!shape.stroke || shape.stroke === "none") shape.stroke = shape.role || "figure";
    if (shape.fill == null || shape.fill === shape.role) shape.fill = "none";
    shape.strokeLinecap = "round";
    return shape;
  }

  function setWidthSample(doc, id, index, width) {
    var shape = find(doc, id);
    if (!shape || !shape.widthProfile || index < 0 || index >= shape.widthProfile.length) return null;
    shape.widthProfile[index] = Math.max(0, Math.round(width * 100) / 100);
    shape.profile = "";
    return shape;
  }

  function widthHandles(shape) {
    if (!shape || !shape.widthProfile || shape.widthProfile.length < 2) return [];
    if (typeof VeloraVxl === "undefined" || !VeloraVxl.centerline) return [];
    var line = VeloraVxl.centerline(shape);
    if (!line.length) return [];
    return shape.widthProfile.map(function (w, i) {
      var t = i / (shape.widthProfile.length - 1);
      var best = line[0];
      var bestD = 2;
      line.forEach(function (p) {
        var d = Math.abs(p.t - t);
        if (d < bestD) { best = p; bestD = d; }
      });
      var half = w / 2;
      return { i: i, t: t, x: best.x, y: best.y, nx: best.nx, ny: best.ny, w: w, hx: best.x + best.nx * half, hy: best.y + best.ny * half };
    });
  }

  function hitWidth(shape, x, y, limit) {
    var handles = widthHandles(shape);
    var best = null;
    var bestD = limit;
    handles.forEach(function (h) {
      var dx = h.hx - x;
      var dy = h.hy - y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= bestD) { best = h; bestD = dist; }
    });
    return best;
  }


  var GLYPH = {
    A: "M1 14 L5 1 L9 14 M2.6 9 H7.4",
    B: "M1 1 V14 H6 Q9 14 9 11 Q9 8 6 8 H1 M6 8 Q9 8 9 4.5 Q9 1 6 1 H1",
    C: "M9 3 Q7 1 4 1 Q1 1 1 7.5 Q1 14 4 14 Q7 14 9 12",
    D: "M1 1 V14 H5 Q9 14 9 7.5 Q9 1 5 1 H1",
    E: "M9 1 H1 V14 H9 M1 7.5 H7",
    F: "M9 1 H1 V14 M1 7.5 H7",
    G: "M9 3 Q7 1 4 1 Q1 1 1 7.5 Q1 14 4 14 Q8 14 8 10 H5",
    H: "M1 1 V14 M9 1 V14 M1 7.5 H9",
    I: "M2 1 H8 M5 1 V14 M2 14 H8",
    J: "M3 1 H9 M6 1 V11 Q6 14 3 14 Q1 14 1 12",
    K: "M1 1 V14 M8 1 L1 8 L9 14",
    L: "M1 1 V14 H9",
    M: "M1 14 V1 L5 8 L9 1 V14",
    N: "M1 14 V1 L9 14 V1",
    O: "M5 1 Q1 1 1 7.5 Q1 14 5 14 Q9 14 9 7.5 Q9 1 5 1",
    P: "M1 14 V1 H6 Q9 1 9 4.5 Q9 8 6 8 H1",
    Q: "M5 1 Q1 1 1 7.5 Q1 14 5 14 Q9 14 9 7.5 Q9 1 5 1 M6 10 L9 14",
    R: "M1 14 V1 H6 Q9 1 9 4.5 Q9 8 6 8 H1 M5 8 L9 14",
    S: "M8 3 Q6 1 3.5 1 Q1 1 1 3.5 Q1 6 3.5 7 Q9 8 9 11 Q9 14 5 14 Q2 14 1 12",
    T: "M1 1 H9 M5 1 V14",
    U: "M1 1 V10 Q1 14 5 14 Q9 14 9 10 V1",
    V: "M1 1 L5 14 L9 1",
    W: "M1 1 L3 14 L5 7 L7 14 L9 1",
    X: "M1 1 L9 14 M9 1 L1 14",
    Y: "M1 1 L5 8 L9 1 M5 8 V14",
    Z: "M1 1 H9 L1 14 H9",
    "0": "M5 1 Q1 1 1 7.5 Q1 14 5 14 Q9 14 9 7.5 Q9 1 5 1 M3 12 L7 3",
    "1": "M3 3 L5 1 V14 M2 14 H8",
    "2": "M1 4 Q1 1 5 1 Q9 1 9 4 Q9 8 1 14 H9",
    "3": "M1 2 Q3 1 5 1 Q9 1 9 4 Q9 7 6 7 Q9 7 9 11 Q9 14 5 14 Q2 14 1 12",
    "4": "M7 1 V14 M7 1 L1 9 H9",
    "5": "M8 1 H1 V7 H6 Q9 7 9 10.5 Q9 14 5 14 Q1 14 1 12",
    "6": "M8 3 Q6 1 4 1 Q1 1 1 7.5 Q1 14 4.5 14 Q8 14 8 10.5 Q8 7 4.5 7 Q1 7 1 8",
    "7": "M1 1 H9 L4 14",
    "8": "M5 1 Q1 1 1 4 Q1 7 5 7 Q9 7 9 10.5 Q9 14 5 14 Q1 14 1 10.5 Q1 7 5 7 Q9 7 9 4 Q9 1 5 1",
    "9": "M2 11 Q4 14 6 14 Q9 14 9 7.5 Q9 1 5.5 1 Q2 1 2 4.5 Q2 8 5.5 8 Q9 8 9 7",
    "-": "M1 7.5 H8",
    ".": "M4 12 V14",
    " ": ""
  };

  function freshId(prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8);
  }

  function eachShape(doc, visit) {
    function walk(list, parent, key) {
      (list || []).forEach(function (shape, index) {
        visit(shape, parent, key, index);
        if (shape.type === "group") walk(shape.children, shape, "children");
      });
    }
    (doc.layers || []).forEach(function (layer) { walk(layer.shapes, layer, "shapes"); });
  }


  function writableLayer(doc, layerId) {
    var layers = (doc && doc.layers) || [];
    var layer = null;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id === layerId && layers[i].visible !== false && !layers[i].locked) layer = layers[i];
    }
    if (!layer) {
      for (var j = layers.length - 1; j >= 0; j--) {
        if (layers[j].visible !== false && !layers[j].locked) { layer = layers[j]; break; }
      }
    }
    if (!layer) layer = layers[0];
    if (!layer) return null;
    if (!Array.isArray(layer.shapes)) layer.shapes = [];
    return layer;
  }

  function placePencil(doc, d, layerId, strokeWidth) {
    if (!d) return null;
    var layer = writableLayer(doc, layerId);
    if (!layer) return null;
    var closed = String(d).indexOf("Z") >= 0;
    var shape = {
      id: freshId("pencil"),
      type: "path",
      role: "figure",
      fill: closed ? "figure" : "none",
      stroke: "figure",
      strokeWidth: Math.max(1, round(strokeWidth || 8)),
      strokeLinecap: "round",
      strokeLinejoin: "round",
      d: d
    };
    layer.shapes.push(shape);
    return shape;
  }

  function smoothShape(doc, id, strength) {
    var shape = penReady(find(doc, id));
    if (!shape || !shape.d || !root.VeloraPencil) return null;
    var next = root.VeloraPencil.smooth(shape.d, strength);
    if (!next) return null;
    shape.d = next;
    return shape;
  }

  function placeText(doc, x, y, content, size, layerId) {
    var layers = (doc && doc.layers) || [];
    var layer = null;
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id === layerId && layers[i].visible !== false && !layers[i].locked) layer = layers[i];
    }
    if (!layer) {
      for (var j = layers.length - 1; j >= 0; j--) {
        if (layers[j].visible !== false && !layers[j].locked) { layer = layers[j]; break; }
      }
    }
    if (!layer) layer = layers[0];
    if (!layer) return null;
    if (!Array.isArray(layer.shapes)) layer.shapes = [];
    var shape = {
      id: freshId("type"),
      type: "text",
      role: "figure",
      fill: "figure",
      x: round(x),
      y: round(y),
      size: Math.max(8, round(size || 64)),
      text: String(content || "Type").slice(0, 80),
      anchor: "middle"
    };
    layer.shapes.push(shape);
    return shape;
  }

  function setText(doc, id, patch) {
    var shape = find(doc, id);
    if (!shape || shape.type !== "text" || !patch) return null;
    if (patch.text != null) shape.text = String(patch.text).slice(0, 80);
    if (patch.size != null) shape.size = Math.max(8, round(patch.size));
    if (patch.anchor === "start" || patch.anchor === "middle" || patch.anchor === "end") shape.anchor = patch.anchor;
    if (patch.w != null) {
      var area = Number(patch.w);
      if (area > 0) shape.w = round(area);
      else delete shape.w;
    }
    if (patch.onPath != null) {
      var spine = String(patch.onPath || "");
      if (spine) shape.onPath = spine.slice(0, 4000);
      else delete shape.onPath;
    }
    if (patch.side != null) shape.side = Number(patch.side) < 0 ? -1 : 1;
    return shape;
  }

  function scaleGlyph(spec, ox, oy, scale) {
    if (!spec) return "";
    var tokens = spec.match(/[MLQHV]|-?\d*\.?\d+/g);
    if (!tokens) return "";
    var out = "";
    var cmd = "";
    var pair = [];
    function emitPair() {
      if (pair.length < 2) return;
      out += round(ox + pair[0] * scale) + " " + round(oy + pair[1] * scale) + " ";
      pair = [];
    }
    tokens.forEach(function (tok) {
      if (/[MLQHV]/.test(tok)) {
        emitPair();
        cmd = tok;
        out += tok;
        return;
      }
      var n = parseFloat(tok);
      if (cmd === "H") out += round(ox + n * scale) + " ";
      else if (cmd === "V") out += round(oy + n * scale) + " ";
      else {
        pair.push(n);
        if (pair.length === 2) emitPair();
      }
    });
    emitPair();
    return out.trim();
  }

  function glyphAt(spec, x, y, scale, angle) {
    var local = scaleGlyph(spec, 0, -(scale * 14), scale);
    if (typeof VeloraTypePath === "undefined") return local;
    return VeloraTypePath.placeGlyph(local, x, y, angle);
  }

  function outlineText(doc, id) {
    var shape = find(doc, id);
    if (!shape || shape.type !== "text") return null;
    var size = shape.size || 32;
    var scale = size / 14;
    var advance = size * 0.72;
    var chars = String(shape.text || "").toUpperCase().slice(0, 80).split("");
    var width = Math.max(advance, chars.length * advance);
    var origin = shape.x;
    if (shape.anchor === "middle") origin -= width / 2;
    if (shape.anchor === "end") origin -= width;
    var children = [];
    if (shape.onPath && typeof VeloraTypePath !== "undefined") {
      var len = VeloraTypePath.lengthOf(shape.onPath) || width;
      var start = 0;
      if (shape.anchor === "middle") start = 0.5 - width / (2 * len);
      if (shape.anchor === "end") start = 1 - width / len;
      var side = shape.side === -1 ? -1 : 1;
      chars.forEach(function (ch, index) {
        var spec = GLYPH[ch];
        if (!spec) return;
        var t = start + ((index + 0.5) * advance) / len;
        var p = VeloraTypePath.pointAt(shape.onPath, t);
        if (!p) return;
        var rad = p.angle * Math.PI / 180;
        var ox = p.x + (-Math.sin(rad)) * side * size * 0.15;
        var oy = p.y + Math.cos(rad) * side * size * 0.15;
        var d = glyphAt(spec, ox, oy, scale, p.angle);
        if (!d) return;
        children.push({
          id: freshId("glyph"),
          type: "path",
          role: shape.role || "figure",
          fill: "none",
          stroke: shape.fill && shape.fill !== "none" ? shape.fill : (shape.role || "figure"),
          strokeWidth: Math.max(1, round(size * 0.08)),
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: d
        });
      });
      if (!children.length) return null;
      var along = {
        id: shape.id,
        type: "group",
        role: shape.role || "figure",
        opacity: shape.opacity == null ? 1 : shape.opacity,
        children: children
      };
      eachShape(doc, function (current, parent, key, index) {
        if (current.id !== id) return;
        parent[key][index] = along;
      });
      return along;
    }
    chars.forEach(function (ch, index) {
      var spec = GLYPH[ch];
      if (!spec) return;
      var d = scaleGlyph(spec, origin + index * advance, shape.y - size, scale);
      if (!d) return;
      children.push({
        id: freshId("glyph"),
        type: "path",
        role: shape.role || "figure",
        fill: "none",
        stroke: shape.fill && shape.fill !== "none" ? shape.fill : (shape.role || "figure"),
        strokeWidth: Math.max(1, round(size * 0.08)),
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: d
      });
    });
    if (!children.length) return null;
    var group = {
      id: shape.id,
      type: "group",
      role: shape.role || "figure",
      opacity: shape.opacity == null ? 1 : shape.opacity,
      children: children
    };
    eachShape(doc, function (current, parent, key, index) {
      if (current.id !== id) return;
      parent[key][index] = group;
    });
    return group;
  }

  function layerById(doc, id) {
    var layers = (doc && doc.layers) || [];
    for (var i = 0; i < layers.length; i++) if (layers[i].id === id) return layers[i];
    return null;
  }

  function addLayer(doc, name) {
    if (!doc || !doc.layers) return null;
    if (doc.layers.length >= 16) return null;
    var layer = {
      id: freshId("layer"),
      name: String(name || ("Layer " + (doc.layers.length + 1))).slice(0, 40),
      visible: true,
      locked: false,
      opacity: 1,
      shapes: []
    };
    doc.layers.push(layer);
    return layer;
  }

  function renameLayer(doc, id, name) {
    var layer = layerById(doc, id);
    if (!layer) return null;
    layer.name = String(name || layer.name).slice(0, 40) || layer.name;
    return layer;
  }

  function setLayer(doc, id, patch) {
    var layer = layerById(doc, id);
    if (!layer || !patch) return null;
    if (patch.visible != null) layer.visible = patch.visible !== false;
    if (patch.locked != null) layer.locked = patch.locked === true;
    if (patch.opacity != null) layer.opacity = Math.max(0, Math.min(1, Number(patch.opacity) || 0));
    return layer;
  }

  function orderLayer(doc, id, dir) {
    var layers = (doc && doc.layers) || [];
    var index = -1;
    for (var i = 0; i < layers.length; i++) if (layers[i].id === id) index = i;
    if (index < 0) return null;
    var next = index + dir;
    if (next < 0 || next >= layers.length) return layers[index];
    var swap = layers[index];
    layers[index] = layers[next];
    layers[next] = swap;
    return swap;
  }

  function removeLayer(doc, id) {
    var layers = (doc && doc.layers) || [];
    if (layers.length < 2) return null;
    var index = -1;
    for (var i = 0; i < layers.length; i++) if (layers[i].id === id) index = i;
    if (index < 0) return null;
    var gone = layers.splice(index, 1)[0];
    var sink = layers[Math.max(0, index - 1)];
    sink.shapes = (sink.shapes || []).concat(gone.shapes || []);
    return sink;
  }

  function moveShape(doc, shapeId, layerId) {
    var target = layerById(doc, layerId);
    if (!target || target.locked) return null;
    var pulled = null;
    (doc.layers || []).forEach(function (layer) {
      if (!layer.shapes) return;
      for (var i = 0; i < layer.shapes.length; i++) {
        if (layer.shapes[i].id === shapeId) {
          pulled = layer.shapes.splice(i, 1)[0];
          break;
        }
      }
    });
    if (!pulled) return null;
    if (!target.shapes) target.shapes = [];
    target.shapes.push(pulled);
    return pulled;
  }

  root.VeloraEdit = {
    bounds: boundsOf,
    find: find,
    hitTest: hitTest,
    apply: apply,
    moveMatrix: moveMatrix,
    scaleMatrix: scaleMatrix,
    rotateMatrix: rotateMatrix,
    identity: identity,
    jobs: JOBS.slice(),
    recolor: recolor,
    handles: handlesOf,
    hitHandle: hitHandle,
    moveHandle: moveHandle,
    penReady: penReady,
    applyWidth: applyWidth,
    setWidthSample: setWidthSample,
    widthHandles: widthHandles,
    hitWidth: hitWidth,
    placeText: placeText,
    placePencil: placePencil,
    smoothShape: smoothShape,
    setText: setText,
    outlineText: outlineText,
    addLayer: addLayer,
    renameLayer: renameLayer,
    setLayer: setLayer,
    orderLayer: orderLayer,
    removeLayer: removeLayer,
    moveShape: moveShape,
    hostLayer: hostLayer
  };
})(typeof window !== "undefined" ? window : globalThis);
