#!/usr/bin/env python3
from pathlib import Path
import re
p = Path("apps/web/index.html")
html = p.read_text()
html2 = html
html2 = html2.replace(
    "location.href='https://vyndi-ride-stories.vayushastr.workers.dev/'",
    "location.href='/'")
html2 = html2.replace(
    'location.href="https://vyndi-ride-stories.vayushastr.workers.dev/"',
    'location.href="/"')
if "merchHomeBtn" not in html2:
    for needle in [">Help</button>", 'id="helpOpenBtn"', ">Reset view</button>"]:
        if needle in html2:
            html2 = html2.replace(
                needle,
                needle + '\n      <button type="button" id="merchHomeBtn" class="ghost" onclick="location.href=\'/\'">Merchandise</button>',
                1,
            )
            break
if "wb-path-bar" not in html2:
    bar = (
        '<div id="wb-path-bar" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;'
        'justify-content:space-between;padding:6px 14px;background:#0e0e10;border-bottom:1px solid #2a2a30;'
        'font:11px system-ui,sans-serif;color:#a1a1aa">'
        '<div><strong style="color:#ff9f2f">Production workbench</strong> - Terrain medal print studio - '
        '<span style="color:#71717a">/apps/web/</span></div>'
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'
        '<a href="/" style="color:#e4e4e7;text-decoration:none;border:1px solid #3f3f46;padding:4px 10px;border-radius:999px">'
        '&larr; Merchandise home</a>'
        '<a href="/apps/web/" style="color:#0a0a0b;background:linear-gradient(180deg,#ffb347,#e8891a);text-decoration:none;'
        'padding:4px 10px;border-radius:999px;font-weight:700">Workbench</a>'
        '</div></div>\n'
    )
    if "</header>" in html2:
        html2 = html2.replace("</header>", "</header>\n" + bar, 1)
    elif 'class="topbar"' in html2:
        html2 = re.sub(
            r'(<div class="topbar"[^>]*>[\s\S]*?</div>\s*)',
            r"\1" + bar,
            html2,
            count=1,
        )
    else:
        html2 = html2.replace("<body>", "<body>\n" + bar, 1)
if html2 != html:
    p.write_text(html2)
    print("nav updated")
else:
    print("no change")
