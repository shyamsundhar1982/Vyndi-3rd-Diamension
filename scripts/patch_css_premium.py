#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/styles.css")
css = p.read_text()
if ".premium-btn" in css:
    print("css already has premium-btn")
else:
    css += "\n/* Premium one-click preset */\n.premium-btn{border:1px solid #c47a1a;background:linear-gradient(180deg,#3a2a12,#241a0c);color:#ffc56a;font-weight:800;letter-spacing:.08em;padding:8px 12px;border-radius:4px;cursor:pointer;font-size:10px}\n.premium-btn:hover{border-color:#ff9f2f;color:#ffe2a8;box-shadow:0 0 0 1px #ff9f2f55}\n.premium-btn.rail{width:100%;margin-bottom:8px;padding:10px 12px;font-size:11px}\n.ribbon-actions .premium-btn{min-height:36px}\n"
    p.write_text(css)
    print("css patched", len(css))
