#!/usr/bin/env python3
from pathlib import Path
app = Path("apps/web/app.mjs")
t = app.read_text()
if "Material inspector: top chips" in t:
    print("app already has inspector")
else:
    t = t.replace(
        'setControl("forestRaise",.18);setControl("waterDepth",.25);setControl("waveHeight",.12);setControl("waveSpacing",2.8);',
        'setControl("forestRaise",.22);setControl("waterDepth",1.1);setControl("waveHeight",.4);setControl("waveSpacing",2.4);',
        1,
    )
    snippet = Path("apps/web/material-inspector-snippet.mjs").read_text()
    app.write_text(t.rstrip() + "\n\n" + snippet + "\n")
    print("app updated", app.stat().st_size)
