(function (root) {
  var KEY = "velora.projects";
  var MAX = 30;
  var MAX_BYTES = 180000;

  function read() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function write(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function summarize(doc) {
    return {
      id: doc.meta.id,
      name: doc.meta.name,
      category: doc.meta.category,
      updated: doc.meta.updated,
      vxl: doc
    };
  }

  function list() {
    return read().map(function (item) {
      return { id: item.id, name: item.name, category: item.category, updated: item.updated };
    });
  }

  function get(id) {
    var found = read().filter(function (item) { return item.id === id; })[0];
    return found ? found.vxl : null;
  }

  function save(doc) {
    var payload = JSON.stringify(doc);
    if (payload.length > MAX_BYTES) return { ok: false, error: "Project is too large to store on device" };
    var items = read().filter(function (item) { return item.id !== doc.meta.id; });
    items.unshift(summarize(doc));
    if (items.length > MAX) items = items.slice(0, MAX);
    write(items);
    return { ok: true, id: doc.meta.id };
  }

  function remove(id) {
    write(read().filter(function (item) { return item.id !== id; }));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  root.VeloraProjects = { list: list, get: get, save: save, remove: remove, clear: clear };
})(typeof window !== "undefined" ? window : globalThis);
