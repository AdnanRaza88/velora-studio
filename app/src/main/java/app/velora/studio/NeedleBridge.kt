package app.velora.studio

import android.content.Context
import android.os.Build
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class NeedleBridge(private val context: Context) {
    @JavascriptInterface
    fun status(): String {
        return try {
            context.assets.openFd(ASSET_PATH).use { fd ->
                val abi = Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown"
                val arm = Build.SUPPORTED_ABIS.any { it == "arm64-v8a" }
                JSONObject()
                    .put("present", fd.length == EXPECTED_BYTES)
                    .put("asset", ASSET_PATH)
                    .put("bytes", fd.length)
                    .put("expectedBytes", EXPECTED_BYTES)
                    .put("sha256", EXPECTED_SHA256)
                    .put("abi", abi)
                    .put("engine", "needle2")
                    .put("arm64", arm)
                    .put("loaded", arm && fd.length == EXPECTED_BYTES)
                    .put("keyRequired", false)
                    .put("reason", if (arm) "ready for emit_vxl" else "binary is android-arm64; skill expand is the fallback")
                    .toString()
            }
        } catch (error: Exception) {
            JSONObject()
                .put("present", false)
                .put("asset", ASSET_PATH)
                .put("bytes", 0)
                .put("loaded", false)
                .put("keyRequired", false)
                .put("error", error.message ?: "missing")
                .toString()
        }
    }

    @JavascriptInterface
    fun complete(request: String): String {
        val started = System.currentTimeMillis()
        return try {
            val input = JSONObject(request)
            val brief = input.optString("brief").trim().take(500)
            if (brief.isEmpty()) return fail("empty brief", started)
            if (!Build.SUPPORTED_ABIS.any { it == "arm64-v8a" }) {
                return fail("needle binary is android-arm64", started)
            }
            val binary = extractBinary()
            val tools = writeTools()
            val prompt = input.optString("prompt").ifBlank { brief }.take(900)
            var result = runNeedle(binary, tools, prompt)
            var parsed = parseCall(result.stdout)
            if (parsed == null) {
                val retryPrompt = (prompt + "\nCall emit_vxl once with the required fields.").take(900)
                result = runNeedle(binary, tools, retryPrompt)
                parsed = parseCall(result.stdout)
            }
            if (parsed == null) {
                return fail(result.error ?: "no emit_vxl call", started, result.stdout.take(400))
            }
            JSONObject()
                .put("ok", true)
                .put("source", "needle")
                .put("tool", parsed.optString("name"))
                .put("arguments", parsed.optJSONObject("arguments") ?: JSONObject())
                .put("confidence", result.confidence)
                .put("keyRequired", false)
                .put("elapsedMs", System.currentTimeMillis() - started)
                .toString()
        } catch (error: Exception) {
            fail(error.message ?: "needle failed", started)
        }
    }

    private fun extractBinary(): File {
        val dir = File(context.codeCacheDir, "needle")
        if (!dir.exists()) dir.mkdirs()
        val out = File(dir, "needle")
        if (!out.exists() || out.length() != EXPECTED_BYTES) {
            context.assets.open(ASSET_PATH).use { input ->
                out.outputStream().use { input.copyTo(it) }
            }
            out.setReadable(true, true)
            out.setExecutable(true, true)
        }
        return out
    }

    private fun writeTools(): File {
        val dir = File(context.filesDir, "needle")
        if (!dir.exists()) dir.mkdirs()
        val out = File(dir, "tools.json")
        val schema = context.assets.open("skills/emit_vxl.schema.json").bufferedReader().use { it.readText() }
        out.writeText(JSONArray().put(JSONObject(schema)).toString())
        return out
    }

    private fun runNeedle(binary: File, tools: File, prompt: String): Run {
        val process = ProcessBuilder(binary.absolutePath, "--tools", tools.absolutePath, "--prompt", prompt)
            .redirectErrorStream(false)
            .start()
        val finished = process.waitFor(45, TimeUnit.SECONDS)
        if (!finished) {
            process.destroyForcibly()
            return Run("", null, "needle timed out")
        }
        val stdout = process.inputStream.bufferedReader().use { it.readText() }
        val stderr = process.errorStream.bufferedReader().use { it.readText() }
        val confidence = confidenceOf(stdout)
        if (process.exitValue() != 0 && parseCall(stdout) == null) {
            return Run(stdout, confidence, stderr.ifBlank { "exit ${process.exitValue()}" }.take(240))
        }
        return Run(stdout, confidence, null)
    }

    private fun fail(message: String, started: Long, raw: String = ""): String {
        return JSONObject()
            .put("ok", false)
            .put("source", "fallback")
            .put("keyRequired", false)
            .put("error", message)
            .put("raw", raw)
            .put("elapsedMs", System.currentTimeMillis() - started)
            .toString()
    }

    data class Run(val stdout: String, val confidence: Double?, val error: String?)

    companion object {
        const val ASSET_PATH = "needle/needle-android-arm64"
        const val EXPECTED_BYTES = 14824824L
        const val EXPECTED_SHA256 = "8c2915dd5024948d0efa5dc277d2688166761f17138cc648783f7782b369de81"

        fun parseCall(stdout: String): JSONObject? {
            val start = stdout.indexOf('{')
            val end = stdout.lastIndexOf('}')
            if (start < 0 || end <= start) return null
            val root = try {
                JSONObject(stdout.substring(start, end + 1))
            } catch (_: Exception) {
                return null
            }
            val calls = root.optJSONArray("function_calls") ?: return null
            for (i in 0 until calls.length()) {
                val call = calls.optJSONObject(i) ?: continue
                if (call.optString("name") == "emit_vxl") return call
            }
            return null
        }

        private fun confidenceOf(stdout: String): Double? {
            val start = stdout.indexOf('{')
            val end = stdout.lastIndexOf('}')
            if (start < 0 || end <= start) return null
            return try {
                val value = JSONObject(stdout.substring(start, end + 1)).optDouble("confidence")
                if (value.isNaN()) null else value
            } catch (_: Exception) {
                null
            }
        }
    }
}
