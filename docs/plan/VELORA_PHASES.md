# Velora Studio — Build Phases

## Vision
Code-to-design platform. Prompt or JSON (VXL) becomes editable, print-safe vector. Raster is preview only.

## Pipeline
Prompt → Intent / skill → VXL (JSON) → validate → vector compile → SVG canvas → edit → export SVG/PNG/VXL

## Phase 0 — Shell that works (done)
- [x] Android WebView shell
- [x] GitHub Actions APK (artifact: velora-debug-apk)
- [x] Studio / New / Settings routes load content

## Phase 1 — Workshop core (done)
- [x] Reliable navigation
- [x] Provider registry UI (remote + local slots)
- [x] API keys stored only on device (localStorage / EncryptedSharedPreferences later)
- [x] Prompt → procedural VXL → SVG (logo + textile)
- [x] Textile repeats: block, half-drop, half-brick, mirror
- [x] Export SVG download
- [x] Show VXL JSON for the generated scene

## Phase 2 — Real VXL engine (done)
- [x] Full VXL schema (paths, groups, strokes, fills, layers) — docs/spec/VXL.md
- [x] Deterministic compiler to SVG
- [x] Import/paste VXL JSON → render
- [x] Project save/load on device

## Phase 3 — Remote agents
- [ ] Provider adapters: OpenAI, Anthropic, Gemini, Grok/OpenRouter
- [ ] System skill prompts per category (logo, textile, illustration)
- [ ] Adaptive questions when brief is thin
- [ ] Validate model JSON before compile; repair loop

## Phase 4 — Local agents
- [ ] On-device model download UI
- [ ] Needle 2/3 (or similar 8–30 MB tool-call model) for structured intent extraction
- [ ] Optional larger quant later via llama.cpp / MLC for full VXL generation
- [ ] Offline-first path: local extract → rule/template VXL if no remote key

## Phase 5 — Editor
- [ ] Select, move, scale, rotate
- [ ] Recolor (figure / ground / accent jobs)
- [ ] Path node edit (basic)
- [ ] Undo/redo
- [ ] Text tool
- [ ] Layers panel

## Phase 6 — Illustrator-grade tools
- [ ] Pen / pencil
- [ ] Variable width stroke
- [ ] Blend
- [ ] Boolean (union, subtract)
- [ ] Pattern instance controls

## Acceptance (MVP)
User can: set one provider key OR use offline procedural path → describe a logo or textile → get unique editable SVG → download vector → optionally paste VXL and re-render.

## Privacy
Keys and projects stay on device. Remote providers receive only the brief text the user typed. No silent uploads. Projects never store API keys.
