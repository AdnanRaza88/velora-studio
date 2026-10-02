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
- Autotrace / edge simplify → path candidates → VXL path layer (Phase image-to-vector).
- Needle does not "see" pixels; it only structures the text brief. Trace is a separate module.

## Why Needle 2 is the default agent
- ~14 MB binary, ~28 MB RAM — ships inside the APK.
- Built for tool calling and structured extraction, not chat.
- Skills = tool definitions + system instructions that force VXL-shaped output.
- No API key, no network required for Session A baseline.

Remote providers (optional later) can replace or assist Session A for richer briefs.
They are not required for the core loop.

## VXL is the contract
AI never draws pixels. AI emits VXL. The app always owns geometry.
