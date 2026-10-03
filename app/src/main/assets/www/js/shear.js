(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function point(x, y, axis, ox, oy, shear) {
    var dx = x - ox;
    var dy = y - oy;
    if (axis === "v") return [round(x), round(oy + dy + dx * shear)];
    return [round(ox + dx + dy * shear), round(y)];
  }

  function tokens(d) {
    return String(d || "").match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  }

  function arcPoints(x0, y0, rx, ry, ang, large, sweep, x1, y1) {
    var pts = [[x1, y1]];
    if (!(rx > 0) || !(ry > 0)) return pts;
    var rad = ang * Math.PI / 180;
    var cos = Math.cos(rad);
    var sin = Math.sin(rad);
    var dx = (x0 - x1) / 2;
    var dy = (y0 - y1) / 2;
    var x1p = cos * dx + sin * dy;
    var y1p = -sin * dx + cos * dy;
    var rx2 = rx * rx;
    var ry2 = ry * ry;
    var lam = x1p * x1p / rx2 + y1p * y1p / ry2;
    if (lam > 1) {
      var scale = Math.sqrt(lam);
      rx *= scale;
      ry *= scale;
      rx2 = rx * rx;
      ry2 = ry * ry;
    }
    var sign = (large === sweep) ? -1 : 1;
    var coef = sign * Math.sqrt(Math.max(0, (rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p) / (rx2 * y1p * y1p + ry2 * x1p * x1p)));
    var cxp = coef * rx * y1p / ry;
    var cyp = coef * -ry * x1p / rx;
    var cx = cos * cxp - sin * cyp + (x0 + x1) / 2;
    var cy = sin * cxp + cos * cyp + (y0 + y1) / 2;
    function angOf(ux, uy, vx, vy) {
      var dot = ux * vx + uy * vy;
      var len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
      var a = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))));
      if (ux * vy - uy * vx < 0) a = -a;
      return a;
    }
    var t1 = angOf(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    var dt = angOf((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dt > 0) dt -= Math.PI * 2;
    if (sweep && dt < 0) dt += Math.PI * 2;
    var steps = 8;
    var out = [];
    for (var s = 1; s <= steps; s++) {
      var t = t1 + dt * (s / steps);
      var px = rx * Math.cos(t);
      var py = ry * Math.sin(t);
      out.push([cos * px - sin * py + cx, sin * px + cos * py + cy]);
    }
    return out;
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
      if (op === "Q") {
        var qx = take();
        var qy = take();
        var ex = take();
        var ey = take();
        if (rel) { qx += x; qy += y; ex += x; ey += y; }
        out.push({
          op: "C",
          x1: x + (qx - x) * 2 / 3,
          y1: y + (qy - y) * 2 / 3,
          x2: ex + (qx - ex) * 2 / 3,
          y2: ey + (qy - ey) * 2 / 3,
          x: ex,
          y: ey
        });
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
        var samples = arcPoints(x, y, rx, ry, ang, large ? 1 : 0, sweep ? 1 : 0, ax, ay);
        samples.forEach(function (pt) {
          out.push({ op: "L", x: pt[0], y: pt[1] });
        });
        x = ax;
        y = ay;
        continue;
      }
      break;
    }
    return out;
  }

  function fmt(n) {
    return String(round(n));
  }

  function writePath(cmds, axis, ox, oy, shear) {
    var d = "";
    cmds.forEach(function (c) {
      if (c.op === "Z") {
        d += "Z";
        return;
      }
      if (c.op === "M" || c.op === "L") {
        var p = point(c.x, c.y, axis, ox, oy, shear);
        d += c.op + fmt(p[0]) + " " + fmt(p[1]);
        return;
      }
      if (c.op === "C") {
        var a = point(c.x1, c.y1, axis, ox, oy, shear);
        var b = point(c.x2, c.y2, axis, ox, oy, shear);
        var e = point(c.x, c.y, axis, ox, oy, shear);
        d += "C" + fmt(a[0]) + " " + fmt(a[1]) + " " + fmt(b[0]) + " " + fmt(b[1]) + " " + fmt(e[0]) + " " + fmt(e[1]);
      }
    });
    return d;
  }

  function shearPath(d, axis, ox, oy, shear) {
    if (!d) return d;
    return writePath(toAbsolute(d), axis, ox, oy, shear);
  }

  function ellipsePath(cx, cy, rx, ry) {
    var k = 0.5522847498;
    var kx = rx * k;
    var ky = ry * k;
    return "M" + fmt(cx - rx) + " " + fmt(cy) +
      "C" + fmt(cx - rx) + " " + fmt(cy - ky) + " " + fmt(cx - kx) + " " + fmt(cy - ry) + " " + fmt(cx) + " " + fmt(cy - ry) +
      "C" + fmt(cx + kx) + " " + fmt(cy - ry) + " " + fmt(cx + rx) + " " + fmt(cy - ky) + " " + fmt(cx + rx) + " " + fmt(cy) +
      "C" + fmt(cx + rx) + " " + fmt(cy + ky) + " " + fmt(cx + kx) + " " + fmt(cy + ry) + " " + fmt(cx) + " " + fmt(cy + ry) +
      "C" + fmt(cx - kx) + " " + fmt(cy + ry) + " " + fmt(cx - rx) + " " + fmt(cy + ky) + " " + fmt(cx - rx) + " " + fmt(cy) +
      "Z";
  }

  function primitivePath(shape) {
    if (shape.type === "rect") {
      var x = shape.x || 0;
      var y = shape.y || 0;
      var w = shape.w || 0;
      var h = shape.h || 0;
      return "M" + fmt(x) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y + h) + "L" + fmt(x) + " " + fmt(y + h) + "Z";
    }
    if (shape.type === "circle") return ellipsePath(shape.cx || 0, shape.cy || 0, shape.r || 0, shape.r || 0);
    if (shape.type === "ellipse") return ellipsePath(shape.cx || 0, shape.cy || 0, shape.rx || 0, shape.ry || 0);
    if (shape.type === "line") {
      return "M" + fmt(shape.x1 || 0) + " " + fmt(shape.y1 || 0) + "L" + fmt(shape.x2 || 0) + " " + fmt(shape.y2 || 0);
    }
    if (shape.type === "polygon" && shape.points && shape.points.length) {
      var d = "";
      shape.points.forEach(function (pt, i) {
        d += (i ? "L" : "M") + fmt(pt[0]) + " " + fmt(pt[1]);
      });
      return d + "Z";
    }
    return shape.d || "";
  }

  function asPath(shape) {
    if (shape.type === "path" || (shape.d && shape.type !== "text")) return;
    if (shape.type === "text" || shape.type === "group" || shape.type === "blend") return;
    var d = primitivePath(shape);
    if (!d) return;
    shape.type = "path";
    shape.d = d;
    delete shape.x;
    delete shape.y;
    delete shape.w;
    delete shape.h;
    delete shape.cx;
    delete shape.cy;
    delete shape.r;
    delete shape.rx;
    delete shape.ry;
    delete shape.x1;
    delete shape.y1;
    delete shape.x2;
    delete shape.y2;
    delete shape.points;
  }

  function shearShape(shape, axis, ox, oy, shear) {
    if (!shape) return;
    asPath(shape);
    if (shape.d && shape.type !== "text") shape.d = shearPath(shape.d, axis, ox, oy, shear);
    if (shape.type === "text") {
      var t = point(shape.x || 0, shape.y || 0, axis, ox, oy, shear);
      shape.x = t[0];
      shape.y = t[1];
      if (shape.onPath) shape.onPath = shearPath(shape.onPath, axis, ox, oy, shear);
    }
    if (shape.clip) shape.clip = shearPath(shape.clip, axis, ox, oy, shear);
    if (shape.gradient) {
      var g1 = point(shape.gradient.x1, shape.gradient.y1, axis, ox, oy, shear);
      var g2 = point(shape.gradient.x2, shape.gradient.y2, axis, ox, oy, shear);
      shape.gradient.x1 = g1[0];
      shape.gradient.y1 = g1[1];
      shape.gradient.x2 = g2[0];
      shape.gradient.y2 = g2[1];
    }
    if (shape.type === "group" && shape.children) {
      shape.children.forEach(function (child) { shearShape(child, axis, ox, oy, shear); });
    }
    if (shape.type === "blend") {
      if (shape.from) shearShape(shape.from, axis, ox, oy, shear);
      if (shape.to) shearShape(shape.to, axis, ox, oy, shear);
      if (shape.spine) shape.spine = shearPath(shape.spine, axis, ox, oy, shear);
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
    return "shear-" + Math.random().toString(36).slice(2, 8);
  }

  function retag(shape) {
    shape.id = freshId();
    if (shape.children) shape.children.forEach(retag);
    return shape;
  }

  function apply(doc, ids, axis, degrees, mode) {
    if (!doc || !ids || !ids.length) return [];
    var angle = Number(degrees);
    if (!isFinite(angle) || angle === 0) angle = 15;
    angle = Math.max(-75, Math.min(75, angle));
    var shear = Math.tan(angle * Math.PI / 180);
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
        if (mode === "copy") {
          var copy = retag(JSON.parse(JSON.stringify(shape)));
          shearShape(copy, axis, origin.ox, origin.oy, shear);
          list.splice(i + 1, 0, copy);
          i += 1;
          made.push(copy.id);
          continue;
        }
        shearShape(shape, axis, origin.ox, origin.oy, shear);
        made.push(shape.id);
      }
    }
    (doc.layers || []).forEach(function (layer) {
      if (layer && !layer.locked) walk(layer.shapes, layer);
    });
    return made;
  }

  root.VeloraShear = {
    point: point,
    path: shearPath,
    shape: shearShape,
    apply: apply
  };
})(typeof window !== "undefined" ? window : globalThis);
