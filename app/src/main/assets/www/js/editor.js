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
      if (layers[i].visible === false) continue;
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

  function apply(doc, id, m, mode) {
    var shape = find(doc, id);
    if (!shape) return null;
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
    recolor: recolor
  };
})(typeof window !== "undefined" ? window : globalThis);
