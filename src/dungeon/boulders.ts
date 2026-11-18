// Boulder pushing. One set of rules, used by the game, by the solvability
// check, and by the puzzle solver script.

import { DX, DY, T } from "../game/types.ts";
import type { Dir, Level, Pos } from "../game/types.ts";
import { doorAt, featureAt, gateAt, inBounds, tileAt } from "./grid.ts";

/** Can a boulder be pushed into this cell? */
export function boulderCanEnter(level: Level, x: number, y: number): boolean {
  if (!inBounds(level, x, y)) return false;
  const t = tileAt(level, x, y);
  if (t !== T.FLOOR && t !== T.PIT) return false;
  if (featureAt(level, x, y)) return false;
  for (const m of level.monsters) if (m.x === x && m.y === y) return false;
  return true;
}

/**
 * Push the boulder standing at (bx, by) one cell in the given direction.
 * Returns "moved", "filled" (it dropped into a pit and both are gone),
 * or "stuck". Mutates the level.
 */
export function pushBoulder(level: Level, bx: number, by: number, dir: Dir): "moved" | "filled" | "stuck" {
  const f = featureAt(level, bx, by);
  if (!f || f.kind !== "boulder") return "stuck";
  const nx = bx + (DX[dir] as number);
  const ny = by + (DY[dir] as number);
  if (!boulderCanEnter(level, nx, ny)) return "stuck";
  if (tileAt(level, nx, ny) === T.PIT) {
    level.tiles[ny * level.w + nx] = T.FLOOR;
    level.features.splice(level.features.indexOf(f), 1);
    return "filled";
  }
  f.x = nx;
  f.y = ny;
  return "moved";
}

function walkable(level: Level, x: number, y: number): boolean {
  const t = tileAt(level, x, y);
  if (t === T.WALL || t === T.WATER || t === T.PIT) return false;
  if (t === T.DOOR) {
    const d = doorAt(level, x, y);
    if (d && d.locked) return false;
  }
  if (t === T.GATE) {
    const g = gateAt(level, x, y);
    if (g && !g.open) return false;
  }
  return true;
}

/** One step of a simulated player: walk, or push a boulder and follow it. Returns the new position, or null if the step is impossible. */
export function simStep(level: Level, at: Pos, dir: Dir): Pos | null {
  const nx = at.x + (DX[dir] as number);
  const ny = at.y + (DY[dir] as number);
  if (!walkable(level, nx, ny)) return null;
  const f = featureAt(level, nx, ny);
  if (f) {
    if (f.kind !== "boulder") return null;
    if (pushBoulder(level, nx, ny, dir) === "stuck") return null;
  }
  return { x: nx, y: ny };
}

/** A copy of just the parts of a level that boulder pushing changes. */
export function cloneForBoulders(level: Level): Level {
  return { ...level, tiles: level.tiles.slice(), features: level.features.map((f) => ({ ...f })), monsters: [] };
}

/**
 * Play the level's stored boulder solution on a copy. Returns the copy
 * (pits filled, boulders moved) or null if any step is illegal.
 */
export function playBoulderSolution(level: Level): Level | null {
  if (!level.boulderSolution) return null;
  const copy = cloneForBoulders(level);
  let at: Pos = { x: level.up.x, y: level.up.y };
  for (const dir of level.boulderSolution) {
    const next = simStep(copy, at, dir);
    if (!next) return null;
    at = next;
  }
  return copy;
}

/** Put every boulder back where it started. Filled pits stay filled, so a reset can only help. */
export function resetBoulders(level: Level): void {
  if (!level.boulderStart) return;
  level.features = level.features.filter((f) => f.kind !== "boulder");
  for (const p of level.boulderStart) level.features.push({ kind: "boulder", x: p.x, y: p.y });
}
