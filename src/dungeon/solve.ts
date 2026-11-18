// Solvability by simulation: flood from the up stairs, collecting keys,
// flipping switches, stepping on plates, and opening what they open,
// until nothing changes. A level is solvable if the way down (or, on
// the last level, the boss) is reached.

import { itemType } from "../game/data/items.ts";
import { monsterType } from "../game/data/monsters.ts";
import { DX, DY, T } from "../game/types.ts";
import type { Level } from "../game/types.ts";
import { playBoulderSolution } from "./boulders.ts";
import { featureAt, inBounds } from "./grid.ts";

export interface SolveOptions {
  /** Pretend this door can never be opened (to test that a lock matters). */
  sealDoor?: number;
  /** Pretend this gate can never be opened. */
  sealGate?: number;
  /** Bone keys carried in from the level above. */
  boneKeys?: number;
}

export interface SolveResult {
  ok: boolean;
  reason: string;
  /** 1 for every cell the player can reach in the end. */
  reached: Uint8Array;
  doorsOpened: number;
  gatesOpened: number;
}

export function solveLevel(input: Level, options: SolveOptions = {}): SolveResult {
  let level = input;
  if (level.special === "stoneyard") {
    const after = playBoulderSolution(level);
    if (!after) return { ok: false, reason: "the stored boulder solution does not play", reached: new Uint8Array(level.w * level.h), doorsOpened: 0, gatesOpened: 0 };
    level = { ...after, monsters: input.monsters };
  }
  const size = level.w * level.h;
  const doorByCell = new Map<number, number>();
  level.doors.forEach((d, i) => doorByCell.set(d.y * level.w + d.x, i));
  const gateByCell = new Map<number, number>();
  level.gates.forEach((g, i) => g.cells.forEach((c) => gateByCell.set(c.y * level.w + c.x, i)));

  // Peaceful characters stand where they are and cannot be walked through.
  const standing = new Set<number>();
  for (const m of level.monsters) if (m.peaceful) standing.add(m.y * level.w + m.x);
  const doorOpen = level.doors.map((d) => d.open || !d.locked);
  const gateOpen = level.gates.map((g) => g.open);
  const keys: Record<string, number> = { bone: options.boneKeys ?? 0 };
  const taken = new Set<number>();
  let doorsOpened = 0;
  let gatesOpened = 0;

  const passable = (x: number, y: number): boolean => {
    if (!inBounds(level, x, y)) return false;
    const i = y * level.w + x;
    const t = level.tiles[i] as number;
    if (t === T.WALL || t === T.WATER || t === T.PIT) return false;
    if (t === T.DOOR) {
      const di = doorByCell.get(i);
      if (di !== undefined && !doorOpen[di]) return false;
    }
    if (t === T.GATE) {
      const gi = gateByCell.get(i);
      if (gi !== undefined && !gateOpen[gi]) return false;
    }
    return !standing.has(i) && featureAt(level, x, y) === undefined;
  };

  let reached = new Uint8Array(size);
  const flood = (): void => {
    reached = new Uint8Array(size);
    const start = level.up.y * level.w + level.up.x;
    const queue = [start];
    reached[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head] as number;
      const cx = cur % level.w;
      const cy = (cur - cx) / level.w;
      for (let k = 0; k < 4; k++) {
        const nx = cx + (DX[k] as number);
        const ny = cy + (DY[k] as number);
        if (!passable(nx, ny)) continue;
        const ni = ny * level.w + nx;
        if (reached[ni]) continue;
        reached[ni] = 1;
        queue.push(ni);
      }
    }
  };

  const nextTo = (x: number, y: number): boolean => {
    for (let k = 0; k < 4; k++) {
      const nx = x + (DX[k] as number);
      const ny = y + (DY[k] as number);
      if (inBounds(level, nx, ny) && reached[ny * level.w + nx]) return true;
    }
    return false;
  };

  const openGate = (gi: number): boolean => {
    if (gi < 0 || gi >= gateOpen.length || gateOpen[gi] || gi === options.sealGate) return false;
    gateOpen[gi] = true;
    gatesOpened++;
    return true;
  };

  for (let round = 0; round < 200; round++) {
    flood();
    let changed = false;
    for (const fi of level.items) {
      if (taken.has(fi.item.uid) || !reached[fi.y * level.w + fi.x]) continue;
      const color = itemType(fi.item.type).keyColor;
      if (!color) continue;
      taken.add(fi.item.uid);
      keys[color] = (keys[color] ?? 0) + fi.item.qty;
      changed = true;
    }
    for (const s of level.switches) {
      if (s.kind !== "switch" || !nextTo(s.x, s.y)) continue;
      const gi = level.gates.findIndex((g) => g.id === s.gate);
      if (openGate(gi)) changed = true;
    }
    for (const p of level.plates) {
      if (!reached[p.y * level.w + p.x]) continue;
      const gi = level.gates.findIndex((g) => g.id === p.gate);
      if (openGate(gi)) changed = true;
    }
    const bossReached = level.monsters.some((m) => monsterType(m.type).boss && (reached[m.y * level.w + m.x] === 1 || nextTo(m.x, m.y)));
    if (bossReached) {
      level.gates.forEach((g, gi) => {
        if (g.opener === "boss" && openGate(gi)) changed = true;
      });
    }
    if (!changed) {
      // Open at most one locked door per round, so key counts are honored.
      for (let di = 0; di < level.doors.length; di++) {
        const d = level.doors[di]!;
        if (doorOpen[di] || di === options.sealDoor || !d.color) continue;
        if ((keys[d.color] ?? 0) > 0 && nextTo(d.x, d.y)) {
          keys[d.color] = (keys[d.color] ?? 0) - 1;
          doorOpen[di] = true;
          doorsOpened++;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }

  let ok: boolean;
  let reason = "";
  if (level.down) {
    ok = reached[level.down.y * level.w + level.down.x] === 1;
    if (!ok) reason = "the stairs down cannot be reached";
  } else {
    ok = level.monsters.some((m) => monsterType(m.type).boss && (reached[m.y * level.w + m.x] === 1 || nextTo(m.x, m.y)));
    if (!ok) reason = "the boss cannot be reached";
  }
  return { ok, reason, reached, doorsOpened, gatesOpened };
}

/** True when the level cannot be finished with this door left shut: the lock is a real obstacle. */
export function doorIsCut(level: Level, doorIndex: number): boolean {
  return !solveLevel(level, { sealDoor: doorIndex }).ok;
}

export function gateIsCut(level: Level, gateIndex: number): boolean {
  return !solveLevel(level, { sealGate: gateIndex }).ok;
}

/** Cells reachable from the up stairs before any lock is opened. */
export function startArea(level: Level): number[] {
  const sealed: Level = {
    ...level,
    items: [],
    switches: [],
    plates: [],
    monsters: [],
    special: level.special === "stoneyard" ? null : level.special,
  };
  const r = solveLevel(sealed).reached;
  const out: number[] = [];
  for (let i = 0; i < r.length; i++) if (r[i]) out.push(i);
  return out;
}
