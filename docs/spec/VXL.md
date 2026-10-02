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

## Skill output

Skill packs may send `category` `icon` or `character`. The validator maps those to `logo` / `illustration` and stores `meta.skill` as `icon`, `character`, `logo`, or `textile`.

`canvas.viewBox` may be four numbers or a space-separated string. Rects may use `width` / `height`. Polygon `points` may be a string. `fillRule` `evenodd` is kept and compiled.

Optional palette keys `ink2`, `ink3`, `ink4` must be hex when present. Missing `ground`, `figure`, or `accent` is repaired from defaults and reported in `warnings`. The document still compiles.

Raster nodes, `data:image`, base64 payloads, and script strings are rejected. Path `d` stays on the SVG command alphabet. Group nesting stops at depth 4. `widthProfile` is accepted and stored; stroke width expansion is a later editor phase.

Golden fixtures live in `docs/spec/golden`. Run `node tools/vxl-golden.js`.
