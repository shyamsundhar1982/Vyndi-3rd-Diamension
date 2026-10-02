#!/usr/bin/env python3
from pathlib import Path
a=Path("scripts/worker_a.js.txt").read_text()
b=Path("scripts/worker_b.js.txt").read_text()
Path("src/worker.mjs").write_text(a+b)
print("assembled", Path("src/worker.mjs").stat().st_size)
