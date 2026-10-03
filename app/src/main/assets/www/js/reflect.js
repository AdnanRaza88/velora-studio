(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function point(x, y, axis, ox, oy) {
    if (axis === "h") return [round(x), round(2 * oy - y)];
    return [round(2 * ox - x), round(y)];
  }

  function tokens(d) {
    return String(d || "").match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  }

  function toAbsolute(d) {
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
        out.push({ op: "Q", x1: qx, y1: qy, x: qex, y: qey });
        x = qex;
        y = qey;
        continue;
      }
      if (op === "A") {
        var arx = take();
        var ary = take();
        var ang = take();
        var large = take();
        var sweep = take();
        var ax = take();
        var ay = take();
        if (rel) { ax += x; ay += y; }
        out.push({ op: "A", rx: arx, ry: ary, ang: ang, large: large, sweep: sweep, x: ax, y: ay });
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

  function writePath(cmds, axis, ox, oy) {
    var d = "";
    cmds.forEach(function (c) {
      if (c.op === "Z") {
        d += "Z";
        return;
      }
      if (c.op === "M" || c.op === "L") {
        var p = point(c.x, c.y, axis, ox, oy);
        d += c.op + fmt(p[0]) + " " + fmt(p[1]);
        return;
      }
      if (c.op === "C") {
        var p1 = point(c.x1, c.y1, axis, ox, oy);
        var p2 = point(c.x2, c.y2, axis, ox, oy);
        var p3 = point(c.x, c.y, axis, ox, oy);
        d += "C" + fmt(p1[0]) + " " + fmt(p1[1]) + " " + fmt(p2[0]) + " " + fmt(p2[1]) + " " + fmt(p3[0]) + " " + fmt(p3[1]);
        return;
      }
      if (c.op === "Q") {
        var q1 = point(c.x1, c.y1, axis, ox, oy);
        var q2 = point(c.x, c.y, axis, ox, oy);
        d += "Q" + fmt(q1[0]) + " " + fmt(q1[1]) + " " + fmt(q2[0]) + " " + fmt(q2[1]);
        return;
      }
      if (c.op === "A") {
        var end = point(c.x, c.y, axis, ox, oy);
        var sweep = c.sweep ? 0 : 1;
        d += "A" + fmt(c.rx) + " " + fmt(c.ry) + " " + fmt(axis === "h" ? -c.ang : -c.ang) + " " + c.large + " " + sweep + " " + fmt(end[0]) + " " + fmt(end[1]);
      }
    });
    return d;
  }

  function reflectPath(d, axis, ox, oy) {
    if (!d) return d;
    return writePath(toAbsolute(d), axis, ox, oy);
  }

  function reflectShape(shape, axis, ox, oy) {
    if (!shape) return;
    if (shape.type === "circle" || shape.type === "ellipse") {
      var c = point(shape.cx, shape.cy, axis, ox, oy);
      shape.cx = c[0];
      shape.cy = c[1];
    } else if (shape.type === "rect") {
      var p = point(shape.x, shape.y, axis, ox, oy);
      if (axis === "h") shape.y = round(p[1] - shape.h);
      else shape.x = round(p[0] - shape.w);
    } else if (shape.type === "line") {
      var a = point(shape.x1, shape.y1, axis, ox, oy);
      var b = point(shape.x2, shape.y2, axis, ox, oy);
      shape.x1 = a[0];
      shape.y1 = a[1];
      shape.x2 = b[0];
      shape.y2 = b[1];
    } else if (shape.type === "polygon" && shape.points) {
      shape.points = shape.points.map(function (pt) {
        return point(pt[0], pt[1], axis, ox, oy);
      });
    } else if (shape.type === "path" || shape.d) {
      if (shape.d) shape.d = reflectPath(shape.d, axis, ox, oy);
    }
    if (shape.type === "text") {
      var t = point(shape.x || 0, shape.y || 0, axis, ox, oy);
      shape.x = t[0];
      shape.y = t[1];
      if (shape.onPath) shape.onPath = reflectPath(shape.onPath, axis, ox, oy);
    }
    if (shape.clip) shape.clip = reflectPath(shape.clip, axis, ox, oy);
    if (shape.gradient) {
      var g1 = point(shape.gradient.x1, shape.gradient.y1, axis, ox, oy);
      var g2 = point(shape.gradient.x2, shape.gradient.y2, axis, ox, oy);
      shape.gradient.x1 = g1[0];
      shape.gradient.y1 = g1[1];
      shape.gradient.x2 = g2[0];
      shape.gradient.y2 = g2[1];
    }
    if (shape.type === "group" && shape.children) {
      shape.children.forEach(function (child) { reflectShape(child, axis, ox, oy); });
    }
    if (shape.type === "blend") {
      if (shape.from) reflectShape(shape.from, axis, ox, oy);
      if (shape.to) reflectShape(shape.to, axis, ox, oy);
      if (shape.spine) shape.spine = reflectPath(shape.spine, axis, ox, oy);
    }
  }

  function bounds(shape) {
    if (root.VeloraEdit && root.VeloraEdit.bounds) return root.VeloraEdit.bounds(shape);
    return null;
  }

  function union(ids, find) {
    var box = null;
    ids.forEach(function (id) {
      var shape = find(id);
      var b = bounds(shape);
      if (!b) return;
      if (!box) box = { x: b.x, y: b.y, w: b.w, h: b.h };
      else {
        var x2 = Math.max(box.x + box.w, b.x + b.w);
        var y2 = Math.max(box.y + box.h, b.y + b.h);
        box.x = Math.min(box.x, b.x);
        box.y = Math.min(box.y, b.y);
        box.w = x2 - box.x;
        box.h = y2 - box.y;
      }
    });
    if (!box) return null;
    return { ox: box.x + box.w / 2, oy: box.y + box.h / 2 };
  }

  function freshId() {
    return "reflect-" + Math.random().toString(36).slice(2, 8);
  }

  function retag(shape) {
    shape.id = freshId();
    if (shape.children) shape.children.forEach(retag);
    return shape;
  }

  function apply(doc, ids, axis, mode) {
    if (!doc || !ids || !ids.length) return [];
    var want = {};
    ids.forEach(function (id) { if (id) want[id] = 1; });
    var find = root.VeloraEdit && root.VeloraEdit.find
      ? function (id) { return root.VeloraEdit.find(doc, id); }
      : function () { return null; };
    var origin = union(ids, find);
    if (!origin) return [];
    var made = [];
    function walk(list, parent) {
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        var shape = list[i];
        if (shape.type === "group") walk(shape.children, shape);
        if (!want[shape.id]) continue;
        if (parent && parent.locked) continue;
        if (mode === "flip") {
          reflectShape(shape, axis, origin.ox, origin.oy);
          made.push(shape.id);
          continue;
        }
        var copy = retag(JSON.parse(JSON.stringify(shape)));
        reflectShape(copy, axis, origin.ox, origin.oy);
        list.splice(i + 1, 0, copy);
        i += 1;
        made.push(copy.id);
      }
    }
    (doc.layers || []).forEach(function (layer) {
      if (layer && !layer.locked) walk(layer.shapes, layer);
    });
    return made;
  }

  root.VeloraReflect = {
    point: point,
    path: reflectPath,
    shape: reflectShape,
    apply: apply
  };
})(typeof window !== "undefined" ? window : globalThis);
