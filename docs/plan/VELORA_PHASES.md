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
- [x] Trace quality: full tracer restored after the truncated upload. 1024-edge device and preview rasters, median denoise, 1px stroke bridge, spur-only mask smooth, despeckle, small-hole fill, OKLab ink clusters with a 3x3 majority relabel, light background and transparent pixels ignored, boundary settle, orthogonal runs snapped, subpixel iso placement on the threshold (soft field for multi-ink), corner-preserving simplify, repeated close vertices dropped before corner cuts, chord-length least-squares cubics with two Newton reparameterization passes, opticurve merges adjacent cubics inside a corner span and drops near-flat cubics to lines (alphamax / opttolerance), stair runs within 0.82px of a chord collapse to a straight edge so diagonals are not pixel corners, thin ribbons (median width under 6.5px) emit a centerline stroke with round caps instead of a double edge, open contour ends within 4px join into one closed ring before the curve fit, and a thin stroke whose skeleton ends sit within 6.5px closes into a round loop, remaining contours keep a tighter corner cut, holes punch the smallest outer contour that contains most of their samples (not the largest shape whose centroid test passes) as evenodd subpaths, and an inner ring that only echoes that hole is not emitted as a second fill; a stable light border (cream or gray paper, not only near-white) is treated as backdrop in the color pass so it is not emitted as ink, and the ground swatch follows that paper; anti-aliased halos that sit on the blend between that paper and a larger ink are snapped onto the parent ink instead of a second fringe contour; color contours sit on the paper-to-ink coverage midpoint instead of the blurred mask edge, while ink-to-ink seam vertices stay pinned so the one-pixel overlap remains; anti-aliased fringe clusters fold onto the largest ink they blend toward instead of parenting each other, so a soft circle stays one fill, short fold-back spikes drop before the curve fit, and a stair shorter than 2.4px is not an axis corner; a thin centerline drops Zhang-Suen stair notches onto the chord (0.78px) and a jog shorter than 1.6px is not a spine corner, so a diagonal stroke stays one edge; a second ink that forms a solid region is not folded into a larger ink just because its OKLab center sits near the paper blend, while a thin anti-aliased shell still parents onto that ink; an axis snap only flattens a run that is already straight (bow under 0.55px and at least 5px long), so a circle pole is not forced into a chord; fold-back samples within 1.35px of the chord drop before the fit; a corner needs a leg of at least 4.2px, and a cubic whose end tangent opposes the chord uses the chord so the handle cannot reverse; a straight axis run (bow under 0.55px, at least 12px) that meets a perpendicular straight run within 48px keeps both joints, and a chamfer under 3.2px is replaced by their intersection, so a rectangle stays four corners while a circle pole is not faceted; outline opttolerance defaults to 0.36; a straight run of at least two low-turn vertices (bow under 0.5px, at least 18px) is cut out of the fillet span and emitted as a line, so a rounded rectangle keeps cubic corners and straight sides instead of one cubic per side, while a circle pole stays curved; a direction-stable run of at least 16px, including a sparse side with one long edge into a shorter fillet, is cut to a line so a small-radius rounded rectangle does not fit the side as a cubic; a long side that meets a fillet on a gentle tangent is still cut to a line, a dropped fillet shorter than 14px between those sides is restored as a tangent cubic, and a sparse ring is not averaged across that joint; a short fillet step is not marked seen before the side qualifies, so the long side still becomes a line, and a fillet up to 26px between those sides is a tangent cubic instead of a chamfer; a diagonal polygon side whose samples alternate within 1.2px of the chord is a line, a one-pixel jog beside that side is dropped, and a short flat pole whose ends keep turning is left as cubics, so a triangle and pentagon stay line sides and an ellipse does not gain a chord; a short stair between two long line sides is replaced by their intersection when that stair sits within 4.4px of the point, and a jog under 11px that stays within 1.35px of the side chord is dropped, so a triangle, pentagon, and star keep one vertex per corner while a fillet cubic and an ellipse pole stay; a cubic between two line sides whose handles stay within 3.4px of a chord longer than 22px becomes that chord, so a raster triangle base does not bow, while a fillet under 22px stays cubic; a short cubic under 4.6px between two long line sides becomes their intersection when the hit sits within 5.2px and the handles stay on that wedge, so a raster triangle tip is one corner, while a radius-6 fillet stays cubic; an open centerline chamfer under 6.4px between two arms of at least 12px becomes their intersection when the turn is sharper than about 52 degrees and is not a hairpin, so a thin L is two lines while a straight stroke and a U cap stay; a five-point side lookback wraps with a positive remainder, so a four-corner rectangle is four lines instead of a crash; adjacent cubics on a smooth span (turn under 0.55, bow over 0.9px) merge up to 1.15px error so a circle is about five cubics instead of ten, while a rectangle, triangle, pentagon, star, and radius-6 fillet stay as they were; a smooth oval with no axis corner and no straight side is fit from the left, right, top, and bottom poles, splitting a quadrant once if the cubic error exceeds 2.35px, so a soft ellipse stays six cubics instead of stair chords, while a circle stays four cubics and a rectangle, rounded rectangle, triangle, and pentagon stay lines; a contour that stays within 0.075 of its bounding ellipse keeps the oval fit even when a pixel pole looks like an axis corner, and that oval is emitted as four kappa cubics so a soft circle is a true ellipse instead of a bowed stair fit; a contour whose samples stay within 0.78px of a least-squares circle, and within 6.2 percent of its radius, is emitted as four kappa cubics from that fit so a 6px disk is a true circle instead of bowed cubics, while a square, triangle, rounded rectangle, and ellipse stay on the corner fit; a contour whose samples stay within 2.8px of an axis-aligned least-squares ellipse, and within 11 percent of the minor radius, is emitted as four kappa cubics so a soft ellipse is one oval instead of mixed lines, while a square, triangle, pentagon, rounded rectangle, and thin stroke stay on the corner fit; a ring with a turn over 0.62 is not an oval even when its samples sit near a least-squares circle, so a pentagon stays five lines instead of the circle through its vertices, while a soft circle and a soft ellipse stay four kappa cubics; a rounded rectangle whose four sides stay axis-aligned is emitted as four lines and four corner cubics, so the side is not split into jogs, while a square, circle, ellipse, triangle, and pentagon stay on their existing fit; a contour with two parallel sides and semicircle caps is emitted as two lines and four kappa quarters, so a stadium stays a pill instead of bowed chords, while a rounded rectangle, circle, ellipse, triangle, and pentagon stay on their existing fit; a rectangle with one to three quarter-circle corners keeps the sharp corners as line intersections and emits a kappa cubic only on the filleted corners, so a single 16px fillet is four axis lines and one cubic, while a square and a four-corner rounded rectangle stay on their existing fit; a straight chamfer between two axis sides stays a line instead of a fillet cubic, and a star tip stays a vertex; a box with a straight cut on each corner stays eight lines, while a rounded rectangle keeps four side lines and four cubics because the side ends drift off the axis before the corner
- [x] Ink-to-ink anti-aliased shell folds onto the two parent inks when its center sits on their blend and the cluster is mostly edge, so a soft seam is not a third ink or a jagged stroke; a solid third color stays
- [x] Trace octagon fit: eight nearly equal straight sides whose window turn sits near 45 degrees emit eight lines before the oval fit, so a vertex-on-axis octagon is not a kappa circle; a flat octagon, circle, ellipse, square, rounded rectangle, pentagon, hexagon, and stadium stay
- [x] Trace octagon corners: a stair-split or smaller regular octagon still emits eight lines before the rounded-rect and oval fits, so a vertex-on-axis octagon is not six segments and a 12px octagon is not a kappa circle; a flat octagon, circle, ellipse, square, rounded rectangle, pentagon, hexagon, and stadium stay
- [x] Trace hexagon corners: six nearly equal sides emit six lines before the oval fit, including a 7-point ring and a stair-split 40px hexagon, so a small hexagon is not four kappa cubics; a circle, ellipse, octagon, pentagon, square, rounded rectangle, and stadium stay
- [x] Trace pentagon corners: five nearly equal sides emit five lines before the oval fit, including a stair-split 22px pentagon, so a small pentagon is not two cubics on one side; a circle, ellipse, hexagon, octagon, square, rounded rectangle, and stadium stay; a corner that sits on the chord between two kept corners, and bows more than 1.8px, stays a vertex, so a house keeps both eaves instead of collapsing to a triangle
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
