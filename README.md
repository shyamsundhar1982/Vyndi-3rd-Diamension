# VYNDI 3rd Diamension

**Industry-grade terrain medals from real routes — web studio + any 3D printer + Blender.**

Turn a GPX (trail, race, ride, hike) into a physical **3D elevated map medal** with:

- Real DEM terrain (Terrarium / GeoTIFF / Arc-ASCII / OpenTopography)
- Raised route line on the landscape
- **Inscribed rim** with event name, athlete name, date, distance, elevation
- Multiple **medal shapes** already built in (round, geo-medallion, square, triangle, ellipse, hexagon, octagon, heart, route-fit plaque, geographic cut-out)
- One governed mesh → **STL · OBJ · 3MF · GLB** that every major slicer and service bureau can read

Source lineage: [TrailRelief](https://github.com/shyamsundhar1982/trailrelief) (ribbon UX, large-GPX, desktop DEM) + VYNDI Merchandise Memory production engine.

---

## Live deployment (Cloudflare Worker)

**Studio:** https://vyndi-3rd-diamension.vayushastr.workers.dev/apps/web/

**Health:** https://vyndi-3rd-diamension.vayushastr.workers.dev/health

No local install required — open the studio URL in a browser.

Redeploy after git push (if Workers is linked to this repo) or:

```bash
npm install && npm run build && npx wrangler deploy
```

---

## Quick flow in the studio

| Step | What you do |
|------|-------------|
| **1 Upload GPX** | Drop one or more `.gpx` files (or Demo). Stats fill the ribbon automatically. |
| **2 Shape & rim** | Pick shape · diameter · enter event / name / date (inscribed on the border). |
| **3 Terrain** | Relief strength, materials (land / forest / mountain / snow / water / route / rim). |
| **4 Generate** | Production mesh from the same config that drives every export. |
| **5 Export** | Choose printer profile → download 3MF / STL / OBJ / GLB / full print package. |

Advanced drawer (DEM source, tiling, stand, joint clearance, bottom engraving) stays out of the way until you need it.

---

## Print on **any** 3D printer

There is no proprietary driver. Export standard meshes:

| Goal | Export | Open in |
|------|--------|---------|
| Multi-colour FDM (AMS / MMU) | **3MF** | Bambu Studio, OrcaSlicer, PrusaSlicer |
| Single-colour FDM / resin / SLS | **STL** | Cura, Lychee, Chitubox, any bureau |
| CAD / further work | **OBJ** | Fusion, Blender, etc. |
| Preview / AR | **GLB** | model-viewer, web |

### Built-in printer profiles

Bambu Lab P1S / AMS · Generic FDM 0.4 mm · Fine FDM 0.25 mm · MSLA/SLA resin · SLS/MJF service

---

## Shapes

Round · Round medal (geographic terrain) · Square · Triangle · Ellipse · Hexagon · Octagon · Heart · Route-fit plaque · Geographic cut-out

---

## Blender plugin

Path: `blender/vyndi_terrain_medal.py`

Install: Blender → Preferences → Add-ons → Install → enable **VYNDI Terrain Medal**.

Sidebar (N) → VYNDI: Import GLB/STL/OBJ · solid base · manifold check · export for any slicer.

---

## Architecture

```
apps/web/           ribbon-first studio
packages/
  engine/           mesh + STL/OBJ/GLB/3MF encode
  gpx/              large-GPX parser + worker
  toolkit/          production config, DEM, printer profiles
  ui/               ribbon metadata
  map/              landcover
  source-parity/    TrailRelief / VYNDI visual parity
src/worker.mjs      Cloudflare Worker (assets + API)
```

Web and desktop both consume `packages/engine` — one geometry truth.
