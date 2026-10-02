(function () {
  var $ = document.getElementById("app");
  var nav = document.getElementById("nav");
  var state = { route: "studio", type: "logo", repeat: "half-drop", doc: null, svg: "", attachment: null, sel: "", tool: "select" };
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
      return { kind: "needle", name: "Needle 2", keyRequired: false, stored: active };
    }
    return { kind: "needle", name: "Needle 2", keyRequired: false, stored: "needle" };
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
        shapeRows += '<div class="project' + (shape.id === state.sel ? " on" : "") + '" data-pick="' + key + '"><div><strong>' + VeloraVxl.esc(shape.id) + '</strong><div class="muted">' +
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
      '<button type="button" class="ghost' + (state.tool === "pen" ? " on" : "") + '" id="penMode">Anchors</button></div>' +
      inkControls(checked.document) +
      '<p class="muted" id="selMsg">' + (state.sel ? "Selected " + VeloraVxl.esc(state.sel) + (state.tool === "pen" ? ". Drag an anchor or its Bezier handle. The path is rewritten in VXL." : ". Drag the canvas to move. Geometry is written back into VXL.") : "Select a shape on the canvas or in the list.") + "</p>" +
      '<p class="muted">' + VeloraVxl.esc(note || checked.document.meta.name) + " \u00b7 " + layers + " layers \u00b7 " + shapes + " shapes" +
      (checked.document.repeat ? " \u00b7 " + checked.document.repeat.type : "") +
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

  function overlayMarks(doc) {
    var box = state.sel ? VeloraEdit.bounds(VeloraEdit.find(doc, state.sel)) : null;
    var marks = box ? '<rect x="' + box.x + '" y="' + box.y + '" width="' + Math.max(box.w, 1) + '" height="' + Math.max(box.h, 1) + '"/>' : "";
    if (state.tool !== "pen" || !state.sel) return marks;
    var shape = VeloraEdit.find(doc, state.sel);
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
    var picks = document.querySelectorAll("[data-pick]");
    for (var p = 0; p < picks.length; p++) {
      picks[p].onclick = function (ev) {
        if (ev.target.closest("select,button")) return;
        var parts = this.getAttribute("data-pick").split(":");
        var shape = state.doc.layers[Number(parts[0])].shapes[Number(parts[1])];
        state.sel = shape ? shape.id : "";
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
      state.sel = hit ? hit.id : "";
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
      if (drag.kind === "handle") {
        VeloraEdit.moveHandle(state.doc, drag.id, drag.i, drag.role, pt.x, pt.y);
        drag.moved = true;
        paintArt();
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
      drag = null;
      if (moved) publishScene(state.doc, kind === "handle" ? "Anchor edited" : "Moved");
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
    if (msg) msg.textContent = state.sel ? "Selected " + state.sel + (state.tool === "pen" ? ". Drag an anchor or its Bezier handle. The path is rewritten in VXL." : ". Drag the canvas to move. Geometry is written back into VXL.") : "Select a shape on the canvas or in the list.";
  }

  function publishScene(doc, note) {
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
    if (out) {
      out.innerHTML = showScene(checked.document, note);
      bindScene();
    }
    var paste = document.getElementById("paste");
    if (paste) paste.value = JSON.stringify(checked.document, null, 2);
    return checked;
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
    setRoute("compose");
    var out = document.getElementById("out");
    out.innerHTML = showScene(doc, "Loaded from device");
    bindScene();
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
    $.innerHTML = '<h1>Compose</h1><p class="muted">Skill pack: ' + VeloraVxl.esc(state.type) + '. Needle emit_vxl, then the app compiles. No API key.</p>' +
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
      var made = sessionA(brief);
      if (!made.ok) {
        document.getElementById("out").innerHTML = '<div class="status warn">' + VeloraVxl.esc(made.errors.join("; ")) + "</div>";
        return;
      }
      document.getElementById("out").innerHTML = showScene(made.document, made.note);
      bindScene();
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

  function sessionA(brief) {
    var skill = VeloraSkills.route(brief, state.type);
    var call = VeloraNeedleClient.complete({ brief: brief, skill: skill, repeat: state.repeat });
    var args = mergeArgs(VeloraSkills.argumentsFromBrief(brief, skill, state.repeat), call.arguments);
    var expanded = VeloraSkills.expand(args);
    var note = call.ok ? "Needle emit_vxl / " + skill : "Skill expand / " + skill;
    if (!expanded.ok) {
      expanded = VeloraSkills.expand(VeloraSkills.argumentsFromBrief(brief, skill, state.repeat));
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
    $.innerHTML = '<h1>Providers</h1><p class="muted">Default path is Needle 2 on this device. Remote keys are optional and unused.</p>' +
      '<div class="card"><h2>Active path</h2><select id="active">' +
      '<option value="needle"' + (active === "needle" ? " selected" : "") + ">Needle 2 (default, no key)</option>" +
      '<option value="openai"' + (active === "openai" ? " selected" : "") + ">OpenAI (stored, unused)</option>" +
      '<option value="anthropic"' + (active === "anthropic" ? " selected" : "") + ">Anthropic (stored, unused)</option>" +
      '<option value="gemini"' + (active === "gemini" ? " selected" : "") + ">Gemini (stored, unused)</option>" +
      '<option value="openrouter"' + (active === "openrouter" ? " selected" : "") + ">OpenRouter (stored, unused)</option></select>" +
      '<p class="muted">Choosing a remote name does not send the brief. Compose still uses Needle.</p></div>' +
      '<div class="card"><h2>Remote API keys</h2>' +
      '<label>OpenAI</label><input id="k_openai" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.openai || "") + '"/>' +
      '<label>Anthropic</label><input id="k_anthropic" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.anthropic || "") + '"/>' +
      '<label>Gemini</label><input id="k_gemini" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.gemini || "") + '"/>' +
      '<label>OpenRouter</label><input id="k_openrouter" type="password" placeholder="optional" value="' + VeloraVxl.esc(p.keys.openrouter || "") + '"/>' +
      '<div class="row"><button type="button" class="btn" id="saveKeys">Save keys</button></div>' +
      '<p class="muted">Keys stay on this device. They are not read by Session A and are not written into projects.</p></div>' +
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
      st.textContent = "Saved on device. Compose still does not use these keys.";
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
      '<div class="card"><h2>Privacy</h2><p>Projects stay on this device. The default path does not read or send an API key. Saved projects never include keys. Reference images stay in app files and are not uploaded.</p></div>' +
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
})();
