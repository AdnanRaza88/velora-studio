var fs = require("fs");
var path = require("path");
var vm = require("vm");

var root = path.join(__dirname, "..");
var ctx = { console: console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "app/src/main/assets/www/js/skills.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(root, "app/src/main/assets/www/js/planner.js"), "utf8"), ctx);

var secret = "sk-test-not-a-real-key";
["openai", "anthropic", "gemini", "openrouter"].forEach(function (id) {
  var built = ctx.VeloraPlannerClient.build(id, secret, "Falcon mark", "logo", "half-drop");
  if (!built.ok) throw new Error("build " + id);
  if (built.url.indexOf(ctx.VeloraPlannerClient.hosts[id]) !== 0) throw new Error("host " + id);
  if (built.url.indexOf("http://") === 0) throw new Error("cleartext " + id);
  var raw = JSON.stringify(built.body);
  if (raw.indexOf(secret) >= 0) throw new Error("key leaked into body " + id);
  if (built.body.tools === undefined && id !== "gemini") throw new Error("tools " + id);
  var system = ctx.VeloraSkills.packs.logo.system;
  var packed = JSON.stringify(built.body);
  if (packed.indexOf(system) < 0) throw new Error("skill system " + id);
  if (packed.indexOf("emit_vxl") < 0) throw new Error("tool name " + id);
  console.log("ok", id, built.url);
});

var openai = ctx.VeloraPlannerClient.extract({
  choices: [{ message: { tool_calls: [{ function: { name: "emit_vxl", arguments: "{\"category\":\"logo\",\"name\":\"Falcon\"}" } }] } }]
});
if (!openai || openai.category !== "logo") throw new Error("openai extract");

var anthropic = ctx.VeloraPlannerClient.extract({
  content: [{ type: "tool_use", name: "emit_vxl", input: { category: "icon", name: "Mark" } }]
});
if (!anthropic || anthropic.category !== "icon") throw new Error("anthropic extract");

var gemini = ctx.VeloraPlannerClient.extract({
  candidates: [{ content: { parts: [{ functionCall: { name: "emit_vxl", args: { category: "textile", name: "Cloth" } } }] } }]
});
if (!gemini || gemini.category !== "textile") throw new Error("gemini extract");

var missing = ctx.VeloraPlannerClient.build("openai", "", "brief", "logo", "");
if (missing.ok) throw new Error("empty key should not build");
console.log("planner check ok");
