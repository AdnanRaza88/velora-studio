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
| Stroke profiles | Reusable taper shapes | Named profiles in skill pack |
| Brushes | Textured / calligraphic strokes | Phase later: brush instances |

## Build complex form
| Tool | What it produces | Velora mapping |
|------|------------------|----------------|
| Pathfinder / Shape Builder | Unite, subtract, intersect, exclude | VXL path baked by unite/subtract/intersect/exclude; holes use fill-rule evenodd |
| Blend | Morph steps between two shapes/colors along spine | VXL `blend` node |
| Pattern | Tile a motif; scale, rotate, offset, and spacing of the instance | VXL `repeat` instance fields: type, tile, cols, rows, offset, gap, scale, rotate |
| Compound path | Holes (counterforms in letters, logos) | path fill-rule evenodd |

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
