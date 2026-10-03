package app.velora.studio

import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
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
            if (!allowed(url)) return fail("host refused")
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
            if (status in 300..399) return fail("redirect refused")
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use(BufferedReader::readText).orEmpty().take(120_000)
            if (status !in 200..299) return fail("planner http " + status)
            JSONObject().put("ok", true).put("body", text).toString()
        } catch (error: Exception) {
            fail("planner unreachable")
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
