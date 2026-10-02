# Velora skill packs

Session A loads one pack, then calls `emit_vxl`. The app validates and compiles. Packs do not emit SVG.

| Pack | Asset | System file |
|------|--------|-------------|
| logo | `app/src/main/assets/skills/logo.json` | `skills/logo.md` |
| textile | `app/src/main/assets/skills/textile.json` | `skills/textile.md` |
| character | `app/src/main/assets/skills/character.json` | `skills/character.md` |
| icon | `app/src/main/assets/skills/icon.json` | `skills/icon.md` |

Shared tool schema: `app/src/main/assets/skills/emit_vxl.schema.json`.

Runtime mirror: `app/src/main/assets/www/js/skills.js` (`VeloraSkills.compose`). Keep pack `system` strings identical to the JSON assets. Check with `node tools/skill-packs.js`.

Needle 2 binary is not in this tree. When a redistributable android-arm64 build is available, place it at `app/src/main/assets/needle/needle-android-arm64` (expected about 14 MB). Do not commit a non-redistributable binary.
