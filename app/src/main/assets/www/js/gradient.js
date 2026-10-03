(function (root) {
  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function linear(box, angle, from, to) {
    var rad = (Number(angle) || 0) * Math.PI / 180;
    var cx = box.x + box.w / 2;
    var cy = box.y + box.h / 2;
    var len = Math.max(box.w, box.h) / 2 || 1;
    var dx = Math.cos(rad) * len;
    var dy = Math.sin(rad) * len;
    return {
      type: "linear",
      x1: round(cx - dx),
      y1: round(cy - dy),
      x2: round(cx + dx),
      y2: round(cy + dy),
      stops: [
        { offset: 0, color: from || "figure" },
        { offset: 1, color: to || "accent" }
      ]
    };
  }

  root.VeloraGradient = { linear: linear };
})(typeof window !== "undefined" ? window : globalThis);
