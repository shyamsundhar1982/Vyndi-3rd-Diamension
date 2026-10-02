#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/app.mjs")
t = p.read_text()
if "INDUSTRY STUDIO: readiness" in t:
    print("industry already in app")
    raise SystemExit(0)
snippet = Path("apps/web/industry-studio.mjs").read_text()
t = t.rstrip() + "\n\n" + snippet + "\n"
t += '\n$("wizClose2")?.addEventListener("click", ()=>{ if($("wizardOverlay")) $("wizardOverlay").hidden=true; });\n'
p.write_text(t)
print("app industry appended", len(t))
