(function (root) {
  function fmt(n) {
    return Math.round(n * 100) / 100;
  }

  function ellipse(cx, cy, rx, ry) {
    var k = 0.551915;
    var ox = rx * k;
    var oy = ry * k;
    return "M" + fmt(cx + rx) + " " + fmt(cy) +
      "C" + fmt(cx + rx) + " " + fmt(cy + oy) + " " + fmt(cx + ox) + " " + fmt(cy + ry) + " " + fmt(cx) + " " + fmt(cy + ry) +
      "C" + fmt(cx - ox) + " " + fmt(cy + ry) + " " + fmt(cx - rx) + " " + fmt(cy + oy) + " " + fmt(cx - rx) + " " + fmt(cy) +
      "C" + fmt(cx - rx) + " " + fmt(cy - oy) + " " + fmt(cx - ox) + " " + fmt(cy - ry) + " " + fmt(cx) + " " + fmt(cy - ry) +
      "C" + fmt(cx + ox) + " " + fmt(cy - ry) + " " + fmt(cx + rx) + " " + fmt(cy - oy) + " " + fmt(cx + rx) + " " + fmt(cy) + "Z";
  }

  function rect(shape) {
    var x = Number(shape.x) || 0;
    var y = Number(shape.y) || 0;
    var w = Number(shape.w) || 0;
    var h = Number(shape.h) || 0;
    var rot = Number(shape.rot) || 0;
    if (!rot) {
      return "M" + fmt(x) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y) + "L" + fmt(x + w) + " " + fmt(y + h) + "L" + fmt(x) + " " + fmt(y + h) + "Z";
    }
    var cx = x + w / 2;
    var cy = y + h / 2;
    var rad = rot * Math.PI / 180;
    var cs = Math.cos(rad);
    var sn = Math.sin(rad);
    var corners = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    return corners.map(function (p, i) {
      var px = cx + p[0] * cs - p[1] * sn;
      var py = cy + p[0] * sn + p[1] * cs;
      return (i ? "L" : "M") + fmt(px) + " " + fmt(py);
    }).join("") + "Z";
  }

  function outline(shape) {
    if (!shape) return "";
    if (shape.type === "path") return String(shape.d || "");
    if (shape.type === "circle") return ellipse(shape.cx, shape.cy, shape.r, shape.r);
    if (shape.type === "ellipse") return ellipse(shape.cx, shape.cy, shape.rx, shape.ry);
    if (shape.type === "rect") return rect(shape);
    if (shape.type === "polygon" && shape.points && shape.points.length >= 3) {
      return shape.points.map(function (p, i) {
        return (i ? "L" : "M") + fmt(p[0]) + " " + fmt(p[1]);
      }).join("") + "Z";
    }
    return "";
  }

  root.VeloraClip = { outline: outline };
})(typeof window !== "undefined" ? window : globalThis);
