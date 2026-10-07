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
- [x] Trace quality: full tracer restored after the truncated upload. 1024-edge device and preview rasters, median denoise, 1px stroke bridge, spur-only mask smooth, despeckle, small-hole fill, OKLab ink clusters with a 3x3 majority relabel, light background and transparent pixels ignored, boundary settle, orthogonal runs snapped, subpixel iso placement on the threshold (soft field for multi-ink), corner-preserving simplify, repeated close vertices dropped before corner cuts, chord-length least-squares cubics with two Newton reparameterization passes, opticurve merges adjacent cubics inside a corner span and drops near-flat cubics to lines (alphamax / opttolerance), stair runs within 0.82px of a chord collapse to a straight edge so diagonals are not pixel corners, thin ribbons (median width under 6.5px) emit a centerline stroke with round caps instead of a double edge, open contour ends within 4px join into one closed ring before the curve fit, and a thin stroke whose skeleton ends sit within 6.5px closes into a round loop, remaining contours keep a tighter corner cut, holes punch the smallest outer contour that contains most of their samples (not the largest shape whose centroid test passes) as evenodd subpaths, and an inner ring that only echoes that hole is not emitted as a second fill; a stable light border (cream or gray paper, not only near-white) is treated as backdrop in the color pass so it is not emitted as ink, and the ground swatch follows that paper; anti-aliased halos that sit on the blend between that paper and a larger ink are snapped onto the parent ink instead of a second fringe contour; color contours sit on the paper-to-ink coverage midpoint instead of the blurred mask edge, while ink-to-ink seam vertices stay pinned so the one-pixel overlap remains; anti-aliased fringe clusters fold onto the largest ink they blend toward instead of parenting each other, so a soft circle stays one fill, short fold-back spikes drop before the curve fit, and a stair shorter than 2.4px is not an axis corner; a thin centerline drops Zhang-Suen stair notches onto the chord (0.78px) and a jog shorter than 1.6px is not a spine corner, so a diagonal stroke stays one edge; a second ink that forms a solid region is not folded into a larger ink just because its OKLab center sits near the paper blend, while a thin anti-aliased shell still parents onto that ink; an axis snap only flattens a run that is already straight (bow under 0.55px and at least 5px long), so a circle pole is not forced into a chord; fold-back samples within 1.35px of the chord drop before the fit; a corner needs a leg of at least 4.2px, and a cubic whose end tangent opposes the chord uses the chord so the handle cannot reverse; a straight axis run (bow under 0.55px, at least 12px) that meets a perpendicular straight run within 48px keeps both joints, and a chamfer under 3.2px is replaced by their intersection, so a rectangle stays four corners while a circle pole is not faceted; outline opttolerance defaults to 0.36; a straight run of at least two low-turn vertices (bow under 0.5px, at least 18px) is cut out of the fillet span and emitted as a line, so a rounded rectangle keeps cubic corners and straight sides instead of one cubic per side, while a circle pole stays curved; a direction-stable run of at least 16px, including a sparse side with one long edge into a shorter fillet, is cut to a line so a small-radius rounded rectangle does not fit the side as a cubic; a long side that meets a fillet on a gentle tangent is still cut to a line, a dropped fillet shorter than 14px between those sides is restored as a tangent cubic, and a sparse ring is not averaged across that joint
- [x] Multi-ink trace: up to four separated fills (figure, accent, ink2, ink3), light paper ignored, seams overlapped one pixel; device raster sends packed RGB; single-ink stays binary; ink clusters and pixel assignment use OKLab so close logo hues stay apart

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

## Phase 23 — Add / delete anchor
- [x] Click a segment to insert an anchor; click an anchor to delete it; the path is rewritten as normal VXL

## Phase 24 — Radial gradient
- [x] Radial fill from the selection center, figure to accent, userSpaceOnUse; Flat fill clears it. Stops stay ink jobs or hex. No raster.

## Phase 25 — Live corners
- [x] Round sharp corners of the selection by a radius; rectangles and polygons bake to a VXL path; the fillet is a cubic and stays editable

## Phase 26 — Pathfinder divide
- [x] Divide bakes the selection and the shape behind it into non-overlapping VXL paths; overlap keeps the front ink; leftovers stay editable
## Phase 27 — Zig zag
- [x] Offset ridges along the selection by a size; integer ridges close on a loop; rectangles and ellipses bake to a VXL path; the wave stays editable

## Phase 28 — Roughen
- [x] Jitter samples along the selection by a size and detail; corner points stay segments, smooth points become cubics; open ends stay put; rectangles and ellipses bake to a VXL path

## Phase 29 — Pucker and bloat
- [x] Pull or push samples about the selection center; negative amount puckers, positive amount bloats; rectangles and ellipses bake to a VXL path; the curve stays editable

## Phase 30 — Twirl
- [x] Rotate samples about the selection center; angle falls off toward the edge so the silhouette stays pinned; rectangles and ellipses bake to an editable VXL path

## Phase 31 — Arc warp
- [x] Bend the selection onto a circular arc; horizontal or vertical; positive arches up or left, negative arches down or right; rectangles and ellipses bake to an editable VXL path

## Phase 32 — Wave warp
- [x] Offset samples on a sine along the selection; bend sets amplitude, waves sets the count; horizontal or vertical; rectangles and ellipses bake to an editable VXL path

## Phase 33 — Flag warp
- [x] Pin the hoist edge and grow a sine toward the fly; bend sets the lift, waves sets the count; horizontal or vertical; rectangles and ellipses bake to an editable VXL path

## Phase 34 — Fish warp
- [x] Pin the head and shear opposite sides toward the tail; bend sets the swing, waves sets the count; horizontal or vertical; rectangles and ellipses bake to an editable VXL path

## Phase 35 — Rise warp
- [x] Pin the start edge and lift both sides the same way toward the far edge; bend sets the lift, waves sets the count; horizontal or vertical; rectangles and ellipses bake to an editable VXL path

## Phase 36 — Fisheye warp
- [x] Push samples away from the selection center and pin the corners; bend sets the bulge, waves sets the rings; horizontal stretches wider, vertical stretches taller; rectangles and ellipses bake to an editable VXL path


## Phase 37 — Inflate warp
- [x] Bow the edges of the selection outward and pin the corners; bend sets the swell, waves sets the lobes; horizontal swells wider, vertical swells taller; rectangles and ellipses bake to an editable VXL path

## Phase 38 — Squeeze warp
- [x] Pinch the edges of the selection inward and pin the corners; bend sets the pinch, waves sets the lobes; horizontal squeezes narrower, vertical squeezes shorter; rectangles and ellipses bake to an editable VXL path

## Phase 39 — Twist warp
- [x] Spin samples about the selection center; rotation grows toward the edge so corners move; bend sets the turn, waves sets the turns; horizontal twists the sides, vertical twists the ends; rectangles and ellipses bake to an editable VXL path
