#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/index.html")
html = p.read_text()
changed = False
for a,b in [
    (">* PREMIUM</button>", ">\u2605 PREMIUM</button>"),
    (">* PREMIUM PRESET</button>", ">\u2605 PREMIUM PRESET</button>"),
]:
    if a in html:
        html = html.replace(a,b)
        changed = True
if 'class="work-flow"' not in html:
    flow = """
  <nav class=\"work-flow\" aria-label=\"Workbench steps\">
    <div class=\"step active\" data-flow=\"1\"><span class=\"num\">1</span> Route</div>
    <span class=\"sep\">-</span>
    <div class=\"step\" data-flow=\"2\"><span class=\"num\">2</span> Shape</div>
    <span class=\"sep\">-</span>
    <div class=\"step\" data-flow=\"3\"><span class=\"num\">3</span> Style</div>
    <span class=\"sep\">-</span>
    <div class=\"step\" data-flow=\"4\"><span class=\"num\">4</span> Generate</div>
    <span class=\"sep\">-</span>
    <div class=\"step\" data-flow=\"5\"><span class=\"num\">5</span> Export</div>
  </nav>
"""
    # fix escaped quotes for actual HTML
    flow = flow.replace('\\"', '"')
    idx = html.find('id="matInspectorBody"')
    if idx < 0:
        idx = html.find('class="mat-inspector"')
    if idx >= 0:
        end = html.find('</section>', idx)
        if end > 0:
            end += len('</section>')
            html = html[:end] + flow + html[end:]
            changed = True
if 'id="prodHint"' not in html:
    old = '<button id="generate" class="primary" disabled>GENERATE PRINT MODEL</button>'
    new = (
        '<div class="prod-actions">'
        '<button id="generate" class="primary" disabled>GENERATE PRINT MODEL</button>'
        '</div>'
        '<p class="prod-hint" id="prodHint"><strong>Workbench:</strong> 1) GPX / 2) Shape / 3) Premium / 4) Generate / 5) Export 3MF</p>'
    )
    if old in html:
        html = html.replace(old, new, 1)
        changed = True
if 'id="matTip"' not in html and 'matInspectorHint' in html:
    html = html.replace(
        'id="matInspectorHint">Surface colour and overall relief</span>',
        'id="matInspectorHint">Surface colour and overall relief</span>\n      <span class="mat-tip" id="matTip">Tip: tap a chip, adjust only that layer.</span>',
        1,
    )
    changed = True
if changed:
    p.write_text(html)
    print("index UX patched", len(html))
else:
    print("index unchanged")
