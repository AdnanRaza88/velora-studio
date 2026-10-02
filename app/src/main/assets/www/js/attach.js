(function (root) {
  var current = null;

  function summary() {
    if (!current || !current.ok) return { attached: false, trace: "phase-3b" };
    return {
      attached: true,
      id: current.id,
      name: current.name,
      mime: current.mime,
      bytes: current.bytes,
      store: current.store || "session",
      trace: "phase-3b"
    };
  }

  function apply(payload) {
    var data = payload;
    if (typeof payload === "string") {
      try { data = JSON.parse(payload); } catch (error) { data = { ok: false, error: "parse" }; }
    }
    if (!data || !data.ok) {
      current = null;
    } else {
      current = data;
    }
    if (root.VeloraApp && root.VeloraApp.onAttachment) root.VeloraApp.onAttachment(current);
  }

  function pick() {
    if (root.VeloraAttach && root.VeloraAttach.pick) {
      root.VeloraAttach.pick();
      return;
    }
    var input = document.getElementById("refFile");
    if (input) input.click();
  }

  function fromFile(file) {
    if (!file) return;
    if (!file.type || file.type.indexOf("image/") !== 0) {
      apply({ ok: false, error: "not an image" });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      apply({ ok: false, error: "image over 12 MB" });
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      apply({
        ok: true,
        id: "session-" + Date.now(),
        name: file.name,
        mime: file.type,
        bytes: file.size,
        store: "session",
        trace: "phase-3b",
        preview: String(reader.result || "")
      });
    };
    reader.readAsDataURL(file);
  }

  function clear() {
    if (current && current.id && root.VeloraAttach && root.VeloraAttach.clear) {
      root.VeloraAttach.clear(String(current.id));
    }
    current = null;
    if (root.VeloraApp && root.VeloraApp.onAttachment) root.VeloraApp.onAttachment(null);
  }

  root.VeloraReference = {
    pick: pick,
    fromFile: fromFile,
    clear: clear,
    summary: summary,
    apply: apply,
    current: function () { return current; }
  };
  root.VeloraAttachReceive = apply;
})(typeof window !== "undefined" ? window : globalThis);
