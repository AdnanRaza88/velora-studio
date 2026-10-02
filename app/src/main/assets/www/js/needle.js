(function (root) {
  var ASSET = "needle/needle-android-arm64";

  function status() {
    if (!root.VeloraNeedle || !root.VeloraNeedle.status) {
      return { present: false, asset: ASSET, bytes: 0, error: "bridge missing" };
    }
    try {
      return JSON.parse(root.VeloraNeedle.status());
    } catch (error) {
      return { present: false, asset: ASSET, bytes: 0, error: "status parse" };
    }
  }

  root.VeloraNeedleClient = { asset: ASSET, status: status };
})(typeof window !== "undefined" ? window : globalThis);
