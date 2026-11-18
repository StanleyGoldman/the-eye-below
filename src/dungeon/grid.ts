// Small helpers shared by the generator, the solver, and the game.

import { DX, DY, T } from "../game/types.ts";
import type { Door, Feature, Gate, Level, Pos } from "../game/types.ts";

export function idx(level: { w: number }, x: number, y: number): number {
  return y * level.w + x;
}

export function inBounds(level: { w: number; h: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < level.w && y < level.h;
}

export function tileAt(level: Level, x: number, y: number): number {
  if (!inBounds(level, x, y)) return T.WALL;
  return level.tiles[y * level.w + x] as number;
}

export function emptyLevel(depth: number, w: number, h: number, name: string): Level {
  return {
    depth,
    w,
    h,
    name,
    special: null,
    tiles: new Array<number>(w * h).fill(T.WALL),
    doors: [],
    gates: [],
    switches: [],
    plates: [],
    features: [],
    traps: [],
    torches: [],
    items: [],
    monsters: [],
    up: { x: 1, y: 1 },
    down: null,
    startArea: [],
    seen: new Array<number>(w * h).fill(0),
    meta: { rooms: 0, locks: 0, closets: 0, attempts: 1, boneKey: false, boneDoor: false },
  };
}

export function doorAt(level: Level, x: number, y: number): Door | undefined {
  for (const d of level.doors) if (d.x === x && d.y === y) return d;
  return undefined;
}

export function gateAt(level: Level, x: number, y: number): Gate | undefined {
  for (const g of level.gates) for (const c of g.cells) if (c.x === x && c.y === y) return g;
  return undefined;
}

export function featureAt(level: Level, x: number, y: number): Feature | undefined {
  for (const f of level.features) if (f.x === x && f.y === y) return f;
  return undefined;
}

/**
 * Can something on foot stand in this cell, given the current state of
 * doors and gates? Closed doors, shut gates, water, pits, and features
 * all block. Monsters and the player are not considered here.
 */
export function isOpenCell(level: Level, x: number, y: number): boolean {
  const t = tileAt(level, x, y);
  if (t === T.WALL || t === T.WATER || t === T.PIT) return false;
  if (t === T.DOOR) {
    const d = doorAt(level, x, y);
    if (d && !d.open) return false;
  }
  if (t === T.GATE) {
    const g = gateAt(level, x, y);
    if (g && !g.open) return false;
  }
  return featureAt(level, x, y) === undefined;
}

/** Does this cell stop sight? */
export function blocksSight(level: Level, x: number, y: number): boolean {
  const t = tileAt(level, x, y);
  if (t === T.WALL) return true;
  if (t === T.DOOR) {
    const d = doorAt(level, x, y);
    return !!d && !d.open;
  }
  const f = featureAt(level, x, y);
  return !!f && f.kind === "boulder";
}

/** Straight-line sight between two cells (Bresenham); the end cells themselves never block. */
export function lineOfSight(level: Level, x0: number, y0: number, x1: number, y1: number): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let guard = 0; guard < 200; guard++) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && blocksSight(level, x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return false;
}

/** Breadth-first distances from a cell over cells that pass the test. -1 where unreachable. */
export function floodDistances(level: Level, from: Pos, passable: (x: number, y: number) => boolean, limit = Infinity): Int32Array {
  const dist = new Int32Array(level.w * level.h).fill(-1);
  const queue: number[] = [from.y * level.w + from.x];
  dist[queue[0] as number] = 0;
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head] as number;
    const d = dist[cur] as number;
    if (d >= limit) continue;
    const cx = cur % level.w;
    const cy = (cur - cx) / level.w;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (DX[k] as number);
      const ny = cy + (DY[k] as number);
      if (!inBounds(level, nx, ny)) continue;
      const ni = ny * level.w + nx;
      if (dist[ni] !== -1 || !passable(nx, ny)) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  return dist;
}
