# VYNDI 3rd Diamension

**One terrain engine. One iconic workbench. Web + Desktop.**

VYNDI 3rd Diamension combines the proven strengths of:

- **TrailRelief** — simple ribbon-first UI, event-aware presentation, advanced desktop/offline terrain workflow, large-GPX preprocessing, personalization and fast engineering controls.
- **VYNDI Merchandise Memory (VMM)** — Terrain Medal production engine, event/geography discovery, route styles, fabrication/export packages, authenticity, security, qualification and Cloudflare-ready web delivery.

## Product principles

1. **Simple first** — the primary screen stays visually calm.
2. **Ribbon intelligence** — event/rider/date/distance/elevation are derived automatically from GPX metadata where possible.
3. **Terrain as material** — independent visual controls for land, forest, mountain, snow, water, route, roads and labels.
4. **One governed production model** — preview, GLB, STL, OBJ and 3MF are driven by the same canonical configuration.
5. **Progressive engineering depth** — advanced DEM, map, shape, fabrication and validation controls live behind an Advanced workbench.
6. **Web + Desktop parity** — both front ends consume the same shared engine.

## Initial architecture

```
apps/
  web/          ribbon-first web studio
  desktop/      Electron shell
packages/
  engine/       canonical terrain / mesh / export core
  gpx/          large-GPX parser + worker
  toolkit/      shared production configuration
tests/          contract tests
```

The source repositories remain untouched and continue to serve as proven reference baselines.
