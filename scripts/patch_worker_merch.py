#!/usr/bin/env python3
from pathlib import Path
import re
p = Path("src/worker.mjs")
t = p.read_text()
if "Merchandise landing" in t or 'pathname==="/merch"' in t:
    print("worker already merch landing")
    raise SystemExit(0)
old = '''    if(url.pathname==="/"){\n      const target=new URL(request.url);target.pathname="/apps/web/";return secure(Response.redirect(target.toString(),302));\n    }\n    return secure(await env.ASSETS.fetch(request));'''
new = '''    if(url.pathname==="/"||url.pathname==="/merch"||url.pathname==="/merch.html"){\n      // Merchandise landing\n      const assetUrl=new URL(request.url);\n      assetUrl.pathname="/index.html";\n      return secure(await env.ASSETS.fetch(new Request(assetUrl.toString(),request)));\n    }\n    if(url.pathname==="/workbench"||url.pathname==="/studio"){\n      const target=new URL(request.url);target.pathname="/apps/web/";return secure(Response.redirect(target.toString(),302));\n    }\n    return secure(await env.ASSETS.fetch(request));'''
if old in t:
    p.write_text(t.replace(old, new))
    print("worker patched")
else:
    t2, n = re.subn(
        r'if\(url\.pathname==="/"\)\{[^\}]+pathname="/apps/web/"[^\}]+\}[\s\S]*?return secure\(await env\.ASSETS\.fetch\(request\)\);',
        new.strip(),
        t,
        count=1,
    )
    if n:
        p.write_text(t2)
        print("worker patched via regex")
    else:
        print("pattern not found")
        i=t.find('pathname==="/"')
        print(repr(t[i:i+200]))
