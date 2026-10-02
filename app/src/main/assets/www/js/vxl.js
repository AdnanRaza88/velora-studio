(function (root) {
  var TYPES = ["path", "circle", "ellipse", "rect", "line", "polygon", "text", "group"];
  var REPEATS = ["block", "half-drop", "half-brick", "mirror"];
  var ROLES = ["ground", "figure", "accent"];
  var CATEGORIES = ["logo", "textile", "illustration"];
  var INK_KEYS = ["ink2", "ink3", "ink4"];
  var MAX_DEPTH = 4;

  function isHex(v) {
    return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
  }

  function num(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : fallback;
  }

  function paint(value, palette) {
    if (value == null || value === "") return null;
    if (value === "none") return "none";
    var role = typeof value === "string" ? value.toLowerCase() : value;
    if (ROLES.indexOf(role) >= 0 && palette && palette[role]) return palette[role];
    if (INK_KEYS.indexOf(role) >= 0 && palette && palette[role]) return palette[role];
    if (isHex(value)) return value;
    return null;
  }

  function esc(t) {
    return String(t)
      .replace(/&/g, "&" + "amp;")
      .replace(/</g, "&" + "lt;")
      .replace(/>/g, "&" + "gt;")
      .replace(/"/g, "&" + "quot;");
  }

  function looksUnsafe(v) {
    if (typeof v !== "string") return false;
    var s = v.toLowerCase();
    return s.indexOf("data:image") >= 0 || s.indexOf("base64,") >= 0 || s.indexOf("<script") >= 0 || s.indexOf("javascript:") >= 0;
  }

  function safePath(d) {
    if (typeof d !== "string") return "";
    if (looksUnsafe(d)) return "";
    if (!/^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/.test(d)) return "";
    return d.trim();
  }

  function slug(s) {
    return String(s || "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "project";
  }

  function uid() {
    return "vxl_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
  }

  function hash(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pick(arr, h) {
    return arr[(h >>> 0) % arr.length];
  }

  function paletteSet(h) {
    var sets = [
      ["#f6f1e8", "#1b3358", "#355e57"],
      ["#efe8dc", "#1e1b16", "#8a3b24"],
      ["#f4efe6", "#0f2a24", "#c4a574"],
      ["#ebe4d7", "#2c1e3a", "#5c7a6e"],
      ["#f0ebe3", "#1a2744", "#b85c38"]
    ];
    var row = sets[(h >>> 0) % sets.length];
    return { ground: row[0], figure: row[1], accent: row[2] };
  }

  function blank(partial) {
    var now = new Date().toISOString();
    return {
      vxl: 1,
      meta: {
        id: uid(),
        name: "Untitled",
        created: now,
        updated: now,
        category: "logo",
        skill: "logo",
        purpose: "brand",
        brief: ""
      },
      canvas: { viewBox: [0, 0, 1024, 1024], units: "px" },
      palette: { ground: "#f6f1e8", figure: "#1b3358", accent: "#355e57" },
      repeat: null,
      layers: [{ id: "layer-1", name: "Layer 1", visible: true, opacity: 1, shapes: [] }]
    };
  }

  function mapCategory(raw) {
    var c = String(raw || "").toLowerCase();
    if (c === "icon") return { category: "logo", skill: "icon" };
    if (c === "character") return { category: "illustration", skill: "character" };
    if (c === "textile") return { category: "textile", skill: "textile" };
    if (c === "illustration") return { category: "illustration", skill: "character" };
    if (c === "logo") return { category: "logo", skill: "logo" };
    return { category: "", skill: "" };
  }

  function parsePoints(raw) {
    if (typeof raw === "string") {
      var bits = raw.trim().split(/[\s,]+/);
      var out = [];
      for (var i = 0; i + 1 < bits.length && out.length < 256; i += 2) {
        out.push([num(bits[i], 0), num(bits[i + 1], 0)]);
      }
      return out;
    }
    var pts = Array.isArray(raw) ? raw : [];
    return pts.slice(0, 256).map(function (p) {
      if (Array.isArray(p)) return [num(p[0], 0), num(p[1], 0)];
      return [num(p && p.x, 0), num(p && p.y, 0)];
    });
  }

  function parseViewBox(vb) {
    if (typeof vb === "string") vb = vb.trim().split(/[\s,]+/);
    if (!Array.isArray(vb) || vb.length !== 4) return null;
    var nums = vb.map(function (n) { return num(n, NaN); });
    if (nums.some(function (n) { return !isFinite(n); })) return null;
    return nums;
  }

  function normalizeShape(raw, errors, path, depth) {
    if (!raw || typeof raw !== "object") {
      errors.push(path + " is not an object");
      return null;
    }
    if (looksUnsafe(JSON.stringify(raw))) {
      errors.push(path + " embeds a raster or script");
      return null;
    }
    var type = raw.type;
    if (type === "image" || type === "raster") {
      errors.push(path + " raster is not a design source");
      return null;
    }
    if (TYPES.indexOf(type) < 0) {
      errors.push(path + " has unknown type");
      return null;
    }
    if (depth > MAX_DEPTH) {
      errors.push(path + " is nested too deep");
      return null;
    }
    var role = typeof raw.role === "string" ? raw.role.toLowerCase() : "";
    var shape = {
      id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 64) : uid(),
      type: type,
      role: ROLES.indexOf(role) >= 0 ? role : "figure",
      opacity: Math.max(0, Math.min(1, num(raw.opacity, 1)))
    };
    if (raw.fill != null) shape.fill = raw.fill;
    if (raw.stroke != null) shape.stroke = raw.stroke;
    if (raw.strokeWidth != null) shape.strokeWidth = Math.max(0, num(raw.strokeWidth, 0));
    if (raw.strokeLinecap) shape.strokeLinecap = String(raw.strokeLinecap).slice(0, 16);
    if (raw.strokeLinejoin) shape.strokeLinejoin = String(raw.strokeLinejoin).slice(0, 16);
    if (typeof raw.transform === "string") shape.transform = raw.transform.slice(0, 240);
    var rule = raw.fillRule || raw["fill-rule"];
    if (rule === "evenodd" || rule === "nonzero") shape.fillRule = rule;

    if (Array.isArray(raw.widthProfile)) {
      shape.widthProfile = raw.widthProfile.slice(0, 16).map(function (n) { return Math.max(0, num(n, 0)); });
    }

    if (type === "path") {
      shape.d = safePath(raw.d);
      if (!shape.d) errors.push(path + " path d is empty or unsafe");
    } else if (type === "circle") {
      shape.cx = num(raw.cx, 0);
      shape.cy = num(raw.cy, 0);
      shape.r = Math.max(0, num(raw.r, 0));
    } else if (type === "ellipse") {
      shape.cx = num(raw.cx, 0);
      shape.cy = num(raw.cy, 0);
      shape.rx = Math.max(0, num(raw.rx, 0));
      shape.ry = Math.max(0, num(raw.ry, 0));
    } else if (type === "rect") {
      shape.x = num(raw.x, 0);
      shape.y = num(raw.y, 0);
      shape.w = Math.max(0, num(raw.w != null ? raw.w : raw.width, 0));
      shape.h = Math.max(0, num(raw.h != null ? raw.h : raw.height, 0));
      shape.rx = Math.max(0, num(raw.rx, 0));
      if (raw.rot != null) shape.rot = num(raw.rot, 0);
    } else if (type === "line") {
      shape.x1 = num(raw.x1, 0);
      shape.y1 = num(raw.y1, 0);
      shape.x2 = num(raw.x2, 0);
      shape.y2 = num(raw.y2, 0);
    } else if (type === "polygon") {
      shape.points = parsePoints(raw.points);
      if (shape.points.length < 3) errors.push(path + " polygon needs 3 points");
    } else if (type === "text") {
      shape.x = num(raw.x, 0);
      shape.y = num(raw.y, 0);
      shape.size = Math.max(1, num(raw.size != null ? raw.size : raw.fontSize, 32));
      shape.text = String(raw.text || "").slice(0, 80);
      shape.anchor = raw.anchor === "start" || raw.anchor === "end" ? raw.anchor : "middle";
    } else if (type === "group") {
      shape.children = [];
      var kids = Array.isArray(raw.children) ? raw.children : Array.isArray(raw.shapes) ? raw.shapes : [];
      for (var i = 0; i < kids.length && i < 64; i++) {
        var child = normalizeShape(kids[i], errors, path + ".children[" + i + "]", depth + 1);
        if (child) shape.children.push(child);
      }
    }
    return shape;
  }

  function liftLegacy(raw) {
    if (!raw || typeof raw !== "object") return raw;
    if (raw.meta && raw.canvas) return raw;
    var doc = blank();
    doc.meta.category = raw.category || "logo";
    doc.meta.purpose = raw.purpose || (doc.meta.category === "textile" ? "surface" : "brand");
    doc.meta.brief = raw.brief || "";
    doc.meta.name = raw.name || doc.meta.category;
    if (Array.isArray(raw.viewBox) && raw.viewBox.length === 4) doc.canvas.viewBox = raw.viewBox.map(Number);
    if (raw.palette) doc.palette = raw.palette;
    if (raw.repeat) doc.repeat = raw.repeat;
    if (Array.isArray(raw.layers)) doc.layers = raw.layers;
    if (raw.motif && raw.motif.path && String(raw.category) === "textile") {
      doc.layers = [{
        id: "motif",
        name: "Motif",
        visible: true,
        opacity: 1,
        shapes: [
          { id: "motif-path", type: "path", role: "figure", d: raw.motif.path },
          { id: "motif-dot", type: "circle", role: "ground", cx: 0, cy: 0, r: 12 }
        ]
      }];
    }
    return doc;
  }


  function cleanReference(ref, errors) {
    if (ref == null) return null;
    if (typeof ref !== "object") {
      errors.push("meta.reference must be an object");
      return null;
    }
    var blob = JSON.stringify(ref);
    if (looksUnsafe(blob)) {
      errors.push("meta.reference must not embed raster");
      return null;
    }
    var id = String(ref.id || "").replace(/[^a-zA-Z0-9-]/g, "");
    if (!id) {
      errors.push("meta.reference.id is required");
      return null;
    }
    var file = "files/attachments/" + id;
    if (typeof ref.file === "string" && ref.file.indexOf("files/attachments/") === 0) {
      file = ref.file.replace(/[^a-zA-Z0-9./-]/g, "").slice(0, 120);
    }
    return {
      id: id.slice(0, 64),
      name: String(ref.name || "reference").slice(0, 80),
      mime: String(ref.mime || "image/jpeg").slice(0, 40),
      bytes: Math.max(0, Math.round(num(ref.bytes, 0))),
      width: Math.max(0, Math.round(num(ref.width, 0))),
      height: Math.max(0, Math.round(num(ref.height, 0))),
      store: "files/attachments",
      file: file
    };
  }

  function validate(input) {
    var errors = [];
    var warnings = [];
    var raw = input;
    if (typeof input === "string") {
      try { raw = JSON.parse(input); }
      catch (e) { return { ok: false, errors: ["JSON parse failed"], warnings: [], document: null }; }
    }
    if (!raw || typeof raw !== "object") return { ok: false, errors: ["VXL must be an object"], warnings: [], document: null };
    raw = liftLegacy(raw);
    if (raw.vxl !== 1) errors.push("vxl version must be 1");

    var doc = blank();
    var meta = raw.meta || {};
    doc.meta.id = typeof meta.id === "string" && meta.id ? meta.id.slice(0, 64) : uid();
    doc.meta.name = String(meta.name || "Untitled").slice(0, 80);
    doc.meta.created = typeof meta.created === "string" ? meta.created : doc.meta.created;
    doc.meta.updated = new Date().toISOString();
    var mapped = mapCategory(meta.category);
    if (!mapped.category) errors.push("meta.category must be logo, textile, illustration, icon, or character");
    else doc.meta.category = mapped.category;
    var skill = typeof meta.skill === "string" ? meta.skill.toLowerCase() : mapped.skill;
    if (["logo", "textile", "character", "icon"].indexOf(skill) < 0) skill = mapped.skill || "logo";
    doc.meta.skill = skill;
    doc.meta.purpose = String(meta.purpose || "brand").slice(0, 40);
    doc.meta.brief = String(meta.brief || "").slice(0, 500);
    var reference = cleanReference(meta.reference, errors);
    if (reference) doc.meta.reference = reference;


    var vb = parseViewBox(raw.canvas && raw.canvas.viewBox);
    if (!vb) errors.push("canvas.viewBox must be 4 numbers");
    else doc.canvas.viewBox = vb;
    doc.canvas.units = "px";

    var pal = raw.palette || {};
    var defaults = doc.palette;
    ["ground", "figure", "accent"].forEach(function (key) {
      if (!isHex(pal[key])) {
        warnings.push("palette." + key + " missing or not hex; repaired");
        doc.palette[key] = defaults[key];
      } else doc.palette[key] = pal[key];
    });
    INK_KEYS.forEach(function (key) {
      if (pal[key] == null) return;
      if (!isHex(pal[key])) errors.push("palette." + key + " must be a hex color");
      else doc.palette[key] = pal[key];
    });

    if (raw.repeat) {
      var rt = raw.repeat.type;
      if (REPEATS.indexOf(rt) < 0) errors.push("repeat.type is not supported");
      var tile = raw.repeat.tile || [240, 240];
      if (typeof tile === "string") tile = tile.split(/[\s,]+/);
      doc.repeat = {
        type: REPEATS.indexOf(rt) >= 0 ? rt : "block",
        tile: [Math.max(8, num(tile[0], 240)), Math.max(8, num(tile[1], 240))],
        cols: Math.max(1, Math.min(8, num(raw.repeat.cols, 4))),
        rows: Math.max(1, Math.min(8, num(raw.repeat.rows, 4)))
      };
    } else doc.repeat = null;

    doc.layers = [];
    var layers = Array.isArray(raw.layers) ? raw.layers : [];
    if (!layers.length) errors.push("at least one layer is required");
    for (var i = 0; i < layers.length && i < 16; i++) {
      var layer = layers[i] || {};
      var out = {
        id: typeof layer.id === "string" && layer.id ? layer.id.slice(0, 64) : "layer-" + (i + 1),
        name: String(layer.name || ("Layer " + (i + 1))).slice(0, 40),
        visible: layer.visible !== false,
        opacity: Math.max(0, Math.min(1, num(layer.opacity, 1))),
        shapes: []
      };
      var shapes = Array.isArray(layer.shapes) ? layer.shapes : [];
      for (var s = 0; s < shapes.length && s < 80; s++) {
        var shape = normalizeShape(shapes[s], errors, "layers[" + i + "].shapes[" + s + "]", 1);
        if (shape) out.shapes.push(shape);
      }
      doc.layers.push(out);
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings, document: doc };
  }

  function styleAttrs(shape, palette) {
    var fill = paint(shape.fill != null ? shape.fill : shape.role, palette);
    var stroke = paint(shape.stroke, palette);
    var attrs = "";
    if (fill) attrs += ' fill="' + fill + '"';
    else attrs += ' fill="' + palette.figure + '"';
    if (shape.fillRule) attrs += ' fill-rule="' + shape.fillRule + '"';
    if (stroke) {
      attrs += ' stroke="' + stroke + '"';
      attrs += ' stroke-width="' + num(shape.strokeWidth, 2) + '"';
      if (shape.strokeLinecap) attrs += ' stroke-linecap="' + esc(shape.strokeLinecap) + '"';
      if (shape.strokeLinejoin) attrs += ' stroke-linejoin="' + esc(shape.strokeLinejoin) + '"';
    }
    if (shape.opacity != null && shape.opacity < 1) attrs += ' opacity="' + shape.opacity + '"';
    return attrs;
  }

  function compileShape(shape, palette) {
    var attrs = styleAttrs(shape, palette);
    if (shape.type === "path") return '<path d="' + shape.d + '"' + attrs + "/>";
    if (shape.type === "circle") return '<circle cx="' + shape.cx + '" cy="' + shape.cy + '" r="' + shape.r + '"' + attrs + "/>";
    if (shape.type === "ellipse") return '<ellipse cx="' + shape.cx + '" cy="' + shape.cy + '" rx="' + shape.rx + '" ry="' + shape.ry + '"' + attrs + "/>";
    if (shape.type === "rect") {
      var body = '<rect x="' + (-shape.w / 2) + '" y="' + (-shape.h / 2) + '" width="' + shape.w + '" height="' + shape.h + '" rx="' + (shape.rx || 0) + '"' + attrs + "/>";
      var t = "translate(" + (shape.x + shape.w / 2) + " " + (shape.y + shape.h / 2) + ")";
      if (shape.rot) t += " rotate(" + shape.rot + ")";
      return '<g transform="' + t + '">' + body + "</g>";
    }
    if (shape.type === "line") {
      var lineAttrs = attrs.replace(' fill="' + palette.figure + '"', ' fill="none"');
      if (lineAttrs.indexOf("stroke=") < 0) lineAttrs += ' stroke="' + palette.figure + '" stroke-width="' + num(shape.strokeWidth, 2) + '"';
      return '<line x1="' + shape.x1 + '" y1="' + shape.y1 + '" x2="' + shape.x2 + '" y2="' + shape.y2 + '"' + lineAttrs + "/>";
    }
    if (shape.type === "polygon") {
      var pts = shape.points.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
      return '<polygon points="' + pts + '"' + attrs + "/>";
    }
    if (shape.type === "text") {
      return '<text x="' + shape.x + '" y="' + shape.y + '" text-anchor="' + shape.anchor + '" font-size="' + shape.size + '" font-family="Georgia,serif"' + attrs + ">" + esc(shape.text) + "</text>";
    }
    if (shape.type === "group") {
      var inner = shape.children.map(function (c) { return compileShape(c, palette); }).join("");
      var g = "<g";
      if (shape.transform) g += ' transform="' + esc(shape.transform) + '"';
      if (shape.opacity < 1) g += ' opacity="' + shape.opacity + '"';
      return g + ">" + inner + "</g>";
    }
    return "";
  }

  function compileLayer(layer, palette) {
    if (!layer.visible) return "";
    var body = layer.shapes.map(function (s) { return compileShape(s, palette); }).join("");
    if (layer.opacity < 1) return '<g opacity="' + layer.opacity + '">' + body + "</g>";
    return body;
  }

  function tileTransform(repeat, c, r) {
    var tw = repeat.tile[0];
    var th = repeat.tile[1];
    var ox = c * tw;
    var oy = r * th;
    if (repeat.type === "half-brick") ox += (r % 2) * (tw / 2);
    if (repeat.type === "half-drop") oy += (c % 2) * (th / 2);
    if (repeat.type === "mirror") {
      var sx = c % 2 ? -1 : 1;
      var sy = r % 2 ? -1 : 1;
      return "translate(" + (c * tw + tw / 2) + " " + (r * th + th / 2) + ") scale(" + sx + " " + sy + ")";
    }
    return "translate(" + (ox + tw / 2) + " " + (oy + th / 2) + ")";
  }

  function compile(doc) {
    var vb = doc.canvas.viewBox;
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(" ") + '">'];
    parts.push('<rect width="' + vb[2] + '" height="' + vb[3] + '" fill="' + doc.palette.ground + '"/>');
    if (doc.repeat && doc.layers[0]) {
      for (var r = 0; r < doc.repeat.rows; r++) {
        for (var c = 0; c < doc.repeat.cols; c++) {
          var pal = doc.palette;
          if ((c + r) % 2) pal = { ground: doc.palette.ground, figure: doc.palette.accent, accent: doc.palette.figure, ink2: doc.palette.ink2, ink3: doc.palette.ink3, ink4: doc.palette.ink4 };
          var motif = compileLayer(doc.layers[0], pal);
          parts.push('<g transform="' + tileTransform(doc.repeat, c, r) + '">' + motif + "</g>");
        }
      }
      for (var i = 1; i < doc.layers.length; i++) parts.push(compileLayer(doc.layers[i], doc.palette));
    } else {
      for (var j = 0; j < doc.layers.length; j++) parts.push(compileLayer(doc.layers[j], doc.palette));
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function motifPath(kind) {
    if (kind === "floral") return "M0 -70 C18 -70 28 -40 28 -20 C28 10 12 28 0 40 C-12 28 -28 10 -28 -20 C-28 -40 -18 -70 0 -70 Z";
    if (kind === "leaf") return "M0 -80 C40 -40 40 20 0 70 C-40 20 -40 -40 0 -80 Z";
    if (kind === "geometric") return "M0 -50 L43 -25 L43 25 L0 50 L-43 25 L-43 -25 Z";
    return "M-30 -20 Q0 -60 30 -20 Q50 10 0 40 Q-50 10 -30 -20 Z";
  }

  function buildLogo(brief) {
    var h = hash(brief || "mark");
    var name = (brief.match(/for\s+([A-Za-z][\w]+)/) || [, ""])[1] || pick(["Velora", "Aether", "North", "Quill", "Forge"], h);
    var kind = pick(["shield", "bird", "leaf", "gear", "wave"], h >> 3);
    var pal = paletteSet(h >> 5);
    var shapes = [];
    if (kind === "shield") {
      shapes.push({ id: "shield", type: "path", role: "figure", d: "M512 180 L780 280 L720 720 Q512 900 304 720 L244 280 Z" });
      shapes.push({ id: "shield-in", type: "path", role: "accent", fill: "accent", d: "M512 260 L620 320 L580 620 Q512 720 444 620 L404 320 Z" });
    } else if (kind === "bird") {
      shapes.push({ id: "wing-l", type: "path", role: "figure", d: "M512 260 C360 340 250 430 180 560 C310 500 410 520 500 590 C490 470 500 360 512 260 Z" });
      shapes.push({ id: "wing-r", type: "path", role: "figure", d: "M512 260 C664 340 774 430 844 560 C714 500 614 520 524 590 C534 470 524 360 512 260 Z" });
      shapes.push({ id: "body", type: "path", role: "accent", stroke: "accent", strokeWidth: 0, d: "M512 240 C490 430 496 560 512 700 C528 560 534 430 512 240 Z" });
    } else if (kind === "leaf") {
      shapes.push({ id: "leaf", type: "path", role: "figure", d: "M512 200 C700 320 780 520 512 820 C244 520 324 320 512 200 Z" });
      shapes.push({ id: "vein", type: "path", role: "accent", fill: "none", stroke: "accent", strokeWidth: 8, d: "M512 260 C560 400 560 560 512 740" });
    } else if (kind === "gear") {
      shapes.push({ id: "ring", type: "circle", role: "figure", cx: 512, cy: 480, r: 220 });
      shapes.push({ id: "hole", type: "circle", role: "ground", fill: "ground", cx: 512, cy: 480, r: 90 });
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2;
        shapes.push({ id: "tooth-" + i, type: "rect", role: "accent", x: 512 + Math.cos(a) * 260 - 28, y: 480 + Math.sin(a) * 260 - 28, w: 56, h: 56, rot: i * 45 });
      }
    } else {
      shapes.push({ id: "wave", type: "path", role: "figure", d: "M120 520 C280 360 420 360 512 480 C604 360 744 360 904 520 C760 600 600 640 512 600 C424 640 264 600 120 520 Z" });
      shapes.push({ id: "crest", type: "path", role: "accent", fill: "none", stroke: "accent", strokeWidth: 10, strokeLinecap: "round", d: "M200 540 C340 440 420 450 512 520 C604 450 684 440 824 540" });
    }
    shapes.push({ id: "word", type: "text", role: "figure", x: 512, y: 960, size: 48, text: name, anchor: "middle" });
    var doc = blank();
    doc.meta.name = name;
    doc.meta.category = "logo";
    doc.meta.skill = "logo";
    doc.meta.purpose = "brand";
    doc.meta.brief = brief || "";
    doc.palette = pal;
    doc.layers = [{ id: "mark", name: "Mark", visible: true, opacity: 1, shapes: shapes }];
    return validate(doc).document;
  }

  function buildTextile(brief, repeatType) {
    var h = hash(brief || "cloth");
    var kind = pick(["floral", "leaf", "geometric", "paisley"], h);
    var repeat = REPEATS.indexOf(repeatType) >= 0 ? repeatType : pick(REPEATS, h >> 2);
    var pal = paletteSet(h >> 4);
    var tile = 240;
    var doc = blank();
    doc.meta.name = kind + " " + repeat;
    doc.meta.category = "textile";
    doc.meta.skill = "textile";
    doc.meta.purpose = "surface";
    doc.meta.brief = brief || "";
    doc.palette = pal;
    doc.canvas.viewBox = [0, 0, tile * 3.5, tile * 3.5];
    doc.repeat = { type: repeat, tile: [tile, tile], cols: 4, rows: 4 };
    doc.layers = [{
      id: "motif",
      name: "Motif",
      visible: true,
      opacity: 1,
      shapes: [
        { id: "motif-path", type: "path", role: (h % 2 ? "accent" : "figure"), d: motifPath(kind) },
        { id: "motif-dot", type: "circle", role: "ground", fill: "ground", cx: 0, cy: 0, r: 12 }
      ]
    }];
    return validate(doc).document;
  }

  root.VeloraVxl = {
    validate: validate,
    compile: compile,
    buildLogo: buildLogo,
    buildTextile: buildTextile,
    blank: blank,
    slug: slug,
    esc: esc
  };
})(typeof window !== "undefined" ? window : globalThis);
