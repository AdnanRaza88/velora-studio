# Velora Studio

Purpose-first vector design studio. A brief becomes an editable vector scene — logo, textile, illustration — compiled to SVG. Raster is a preview, never the source.

## App

Android WebView shell (`app.velora.studio`) loads the on-device workshop:

- **Studio** — home
- **New** — Logo / Textile brief → on-device SVG
- **Settings** — light/dark theme, privacy

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

## Spec

See `docs/spec/` for PRD, VXL language, textile/logo skills, and roadmap.

## Privacy

Projects stay on device. The studio engine does not send briefs by default.
