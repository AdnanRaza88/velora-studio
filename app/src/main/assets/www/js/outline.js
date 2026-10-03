(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function freshId() {
    return "stroke-" + Math.random().toString(36).slice(2, 8);
  }

  function widthOf(shape) {
    var w = num(shape.strokeWidth, 0);
    if (shape.brush && num(shape.brush.size, 0) > w) w = num(shape.brush.size, 0);
    var samples = shape.widthProfile;
    if (samples && samples.length) {
      for (var i = 0; i < samples.length; i++) {
        if (num(samples[i], 0) > w) w = num(samples[i], 0);
      }
    }
    return w;
  }

  function stroked(shape) {
    if (!shape) return false;
    if (shape.type === "text" || shape.type === "blend" || shape.type === "group") return false;
    if (shape.stroke === "none") return false;
    return widthOf(shape) > 0;
  }

  function ellipsePath(cx, cy, rx, ry) {
    var k = 0.5522847498;
    var ox = rx * k;
    var oy = ry * k;
    return "M" + round(cx + rx) + " " + round(cy) +
      " C" + round(cx + rx) + " " + round(cy + oy) + " " + round(cx + ox) + " " + round(cy + ry) + " " + round(cx) + " " + round(cy + ry) +
      " C" + round(cx - ox) + " " + round(cy + ry) + " " + round(cx - rx) + " " + round(cy + oy) + " " + round(cx - rx) + " " + round(cy) +
      " C" + round(cx - rx) + " " + round(cy - oy) + " " + round(cx - ox) + " " + round(cy - ry) + " " + round(cx) + " " + round(cy - ry) +
      " C" + round(cx + ox) + " " + round(cy - ry) + " " + round(cx + rx) + " " + round(cy - oy) + " " + round(cx + rx) + " " + round(cy) + " Z";
  }

  function spin(x, y, cx, cy, deg) {
    var a = num(deg, 0) * Math.PI / 180;
    if (!a) return [x, y];
    var dx = x - cx;
    var dy = y - cy;
    var c = Math.cos(a);
    var s = Math.sin(a);
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }

  function centerlineOf(shape) {
    var d = "";
    if (shape.type === "path") d = shape.d || "";
    else if (shape.type === "line") d = "M" + num(shape.x1, 0) + " " + num(shape.y1, 0) + " L" + num(shape.x2, 0) + " " + num(shape.y2, 0);
    else if (shape.type === "rect") {
      var x = num(shape.x, 0);
      var y = num(shape.y, 0);
      var w = num(shape.w, 0);
      var h = num(shape.h, 0);
      var cx = x + w / 2;
      var cy = y + h / 2;
      var pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(function (p) {
        return spin(p[0], p[1], cx, cy, shape.rot);
      });
      d = "M" + pts.map(function (p) { return round(p[0]) + " " + round(p[1]); }).join(" L") + " Z";
    } else if (shape.type === "circle") {
      d = ellipsePath(num(shape.cx, 0), num(shape.cy, 0), num(shape.r, 0), num(shape.r, 0));
    } else if (shape.type === "ellipse") {
      d = ellipsePath(num(shape.cx, 0), num(shape.cy, 0), num(shape.rx, 0), num(shape.ry, 0));
    } else if (shape.type === "polygon" && shape.points && shape.points.length >= 3) {
      d = "M" + shape.points.map(function (p) { return round(p[0]) + " " + round(p[1]); }).join(" L") + " Z";
    }
    if (!d || !root.VeloraVxl || !root.VeloraVxl.centerline) return [];
    return root.VeloraVxl.centerline({ type: "path", d: d, widthProfile: shape.widthProfile, strokeWidth: widthOf(shape) });
  }

  function half(shape, p) {
    if (shape.widthProfile && shape.widthProfile.length >= 2 && root.VeloraVxl && root.VeloraVxl.profileWidth) {
      return Math.max(0.5, root.VeloraVxl.profileWidth(shape, p.t) / 2);
    }
    return Math.max(0.5, widthOf(shape) / 2);
  }

  function ribbon(shape) {
    var line = centerlineOf(shape);
    if (!line || line.length < 2) return "";
    var closed = shape.type === "rect" || shape.type === "circle" || shape.type === "ellipse" || shape.type === "polygon" || /[Zz]/.test(shape.d || "");
    var left = [];
    var right = [];
    line.forEach(function (p) {
      var r = half(shape, p);
      left.push([p.x + p.nx * r, p.y + p.ny * r]);
      right.push([p.x - p.nx * r, p.y - p.ny * r]);
    });
    function fmt(pair) { return round(pair[0]) + " " + round(pair[1]); }
    var d = "M" + fmt(left[0]);
    for (var i = 1; i < left.length; i++) d += " L" + fmt(left[i]);
    if (!closed) {
      var end = line[line.length - 1];
      var er = half(shape, end);
      for (var a = 1; a <= 4; a++) {
        var ang = Math.PI * a / 4;
        d += " L" + round(end.x + (end.nx * Math.cos(ang) - end.ny * Math.sin(ang)) * er) + " " + round(end.y + (end.ny * Math.cos(ang) + end.nx * Math.sin(ang)) * er);
      }
    }
    for (var r = right.length - 1; r >= 0; r--) d += " L" + fmt(right[r]);
    if (!closed) {
      var st = line[0];
      var rad = half(shape, st);
      for (var b = 1; b <= 4; b++) {
        var ang2 = Math.PI * b / 4;
        d += " L" + round(st.x + (-st.nx * Math.cos(ang2) - st.ny * Math.sin(ang2)) * rad) + " " + round(st.y + (-st.ny * Math.cos(ang2) + st.nx * Math.sin(ang2)) * rad);
      }
    }
    return d + " Z";
  }

  function inkOf(shape) {
    if (shape.stroke && shape.stroke !== "none") return shape.stroke;
    if (shape.role) return shape.role;
    return "figure";
  }

  function filled(shape) {
    return shape.fill && shape.fill !== "none";
  }

  function clearStroke(shape) {
    delete shape.stroke;
    delete shape.strokeWidth;
    delete shape.strokeLinecap;
    delete shape.strokeLinejoin;
    delete shape.widthProfile;
    delete shape.brush;
    if (!filled(shape)) shape.fill = "none";
  }

  function outlineShape(shape) {
    var d = ribbon(shape);
    if (!d) return null;
    var ink = inkOf(shape);
    if (!filled(shape)) {
      shape.type = "path";
      shape.d = d;
      shape.fill = ink;
      shape.fillRule = "evenodd";
      delete shape.x;
      delete shape.y;
      delete shape.w;
      delete shape.h;
      delete shape.cx;
      delete shape.cy;
      delete shape.r;
      delete shape.rx;
      delete shape.ry;
      delete shape.rot;
      delete shape.x1;
      delete shape.y1;
      delete shape.x2;
      delete shape.y2;
      delete shape.points;
      clearStroke(shape);
      shape.fill = ink;
      return shape;
    }
    return {
      id: freshId(),
      type: "path",
      role: shape.role || ink,
      fill: ink,
      fillRule: "evenodd",
      d: d
    };
  }

  function apply(doc, ids) {
    if (!doc || !ids || !ids.length) return [];
    var want = {};
    ids.forEach(function (id) { if (id) want[id] = 1; });
    var made = [];
    function walk(list, parent) {
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        var shape = list[i];
        if (shape.type === "group") walk(shape.children, shape);
        if (!want[shape.id] || !stroked(shape)) continue;
        if (parent && parent.locked) continue;
        var keepFill = filled(shape);
        var outlined = outlineShape(shape);
        if (!outlined) continue;
        if (keepFill) {
          clearStroke(shape);
          list.splice(i + 1, 0, outlined);
          i += 1;
          made.push(outlined.id);
        } else {
          made.push(shape.id);
        }
      }
    }
    (doc.layers || []).forEach(function (layer) {
      if (layer && !layer.locked) walk(layer.shapes, layer);
    });
    return made;
  }

  root.VeloraOutline = {
    ribbon: ribbon,
    apply: apply
  };
})(typeof window !== "undefined" ? window : globalThis);
