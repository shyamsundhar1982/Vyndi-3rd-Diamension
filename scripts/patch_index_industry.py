#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/index.html")
html = p.read_text()
if 'id="industryPanel"' in html:
    print("industry panel already present")
    raise SystemExit(0)
panel = Path("scripts/industry_panel.html").read_text()
needle = '<span class="eyebrow">EXPORTS</span>'
idx = html.find(needle)
if idx < 0:
    raise SystemExit("EXPORTS not found")
sec = html.rfind("<section>", 0, idx)
if sec < 0:
    raise SystemExit("section not found")
html = html[:sec] + panel + "\n      " + html[sec:]
p.write_text(html)
print("index industry panel inserted", len(html))
