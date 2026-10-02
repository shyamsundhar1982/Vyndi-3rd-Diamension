#!/usr/bin/env python3
from pathlib import Path
p=Path("apps/web/index.html")
html=p.read_text()
RS="https://vyndi-ride-stories.vayushastr.workers.dev/"
html2=html.replace(
  "onclick=\"location.href='/\"\">Merchandise</button>",
  f"onclick=\"location.href='{RS}'\">Merchandise</button>",
)
html2=html2.replace(
  'onclick="location.href=\'/\'">Merchandise</button>',
  f'onclick="location.href=\'{RS}\'">Merchandise</button>',
)
if 'merchHomeBtn' not in html2:
    for needle in ['>Help</button>', 'id="helpOpenBtn"', '>Reset view</button>', '>Advanced</button>']:
        if needle in html2:
            html2=html2.replace(
                needle,
                needle+f'\n      <button type="button" id="merchHomeBtn" class="ghost" onclick="location.href=\'{RS}\'">Merchandise</button>',
                1,
            )
            break
if html2!=html:
    p.write_text(html2)
    print("merch btn updated")
else:
    print("no change")
