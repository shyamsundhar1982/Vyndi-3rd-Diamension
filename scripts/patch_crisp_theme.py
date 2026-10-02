#!/usr/bin/env python3
from pathlib import Path
MARKER = "CRISP STUDIO THEME"
css_path = Path("apps/web/styles.css")
block_path = Path("scripts/crisp_theme.css")
css = css_path.read_text()
block = block_path.read_text()
if MARKER in css or "CRISP STUDIO THEME" in css:
    idx = css.find("/* ========== CRISP STUDIO THEME")
    if idx < 0:
        idx = css.find(MARKER)
    if idx >= 0:
        css = css[:idx].rstrip() + "\n\n" + block
    else:
        css = css.rstrip() + "\n\n" + block
else:
    css = css.rstrip() + "\n\n" + block
css_path.write_text(css)
print("crisp theme applied", len(css))
