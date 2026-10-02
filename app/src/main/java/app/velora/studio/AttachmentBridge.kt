package app.velora.studio

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.UUID

class AttachmentBridge(
    private val activity: Activity,
    private val webView: () -> WebView,
    private val launch: () -> Unit
) {
    @JavascriptInterface
    fun pick() {
        activity.runOnUiThread { launch() }
    }

    @JavascriptInterface
    fun lookup(id: String): String {
        val file = find(id) ?: return JSONObject().put("ok", false).put("error", "missing").toString()
        return describe(file, includePreview = true).toString()
    }

    @JavascriptInterface
    fun clear(id: String) {
        find(id)?.delete()
    }

    @JavascriptInterface
    fun raster(id: String): String {
        val file = find(id) ?: return JSONObject().put("ok", false).put("error", "missing").toString()
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
            return JSONObject().put("ok", false).put("error", "unreadable").toString()
        }
        var sample = 1
        val edge = maxOf(bounds.outWidth, bounds.outHeight)
        while (edge / sample > 96) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, opts)
            ?: return JSONObject().put("ok", false).put("error", "unreadable").toString()
        val w = bitmap.width
        val h = bitmap.height
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        bitmap.recycle()
        val luma = ByteArray(w * h)
        for (i in pixels.indices) {
            val c = pixels[i]
            val r = (c shr 16) and 0xff
            val g = (c shr 8) and 0xff
            val b = c and 0xff
            luma[i] = ((r * 54 + g * 183 + b * 19) shr 8).toByte()
        }
        return JSONObject()
            .put("ok", true)
            .put("width", w)
            .put("height", h)
            .put("luma", Base64.encodeToString(luma, Base64.NO_WRAP))
            .toString()
    }

    fun onPicked(uri: Uri?) {
        if (uri == null) {
            deliver(JSONObject().put("ok", false).put("error", "cancelled"))
            return
        }
        Thread {
            val payload = store(uri)
            activity.runOnUiThread { deliver(payload) }
        }.start()
    }

    private fun deliver(payload: JSONObject) {
        val arg = JSONObject.quote(payload.toString())
        webView().evaluateJavascript("VeloraAttachReceive($arg)", null)
    }

    private fun dir(): File = File(activity.filesDir, "attachments").apply { mkdirs() }

    private fun store(uri: Uri): JSONObject {
        val resolver = activity.contentResolver
        val mime = resolver.getType(uri) ?: "image/jpeg"
        if (!mime.startsWith("image/")) {
            return JSONObject().put("ok", false).put("error", "not an image")
        }
        val id = UUID.randomUUID().toString()
        val ext = when {
            mime.contains("png") -> "png"
            mime.contains("webp") -> "webp"
            mime.contains("gif") -> "gif"
            else -> "jpg"
        }
        val dest = File(dir(), "$id.$ext")
        val input = resolver.openInputStream(uri)
            ?: return JSONObject().put("ok", false).put("error", "unreadable")
        input.use { stream -> dest.outputStream().use { out -> stream.copyTo(out) } }
        if (dest.length() > 12L * 1024L * 1024L) {
            dest.delete()
            return JSONObject().put("ok", false).put("error", "image over 12 MB")
        }
        val named = describe(dest, includePreview = true)
        named.put("name", queryName(uri) ?: "reference.$ext")
        named.put("mime", mime)
        return named
    }

    private fun find(id: String): File? {
        val safe = id.replace(Regex("[^a-zA-Z0-9-]"), "")
        if (safe.isEmpty()) return null
        return dir().listFiles()?.firstOrNull { it.name.startsWith("$safe.") }
    }

    private fun describe(file: File, includePreview: Boolean): JSONObject {
        val ext = file.extension.ifEmpty { "jpg" }
        val mime = when (ext) {
            "png" -> "image/png"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            else -> "image/jpeg"
        }
        val id = file.name.substringBeforeLast('.')
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        val payload = JSONObject()
            .put("ok", true)
            .put("id", id)
            .put("name", file.name)
            .put("mime", mime)
            .put("bytes", file.length())
            .put("width", bounds.outWidth)
            .put("height", bounds.outHeight)
            .put("store", "files/attachments")
            .put("file", "files/attachments/${file.name}")
            .put("trace", "phase-3b")
        if (includePreview) payload.put("preview", previewData(file, bounds))
        return payload
    }

    private fun queryName(uri: Uri): String? {
        val cursor = activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            ?: return null
        cursor.use {
            if (!it.moveToFirst()) return null
            val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index < 0) return null
            return it.getString(index)
        }
    }

    private fun previewData(file: File, bounds: BitmapFactory.Options): String {
        var sample = 1
        val edge = maxOf(bounds.outWidth, bounds.outHeight)
        while (edge / sample > 480) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, opts) ?: return ""
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 70, out)
        bitmap.recycle()
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}
