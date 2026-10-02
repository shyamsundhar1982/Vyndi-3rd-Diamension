#!/usr/bin/env python3
from pathlib import Path
import base64
parts = sorted(Path('scripts').glob('worker_part_*.b64'))
if not parts:
    # try single
    p = Path('scripts/worker_full.b64')
    if p.exists():
        Path('src/worker.mjs').write_bytes(base64.b64decode(p.read_text().strip()))
        print('restored single', Path('src/worker.mjs').stat().st_size)
    else:
        print('no b64')
        raise SystemExit(1)
else:
    data = ''.join(x.read_text().strip() for x in parts)
    Path('src/worker.mjs').write_bytes(base64.b64decode(data))
    print('restored parts', Path('src/worker.mjs').stat().st_size)
