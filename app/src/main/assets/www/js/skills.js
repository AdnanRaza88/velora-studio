(function (root) {
  var TOOL_NAME = "emit_vxl";

  var PACKS = {
    logo: {
      id: "logo",
      title: "Logo",
      system: "You are the Velora logo skill. Call emit_vxl once. category must be logo. Use 1 to 3 inks (ground, figure, accent). Prefer a strong silhouette: emblem, geometric mark, or wordmark. Few shapes. No raster. viewBox 0 0 1024 1024. Name the mark from the brief. style is geometric, wordmark, emblem, or organic. Line art sets strokeProfile to taper, swell, or point. The app resolves the named profile. Do not emit raw width samples. Calligraphic marks set brush to round, flat, or oval. The app resolves the nib. Do not emit a raster brush."
    },
    textile: {
      id: "textile",
      title: "Textile",
      system: "You are the Velora textile skill. Call emit_vxl once. category must be textile. Emit a motif plus repeat. Repeat type is block, half-drop, half-brick, or mirror. Motif is drawn around the tile origin so seams close. Limit inks to ground, figure, accent. Do not explode the motif into noise. Tile size is usually 240. Line art sets strokeProfile to taper, swell, or point. The app resolves the named profile. Do not emit raw width samples. Calligraphic marks set brush to round, flat, or oval. The app resolves the nib. Do not emit a raster brush."
    },
    character: {
      id: "character",
      title: "Character",
      system: "You are the Velora character skill. Call emit_vxl once. category must be character. Group parts by name: head, body, limbs. Simple fills first. Do not emit thousands of micro-paths. Palette jobs are figure, ground, accent. viewBox 0 0 1024 1024. Line art sets strokeProfile to taper, swell, or point. The app resolves the named profile. Do not emit raw width samples. Calligraphic marks set brush to round, flat, or oval. The app resolves the nib. Do not emit a raster brush."
    },
    icon: {
      id: "icon",
      title: "Icon",
      system: "You are the Velora icon skill. Call emit_vxl once. category must be icon. Square viewBox matching grid 24, 32, or 48. One or two inks. Paths must read at small size. No text unless the brief is a glyph. No raster. Line art sets strokeProfile to taper, swell, or point. The app resolves the named profile. Do not emit raw width samples. Calligraphic marks set brush to round, flat, or oval. The app resolves the nib. Do not emit a raster brush."
    }
  };

  function hash(text) {
    var h = 2166136261;
    var s = String(text || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function route(brief, hint) {
    if (PACKS[hint]) return hint;
    var t = String(brief || "").toLowerCase();
    if (/\b(cloth|textile|repeat|print|fabric|motif)\b/.test(t)) return "textile";
    if (/\b(icon|glyph|favicon|pictogram)\b/.test(t)) return "icon";
    if (/\b(character|mascot|figure|person|creature)\b/.test(t)) return "character";
    if (/\b(logo|mark|wordmark|emblem|brand)\b/.test(t)) return "logo";
    return "logo";
  }

  function styleOf(brief) {
    var t = String(brief || "").toLowerCase();
    if (/\bwordmark|type|letter\b/.test(t)) return "wordmark";
    if (/\borganic|brush|hand\b/.test(t)) return "organic";
    if (/\bgeometric|grid|hex\b/.test(t)) return "geometric";
    return "emblem";
  }

  function motifOf(brief, h) {
    var t = String(brief || "").toLowerCase();
    if (t.indexOf("leaf") >= 0) return "leaf";
    if (t.indexOf("paisley") >= 0) return "paisley";
    if (t.indexOf("geo") >= 0) return "geometric";
    if (t.indexOf("floral") >= 0 || t.indexOf("flower") >= 0) return "floral";
    return ["floral", "leaf", "geometric", "paisley"][h % 4];
  }

  function nameOf(brief, skill) {
    var raw = String(brief || "").replace(/\s+/g, " ").trim();
    if (!raw) return PACKS[skill].title;
    return raw.slice(0, 42);
  }

  function argumentsFromBrief(brief, skillId, repeatType) {
    var h = hash(brief);
    var skill = PACKS[skillId] ? skillId : "logo";
    var args = {
      category: skill,
      name: nameOf(brief, skill),
      brief: String(brief || "").slice(0, 500),
      viewBox: skill === "icon" ? [0, 0, 48, 48] : (skill === "textile" ? [0, 0, 840, 840] : [0, 0, 1024, 1024]),
      palette: {
        ground: "#f6f1e8",
        figure: "#1b3358",
        accent: "#355e57"
      },
      inkCount: 2
    };
    if (skill === "logo") args.style = styleOf(brief);
    if (skill === "textile") {
      args.motif = motifOf(brief, h);
      args.repeat = {
        type: ["block", "half-drop", "half-brick", "mirror"].indexOf(repeatType) >= 0 ? repeatType : "half-drop",
        tile: [240, 240],
        cols: 4,
        rows: 4
      };
    }
    if (skill === "character") args.parts = ["head", "body", "limbs"];
    if (skill === "icon") args.grid = 48;
    var profile = profileOf(brief);
    if (!profile && args.style === "organic") profile = "taper";
    if (profile) args.strokeProfile = profile;
    var brush = brushOf(brief);
    if (brush) args.brush = brush;
    return args;
  }

  function brushOf(brief) {
    var t = String(brief || "").toLowerCase();
    if (/\boval\b/.test(t) && /\bbrush|nib|calligraph/.test(t)) return "oval";
    if (/\bround brush\b/.test(t)) return "round";
    if (/\bflat|calligraph|nib|brush\b/.test(t)) return "flat";
    return "";
  }

  function profileOf(brief) {
    var t = String(brief || "").toLowerCase();
    if (/\bpoint(ed)?\b/.test(t)) return "point";
    if (/\bswell\b/.test(t)) return "swell";
    if (/\btaper|stroke|calligraph|line art\b/.test(t)) return "taper";
    return "";
  }

  function expand(args) {
    var skill = PACKS[args.category] ? args.category : "logo";
    var doc;
    if (skill === "textile") {
      doc = VeloraVxl.buildTextile(args.brief, args.repeat && args.repeat.type);
    } else if (skill === "logo") {
      doc = VeloraVxl.buildLogo(args.brief);
    } else if (skill === "character") {
      doc = characterDoc(args);
    } else {
      doc = iconDoc(args);
    }
    doc.meta.name = args.name || doc.meta.name;
    doc.meta.brief = args.brief || doc.meta.brief;
    doc.meta.skill = skill;
    if (args.palette && args.palette.figure) doc.palette = args.palette;
    if (args.strokeProfile) stampProfile(doc, args.strokeProfile);
    if (args.brush) stampBrush(doc, args.brush);
    var checked = VeloraVxl.validate(doc);
    if (!checked.ok) return checked;
    return { ok: true, document: checked.document, errors: [], warnings: checked.warnings || [] };
  }


  function stampProfile(doc, name) {
    var stamped = false;
    (doc.layers || []).forEach(function (layer) {
      (layer.shapes || []).forEach(function (shape) {
        if (stamped || shape.type !== "path") return;
        if (shape.fill && shape.fill !== "none") return;
        if (!shape.stroke || shape.stroke === "none") return;
        shape.widthProfile = name;
        shape.strokeLinecap = "round";
        if (!shape.strokeWidth) shape.strokeWidth = 10;
        stamped = true;
      });
    });
    if (stamped) return;
    var box = doc.canvas && doc.canvas.viewBox ? doc.canvas.viewBox : [0, 0, 1024, 1024];
    var x0 = box[0] + box[2] * 0.22;
    var x1 = box[0] + box[2] * 0.78;
    var y = box[1] + box[3] * 0.62;
    var mid = (x0 + x1) / 2;
    var lift = box[3] * 0.12;
    var layer = doc.layers && doc.layers[0];
    if (!layer) return;
    layer.shapes.push({
      id: "profile-line",
      type: "path",
      role: "accent",
      fill: "none",
      stroke: "accent",
      strokeWidth: Math.max(2, Math.round(box[2] * 0.012)),
      strokeLinecap: "round",
      widthProfile: name,
      d: "M" + Math.round(x0) + " " + Math.round(y) + " C" + Math.round(mid) + " " + Math.round(y - lift) + " " + Math.round(mid) + " " + Math.round(y - lift) + " " + Math.round(x1) + " " + Math.round(y)
    });
  }

  function stampBrush(doc, name) {
    var stamped = false;
    (doc.layers || []).forEach(function (layer) {
      (layer.shapes || []).forEach(function (shape) {
        if (stamped || shape.type !== "path") return;
        if (shape.fill && shape.fill !== "none" && !shape.widthProfile) return;
        shape.brush = name;
        shape.strokeLinecap = "round";
        if (!shape.stroke || shape.stroke === "none") shape.stroke = shape.role || "accent";
        if (shape.fill == null) shape.fill = "none";
        if (!shape.strokeWidth) shape.strokeWidth = 14;
        stamped = true;
      });
    });
    if (stamped) return;
    var box = doc.canvas && doc.canvas.viewBox ? doc.canvas.viewBox : [0, 0, 1024, 1024];
    var x0 = box[0] + box[2] * 0.2;
    var x1 = box[0] + box[2] * 0.8;
    var y0 = box[1] + box[3] * 0.7;
    var y1 = box[1] + box[3] * 0.34;
    var layer = doc.layers && doc.layers[0];
    if (!layer) return;
    layer.shapes.push({
      id: "brush-line",
      type: "path",
      role: "accent",
      fill: "none",
      stroke: "accent",
      strokeWidth: Math.max(2, Math.round(box[2] * 0.02)),
      strokeLinecap: "round",
      brush: name,
      d: "M" + Math.round(x0) + " " + Math.round(y0) + " C" + Math.round(x0 + box[2] * 0.2) + " " + Math.round(y1) + " " + Math.round(x1 - box[2] * 0.15) + " " + Math.round(y0) + " " + Math.round(x1) + " " + Math.round(y1)
    });
  }

  function characterDoc(args) {
    var doc = VeloraVxl.blank();
    doc.meta.name = args.name;
    doc.meta.category = "character";
    doc.meta.skill = "character";
    doc.meta.purpose = "character";
    doc.meta.brief = args.brief || "";
    doc.canvas.viewBox = [0, 0, 1024, 1024];
    doc.layers = [
      {
        id: "body",
        name: "Body",
        visible: true,
        opacity: 1,
        shapes: [
          { id: "torso", type: "rect", role: "figure", x: 392, y: 430, w: 240, h: 280, rot: 0 },
          { id: "limb-l", type: "rect", role: "accent", x: 300, y: 470, w: 70, h: 220 },
          { id: "limb-r", type: "rect", role: "accent", x: 654, y: 470, w: 70, h: 220 }
        ]
      },
      {
        id: "head",
        name: "Head",
        visible: true,
        opacity: 1,
        shapes: [
          { id: "skull", type: "circle", role: "figure", cx: 512, cy: 300, r: 120 },
          { id: "eye-l", type: "circle", role: "ground", fill: "ground", cx: 472, cy: 292, r: 14 },
          { id: "eye-r", type: "circle", role: "ground", fill: "ground", cx: 552, cy: 292, r: 14 }
        ]
      }
    ];
    return doc;
  }

  function iconDoc(args) {
    var doc = VeloraVxl.blank();
    var grid = args.grid === 24 || args.grid === 32 ? args.grid : 48;
    doc.meta.name = args.name;
    doc.meta.category = "icon";
    doc.meta.skill = "icon";
    doc.meta.purpose = "icon";
    doc.meta.brief = args.brief || "";
    doc.canvas.viewBox = [0, 0, grid, grid];
    var m = grid / 48;
    doc.layers = [{
      id: "glyph",
      name: "Glyph",
      visible: true,
      opacity: 1,
      shapes: [
        { id: "plate", type: "rect", role: "figure", x: 6 * m, y: 6 * m, w: 36 * m, h: 36 * m },
        { id: "cut", type: "path", role: "ground", fill: "ground", d: "M" + (16 * m) + " " + (14 * m) + " L" + (34 * m) + " " + (24 * m) + " L" + (16 * m) + " " + (34 * m) + " Z" }
      ]
    }];
    return doc;
  }

  var HEX = /^#[0-9A-Fa-f]{6}$/;
  var STYLES = ["geometric", "wordmark", "emblem", "organic"];
  var MOTIFS = ["floral", "leaf", "geometric", "paisley"];
  var REPEATS = ["block", "half-drop", "half-brick", "mirror"];
  var GRIDS = [24, 32, 48];
  var PROFILES = ["taper", "swell", "point"];
  var BRUSHES = ["round", "flat", "oval"];
  var ARG_KEYS = ["category", "name", "brief", "viewBox", "palette", "style", "motif", "repeat", "grid", "parts", "inkCount", "strokeProfile", "brush"];

  function toolSpec() {
    return {
      name: TOOL_NAME,
      description: "Emit a Velora VXL 1 design. The app compiles geometry. Do not emit SVG, pixels, or base64.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["category", "name", "viewBox", "palette"],
        properties: {
          category: { type: "string", enum: ["logo", "textile", "character", "icon"] },
          name: { type: "string", maxLength: 80 },
          brief: { type: "string", maxLength: 500 },
          viewBox: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4 },
          palette: {
            type: "object",
            required: ["ground", "figure", "accent"],
            properties: {
              ground: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
              figure: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
              accent: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
              ink2: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" }
            }
          },
          style: { type: "string", enum: STYLES },
          inkCount: { type: "integer", minimum: 1, maximum: 4 },
          motif: { type: "string", enum: MOTIFS },
          repeat: {
            type: "object",
            required: ["type", "tile"],
            properties: {
              type: { type: "string", enum: REPEATS },
              tile: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
              cols: { type: "integer", minimum: 1, maximum: 8 },
              rows: { type: "integer", minimum: 1, maximum: 8 }
            }
          },
          grid: { type: "integer", enum: GRIDS },
          parts: { type: "array", items: { type: "string" }, maxItems: 8 },
          strokeProfile: { type: "string", enum: PROFILES },
          brush: { type: "string", enum: BRUSHES }
        }
      }
    };
  }

  function hexInk(value) {
    var ink = String(value || "").trim();
    return HEX.test(ink) ? ink.toLowerCase() : "";
  }

  function lockArgs(raw) {
    var errors = [];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ok: false, arguments: null, errors: ["emit_vxl arguments missing"] };
    }
    Object.keys(raw).forEach(function (key) {
      if (ARG_KEYS.indexOf(key) < 0) errors.push("unknown field " + key);
    });
    if (!PACKS[raw.category]) errors.push("category");
    var name = String(raw.name || "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 80) errors.push("name");
    var brief = raw.brief == null ? "" : String(raw.brief);
    if (brief.length > 500) errors.push("brief");
    var box = raw.viewBox;
    if (!Array.isArray(box) || box.length !== 4 || box.some(function (n) { return typeof n !== "number" || !isFinite(n); })) {
      errors.push("viewBox");
    }
    var palette = raw.palette;
    var inks = {};
    if (!palette || typeof palette !== "object") errors.push("palette");
    else {
      ["ground", "figure", "accent"].forEach(function (job) {
        var ink = hexInk(palette[job]);
        if (!ink) errors.push("palette." + job);
        else inks[job] = ink;
      });
      if (palette.ink2 != null) {
        var extra = hexInk(palette.ink2);
        if (!extra) errors.push("palette.ink2");
        else inks.ink2 = extra;
      }
    }
    var cleaned = {
      category: PACKS[raw.category] ? raw.category : "",
      name: name.slice(0, 80),
      brief: brief.slice(0, 500),
      viewBox: Array.isArray(box) ? box.slice(0, 4) : [],
      palette: inks
    };
    if (raw.style != null) {
      if (STYLES.indexOf(raw.style) < 0) errors.push("style");
      else cleaned.style = raw.style;
    }
    if (raw.motif != null) {
      if (MOTIFS.indexOf(raw.motif) < 0) errors.push("motif");
      else cleaned.motif = raw.motif;
    }
    if (raw.inkCount != null) {
      var count = raw.inkCount;
      if (typeof count !== "number" || count !== Math.floor(count) || count < 1 || count > 4) errors.push("inkCount");
      else cleaned.inkCount = count;
    }
    if (raw.grid != null) {
      if (GRIDS.indexOf(raw.grid) < 0) errors.push("grid");
      else cleaned.grid = raw.grid;
    }
    if (raw.strokeProfile != null) {
      if (PROFILES.indexOf(raw.strokeProfile) < 0) errors.push("strokeProfile");
      else cleaned.strokeProfile = raw.strokeProfile;
    }
    if (raw.brush != null) {
      if (BRUSHES.indexOf(raw.brush) < 0) errors.push("brush");
      else cleaned.brush = raw.brush;
    }
    if (raw.parts != null) {
      if (!Array.isArray(raw.parts) || raw.parts.length > 8 || raw.parts.some(function (part) { return typeof part !== "string" || !part || part.length > 40; })) {
        errors.push("parts");
      } else cleaned.parts = raw.parts.slice(0, 8);
    }
    if (raw.repeat != null) {
      var repeat = raw.repeat;
      var tile = repeat && repeat.tile;
      var type = repeat && repeat.type;
      if (!repeat || REPEATS.indexOf(type) < 0 || !Array.isArray(tile) || tile.length !== 2 || tile.some(function (n) { return typeof n !== "number" || !isFinite(n) || n <= 0; })) {
        errors.push("repeat");
      } else {
        cleaned.repeat = { type: type, tile: tile.slice(0, 2) };
        ["cols", "rows"].forEach(function (axis) {
          if (repeat[axis] == null) return;
          var span = repeat[axis];
          if (typeof span !== "number" || span !== Math.floor(span) || span < 1 || span > 8) errors.push("repeat." + axis);
          else cleaned.repeat[axis] = span;
        });
      }
    }
    if (cleaned.category === "textile" && !cleaned.repeat) errors.push("repeat");
    if (cleaned.category === "icon" && cleaned.grid == null) errors.push("grid");
    if (errors.length) return { ok: false, arguments: null, errors: errors };
    return { ok: true, arguments: cleaned, errors: [] };
  }

  function accept(raw) {
    var locked = lockArgs(raw);
    if (!locked.ok) return locked;
    var expanded = expand(locked.arguments);
    if (!expanded.ok) return { ok: false, arguments: locked.arguments, errors: expanded.errors || ["expand"] };
    var checked = root.VeloraVxl.validate(expanded.document);
    if (!checked.ok) return { ok: false, arguments: locked.arguments, errors: checked.errors || ["vxl"] };
    return {
      ok: true,
      arguments: locked.arguments,
      document: checked.document,
      errors: [],
      warnings: checked.warnings || expanded.warnings || []
    };
  }

  function compose(brief, hint, repeatType) {
    var skill = route(brief, hint);
    var args = argumentsFromBrief(brief, skill, repeatType);
    var expanded = expand(args);
    return {
      skill: skill,
      tool: TOOL_NAME,
      system: PACKS[skill].system,
      arguments: args,
      ok: expanded.ok,
      document: expanded.document || null,
      errors: expanded.errors || [],
      warnings: expanded.warnings || []
    };
  }

  root.VeloraSkills = {
    tool: TOOL_NAME,
    packs: PACKS,
    route: route,
    argumentsFromBrief: argumentsFromBrief,
    toolSpec: toolSpec,
    lockArgs: lockArgs,
    accept: accept,
    expand: expand,
    compose: compose
  };
})(typeof window !== "undefined" ? window : globalThis);
