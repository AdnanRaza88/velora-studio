(function (root) {
  var current = null;

  function summary() {
    if (!current || !current.ok) return { attached: false, trace: "autotrace" };
    return {
      attached: true,
      id: current.id,
      name: current.name,
      mime: current.mime,
      bytes: current.bytes,
      width: current.width || 0,
      height: current.height || 0,
      store: current.store || "files/attachments",
      file: current.file || ("files/attachments/" + current.id),
      trace: "autotrace"
    };
  }

  function apply(payload) {
    var data = payload;
    if (typeof payload === "string") {
      try { data = JSON.parse(payload); } catch (error) { data = { ok: false, error: "parse" }; }
    }
    if (!data || !data.ok) {
      current = data && data.error ? data : null;
    } else {
      current = data;
      if (!current.file && current.id) current.file = "files/attachments/" + current.id;
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
      var img = new Image();
      img.onload = function () {
        apply({
          ok: true,
          id: "session-" + Date.now(),
          name: file.name,
          mime: file.type,
          bytes: file.size,
          width: img.naturalWidth || 0,
          height: img.naturalHeight || 0,
          store: "session",
          file: "",
          trace: "autotrace",
          preview: String(reader.result || "")
        });
      };
      img.onerror = function () {
        apply({ ok: false, error: "unreadable" });
      };
      img.src = String(reader.result || "");
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

  function bindDocument(doc) {
    if (!doc || !doc.meta) return doc;
    var ref = summary();
    if (!ref.attached) {
      delete doc.meta.reference;
      return doc;
    }
    doc.meta.reference = {
      id: ref.id,
      name: ref.name,
      mime: ref.mime,
      bytes: ref.bytes,
      width: ref.width,
      height: ref.height,
      store: ref.store,
      file: ref.file
    };
    return doc;
  }

  function restore(ref) {
    if (!ref || !ref.id) {
      current = null;
      if (root.VeloraApp && root.VeloraApp.onAttachment) root.VeloraApp.onAttachment(null);
      return;
    }
    if (root.VeloraAttach && root.VeloraAttach.lookup) {
      var found = root.VeloraAttach.lookup(String(ref.id));
      if (typeof found === "string") {
        try { found = JSON.parse(found); } catch (error) { found = { ok: false, error: "parse" }; }
      }
      if (found && found.ok) {
        found.name = ref.name || found.name;
        found.mime = ref.mime || found.mime;
      }
      apply(found);
      return;
    }
    apply({
      ok: true,
      id: ref.id,
      name: ref.name,
      mime: ref.mime,
      bytes: ref.bytes,
      width: ref.width,
      height: ref.height,
      store: ref.store || "session",
      file: ref.file || "",
      trace: "autotrace"
    });
  }

  root.VeloraReference = {
    pick: pick,
    fromFile: fromFile,
    clear: clear,
    summary: summary,
    apply: apply,
    bindDocument: bindDocument,
    restore: restore,
    current: function () { return current; }
  };
  root.VeloraAttachReceive = apply;
})(typeof window !== "undefined" ? window : globalThis);
