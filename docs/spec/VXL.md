# VXL 1

Source document for Velora Studio. The compiler is deterministic: the same document always yields the same SVG.

## Document

- `vxl`: must be `1`
- `meta`: `id`, `name`, `created`, `updated`, `category` (`logo` | `textile` | `illustration`), `purpose`, `brief`
- `canvas.viewBox`: four numbers, units `px`
- `palette`: `ground`, `figure`, `accent` as hex
- `repeat`: `null`, or `{ type, tile, cols, rows }`
- `layers[]`: `{ id, name, visible, opacity, shapes[] }`

Repeat types: `block`, `half-drop`, `half-brick`, `mirror`. When `repeat` is set, layer 0 is the motif and is tiled. Later layers draw once.

## Shapes

`path`, `circle`, `ellipse`, `rect`, `line`, `polygon`, `text`, `group`.

Paint fields `fill` and `stroke` accept a palette role (`ground`, `figure`, `accent`), a hex color, or `none`. `group.children` may nest shapes. `rect` may set `rot` in degrees.

Path `d` is restricted to SVG path commands and numbers. Text is escaped on compile.

## Import

Paste JSON, or open a `.json` file. Validation runs before compile. Phase 1 documents (top-level `category` / `viewBox`) are lifted into VXL 1.

## Storage

Projects live in `localStorage` under `velora.projects`. Keys stay in `velora.providers` and are not copied into a project. Cap: 30 projects, 180 KB each.
