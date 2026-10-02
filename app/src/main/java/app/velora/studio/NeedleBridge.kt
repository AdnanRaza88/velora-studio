package app.velora.studio

import android.content.Context
import android.webkit.JavascriptInterface
import org.json.JSONObject

class NeedleBridge(private val context: Context) {
    @JavascriptInterface
    fun status(): String {
        return try {
            context.assets.openFd(ASSET_PATH).use { fd ->
                JSONObject()
                    .put("present", fd.length == EXPECTED_BYTES)
                    .put("asset", ASSET_PATH)
                    .put("bytes", fd.length)
                    .put("expectedBytes", EXPECTED_BYTES)
                    .put("sha256", EXPECTED_SHA256)
                    .put("abi", "android-arm64")
                    .put("engine", "needle2")
                    .put("loaded", false)
                    .put("reason", "bundled; tool call is the next phase")
                    .toString()
            }
        } catch (error: Exception) {
            JSONObject()
                .put("present", false)
                .put("asset", ASSET_PATH)
                .put("bytes", 0)
                .put("error", error.message ?: "missing")
                .toString()
        }
    }

    companion object {
        const val ASSET_PATH = "needle/needle-android-arm64"
        const val EXPECTED_BYTES = 14824824L
        const val EXPECTED_SHA256 = "8c2915dd5024948d0efa5dc277d2688166761f17138cc648783f7782b369de81"
    }
}
