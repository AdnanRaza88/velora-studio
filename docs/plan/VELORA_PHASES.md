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
- [x] Freeform cubic joins: adjacent cubics with a small turn share a tangent so organic contours stay smooth without touching geometric special fits
- [x] Freeform collinear merge: adjacent lines whose intermediate vertex sits within 1.45px of the outer chord and whose turn stays under 0.2 rad collapse into one line
- [x] Freeform residual continuation: a short non-axis line run between two cubics becomes one cubic when both joins stay under 0.55 rad, so organic contours stay continuous
- [x] Higher resolution: device and preview rasters use a 1792 long edge so fine contours keep more samples before the 1024 viewBox fit. Small circles, ellipses, and polygons stay.
- [x] Thin strokes: peel width scales with the raster long edge, a one-pixel dilate keeps the skeleton connected, and aligned chain ends join, so a hairline stays one centerline instead of a filled ribbon or fragments. Filled circles, polygons, and bars stay fills.
- [x] Freeform smooth cubic merge: adjacent cubics on a low-turn span collapse into one cubic when the combined fit stays within 1.7px, so an organic lobe uses fewer curves. Circles, polygons, and special fits stay.
- [x] Freeform residual absorb: a short low-bow line under 32px that sits before or after a cubic folds into that cubic when the refit stays within 2.1px, so an organic lobe closes with curves instead of a chord. Circles, polygons, and rounded rectangles stay.
- [x] Freeform gentle line runs: consecutive lines whose intermediate turns stay under 0.7 rad and whose span bows past 2.6px on one side refit as cubics, so a pointed organic keeps curved sides instead of an 8-line polygon. Circles, polygons, chamfers, and rounded rectangles stay.
- [x] Gentle bowed spans: a side whose samples bow past 1.7px but whose local turns look collinear keeps an RDP fit instead of collapsing to a chord, and a lone line with that bow refits as a cubic. A taper and a flame stay curved. Circles, polygons, and rounded rectangles stay.

## Phase 4 — Editor (Illustrator-mapped)
- [x] Select, move, scale, rotate
- [x] Recolor by job (figure/ground/accent)
- [x] Anchor edit (pen-level)
- [x] Width profile on strokes
- [x] Text tool
- [x] Undo/redo, layers

## Phase 5 — Advanced geometry
- [x] Boolean (unite/subtract)
- [x] Blend steps
- [x] Pattern instance controls
- [x] Pencil + smooth

## Phase 6 — Optional remote assist
- [x] OpenAI / Anthropic / Gemini / OpenRouter as optional planners
- [x] Same skill packs; same VXL validator

## Acceptance
User installs APK (Needle included) → types brief → gets VXL + vector preview → downloads SVG that zooms clean → can paste VXL and re-render → can attach reference later for trace.

## Privacy
Needle runs on device. Projects stay on device. Remote is opt-in only. The default path never reads or sends an API key. Reference images stay in app files (`files/attachments`) and are not uploaded.
