#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/index.html")
html = p.read_text()
if 'id="premiumPreset"' in html:
    print("index already has premium preset")
else:
    html = html.replace(
        '<button id="demoRoute">DEMO</button>',
        '<button id="demoRoute">DEMO</button>\n      <button id="premiumPreset" class="premium-btn" type="button" title="One-click industry premium medal">* PREMIUM</button>',
        1,
    )
    html = html.replace(
        '<button id="generate" class="primary" disabled>GENERATE PRINT MODEL</button>',
        '<button id="premiumPresetRail" class="premium-btn rail" type="button">* PREMIUM PRESET</button>\n        <button id="generate" class="primary" disabled>GENERATE PRINT MODEL</button>',
        1,
    )
    p.write_text(html)
    print("index patched", len(html))
