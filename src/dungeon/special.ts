// The five hand-authored special levels. Each is an ASCII template,
// mirrored and populated by the seed.
//
// Legend:
//   #  wall            .  floor           ~  water
//   <  up stairs       >  down stairs     +  plain door
//   {  fountain        _  altar           S  statue
//   0  boulder         ^  pit             L  boulder reset lever (wall)
//   a b  gate cells    A B  wall switch opening the gate of the same letter
//   w  drawbridge      W  its winch (wall)
//   x  gate that opens when the boss dies
//   r  red locked door k  red key
//   O  the oracle      M  the level's boss
//   g  keep soldier    m  random monster of the tier (may be left out)
//   *  random item (may be left out)      $  gold
//   !  the level's prize                  p  a potion of blindness

import { scale3 } from "../core/modifiers.ts";
import { stream } from "../core/rng.ts";
import { makeItem, makeMonster, rollItem } from "../game/factory.ts";
import type { UidSource } from "../game/factory.ts";
import { monstersOfTier, tierOfDepth } from "../game/data/monsters.ts";
import { T } from "../game/types.ts";
import type { Dir, Level, RunConfig, SpecialId } from "../game/types.ts";
import { emptyLevel } from "./grid.ts";
import { startArea } from "./solve.ts";

interface Template {
  id: SpecialId;
  name: string;
  rows: string[];
  boss?: string;
  /** Solution to the boulder puzzle for the unmirrored template, from the up stairs. */
  solution?: string;
  statueText?: string[];
}

const ORACLE: Template = {
  id: "oracle",
  name: "The Oracle's Court",
  rows: [
    "#########################",
    "#...........#...........#",
    "#.<.........+.....*.....#",
    "#...........#...........#",
    "######+###########+######",
    "#...........m...........#",
    "#..S...S....S....S...S..#",
    "#.......#######+#.......#",
    "#..{....#.......#....{..#",
    "#.......#..S.S..#.......#",
    "#..S....+...O...+....S..#",
    "#.......#..S.S..#.......#",
    "#..{....#.......#....{..#",
    "#.......#+#######.......#",
    "#..S...S....S....S...S..#",
    "#...........m...........#",
    "######+###########+######",
    "#....m......#...........#",
    "#.....$.....+.........>.#",
    "#...........#...........#",
    "#########################",
  ],
  statueText: ["A centaur, mid-stride, in stone. The plinth reads: ASK, AND PAY.", "A stone centaur with a drawn bow. It is aimed at nothing in particular.", "A centaur statue. Someone has left a coin at its hooves, and someone else has taken it."],
};

const STONEYARD: Template = {
  id: "stoneyard",
  name: "The Stoneyard",
  rows: [
    "##L################",
    "#<..#.............#",
    "#...#..0...0......#",
    "#...+.........0...#",
    "#...#..0..........#",
    "#####.............#",
    "##########^########",
    "##########^########",
    "##########^########",
    "#...#......#......#",
    "#.!.+..m...+..>...#",
    "#...#......#...m..#",
    "###################",
  ],
  // Produced by scripts/solve-boulders.ts and checked by the tests.
  solution: "EESSEEEESWSEEENEEEEEENWWWWENNWSSSWSNEESWNWSNENNWSESSWSNENNWSSSSSSSEEEE",
};

const GORGON: Template = {
  id: "gorgon",
  name: "The Gorgon's Isle",
  boss: "medusa",
  rows: [
    "###############################",
    "#<....~~~~~~~~~~~~~~~~~~#######",
    "#.....~~~~~~.......~~~~~#######",
    "#..p..~~~~~...S.S...~~~~#.....#",
    "#..S..~~~~........m..~~~#.....#",
    "#.............M.........x...>.#",
    "#.....~~~~..m........~~~#.....#",
    "#..*..~~~~~...S.S...~~~~#.....#",
    "#.....~~~~~~.......~~~~~#######",
    "#.....~~~~~~~~~~~~~~~~~~#######",
    "###############################",
  ],
  statueText: ["A statue of an adventurer, sword raised, face turned toward the island. Scratched on the base: THE BLIND SEE NOTHING, AND NOTHING SEES THEM BACK.", "A statue of a soldier shielding her eyes, a moment too late.", "A very lifelike statue of a man looking surprised.", "A statue of a knight admiring his reflection in a polished shield. He, at least, had the right idea and the wrong timing."],
};

const KEEP: Template = {
  id: "keep",
  name: "The Keep",
  rows: [
    "#################################",
    "#<......#.......................#",
    "#.......+..~~~~~~~~~~~~~~~~~~~..#",
    "#.......#..~#################~..#",
    "#########..~#..g.....#...!..#~..#",
    "#.......#..~#........r......#~..#",
    "W.......+..w+...g....########~..#",
    "#.......#..~#........#.g....#~..#",
    "#########..~#..g.....+....>.#~..#",
    "#..........~#...k....#......#~..#",
    "#....m.....~#################~..#",
    "#..........~~~~~~~~~~~~~~~~~~~..#",
    "#..............m.............*..#",
    "#################################",
  ],
};

const TOWER: Template = {
  id: "tower",
  name: "The Hollow Tower",
  boss: "morvane",
  rows: [
    "#########################",
    "#<..........m...........#",
    "#.#####################.#",
    "#.#.........m.........#.#",
    "#.#.#######b#########.#.#",
    "#.#.#...............#.#.#",
    "#.#m#.......M.......#m#.#",
    "#.#.#...............#.#.#",
    "#.#.########B########.#.#",
    "#.#...................#.#",
    "#.#####a###############.#",
    "#.............*.........#",
    "#A#######################",
  ],
};

const TEMPLATES: Record<number, Template> = { 5: ORACLE, 10: STONEYARD, 15: GORGON, 20: KEEP, 25: TOWER };

export function isSpecialDepth(depth: number): boolean {
  return TEMPLATES[depth] !== undefined;
}

export function specialTemplateRows(depth: number): string[] {
  return (TEMPLATES[depth] as Template).rows.slice();
}

const DIR_OF: Record<string, Dir> = { N: 0, E: 1, S: 2, W: 3 };

export function parseSolution(text: string, flipX: boolean, flipY: boolean): Dir[] {
  const out: Dir[] = [];
  for (const ch of text) {
    let d = DIR_OF[ch];
    if (d === undefined) continue;
    if (flipX && (d === 1 || d === 3)) d = (d === 1 ? 3 : 1) as Dir;
    if (flipY && (d === 0 || d === 2)) d = (d === 0 ? 2 : 0) as Dir;
    out.push(d);
  }
  return out;
}

export interface SpecialOptions {
  /** Force the mirroring instead of taking it from the seed (tests). */
  flipX?: boolean;
  flipY?: boolean;
  /** Replace the stored boulder solution (the solver script). */
  solution?: string;
}

export function buildSpecial(run: RunConfig, depth: number, options: SpecialOptions = {}): Level {
  const tpl = TEMPLATES[depth];
  if (!tpl) throw new Error(`level ${depth} is not a special level`);
  const width = tpl.rows[0]!.length;
  for (const row of tpl.rows) if (row.length !== width) throw new Error(`special level ${tpl.id}: ragged template row "${row}"`);

  const vary = stream(run.seed, "special", depth);
  const flipX = options.flipX ?? vary.chance(0.5);
  const flipY = options.flipY ?? vary.chance(0.5);
  let rows = tpl.rows.slice();
  if (flipX) rows = rows.map((r) => r.split("").reverse().join(""));
  if (flipY) rows = rows.reverse();

  const level = emptyLevel(depth, width, rows.length, tpl.name);
  level.special = tpl.id;
  const uids: UidSource = { next: depth * 100000 + 1 };
  const rm = stream(run.seed, "monsters", depth);
  const ri = stream(run.seed, "loot", depth);
  const rg = stream(run.seed, "gold", depth);
  const at = (x: number, y: number): number => y * width + x;
  const tier = tierOfDepth(depth);
  const pool = monstersOfTier(tier);
  const monsterShare = scale3(run.mods["monsterCount"] ?? 5, 0.35, 0.75, 1);
  const lootShare = scale3(run.mods["lootAmount"] ?? 5, 0.3, 0.7, 1);
  const goldMod = scale3(run.mods["gold"] ?? 5, 0.3, 1, 3);
  const gateIds = new Map<string, number>();
  const gateFor = (ch: string, kind: "portcullis" | "drawbridge", opener: "switch" | "boss"): number => {
    let id = gateIds.get(ch);
    if (id === undefined) {
      id = level.gates.length;
      level.gates.push({ id, kind, cells: [], vertical: false, open: false, opener });
      gateIds.set(ch, id);
    }
    return id;
  };
  const isWallChar = (x: number, y: number): boolean => {
    const ch = rows[y]?.[x];
    return ch === undefined || ch === "#" || ch === "L" || ch === "W" || ch === "A" || ch === "B";
  };
  const statueTexts = tpl.statueText ?? ["A statue. It has seen better centuries."];
  let statueCount = 0;
  const pendingSwitches: { x: number; y: number; ch: string }[] = [];
  const boulders: { x: number; y: number }[] = [];
  const pits: { x: number; y: number }[] = [];

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y]![x] as string;
      const i = at(x, y);
      const vertical = isWallChar(x - 1, y) && isWallChar(x + 1, y);
      let tile: number = T.FLOOR;
      switch (ch) {
        case "#":
          tile = T.WALL;
          break;
        case "~":
          tile = T.WATER;
          break;
        case "<":
          tile = T.STAIRS_UP;
          level.up = { x, y };
          break;
        case ">":
          tile = T.STAIRS_DOWN;
          level.down = { x, y };
          break;
        case "+":
          tile = T.DOOR;
          level.doors.push({ id: level.doors.length, x, y, vertical, color: null, locked: false, open: false });
          break;
        case "r":
          tile = T.DOOR;
          level.doors.push({ id: level.doors.length, x, y, vertical, color: "red", locked: true, open: false });
          break;
        case "k":
          level.items.push({ x, y, item: makeItem(uids, "key_red") });
          break;
        case "{":
          level.features.push({ kind: "fountain", x, y, uses: 3 });
          break;
        case "_":
          level.features.push({ kind: "altar", x, y });
          break;
        case "S":
          level.features.push({ kind: "statue", x, y, text: statueTexts[statueCount % statueTexts.length] });
          statueCount++;
          break;
        case "0":
          level.features.push({ kind: "boulder", x, y });
          boulders.push({ x, y });
          break;
        case "^":
          tile = T.PIT;
          pits.push({ x, y });
          break;
        case "L":
          tile = T.WALL;
          level.switches.push({ id: level.switches.length, x, y, gate: -1, on: false, kind: "reset" });
          break;
        case "A":
        case "B":
        case "W":
          tile = T.WALL;
          pendingSwitches.push({ x, y, ch });
          break;
        case "a":
        case "b": {
          tile = T.GATE;
          const g = level.gates[gateFor(ch.toUpperCase(), "portcullis", "switch")]!;
          g.cells.push({ x, y });
          g.vertical = vertical;
          break;
        }
        case "w": {
          tile = T.GATE;
          const g = level.gates[gateFor("W", "drawbridge", "switch")]!;
          g.cells.push({ x, y });
          g.vertical = vertical;
          break;
        }
        case "x": {
          tile = T.GATE;
          const g = level.gates[gateFor("x", "portcullis", "boss")]!;
          g.cells.push({ x, y });
          g.vertical = vertical;
          break;
        }
        case "O":
          level.monsters.push(makeMonster(uids, rm, "oracle", depth, run.mods, x, y));
          break;
        case "M":
          level.monsters.push(makeMonster(uids, rm, tpl.boss ?? "medusa", depth, run.mods, x, y));
          break;
        case "g": {
          const mon = makeMonster(uids, rm, "soldier", depth, run.mods, x, y);
          mon.asleep = false;
          level.monsters.push(mon);
          break;
        }
        case "m":
          if (rm.chance(monsterShare)) {
            const type = pool[rm.weighted(pool.map((p) => p.freq))]!;
            level.monsters.push(makeMonster(uids, rm, type.id, depth, run.mods, x, y));
          }
          break;
        case "*":
          if (ri.chance(lootShare)) level.items.push({ x, y, item: rollItem(uids, ri, depth, run.mods) });
          break;
        case "$": {
          const gold = makeItem(uids, "gold", Math.max(1, Math.round(rg.range(20, 60) * (1 + depth / 4) * goldMod)));
          level.items.push({ x, y, item: gold });
          break;
        }
        case "!": {
          let prize;
          if (tpl.id === "stoneyard") {
            prize = makeItem(uids, "amulet_reflection", 1, "U");
          } else {
            prize = makeItem(uids, ri.pick(["wand_fire", "wand_cold", "wand_lightning"]), 1, "U");
            prize.charges = 8;
          }
          level.items.push({ x, y, item: prize });
          break;
        }
        case "p":
          level.items.push({ x, y, item: makeItem(uids, "potion_blindness", 1, "U") });
          break;
        default:
          break;
      }
      level.tiles[i] = tile;
    }
  }

  for (const s of pendingSwitches) {
    const gate = gateIds.get(s.ch);
    if (gate === undefined) throw new Error(`special level ${tpl.id}: switch ${s.ch} has no gate`);
    level.switches.push({ id: level.switches.length, x: s.x, y: s.y, gate, on: false, kind: "switch" });
  }

  if (boulders.length > 0) {
    level.boulderStart = boulders;
    level.pitStart = pits;
    level.boulderSolution = parseSolution(options.solution ?? tpl.solution ?? "", flipX, flipY);
  }

  // Torches on walls that face floor, sparsely.
  const rt = stream(run.seed, "features", depth);
  for (let y = 1; y < rows.length - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (level.tiles[at(x, y)] !== T.WALL) continue;
      if (level.switches.some((s) => s.x === x && s.y === y)) continue;
      const facesFloor = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some((n) => level.tiles[n] === T.FLOOR);
      if (facesFloor && rt.chance(0.08)) level.torches.push(at(x, y));
    }
  }

  level.meta.rooms = 0;
  level.meta.locks = level.gates.length + level.doors.filter((d) => d.locked).length;
  level.startArea = startArea(level);
  return level;
}
