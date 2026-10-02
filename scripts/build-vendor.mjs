import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const webVendor=resolve(root,"apps/web/vendor");
const engineVendor=resolve(root,"packages/engine/vendor");
const sharedVendor=resolve(root,"packages/vendor");
const trailVendor=resolve(root,"apps/web/engines/trailrelief/vendor");
const sourceVyndiVendor=resolve(root,"apps/web/engines/vyndi-medal/vendor");
await Promise.all([mkdir(webVendor,{recursive:true}),mkdir(engineVendor,{recursive:true}),mkdir(sharedVendor,{recursive:true}),mkdir(trailVendor,{recursive:true}),mkdir(sourceVyndiVendor,{recursive:true})]);

for(const outfile of [resolve(engineVendor,"earcut.mjs"),resolve(trailVendor,"earcut.mjs"),resolve(sourceVyndiVendor,"earcut.mjs")]){
  await build({
    stdin:{contents:'export { default } from "three/src/extras/lib/earcut.js";',resolveDir:root,loader:"js"},
    outfile,bundle:true,format:"esm",platform:"browser",target:["es2022"],minify:true,legalComments:"eof"
  });
}

for(const outfile of [resolve(sharedVendor,"geotiff-proj4.mjs"),resolve(trailVendor,"geotiff-proj4.mjs"),resolve(sourceVyndiVendor,"geotiff-proj4.mjs")]){
  await build({
    stdin:{contents:'export { fromArrayBuffer } from "geotiff"; import proj4 from "proj4"; export { proj4 };',resolveDir:root,sourcefile:"geotiff-proj4-entry.mjs",loader:"js"},
    outfile,bundle:true,format:"esm",platform:"browser",target:["es2022"],minify:true,legalComments:"eof"
  });
}

for(const outfile of [resolve(webVendor,"model-viewer.min.js"),resolve(trailVendor,"model-viewer.min.js")]){
  await build({
    stdin:{contents:'import "@google/model-viewer";',resolveDir:root,sourcefile:"model-viewer-entry.mjs",loader:"js"},
    outfile,bundle:true,format:"esm",platform:"browser",target:["es2022"],minify:true,legalComments:"eof"
  });
}

console.log("VYNDI 3rd Diamension shared + web vendor bundles generated.");
