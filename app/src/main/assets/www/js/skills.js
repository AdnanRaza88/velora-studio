(function (root) {
  var TOOL_NAME = "emit_vxl";

  var PACKS = {
    logo: {
      id: "logo",
      title: "Logo",
      system: "You are the Velora logo skill. Call emit_vxl once. category must be logo. Use 1 to 3 inks (ground, figure, accent). Prefer a strong silhouette: emblem, geometric mark, or wordmark. Few shapes. No raster. viewBox 0 0 1024 1024. Name the mark from the brief. style is geometric, wordmark, emblem, or organic."
    },
    textile: {
      id: "textile",
      title: "Textile",
      system: "You are the Velora textile skill. Call emit_vxl once. category must be textile. Emit a motif plus repeat. Repeat type is block, half-drop, half-brick, or mirror. Motif is drawn around the tile origin so seams close. Limit inks to ground, figure, accent. Do not explode the motif into noise. Tile size is usually 240."
    },
    character: {
      id: "character",
      title: "Character",
      system: "You are the Velora character skill. Call emit_vxl once. category must be character. Group parts by name: head, body, limbs. Simple fills first. Do not emit thousands of micro-paths. Palette jobs are figure, ground, accent. viewBox 0 0 1024 1024."
    },
    icon: {
      id: "icon",
      title: "Icon",
      system: "You are the Velora icon skill. Call emit_vxl once. category must be icon. Square viewBox matching grid 24, 32, or 48. One or two inks. Paths must read at small size. No text unless the brief is a glyph. No raster."
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
    return args;
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
    var checked = VeloraVxl.validate(doc);
    if (!checked.ok) return checked;
    return { ok: true, document: checked.document, errors: [], warnings: checked.warnings || [] };
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
    expand: expand,
    compose: compose
  };
})(typeof window !== "undefined" ? window : globalThis);
