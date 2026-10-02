import { rm, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root=resolve(fileURLToPath(new URL("..",import.meta.url)));
const dist=resolve(root,"dist");
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(resolve(root,"apps","web"),resolve(dist,"apps","web"),{recursive:true});
await cp(resolve(root,"apps","trailrelief-exact"),resolve(dist,"apps","trailrelief-exact"),{recursive:true});
await cp(resolve(root,"apps","ride-stories-exact"),resolve(dist,"apps","ride-stories-exact"),{recursive:true});
await cp(resolve(root,"packages"),resolve(dist,"packages"),{recursive:true});
console.log("VYNDI 3rd Diamension distribution built.");
