# Premium quality fixes (deployed via toolkit-core)

## Problems observed on Kashmir → Kanyakumari medals
1. **Sea not visible** — water was only detected from sparse OSM landcover; DEM never classified low elevation as water.
2. **Broken route** — route was aggressively stride-sampled and segments were dropped if *any* prism corner left the land mask.
3. **Weak demarcation** — shallow water carve + soft ocean shelf on geo-medallions.

## Fixes in `packages/toolkit/toolkit-core.mjs`
- `classifyTerrainMaterial`: elevations ≤ `seaLevelM` (default 1.5 m) → water region.
- `featureMeshes`: adaptive densify (`densifyProjectedRoute`), midpoint-only clip, higher segment budget.
- Deeper default `waterDepthMm` / wave amplitude; stronger geo-medallion ocean shelf.

## Recommended studio settings for premium medals
| Control | Value |
|---------|-------|
| Renderer | **V3D Unified** |
| Presentation | **Premium terrain medal** |
| Shape | **Round medal · geographic terrain** (geo-medallion) |
| Water depth | **1.0–1.4 mm** |
| Route style | **Raised** |
| Route width | **1.4–2.0 mm** |
| Water colour | saturated blue (`#155b8a` or deeper) |
| Land vs Water | keep strong contrast |

After deploy: hard-refresh the studio, click **GENERATE PRINT MODEL** again.
