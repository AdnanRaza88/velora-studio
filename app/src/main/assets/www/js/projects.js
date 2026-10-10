(function (root) {
  var KEY = "velora.projects";
  var MAX = 40;
  var MAX_BYTES = 1500000;

  function read() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function write(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Device storage is full. Download the VXL file instead." };
    }
  }

  function summarize(doc) {
    return {
      id: doc.meta.id,
      name: doc.meta.name,
      category: doc.meta.category,
      updated: doc.meta.updated,
      bytes: JSON.stringify(doc).length,
      vxl: doc
    };
  }

  function list() {
    return read().map(function (item) {
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        updated: item.updated,
        bytes: item.bytes || 0
      };
    });
  }

  function get(id) {
    var found = read().filter(function (item) { return item.id === id; })[0];
    return found ? found.vxl : null;
  }

  function save(doc) {
    if (!doc || !doc.meta || !doc.meta.id) return { ok: false, error: "Project has no id" };
    var payload = JSON.stringify(doc);
    if (payload.length > MAX_BYTES) {
      return { ok: false, error: "Project is too large to store on device. Download the VXL file." };
    }
    var items = read().filter(function (item) { return item.id !== doc.meta.id; });
    items.unshift(summarize(doc));
    if (items.length > MAX) items = items.slice(0, MAX);
    var wrote = write(items);
    if (!wrote.ok) return wrote;
    return { ok: true, id: doc.meta.id, bytes: payload.length };
  }

  function remove(id) {
    var wrote = write(read().filter(function (item) { return item.id !== id; }));
    return wrote;
  }

  function clear() {
    try {
      localStorage.removeItem(KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "Could not clear saved projects" };
    }
  }

  function exportAll() {
    return JSON.stringify(read());
  }

  function importBundle(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: "Not a project file" }; }
    if (!Array.isArray(parsed)) return { ok: false, error: "Not a project library" };
    var items = read();
    var added = 0;
    parsed.forEach(function (item) {
      var doc = item && item.vxl;
      if (!doc || !doc.meta || !doc.meta.id) return;
      items = items.filter(function (existing) { return existing.id !== doc.meta.id; });
      items.unshift(summarize(doc));
      added++;
    });
    if (items.length > MAX) items = items.slice(0, MAX);
    var wrote = write(items);
    if (!wrote.ok) return wrote;
    return { ok: true, added: added };
  }

  function used() {
    var total = 0;
    read().forEach(function (item) { total += item.bytes || 0; });
    return { count: list().length, bytes: total, limit: MAX_BYTES };
  }

  root.VeloraProjects = {
    list: list,
    get: get,
    save: save,
    remove: remove,
    clear: clear,
    exportAll: exportAll,
    importBundle: importBundle,
    used: used
  };
})(typeof window !== "undefined" ? window : globalThis);
