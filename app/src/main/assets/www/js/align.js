(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function union(boxes) {
    var x = Infinity;
    var y = Infinity;
    var r = -Infinity;
    var b = -Infinity;
    boxes.forEach(function (box) {
      if (!box) return;
      x = Math.min(x, box.x);
      y = Math.min(y, box.y);
      r = Math.max(r, box.x + box.w);
      b = Math.max(b, box.y + box.h);
    });
    if (!isFinite(x)) return null;
    return { x: x, y: y, w: r - x, h: b - y, cx: (x + r) / 2, cy: (y + b) / 2 };
  }

  function boardBox(viewBox) {
    var vb = viewBox && viewBox.length === 4 ? viewBox : [0, 0, 1024, 1024];
    return { x: vb[0], y: vb[1], w: vb[2], h: vb[3], cx: vb[0] + vb[2] / 2, cy: vb[1] + vb[3] / 2 };
  }

  function align(items, mode, viewBox) {
    var live = (items || []).filter(function (item) { return item && item.box; });
    if (!live.length) return [];
    var target = live.length === 1 ? boardBox(viewBox) : union(live.map(function (item) { return item.box; }));
    if (!target) return [];
    return live.map(function (item) {
      var box = item.box;
      var dx = 0;
      var dy = 0;
      if (mode === "left") dx = target.x - box.x;
      else if (mode === "hcenter") dx = target.cx - box.cx;
      else if (mode === "right") dx = target.x + target.w - (box.x + box.w);
      else if (mode === "top") dy = target.y - box.y;
      else if (mode === "vmiddle") dy = target.cy - box.cy;
      else if (mode === "bottom") dy = target.y + target.h - (box.y + box.h);
      return { id: item.id, dx: round(dx), dy: round(dy) };
    }).filter(function (move) { return move.dx || move.dy; });
  }

  function distribute(items, axis) {
    var live = (items || []).filter(function (item) { return item && item.box; });
    if (live.length < 3) return [];
    var horizontal = axis !== "v";
    live.sort(function (a, b) {
      return horizontal ? a.box.x - b.box.x : a.box.y - b.box.y;
    });
    var first = live[0].box;
    var last = live[live.length - 1].box;
    var span = horizontal
      ? (last.x + last.w) - first.x
      : (last.y + last.h) - first.y;
    var used = 0;
    live.forEach(function (item) { used += horizontal ? item.box.w : item.box.h; });
    var gap = (span - used) / (live.length - 1);
    var cursor = horizontal ? first.x : first.y;
    return live.map(function (item, index) {
      var box = item.box;
      if (index === 0 || index === live.length - 1) {
        cursor += (horizontal ? box.w : box.h) + gap;
        return null;
      }
      var dx = horizontal ? round(cursor - box.x) : 0;
      var dy = horizontal ? 0 : round(cursor - box.y);
      cursor += (horizontal ? box.w : box.h) + gap;
      if (!dx && !dy) return null;
      return { id: item.id, dx: dx, dy: dy };
    }).filter(Boolean);
  }

  root.VeloraAlign = {
    union: union,
    board: boardBox,
    align: align,
    distribute: distribute
  };
})(typeof window !== "undefined" ? window : globalThis);
