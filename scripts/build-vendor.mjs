import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const webVendor=resolve(root,"apps/web/vendor");
const engineVendor=resolve(root,"packages/engine/vendor");
const sharedVendor=resolve(root,"packages/vendor");
await Promise.all([mkdir(webVendor,{recursive:true}),mkdir(engineVendor,{recursive:true}),mkdir(sharedVendor,{recursive:true})]);

await build({
  stdin:{contents:'export { default } from "three/src/extras/lib/earcut.js";',resolveDir:root,loader:"js"},
  outfile:resolve(engineVendor,"earcut.mjs"),
  bundle:true,format:"esm",platform:"browser",target:["es2022"],minify:true,legalComments:"eof"
});

await build({
  stdin:{contents:'export { fromArrayBuffer } from "geotiff"; import proj4 from "proj4"; export { proj4 };',resolveDir:root,sourcefile:"geotiff-proj4-entry.mjs",loader:"js"},
  outfile:resolve(sharedVendor,"geotiff-proj4.mjs"),
  bundle:true,format:"esm",platform:"browser",target:["es2022"],minify:true,legalComments:"eof"
});

await build({
  stdin:{contents:'import "@google/model-viewer";',resolveDir:root,sourcefile:"model-viewer-entry.mjs",loader:"js"},
  outfile:resolve(webVendor,"model-viewer.min.js"),
  bundle:true,format:"esm",platform:"browser",target:["es2022"],minify:true,legalComments:"eof"
});

console.log("VYNDI 3rd Diamension shared + web vendor bundles generated.");
