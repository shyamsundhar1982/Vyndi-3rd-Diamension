#!/usr/bin/env python3
import base64, pathlib
a=pathlib.Path("scripts/ind_b64_a.txt").read_text().strip()
b=pathlib.Path("scripts/ind_b64_b.txt").read_text().strip()
pathlib.Path("apps/web/industry-studio.mjs").write_bytes(base64.b64decode(a+b))
print("industry-studio", pathlib.Path("apps/web/industry-studio.mjs").stat().st_size)
