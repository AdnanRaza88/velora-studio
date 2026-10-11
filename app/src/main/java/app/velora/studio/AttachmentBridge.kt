package app.velora.studio

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

class AttachmentBridge(private val activity: Activity) {

    private val dir: File
        get() = File(activity.filesDir, "attachments").apply { mkdirs() }

    @JavascriptInterface
    fun save(name: String, mime: String, b64: String): String {
        val id = System.currentTimeMillis().toString()
        val ext = when {
            mime.contains("png") -> "png"
            mime.contains("webp") -> "webp"
            else -> "jpg"
        }
        val file = File(dir, "$id.$ext")
        val bytes = Base64.decode(b64, Base64.DEFAULT)
        FileOutputStream(file).use { it.write(bytes) }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        return JSONObject()
            .put("ok", true)
            .put("id", id)
            .put("name", name)
            .put("mime", mime)
            .put("bytes", bytes.size)
            .put("width", bounds.outWidth)
            .put("height", bounds.outHeight)
            .put("file", file.name)
            .toString()
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
        while (edge / sample > 2560) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        var bitmap = BitmapFactory.decodeFile(file.absolutePath, opts)
            ?: return JSONObject().put("ok", false).put("error", "unreadable").toString()
        val longEdge = maxOf(bitmap.width, bitmap.height)
        if (longEdge > 2560) {
            val s = 2560f / longEdge
            val scaled = Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * s).toInt().coerceAtLeast(1),
                (bitmap.height * s).toInt().coerceAtLeast(1),
                true
            )
            if (scaled !== bitmap) bitmap.recycle()
            bitmap = scaled
        }
        val w = bitmap.width
        val h = bitmap.height
        val pixels = IntArray(w * h)
        bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
        bitmap.recycle()
        val luma = ByteArray(w * h)
        val rgb = ByteArray(w * h * 3)
        for (i in pixels.indices) {
            val p = pixels[i]
            val a = (p shr 24) and 0xff
            val r = (p shr 16) and 0xff
            val g = (p shr 8) and 0xff
            val b = p and 0xff
            if (a < 16) {
                luma[i] = 255.toByte()
                rgb[i * 3] = 255.toByte()
                rgb[i * 3 + 1] = 255.toByte()
                rgb[i * 3 + 2] = 255.toByte()
            } else {
                luma[i] = ((r * 299 + g * 587 + b * 114) / 1000).toByte()
                rgb[i * 3] = r.toByte()
                rgb[i * 3 + 1] = g.toByte()
                rgb[i * 3 + 2] = b.toByte()
            }
        }
        return JSONObject()
            .put("ok", true)
            .put("width", w)
            .put("height", h)
            .put("luma", Base64.encodeToString(luma, Base64.NO_WRAP))
            .put("rgb", Base64.encodeToString(rgb, Base64.NO_WRAP))
            .toString()
    }

    private fun find(id: String): File? {
        return dir.listFiles()?.firstOrNull { it.nameWithoutExtension == id }
    }

    private fun previewData(file: File, bounds: BitmapFactory.Options): String {
        var sample = 1
        val edge = maxOf(bounds.outWidth, bounds.outHeight)
        while (edge / sample > 2560) sample *= 2
        val opts = BitmapFactory.Options().apply { inSampleSize = sample }
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, opts) ?: return ""
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 70, out)
        bitmap.recycle()
        return "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}
