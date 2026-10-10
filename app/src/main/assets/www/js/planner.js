(function (root) {
  var HOSTS = {
    openai: "https://api.openai.com/v1/chat/completions",
    anthropic: "https://api.anthropic.com/v1/messages",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    openrouter: "https://openrouter.ai/api/v1/chat/completions"
  };
  var MODELS = {
    openai: "gpt-4o-mini",
    anthropic: "claude-3-5-haiku-latest",
    gemini: "gemini-2.0-flash",
    openrouter: "openai/gpt-4o-mini"
  };

  function schema() {
    if (!root.VeloraSkills || !root.VeloraSkills.toolSpec) return null;
    return root.VeloraSkills.toolSpec();
  }

  function tool() {
    var spec = schema();
    return {
      type: "function",
      function: {
        name: spec.name,
        description: spec.description,
        parameters: spec.parameters
      }
    };
  }

  function userText(brief, skill, repeat) {
    var lines = [
      String(brief || "").slice(0, 500),
      "Call emit_vxl once.",
      "category: " + skill
    ];
    if (skill === "textile") lines.push("repeat type: " + (repeat || "half-drop"));
    if (skill === "icon") lines.push("grid: 48");
    lines.push("Do not request or describe a reference image. Pixels stay on device.");
    return lines.join("\n");
  }

  function build(provider, key, brief, skill, repeat) {
    var id = HOSTS[provider] ? provider : "";
    var pack = root.VeloraSkills && root.VeloraSkills.packs[skill];
    var spec = schema();
    var system = (pack && pack.system) || "";
    var secret = String(key || "");
    if (!id) return { ok: false, error: "Unknown provider. Choose OpenAI, Anthropic, Gemini, or OpenRouter." };
    if (!secret) return { ok: false, error: "No API key saved for " + id + ". Open Providers, paste the key, and save." };
    if (!pack || !spec) return { ok: false, error: "Skill pack or emit_vxl schema missing. Restart the app." };
    var user = userText(brief, skill, repeat);
    var body;
    var headers = { "Content-Type": "application/json" };
    if (id === "anthropic") {
      headers["x-api-key"] = secret;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: MODELS.anthropic,
        max_tokens: 800,
        system: system,
        tools: [{ name: "emit_vxl", description: schema().description, input_schema: schema().parameters }],
        tool_choice: { type: "tool", name: "emit_vxl" },
        messages: [{ role: "user", content: user }]
      };
    } else if (id === "gemini") {
      headers["x-goog-api-key"] = secret;
      body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        tools: [{ functionDeclarations: [{ name: "emit_vxl", description: schema().description, parameters: schema().parameters }] }],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["emit_vxl"] } }
      };
    } else {
      headers.Authorization = "Bearer " + secret;
      if (id === "openrouter") {
        headers["HTTP-Referer"] = "https://github.com/AdnanRaza88/velora-studio";
        headers["X-Title"] = "Velora Studio";
      }
      body = {
        model: MODELS[id],
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        tools: [tool()],
        tool_choice: { type: "function", function: { name: "emit_vxl" } }
      };
    }
    return { ok: true, provider: id, url: HOSTS[id], headers: headers, body: body };
  }

  function readArgs(value) {
    if (!value) return null;
    if (typeof value === "string") {
      try { return JSON.parse(value); } catch (error) { return null; }
    }
    if (typeof value === "object") return value;
    return null;
  }

  function extract(payload) {
    var data = payload;
    if (typeof payload === "string") {
      try { data = JSON.parse(payload); } catch (error) { return null; }
    }
    if (!data || typeof data !== "object") return null;
    var choice = data.choices && data.choices[0] && data.choices[0].message;
    var calls = choice && choice.tool_calls;
    if (calls && calls[0] && calls[0].function) return readArgs(calls[0].function.arguments);
    var blocks = data.content;
    if (blocks && blocks.length) {
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].type === "tool_use" && blocks[i].name === "emit_vxl") return readArgs(blocks[i].input);
      }
    }
    var parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
    if (parts && parts.length) {
      for (var j = 0; j < parts.length; j++) {
        if (parts[j].functionCall && parts[j].functionCall.name === "emit_vxl") return readArgs(parts[j].functionCall.args);
      }
    }
    if (data.category && data.palette) return data;
    return null;
  }

  function send(built, done) {
    if (!built || !built.ok) {
      done({ ok: false, error: (built && built.error) || "Planner unavailable." });
      return;
    }
    if (!root.VeloraPlanner || !root.VeloraPlanner.post) {
      done({ ok: false, error: "Native planner bridge missing. Remote providers need the Android app build." });
      return;
    }
    root.VeloraPlannerClient._wait = function (raw) {
      root.VeloraPlannerClient._wait = null;
      var packet = raw;
      if (typeof raw === "string") {
        try { packet = JSON.parse(raw); } catch (error) { packet = { ok: false, error: "Planner response could not be parsed." }; }
      }
      if (!packet || !packet.ok) {
        done({ ok: false, provider: built.provider, error: (packet && packet.error) || "Planner request failed." });
        return;
      }
      var args = extract(packet.body);
      var locked = root.VeloraSkills && root.VeloraSkills.lockArgs(args);
      if (!locked || !locked.ok) {
        done({ ok: false, provider: built.provider, error: "Remote reply had no valid emit_vxl call. Check the model supports tools, then retry." });
        return;
      }
      done({ ok: true, provider: built.provider, arguments: locked.arguments });
    };
    try {
      root.VeloraPlanner.post(JSON.stringify({
        url: built.url,
        headers: built.headers,
        body: JSON.stringify(built.body)
      }));
    } catch (error) {
      root.VeloraPlannerClient._wait = null;
      done({ ok: false, error: "Could not post to the planner bridge." });
    }
  }

  function onResult(raw) {
    if (root.VeloraPlanner && root.VeloraPlannerClient._wait) root.VeloraPlannerClient._wait(raw);
  }

  root.VeloraPlannerClient = {
    hosts: HOSTS,
    models: MODELS,
    build: build,
    extract: extract,
    send: send,
    onResult: onResult
  };
})(typeof window !== "undefined" ? window : globalThis);
