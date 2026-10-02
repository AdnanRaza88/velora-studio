# Needle 2 android-arm64

Bundled asset path (exact):

`app/src/main/assets/needle/needle-android-arm64`

Runtime asset URI: `file:///android_asset/needle/needle-android-arm64`

Source: Cactus-Compute/needle2 `android-arm64/needle` (Hugging Face).
License: Apache-2.0. Upstream header: `needle.h` in this folder.
SHA-256: `8c2915dd5024948d0efa5dc277d2688166761f17138cc648783f7782b369de81`
Size: 14824824 bytes.

This file is the self-contained Needle 2 engine+weights binary for arm64-v8a.
It is stored uncompressed in the APK (`noCompress`).

Session A extracts it to the app code cache, marks it executable, and runs:

`needle --tools tools.json --prompt "<brief + skill constraints>"`

`tools.json` is `emit_vxl.schema.json` wrapped as a one-tool array. Stdout is parsed for `function_calls[].name == emit_vxl`. The app expands those arguments into VXL and compiles SVG. Non-arm64 devices and exec failures fall back to the skill expander. No API key. `libneedle.a` is not vendored.
