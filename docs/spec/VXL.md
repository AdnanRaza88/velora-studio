# VXL 1

Source document for Velora Studio. The compiler is deterministic: the same document always yields the same SVG.

## Document

- `vxl`: must be `1`
- `meta`: `id`, `name`, `created`, `updated`, `category` (`logo` | `textile` | `illustration`), `purpose`, `brief`, optional `reference`
- `canvas.viewBox`: four numbers, units `px`
- `palette`: `ground`, `figure`, `accent` as hex
- `repeat`: `null`, or `{ type, tile, cols, rows, offset, gap, scale, rotate }`
- `layers[]`: `{ id, name, visible, opacity, shapes[] }`

Repeat types: `block`, `half-drop`, `half-brick`, `mirror`. When `repeat` is set, layer 0 is the motif and is tiled. Later layers draw once. Instance controls live on the repeat, not on the motif geometry: `offset` shifts the pattern origin, `gap` adds space between tiles, `scale` and `rotate` transform each instance, and `tile` / `cols` / `rows` set the step and copy count. The compiler applies those as the tile transform. Motifs stay in tile space.

## Shapes

`path`, `circle`, `ellipse`, `rect`, `line`, `polygon`, `text`, `group`.

`rect` and `text` may set `rot` in degrees. Text may set `onPath` to an SVG path spine and `side` to `1` or `-1`. The editor bakes move, scale, and rotate into geometry before the next compile. Path commands are rewritten absolute. A rotated circle or ellipse becomes a path.

Pen edit converts the selected shape to a path and rewrites `d`. Dragging an anchor moves that point and its attached Bezier handles. Dragging a handle moves only that control.

Path `d` is restricted to SVG path commands and numbers. Text is escaped on compile.

## Import

Paste JSON, or open a `.json` file. Validation runs before compile. Phase 1 documents (top-level `category` / `viewBox`) are lifted into VXL 1.

## Storage

Projects live in `localStorage` under `velora.projects`. Keys stay in `velora.providers` and are not copied into a project. Cap: 30 projects, 180 KB each.

`meta.reference` may point at an on-device file (`files/attachments/<id>.<ext>`) with name, mime, bytes, width, and height. It must not contain a data URL or base64 payload. The image file is not the design.

## Skill output

Skill packs may send `category` `icon` or `character`. The validator maps those to `logo` / `illustration` and stores `meta.skill` as `icon`, `character`, `logo`, or `textile`.

`canvas.viewBox` may be four numbers or a space-separated string. Rects may use `width` / `height`. Polygon `points` may be a string. `fillRule` `evenodd` is kept and compiled.

Optional palette keys `ink2`, `ink3`, `ink4` must be hex when present. Missing `ground`, `figure`, or `accent` is repaired from defaults and reported in `warnings`. The document still compiles.

Raster nodes, `data:image`, base64 payloads, and script strings are rejected. Path `d` stays on the SVG command alphabet. Group nesting stops at depth 4. `widthProfile` is an array of absolute widths sampled along the stroke, or a named preset `taper`, `swell`, or `point` from the stroke profile pack. The compiler expands it to a filled outline. The centerline `d` stays editable. The Width tool writes the samples back into VXL. `brush` is a named nib (`round`, `flat`, `oval`) with angle, roundness, and size. The compiler projects that nib. The centerline `d` stays editable.

Golden fixtures live in `docs/spec/golden`. Run `node tools/vxl-golden.js`.
