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

## Phase 7 — Curvature
- [x] Click-to-curve path builder (smooth points, corner points, close, finish)

## Phase 8 — Pathfinder remainder
- [x] Intersect and exclude bake the selection with the shape behind it

## Phase 9 — Type on path
- [x] Text follows a selected path spine; flip side; outline bakes glyphs along the path

## Phase 10 — Named stroke profiles
- [x] Skill pack names taper, swell, point; emit_vxl strokeProfile resolves to widthProfile

## Phase 11 — Brush instances
- [x] Named calligraphic nibs round, flat, oval; emit_vxl brush resolves to a nib; compiler expands the outline; centerline stays editable

## Phase 12 — Offset path
- [x] Offset a selected path or primitive by a distance; miter joins bevel past the limit; original stays; the new path is normal VXL

## Phase 13 — Align / distribute
- [x] Align selection to the artboard (one shape) or to the selection bounds (shift-click set); distribute horizontal and vertical gaps; geometry is baked with the move matrix

## Phase 14 — Gradient fill
- [x] Linear gradient across the selection, figure to accent, userSpaceOnUse vector; Flat fill clears it. Stops stay ink jobs or hex. No raster.

## Acceptance
User installs APK (Needle included) → types brief → gets VXL + vector preview → downloads SVG that zooms clean → can paste VXL and re-render → can attach reference later for trace.

## Privacy
Needle runs on device. Projects stay on device. Remote is opt-in only. The default path never reads or sends an API key. Reference images stay in app files (`files/attachments`) and are not uploaded.

## Phase 15 — Clipping mask
- [x] Front shape becomes the clip path; content keeps its geometry; compiler emits clipPath; Release clears it; move, scale, and rotate bake the clip with the shape


## Phase 16 — Scissors
- [x] Click a path to open a closed shape or split an open path; the cut is baked into normal VXL paths

## Phase 17 — Shape builder
- [x] Drag or click merges overlapping faces into one VXL path; Alt-click deletes the face under the cursor; leftovers stay editable paths

## Phase 18 — Knife
- [x] Draw a cut across closed shapes; each crossed shape bakes into separate closed VXL paths; the knife stroke is not kept


## Phase 19 — Reflect
- [x] Mirror the selection across a vertical or horizontal axis through its center; Reflect copy keeps the source and bakes the mirror as new VXL; Flip rewrites the selection in place


## Phase 20 — Join
- [x] Join the nearest open ends in the selection into one VXL path; a single open path closes; the extra path is dropped

## Phase 21 — Shear
- [x] Skew the selection about its center by an angle; horizontal or vertical; rectangles and ellipses bake to VXL paths; Shear copy keeps the source

## Phase 22 — Outline stroke
- [x] Expand a stroke, width profile, or brush into a filled VXL path; a filled shape keeps its fill and loses the stroke; the outline stays editable

