#!/usr/bin/env python3
from pathlib import Path
html_path = Path("apps/web/index.html")
html = html_path.read_text()
if 'id="qrReverseUrl"' not in html:
    block = """
        <div class="industry-block">
          <strong>QR reverse + batch + PDF</strong>
          <label>QR URL / result link<input id="qrReverseUrl" type="url" placeholder="https://results.example/athlete"></label>
          <label class="check"><input id="qrOnReverse" type="checkbox" checked> Engrave QR code on reverse</label>
          <button type="button" id="downloadPdfOrder">PDF order form</button>
          <button type="button" id="batchSharedRun">Batch (shared terrain)</button>
          <p id="batchSharedStatus" class="hint"></p>
        </div>
"""
    needle = '<button type="button" id="orderSheetBtn">Order sheet CSV+JSON</button>'
    if needle in html:
        html = html.replace(needle, needle + "\n" + block, 1)
        html_path.write_text(html)
        print("index controls added")
    else:
        print("orderSheetBtn not found")
else:
    print("index already has QR controls")

app_path = Path("apps/web/app.mjs")
app = app_path.read_text()
if "function buildMinimalPdf" in app:
    print("app already patched")
else:
    snippet = Path("apps/web/qr-batch-pdf.mjs").read_text()
    app_path.write_text(app.rstrip() + "\n" + snippet + "\n")
    print("app patched", app_path.stat().st_size)
