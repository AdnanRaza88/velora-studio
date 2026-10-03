var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");
var ctx = { console: console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "app/src/main/assets/www/js/vxl.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "app/src/main/assets/www/js/skills.js"), "utf8"), ctx);

var schema = JSON.parse(fs.readFileSync(path.join(root, "app/src/main/assets/skills/emit_vxl.schema.json"), "utf8"));
if (schema.name !== "emit_vxl") throw new Error("tool name");
["logo", "textile", "character", "icon"].forEach(function (id) {
  var pack = JSON.parse(fs.readFileSync(path.join(root, "app/src/main/assets/skills", id + ".json"), "utf8"));
  if (pack.id !== id || pack.tool !== "emit_vxl" || !pack.system) throw new Error("pack " + id);
  if (ctx.VeloraSkills.packs[id].system !== pack.system) throw new Error("system drift " + id);
  var made = ctx.VeloraSkills.compose("sample " + id + " brief", id, "half-drop");
  if (!made.ok) throw new Error(id + " " + made.errors.join("; "));
  if (made.document.meta.skill !== id) throw new Error("skill tag " + id);
  var svg = ctx.VeloraVxl.compile(made.document);
  if (svg.indexOf("<svg") < 0) throw new Error("compile " + id);
  console.log("ok", id, made.tool, made.document.layers.length);
});
var routed = ctx.VeloraSkills.route("half-drop floral cloth", "");
if (routed !== "textile") throw new Error("route textile");
console.log("skill packs ok");

var tapered = ctx.VeloraSkills.compose("taper line mark", "logo", "");
if (!tapered.ok || tapered.arguments.strokeProfile !== "taper") throw new Error("taper args");
var named = false;
tapered.document.layers.forEach(function (layer) {
  layer.shapes.forEach(function (shape) {
    if (shape.profile === "taper" && shape.widthProfile && shape.widthProfile.length >= 2) named = true;
  });
});
if (!named) throw new Error("named profile");
var rejected = ctx.VeloraSkills.lockArgs({ category: "logo", name: "X", viewBox: [0, 0, 1, 1], palette: { ground: "#111111", figure: "#222222", accent: "#333333" }, strokeProfile: "blob" });
if (rejected.ok) throw new Error("profile lock");
console.log("stroke profiles ok");
