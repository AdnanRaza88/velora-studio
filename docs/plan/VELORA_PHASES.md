# Velora Studio — Build Phases

## Vision
Code-to-design platform. Prompt or JSON (VXL) becomes editable, print-safe vector. Raster is preview only.

## Pipeline
Prompt → Intent / skill → VXL (JSON) → validate → vector compile → SVG canvas → edit → export SVG/PNG/VXL

## Phase 0 — Shell that works (done baseline)
- Android WebView shell
- GitHub Actions APK (artifact: velora-debug-apk)
- Studio / New / Settings routes load content

## Phase 1 — Workshop core (this sprint)
- Reliable navigation
- Provider registry UI (remote + local slots)
- API keys stored only on device (localStorage / EncryptedSharedPreferences later)
- Prompt → procedural VXL → SVG (logo + textile)
- Textile repeats: block, half-drop, half-brick, mirror
- Export SVG download
- Show VXL JSON for the generated scene

## Phase 2 — Real VXL engine
- Full VXL schema (paths, groups, strokes, fills, layers)
- Deterministic compiler to SVG
- Import/paste VXL JSON → render
- Project save/load on device

## Phase 3 — Remote agents
- Provider adapters: OpenAI, Anthropic, Gemini, Grok/OpenRouter
- System skill prompts per category (logo, textile, illustration)
- Adaptive questions when brief is thin
- Validate model JSON before compile; repair loop

## Phase 4 — Local agents
- On-device model download UI
- Needle 2/3 (or similar 8–30 MB tool-call model) for structured intent extraction
- Optional larger quant later via llama.cpp / MLC for full VXL generation
- Offline-first path: local extract → rule/template VXL if no remote key

## Phase 5 — Editor
- Select, move, scale, rotate
- Recolor (figure / ground / accent jobs)
- Path node edit (basic)
- Undo/redo
- Text tool
- Layers panel

## Phase 6 — Illustrator-grade tools
- Pen / pencil
- Variable width stroke
- Blend
- Boolean (union, subtract)
- Pattern instance controls

## Acceptance (MVP)
User can: set one provider key OR use offline procedural path → describe a logo or textile → get unique editable SVG → download vector → optionally paste VXL and re-render.

## Privacy
Keys and projects stay on device. Remote providers receive only the brief text the user typed. No silent uploads.
