#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/styles.css")
css = p.read_text()
if "Workbench UX polish" in css:
    print("ux css already present")
    raise SystemExit(0)
extra = Path("scripts/ux_polish.css").read_text()
p.write_text(css + "\n" + extra)
print("ux css added", p.stat().st_size)
