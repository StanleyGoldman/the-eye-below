// Prints a generated level as ASCII, with keys, doors, and switches marked.
//
//   node scripts/dump-level.ts --seed candle --level 3
//   node scripts/dump-level.ts --seed candle --level 7 --mods puzzles=9,mapSize=2
//   node scripts/dump-level.ts --seed candle --all        (one summary line per level)
//   add --monsters to draw monsters over the map (their letters can hide other marks)

import { levelSummary, levelToAscii } from "../src/dungeon/ascii.ts";
import { generateLevel } from "../src/dungeon/generate.ts";
import { solveLevel } from "../src/dungeon/solve.ts";
import { fail, parseArgs, runFromArgs } from "./lib/args.ts";

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/dump-level.ts [--seed text] [--level 1-25 | --all] [--mods id=1-9,...] [--monsters]");
  process.exit(0);
}

let run;
try {
  run = runFromArgs(args);
} catch (e) {
  fail((e as Error).message);
}

const levels: number[] = [];
if (args.flags["all"]) for (let d = 1; d <= 25; d++) levels.push(d);
else levels.push(Number(args.flags["level"] ?? 1));

let bad = 0;
for (const depth of levels) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 25) fail("--level must be a whole number from 1 to 25");
  const level = generateLevel({ seed: run.seed, mods: run.mods }, depth);
  const solved = solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 });
  if (!solved.ok) bad++;
  if (!args.flags["all"]) {
    console.log(levelToAscii(level, args.flags["monsters"] === "true"));
    console.log("# wall  . floor  ~ water  < > stairs  + door  RGBYN locked door  rgbyn key  = gate  / switch  _ plate  ^ trap  { fountain  A altar  S statue  0 boulder  o pit  $ gold  * item");
  }
  console.log(`${levelSummary(level)}, ${solved.ok ? "solvable" : `UNSOLVABLE: ${solved.reason}`}`);
}
console.log(`dumped ${levels.length} level(s) for seed "${run.seed}"${bad ? `, ${bad} unsolvable` : ""}`);
process.exit(bad ? 1 : 0);
