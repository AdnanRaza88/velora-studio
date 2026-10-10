package app.velora.studio

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import java.nio.charset.StandardCharsets

class ExportBridge(
    private val activity: Activity,
    private val launch: (Intent) -> Unit
) {
    private var pendingName = "velora.svg"
    private var pendingMime = "image/svg+xml"
    private var pendingText = ""

    @JavascriptInterface
    fun save(name: String?, mime: String?, text: String?) {
        pendingName = cleanName(name)
        pendingMime = if (mime.isNullOrBlank()) "text/plain" else mime
        pendingText = text ?: ""
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = pendingMime
            putExtra(Intent.EXTRA_TITLE, pendingName)
        }
        activity.runOnUiThread { launch(intent) }
    }

    fun onCreated(uri: Uri?) {
        if (uri == null) return
        val payload = pendingText
        Thread {
            try {
                activity.contentResolver.openOutputStream(uri)?.use { out ->
                    out.write(payload.toByteArray(StandardCharsets.UTF_8))
                }
            } catch (_: Exception) {
            }
        }.start()
    }

    private fun cleanName(name: String?): String {
        val raw = if (name.isNullOrBlank()) "velora.svg" else name
        val trimmed = raw.trim().take(80)
        return if (trimmed.isEmpty()) "velora.svg" else trimmed
    }
}
