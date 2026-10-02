#!/usr/bin/env python3
from pathlib import Path
import re
p = Path("src/worker.mjs")
t = p.read_text()
# Always normalize to stable merch route
new_block = '''    if(url.pathname==="/"||url.pathname==="/merch"||url.pathname==="/merch.html"){
      // Merchandise landing (serve static merch page; avoid root index loop)
      const assetUrl=new URL(request.url);
      assetUrl.pathname="/apps/web/merch.html";
      return secure(await env.ASSETS.fetch(new Request(assetUrl.toString(), request)));
    }
    if(url.pathname==="/workbench"||url.pathname==="/studio"){
      const target=new URL(request.url);target.pathname="/apps/web/";return secure(Response.redirect(target.toString(),302));
    }
'''
if 'assetUrl.pathname="/apps/web/merch.html"' in t:
    print("already fixed merch path")
elif 'pathname==="/merch"' in t:
    t = t.replace('assetUrl.pathname="/index.html";', 'assetUrl.pathname="/apps/web/merch.html";')
    p.write_text(t)
    print("fixed path to apps/web/merch.html")
elif 'pathname==="/"' in t and 'apps/web/' in t:
    # replace old redirect block
    t2, n = re.subn(
        r'if\(url\.pathname==="/"\)\{[\s\S]*?return secure\(Response\.redirect\(target\.toString\(\),302\)\);\s*\}',
        new_block.strip(),
        t,
        count=1,
    )
    if n:
        p.write_text(t2)
        print("replaced root redirect")
    else:
        # insert before final ASSETS.fetch
        marker = 'return secure(await env.ASSETS.fetch(request));'
        if marker in t and new_block.strip() not in t:
            p.write_text(t.replace(marker, new_block + '\n    ' + marker, 1))
            print("inserted before assets")
        else:
            print("could not patch")
else:
    marker = 'return secure(await env.ASSETS.fetch(request));'
    if marker in t:
        p.write_text(t.replace(marker, new_block + '\n    ' + marker, 1))
        print("inserted merch block")
    else:
        print("no assets marker")
