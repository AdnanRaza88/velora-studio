from pathlib import Path

p = Path("app/src/main/assets/www/js/trace.js")
text = p.read_text()
old = """    if (chord < 70 || chord > 1200) continue;
    var bow = chordBow(segs[i].pts);
    if (bow > 0.85 || (chord > 160 && bow > 0.55) || (chord > 200 && bow > 0.42) || (chord > 260 && bow > 0.32) || (chord > 320 && bow > 0.24) || (chord > 400 && bow > 0.18) || (chord > 520 && bow > 0.14) || (chord > 640 && bow > 0.11) || (chord > 800 && bow > 0.09) || (chord > 1000 && bow > 0.07)) continue;"""
new = """    if (chord < 70 || chord > 1400) continue;
    var bow = chordBow(segs[i].pts);
    if (bow > 0.85 || (chord > 160 && bow > 0.55) || (chord > 200 && bow > 0.42) || (chord > 260 && bow > 0.32) || (chord > 320 && bow > 0.24) || (chord > 400 && bow > 0.18) || (chord > 520 && bow > 0.14) || (chord > 640 && bow > 0.11) || (chord > 800 && bow > 0.09) || (chord > 1000 && bow > 0.07) || (chord > 1200 && bow > 0.055)) continue;"""
if old not in text:
    raise SystemExit("bow block not found")
text = text.replace(old, new, 1)
old2 = """      var allow = chord > 1000 ? 0.82 : chord > 800 ? 0.95 : chord > 640 ? 1.05 : chord > 520 ? 1.2 : chord > 400 ? 1.35 : chord > 320 ? 1.55 : chord > 260 ? 1.8 : 2.4;"""
new2 = """      var allow = chord > 1200 ? 0.72 : chord > 1000 ? 0.82 : chord > 800 ? 0.95 : chord > 640 ? 1.05 : chord > 520 ? 1.2 : chord > 400 ? 1.35 : chord > 320 ? 1.55 : chord > 260 ? 1.8 : 2.4;"""
if old2 not in text:
    raise SystemExit("allow block not found")
text = text.replace(old2, new2, 1)
old3 = """      var mag = Math.min(chord * 0.28, chord > 1000 ? 108 : chord > 800 ? 100 : chord > 640 ? 88 : chord > 520 ? 76 : chord > 400 ? 68 : chord > 320 ? 60 : chord > 260 ? 52 : 42);"""
new3 = """      var mag = Math.min(chord * 0.28, chord > 1200 ? 116 : chord > 1000 ? 108 : chord > 800 ? 100 : chord > 640 ? 88 : chord > 520 ? 76 : chord > 400 ? 68 : chord > 320 ? 60 : chord > 260 ? 52 : 42);"""
if old3 not in text:
    raise SystemExit("mag block not found")
text = text.replace(old3, new3, 1)
p.write_text(text)
print("patched", len(text))
