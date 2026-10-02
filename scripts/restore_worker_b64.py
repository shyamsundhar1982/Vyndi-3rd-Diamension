#!/usr/bin/env python3
from pathlib import Path
import base64
p1=Path('scripts/wp1.b64').read_text().strip()
p2=Path('scripts/wp2.b64').read_text().strip()
raw=base64.b64decode(p1+p2)
Path('src/worker.mjs').write_bytes(raw)
print('restored', len(raw))
