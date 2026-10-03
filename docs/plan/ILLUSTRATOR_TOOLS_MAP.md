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
| Gradient | Linear fill across a shape | VXL `gradient` linear stops (job or hex); compiler emits userSpaceOnUse linearGradient; editor paints figure to accent; Flat fill clears it |
| Clipping mask | Hide artwork outside a closed path | Editor Clip stores the front shape as `clip` path data on the content; compiler emits clipPath; Release clears it; the content path stays editable |
| Scissors | Cut a path at a point | Editor Scissors opens a closed path at the click, or splits an open path into two VXL paths; a second click splits the opened path |
| Shape Builder | Merge or delete faces of overlapping shapes | Editor Shape builder drag or click unites faces into one VXL path; Alt-click deletes the overlap face; leftovers stay editable |
| Knife | Slice filled shapes along a freehand cut | Editor Knife draws a stroke; crossed closed shapes bake into separate closed VXL paths; the stroke is not kept |
| Reflect | Mirror artwork across an axis | Editor Reflect copy bakes a mirrored VXL duplicate across the selection center; Axis V/H chooses the axis; Flip rewrites the selection in place |

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
