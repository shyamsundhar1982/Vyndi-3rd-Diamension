#!/usr/bin/env python3
"""Replace passive colour ribbon with interactive material chips + inspector."""
from pathlib import Path

p = Path("apps/web/index.html")
html = p.read_text()
if 'class="mat-chip"' in html:
    print("already patched")
    raise SystemExit(0)

old = '''  <section class="material-ribbon" aria-label="Terrain material ribbon">
    <div class="ribbon-label"><strong>MATERIALS</strong><span id="landcoverStatus">live terrain palette</span></div>
    <label>Land<input data-palette="land" type="color" value="#6f9f46"></label>
    <label>Forest<input data-palette="forest" type="color" value="#2f6c31"></label>
    <label>Mountain<input data-palette="mountain" type="color" value="#8b5a31"></label>
    <label>Snow<input data-palette="snow" type="color" value="#f7f7f3"></label>
    <label>Water<input data-palette="water" type="color" value="#155b8a"></label>
    <label>Route<input data-palette="route" type="color" value="#ff2f24"></label>
    <label>Rim<input data-palette="rim" type="color" value="#22201f"></label>
    <label>Labels<input data-palette="labels" type="color" value="#f3c56a"></label>
  </section>'''

new = '''  <section class="material-ribbon" aria-label="Material selector">
    <div class="ribbon-label">
      <strong>MATERIALS</strong>
      <span id="landcoverStatus">tap a layer · edit colour &amp; settings</span>
    </div>
    <button type="button" class="mat-chip active" data-mat="land" title="Land surface">
      <input data-palette="land" type="color" value="#6f9f46" aria-label="Land colour">
      <span>Land</span>
    </button>
    <button type="button" class="mat-chip" data-mat="forest" title="Forest raise">
      <input data-palette="forest" type="color" value="#2f6c31" aria-label="Forest colour">
      <span>Forest</span>
    </button>
    <button type="button" class="mat-chip" data-mat="mountain" title="Mountain band">
      <input data-palette="mountain" type="color" value="#8b5a31" aria-label="Mountain colour">
      <span>Mountain</span>
    </button>
    <button type="button" class="mat-chip" data-mat="snow" title="Snow line">
      <input data-palette="snow" type="color" value="#f7f7f3" aria-label="Snow colour">
      <span>Snow</span>
    </button>
    <button type="button" class="mat-chip" data-mat="water" title="Sea and lakes">
      <input data-palette="water" type="color" value="#155b8a" aria-label="Water colour">
      <span>Water</span>
    </button>
    <button type="button" class="mat-chip" data-mat="route" title="Your GPX route">
      <input data-palette="route" type="color" value="#ff2f24" aria-label="Route colour">
      <span>Route</span>
    </button>
    <button type="button" class="mat-chip" data-mat="rim" title="Medal rim">
      <input data-palette="rim" type="color" value="#22201f" aria-label="Rim colour">
      <span>Rim</span>
    </button>
    <button type="button" class="mat-chip" data-mat="labels" title="Place labels">
      <input data-palette="labels" type="color" value="#f3c56a" aria-label="Label colour">
      <span>Labels</span>
    </button>
  </section>

  <section class="mat-inspector" id="matInspector" aria-label="Selected material settings">
    <div class="mat-inspector-head">
      <strong id="matInspectorTitle">Land</strong>
      <span id="matInspectorHint">Surface colour and overall relief</span>
    </div>
    <div class="mat-inspector-body" id="matInspectorBody"></div>
  </section>'''

if old not in html:
    raise SystemExit("material ribbon block not found")
html = html.replace(old, new, 1)
html = html.replace(
    '<option value="circle" selected>Round</option><option value="geo-medallion">Round medal · geographic terrain</option>',
    '<option value="circle">Round</option><option value="geo-medallion" selected>Round medal · geographic terrain</option>',
    1,
)
html = html.replace('id="waterDepth" type="range" min="0" max="3" step=".1" value=".6"',
                    'id="waterDepth" type="range" min="0" max="3" step=".1" value="1.1"', 1)
html = html.replace('id="waveHeight" type="number" min="0" max="1.5" step=".05" value=".3"',
                    'id="waveHeight" type="number" min="0" max="1.5" step=".05" value=".45"', 1)
p.write_text(html)
print("patched index", len(html))
