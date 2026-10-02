#!/usr/bin/env python3
from pathlib import Path
p = Path("apps/web/styles.css")
css = p.read_text()
if ".industry-panel" in css:
    print("industry css already present")
    raise SystemExit(0)
css += """
/* Industry studio */
.industry-panel{border:1px solid #3a2d24;border-radius:6px;padding:10px;background:#14110e;margin:8px 0 12px;display:grid;gap:10px}
.industry-panel .eyebrow{color:var(--orange)}
.industry-block{display:grid;gap:6px;padding-top:6px;border-top:1px solid #2a221c}
.industry-block strong{font-size:10px;letter-spacing:.06em;color:#e7d3b0}
.industry-block button,.chip-row button{font-size:9px;padding:6px 8px;border:1px solid #4a3a2a;background:#1c1612;color:#d9cbb8;border-radius:3px;cursor:pointer}
.industry-block button:hover,.chip-row button:hover{border-color:var(--orange);color:#fff}
.chip-row{display:flex;flex-wrap:wrap;gap:4px}
.print-readiness{font-size:9px;line-height:1.45;color:#cbb9a8;background:#0f0d0b;border:1px solid #2e261f;border-radius:4px;padding:8px}
.print-readiness .ok{color:#8dcf8a;font-weight:700}
.print-readiness .warn{color:#ffb347;font-weight:700}
.print-readiness ul{margin:6px 0 0;padding-left:14px}
.print-readiness .warn-item{color:#ff8f6b}
.wizard-overlay{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:80;display:grid;place-items:center;padding:16px}
.wizard-overlay[hidden]{display:none!important}
.wizard-card{width:min(440px,100%);background:#171310;border:1px solid #5a4020;border-radius:8px;padding:14px;color:#efe6da}
.wizard-card header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.wiz-progress{height:4px;background:#2a221c;border-radius:2px;margin-bottom:12px;overflow:hidden}
.wiz-progress span{display:block;height:100%;width:20%;background:var(--orange);transition:width .2s}
.wiz-panel h3{margin:0 0 6px;font-size:14px}
.wiz-panel p{margin:0 0 12px;color:#b9a99a;font-size:12px}
.wiz-panel button{margin-right:6px}
@media(max-width:900px){
  .industry-panel{font-size:11px}
  .topbar,.event-ribbon{position:sticky;top:0;z-index:5}
}
"""
p.write_text(css)
print("industry css added", len(css))
