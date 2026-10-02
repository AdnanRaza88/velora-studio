# Code Connection Map

Last updated: 2026-10-03 00:20

## 1. Entry Points

- `app/src/main/java/app/velora/studio/MainActivity.kt` loads `file:///android_asset/www/index.html`
- `.github/workflows/android.yml` builds `assembleDebug` and uploads `velora-debug-apk`

## 2. File Inventory

| Path | Role | Key exports | Depends on | Depended by |
|------|------|-------------|------------|-------------|
| app/src/main/java/app/velora/studio/MainActivity.kt | WebView shell | MainActivity | AndroidX, NeedleBridge | manifest |
| app/src/main/java/app/velora/studio/NeedleBridge.kt | Needle asset status and emit_vxl | NeedleBridge.status, complete | assets/needle | MainActivity, needle.js |
| app/src/main/assets/needle/needle-android-arm64 | Needle 2 arm64 binary | none | none | NeedleBridge |
| app/src/main/assets/www/js/needle.js | JS status client | VeloraNeedleClient.status, complete | VeloraNeedle | app.js |
| app/src/main/assets/www/index.html | Workshop shell | routes | js/vxl.js, js/projects.js, js/skills.js, js/needle.js, js/app.js | WebView |
| app/src/main/assets/www/js/vxl.js | Schema, validate, compile, procedural builders | VeloraVxl.validate, compile, buildLogo, buildTextile | none | app.js, tools/vxl-golden.js |
| app/src/main/assets/www/js/projects.js | Device project store | VeloraProjects | localStorage | app.js |
| app/src/main/assets/www/js/skills.js | Skill packs and emit_vxl expand | VeloraSkills.compose, route, expand | VeloraVxl | app.js, tools/skill-packs.js |
| app/src/main/java/app/velora/studio/AttachmentBridge.kt | Image pick, store, lookup | VeloraAttach.pick, lookup, clear | files/attachments | MainActivity, attach.js |
| app/src/main/assets/www/js/attach.js | Session reference | VeloraReference.bindDocument, restore | VeloraAttach | app.js |
| app/src/main/assets/www/js/editor.js | Select, bake, recolor, pen anchors | VeloraEdit.apply, hitTest, moveHandle, recolor | none | app.js, tools/editor-check.js |
| app/src/main/assets/www/js/app.js | Routes and compose/import UI | sessionA default path | VeloraVxl, VeloraProjects, VeloraSkills, VeloraNeedleClient, VeloraReference, VeloraEdit | index.html |
| app/src/main/assets/skills/*.json | APK skill packs + emit_vxl schema | pack id, system, tool | none | Needle asset load |
| docs/spec/VXL.md | VXL 1 contract | schema | none | compiler |
| docs/plan/VELORA_PHASES.md | Phase tracker | none | none | agents |

## 3. Import / Call Graph

- index.html loads vxl.js, projects.js, skills.js, needle.js, attach.js, trace.js, editor.js, then app.js
- app.js sessionA calls VeloraNeedleClient.complete, then VeloraSkills.expand. It does not read provider keys
- skills.js calls VeloraVxl.buildLogo, buildTextile, validate
- app.js calls VeloraProjects.list, get, save, remove, clear
- MainActivity exposes VeloraNeedle.status and complete via addJavascriptInterface. Storage is WebView DOM storage (domStorageEnabled)
- Default active path is needle. Stored offline/local values map to needle. Remote keys stay in velora.providers and are unused until Phase 6

## 4. Critical Shared Contracts

- VXL version key: `vxl: 1` defined in docs/spec/VXL.md and VeloraVxl.validate
- Palette roles: ground, figure, accent
- Repeat types: block, half-drop, half-brick, mirror
- Storage keys: `velora.projects`, `velora.providers`, `velora.theme`
- Provider keys must not be copied into project documents
- Session A default path: keyRequired false

## 5. Change Impact Rules

- Compiler output changes must stay deterministic for a fixed document
- Do not add network calls from the shell except future explicit provider sends
- Keep script tags classic (no ES modules) so file:// WebView loads them
- android.yml artifact name stays `velora-debug-apk`

## 6. Recent Changes Log

- 2026-10-03 Phase 4 pen anchors: handles and moveHandle rewrite path d
- 2026-10-02 Phase 4 select/move/scale/rotate: VeloraEdit bakes geometry, canvas hit-test
- 2026-10-02 Phase 3b attach image: meta.reference plus files/attachments lookup, no raster in VXL
- 2026-10-02 Phase 3 default path: Needle plus skill expand, no remote key
- 2026-10-02 Phase 3 Needle bundle: android-arm64 asset + status bridge
- 2026-10-02 Phase 3 skill packs: logo, textile, character, icon + emit_vxl schema
- 2026-10-02 Phase 2 harden: skill aliases, raster reject, palette repair warnings, golden tests
- 2026-10-02 Phase 2: VXL 1 schema, compiler, paste/file import, device project store
- 2026-10-02 Phase 1: nav, procedural logo/textile, provider key UI, SVG download
