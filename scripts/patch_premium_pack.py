#!/usr/bin/env python3
from pathlib import Path

css_path = Path("apps/web/styles.css")
css = css_path.read_text()
if "Premium workbench skin" not in css:
    css_path.write_text(css + "\n" + Path("scripts/premium_pack.css").read_text())
    print("css ok")
else:
    print("css exists")

html_path = Path("apps/web/index.html")
html = html_path.read_text()
if 'id="rimFont"' not in html:
    block = Path("scripts/premium_pack_block.html").read_text()
    if 'id="qrReverseUrl"' in html:
        html = html.replace(
            '<strong>QR reverse + batch + PDF</strong>',
            block + "\n          <strong>QR reverse + batch + PDF</strong>",
            1,
        )
    elif 'id="orderSheetBtn"' in html:
        html = html.replace(
            '<button type="button" id="orderSheetBtn">Order sheet CSV+JSON</button>',
            block + '\n<button type="button" id="orderSheetBtn">Order sheet CSV+JSON</button>',
            1,
        )
    elif 'id="wizardOverlay"' in html:
        html = html.replace('<div id="wizardOverlay"', block + '\n      <div id="wizardOverlay"', 1)
    html_path.write_text(html)
    print("html ok")
else:
    print("html exists")

app_path = Path("apps/web/app.mjs")
app = app_path.read_text()
if "vyndi-merchandise-memory-v2" not in app:
    sn = Path("apps/web/premium-pack.mjs").read_text()
    app_path.write_text(app.rstrip() + "\n" + sn + "\n")
    print("app ok", app_path.stat().st_size)
else:
    print("app exists")

tk = Path("packages/toolkit/toolkit-core.mjs")
if tk.exists():
    t = tk.read_text()
    if "densifyProjectedRoute" in t and "maxStepMm=.55" not in t:
        t2 = t.replace("maxStepMm=.7", "maxStepMm=.55").replace("maxStepMm=.75", "maxStepMm=.55")
        t2 = t2.replace("len>8)continue", "len>5.5)continue")
        if t2 != t:
            tk.write_text(t2)
            print("route continuity tightened")
        else:
            print("route patterns not matched")
    else:
        print("route already tight or no densify")
