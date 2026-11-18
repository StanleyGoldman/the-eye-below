// A generated level as text, for debugging the generator without the renderer.

import { itemType } from "../game/data/items.ts";
import { monsterType } from "../game/data/monsters.ts";
import { T } from "../game/types.ts";
import type { Level } from "../game/types.ts";

const KEY_CHAR: Record<string, string> = { red: "r", green: "g", blue: "b", brass: "y", bone: "n" };

/**
 * Legend: # wall, . floor, ~ water, < > stairs, + plain door,
 * R G B Y N locked door by colour (red, green, blue, brass, bone),
 * r g b y n the matching key, = gate, / wall switch, _ pressure plate,
 * ^ trap, { fountain, A altar, S statue, 0 boulder, o pit, $ gold,
 * * item, letters monsters, ! reset lever.
 */
export function levelToAscii(level: Level, showMonsters = true): string {
  const grid: string[][] = [];
  for (let y = 0; y < level.h; y++) {
    const row: string[] = [];
    for (let x = 0; x < level.w; x++) {
      const t = level.tiles[y * level.w + x];
      row.push(t === T.WALL ? "#" : t === T.WATER ? "~" : t === T.STAIRS_UP ? "<" : t === T.STAIRS_DOWN ? ">" : t === T.PIT ? "o" : ".");
    }
    grid.push(row);
  }
  const put = (x: number, y: number, ch: string): void => {
    const row = grid[y];
    if (row && x >= 0 && x < row.length) row[x] = ch;
  };
  for (const tr of level.traps) put(tr.x, tr.y, "^");
  for (const p of level.plates) put(p.x, p.y, "_");
  for (const f of level.features) put(f.x, f.y, f.kind === "fountain" ? "{" : f.kind === "altar" ? "A" : f.kind === "statue" ? "S" : "0");
  for (const fi of level.items) {
    const type = itemType(fi.item.type);
    put(fi.x, fi.y, type.keyColor ? (KEY_CHAR[type.keyColor] as string) : type.cls === "gold" ? "$" : "*");
  }
  for (const d of level.doors) put(d.x, d.y, d.color ? (KEY_CHAR[d.color] as string).toUpperCase() : "+");
  for (const g of level.gates) for (const c of g.cells) put(c.x, c.y, "=");
  for (const s of level.switches) put(s.x, s.y, s.kind === "reset" ? "!" : "/");
  if (showMonsters) for (const m of level.monsters) put(m.x, m.y, monsterType(m.type).glyph);
  return grid.map((r) => r.join("")).join("\n");
}

export function levelSummary(level: Level): string {
  const m = level.meta;
  const parts = [
    `level ${level.depth} "${level.name}"`,
    `${level.w}x${level.h}`,
    `rooms ${m.rooms}`,
    `locks on route ${m.locks}`,
    `closets ${m.closets}`,
    `doors ${level.doors.length}`,
    `gates ${level.gates.length}`,
    `switches ${level.switches.length}`,
    `plates ${level.plates.length}`,
    `monsters ${level.monsters.length}`,
    `items ${level.items.length}`,
    `traps ${level.traps.length}`,
    `attempts ${m.attempts}`,
  ];
  if (m.boneKey) parts.push("bone key here");
  if (m.boneDoor) parts.push("bone door here");
  return parts.join(", ");
}
