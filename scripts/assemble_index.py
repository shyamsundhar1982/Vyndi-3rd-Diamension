#!/usr/bin/env python3
import base64, pathlib
a = pathlib.Path("scripts/index_b64_a.txt").read_text().strip()
b = pathlib.Path("scripts/index_b64_b.txt").read_text().strip()
pathlib.Path("apps/web/index.html").write_bytes(base64.b64decode(a+b))
print("wrote index", pathlib.Path("apps/web/index.html").stat().st_size)
