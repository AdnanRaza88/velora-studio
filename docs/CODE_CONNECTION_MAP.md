# Code Connection Map

Last updated: 2026-10-02 13:20

## 1. Entry Points

- `app/src/main/java/app/velora/studio/MainActivity.kt` loads `file:///android_asset/www/index.html`
- `.github/workflows/android.yml` builds `assembleDebug` and uploads `velora-debug-apk`

## 2. File Inventory

| Path | Role | Key exports | Depends on | Depended by |
|------|------|-------------|------------|-------------|
| app/src/main/java/app/velora/studio/MainActivity.kt | WebView shell | MainActivity | AndroidX | manifest |
| app/src/main/assets/www/index.html | Workshop shell | routes | js/vxl.js, js/projects.js, js/app.js | WebView |
| app/src/main/assets/www/js/vxl.js | Schema, validate, compile, procedural builders | VeloraVxl.validate, compile, buildLogo, buildTextile | none | app.js, tools/vxl-golden.js |
| app/src/main/assets/www/js/projects.js | Device project store | VeloraProjects | localStorage | app.js |
| app/src/main/assets/www/js/app.js | Routes and compose/import UI | none | VeloraVxl, VeloraProjects | index.html |
| docs/spec/VXL.md | VXL 1 contract | schema | none | compiler |
| docs/plan/VELORA_PHASES.md | Phase tracker | none | none | agents |

## 3. Import / Call Graph

- index.html loads vxl.js, then projects.js, then app.js
- app.js calls VeloraVxl.validate, compile, buildLogo, buildTextile
- app.js calls VeloraProjects.list, get, save, remove, clear
- MainActivity does not bridge JS. Storage is WebView DOM storage (domStorageEnabled)

## 4. Critical Shared Contracts

- VXL version key: `vxl: 1` defined in docs/spec/VXL.md and VeloraVxl.validate
- Palette roles: ground, figure, accent
- Repeat types: block, half-drop, half-brick, mirror
- Storage keys: `velora.projects`, `velora.providers`, `velora.theme`
- Provider keys must not be copied into project documents

## 5. Change Impact Rules

- Compiler output changes must stay deterministic for a fixed document
- Do not add network calls from the shell except future explicit provider sends
- Keep script tags classic (no ES modules) so file:// WebView loads them
- android.yml artifact name stays `velora-debug-apk`

## 6. Recent Changes Log

- 2026-10-02 Phase 2 harden: skill aliases, raster reject, palette repair warnings, golden tests
- 2026-10-02 Phase 2: VXL 1 schema, compiler, paste/file import, device project store
- 2026-10-02 Phase 1: nav, procedural logo/textile, provider key UI, SVG download
