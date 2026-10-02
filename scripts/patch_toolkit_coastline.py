#!/usr/bin/env python3
from pathlib import Path
p = Path("packages/toolkit/toolkit-core.mjs")
t = p.read_text()
if "coastlineBoost" in t:
    print("coastline already patched")
    raise SystemExit(0)
old = """    if(material===4&&c.surface.waterMode!=="none"){
      relief-=Math.max(.45,Number(c.surface.waterDepthMm)||1.1);
      if(c.surface.waterMode==="procedural-waves"){
        const spacing=Math.max(.4,Number(c.surface.waveSpacingMm)||2.4),amp=Math.max(0,Number(c.surface.waveHeightMm)||.45);
        const x=nx*projection.radius,y=ny*projection.radius;
        relief+=amp*(.58*Math.sin((x+y*.31)/spacing*Math.PI*2)+.28*Math.sin((y-x*.17)/spacing*Math.PI*3.1));
      }
    }"""
new = """    if(material===4&&c.surface.waterMode!=="none"){
      relief-=Math.max(.45,Number(c.surface.waterDepthMm)||1.1);
      if(c.surface.waterMode==="procedural-waves"){
        const spacing=Math.max(.4,Number(c.surface.waveSpacingMm)||2.4),amp=Math.max(0,Number(c.surface.waveHeightMm)||.45);
        const x=nx*projection.radius,y=ny*projection.radius;
        relief+=amp*(.58*Math.sin((x+y*.31)/spacing*Math.PI*2)+.28*Math.sin((y-x*.17)/spacing*Math.PI*3.1));
      }
    }else if(material!==4&&Number.isFinite(elevation)&&elevation<=(Number(c.terrainBands?.seaLevelM)||1.5)+35){
      const coastlineBoost=Math.max(0,Number(c.surface.coastlineBoostMm)||.35);
      relief+=coastlineBoost*(1-Math.min(1,Math.max(0,(elevation-(Number(c.terrainBands?.seaLevelM)||1.5))/35)));
    }"""
if old not in t:
    print("water block not found - skip coastline")
else:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("coastline boost patched", len(t))
