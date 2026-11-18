// Generates thousands of levels and verifies each with the solvability
// simulation: 30 seeds at their own modifiers, then 3 seeds with every
// modifier in turn at its minimum and at its maximum, all 25 levels each.
//
//   node scripts/sweep.ts            (what "make sweep" runs)
//   node scripts/sweep.ts --seeds 60 --prefix other

import { MODIFIERS, MOD_MAX, MOD_MIN, resolveMods } from "../src/core/modifiers.ts";
import { generateLevel } from "../src/dungeon/generate.ts";
import { solveLevel } from "../src/dungeon/solve.ts";
import { parseArgs } from "./lib/args.ts";

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/sweep.ts [--seeds 30] [--prefix sweep]");
  process.exit(0);
}
const seedCount = Number(args.flags["seeds"] ?? 30);
const prefix = args.flags["prefix"] ?? "sweep";

let levels = 0;
let unsolvable = 0;
let fallbacks = 0;
const started = Date.now();

function runSeed(seed: string, overrides: Record<string, number>, label: string): void {
  const run = { seed, mods: resolveMods(seed, overrides) };
  for (let depth = 1; depth <= 25; depth++) {
    const level = generateLevel(run, depth);
    const result = solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 });
    levels++;
    if (level.meta.attempts > 30) fallbacks++;
    if (!result.ok) {
      unsolvable++;
      console.log(`UNSOLVABLE: seed "${seed}" ${label} level ${depth}: ${result.reason}`);
    }
  }
}

for (let i = 0; i < seedCount; i++) runSeed(`${prefix}-${i}`, {}, "(seed defaults)");
const defaultLevels = levels;
for (const def of MODIFIERS) {
  for (const value of [MOD_MIN, MOD_MAX]) {
    for (let i = 0; i < 3; i++) runSeed(`${prefix}-mod-${i}`, { [def.id]: value }, `(${def.id}=${value})`);
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`sweep: ${seedCount} seeds at their own modifiers (${defaultLevels} levels), ${MODIFIERS.length} modifiers at minimum and maximum on 3 seeds (${levels - defaultLevels} levels)`);
console.log(`sweep: ${levels} levels generated in ${seconds} s, ${fallbacks} fell back to a lock-free layout`);
console.log(`unsolvable: ${unsolvable}`);
process.exit(unsolvable === 0 ? 0 : 1);
