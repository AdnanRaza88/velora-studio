(function (root) {
  function esc(t) {
    return String(t || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function layer(id, name, body) {
    var safe = String(id || name || "Layer").replace(/[^A-Za-z0-9_\-]/g, "_");
    if (!/^[A-Za-z_]/.test(safe)) safe = "L_" + safe;
    return (
      '<g id="' +
      safe +
      '" data-name="' +
      esc(name || id) +
      '" inkscape:groupmode="layer" inkscape:label="' +
      esc(name || id) +
      '">' +
      body +
      "</g>"
    );
  }

  function wrap(title, viewBox, layersXml) {
    var vb = viewBox || [0, 0, 1024, 1024];
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" viewBox="' +
      vb.join(" ") +
      '" width="' +
      vb[2] +
      '" height="' +
      vb[3] +
      '">' +
      "<title>" +
      esc(title || "Velora") +
      "</title>" +
      "<desc>Layered SVG for Adobe Illustrator. Open in Illustrator to edit layers.</desc>" +
      layersXml +
      "</svg>"
    );
  }

  function logoMark(brief, palette) {
    var p = palette || { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
    var name = String(brief || "Mark").slice(0, 24);
    var ground = layer("Ground", "Ground", '<rect x="0" y="0" width="1024" height="1024" fill="' + p.ground + '"/>');
    var mark =
      '<circle cx="512" cy="420" r="160" fill="' +
      p.figure +
      '"/>' +
      '<path d="M320 620 L512 860 L704 620 Z" fill="' +
      p.accent +
      '"/>';
    var figure = layer("Figure", "Figure", mark);
    var word =
      '<text x="512" y="960" text-anchor="middle" font-family="Georgia, serif" font-size="56" fill="' +
      p.figure +
      '">' +
      esc(name) +
      "</text>";
    var type = layer("Type", "Type", word);
    return wrap(name + " logo", [0, 0, 1024, 1024], ground + figure + type);
  }

  function iconMark(brief, palette) {
    var p = palette || { ground: "#ffffff", figure: "#1e1b16", accent: "#355e57" };
    var ground = layer("Ground", "Ground", '<rect x="0" y="0" width="1024" height="1024" rx="120" fill="' + p.ground + '"/>');
    var glyph =
      '<rect x="280" y="280" width="464" height="464" rx="48" fill="none" stroke="' +
      p.figure +
      '" stroke-width="48"/>' +
      '<circle cx="512" cy="512" r="96" fill="' +
      p.accent +
      '"/>';
    var figure = layer("Figure", "Figure", glyph);
    return wrap((brief || "Icon") + " icon", [0, 0, 1024, 1024], ground + figure);
  }

  function textileTile(repeat, palette) {
    var p = palette || { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
    var tile = 256;
    var cols = 4;
    var rows = 4;
    var ground = layer("Ground", "Ground", '<rect x="0" y="0" width="1024" height="1024" fill="' + p.ground + '"/>');
    var motifs = "";
    var r, c, ox, oy;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        ox = c * tile + tile / 2;
        oy = r * tile + tile / 2;
        if (repeat === "half-drop") oy += (c % 2) * (tile / 2);
        if (repeat === "half-brick") ox += (r % 2) * (tile / 2);
        motifs +=
          '<g transform="translate(' +
          ox +
          " " +
          oy +
          ')">' +
          '<circle cx="0" cy="0" r="48" fill="' +
          p.figure +
          '"/>' +
          '<circle cx="0" cy="0" r="18" fill="' +
          p.accent +
          '"/>' +
          "</g>";
      }
    }
    var motif = layer("Motif", "Motif", motifs);
    return wrap("Textile " + (repeat || "block"), [0, 0, 1024, 1024], ground + motif);
  }

  function characterMark(brief, palette) {
    var p = palette || { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
    var ground = layer("Ground", "Ground", '<rect x="0" y="0" width="1024" height="1024" fill="' + p.ground + '"/>');
    var body = layer(
      "Body",
      "Body",
      '<ellipse cx="512" cy="640" rx="140" ry="180" fill="' + p.figure + '"/>'
    );
    var head = layer(
      "Head",
      "Head",
      '<circle cx="512" cy="360" r="120" fill="' + p.figure + '"/>' +
        '<circle cx="470" cy="340" r="16" fill="' +
        p.ground +
        '"/>' +
        '<circle cx="554" cy="340" r="16" fill="' +
        p.ground +
        '"/>'
    );
    var accent = layer(
      "Accent",
      "Accent",
      '<path d="M400 300 Q512 220 624 300" fill="none" stroke="' + p.accent + '" stroke-width="24" stroke-linecap="round"/>'
    );
    return wrap((brief || "Character") + " character", [0, 0, 1024, 1024], ground + body + head + accent);
  }

  function fromCategory(category, brief, repeat, palette) {
    var cat = String(category || "logo").toLowerCase();
    if (cat === "textile") return textileTile(repeat || "half-drop", palette);
    if (cat === "icon") return iconMark(brief, palette);
    if (cat === "character") return characterMark(brief, palette);
    return logoMark(brief, palette);
  }

  function fromTraceShapes(shapes, title, palette) {
    var p = palette || { ground: "#f6f1e8", figure: "#1e1b16", accent: "#355e57" };
    var ground = layer("Ground", "Ground", '<rect x="0" y="0" width="1024" height="1024" fill="' + p.ground + '"/>');
    var figureParts = [];
    var accentParts = [];
    var i, s, d, fill;
    for (i = 0; i < (shapes || []).length; i++) {
      s = shapes[i];
      d = s && s.d ? s.d : "";
      if (!d) continue;
      fill = i === 0 ? p.figure : p.accent;
      (i === 0 ? figureParts : accentParts).push(
        '<path d="' + d + '" fill="' + fill + '" fill-rule="evenodd"/>'
      );
    }
    var xml = ground;
    if (figureParts.length) xml += layer("Figure", "Figure", figureParts.join(""));
    if (accentParts.length) xml += layer("Detail", "Detail", accentParts.join(""));
    return wrap(title || "Trace", [0, 0, 1024, 1024], xml);
  }

  function download(svgText, filename) {
    var blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename || "velora-design.svg";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 400);
  }

  root.VeloraSvg = {
    layer: layer,
    wrap: wrap,
    logoMark: logoMark,
    iconMark: iconMark,
    textileTile: textileTile,
    characterMark: characterMark,
    fromCategory: fromCategory,
    fromTraceShapes: fromTraceShapes,
    download: download
  };
})(typeof window !== "undefined" ? window : globalThis);
