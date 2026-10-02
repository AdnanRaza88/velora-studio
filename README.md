# Velora Studio

Purpose-first vector design studio. A brief or a VXL document becomes an editable vector scene — logo, textile, illustration — compiled to SVG. Raster is a preview, never the source.

## App

Android WebView shell (`app.velora.studio`) loads the on-device workshop:

- **Studio** — pipeline status and saved projects
- **New** — logo / textile brief, or paste / open VXL JSON
- **Providers** — remote key slots (device only) and local model slot
- **Settings** — theme, privacy, clear projects

VXL 1 is the source of truth. See `docs/spec/VXL.md`.

## Build APK (GitHub Actions)

Push to `main` or run **Actions → Android APK → Run workflow**.

Artifact name: **`velora-debug-apk`**

Download from the workflow run page after the job finishes.

## Local build

```bash
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 17 + Android SDK.

## Privacy

Projects and keys stay on device. The studio engine does not send briefs by default. Saved projects do not include API keys.
