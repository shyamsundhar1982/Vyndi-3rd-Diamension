#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
echo "Cloning vayu-shastr/vyndi-ride-stories..."
git clone --depth 1 https://github.com/vayu-shastr/vyndi-ride-stories.git "$TMP/rs"
DEST="$ROOT/apps/merch-site"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -a "$TMP/rs/dist/." "$DEST/"
python3 - "$DEST" <<'PY'
from pathlib import Path
import sys, re
root = Path(sys.argv[1])
replacements = [
    ('href="/terrain-medal"', 'href="/apps/web/"'),
    ('href="terrain-medal.html"', 'href="/apps/web/"'),
    ('href="/community"', 'href="https://vyndi-ride-stories.vayushastr.workers.dev/community"'),
    ('href="/join"', 'href="https://vyndi-ride-stories.vayushastr.workers.dev/join"'),
]
banner = (
    '\n<div id="v3d-bridge" style="position:sticky;top:0;z-index:1000;display:flex;flex-wrap:wrap;gap:10px;'
    'align-items:center;justify-content:space-between;padding:10px 16px;background:linear-gradient(90deg,#1a1208,#24180e);'
    'border-bottom:1px solid #4a3a22;color:#e7d3b0;font:13px system-ui,sans-serif">'
    '<div><strong style="color:#ffb347">VYNDI 3rd Diamension</strong> · Official merch from Ride Stories · '
    '<span style="color:#9a8b7c">My Road — My Glory</span></div>'
    '<a href="/apps/web/" style="background:linear-gradient(180deg,#ffb347,#c47a1a);color:#1a1008;padding:8px 14px;'
    'border-radius:999px;font-weight:700;text-decoration:none">Terrain Medal Workbench →</a></div>\n'
)
for path in list(root.glob("*.html")):
    t = path.read_text(encoding="utf-8", errors="ignore")
    orig = t
    for a, b in replacements:
        t = t.replace(a, b)
    if path.name == "index.html" and "v3d-bridge" not in t:
        t, n = re.subn(r"(<body[^>]*>)", r"\1" + banner, t, count=1)
    if t != orig:
        path.write_text(t, encoding="utf-8")
        print("patched", path.name)
print("merch-site files", sum(1 for _ in root.rglob("*")))
PY
rm -rf "$TMP"
echo "Sync complete → $DEST"
