# Velora Studio — Build Phases

## Vision
JSON (VXL) is the design. Two sessions: (A) query → VXL via Needle + skills, (B) VXL → editable vector. High-level Illustrator-class output. Raster is preview only.

## Pipeline
Brief (+ optional attachment)
→ skill router
→ Needle 2 structured extract (bundled in APK)
→ VXL JSON
→ validate
→ vector engine
→ SVG canvas / edit / export

## Phase 0 — Shell (done)
- [x] Android WebView shell
- [x] GitHub Actions APK (`velora-debug-apk`)
- [x] Basic routes

## Phase 1 — Workshop core (done)
- [x] Navigation Studio / New / Providers / Settings
- [x] Offline prompt → procedural VXL → SVG
- [x] Textile repeats: block, half-drop, half-brick, mirror
- [x] SVG download + VXL JSON view

## Phase 2 — VXL engine (done / hardening)
- [x] VXL schema + compile to SVG
- [x] Paste/import VXL → render
- [x] Project save/load on device
- [x] Harden schema against skill output; golden tests

## Phase 3 — Skills + Needle-first agent (active)
- [x] Skill packs: logo, textile, character, icon (system instructions + tool schema)
- [x] Bundle Needle 2 android-arm64 binary in APK assets (~14 MB)
- [x] Session A: brief → Needle tool call → VXL → canvas
- [x] No remote key required for default path
- [x] Attachment picker UI (wire to image-to-vector in Phase 3b)

## Phase 3b — Reference / image to vector
- [x] Attach image
- [x] Autotrace → path simplify → VXL paths
- [x] User can edit result as normal VXL
- [x] Trace quality: 1024-edge raster, median denoise, despeckle, mask smooth, 1px stroke bridge, small-hole fill, ink-label majority, light background and transparent pixels ignored, boundary settle, orthogonal runs snapped, subpixel iso placement on the threshold (soft field for multi-ink), corner-preserving simplify, repeated close vertices dropped before corner cuts, chord-length least-squares cubics with two Newton reparameterization passes, opticurve merges adjacent cubics inside a corner span and drops near-flat cubics to lines (alphamax / opttolerance), holes as evenodd subpaths
- [x] Multi-ink trace: up to four separated fills (figure, accent, ink2, ink3), light paper ignored, seams overlapped one pixel; device raster sends packed RGB; single-ink stays binary; ink clusters and pixel assignment use OKLab so close logo hues stay apart
