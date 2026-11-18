// Finds a solution to the Stoneyard boulder puzzle (level 10) and prints it
// as a string of N, E, S, W steps from the up stairs, ready to paste into
// src/dungeon/special.ts. Run it again whenever the template changes.
//
//   node scripts/solve-boulders.ts

import { resolveMods } from "../src/core/modifiers.ts";
import { playBoulderSolution } from "../src/dungeon/boulders.ts";
import { solveLevel } from "../src/dungeon/solve.ts";
import { buildSpecial } from "../src/dungeon/special.ts";
import { DX, T } from "../src/game/types.ts";
import type { Level } from "../src/game/types.ts";

const run = { seed: "solver", mods: resolveMods("solver", {}) };
const level: Level = buildSpecial(run, 10, { flipX: false, flipY: false, solution: "" });
const W = level.w;
const size = level.w * level.h;
const LETTER = ["N", "E", "S", "W"];

const baseOpen = new Uint8Array(size); // walkable when no boulder is there
const pitCells: number[] = [];
for (let i = 0; i < size; i++) {
  const t = level.tiles[i];
  if (t === T.PIT) pitCells.push(i);
  if (t === T.FLOOR || t === T.STAIRS_UP || t === T.STAIRS_DOWN || t === T.DOOR) baseOpen[i] = 1;
}
const boulderOk = new Uint8Array(size); // cells a boulder may rest on
for (let i = 0; i < size; i++) if (level.tiles[i] === T.FLOOR) boulderOk[i] = 1;
const startBoulders = level.features.filter((f) => f.kind === "boulder").map((f) => f.y * W + f.x).sort((a, b) => a - b);
const startPlayer = level.up.y * W + level.up.x;
const step = [-W, 1, W, -1];

interface Node {
  player: number;
  boulders: number[];
  filled: number;
  pushes: number;
  parent: Node | null;
  /** Moves from the parent state to this one, ending with the push. */
  moves: string;
}

function isOpen(cell: number, boulders: number[], filled: number): boolean {
  if (baseOpen[cell]) return !boulders.includes(cell);
  const p = pitCells.indexOf(cell);
  return p >= 0 && (filled & (1 << p)) !== 0;
}

/** Shortest walks from the player to every reachable cell, as move strings. */
function walks(node: Node): Map<number, string> {
  const out = new Map<number, string>([[node.player, ""]]);
  const queue = [node.player];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const path = out.get(cur) as string;
    for (let d = 0; d < 4; d++) {
      const x = (cur % W) + (DX[d] as number);
      if (x < 0 || x >= W) continue;
      const next = cur + (step[d] as number);
      if (next < 0 || next >= size || out.has(next) || !isOpen(next, node.boulders, node.filled)) continue;
      out.set(next, path + LETTER[d]);
      queue.push(next);
    }
  }
  return out;
}

function keyOf(n: Node, region: number): string {
  return `${n.boulders.join(",")}|${n.filled}|${region}`;
}

function heuristic(n: Node): number {
  const open = pitCells.filter((_, i) => (n.filled & (1 << i)) === 0);
  if (open.length === 0) return 0;
  const dists = n.boulders
    .map((b) => Math.min(...open.map((p) => Math.abs((b % W) - (p % W)) + Math.abs(Math.floor(b / W) - Math.floor(p / W)))))
    .sort((a, b) => a - b);
  let h = 0;
  for (let i = 0; i < open.length; i++) h += dists[i] ?? 50;
  return h;
}

const allFilled = (1 << pitCells.length) - 1;
const start: Node = { player: startPlayer, boulders: startBoulders, filled: 0, pushes: 0, parent: null, moves: "" };
const buckets: Node[][] = [];
const pushNode = (n: Node): void => {
  const f = n.pushes + 2 * heuristic(n);
  (buckets[f] ??= []).push(n);
};
pushNode(start);
const seen = new Set<string>();
let found: Node | null = null;
let expanded = 0;

search: for (let f = 0; f < buckets.length; f++) {
  const bucket = buckets[f];
  if (!bucket) continue;
  while (bucket.length > 0) {
    const node = bucket.pop() as Node;
    const reach = walks(node);
    let region = size;
    for (const c of reach.keys()) if (c < region) region = c;
    const k = keyOf(node, region);
    if (seen.has(k)) continue;
    seen.add(k);
    expanded++;
    if (node.filled === allFilled) {
      found = node;
      break search;
    }
    if (expanded > 3_000_000) break search;
    for (const b of node.boulders) {
      for (let d = 0; d < 4; d++) {
        const from = b - (step[d] as number);
        const to = b + (step[d] as number);
        const walk = reach.get(from);
        if (walk === undefined) continue;
        if ((b % W) + (DX[d] as number) < 0 || (b % W) + (DX[d] as number) >= W || to < 0 || to >= size) continue;
        const pit = pitCells.indexOf(to);
        const pitOpen = pit >= 0 && (node.filled & (1 << pit)) === 0;
        if (!pitOpen && (!boulderOk[to] || node.boulders.includes(to))) {
          // A filled pit is plain floor for boulders too.
          if (!(pit >= 0 && !node.boulders.includes(to))) continue;
        }
        const boulders = node.boulders.filter((x) => x !== b);
        let filled = node.filled;
        if (pitOpen) filled |= 1 << pit;
        else boulders.push(to);
        boulders.sort((p, q) => p - q);
        pushNode({ player: b, boulders, filled, pushes: node.pushes + 1, parent: node, moves: walk + LETTER[d] });
      }
    }
    if (f > 0 && buckets.slice(0, f).some((x) => x && x.length > 0)) {
      f = -1;
      continue search;
    }
  }
}

if (!found) {
  console.error(`error: no solution found after ${expanded} states. The template is not solvable as drawn.`);
  process.exit(1);
}

// Walk on to the stairs down so the string is a full route across the level.
const chain: Node[] = [];
for (let n: Node | null = found; n; n = n.parent) chain.unshift(n);
let solution = chain.map((n) => n.moves).join("");
const tail = walks(found).get((level.down as { x: number; y: number }).y * W + (level.down as { x: number; y: number }).x);
if (tail === undefined) {
  console.error("error: pits filled but the stairs down are still out of reach");
  process.exit(1);
}
solution += tail;

const check = buildSpecial(run, 10, { flipX: false, flipY: false, solution });
const played = playBoulderSolution(check);
const solved = solveLevel(check);
console.log(`solved in ${found.pushes} pushes, ${solution.length} steps, ${expanded} states searched`);
console.log(`replay through the game's own boulder rules: ${played ? "ok" : "FAILED"}; level solvable: ${solved.ok ? "yes" : "NO"}`);
console.log(solution);
process.exit(played && solved.ok ? 0 : 1);
