# Velora skill packs (for Needle + any planner)

Skills teach the agent what VXL to emit. The app compiles; the agent does not invent raw SVG strings as the source of truth.

## Shared rules (every skill)
- Output only valid VXL JSON matching the schema.
- Use color jobs: figure, ground, accent (and optional ink2…).
- Prefer few semantic shapes over noisy path soup.
- Never embed base64 raster as the design source.

## Skill: logo
Inputs: brief, optional name, style (geometric/wordmark/emblem), ink count.
Emit: category logo, palette, one layer of paths/circles/text, strong silhouette.

## Skill: textile
Inputs: brief, motif kind, repeat type, scale.
Emit: category textile, motif path, repeat {type, tile}, limited inks.
Seam: motif placement must satisfy the chosen repeat math.

## Skill: character / illustration
Inputs: brief, optional reference note, groups needed (head, body…).
Emit: grouped layers with named parts; simple fills first.

## Skill: icon
Inputs: brief, size grid (24/32/48).
Emit: single-color or two-tone paths on square viewBox.

## Needle tool schema (conceptual)
Tool name: emit_vxl
Arguments: category, palette, layers or motif+repeat, viewBox.
Needle fills arguments; app validates and compiles.

## Pack files
Machine packs live in `app/src/main/assets/skills/`. Tool schema is `emit_vxl.schema.json`. Runtime router is `www/js/skills.js`.

Remote planners use the same four packs and `VeloraSkills.toolSpec` (the emit_vxl schema). `lockArgs` rejects unknown fields. `accept` expands, then runs `VeloraVxl.validate`. A rejected call falls back to Needle or skill expand. The brief is the only payload; reference images stay on device.
