// Bundles the game into one classic script, dist/game.js, that
// index.html can load straight from disk.
//
//   node scripts/build.ts            (what "make build" runs)
//
// The bundle is written under a temporary name and renamed into place,
// so an interrupted build never leaves a half-written file behind.

import { build } from "esbuild";
import { mkdir, rename, rm, stat } from "node:fs/promises";

const out = "dist/game.js";
const tmp = "dist/game.js.tmp";

try {
  await mkdir("dist", { recursive: true });
  await build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "iife",
    target: "es2020",
    outfile: tmp,
    loader: { ".woff2": "dataurl", ".css": "text" },
    legalComments: "none",
    logLevel: "warning",
  });
  await rename(tmp, out);
  const size = (await stat(out)).size;
  console.log(`built ${out} (${Math.round(size / 1024)} kB)`);
} catch (err) {
  await rm(tmp, { force: true });
  console.error(`error: build failed: ${(err as Error).message}`);
  process.exit(1);
}
