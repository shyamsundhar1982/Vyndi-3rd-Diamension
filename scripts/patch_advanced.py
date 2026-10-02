#!/usr/bin/env python3
from pathlib import Path
import base64

# Decode advanced-features.mjs if present as b64 sibling
b64 = Path("scripts/advanced_features.b64")
if b64.exists() and not Path("apps/web/advanced-features.mjs").exists():
    Path("apps/web/advanced-features.mjs").write_bytes(base64.b64decode(b64.read_text().strip()))
    print("decoded mjs")

css_path = Path("apps/web/styles.css")
css = css_path.read_text()
if "Help manual + advanced surfaces" not in css:
    css_path.write_text(css + "\n" + Path("scripts/advanced_features.css").read_text())
    print("css")
else:
    print("css exists")

html_path = Path("apps/web/index.html")
html = html_path.read_text()
changed = False
if 'id="helpOverlay"' not in html:
    html = html.replace("</body>", Path("scripts/help_manual_snip.html").read_text() + "\n</body>", 1)
    changed = True
if 'id="helpOpenBtn"' not in html:
    if ">Reset view</button>" in html:
        html = html.replace(
            ">Reset view</button>",
            '>Reset view</button>\n      <button type="button" id="helpOpenBtn" class="ghost">Help</button>',
            1,
        )
        changed = True
    elif 'id="openAdvanced"' in html:
        html = html.replace(
            'id="openAdvanced">Advanced</button>',
            'id="openAdvanced">Advanced</button><button type="button" id="helpOpenBtn" class="ghost">Help</button>',
            1,
        )
        changed = True
if 'id="applyCoastBtn"' not in html:
    block = Path("scripts/advanced_block.html").read_text()
    if 'id="rimFont"' in html:
        html = html.replace(
            '<strong>Fonts',
            block + "\n        <div class=\"industry-block\">\n          <strong>Fonts",
            1,
        )
        changed = True
    elif 'id="wizardOverlay"' in html:
        html = html.replace('<div id="wizardOverlay"', block + '\n      <div id="wizardOverlay"', 1)
        changed = True
if changed:
    html_path.write_text(html)
    print("html")
else:
    print("html skip")

app_path = Path("apps/web/app.mjs")
app = app_path.read_text()
if "HELP_SECTIONS" not in app:
    sn = Path("apps/web/advanced-features.mjs").read_text()
    app_path.write_text(app.rstrip() + "\n" + sn + "\n")
    print("app", app_path.stat().st_size)
else:
    print("app exists")
