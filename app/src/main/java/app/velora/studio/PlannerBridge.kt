package app.velora.studio

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import java.net.URL

class PlannerBridge(private val webView: () -> WebView) {
    @JavascriptInterface
    fun post(requestJson: String) {
        Thread {
            val result = run(requestJson)
            val js = "window.VeloraPlannerClient&&window.VeloraPlannerClient.onResult(" + JSONObject.quote(result) + ")"
            webView().post { webView().evaluateJavascript(js, null) }
        }.start()
    }

    private fun run(requestJson: String): String {
        return try {
            val request = JSONObject(requestJson)
            val url = URL(request.getString("url"))
            if (!allowed(url)) return fail("Host not allowed. Only OpenAI, Anthropic, Gemini, and OpenRouter HTTPS endpoints are permitted.")
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 20_000
                readTimeout = 30_000
                instanceFollowRedirects = false
                doOutput = true
                val headers = request.getJSONObject("headers")
                val names = headers.keys()
                while (names.hasNext()) {
                    val name = names.next()
                    setRequestProperty(name, headers.getString(name))
                }
            }
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(request.getString("body"))
            }
            val status = connection.responseCode
            if (status in 300..399) return fail("Redirect refused ($status). The planner endpoint must respond without a redirect.")
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty().take(120_000)
            if (status !in 200..299) return fail(httpMessage(status, text, url.host))
            JSONObject().put("ok", true).put("body", text).toString()
        } catch (error: UnknownHostException) {
            fail("Network DNS failed. Check connectivity, then try again.")
        } catch (error: SocketTimeoutException) {
            fail("Planner timed out. Check connectivity or try again in a moment.")
        } catch (error: Exception) {
            fail("Planner unreachable. Check connectivity and that the API key is valid.")
        }
    }

    private fun httpMessage(status: Int, body: String, host: String): String {
        val detail = apiDetail(body)
        val base = when (status) {
            400 -> "Bad request from $host"
            401 -> "API key rejected by $host (HTTP 401). Open Providers, paste a valid key, and save."
            403 -> "Access denied by $host (HTTP 403). The key may lack permission or the model is blocked."
            404 -> "Planner endpoint not found on $host (HTTP 404)."
            429 -> "Rate limit or quota exceeded on $host (HTTP 429). Wait or check billing, then retry."
            in 500..599 -> "Planner server error on $host (HTTP $status). Try again later."
            else -> "Planner HTTP $status from $host"
        }
        return if (detail.isNotEmpty()) "$base — $detail" else base
    }

    private fun apiDetail(body: String): String {
        if (body.isBlank()) return ""
        return try {
            val json = JSONObject(body)
            val err = json.optJSONObject("error")
            if (err != null) {
                val msg = err.optString("message").ifBlank { err.optString("type") }
                if (msg.isNotBlank()) return msg.take(180)
            }
            val message = json.optString("message")
            if (message.isNotBlank()) return message.take(180)
            val status = json.optJSONObject("error")?.optString("status")
            if (!status.isNullOrBlank()) return status.take(80)
            ""
        } catch (_: Exception) {
            body.replace(Regex("\\s+"), " ").trim().take(120)
        }
    }

    private fun allowed(url: URL): Boolean {
        if (url.protocol != "https") return false
        val host = url.host.lowercase()
        return host == "api.openai.com" ||
            host == "api.anthropic.com" ||
            host == "generativelanguage.googleapis.com" ||
            host == "openrouter.ai"
    }

    private fun fail(message: String): String {
        return JSONObject().put("ok", false).put("error", message).toString()
    }
}
