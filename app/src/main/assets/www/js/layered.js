(function (root) {
  function patchCompile() {
    if (!root.VeloraVxl || !root.VeloraVxl.compile || root.VeloraVxl.__layeredCompile) return;
    var prev = root.VeloraVxl.compile;
    root.VeloraVxl.compile = function (doc) {
      var svg = prev(doc);
      if (!svg || svg.indexOf("inkscape:groupmode") >= 0) return svg;
      try {
        if (!root.VeloraSvg || !doc || !doc.layers) return svg;
        var vb = (doc.canvas && doc.canvas.viewBox) || [0, 0, 1024, 1024];
        var pal = doc.palette || { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
        var layers = root.VeloraSvg.layer(
          "Ground",
          "Ground",
          '<rect x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="' + (pal.ground || "#f6f1e8") + '"/>'
        );
        for (var i = 0; i < doc.layers.length; i++) {
          var layer = doc.layers[i];
          if (!layer || layer.visible === false) continue;
          var body = "";
          var shapes = layer.shapes || [];
          for (var s = 0; s < shapes.length; s++) {
            var sh = shapes[s];
            if (!sh) continue;
            var fill = sh.fill === "none" ? "none" : (pal[sh.role] || pal.figure || "#1e1b16");
            if (sh.type === "path" && sh.d) {
              body += '<path d="' + sh.d + '" fill="' + fill + '" fill-rule="evenodd"/>';
            } else if (sh.type === "circle") {
              body += '<circle cx="' + sh.cx + '" cy="' + sh.cy + '" r="' + sh.r + '" fill="' + fill + '"/>';
            } else if (sh.type === "rect") {
              body += '<rect x="' + sh.x + '" y="' + sh.y + '" width="' + sh.w + '" height="' + sh.h + '" fill="' + fill + '"/>';
            } else if (sh.type === "ellipse") {
              body += '<ellipse cx="' + sh.cx + '" cy="' + sh.cy + '" rx="' + sh.rx + '" ry="' + sh.ry + '" fill="' + fill + '"/>';
            }
          }
          if (body) {
            layers += root.VeloraSvg.layer(layer.id || ("Layer_" + (i + 1)), layer.name || ("Layer " + (i + 1)), body);
          }
        }
        return root.VeloraSvg.wrap((doc.meta && doc.meta.name) || "Velora", vb, layers);
      } catch (e) {
        return svg;
      }
    };
    root.VeloraVxl.__layeredCompile = true;
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", patchCompile);
    else patchCompile();
  } else {
    patchCompile();
  }
})(typeof window !== "undefined" ? window : globalThis);
