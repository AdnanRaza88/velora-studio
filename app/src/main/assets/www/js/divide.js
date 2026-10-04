(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function pathFromRings(rings) {
    return rings.map(function (ring) {
      return ring.map(function (p, i) {
        return (i ? "L" : "M") + round(p[0]) + " " + round(p[1]);
      }).join("") + "Z";
    }).join("");
  }

  function piece(source, rings, id) {
    if (!rings || !rings.length) return null;
    var path = {
      id: id,
      type: "path",
      role: source.role || "figure",
      opacity: source.opacity == null ? 1 : source.opacity,
      fill: source.fill != null ? source.fill : (source.role || "figure"),
      d: pathFromRings(rings)
    };
    if (rings.length > 1) path.fillRule = "evenodd";
    return path;
  }

  function pair(doc, id) {
    var layer = null;
    var index = -1;
    (doc.layers || []).forEach(function (item) {
      if (item.locked) return;
      (item.shapes || []).forEach(function (shape, i) {
        if (shape.id === id) {
          layer = item;
          index = i;
        }
      });
    });
    if (!layer || index < 0) return null;
    var other = index > 0 ? index - 1 : 1;
    if (other === index || other < 0 || other >= layer.shapes.length) return null;
    return { layer: layer, index: index, other: other };
  }

  function divide(doc, id) {
    if (!doc || typeof VeloraBoolean === "undefined") return 0;
    var found = pair(doc, id);
    if (!found) return 0;
    var selected = found.layer.shapes[found.index];
    var neighbor = found.layer.shapes[found.other];
    var front = found.index > found.other ? selected : neighbor;
    var back = found.index > found.other ? neighbor : selected;
    var backRings = VeloraBoolean.ringsOf(back);
    var frontRings = VeloraBoolean.ringsOf(front);
    if (!backRings.length || !frontRings.length) return 0;
    var onlyBack = VeloraBoolean.combine(backRings, frontRings, "subtract");
    var overlap = VeloraBoolean.combine(backRings, frontRings, "intersect");
    var onlyFront = VeloraBoolean.combine(frontRings, backRings, "subtract");
    if (!overlap.length) return 0;
    var parts = [];
    var backPiece = piece(back, onlyBack, back.id);
    var overlapPiece = piece(front, overlap, front.id + "-overlap");
    var frontPiece = piece(front, onlyFront, front.id);
    if (backPiece) parts.push(backPiece);
    if (overlapPiece) parts.push(overlapPiece);
    if (frontPiece) parts.push(frontPiece);
    if (parts.length < 2) return 0;
    var drop = Math.max(found.index, found.other);
    var stay = Math.min(found.index, found.other);
    found.layer.shapes.splice(drop, 1);
    found.layer.shapes.splice(stay, 1);
    parts.forEach(function (path, i) {
      found.layer.shapes.splice(stay + i, 0, path);
    });
    return parts.length;
  }

  root.VeloraDivide = { divide: divide };
})(typeof window !== "undefined" ? window : globalThis);
