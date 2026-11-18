// The automap, drawn in code as ASCII: what has been seen, in the
// roguelike alphabet. The minimap is a small crop of the same drawing.

import { monsterInSight } from "../game/combat.ts";
import { CLASS_SYMBOL, KEY_TINT, itemType } from "../game/data/items.ts";
import { monsterType } from "../game/data/monsters.ts";
import { has, wearing } from "../game/state.ts";
import { T } from "../game/types.ts";
import type { GameState, Level } from "../game/types.ts";

interface Glyph {
  ch: string;
  color: string;
}

export const MAP_LEGEND: readonly [string, string, string][] = [
  ["@", "#ffffff", "you"],
  ["<", "#e0e0e0", "stairs up"],
  [">", "#e0e0e0", "stairs down"],
  ["+", "#c8a070", "door (in its key colour when locked)"],
  ["'", "#8a7050", "open door"],
  ["=", "#a0a8b0", "gate"],
  ["|", "#e0c040", "switch or lever"],
  [",", "#c9a23a", "pressure plate"],
  ["^", "#e05040", "trap"],
  ["{", "#60a0f0", "fountain"],
  ["_", "#d0d0d0", "altar"],
  ["&", "#a0a090", "statue"],
  ["0", "#b0a080", "boulder"],
  ["~", "#4070c0", "water"],
  ["$", "#f0d040", "gold"],
  [") [ ! ?", "#c0c0c0", "items, by class"],
  ["a-Z", "#f06050", "monsters in view"],
  ["@", "#60e0e0", "peaceful"],
];

function baseGlyph(level: Level, x: number, y: number): Glyph | null {
  const i = y * level.w + x;
  if (!level.seen[i]) return null;
  const t = level.tiles[i];
  if (t === T.WALL) {
    const sw = level.switches.find((s) => s.x === x && s.y === y);
    if (sw) return { ch: "|", color: sw.kind === "reset" ? "#f09030" : sw.on ? "#808040" : "#e0c040" };
    return { ch: "#", color: "#5c5348" };
  }
  if (t === T.STAIRS_UP) return { ch: "<", color: "#ffffff" };
  if (t === T.STAIRS_DOWN) return { ch: ">", color: "#ffffff" };
  if (t === T.WATER) return { ch: "~", color: "#4070c0" };
  if (t === T.PIT) return { ch: "o", color: "#a04030" };
  if (t === T.DOOR) {
    const d = level.doors.find((o) => o.x === x && o.y === y);
    if (d) {
      if (d.open) return { ch: "'", color: "#8a7050" };
      return { ch: "+", color: d.locked && d.color ? KEY_TINT[d.color] : "#c8a070" };
    }
  }
  if (t === T.GATE) {
    const g = level.gates.find((o) => o.cells.some((c) => c.x === x && c.y === y));
    if (g) {
      if (g.kind === "drawbridge") return g.open ? { ch: "=", color: "#8a6a3a" } : { ch: "~", color: "#4070c0" };
      return g.open ? { ch: ".", color: "#6a6a70" } : { ch: "=", color: "#c0c8d0" };
    }
  }
  const f = level.features.find((o) => o.x === x && o.y === y);
  if (f) {
    if (f.kind === "fountain") return { ch: "{", color: "#60a0f0" };
    if (f.kind === "altar") return { ch: "_", color: "#e0e0e0" };
    if (f.kind === "statue") return { ch: "&", color: "#a0a090" };
    return { ch: "0", color: "#b0a080" };
  }
  const trap = level.traps.find((o) => o.x === x && o.y === y && o.found);
  if (trap) return { ch: "^", color: "#e05040" };
  const plate = level.plates.find((o) => o.x === x && o.y === y);
  if (plate) return { ch: ",", color: plate.pressed ? "#6a5a30" : "#c9a23a" };
  let top: Glyph | null = null;
  for (const fi of level.items) {
    if (fi.x !== x || fi.y !== y) continue;
    const type = itemType(fi.item.type);
    top = type.cls === "gold" ? { ch: "$", color: "#f0d040" } : { ch: CLASS_SYMBOL[type.cls], color: type.keyColor ? KEY_TINT[type.keyColor] : "#c0c0c0" };
  }
  return top ?? { ch: ".", color: "#4a443c" };
}

export interface MapView {
  /** Pixel size of one cell. */
  cell: number;
  /** Cells shown across and down. */
  cols: number;
  rows: number;
  /** Top-left cell of the window. */
  left: number;
  top: number;
  font: string;
}

export function drawMap(g: CanvasRenderingContext2D, state: GameState, view: MapView): void {
  const level = state.levels[state.depth];
  const w = view.cols * view.cell;
  const h = view.rows * view.cell;
  g.fillStyle = "#0a0908";
  g.fillRect(0, 0, w, h);
  if (!level) return;
  g.font = `${Math.round(view.cell * 1.25)}px ${view.font}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const put = (x: number, y: number, glyph: Glyph): void => {
    const cx = (x - view.left) * view.cell + view.cell / 2;
    const cy = (y - view.top) * view.cell + view.cell / 2;
    g.fillStyle = glyph.color;
    g.fillText(glyph.ch, cx, cy + 1);
  };
  for (let y = Math.max(0, view.top); y < Math.min(level.h, view.top + view.rows); y++) {
    for (let x = Math.max(0, view.left); x < Math.min(level.w, view.left + view.cols); x++) {
      const glyph = baseGlyph(level, x, y);
      if (glyph) put(x, y, glyph);
    }
  }
  const p = state.player;
  const sensing = p.detectUntil > state.time || wearing(p, "amulet_awareness");
  const inWindow = (x: number, y: number): boolean => x >= view.left && y >= view.top && x < view.left + view.cols && y < view.top + view.rows;
  for (const m of level.monsters) {
    if (m.hp <= 0 || !inWindow(m.x, m.y)) continue;
    if (!sensing && !monsterInSight(state, m, 6)) continue;
    const type = monsterType(m.type);
    const cx = (m.x - view.left) * view.cell;
    const cy = (m.y - view.top) * view.cell;
    g.fillStyle = "#0a0908";
    g.fillRect(cx, cy, view.cell, view.cell);
    put(m.x, m.y, m.peaceful ? { ch: "@", color: "#60e0e0" } : { ch: type.glyph, color: "#f06050" });
  }
  if (inWindow(p.x, p.y)) {
    const cx = (p.x - view.left) * view.cell;
    const cy = (p.y - view.top) * view.cell;
    g.fillStyle = "#0a0908";
    g.fillRect(cx, cy, view.cell, view.cell);
    put(p.x, p.y, { ch: "@", color: has(state, "invisible") ? "#9090c0" : "#ffffff" });
    // A tick on the side the player faces.
    const tick = Math.max(2, Math.round(view.cell / 4));
    g.fillStyle = "#e0b040";
    if (p.dir === 0) g.fillRect(cx + view.cell / 2 - tick / 2, cy, tick, 2);
    if (p.dir === 2) g.fillRect(cx + view.cell / 2 - tick / 2, cy + view.cell - 2, tick, 2);
    if (p.dir === 3) g.fillRect(cx, cy + view.cell / 2 - tick / 2, 2, tick);
    if (p.dir === 1) g.fillRect(cx + view.cell - 2, cy + view.cell / 2 - tick / 2, 2, tick);
  }
}

/** A window of the given size centred on the player. */
export function centredView(state: GameState, cell: number, cols: number, rows: number, font: string): MapView {
  const p = state.player;
  return { cell, cols, rows, left: p.x - Math.floor(cols / 2), top: p.y - Math.floor(rows / 2), font };
}

/** A window that shows the whole level if it fits, otherwise follows the player. */
export function fullView(state: GameState, widthPx: number, heightPx: number, font: string): MapView {
  const level = state.levels[state.depth];
  const lw = level ? level.w : 20;
  const lh = level ? level.h : 20;
  const cell = Math.max(8, Math.min(16, Math.floor(Math.min(widthPx / lw, heightPx / lh))));
  const cols = Math.floor(widthPx / cell);
  const rows = Math.floor(heightPx / cell);
  if (lw <= cols && lh <= rows) return { cell, cols, rows, left: -Math.floor((cols - lw) / 2), top: -Math.floor((rows - lh) / 2), font };
  const p = state.player;
  const left = Math.max(-1, Math.min(lw - cols + 1, p.x - Math.floor(cols / 2)));
  const top = Math.max(-1, Math.min(lh - rows + 1, p.y - Math.floor(rows / 2)));
  return { cell, cols, rows, left, top, font };
}
