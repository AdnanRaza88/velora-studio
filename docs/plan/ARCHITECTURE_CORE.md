# Velora core architecture

## Product goal
High-level vector design from structured intent. Raster is never the source of truth.

## Two sessions (always)

### Session A — Query → VXL (JSON)
User types a brief and optionally attaches a reference image.
1. Skill router picks category (logo, textile, character, illustration, icon).
2. Needle 2 (on-device, bundled) extracts structured fields via tool schema.
3. Skill pack expands fields into a full VXL document (or fills a template).
4. Validator rejects invalid geometry; repair loop once if needed.
5. User sees VXL JSON + SVG preview.

### Session B — VXL (JSON) → Design
User pastes or loads VXL JSON (hand-written or from Session A).
1. Schema validate.
2. Deterministic vector engine compiles to SVG scene graph.
3. Canvas shows editable vectors.
4. Export SVG / VXL / PNG preview.

Attachment path (when image present):
- Picker copies the image into app-private `files/attachments/<id>.<ext>`, records width and height, and shows a local preview. Needle still receives only the text brief.
- The session binds `meta.reference` (id, name, mime, bytes, size, file). Preview bytes stay out of the VXL document.
- Phase 3b reads that file: `VeloraAttach.raster` downsamples to luma, `VeloraTrace` contours and RDP-simplifies into VXL path shapes. Session previews trace from the local image element.
- Needle does not see pixels. Trace is a separate module. `VeloraReference.summary()` is the handoff (`trace: autotrace`).
- Trace writes a normal VXL 1 document (path shapes, palette roles, no raster). The user edits that document the same way as pasted VXL: role, remove, or rewrite the JSON, then validate and compile again.
- Phase 4 select / move / scale / rotate bakes the change into the shape (path `d`, primitive fields, or `rot`). The compiler does not keep a live transform stack. Drag maps pointer position through the SVG screen matrix. Repeat motifs are still stored in tile space. Pattern instance controls write `repeat.offset`, `gap`, `scale`, `rotate`, `tile`, `cols`, and `rows`. Those stay on the repeat and compile as the tile transform.
- Recolor by job writes `palette.figure`, `palette.ground`, and `palette.accent` (plus `ink2`–`ink4` when present). Shapes keep role names. A hex fill or stroke that matched the previous job ink is linked back to that role so the next recolor stays shared. Ground also paints the canvas paper.

## Why Needle 2 is the default agent
- ~14 MB binary, ~28 MB RAM — ships inside the APK.
- Built for tool calling and structured extraction, not chat.
- Skills = tool definitions + system instructions that force VXL-shaped output.
- No API key, no network required for Session A baseline.

Remote providers (optional later) can replace or assist Session A for richer briefs.
They are not required for the core loop.

## VXL is the contract
AI never draws pixels. AI emits VXL. The app always owns geometry.
- Phase 4 type places a VXL `text` node (point or area width). Area width wraps into tspans on compile. Outline expands the string to monoline glyph paths the pen tools can edit. The compiler still owns the SVG text until outline.

- Undo and redo keep up to 40 document snapshots. A step is recorded only when geometry, layers, or palette change. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z walk that stack.
- Layers are the VXL `layers[]` stack. Later layers paint in front. Each layer has a name, opacity, visible, and locked flag. Hide and lock skip hit testing. Merge folds a layer into the one behind it. New type lands on the active unlocked layer.
- Blend steps store a VXL `blend` node (from, to, steps, optional spine). The compiler morphs sampled contours and inks. Expand bakes those steps into a group of paths.
