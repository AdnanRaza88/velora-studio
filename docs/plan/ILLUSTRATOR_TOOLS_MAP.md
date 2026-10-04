# Illustrator tools → Velora VXL / editor map

What professionals actually use, and what those tools produce, mapped to our engine.

## Core draw
| Tool | What it produces | Velora mapping |
|------|------------------|----------------|
| Pen | Anchor points + Bezier handles; closed/open paths | VXL `path` with `d` or anchors[] |
| Pencil | Freehand path, then simplified | VXL path from pencil stroke; Smooth refits cubics |
| Curvature | Click-to-curve paths | Curve tool: points the path passes through; Corner cusp; Close / double-click finish |
| Shape tools | Rect, ellipse, polygon, star | VXL primitive shapes |

## Stroke expression
| Tool | What it produces | Velora mapping |
|------|------------------|----------------|
| Width | Variable stroke thickness along one path (taper, swell) | VXL `stroke.widthProfile` |
| Stroke profiles | Reusable taper shapes | Named profiles taper / swell / point in skills/stroke-profiles.json; emit_vxl strokeProfile |
| Brushes | Calligraphic nib along a stroke | Named brushes round / flat / oval in skills/brushes.json; emit_vxl brush; compiler projects the nib; centerline d stays editable |

## Build complex form
| Tool | What it produces | Velora mapping |
|------|------------------|----------------|
| Pathfinder / Shape Builder | Unite, subtract, intersect, exclude | VXL path baked by unite/subtract/intersect/exclude; holes use fill-rule evenodd |
| Blend | Morph steps between two shapes/colors along spine | VXL `blend` node |
| Pattern | Tile a motif; scale, rotate, offset, and spacing of the instance | VXL `repeat` instance fields: type, tile, cols, rows, offset, gap, scale, rotate |
| Compound path | Holes (counterforms in letters, logos) | path fill-rule evenodd |
| Offset path | Parallel outline at a distance | Editor Offset path bakes a new VXL path; miter joins bevel past the limit; source stays |
| Align / distribute | Edge and center alignment; even gaps | Shift-click set; one shape aligns to the artboard; several align to the selection; Distribute H/V spaces gaps; move matrix bakes geometry |
| Gradient | Linear or radial fill across a shape | VXL `gradient` linear or radial stops (job or hex); compiler emits userSpaceOnUse linearGradient or radialGradient; editor paints figure to accent; Radial uses the selection center; Flat fill clears it |
| Clipping mask | Hide artwork outside a closed path | Editor Clip stores the front shape as `clip` path data on the content; compiler emits clipPath; Release clears it; the content path stays editable |
| Scissors | Cut a path at a point | Editor Scissors opens a closed path at the click, or splits an open path into two VXL paths; a second click splits the opened path |
| Shape Builder | Merge or delete faces of overlapping shapes | Editor Shape builder drag or click unites faces into one VXL path; Alt-click deletes the overlap face; leftovers stay editable |
| Knife | Slice filled shapes along a freehand cut | Editor Knife draws a stroke; crossed closed shapes bake into separate closed VXL paths; the stroke is not kept |
| Reflect | Mirror artwork across an axis | Editor Reflect copy bakes a mirrored VXL duplicate across the selection center; Axis V/H chooses the axis; Flip rewrites the selection in place |
| Join | Connect open endpoints into one path | Editor Join bakes the nearest open ends into one VXL path; a single open path closes; the extra path is dropped |
| Shear | Skew artwork along an axis | Editor Shear bakes a horizontal or vertical skew about the selection center; primitives become VXL paths; Shear copy keeps the source |
| Outline stroke | Expand a stroke into a filled shape | Editor Outline stroke bakes stroke, width profile, or brush into a filled VXL path; fill stays and loses its stroke |
| Add / delete anchor | Insert a point on a segment, or remove an anchor and rejoin | Editor Anchors bakes the click into the path d; a segment click splits the cubic or line; an anchor click deletes it and joins the neighbors |
| Live corners | Round a corner by a radius | Editor Round corners fillets sharp corners; radius is limited by the adjacent edges; rectangles and polygons bake to a VXL path |
| Divide | Split overlapping shapes into separate faces | Editor Divide bakes the selection and the shape behind it into non-overlapping VXL paths; the overlap keeps the front ink; leftovers stay editable |
| Zig zag | Peaks and valleys along a path | Editor Zig zag bakes ridges along the selection; size is the offset; ridges close on a loop; primitives bake to a VXL path |
| Roughen | Irregular points along a path | Editor Roughen bakes jittered samples; size is the offset; detail sets density; corner points stay segments; smooth points become cubics; open ends stay put; primitives bake to a VXL path |
| Pucker & Bloat | Pull anchors in or push them out from the center | Editor Pucker / Bloat bakes samples about the selection center; a negative amount puckers edges inward; a positive amount bloats them outward; primitives bake to an editable VXL path |
| Twirl | Spin points around a center, stronger near the middle | Editor Twirl bakes a rotation about the selection center; the angle falls off toward the edge so the silhouette stays pinned; rectangles and ellipses bake to an editable VXL path |
| Arc | Bend artwork onto a circular arc | Editor Arc bakes the selection onto a circular arc; Axis H/V chooses the bend; positive arches up or left, negative arches down or right; rectangles and ellipses bake to an editable VXL path |
| Wave | Bend artwork on a sine | Editor Wave bakes a sine offset along the selection; bend sets the amplitude, waves sets the count; Axis H/V chooses the travel; rectangles and ellipses bake to an editable VXL path |
| Flag | Ripple artwork like a flag, pinned at the hoist | Editor Flag bakes a sine that grows from the hoist edge toward the fly; bend sets the lift, waves sets the count; Axis H/V chooses the travel; rectangles and ellipses bake to an editable VXL path |
| Fish | Bend opposite sides into a fish body, pinned at the head | Editor Fish bakes a shear that grows from the head toward the tail; opposite edges move in opposite directions; bend sets the swing, waves sets the count; Axis H/V chooses the travel; rectangles and ellipses bake to an editable VXL path |
| Rise | Lift artwork from a pinned start edge, both sides rising together | Editor Rise bakes a lift that grows from the start edge toward the far edge; both sides move the same way; bend sets the lift, waves sets the count; Axis H/V chooses the travel; rectangles and ellipses bake to an editable VXL path |
| Fisheye | Bulge artwork as if seen through a fisheye lens | Editor Fisheye bakes a radial push from the selection center; corners stay pinned; bend sets the bulge, waves sets the rings; Axis H stretches wider, Axis V stretches taller; rectangles and ellipses bake to an editable VXL path |
| Inflate | Bow edges outward like a filled balloon | Editor Inflate bakes an edge bow and pins the corners; bend sets the swell, waves sets the lobes; Axis H swells wider, Axis V swells taller; rectangles and ellipses bake to an editable VXL path |

## Type
| Tool | What it produces | Velora mapping |
|------|------------------|----------------|
| Type / Area type / Type on path | Editable text objects | VXL `text` point or area width; `onPath` follows a path spine; outline expands to glyph paths |

## Structure
| Tool | What it produces | Velora mapping |
|------|------------------|----------------|
| Layers / groups | Hierarchy for edit and export | VXL layers[] groups[] |
| Direct selection | Move individual anchors | Editor node handles |

## Design quality bar (from real use)
- Logos: few clean shapes, strong silhouette, 1–3 inks, works at favicon size.
- Characters: semantic groups (head, hair, body, limbs), not thousands of micro-paths.
- Textile: motif + measured repeat (block / half-drop / half-brick / mirror); seam must close.
- Line art: width profiles for organic taper, not uniform stroke only.

Procedural detail should prefer stroke, width, blend, and repeat over exploding every curve into noise.
