(function () {
  var $ = document.getElementById("app");
  var nav = document.getElementById("nav");
  var state = { route: "studio", type: "logo", repeat: "half-drop", doc: null, svg: "" };

  function theme() { return localStorage.getItem("velora.theme") || "light"; }
  document.documentElement.dataset.theme = theme();

  function providers() {
    try { return JSON.parse(localStorage.getItem("velora.providers") || "{}"); }
    catch (e) { return {}; }
  }
  function saveProviders(p) { localStorage.setItem("velora.providers", JSON.stringify(p)); }

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
    if (p.active === "local") return { kind: "local", name: p.localModel || "Needle (planned)" };
    if (p.active && p.keys && p.keys[p.active]) return { kind: "remote", name: p.active };
    return { kind: "offline", name: "On-device procedural" };
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
    return '<div class="card" id="scene">' + state.svg +
      '<p class="muted">' + VeloraVxl.esc(note || checked.document.meta.name) + " \u00b7 " + layers + " layers \u00b7 " + shapes + " shapes" +
      (checked.document.repeat ? " \u00b7 " + checked.document.repeat.type : "") + "</p>" +
      '<label for="pname">Project name</label><input id="pname" value="' + VeloraVxl.esc(checked.document.meta.name) + '"/>' +
      '<div class="row"><button type="button" class="btn" id="saveP">Save on device</button>' +
      '<button type="button" class="ghost" id="dlSvg">Download SVG</button>' +
      '<button type="button" class="ghost" id="dlVxl">Download VXL</button>' +
      '<button type="button" class="ghost" id="showVxl">Show VXL</button></div>' +
      '<p id="saveMsg" class="muted"></p><pre id="vxlBox" class="hidden"></pre></div>';
  }

  function bindScene() {
    var save = document.getElementById("saveP");
    if (!save) return;
    save.onclick = function () {
      state.doc.meta.name = document.getElementById("pname").value.trim() || state.doc.meta.name;
      state.doc.meta.updated = new Date().toISOString();
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
    document.getElementById("showVxl").onclick = function () {
      var box = document.getElementById("vxlBox");
      box.classList.toggle("hidden");
      box.textContent = JSON.stringify(state.doc, null, 2);
    };
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
      '<div class="card"><h2>Pipeline</h2><p class="muted">Brief or pasted JSON \u2192 validate \u2192 compile. Provider: <strong style="color:var(--fg)">' +
      VeloraVxl.esc(ap.name) + "</strong> (" + ap.kind + ').</p><div class="row"><button type="button" class="btn" id="goNew">New composition</button>' +
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
    setRoute("compose");
    var out = document.getElementById("out");
    out.innerHTML = showScene(doc, "Loaded from device");
    bindScene();
  }

  function renderCompose() {
    var ap = activeProvider();
    $.innerHTML = '<h1>Compose</h1><p class="muted">Skill pack: ' + VeloraVxl.esc(state.type) + '. emit_vxl fills VXL. The app compiles.</p>' +
      '<div class="grid"><button type="button" class="chip' + (state.type === "logo" ? " on" : "") + '" data-type="logo">Logo</button>' +
      '<button type="button" class="chip' + (state.type === "textile" ? " on" : "") + '" data-type="textile">Textile</button>' +
      '<button type="button" class="chip' + (state.type === "character" ? " on" : "") + '" data-type="character">Character</button>' +
      '<button type="button" class="chip' + (state.type === "icon" ? " on" : "") + '" data-type="icon">Icon</button></div>' +
      (state.type === "textile" ? '<label>Repeat</label><div class="grid">' +
        ["block", "half-drop", "half-brick", "mirror"].map(function (rep) {
          return '<button type="button" class="chip' + (state.repeat === rep ? " on" : "") + '" data-rep="' + rep + '">' + rep + "</button>";
        }).join("") + "</div>" : "") +
      '<div class="card"><label for="brief">Brief</label><textarea id="brief" placeholder="Geometric falcon mark for North Workshop, two inks."></textarea>' +
      '<div class="row"><button type="button" class="btn" id="composeBtn">Compose</button></div></div>' +
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
    expanded.note = note + (call.error ? " (" + call.error + ")" : "");
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
    p.active = p.active || "offline";
    $.innerHTML = '<h1>Providers</h1><p class="muted">Keys stay on this device. Remote agents only receive the text you type.</p>' +
      '<div class="card"><h2>Active path</h2><select id="active">' +
      '<option value="offline"' + (p.active === "offline" ? " selected" : "") + ">Offline procedural (no key)</option>" +
      '<option value="openai"' + (p.active === "openai" ? " selected" : "") + ">OpenAI</option>" +
      '<option value="anthropic"' + (p.active === "anthropic" ? " selected" : "") + ">Anthropic</option>" +
      '<option value="gemini"' + (p.active === "gemini" ? " selected" : "") + ">Gemini</option>" +
      '<option value="openrouter"' + (p.active === "openrouter" ? " selected" : "") + ">OpenRouter</option>" +
      '<option value="local"' + (p.active === "local" ? " selected" : "") + ">Local on-device</option></select></div>" +
      '<div class="card"><h2>Remote API keys</h2>' +
      '<label>OpenAI</label><input id="k_openai" type="password" placeholder="sk-..." value="' + VeloraVxl.esc(p.keys.openai || "") + '"/>' +
      '<label>Anthropic</label><input id="k_anthropic" type="password" placeholder="sk-ant-..." value="' + VeloraVxl.esc(p.keys.anthropic || "") + '"/>' +
      '<label>Gemini</label><input id="k_gemini" type="password" placeholder="AIza..." value="' + VeloraVxl.esc(p.keys.gemini || "") + '"/>' +
      '<label>OpenRouter</label><input id="k_openrouter" type="password" placeholder="sk-or-..." value="' + VeloraVxl.esc(p.keys.openrouter || "") + '"/>' +
      '<div class="row"><button type="button" class="btn" id="saveKeys">Save keys</button></div>' +
      '<p class="muted">Phase 3 wires these to VXL generation. Keys are not written into projects.</p></div>' +
      '<div class="card"><h2>Local models</h2><p class="muted">Needle 2 is the default on-device agent. No API key. Asset path needle/needle-android-arm64.</p>' +
      '<div id="localStatus" class="status muted">Checking bundle…</div></div>';
    document.getElementById("saveKeys").onclick = function () {
      var cur = providers();
      cur.keys = cur.keys || {};
      cur.keys.openai = document.getElementById("k_openai").value.trim();
      cur.keys.anthropic = document.getElementById("k_anthropic").value.trim();
      cur.keys.gemini = document.getElementById("k_gemini").value.trim();
      cur.keys.openrouter = document.getElementById("k_openrouter").value.trim();
      cur.active = document.getElementById("active").value;
      saveProviders(cur);
      var st = document.createElement("p");
      st.className = "ok";
      st.textContent = "Saved on device.";
      document.getElementById("saveKeys").parentNode.appendChild(st);
    };
    document.getElementById("active").onchange = function () {
      var cur = providers();
      cur.active = this.value;
      saveProviders(cur);
    };
    var local = document.getElementById("localStatus");
    var needle = VeloraNeedleClient.status();
    if (needle.present) {
      local.className = "status ok";
      local.textContent = "Needle 2 bundled (" + needle.bytes + " bytes, " + (needle.abi || needle.engine) + "). Compose calls emit_vxl on device. No API key.";
    } else {
      local.className = "status warn";
      local.textContent = needle.error || "Needle 2 asset missing at needle/needle-android-arm64.";
    }
  }

  function renderSettings() {
    $.innerHTML = '<h1>Workshop</h1><div class="card"><h2>Theme</h2><button type="button" class="btn" id="themeBtn">' +
      (theme() === "dark" ? "Dark ink" : "Light paper") + "</button></div>" +
      '<div class="card"><h2>Privacy</h2><p>Projects and keys stay on this device. Remote providers only receive the brief you typed. Projects never include API keys.</p></div>' +
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

  setRoute("studio");
})();
