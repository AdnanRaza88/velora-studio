(function (root) {
  var TYPES = ["path", "circle", "ellipse", "rect", "line", "polygon", "text", "group", "blend"];
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
    var gradient = readGradient(raw.gradient);
    if (gradient) shape.gradient = gradient;
    var clip = safePath(raw.clip || "");
    if (clip) shape.clip = clip.slice(0, 4000);
    if (raw.stroke != null) shape.stroke = raw.stroke;
    if (raw.strokeWidth != null) shape.strokeWidth = Math.max(0, num(raw.strokeWidth, 0));
    if (raw.strokeLinecap) shape.strokeLinecap = String(raw.strokeLinecap).slice(0, 16);
    if (raw.strokeLinejoin) shape.strokeLinejoin = String(raw.strokeLinejoin).slice(0, 16);
    if (typeof raw.transform === "string") shape.transform = raw.transform.slice(0, 240);
    var rule = raw.fillRule || raw["fill-rule"];
    if (rule === "evenodd" || rule === "nonzero") shape.fillRule = rule;

    var profile = readProfile(raw.widthProfile, num(raw.strokeWidth, 8));
    if (profile) {
      shape.widthProfile = profile.samples;
      if (profile.name) shape.profile = profile.name;
    }
    var brush = readBrush(raw.brush, num(raw.strokeWidth, profile ? profile.samples[0] : 12));
    if (brush) shape.brush = brush;

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
      if (raw.rot != null) shape.rot = num(raw.rot, 0);
      var area = num(raw.w != null ? raw.w : raw.width, 0);
      if (area > 0) shape.w = area;
      var spine = safePath(raw.onPath || "");
      if (spine) shape.onPath = spine;
      if (raw.side != null) shape.side = num(raw.side, 1) < 0 ? -1 : 1;
    } else if (type === "group") {
      shape.children = [];
      var kids = Array.isArray(raw.children) ? raw.children : Array.isArray(raw.shapes) ? raw.shapes : [];
      for (var i = 0; i < kids.length && i < 64; i++) {
        var child = normalizeShape(kids[i], errors, path + ".children[" + i + "]", depth + 1);
        if (child) shape.children.push(child);
      }
    } else if (type === "blend") {
      shape.steps = Math.max(3, Math.min(24, Math.round(num(raw.steps, 5))));
      shape.from = normalizeShape(raw.from, errors, path + ".from", depth + 1);
      shape.to = normalizeShape(raw.to, errors, path + ".to", depth + 1);
      if (!shape.from || !shape.to) errors.push(path + " blend needs two shapes");
      var spine = safePath(raw.spine);
      if (spine) shape.spine = spine;
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

    if (raw.repeat) doc.repeat = normalizeRepeat(raw.repeat);
    else doc.repeat = null;

    doc.layers = [];
    var layers = Array.isArray(raw.layers) ? raw.layers : [];
    if (!layers.length) errors.push("at least one layer is required");
    for (var i = 0; i < layers.length && i < 16; i++) {
      var layer = layers[i] || {};
      var out = {
        id: typeof layer.id === "string" && layer.id ? layer.id.slice(0, 64) : "layer-" + (i + 1),
        name: String(layer.name || ("Layer " + (i + 1))).slice(0, 40),
        visible: layer.visible !== false,
        locked: layer.locked === true,
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


  var BRUSHES = {
    round: { angle: 0, roundness: 1 },
    flat: { angle: 30, roundness: 0.18 },
    oval: { angle: -40, roundness: 0.42 }
  };
  var PROFILE_NAMES = ["taper", "swell", "point"];
  var PROFILE_UNITS = {
    taper: [0.12, 0.55, 1, 0.4, 0.08],
    swell: [0.22, 0.85, 1, 0.45, 0.22],
    point: [0.06, 0.28, 1, 0.28, 0.06]
  };


  function readGradient(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    if (raw.type !== "linear") return null;
    var stops = Array.isArray(raw.stops) ? raw.stops : [];
    var out = [];
    for (var i = 0; i < stops.length && i < 8; i++) {
      var stop = stops[i] || {};
      var color = stop.color != null ? stop.color : stop.job;
      if (typeof color !== "string" || looksUnsafe(color) || color.length > 32) continue;
      if (!isHex(color) && ROLES.indexOf(color) < 0 && INK_KEYS.indexOf(color) < 0) continue;
      out.push({ offset: Math.max(0, Math.min(1, num(stop.offset, i / Math.max(1, stops.length - 1)))), color: color });
    }
    if (out.length < 2) return null;
    return {
      type: "linear",
      x1: num(raw.x1, 0),
      y1: num(raw.y1, 0),
      x2: num(raw.x2, 1),
      y2: num(raw.y2, 0),
      stops: out
    };
  }

  function readProfile(raw, baseWidth) {
    var base = baseWidth > 0 ? baseWidth : 8;
    if (typeof raw === "string") {
      var name = raw.toLowerCase();
      if (!PROFILE_UNITS[name]) return null;
      return {
        name: name,
        samples: PROFILE_UNITS[name].map(function (n) { return Math.round(n * base * 100) / 100; })
      };
    }
    if (!Array.isArray(raw) || !raw.length) return null;
    var samples = raw.slice(0, 16).map(function (n) {
      if (n && typeof n === "object") return Math.max(0, num(n.w != null ? n.w : n.width, 0));
      return Math.max(0, num(n, 0));
    });
    return { name: "", samples: samples };
  }

  function readBrush(raw, baseWidth) {
    if (raw == null || raw === "") return null;
    var name = "";
    var angle = null;
    var roundness = null;
    var size = null;
    if (typeof raw === "string") name = raw.toLowerCase();
    else if (typeof raw === "object") {
      name = String(raw.name || "").toLowerCase();
      if (raw.angle != null) angle = num(raw.angle, 0);
      if (raw.roundness != null) roundness = num(raw.roundness, 1);
      if (raw.size != null) size = num(raw.size, 0);
    }
    var spec = BRUSHES[name];
    if (!spec) return null;
    var base = baseWidth > 0 ? baseWidth : 12;
    return {
      name: name,
      angle: Math.max(-180, Math.min(180, angle == null ? spec.angle : angle)),
      roundness: Math.max(0.05, Math.min(1, roundness == null ? spec.roundness : roundness)),
      size: size > 0 ? size : base
    };
  }

  function profileWidth(shape, t) {
    var samples = shape.widthProfile;
    var base = num(shape.strokeWidth, 8);
    if (!samples || !samples.length) return base;
    if (samples.length === 1) return samples[0];
    var u = Math.max(0, Math.min(1, t)) * (samples.length - 1);
    var i = Math.floor(u);
    if (i >= samples.length - 1) i = samples.length - 2;
    var f = u - i;
    return samples[i] + (samples[i + 1] - samples[i]) * f;
  }

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function withNormals(points, closed) {
    var out = [];
    for (var i = 0; i < points.length; i++) {
      var prev = points[i === 0 ? (closed ? points.length - 1 : 0) : i - 1];
      var next = points[i === points.length - 1 ? (closed ? 0 : i) : i + 1];
      var dx = next.x - prev.x;
      var dy = next.y - prev.y;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      out.push({
        x: points[i].x,
        y: points[i].y,
        t: points[i].t,
        nx: -dy / len,
        ny: dx / len
      });
    }
    return out;
  }

  function sampleSegment(ax, ay, bx, by, cx, cy, dx, dy, steps, t0, t1, cubic) {
    var pts = [];
    for (var i = 0; i <= steps; i++) {
      var u = i / steps;
      var x;
      var y;
      if (!cubic) {
        x = ax + (bx - ax) * u;
        y = ay + (by - ay) * u;
      } else {
        var k = 1 - u;
        x = k * k * k * ax + 3 * k * k * u * bx + 3 * k * u * u * cx + u * u * u * dx;
        y = k * k * k * ay + 3 * k * k * u * by + 3 * k * u * u * cy + u * u * u * dy;
      }
      pts.push({ x: x, y: y, t: t0 + (t1 - t0) * u });
    }
    return pts;
  }

  function centerline(shape) {
    if (!shape) return [];
    if (shape.type === "line") {
      return withNormals(sampleSegment(shape.x1, shape.y1, shape.x2, shape.y2, 0, 0, 0, 0, 8, 0, 1, false), false);
    }
    if (shape.type !== "path" || !shape.d) return [];
    var tokens = String(shape.d).match(/[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) || [];
    var i = 0;
    var cx = 0;
    var cy = 0;
    var sx = 0;
    var sy = 0;
    var pts = [];
    var closed = false;
    function numAt() { return parseFloat(tokens[i++]); }
    function push(x, y, t) {
      if (!pts.length || Math.abs(pts[pts.length - 1].x - x) > 0.01 || Math.abs(pts[pts.length - 1].y - y) > 0.01) {
        pts.push({ x: x, y: y, t: t });
      }
    }
    var seg = 0;
    var segs = [];
    while (i < tokens.length) {
      var cmd = tokens[i++];
      if (!/[A-Za-z]/.test(cmd)) { i--; cmd = "L"; }
      var rel = cmd === cmd.toLowerCase();
      var op = cmd.toUpperCase();
      if (op === "M") {
        cx = (rel ? cx : 0) + numAt();
        cy = (rel ? cy : 0) + numAt();
        sx = cx; sy = cy;
        push(cx, cy, 0);
      } else if (op === "L") {
        var x = (rel ? cx : 0) + numAt();
        var y = (rel ? cy : 0) + numAt();
        segs.push(["L", cx, cy, x, y]);
        cx = x; cy = y;
      } else if (op === "H") {
        var hx = (rel ? cx : 0) + numAt();
        segs.push(["L", cx, cy, hx, cy]);
        cx = hx;
      } else if (op === "V") {
        var hy = (rel ? cy : 0) + numAt();
        segs.push(["L", cx, cy, cx, hy]);
        cy = hy;
      } else if (op === "C") {
        var c1x = (rel ? cx : 0) + numAt();
        var c1y = (rel ? cy : 0) + numAt();
        var c2x = (rel ? cx : 0) + numAt();
        var c2y = (rel ? cy : 0) + numAt();
        var ex = (rel ? cx : 0) + numAt();
        var ey = (rel ? cy : 0) + numAt();
        segs.push(["C", cx, cy, c1x, c1y, c2x, c2y, ex, ey]);
        cx = ex; cy = ey;
      } else if (op === "Z") {
        segs.push(["L", cx, cy, sx, sy]);
        cx = sx; cy = sy;
        closed = true;
      } else {
        break;
      }
    }
    if (!segs.length) return withNormals(pts, closed);
    var span = 1 / segs.length;
    pts = [{ x: segs[0][1], y: segs[0][2], t: 0 }];
    segs.forEach(function (s, idx) {
      var t0 = idx * span;
      var t1 = (idx + 1) * span;
      var chunk;
      if (s[0] === "C") chunk = sampleSegment(s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], 6, t0, t1, true);
      else chunk = sampleSegment(s[1], s[2], s[3], s[4], 0, 0, 0, 0, 4, t0, t1, false);
      chunk.forEach(function (pt, n) { if (n) pts.push(pt); });
    });
    return withNormals(pts, closed);
  }

  function strokeHalf(shape, p) {
    var along = profileWidth(shape, p.t);
    if (!shape.brush) return along / 2;
    var size = shape.brush.size > 0 ? shape.brush.size : along;
    if (shape.widthProfile && shape.widthProfile.length >= 2) {
      var base = num(shape.strokeWidth, size) || size;
      size = size * (along / base);
    }
    var a = size / 2;
    var b = a * shape.brush.roundness;
    var phi = Math.atan2(p.ny, p.nx) - shape.brush.angle * Math.PI / 180;
    var cs = Math.cos(phi);
    var sn = Math.sin(phi);
    return Math.sqrt(a * a * cs * cs + b * b * sn * sn);
  }

  function outlinePath(shape) {
    var line = centerline(shape);
    var hasProfile = shape.widthProfile && shape.widthProfile.length >= 2;
    if (line.length < 2 || (!hasProfile && !shape.brush)) return "";
    var closed = /[Zz]/.test(shape.d || "");
    var left = [];
    var right = [];
    line.forEach(function (p) {
      var half = strokeHalf(shape, p);
      left.push([p.x + p.nx * half, p.y + p.ny * half]);
      right.push([p.x - p.nx * half, p.y - p.ny * half]);
    });
    function fmt(pair) { return round2(pair[0]) + " " + round2(pair[1]); }
    var d = "M" + fmt(left[0]);
    for (var i = 1; i < left.length; i++) d += " L" + fmt(left[i]);
    if (!closed) {
      var end = line[line.length - 1];
      var start = line[0];
      var er = strokeHalf(shape, end);
      var sr = strokeHalf(shape, start);
      for (var a = 1; a <= 4; a++) {
        var ang = Math.PI * a / 4;
        var cs = Math.cos(ang);
        var sn = Math.sin(ang);
        d += " L" + round2(end.x + (end.nx * cs - end.ny * sn) * er) + " " + round2(end.y + (end.ny * cs + end.nx * sn) * er);
      }
    }
    for (var r = right.length - 1; r >= 0; r--) d += " L" + fmt(right[r]);
    if (!closed) {
      var st = line[0];
      var rad = strokeHalf(shape, st);
      for (var b = 1; b <= 4; b++) {
        var ang2 = Math.PI * b / 4;
        var cs2 = Math.cos(ang2);
        var sn2 = Math.sin(ang2);
        d += " L" + round2(st.x + (-st.nx * cs2 - st.ny * sn2) * rad) + " " + round2(st.y + (-st.ny * cs2 + st.nx * sn2) * rad);
      }
    }
    return d + " Z";
  }

  function wrapLines(value, size, width) {
    var words = String(value || "").split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    if (!(width > 0)) return [String(value || "")];
    var limit = Math.max(1, width);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var next = line ? line + " " + word : word;
      if (next.length * size * 0.55 > limit && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, 8);
  }

  function clipPaint(shape) {
    var d = safePath(shape.clip || "");
    if (!d) return null;
    var id = "vc_" + String(shape.id || "s").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    return { id: id, def: '<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>' };
  }

  function gradientPaint(shape, palette) {
    var g = shape.gradient;
    if (!g || g.type !== "linear" || !g.stops || g.stops.length < 2) return null;
    var id = "vg_" + String(shape.id || "s").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    var stops = g.stops.map(function (stop) {
      var color = paint(stop.color, palette) || palette.figure;
      var off = Math.max(0, Math.min(1, num(stop.offset, 0)));
      return '<stop offset="' + off + '" stop-color="' + color + '"/>';
    }).join("");
    var def = '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + num(g.x1, 0) + '" y1="' + num(g.y1, 0) + '" x2="' + num(g.x2, 1) + '" y2="' + num(g.y2, 0) + '">' + stops + '</linearGradient>';
    return { id: id, def: def };
  }

  function styleAttrs(shape, palette) {
    var painted = gradientPaint(shape, palette);
    var fill = painted ? ("url(#" + painted.id + ")") : paint(shape.fill != null ? shape.fill : shape.role, palette);
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
    var painted = gradientPaint(shape, palette);
    var clipped = clipPaint(shape);
    var defs = (painted ? painted.def : "") + (clipped ? clipped.def : "");
    var attrs = styleAttrs(shape, palette);
    var wrap = function (tag) {
      var body = clipped ? '<g clip-path="url(#' + clipped.id + ')">' + tag + "</g>" : tag;
      return defs ? "<g><defs>" + defs + "</defs>" + body + "</g>" : body;
    };
    if (shape.type === "path" && ((shape.widthProfile && shape.widthProfile.length >= 2) || shape.brush)) {
      var ribbon = outlinePath(shape);
      if (ribbon) {
        var ink = paint(shape.stroke, palette) || paint(shape.fill != null ? shape.fill : shape.role, palette) || palette.figure;
        var ribbonAttrs = ' fill="' + ink + '"';
        if (shape.opacity != null && shape.opacity < 1) ribbonAttrs += ' opacity="' + shape.opacity + '"';
        return wrap('<path d="' + ribbon + '"' + ribbonAttrs + "/>");
      }
    }
    if (shape.type === "path") return wrap('<path d="' + shape.d + '"' + attrs + "/>");
    if (shape.type === "circle") return wrap('<circle cx="' + shape.cx + '" cy="' + shape.cy + '" r="' + shape.r + '"' + attrs + "/>");
    if (shape.type === "ellipse") return wrap('<ellipse cx="' + shape.cx + '" cy="' + shape.cy + '" rx="' + shape.rx + '" ry="' + shape.ry + '"' + attrs + "/>");
    if (shape.type === "rect") {
      var body = '<rect x="' + (-shape.w / 2) + '" y="' + (-shape.h / 2) + '" width="' + shape.w + '" height="' + shape.h + '" rx="' + (shape.rx || 0) + '"' + attrs + "/>";
      var t = "translate(" + (shape.x + shape.w / 2) + " " + (shape.y + shape.h / 2) + ")";
      if (shape.rot) t += " rotate(" + shape.rot + ")";
      return wrap('<g transform="' + t + '">' + body + "</g>");
    }
    if (shape.type === "line") {
      var lineAttrs = attrs.replace(' fill="' + palette.figure + '"', ' fill="none"');
      if (lineAttrs.indexOf("stroke=") < 0) lineAttrs += ' stroke="' + palette.figure + '" stroke-width="' + num(shape.strokeWidth, 2) + '"';
      return wrap('<line x1="' + shape.x1 + '" y1="' + shape.y1 + '" x2="' + shape.x2 + '" y2="' + shape.y2 + '"' + lineAttrs + "/>");
    }
    if (shape.type === "polygon") {
      var pts = shape.points.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
      return wrap('<polygon points="' + pts + '"' + attrs + "/>");
    }
    if (shape.type === "text" && shape.onPath) {
      var pid = "tp-" + String(shape.id || "t").replace(/[^A-Za-z0-9_-]/g, "");
      var offset = shape.anchor === "start" ? "0%" : shape.anchor === "end" ? "100%" : "50%";
      var lift = (shape.side === -1 ? 0.65 : -0.2) * shape.size;
      var on = '<defs><path id="' + pid + '" d="' + shape.onPath + '"/></defs>';
      on += '<text text-anchor="' + shape.anchor + '" font-size="' + shape.size + '" font-family="Georgia,serif"' + attrs + ">";
      on += '<textPath href="#' + pid + '" xlink:href="#' + pid + '" startOffset="' + offset + '" dy="' + round2(lift) + '">' + esc(shape.text) + "</textPath></text>";
      return wrap(on);
    }
    if (shape.type === "text") {
      var lines = wrapLines(shape.text, shape.size, shape.w);
      var body = lines.map(function (line, i) {
        if (!i) return esc(line);
        return '<tspan x="' + shape.x + '" dy="' + round2(shape.size * 1.2) + '">' + esc(line) + "</tspan>";
      }).join("");
      var text = '<text x="' + shape.x + '" y="' + shape.y + '" text-anchor="' + shape.anchor + '" font-size="' + shape.size + '" font-family="Georgia,serif"' + attrs + ">" + body + "</text>";
      if (shape.rot) return wrap('<g transform="rotate(' + shape.rot + " " + shape.x + " " + shape.y + ')">' + text + "</g>");
      return wrap(text);
    }
    if (shape.type === "blend") {
      var blended = (typeof VeloraBlend !== "undefined") ? VeloraBlend.stepsOf(shape, palette) : [];
      return wrap("<g>" + blended.map(function (step) { return compileShape(step, palette); }).join("") + "</g>");
    }
    if (shape.type === "group") {
      var inner = shape.children.map(function (c) { return compileShape(c, palette); }).join("");
      var g = "<g";
      if (shape.transform) g += ' transform="' + esc(shape.transform) + '"';
      if (shape.opacity < 1) g += ' opacity="' + shape.opacity + '"';
      return wrap(g + ">" + inner + "</g>");
    }
    return "";
  }

  function compileLayer(layer, palette) {
    if (!layer.visible) return "";
    var body = layer.shapes.map(function (s) { return compileShape(s, palette); }).join("");
    if (layer.opacity < 1) return '<g opacity="' + layer.opacity + '">' + body + "</g>";
    return body;
  }

  function readPair(raw, fallback) {
    if (raw == null) return fallback.slice();
    if (typeof raw === "string") raw = raw.split(/[\s,]+/);
    if (!Array.isArray(raw)) return fallback.slice();
    return [num(raw[0], fallback[0]), num(raw[1], fallback[1])];
  }

  function normalizeRepeat(raw) {
    var rt = raw && raw.type;
    if (REPEATS.indexOf(rt) < 0) rt = "block";
    var tile = raw && raw.tile ? raw.tile : [240, 240];
    if (typeof tile === "string") tile = tile.split(/[\s,]+/);
    var offset = readPair(raw && raw.offset, [0, 0]);
    var gap = readPair(raw && raw.gap, [0, 0]);
    return {
      type: rt,
      tile: [Math.max(8, num(tile[0], 240)), Math.max(8, num(tile[1], 240))],
      cols: Math.max(1, Math.min(12, num(raw && raw.cols, 4))),
      rows: Math.max(1, Math.min(12, num(raw && raw.rows, 4))),
      offset: [round2(offset[0]), round2(offset[1])],
      gap: [Math.max(0, round2(gap[0])), Math.max(0, round2(gap[1]))],
      scale: Math.max(0.05, Math.min(8, round2(num(raw && raw.scale, 1)))),
      rotate: round2(num(raw && raw.rotate, 0))
    };
  }

  function tileTransform(repeat, c, r) {
    var gapX = repeat.gap ? repeat.gap[0] : 0;
    var gapY = repeat.gap ? repeat.gap[1] : 0;
    var stepX = repeat.tile[0] + gapX;
    var stepY = repeat.tile[1] + gapY;
    var ox = (repeat.offset ? repeat.offset[0] : 0) + c * stepX;
    var oy = (repeat.offset ? repeat.offset[1] : 0) + r * stepY;
    if (repeat.type === "half-brick") ox += (r % 2) * (stepX / 2);
    if (repeat.type === "half-drop") oy += (c % 2) * (stepY / 2);
    var transform = "translate(" + (ox + stepX / 2) + " " + (oy + stepY / 2) + ")";
    if (repeat.rotate) transform += " rotate(" + repeat.rotate + ")";
    var sc = repeat.scale == null ? 1 : repeat.scale;
    if (repeat.type === "mirror") {
      transform += " scale(" + ((c % 2 ? -1 : 1) * sc) + " " + ((r % 2 ? -1 : 1) * sc) + ")";
    } else if (sc !== 1) {
      transform += " scale(" + sc + ")";
    }
    return transform;
  }

  function compile(doc) {
    var vb = doc.canvas.viewBox;
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + vb.join(" ") + '">'];
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
    doc.repeat = { type: repeat, tile: [tile, tile], cols: 4, rows: 4, offset: [0, 0], gap: [0, 0], scale: 1, rotate: 0 };
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
    normalizeRepeat: normalizeRepeat,
    buildLogo: buildLogo,
    buildTextile: buildTextile,
    blank: blank,
    slug: slug,
    esc: esc,
    centerline: centerline,
    profileWidth: profileWidth,
    profiles: PROFILE_NAMES.slice(),
    profileUnits: PROFILE_UNITS,
    brushes: Object.keys(BRUSHES),
    brushSpecs: BRUSHES
  };
})(typeof window !== "undefined" ? window : globalThis);
