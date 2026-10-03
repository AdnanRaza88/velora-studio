(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function pointInRing(p, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i];
      var b = ring[j];
      var hit = ((a[1] > p[1]) !== (b[1] > p[1])) &&
        (p[0] < (b[0] - a[0]) * (p[1] - a[1]) / ((b[1] - a[1]) || 1e-12) + a[0]);
      if (hit) inside = !inside;
    }
    return inside;
  }

  function contains(shape, x, y) {
    var rings = VeloraBoolean.ringsOf(shape);
    var hits = 0;
    for (var i = 0; i < rings.length; i++) if (pointInRing([x, y], rings[i])) hits++;
    return hits % 2 === 1;
  }

  function under(doc, x, y) {
    var found = [];
    (doc.layers || []).forEach(function (layer) {
      if (layer.locked || layer.hidden) return;
      (layer.shapes || []).forEach(function (shape, index) {
        if (!shape || shape.type === "text" || shape.type === "blend") return;
        if (contains(shape, x, y)) found.push({ layer: layer, index: index, shape: shape });
      });
    });
    return found;
  }

  function pathFromRings(rings) {
    return rings.map(function (ring) {
      return ring.map(function (p, i) {
        return (i ? "L" : "M") + round(p[0]) + " " + round(p[1]);
      }).join("") + "Z";
    }).join("");
  }

  function asPath(keep, rings) {
    var path = {
      id: keep.id,
      type: "path",
      role: keep.role || "figure",
      opacity: keep.opacity == null ? 1 : keep.opacity,
      fill: keep.fill != null ? keep.fill : (keep.role || "figure"),
      d: pathFromRings(rings)
    };
    if (rings.length > 1) path.fillRule = "evenodd";
    if (keep.stroke != null) path.stroke = keep.stroke;
    if (keep.strokeWidth != null) path.strokeWidth = keep.strokeWidth;
    return path;
  }

  function pair(found) {
    if (found.length < 2) return null;
    var front = found[found.length - 1];
    for (var i = found.length - 2; i >= 0; i--) {
      if (found[i].layer === front.layer) return { front: front, back: found[i] };
    }
    return null;
  }

  function uniteRings(a, b) {
    var forward = VeloraBoolean.combine(a, b, "unite");
    var backward = VeloraBoolean.combine(b, a, "unite");
    if (backward.length && backward.length < forward.length) return backward;
    return forward;
  }

  function mergeAt(doc, x, y) {
    var found = pair(under(doc, x, y));
    if (!found) return null;
    var rings = uniteRings(VeloraBoolean.ringsOf(found.front.shape), VeloraBoolean.ringsOf(found.back.shape));
    if (!rings.length) return null;
    var path = asPath(found.front.shape, rings);
    var hi = Math.max(found.front.index, found.back.index);
    var lo = Math.min(found.front.index, found.back.index);
    found.front.layer.shapes.splice(hi, 1);
    found.front.layer.shapes.splice(lo, 1, path);
    return path;
  }

  function eraseAt(doc, x, y) {
    var found = under(doc, x, y);
    if (!found.length) return null;
    var front = found[found.length - 1];
    var mate = null;
    for (var i = found.length - 2; i >= 0; i--) {
      if (found[i].layer === front.layer) {
        mate = found[i];
        break;
      }
    }
    if (!mate) {
      front.layer.shapes.splice(front.index, 1);
      return { erased: front.shape.id };
    }
    var overlap = VeloraBoolean.combine(VeloraBoolean.ringsOf(front.shape), VeloraBoolean.ringsOf(mate.shape), "intersect");
    if (!overlap.length) {
      front.layer.shapes.splice(front.index, 1);
      return { erased: front.shape.id };
    }
    var frontLeft = VeloraBoolean.combine(VeloraBoolean.ringsOf(front.shape), overlap, "subtract");
    var backLeft = VeloraBoolean.combine(VeloraBoolean.ringsOf(mate.shape), overlap, "subtract");
    var hi = Math.max(front.index, mate.index);
    var lo = Math.min(front.index, mate.index);
    var keep = [];
    if (lo === mate.index) {
      if (backLeft.length) keep.push(asPath(mate.shape, backLeft));
      if (frontLeft.length) keep.push(asPath(front.shape, frontLeft));
    } else {
      if (frontLeft.length) keep.push(asPath(front.shape, frontLeft));
      if (backLeft.length) keep.push(asPath(mate.shape, backLeft));
    }
    front.layer.shapes.splice(hi, 1);
    if (!keep.length) {
      front.layer.shapes.splice(lo, 1);
      return { erased: front.shape.id };
    }
    front.layer.shapes.splice(lo, 1, keep[0]);
    if (keep[1]) front.layer.shapes.splice(lo + 1, 0, keep[1]);
    return { erased: front.shape.id, id: keep[0].id };
  }

  function mergeIds(doc, ids) {
    if (!ids || ids.length < 2) return null;
    var bag = [];
    (doc.layers || []).forEach(function (layer) {
      if (layer.locked || layer.hidden) return;
      (layer.shapes || []).forEach(function (shape, index) {
        if (ids.indexOf(shape.id) >= 0) bag.push({ layer: layer, index: index, shape: shape });
      });
    });
    if (bag.length < 2) return null;
    var layer = bag[bag.length - 1].layer;
    var onLayer = bag.filter(function (item) { return item.layer === layer; });
    if (onLayer.length < 2) return null;
    var rings = VeloraBoolean.ringsOf(onLayer[0].shape);
    for (var i = 1; i < onLayer.length; i++) rings = uniteRings(rings, VeloraBoolean.ringsOf(onLayer[i].shape));
    if (!rings.length) return null;
    var path = asPath(onLayer[onLayer.length - 1].shape, rings);
    var indexes = onLayer.map(function (item) { return item.index; }).sort(function (a, b) { return b - a; });
    indexes.forEach(function (index, n) {
      if (n === indexes.length - 1) layer.shapes.splice(index, 1, path);
      else layer.shapes.splice(index, 1);
    });
    return path;
  }

  root.VeloraShape = {
    under: under,
    mergeAt: mergeAt,
    eraseAt: eraseAt,
    mergeIds: mergeIds
  };
})(typeof window !== "undefined" ? window : globalThis);
