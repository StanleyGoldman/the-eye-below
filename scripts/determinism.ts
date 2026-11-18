// Checks that a run is fully determined by its seed and modifiers: two
// separate Node processes generate all 25 levels and must produce the
// same hash for each; a different seed must not.
//
//   node scripts/determinism.ts
//   node scripts/determinism.ts --seed candle --mods traps=9

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { generateLevel } from "../src/dungeon/generate.ts";
import { fail, parseArgs, runFromArgs } from "./lib/args.ts";

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/determinism.ts [--seed text] [--mods id=1-9,...]");
  process.exit(0);
}

function hashes(seed: string, mods: Record<string, number>): string[] {
  const out: string[] = [];
  for (let depth = 1; depth <= 25; depth++) {
    const level = generateLevel({ seed, mods }, depth);
    out.push(createHash("sha256").update(JSON.stringify(level)).digest("hex").slice(0, 16));
  }
  return out;
}

if (args.flags["child"]) {
  const run = runFromArgs(args);
  console.log(JSON.stringify(hashes(run.seed, run.mods)));
  process.exit(0);
}

let run;
try {
  run = runFromArgs(args);
} catch (e) {
  fail((e as Error).message);
}
const self = fileURLToPath(import.meta.url);
const child = (seed: string): string[] => {
  const argv = [self, "--child", "--seed", seed];
  if (args.flags["mods"]) argv.push("--mods", args.flags["mods"]);
  return JSON.parse(execFileSync(process.execPath, argv, { encoding: "utf8" })) as string[];
};

const a = child(run.seed);
const b = child(run.seed);
const other = child(`${run.seed}-other`);
let same = 0;
for (let i = 0; i < 25; i++) if (a[i] === b[i]) same++;
let differ = 0;
for (let i = 0; i < 25; i++) if (a[i] !== other[i]) differ++;
console.log(`determinism: seed "${run.seed}", two processes: ${same} of 25 levels identical`);
console.log(`determinism: seed "${run.seed}-other": ${differ} of 25 levels differ from the first seed`);
console.log(`determinism: first level hash ${a[0]}, last level hash ${a[24]}`);
// Special levels share a template, so a different seed need only change most levels, not all.
const ok = same === 25 && differ >= 20;
console.log(ok ? "determinism: ok" : "determinism: FAILED");
process.exit(ok ? 0 : 1);
