import { rm, mkdir, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const merch = resolve(root, "apps", "merch-site");
if (existsSync(merch)) {
  await cp(merch, dist, { recursive: true });
  console.log("merch-site → dist/ (landing)");
} else {
  console.warn("apps/merch-site missing — run scripts/sync-ride-stories-merch.sh");
}

await cp(resolve(root, "apps", "web"), resolve(dist, "apps", "web"), { recursive: true });
await cp(resolve(root, "packages"), resolve(dist, "packages"), { recursive: true });
console.log("VYNDI 3rd Diamension distribution built (Ride Stories merch landing + workbench).");
