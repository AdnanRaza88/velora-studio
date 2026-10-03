# Velora skill packs

Session A loads one pack, then calls `emit_vxl`. The app validates and compiles. Packs do not emit SVG.

| Pack | Asset | System file |
|------|--------|-------------|
| logo | `app/src/main/assets/skills/logo.json` | `skills/logo.md` |
| textile | `app/src/main/assets/skills/textile.json` | `skills/textile.md` |
| character | `app/src/main/assets/skills/character.json` | `skills/character.md` |
| icon | `app/src/main/assets/skills/icon.json` | `skills/icon.md` |

Shared tool schema: `app/src/main/assets/skills/emit_vxl.schema.json`.
Named stroke profiles: `skills/stroke-profiles.json` (taper, swell, point).

Runtime mirror: `app/src/main/assets/www/js/skills.js` (`VeloraSkills.compose`). Keep pack `system` strings identical to the JSON assets. Check with `node tools/skill-packs.js`.

Needle 2 android-arm64 is vendored at `app/src/main/assets/needle/needle-android-arm64` (Apache-2.0, Cactus-Compute/needle2). See `app/src/main/assets/needle/NOTICE.md`.
