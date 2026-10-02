(function (root) {
  var ASSET = "needle/needle-android-arm64";

  function status() {
    if (!root.VeloraNeedle || !root.VeloraNeedle.status) {
      return { present: false, asset: ASSET, bytes: 0, loaded: false, keyRequired: false, error: "bridge missing" };
    }
    try {
      var parsed = JSON.parse(root.VeloraNeedle.status());
      parsed.keyRequired = false;
      return parsed;
    } catch (error) {
      return { present: false, asset: ASSET, bytes: 0, loaded: false, keyRequired: false, error: "status parse" };
    }
  }

  function promptFor(brief, skill, repeat) {
    var pack = root.VeloraSkills && root.VeloraSkills.packs[skill];
    var lines = [
      String(brief || "").slice(0, 500),
      "Call emit_vxl once.",
      "category: " + skill
    ];
    if (skill === "textile") lines.push("repeat type: " + (repeat || "half-drop"));
    if (skill === "icon") lines.push("grid: 48");
    if (pack && pack.system) lines.push(pack.system);
    return lines.join("\n").slice(0, 900);
  }

  function complete(payload) {
    var body = payload || {};
    var skill = body.skill || "logo";
    var request = {
      brief: String(body.brief || "").slice(0, 500),
      skill: skill,
      repeat: body.repeat || "",
      prompt: body.prompt || promptFor(body.brief, skill, body.repeat)
    };
    if (!root.VeloraNeedle || !root.VeloraNeedle.complete) {
      return { ok: false, source: "fallback", keyRequired: false, error: "bridge missing" };
    }
    try {
      var parsed = JSON.parse(root.VeloraNeedle.complete(JSON.stringify(request)));
      parsed.keyRequired = false;
      return parsed;
    } catch (error) {
      return { ok: false, source: "fallback", keyRequired: false, error: "complete parse" };
    }
  }

  root.VeloraNeedleClient = {
    asset: ASSET,
    status: status,
    promptFor: promptFor,
    complete: complete
  };
})(typeof window !== "undefined" ? window : globalThis);
