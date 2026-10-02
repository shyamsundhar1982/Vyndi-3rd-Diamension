#!/usr/bin/env python3
from pathlib import Path
p=Path("apps/web/styles.css")
css=p.read_text()
if "Workbench layout orientation" not in css:
    css+="\n"+Path("scripts/workbench_layout.css").read_text()
    p.write_text(css)
    print("layout css appended")
else:
    print("layout css exists")
