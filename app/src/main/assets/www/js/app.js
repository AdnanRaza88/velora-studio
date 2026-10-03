(function () {
  var $ = document.getElementById("app");
  var nav = document.getElementById("nav");
  var state = { route: "studio", type: "logo", repeat: "half-drop", doc: null, svg: "", attachment: null, sel: "", also: [], tool: "select", layer: "", history: [], future: [] };
  var REMOTE = { openai: 1, anthropic: 1, gemini: 1, openrouter: 1 };

  function theme() { return localStorage.getItem("velora.theme") || "light"; }
  document.documentElement.dataset.theme = theme();

  function providers() {
    try { return JSON.parse(localStorage.getItem("velora.providers") || "{}"); }
    catch (e) { return {}; }
  }
  function saveProviders(p) { localStorage.setItem("velora.providers", JSON.stringify(p)); }

  function pathName(active) {
    if (!active || active === "offline" || active === "local" || active === "needle") return "needle";
    return active;
  }

  function setRoute(r) {
    state.route = r;
    var btns = nav.querySelectorAll("[data-route]");
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute("data-route") === r);
    if (r === "studio") renderStudio();
    else if (r === "compose") renderCompose();
    else if (r === "providers") renderProviders();
    else renderSettings();
  }
  nav.addEventListener("click", function (e) {
    var b = e.target.closest("[data-route]");
    if (!b) return;
    setRoute(b.getAttribute("data-route"));
  });

  function activeProvider() {
    var p = providers();
    var active = pathName(p.active);
    if (REMOTE[active]) {
      var key = p.keys && p.keys[active];
      if (key) return { kind: "remote", name: active, keyRequired: true, stored: active };
      return { kind: "needle", name: "Needle 2", keyRequired: false, stored: active, missingKey: active };
    }
    return { kind: "needle", name: "Needle 2", keyRequired: false, stored: "needle" };
  }

  function plannerLabel(id) {
    if (id === "openai") return "OpenAI";
    if (id === "anthropic") return "Anthropic";
    if (id === "gemini") return "Gemini";
    if (id === "openrouter") return "OpenRouter";
    return "Needle 2";
  }

  function download(text, name, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function showScene(doc, note) {
    var checked = VeloraVxl.validate(doc);
    if (!checked.ok) return '<div class="status warn">' + VeloraVxl.esc(checked.errors.join("; ")) + "</div>";
    state.doc = checked.document;
    state.svg = VeloraVxl.compile(checked.document);
    var layers = checked.document.layers.length;
    var shapes = checked.document.layers.reduce(function (n, layer) { return n + layer.shapes.length; }, 0);
    var source = JSON.stringify(checked.document, null, 2);
    var shapeRows = "";
    checked.document.layers.forEach(function (layer, li) {
      layer.shapes.forEach(function (shape, si) {
        var key = li + ":" + si;
        var roles = ["figure", "ground", "accent"].map(function (role) {
          return '<option value="' + role + '"' + (shape.role === role ? " selected" : "") + ">" + role + "</option>";
        }).join("");
        shapeRows += '<div class="project' + (shape.id === state.sel || (state.also || []).indexOf(shape.id) >= 0 ? " on" : "") + '" data-pick="' + key + '"><div><strong>' + VeloraVxl.esc(shape.id) + '</strong><div class="muted">' +
          VeloraVxl.esc(layer.name) + " \u00b7 " + VeloraVxl.esc(shape.type) + "</div></div>" +
          '<div class="row"><select data-role="' + key + '" aria-label="Role for ' + VeloraVxl.esc(shape.id) + '">' + roles +
          '</select><button type="button" class="ghost" data-drop="' + key + '">Remove</button></div></div>';
      });
    });
    var vb = checked.document.canvas.viewBox.join(" ");
    var overlay = overlayMarks(checked.document);
    return '<div class="card" id="scene">' +
      '<div class="stage" id="stage"><div class="art" id="art">' + state.svg + '</div>' +
      '<svg class="overlay" id="overlay" viewBox="' + vb + '" aria-hidden="true">' + overlay + "</svg></div>" +
      '<div class="row"><button type="button" class="ghost" id="nudgeL">Move left</button>' +
      '<button type="button" class="ghost" id="nudgeR">Move right</button>' +
      '<button type="button" class="ghost" id="nudgeU">Move up</button>' +
      '<button type="button" class="ghost" id="nudgeD">Move down</button>' +
      '<button type="button" class="ghost" id="scaleUp">Scale up</button>' +
      '<button type="button" class="ghost" id="scaleDn">Scale down</button>' +
      '<button type="button" class="ghost" id="rotL">Rotate left</button>' +
      '<button type="button" class="ghost" id="rotR">Rotate right</button>' +
      '<button type="button" class="ghost' + (state.tool === "pen" ? " on" : "") + '" id="penMode">Anchors</button>' +
      '<button type="button" class="ghost' + (state.tool === "width" ? " on" : "") + '" id="widthMode">Width</button>' +
      '<button type="button" class="ghost' + (state.tool === "brush" ? " on" : "") + '" id="brushMode">Brush</button>' +
      '<button type="button" class="ghost' + (state.tool === "type" ? " on" : "") + '" id="typeMode">Type</button>' +
      '<button type="button" class="ghost' + (state.tool === "pencil" ? " on" : "") + '" id="pencilMode">Pencil</button>' +
      '<button type="button" class="ghost' + (state.tool === "curve" ? " on" : "") + '" id="curveMode">Curve</button>' +
      '<button type="button" class="ghost' + (state.curveCorner ? " on" : "") + '" id="curveCorner">Corner</button>' +
      '<button type="button" class="ghost" id="curveClose">Close curve</button>' +
      '<button type="button" class="ghost" id="curveFinish">Finish curve</button>' +
      '<button type="button" class="ghost" id="smoothPath">Smooth</button>' +
      '<label class="ink">Offset<input id="offsetDist" type="number" step="1" value="' + (state.offsetDist || 16) + '" aria-label="Offset distance"/></label>' +
      '<button type="button" class="ghost" id="offsetPath">Offset path</button>' +
      '<button type="button" class="ghost" data-align="left">Align left</button>' +
      '<button type="button" class="ghost" data-align="hcenter">Align center</button>' +
      '<button type="button" class="ghost" data-align="right">Align right</button>' +
      '<button type="button" class="ghost" data-align="top">Align top</button>' +
      '<button type="button" class="ghost" data-align="vmiddle">Align middle</button>' +
      '<button type="button" class="ghost" data-align="bottom">Align bottom</button>' +
      '<button type="button" class="ghost" data-align="hgap">Distribute H</button>' +
      '<button type="button" class="ghost" data-align="vgap">Distribute V</button>' +
      '<label class="ink">Angle<input id="gradAngle" type="number" step="15" value="' + (state.gradAngle || 0) + '" aria-label="Gradient angle"/></label>' +
      '<button type="button" class="ghost" id="paintGradient">Gradient</button>' +
      '<button type="button" class="ghost" id="flatFill">Flat fill</button>' +
      '<button type="button" class="ghost" id="clipMask">Clip</button>' +
      '<button type="button" class="ghost" id="releaseClip">Release clip</button>' +
      '<button type="button" class="ghost" id="unite">Unite</button>' +
      '<button type="button" class="ghost" id="subtract">Subtract</button>' +
      '<button type="button" class="ghost" id="intersect">Intersect</button>' +
      '<button type="button" class="ghost" id="exclude">Exclude</button>' +
      '<label class="ink">Steps<input id="blendSteps" type="number" min="3" max="24" value="' + (state.blendSteps || 5) + '"/></label>' +
      '<button type="button" class="ghost" id="blend">Blend</button>' +
      '<button type="button" class="ghost" id="expandBlend">Expand blend</button>' +
      widthChips() + brushChips() + typeControls() + '</div>' +
      inkControls(checked.document) +
      patternPanel(checked.document) +
      layerPanel(checked.document) +
      '<p class="muted" id="selMsg">' + (state.sel ? "Selected " + VeloraVxl.esc(state.sel) + ((state.also && state.also.length) ? " +" + state.also.length : "") + toolHint() : "Select a shape on the canvas or in the list.") + "</p>" +
      '<p class="muted">Shift-click adds shapes. One shape aligns to the artboard. Several align to the selection. Distribute needs three. Gradient paints figure to accent across the selection. Clip uses the front shape as the mask.</p>' +
      '<p class="muted">' + VeloraVxl.esc(note || checked.document.meta.name) + " \u00b7 " + layers + " layers \u00b7 " + shapes + " shapes" +
      (checked.document.repeat ? " \u00b7 " + checked.document.repeat.type + " \u00b7 " + checked.document.repeat.cols + "\u00d7" + checked.document.repeat.rows : "") +
      (checked.document.meta.purpose === "trace" ? " \u00b7 editable VXL" : "") + "</p>" +
      '<label for="pname">Project name</label><input id="pname" value="' + VeloraVxl.esc(checked.document.meta.name) + '"/>' +
      '<div class="row"><button type="button" class="btn" id="saveP">Save on device</button>' +
      '<button type="button" class="ghost" id="dlSvg">Download SVG</button>' +
      '<button type="button" class="ghost" id="dlVxl">Download VXL</button></div>' +
      '<p id="saveMsg" class="muted"></p>' +
      '<h3>Shapes</h3><p class="muted">Select, move, scale, or rotate. The change is baked into the VXL shape, then compiled again.</p>' +
      shapeRows +
      '<label for="editVxl">VXL source</label><textarea id="editVxl">' + VeloraVxl.esc(source) + '</textarea>' +
      '<div class="row"><button type="button" class="btn" id="applyVxl">Apply VXL edits</button></div>' +
      '<p id="editMsg" class="muted"></p></div>';
  }



  function handleRadius(doc) {
    var vb = (doc && doc.canvas && doc.canvas.viewBox) || [0, 0, 400, 400];
    return Math.max(8, Number(vb[2] || 400) / 42);
  }


  function patternPanel(doc) {
    var rep = doc.repeat;
    if (!rep) return "";
    var types = ["block", "half-drop", "half-brick", "mirror"].map(function (type) {
      return '<button type="button" class="chip' + (rep.type === type ? " on" : "") + '" data-pat="' + type + '">' + type + "</button>";
    }).join("");
    function field(id, label, value, step) {
      return '<label class="ink">' + label + '<input id="' + id + '" type="number" step="' + (step || "1") + '" value="' + value + '"/></label>';
    }
    return '<div id="pattern"><h3>Pattern</h3><p class="muted">Instance controls. The motif stays in tile space. Scale, rotate, offset, and gap compile as the pattern transform.</p>' +
      '<div class="row">' + types + "</div><div class=\"row\">" +
      field("patW", "Tile W", rep.tile[0]) +
      field("patH", "Tile H", rep.tile[1]) +
      field("patCols", "Cols", rep.cols) +
      field("patRows", "Rows", rep.rows) +
      field("patOx", "Offset X", rep.offset[0]) +
      field("patOy", "Offset Y", rep.offset[1]) +
      field("patScale", "Scale", rep.scale, "0.05") +
      field("patRot", "Rotate", rep.rotate) +
      field("patGapX", "Gap X", rep.gap[0]) +
      field("patGapY", "Gap Y", rep.gap[1]) +
      '</div><button type="button" class="ghost" id="applyPattern">Apply pattern</button></div>';
  }

  function toolHint() {
    if (state.tool === "pen") return ". Drag an anchor or its Bezier handle. The path is rewritten in VXL.";
    if (state.tool === "width") return ". Pick a profile or drag a width point. The stroke expands on compile.";
    if (state.tool === "brush") return ". Pick a nib. Angle sets the calligraphic edge. The centerline stays editable.";
    if (state.tool === "type") return ". Tap to place type. On path follows the selected path. Flip switches side. Outline bakes glyphs.";
    if (state.tool === "pencil") return ". Draw freehand. The stroke simplifies to cubic anchors. A closed loop fills.";
    if (state.tool === "curve") return ". Click to place a curve point. Corner makes a cusp. Close or double-click to finish.";
    return ". Drag the canvas to move. Unite, Subtract, Intersect, and Exclude bake the selection with the shape behind it.";
  }

  function typeControls() {
    if (state.tool !== "type") return "";
    var selected = state.sel ? VeloraEdit.find(state.doc, state.sel) : null;
    var live = selected && selected.type === "text" ? selected : null;
    var value = live ? live.text : (state.typeText || "Velora");
    var size = live ? live.size : (state.typeSize || 64);
    var anchor = live ? live.anchor : (state.typeAnchor || "middle");
    var area = live && live.w ? live.w : (state.typeWidth || "");
    return '</div><label for="typeText">Type</label><input id="typeText" value="' + VeloraVxl.esc(value) + '" aria-label="Type copy"/>' +
      '<div class="grid"><label>Size<input id="typeSize" type="number" min="8" value="' + size + '" aria-label="Type size"/></label>' +
      '<label>Anchor<select id="typeAnchor" aria-label="Type anchor">' +
      ["start", "middle", "end"].map(function (name) {
        return '<option value="' + name + '"' + (anchor === name ? " selected" : "") + ">" + name + "</option>";
      }).join("") + "</select></label></div>" +
      '<label for="typeWidth">Area width</label><input id="typeWidth" type="number" min="0" placeholder="Point type" value="' + area + '" aria-label="Area width"/>' +
      '<div class="row"><button type="button" class="chip" id="typeOnPath">On path</button><button type="button" class="chip" id="typeFlip">Flip side</button><button type="button" class="chip" id="outlineType">Outline to paths</button>' +
      (live && live.onPath ? '<button type="button" class="chip" id="typeRelease">Release</button>' : "");
  }

  function brushChips() {
    if (state.tool !== "brush") return "";
    var selected = state.sel ? VeloraEdit.find(state.doc, state.sel) : null;
    var live = selected && selected.brush ? selected.brush : null;
    var angle = live ? live.angle : 30;
    return ["round", "flat", "oval"].map(function (name) {
      var on = live && live.name === name ? " on" : "";
      return '<button type="button" class="chip' + on + '" data-brush="' + name + '">' + name + "</button>";
    }).join("") + '<label class="ink">Angle<input id="brushAngle" type="number" min="-180" max="180" value="' + angle + '" aria-label="Brush angle"/></label>';
  }

  function widthChips() {
    if (state.tool !== "width") return "";
    var names = ["taper", "swell", "point"];
    return names.map(function (name) {
      return '<button type="button" class="chip" data-profile="' + name + '">' + name + '</button>';
    }).join("");
  }

  function overlayMarks(doc) {
    var marks = "";
    function markBox(box) {
      if (!box) return;
      marks += '<rect x="' + box.x + '" y="' + box.y + '" width="' + Math.max(box.w, 1) + '" height="' + Math.max(box.h, 1) + '"/>';
    }
    markBox(state.sel ? VeloraEdit.bounds(VeloraEdit.find(doc, state.sel)) : null);
    (state.also || []).forEach(function (id) { markBox(VeloraEdit.bounds(VeloraEdit.find(doc, id))); });
    if (state.tool === "pencil" && state.pencil && state.pencil.length) {
      var live = state.pencil;
      marks += '<polyline fill="none" points="' + live.map(function (p) { return p[0] + "," + p[1]; }).join(" ") + '"/>';
      return marks;
    }
    if (state.tool === "curve" && state.curve && state.curve.length) {
      var preview = VeloraCurve.fit(state.curve, false);
      if (preview) marks += '<path fill="none" d="' + preview.d + '"/>';
      state.curve.forEach(function (p) {
        marks += '<circle class="' + (p.corner ? "handle" : "anchor") + '" cx="' + p.x + '" cy="' + p.y + '" r="' + (handleRadius(doc) * 0.36) + '"/>';
      });
      return marks;
    }
    if (!state.sel || (state.tool !== "pen" && state.tool !== "width")) return marks;
    var shape = VeloraEdit.find(doc, state.sel);
    if (state.tool === "width") {
      VeloraEdit.widthHandles(shape).forEach(function (h) {
        marks += '<line x1="' + h.x + '" y1="' + h.y + '" x2="' + h.hx + '" y2="' + h.hy + '"/>';
        marks += '<circle class="handle" cx="' + h.hx + '" cy="' + h.hy + '" r="' + (handleRadius(doc) * 0.34) + '"/>';
      });
      return marks;
    }
    var handles = VeloraEdit.handles(shape);
    var radius = handleRadius(doc);
    handles.forEach(function (h) {
      if (h.role === "anchor") return;
      var anchor = null;
      handles.forEach(function (other) {
        if (other.i === h.i && other.role === "anchor") anchor = other;
      });
      if (anchor) marks += '<line x1="' + h.x + '" y1="' + h.y + '" x2="' + anchor.x + '" y2="' + anchor.y + '"/>';
    });
    handles.forEach(function (h) {
      var r = h.role === "anchor" ? radius * 0.42 : radius * 0.28;
      marks += '<circle class="' + (h.role === "anchor" ? "anchor" : "handle") + '" cx="' + h.x + '" cy="' + h.y + '" r="' + r + '"/>';
    });
    return marks;
  }


  function layerPanel(doc) {
    var rows = (doc.layers || []).map(function (layer) {
      var on = layer.id === state.layer ? " on" : "";
      var op = Math.round((layer.opacity == null ? 1 : layer.opacity) * 100);
      return '<div class="layer' + on + '" data-layer="' + VeloraVxl.esc(layer.id) + '">' +
        '<input type="text" data-lname="' + VeloraVxl.esc(layer.id) + '" value="' + VeloraVxl.esc(layer.name) + '" aria-label="Layer name"/>' +
        '<input type="number" min="0" max="100" data-lop="' + VeloraVxl.esc(layer.id) + '" value="' + op + '" aria-label="Layer opacity"/>' +
        '<button type="button" class="ghost' + (layer.visible === false ? "" : " on") + '" data-lvis="' + VeloraVxl.esc(layer.id) + '">' + (layer.visible === false ? "Show" : "Hide") + '</button>' +
        '<button type="button" class="ghost' + (layer.locked ? " on" : "") + '" data-llock="' + VeloraVxl.esc(layer.id) + '">' + (layer.locked ? "Unlock" : "Lock") + '</button>' +
        '<button type="button" class="ghost" data-lback="' + VeloraVxl.esc(layer.id) + '">Back</button>' +
        '<button type="button" class="ghost" data-lfront="' + VeloraVxl.esc(layer.id) + '">Front</button>' +
        '<button type="button" class="ghost" data-ldrop="' + VeloraVxl.esc(layer.id) + '">Merge</button></div>';
    }).join("");
    var assign = "";
    if (state.sel) {
      assign = '<label for="assignLayer">Move selection</label><select id="assignLayer" aria-label="Move selection to layer">' +
        (doc.layers || []).map(function (layer) {
          var host = VeloraEdit.hostLayer(doc, state.sel);
          var selected = host && host.id === layer.id ? " selected" : "";
          return '<option value="' + VeloraVxl.esc(layer.id) + '"' + selected + '>' + VeloraVxl.esc(layer.name) + '</option>';
        }).join("") + '</select>';
    }
    return '<h3>Layers</h3><p class="muted">Later layers paint in front. Hidden and locked layers stay out of the hit test. Undo restores the document.</p>' +
      '<div class="row"><button type="button" class="ghost" id="undoBtn"' + (state.history.length ? "" : " disabled") + '>Undo</button>' +
      '<button type="button" class="ghost" id="redoBtn"' + (state.future.length ? "" : " disabled") + '>Redo</button>' +
      '<button type="button" class="ghost" id="addLayer">New layer</button></div>' + rows + assign;
  }

  function inkControls(doc) {
    var jobs = ["ground", "figure", "accent"];
    ["ink2", "ink3", "ink4"].forEach(function (key) {
      if (doc.palette && doc.palette[key]) jobs.push(key);
    });
    return '<h3>Inks</h3><p class="muted">Recolor by job. Figure, ground, and accent update every shape on that role. Matching hex fills are linked back to the role.</p><div class="row" id="inks">' +
      jobs.map(function (job) {
        var color = (doc.palette && doc.palette[job]) || "#000000";
        return '<label class="ink">' + job + '<input type="color" data-ink="' + job + '" value="' + color + '" aria-label="Recolor ' + job + '"/></label>';
      }).join("") + "</div>";
  }

  function bindScene() {
    var save = document.getElementById("saveP");
    if (!save) return;
    save.onclick = function () {
      state.doc.meta.name = document.getElementById("pname").value.trim() || state.doc.meta.name;
      state.doc.meta.updated = new Date().toISOString();
      VeloraReference.bindDocument(state.doc);
      var res = VeloraProjects.save(state.doc);
      document.getElementById("saveMsg").textContent = res.ok ? "Saved on this device." : res.error;
      document.getElementById("saveMsg").className = res.ok ? "ok" : "warn";
    };
    document.getElementById("dlSvg").onclick = function () {
      download(state.svg, VeloraVxl.slug(state.doc.meta.name) + ".svg", "image/svg+xml");
    };
    document.getElementById("dlVxl").onclick = function () {
      download(JSON.stringify(state.doc, null, 2), VeloraVxl.slug(state.doc.meta.name) + ".vxl.json", "application/json");
    };
    var roles = document.querySelectorAll("[data-role]");
    for (var i = 0; i < roles.length; i++) {
      roles[i].onchange = function () {
        var parts = this.getAttribute("data-role").split(":");
        var shape = state.doc.layers[Number(parts[0])].shapes[Number(parts[1])];
        shape.role = this.value;
        if (shape.fill === "figure" || shape.fill === "ground" || shape.fill === "accent" || shape.fill == null) shape.fill = this.value;
        publishScene(state.doc, "Role updated");
      };
    }
    var drops = document.querySelectorAll("[data-drop]");
    for (var d = 0; d < drops.length; d++) {
      drops[d].onclick = function () {
        var parts = this.getAttribute("data-drop").split(":");
        var shapes = state.doc.layers[Number(parts[0])].shapes;
        shapes.splice(Number(parts[1]), 1);
        state.sel = "";
        publishScene(state.doc, "Shape removed");
      };
    }
    var inks = document.querySelectorAll("[data-ink]");
    for (var ink = 0; ink < inks.length; ink++) {
      inks[ink].onchange = function () {
        var job = this.getAttribute("data-ink");
        var result = VeloraEdit.recolor(state.doc, job, this.value);
        publishScene(state.doc, result ? "Recolored " + job : "Ink unchanged");
      };
    }
    document.getElementById("applyVxl").onclick = function () {
      publishScene(document.getElementById("editVxl").value, "Edited VXL");
    };

    var undoBtn = document.getElementById("undoBtn");
    var redoBtn = document.getElementById("redoBtn");
    if (undoBtn) undoBtn.onclick = function () { undoDoc(); };
    if (redoBtn) redoBtn.onclick = function () { redoDoc(); };
    var addLayer = document.getElementById("addLayer");
    if (addLayer) addLayer.onclick = function () {
      var made = VeloraEdit.addLayer(state.doc, "Layer " + (state.doc.layers.length + 1));
      if (made) state.layer = made.id;
      publishScene(state.doc, made ? "Layer added" : "Layer limit");
    };
    document.querySelectorAll("[data-layer]").forEach(function (row) {
      row.onclick = function (ev) {
        if (ev.target.closest("input,button,select")) return;
        state.layer = this.getAttribute("data-layer");
        publishScene(state.doc, "Layer active");
      };
    });
    document.querySelectorAll("[data-lname]").forEach(function (input) {
      input.onchange = function () {
        VeloraEdit.renameLayer(state.doc, this.getAttribute("data-lname"), this.value);
        publishScene(state.doc, "Layer renamed");
      };
    });
    document.querySelectorAll("[data-lop]").forEach(function (input) {
      input.onchange = function () {
        VeloraEdit.setLayer(state.doc, this.getAttribute("data-lop"), { opacity: Number(this.value) / 100 });
        publishScene(state.doc, "Layer opacity");
      };
    });
    document.querySelectorAll("[data-lvis]").forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute("data-lvis");
        var layer = (state.doc.layers || []).filter(function (item) { return item.id === id; })[0];
        VeloraEdit.setLayer(state.doc, id, { visible: layer && layer.visible === false });
        publishScene(state.doc, "Layer visibility");
      };
    });
    document.querySelectorAll("[data-llock]").forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute("data-llock");
        var layer = (state.doc.layers || []).filter(function (item) { return item.id === id; })[0];
        VeloraEdit.setLayer(state.doc, id, { locked: !(layer && layer.locked) });
        publishScene(state.doc, "Layer lock");
      };
    });
    document.querySelectorAll("[data-lback]").forEach(function (btn) {
      btn.onclick = function () {
        VeloraEdit.orderLayer(state.doc, this.getAttribute("data-lback"), -1);
        publishScene(state.doc, "Layer back");
      };
    });
    document.querySelectorAll("[data-lfront]").forEach(function (btn) {
      btn.onclick = function () {
        VeloraEdit.orderLayer(state.doc, this.getAttribute("data-lfront"), 1);
        publishScene(state.doc, "Layer front");
      };
    });
    document.querySelectorAll("[data-ldrop]").forEach(function (btn) {
      btn.onclick = function () {
        var id = this.getAttribute("data-ldrop");
        var sink = VeloraEdit.removeLayer(state.doc, id);
        if (sink) state.layer = sink.id;
        publishScene(state.doc, sink ? "Layer merged" : "Keep one layer");
      };
    });
    var assign = document.getElementById("assignLayer");
    if (assign) assign.onchange = function () {
      VeloraEdit.moveShape(state.doc, state.sel, this.value);
      state.layer = this.value;
      publishScene(state.doc, "Shape moved");
    };

    var picks = document.querySelectorAll("[data-pick]");
    for (var p = 0; p < picks.length; p++) {
      picks[p].onclick = function (ev) {
        if (ev.target.closest("select,button")) return;
        var parts = this.getAttribute("data-pick").split(":");
        var shape = state.doc.layers[Number(parts[0])].shapes[Number(parts[1])];
        toggleSel(shape ? shape.id : "", ev.shiftKey);
        publishScene(state.doc, "Selected");
      };
    }
    function editAround(mode, matrix) {
      if (!state.sel) return;
      VeloraEdit.apply(state.doc, state.sel, matrix, mode);
      publishScene(state.doc, mode === "move" ? "Moved" : mode === "scale" ? "Scaled" : "Rotated");
    }
    function centerOf() {
      var box = VeloraEdit.bounds(VeloraEdit.find(state.doc, state.sel));
      if (!box) return { x: 0, y: 0 };
      return { x: box.cx, y: box.cy };
    }
    document.getElementById("nudgeL").onclick = function () { editAround("move", VeloraEdit.moveMatrix(-12, 0)); };
    document.getElementById("nudgeR").onclick = function () { editAround("move", VeloraEdit.moveMatrix(12, 0)); };
    document.getElementById("nudgeU").onclick = function () { editAround("move", VeloraEdit.moveMatrix(0, -12)); };
    document.getElementById("nudgeD").onclick = function () { editAround("move", VeloraEdit.moveMatrix(0, 12)); };
    document.getElementById("scaleUp").onclick = function () {
      var c = centerOf();
      editAround("scale", VeloraEdit.scaleMatrix(1.1, 1.1, c.x, c.y));
    };
    document.getElementById("scaleDn").onclick = function () {
      var c = centerOf();
      editAround("scale", VeloraEdit.scaleMatrix(0.9, 0.9, c.x, c.y));
    };
    document.getElementById("rotL").onclick = function () {
      var c = centerOf();
      editAround("rotate", VeloraEdit.rotateMatrix(-15, c.x, c.y));
    };
    document.getElementById("rotR").onclick = function () {
      var c = centerOf();
      editAround("rotate", VeloraEdit.rotateMatrix(15, c.x, c.y));
    };
    document.getElementById("penMode").onclick = function () {
      state.tool = state.tool === "pen" ? "select" : "pen";
      if (state.tool === "pen" && state.sel) VeloraEdit.penReady(VeloraEdit.find(state.doc, state.sel));
      publishScene(state.doc, state.tool === "pen" ? "Anchor edit" : "Selection");
    };
    document.getElementById("widthMode").onclick = function () {
      state.tool = state.tool === "width" ? "select" : "width";
      publishScene(state.doc, state.tool === "width" ? "Width profile" : "Selection");
    };
    var brushMode = document.getElementById("brushMode");
    if (brushMode) brushMode.onclick = function () {
      state.tool = state.tool === "brush" ? "select" : "brush";
      publishScene(state.doc, state.tool === "brush" ? "Brush" : "Selection");
    };
    document.getElementById("typeMode").onclick = function () {
      state.tool = state.tool === "type" ? "select" : "type";
      publishScene(state.doc, state.tool === "type" ? "Type" : "Selection");
    };
    var pencilMode = document.getElementById("pencilMode");
    if (pencilMode) pencilMode.onclick = function () {
      state.tool = state.tool === "pencil" ? "select" : "pencil";
      state.pencil = [];
      publishScene(state.doc, state.tool === "pencil" ? "Pencil" : "Selection");
    };
    var curveMode = document.getElementById("curveMode");
    if (curveMode) curveMode.onclick = function () {
      state.tool = state.tool === "curve" ? "select" : "curve";
      state.curve = [];
      publishScene(state.doc, state.tool === "curve" ? "Curvature" : "Selection");
    };
    var curveCorner = document.getElementById("curveCorner");
    if (curveCorner) curveCorner.onclick = function () {
      state.curveCorner = !state.curveCorner;
      publishScene(state.doc, state.curveCorner ? "Corner point" : "Smooth point");
    };
    function commitCurve(closed) {
      var pts = (state.curve || []).slice();
      state.curve = [];
      state.curveAt = 0;
      if (pts.length < 2 || !VeloraCurve) {
        publishScene(state.doc, "Curve needs two points");
        return;
      }
      var fit = VeloraCurve.fit(pts, closed);
      if (!fit) {
        publishScene(state.doc, "Curve needs two points");
        return;
      }
      var vb = (state.doc.canvas && state.doc.canvas.viewBox) || [0, 0, 1024, 1024];
      var span = Math.max(vb[2] || 1024, vb[3] || 1024);
      var placed = VeloraEdit.placePencil(state.doc, fit.d, state.layer, Math.max(4, span / 80));
      if (!placed) return;
      placed.id = placed.id.replace("pencil", "curve");
      state.sel = placed.id;
      publishScene(state.doc, fit.closed ? "Curve closed" : "Curve path");
    }
    var curveClose = document.getElementById("curveClose");
    if (curveClose) curveClose.onclick = function () { commitCurve(true); };
    var curveFinish = document.getElementById("curveFinish");
    if (curveFinish) curveFinish.onclick = function () { commitCurve(false); };
    var smoothPath = document.getElementById("smoothPath");
    if (smoothPath) smoothPath.onclick = function () {
      if (!state.sel) return;
      var smoothed = VeloraEdit.smoothShape(state.doc, state.sel, 0.5);
      if (!smoothed) return;
      publishScene(state.doc, "Smoothed");
    };
    var offsetDist = document.getElementById("offsetDist");
    if (offsetDist) offsetDist.onchange = function () { state.offsetDist = Number(offsetDist.value) || 16; };
    document.querySelectorAll("[data-align]").forEach(function (btn) {
      btn.onclick = function () {
        var ids = selectionIds();
        if (!ids.length) return;
        var mode = this.getAttribute("data-align");
        var vb = state.doc.canvas && state.doc.canvas.viewBox;
        var moves = VeloraEdit.alignShapes(state.doc, ids, mode, vb);
        var labels = { left: "Aligned left", hcenter: "Aligned center", right: "Aligned right", top: "Aligned top", vmiddle: "Aligned middle", bottom: "Aligned bottom", hgap: "Distributed across", vgap: "Distributed down" };
        var miss = mode === "hgap" || mode === "vgap" ? "Need three shapes" : "Nothing to align";
        publishScene(state.doc, moves.length ? (labels[mode] || "Aligned") : miss);
      };
    });
    var gradAngle = document.getElementById("gradAngle");
    if (gradAngle) gradAngle.onchange = function () { state.gradAngle = Number(gradAngle.value) || 0; };
    var paintGradient = document.getElementById("paintGradient");
    if (paintGradient) paintGradient.onclick = function () {
      var ids = selectionIds();
      if (!ids.length) return;
      var angle = Number((document.getElementById("gradAngle") || {}).value);
      if (!isFinite(angle)) angle = state.gradAngle || 0;
      state.gradAngle = angle;
      var n = VeloraEdit.paintGradient(state.doc, ids, angle, "figure", "accent");
      publishScene(state.doc, n ? "Gradient " + angle + "°" : "Select a shape");
    };
    var flatFill = document.getElementById("flatFill");
    if (flatFill) flatFill.onclick = function () {
      var ids = selectionIds();
      if (!ids.length) return;
      var n = VeloraEdit.clearGradient(state.doc, ids);
      publishScene(state.doc, n ? "Flat fill" : "No gradient");
    };
    var clipMask = document.getElementById("clipMask");
    if (clipMask) clipMask.onclick = function () {
      var ids = selectionIds();
      if (!ids.length) return;
      var n = VeloraEdit.applyClip(state.doc, ids);
      if (n) state.also = [];
      publishScene(state.doc, n ? "Clipped " + n : "Need a closed shape in front");
    };
    var releaseClip = document.getElementById("releaseClip");
    if (releaseClip) releaseClip.onclick = function () {
      var ids = selectionIds();
      if (!ids.length) return;
      var n = VeloraEdit.releaseClip(state.doc, ids);
      publishScene(state.doc, n ? "Clip released" : "No clip");
    };
    var offsetPath = document.getElementById("offsetPath");
    if (offsetPath) offsetPath.onclick = function () {
      if (!state.sel) return;
      var dist = Number((document.getElementById("offsetDist") || {}).value);
      if (!isFinite(dist) || dist === 0) dist = state.offsetDist || 16;
      state.offsetDist = dist;
      var made = VeloraEdit.offsetShape(state.doc, state.sel, dist, 4);
      if (made) state.sel = made.id;
      publishScene(state.doc, made ? "Offset " + dist : "Select a path or shape");
    };
    function runBoolean(op) {
      if (!state.sel) return;
      var path = VeloraBoolean.apply(state.doc, state.sel, op);
      var labels = { unite: "United", subtract: "Subtracted", intersect: "Intersected", exclude: "Excluded" };
      var miss = op === "intersect" ? "No overlap" : "Need a shape behind the selection";
      publishScene(state.doc, path ? (labels[op] || "Boolean") : miss);
    }
    document.getElementById("unite").onclick = function () { runBoolean("unite"); };
    document.getElementById("subtract").onclick = function () { runBoolean("subtract"); };
    document.getElementById("intersect").onclick = function () { runBoolean("intersect"); };
    document.getElementById("exclude").onclick = function () { runBoolean("exclude"); };
    var blendSteps = document.getElementById("blendSteps");
    if (blendSteps) {
      blendSteps.oninput = function () { state.blendSteps = Number(blendSteps.value) || 5; };
    }
    document.getElementById("blend").onclick = function () {
      if (!state.sel) return;
      var node = VeloraBlend.apply(state.doc, state.sel, state.blendSteps || 5);
      publishScene(state.doc, node ? "Blend " + node.steps + " steps" : "Need a shape behind the selection");
    };
    document.getElementById("expandBlend").onclick = function () {
      if (!state.sel) return;
      var group = VeloraBlend.expand(state.doc, state.sel, state.doc.palette);
      publishScene(state.doc, group ? "Blend expanded" : "Select a blend");
    };
    var applyPattern = document.getElementById("applyPattern");
    if (applyPattern) {
      var pats = document.querySelectorAll("[data-pat]");
      for (var p = 0; p < pats.length; p++) {
        pats[p].onclick = function () {
          var all = document.querySelectorAll("[data-pat]");
          for (var k = 0; k < all.length; k++) all[k].className = "chip";
          this.className = "chip on";
        };
      }
      applyPattern.onclick = function () {
        if (!state.doc || !state.doc.repeat) return;
        var typeBtn = document.querySelector("[data-pat].on");
        state.doc.repeat = VeloraVxl.normalizeRepeat({
          type: typeBtn ? typeBtn.getAttribute("data-pat") : state.doc.repeat.type,
          tile: [document.getElementById("patW").value, document.getElementById("patH").value],
          cols: document.getElementById("patCols").value,
          rows: document.getElementById("patRows").value,
          offset: [document.getElementById("patOx").value, document.getElementById("patOy").value],
          scale: document.getElementById("patScale").value,
          rotate: document.getElementById("patRot").value,
          gap: [document.getElementById("patGapX").value, document.getElementById("patGapY").value]
        });
        publishScene(state.doc, "Pattern instance");
      };
    }
    var typeText = document.getElementById("typeText");
    if (typeText) {
      function readType() {
        state.typeText = typeText.value;
        state.typeSize = Number(document.getElementById("typeSize").value) || 64;
        state.typeAnchor = document.getElementById("typeAnchor").value;
        state.typeWidth = Number(document.getElementById("typeWidth").value) || 0;
        if (!state.sel) return;
        var current = VeloraEdit.find(state.doc, state.sel);
        if (!current || current.type !== "text") return;
        VeloraEdit.setText(state.doc, state.sel, {
          text: state.typeText,
          size: state.typeSize,
          anchor: state.typeAnchor,
          w: state.typeWidth
        });
        paintArt();
      }
      typeText.oninput = readType;
      document.getElementById("typeSize").oninput = readType;
      document.getElementById("typeAnchor").onchange = readType;
      document.getElementById("typeWidth").oninput = readType;
    }
    var typeOnPath = document.getElementById("typeOnPath");
    if (typeOnPath) {
      typeOnPath.onclick = function () {
        var pathShape = VeloraEdit.find(state.doc, state.sel);
        if (!pathShape || pathShape.type !== "path") pathShape = VeloraEdit.find(state.doc, state.pathId);
        if (!pathShape || pathShape.type !== "path" || !pathShape.d) {
          publishScene(state.doc, "Select a path first");
          return;
        }
        var mid = VeloraTypePath.pointAt(pathShape.d, 0.5) || { x: 0, y: 0 };
        var placed = VeloraEdit.placeText(state.doc, mid.x, mid.y, state.typeText || "Velora", state.typeSize || 64, state.layer);
        if (!placed) return;
        placed.anchor = state.typeAnchor || "middle";
        VeloraEdit.setText(state.doc, placed.id, { onPath: pathShape.d, side: 1 });
        state.sel = placed.id;
        state.pathId = pathShape.id;
        publishScene(state.doc, "Type on path");
      };
    }
    var typeFlip = document.getElementById("typeFlip");
    if (typeFlip) {
      typeFlip.onclick = function () {
        var current = VeloraEdit.find(state.doc, state.sel);
        if (!current || current.type !== "text" || !current.onPath) return;
        VeloraEdit.setText(state.doc, state.sel, { side: current.side === -1 ? 1 : -1 });
        publishScene(state.doc, "Type flipped");
      };
    }
    var typeRelease = document.getElementById("typeRelease");
    if (typeRelease) {
      typeRelease.onclick = function () {
        VeloraEdit.setText(state.doc, state.sel, { onPath: "" });
        publishScene(state.doc, "Type released");
      };
    }
    var outlineType = document.getElementById("outlineType");
    if (outlineType) {
      outlineType.onclick = function () {
        if (!state.sel) return;
        var outlined = VeloraEdit.outlineText(state.doc, state.sel);
        if (!outlined) return;
        state.tool = "select";
        publishScene(state.doc, "Type outlined");
      };
    }
    var chips = document.querySelectorAll("[data-profile]");
    for (var c = 0; c < chips.length; c++) {
      chips[c].onclick = function () {
        if (!state.sel) return;
        VeloraEdit.applyWidth(state.doc, state.sel, this.getAttribute("data-profile"));
        publishScene(state.doc, "Width " + this.getAttribute("data-profile"));
      };
    }
    var brushChips = document.querySelectorAll("[data-brush]");
    for (var b = 0; b < brushChips.length; b++) {
      brushChips[b].onclick = function () {
        if (!state.sel) return;
        var angleInput = document.getElementById("brushAngle");
        var angle = angleInput ? Number(angleInput.value) : null;
        VeloraEdit.applyBrush(state.doc, state.sel, this.getAttribute("data-brush"), angle);
        publishScene(state.doc, "Brush " + this.getAttribute("data-brush"));
      };
    }
    var brushAngle = document.getElementById("brushAngle");
    if (brushAngle) {
      brushAngle.onchange = function () {
        if (!state.sel) return;
        var shape = VeloraEdit.find(state.doc, state.sel);
        if (!shape || !shape.brush) return;
        VeloraEdit.setBrushAngle(state.doc, state.sel, brushAngle.value);
        publishScene(state.doc, "Brush angle");
      };
    }
    var stage = document.getElementById("stage");
    var art = document.getElementById("art");
    var drag = null;
    function pointerPoint(ev) {
      var svg = art.querySelector("svg");
      if (!svg || !svg.createSVGPoint || !svg.getScreenCTM()) return null;
      var pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      var mapped = pt.matrixTransform(svg.getScreenCTM().inverse());
      return { x: mapped.x, y: mapped.y };
    }
    stage.onpointerdown = function (ev) {
      if (ev.target.closest("button,select,input,textarea")) return;
      var pt = pointerPoint(ev);
      if (!pt) return;
      if (state.tool === "pencil") {
        state.pencil = [[pt.x, pt.y]];
        drag = { kind: "pencil", moved: false };
        stage.setPointerCapture(ev.pointerId);
        paintArt();
        return;
      }
      if (state.tool === "curve") {
        state.curve = state.curve || [];
        var radius = handleRadius(state.doc) * 1.4;
        var now = Date.now();
        var last = state.curve[state.curve.length - 1];
        if (last && now - (state.curveAt || 0) < 320 && VeloraCurve.dist(last, pt) <= radius) {
          commitCurve(false);
          return;
        }
        var first = state.curve[0];
        if (state.curve.length >= 3 && first && VeloraCurve.dist(first, pt) <= radius) {
          commitCurve(true);
          return;
        }
        state.curve.push({ x: pt.x, y: pt.y, corner: !!(state.curveCorner || ev.altKey) });
        state.curveAt = now;
        drag = null;
        paintArt();
        return;
      }
      if (state.tool === "type") {
        var existing = VeloraEdit.hitTest(state.doc, pt.x, pt.y);
        if (existing && existing.type === "text") {
          state.sel = existing.id;
          state.typeText = existing.text;
          state.typeSize = existing.size;
          state.typeAnchor = existing.anchor;
          state.typeWidth = existing.w || 0;
          drag = null;
          publishScene(state.doc, "Type selected");
          return;
        }
        var placed = VeloraEdit.placeText(state.doc, pt.x, pt.y, state.typeText || "Velora", state.typeSize || 64, state.layer);
        if (!placed) return;
        placed.anchor = state.typeAnchor || "middle";
        if (state.typeWidth > 0) placed.w = state.typeWidth;
        state.sel = placed.id;
        drag = null;
        publishScene(state.doc, "Type placed");
        return;
      }
      if (state.tool === "width" && state.sel) {
        var stroked = VeloraEdit.find(state.doc, state.sel);
        var widthHit = stroked && VeloraEdit.hitWidth(stroked, pt.x, pt.y, handleRadius(state.doc));
        if (widthHit) {
          drag = { kind: "width", id: state.sel, i: widthHit.i, moved: false };
          stage.setPointerCapture(ev.pointerId);
          paintArt();
          return;
        }
      }
      if (state.tool === "pen" && state.sel) {
        var current = VeloraEdit.find(state.doc, state.sel);
        var handle = current && VeloraEdit.hitHandle(current, pt.x, pt.y, handleRadius(state.doc));
        if (handle) {
          drag = { kind: "handle", id: state.sel, i: handle.i, role: handle.role, moved: false };
          stage.setPointerCapture(ev.pointerId);
          paintArt();
          return;
        }
      }
      var hit = VeloraEdit.hitTest(state.doc, pt.x, pt.y);
      toggleSel(hit ? hit.id : "", ev.shiftKey);
      if (hit && hit.type === "path") state.pathId = hit.id;
      if (state.tool === "pen") {
        if (state.sel) VeloraEdit.penReady(VeloraEdit.find(state.doc, state.sel));
        drag = null;
        paintArt();
        return;
      }
      drag = state.sel ? { kind: "move", x: pt.x, y: pt.y, id: state.sel, moved: false } : null;
      if (drag) stage.setPointerCapture(ev.pointerId);
      paintArt();
    };
    stage.onpointermove = function (ev) {
      if (!drag) return;
      var pt = pointerPoint(ev);
      if (!pt) return;
      if (drag.kind === "pencil") {
        var last = state.pencil[state.pencil.length - 1];
        if (!last || Math.hypot(pt.x - last[0], pt.y - last[1]) > 2) {
          state.pencil.push([pt.x, pt.y]);
          drag.moved = true;
          paintArt();
        }
        return;
      }
      if (drag.kind === "handle") {
        VeloraEdit.moveHandle(state.doc, drag.id, drag.i, drag.role, pt.x, pt.y);
        drag.moved = true;
        paintArt();
        return;
      }
      if (drag.kind === "width") {
        var host = VeloraEdit.find(state.doc, drag.id);
        var handles = VeloraEdit.widthHandles(host);
        var h = handles[drag.i];
        if (h) {
          var along = (pt.x - h.x) * h.nx + (pt.y - h.y) * h.ny;
          VeloraEdit.setWidthSample(state.doc, drag.id, drag.i, Math.abs(along) * 2);
          drag.moved = true;
          paintArt();
        }
        return;
      }
      var dx = pt.x - drag.x;
      var dy = pt.y - drag.y;
      if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4) return;
      VeloraEdit.apply(state.doc, drag.id, VeloraEdit.moveMatrix(dx, dy), "move");
      drag.x = pt.x;
      drag.y = pt.y;
      drag.moved = true;
      paintArt();
    };
    stage.onpointerup = function () {
      var moved = drag && drag.moved;
      var kind = drag && drag.kind;
      var stroke = kind === "pencil" ? (state.pencil || []).slice() : null;
      drag = null;
      if (kind === "pencil") {
        state.pencil = [];
        var vb = (state.doc.canvas && state.doc.canvas.viewBox) || [0, 0, 1024, 1024];
        var span = Math.max(vb[2] || 1024, vb[3] || 1024);
        var fit = VeloraPencil.stroke(stroke, Math.max(4, span / 90), Math.max(18, span / 28));
        if (!fit) {
          publishScene(state.doc, "Pencil stroke too short");
          return;
        }
        var placed = VeloraEdit.placePencil(state.doc, fit.d, state.layer, Math.max(4, span / 80));
        if (!placed) return;
        state.sel = placed.id;
        publishScene(state.doc, fit.closed ? "Pencil closed" : "Pencil path");
        return;
      }
      if (moved) publishScene(state.doc, kind === "handle" ? "Anchor edited" : kind === "width" ? "Width edited" : "Moved");
      else publishScene(state.doc, state.sel ? "Selected" : "Selection cleared");
    };
  }

  function paintArt() {
    var checked = VeloraVxl.validate(state.doc);
    if (!checked.ok) return;
    state.doc = checked.document;
    state.svg = VeloraVxl.compile(state.doc);
    var art = document.getElementById("art");
    if (art) art.innerHTML = state.svg;
    var overlay = document.getElementById("overlay");
    var box = state.sel ? VeloraEdit.bounds(VeloraEdit.find(state.doc, state.sel)) : null;
    if (overlay) overlay.innerHTML = overlayMarks(state.doc);
    var src = document.getElementById("editVxl");
    if (src) src.value = JSON.stringify(state.doc, null, 2);
    var msg = document.getElementById("selMsg");
    if (msg) msg.textContent = state.sel ? "Selected " + state.sel + toolHint() : "Select a shape on the canvas or in the list.";
  }

  function bodyStamp(doc) {
    if (!doc) return "";
    try {
      var copy = JSON.parse(JSON.stringify(doc));
      if (copy.meta) delete copy.meta.updated;
      return JSON.stringify(copy);
    } catch (err) {
      return "";
    }
  }


  function selectionIds() {
    var ids = [];
    if (state.sel) ids.push(state.sel);
    (state.also || []).forEach(function (id) {
      if (id && id !== state.sel && ids.indexOf(id) < 0) ids.push(id);
    });
    return ids;
  }

  function toggleSel(id, shift) {
    if (!state.also) state.also = [];
    if (!id) {
      if (!shift) { state.sel = ""; state.also = []; }
      return;
    }
    if (shift && state.sel && id !== state.sel) {
      var at = state.also.indexOf(id);
      if (at >= 0) state.also.splice(at, 1);
      else state.also.push(id);
      return;
    }
    state.sel = id;
    state.also = [];
  }

  function publishScene(doc, note, flags) {
    flags = flags || {};
    var out = document.getElementById("out");
    var checked = VeloraVxl.validate(doc);
    if (!checked.ok) {
      var msg = document.getElementById("editMsg");
      if (msg) {
        msg.className = "warn";
        msg.textContent = checked.errors.join("; ");
      } else if (out) {
        out.innerHTML = '<div class="status warn">' + VeloraVxl.esc(checked.errors.join("; ")) + "</div>";
      }
      return checked;
    }
    if (flags.reset) {
      state.history = [];
      state.future = [];
    } else if (!flags.replay) {
      var prev = bodyStamp(state.doc);
      var next = bodyStamp(checked.document);
      if (prev && prev !== next) {
        state.history.push(JSON.stringify(state.doc));
        if (state.history.length > 40) state.history.shift();
        state.future = [];
      }
    }
    var known = (checked.document.layers || []).some(function (layer) { return layer.id === state.layer; });
    if (!known && checked.document.layers.length) state.layer = checked.document.layers[checked.document.layers.length - 1].id;
    if (out) {
      out.innerHTML = showScene(checked.document, note);
      bindScene();
    }
    var paste = document.getElementById("paste");
    if (paste) paste.value = JSON.stringify(checked.document, null, 2);
    return checked;
  }

  function undoDoc() {
    if (!state.history.length || !state.doc) return;
    state.future.push(JSON.stringify(state.doc));
    publishScene(JSON.parse(state.history.pop()), "Undo", { replay: true });
  }

  function redoDoc() {
    if (!state.future.length || !state.doc) return;
    state.history.push(JSON.stringify(state.doc));
    publishScene(JSON.parse(state.future.pop()), "Redo", { replay: true });
  }

  function renderStudio() {
    var ap = activeProvider();
    var items = VeloraProjects.list();
    var list = items.length ? items.map(function (item) {
      return '<div class="project"><div><strong>' + VeloraVxl.esc(item.name) + '</strong><div class="muted">' +
        VeloraVxl.esc(item.category) + " \u00b7 " + VeloraVxl.esc(item.updated.slice(0, 16).replace("T", " ")) +
        '</div></div><div class="row"><button type="button" class="btn" data-open="' + VeloraVxl.esc(item.id) +
        '">Open</button><button type="button" class="ghost" data-del="' + VeloraVxl.esc(item.id) + '">Delete</button></div></div>';
    }).join("") : '<p class="muted">No saved projects yet. Compose or paste VXL, then save.</p>';
    $.innerHTML = '<h1>Design that names its job.</h1><p class="muted">VXL is the source. SVG is the compile. Raster is only a preview.</p>' +
      '<div class="card"><h2>Pipeline</h2><p class="muted">Brief or pasted JSON \u2192 Needle or skill expand \u2192 validate \u2192 compile. Path: <strong style="color:var(--fg)">' +
      VeloraVxl.esc(ap.name) + '</strong>. No API key.</p><div class="row"><button type="button" class="btn" id="goNew">New composition</button>' +
      '<button type="button" class="ghost" id="goProv">Providers</button></div></div>' +
      '<div class="card"><h2>On device</h2>' + list + '</div>';
    document.getElementById("goNew").onclick = function () { setRoute("compose"); };
    document.getElementById("goProv").onclick = function () { setRoute("providers"); };
    var opens = $.querySelectorAll("[data-open]");
    for (var i = 0; i < opens.length; i++) opens[i].onclick = function () { openProject(this.getAttribute("data-open")); };
    var dels = $.querySelectorAll("[data-del]");
    for (var j = 0; j < dels.length; j++) dels[j].onclick = function () {
      VeloraProjects.remove(this.getAttribute("data-del"));
      renderStudio();
    };
  }

  function openProject(id) {
    var doc = VeloraProjects.get(id);
    if (!doc) return;
    state.doc = doc;
    state.type = doc.meta.category === "textile" ? "textile" : "logo";
    if (doc.meta && doc.meta.reference) VeloraReference.restore(doc.meta.reference);
    state.history = [];
    state.future = [];
    state.layer = (doc.layers && doc.layers.length) ? doc.layers[doc.layers.length - 1].id : "";
    setRoute("compose");
  }

  function refMarkup() {
    var ref = state.attachment;
    if (!ref || !ref.ok) return "";
    var thumb = ref.preview ? '<img class="thumb" alt="" src="' + ref.preview + '"/>' : "";
    var size = (ref.width && ref.height) ? (ref.width + "\u00d7" + ref.height + " \u00b7 ") : "";
    var where = ref.file ? VeloraVxl.esc(ref.file) : "session only";
    return '<div class="row">' + thumb + '<div><strong>' + VeloraVxl.esc(ref.name || "reference") +
      '</strong><div class="muted">' + size + VeloraVxl.esc(ref.mime || "image") + " \u00b7 " + Math.round((ref.bytes || 0) / 1024) +
      " KB \u00b7 " + where + "</div></div></div>";
  }

  function paintRef() {
    var slot = document.getElementById("refSlot");
    var msg = document.getElementById("refMsg");
    if (!slot || !msg) return;
    slot.innerHTML = refMarkup();
    if (state.attachment && state.attachment.ok) {
      msg.className = "ok";
      msg.textContent = "Image stays on this device. Trace builds VXL paths. Needle still reads only the brief.";
    } else if (state.attachment && state.attachment.error && state.attachment.error !== "cancelled") {
      msg.className = "warn";
      msg.textContent = state.attachment.error;
    } else {
      msg.className = "muted";
      msg.textContent = "No image attached. Trace will use the file stored under files/attachments.";
    }
  }

  function renderCompose() {
    var path = activeProvider();
    var pathNote = path.kind === "remote"
      ? "Optional planner: " + plannerLabel(path.name) + ". Brief is sent only on compose. Images stay on device."
      : (path.missingKey
        ? plannerLabel(path.missingKey) + " has no key. Compose stays on Needle."
        : "Skill pack: " + state.type + ". Needle emit_vxl, then the app compiles. No API key.");
    $.innerHTML = '<h1>Compose</h1><p class="muted">' + VeloraVxl.esc(pathNote) + "</p>" +
      '<div class="grid"><button type="button" class="chip' + (state.type === "logo" ? " on" : "") + '" data-type="logo">Logo</button>' +
      '<button type="button" class="chip' + (state.type === "textile" ? " on" : "") + '" data-type="textile">Textile</button>' +
      '<button type="button" class="chip' + (state.type === "character" ? " on" : "") + '" data-type="character">Character</button>' +
      '<button type="button" class="chip' + (state.type === "icon" ? " on" : "") + '" data-type="icon">Icon</button></div>' +
      (state.type === "textile" ? '<label>Repeat</label><div class="grid">' +
        ["block", "half-drop", "half-brick", "mirror"].map(function (rep) {
          return '<button type="button" class="chip' + (state.repeat === rep ? " on" : "") + '" data-rep="' + rep + '">' + rep + "</button>";
        }).join("") + "</div>" : "") +
      '<div class="card"><label for="brief">Brief</label><textarea id="brief" placeholder="Geometric falcon mark for North Workshop, two inks."></textarea>' +
      '<div class="row"><button type="button" class="btn" id="composeBtn">Compose</button></div>' +
      '<p class="muted">Default path stays on this device if Needle cannot run.</p></div>' +
      '<div class="card"><h2>Reference</h2><p class="muted">Optional image. Stored on this device. Not sent to Needle.</p>' +
      '<div id="refSlot"></div>' +
      '<div class="row"><button type="button" class="btn" id="pickRef">Attach image</button>' +
      '<button type="button" class="btn" id="traceBtn">Trace to VXL</button>' +
      '<button type="button" class="ghost" id="clearRef">Remove</button>' +
      '<input id="refFile" type="file" accept="image/*" class="hidden"/></div>' +
      '<p id="refMsg" class="muted"></p></div>' +
      '<div class="card"><h2>Import VXL</h2><p class="muted">Paste a VXL 1 document. Invalid JSON is rejected before compile.</p>' +
      '<textarea id="paste" placeholder="Paste a VXL 1 document"></textarea>' +
      '<div class="row"><button type="button" class="btn" id="importBtn">Render pasted VXL</button>' +
      '<button type="button" class="ghost" id="sampleBtn">Load sample</button>' +
      '<label class="ghost" for="file">Open file<input id="file" type="file" accept="application/json,.json" class="hidden"/></label></div>' +
      '<p id="importMsg" class="muted"></p></div><div id="out"></div>';
    var chips = $.querySelectorAll("[data-type]");
    for (var i = 0; i < chips.length; i++) chips[i].onclick = function () { state.type = this.getAttribute("data-type"); renderCompose(); };
    var reps = $.querySelectorAll("[data-rep]");
    for (var j = 0; j < reps.length; j++) reps[j].onclick = function () { state.repeat = this.getAttribute("data-rep"); renderCompose(); };
    document.getElementById("composeBtn").onclick = function () {
      var brief = (document.getElementById("brief").value || "").trim() || (state.type === "logo" ? "Mark for Velora" : "Floral for summer cloth");
      var btn = this;
      btn.disabled = true;
      sessionA(brief, function (made) {
        btn.disabled = false;
        if (!made.ok) {
          document.getElementById("out").innerHTML = '<div class="status warn">' + VeloraVxl.esc((made.errors || [made.error || "compose failed"]).join("; ")) + "</div>";
          return;
        }
        state.history = [];
        state.future = [];
        state.layer = "";
        document.getElementById("out").innerHTML = showScene(made.document, made.note);
        bindScene();
      });
    };
    document.getElementById("pickRef").onclick = function () { VeloraReference.pick(); };
    document.getElementById("clearRef").onclick = function () { VeloraReference.clear(); };
    document.getElementById("traceBtn").onclick = function () { runTrace(); };
    document.getElementById("refFile").onchange = function () {
      var file = this.files && this.files[0];
      if (file) VeloraReference.fromFile(file);
    };
    paintRef();
    document.getElementById("importBtn").onclick = function () { importText(document.getElementById("paste").value); };
    document.getElementById("sampleBtn").onclick = function () {
      document.getElementById("paste").value = JSON.stringify(sample(), null, 2);
      importText(document.getElementById("paste").value);
    };
    document.getElementById("file").onchange = function () {
      var file = this.files && this.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { importText(String(reader.result || "")); };
      reader.readAsText(file);
    };
    if (state.doc) {
      document.getElementById("out").innerHTML = showScene(state.doc, "Current scene");
      bindScene();
    }
  }

  function mergeArgs(base, got) {
    if (!got) return base;
    if (got.category && VeloraSkills.packs[got.category]) base.category = got.category;
    if (got.name) base.name = String(got.name).slice(0, 80);
    if (got.brief) base.brief = String(got.brief).slice(0, 500);
    if (got.palette && got.palette.figure && got.palette.ground && got.palette.accent) base.palette = got.palette;
    if (got.style) base.style = got.style;
    if (got.motif) base.motif = got.motif;
    if (got.repeat && got.repeat.type) base.repeat = got.repeat;
    if (got.grid) base.grid = got.grid;
    if (got.parts && got.parts.length) base.parts = got.parts;
    if (got.viewBox && got.viewBox.length === 4) base.viewBox = got.viewBox;
    if (got.inkCount) base.inkCount = got.inkCount;
    return base;
  }


  function showTrace(result, note) {
    if (!result.ok) {
      document.getElementById("out").innerHTML = '<div class="status warn">' + VeloraVxl.esc(result.error || "trace failed") + "</div>";
      return;
    }
    var brief = (document.getElementById("brief") && document.getElementById("brief").value || "").trim();
    var name = state.attachment && state.attachment.name ? state.attachment.name : "Trace";
    var draft = VeloraTrace.documentFrom(result, brief, name);
    VeloraReference.bindDocument(draft);
    var checked = VeloraVxl.validate(draft);
    if (!checked.ok) {
      document.getElementById("out").innerHTML = '<div class="status warn">' + VeloraVxl.esc(checked.errors.join("; ")) + "</div>";
      return;
    }
    publishScene(checked.document, note + " / " + result.contours + " paths");
  }

  function runTrace() {
    var ref = VeloraReference.current();
    if (!ref || !ref.ok) {
      document.getElementById("out").innerHTML = '<div class="status warn">Attach an image before tracing.</div>';
      return;
    }
    if (window.VeloraAttach && window.VeloraAttach.raster && ref.id && ref.store !== "session") {
      var raw = window.VeloraAttach.raster(String(ref.id));
      var payload = raw;
      if (typeof raw === "string") {
        try { payload = JSON.parse(raw); } catch (error) { payload = { ok: false, error: "parse" }; }
      }
      showTrace(VeloraTrace.fromRaster(payload), "Autotrace / device file");
      return;
    }
    if (!ref.preview) {
      document.getElementById("out").innerHTML = '<div class="status warn">No local pixels for this reference.</div>';
      return;
    }
    var img = new Image();
    img.onload = function () {
      VeloraTrace.fromImage(img, function (result) { showTrace(result, "Autotrace / preview"); });
    };
    img.onerror = function () {
      document.getElementById("out").innerHTML = '<div class="status warn">Unreadable reference.</div>';
    };
    img.src = ref.preview;
  }

  function sessionNeedle(brief) {
    var skill = VeloraSkills.route(brief, state.type);
    var call = VeloraNeedleClient.complete({ brief: brief, skill: skill, repeat: state.repeat });
    var locked = call.ok ? VeloraSkills.lockArgs(call.arguments) : { ok: false };
    var args = mergeArgs(VeloraSkills.argumentsFromBrief(brief, skill, state.repeat), locked.ok ? locked.arguments : null);
    var accepted = VeloraSkills.accept(args);
    var expanded = accepted.ok ? accepted : VeloraSkills.expand(args);
    var note = call.ok && locked.ok ? "Needle emit_vxl / " + skill : "Skill expand / " + skill;
    if (!accepted.ok) {
      expanded = VeloraSkills.expand(VeloraSkills.argumentsFromBrief(brief, skill, state.repeat));
      var repaired = expanded.ok ? VeloraVxl.validate(expanded.document) : expanded;
      if (repaired.ok) expanded = { ok: true, document: repaired.document, errors: [], warnings: repaired.warnings || [] };
      note = "Skill repair / " + skill;
    }
    if (!expanded.ok) return expanded;
    VeloraReference.bindDocument(expanded.document);
    var ref = VeloraReference.summary();
    if (ref.attached) note += " / reference " + ref.name;
    expanded.note = note + " / no key" + (call.error ? " (" + call.error + ")" : "");
    expanded.reference = ref;
    return expanded;
  }

  function sessionA(brief, done) {
    var path = activeProvider();
    if (path.kind !== "remote") {
      done(sessionNeedle(brief));
      return;
    }
    var stored = providers();
    var skill = VeloraSkills.route(brief, state.type);
    var built = VeloraPlannerClient.build(path.name, stored.keys[path.name], brief, skill, state.repeat);
    VeloraPlannerClient.send(built, function (call) {
      if (!call.ok) {
        var local = sessionNeedle(brief);
        if (local.ok) local.note += " / remote fallback (" + (call.error || "planner") + ")";
        done(local);
        return;
      }
      var accepted = VeloraSkills.accept(mergeArgs(VeloraSkills.argumentsFromBrief(brief, skill, state.repeat), call.arguments));
      if (!accepted.ok) {
        var repair = sessionNeedle(brief);
        if (repair.ok) repair.note += " / remote repair";
        done(repair);
        return;
      }
      var expanded = accepted;
      VeloraReference.bindDocument(expanded.document);
      var ref = VeloraReference.summary();
      var note = plannerLabel(path.name) + " emit_vxl / " + skill + " / validator / opt-in";
      if (ref.attached) note += " / reference " + ref.name;
      expanded.note = note;
      expanded.reference = ref;
      done(expanded);
    });
  }

  function importText(text) {
    var checked = VeloraVxl.validate(text);
    var msg = document.getElementById("importMsg");
    if (!checked.ok) {
      msg.className = "warn";
      msg.textContent = checked.errors.join("; ");
      return;
    }
    msg.className = "ok";
    msg.textContent = "Valid VXL. Compiled.";
    state.history = [];
    state.future = [];
    state.layer = "";
    document.getElementById("out").innerHTML = showScene(checked.document, "Imported VXL");
    bindScene();
  }

  function sample() {
    return {
      vxl: 1,
      meta: { id: "sample-mark", name: "Sample mark", category: "illustration", purpose: "scene", brief: "Two-ink mark with stroke" },
      canvas: { viewBox: [0, 0, 1024, 1024], units: "px" },
      palette: { ground: "#f6f1e8", figure: "#1b3358", accent: "#355e57" },
      repeat: null,
      layers: [{
        id: "art",
        name: "Art",
        visible: true,
        opacity: 1,
        shapes: [
          { id: "plate", type: "circle", role: "figure", cx: 512, cy: 460, r: 280 },
          { id: "ring", type: "circle", role: "accent", fill: "none", stroke: "accent", strokeWidth: 18, cx: 512, cy: 460, r: 180 },
          { id: "group", type: "group", transform: "translate(512 460)", children: [
            { id: "bar", type: "rect", role: "ground", fill: "ground", x: -18, y: -120, w: 36, h: 240 }
          ]},
          { id: "label", type: "text", role: "figure", x: 512, y: 860, size: 42, text: "Velora", anchor: "middle" }
        ]
      }]
    };
  }

  function renderProviders() {
    var p = providers();
    p.keys = p.keys || {};
    var active = pathName(p.active);
    if (active !== "needle" && !REMOTE[active]) active = "needle";
    $.innerHTML = '<h1>Providers</h1><p class="muted">Default path is Needle 2 on this device. Remote planners are opt-in.</p>' +
      '<div class="card"><h2>Active path</h2><select id="active">' +
      '<option value="needle"' + (active === "needle" ? " selected" : "") + ">Needle 2 (default, no key)</option>" +
      '<option value="openai"' + (active === "openai" ? " selected" : "") + ">OpenAI (optional planner)</option>" +
      '<option value="anthropic"' + (active === "anthropic" ? " selected" : "") + ">Anthropic (optional planner)</option>" +
      '<option value="gemini"' + (active === "gemini" ? " selected" : "") + ">Gemini (optional planner)</option>" +
      '<option value="openrouter"' + (active === "openrouter" ? " selected" : "") + ">OpenRouter (optional planner)</option></select>" +
      '<p class="muted">A remote planner runs only after you save its key and compose. The brief is sent. Reference images are not.</p></div>' +
      '<div class="card"><h2>Remote API keys</h2>' +
      '<label>OpenAI</label><input id="k_openai" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.openai || "") + '"/>' +
      '<label>Anthropic</label><input id="k_anthropic" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.anthropic || "") + '"/>' +
      '<label>Gemini</label><input id="k_gemini" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.gemini || "") + '"/>' +
      '<label>OpenRouter</label><input id="k_openrouter" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.openrouter || "") + '"/>' +
      '<div class="row"><button type="button" class="btn" id="saveKeys">Save keys</button></div>' +
      '<p class="muted">Keys stay on this device. They are not written into projects. Needle never reads them.</p></div>' +
      '<div class="card"><h2>On-device agent</h2><p class="muted">Asset path needle/needle-android-arm64. No API key.</p>' +
      '<div id="localStatus" class="status muted">Checking bundle\u2026</div></div>';
    document.getElementById("saveKeys").onclick = function () {
      var cur = providers();
      cur.keys = cur.keys || {};
      cur.keys.openai = document.getElementById("k_openai").value.trim();
      cur.keys.anthropic = document.getElementById("k_anthropic").value.trim();
      cur.keys.gemini = document.getElementById("k_gemini").value.trim();
      cur.keys.openrouter = document.getElementById("k_openrouter").value.trim();
      cur.active = pathName(document.getElementById("active").value);
      saveProviders(cur);
      var st = document.createElement("p");
      st.className = "ok";
      st.textContent = "Saved on device. A remote planner runs only if it is the active path.";
      document.getElementById("saveKeys").parentNode.appendChild(st);
    };
    document.getElementById("active").onchange = function () {
      var cur = providers();
      cur.active = pathName(this.value);
      saveProviders(cur);
    };
    var local = document.getElementById("localStatus");
    var needle = VeloraNeedleClient.status();
    if (needle.present && needle.loaded) {
      local.className = "status ok";
      local.textContent = "Needle 2 ready (" + needle.bytes + " bytes, " + (needle.abi || needle.engine) + "). keyRequired is false.";
    } else if (needle.present) {
      local.className = "status ok";
      local.textContent = "Needle asset present. This ABI uses skill expand. No API key.";
    } else {
      local.className = "status warn";
      local.textContent = (needle.error || "Needle 2 asset missing at needle/needle-android-arm64.") + " Skill expand still runs without a key.";
    }
  }

  function renderSettings() {
    $.innerHTML = '<h1>Workshop</h1><div class="card"><h2>Theme</h2><button type="button" class="btn" id="themeBtn">' +
      (theme() === "dark" ? "Dark ink" : "Light paper") + "</button></div>" +
      '<div class="card"><h2>Privacy</h2><p>Projects stay on this device. The default path does not read or send an API key. Saved projects never include keys. Reference images stay in app files and are not uploaded. An optional planner sends the brief only.</p></div>' +
      '<div class="card"><h2>Device store</h2><p class="muted">' + VeloraProjects.list().length + ' projects in local storage.</p>' +
      '<button type="button" class="ghost" id="wipe">Clear saved projects</button></div>' +
      '<div class="card"><h2>About</h2><p class="muted">Velora Studio. VXL 1 is the source of truth. The compiler is deterministic: same document, same SVG.</p></div>';
    document.getElementById("themeBtn").onclick = function () {
      var next = theme() === "light" ? "dark" : "light";
      localStorage.setItem("velora.theme", next);
      document.documentElement.dataset.theme = next;
      renderSettings();
    };
    document.getElementById("wipe").onclick = function () {
      VeloraProjects.clear();
      renderSettings();
    };
  }

  window.VeloraApp = {
    onAttachment: function (payload) {
      state.attachment = payload && payload.ok ? payload : (payload && payload.error ? payload : null);
      if (state.route === "compose") paintRef();
    }
  };

  setRoute("studio");

  document.addEventListener("keydown", function (ev) {
    if (!state.doc) return;
    var tag = ev.target && ev.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    var meta = ev.metaKey || ev.ctrlKey;
    if (!meta) return;
    var key = String(ev.key || "").toLowerCase();
    if (key === "z" && !ev.shiftKey) { ev.preventDefault(); undoDoc(); }
    if (key === "y" || (key === "z" && ev.shiftKey)) { ev.preventDefault(); redoDoc(); }
  });
})();
