#!/usr/bin/env python3
from pathlib import Path
html_path = Path("apps/web/index.html")
html = html_path.read_text()
if 'id="merchHomeBtn"' in html:
    print("nav exists")
else:
    inserted = False
    for needle, repl in [
        ('id="helpOpenBtn"',
         'id="merchHomeBtn" class="ghost" onclick="location.href=\'/\'">Merchandise</button>\n      <button type="button" id="helpOpenBtn"'),
        ('>Advanced</button>',
         '>Advanced</button><button type="button" id="merchHomeBtn" class="ghost" onclick="location.href=\'/\'">Merchandise</button>'),
        ('>Reset view</button>',
         '>Reset view</button>\n      <button type="button" id="merchHomeBtn" class="ghost" onclick="location.href=\'/\'">Merchandise</button>'),
    ]:
        if needle in html:
            html = html.replace(needle, repl, 1)
            i = html.find('id="merchHomeBtn"')
            pre = html[max(0,i-50):i]
            if '<button' not in pre:
                html = html.replace(
                    'id="merchHomeBtn" class="ghost"',
                    '<button type="button" id="merchHomeBtn" class="ghost"',
                    1,
                )
            inserted = True
            break
    if inserted:
        html_path.write_text(html)
        print("nav inserted")
    else:
        print("nav failed")
