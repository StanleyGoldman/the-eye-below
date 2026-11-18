// An autopilot that plays through the same actions as the keyboard. It
// reads the whole level (it cheats at knowing, not at doing) and exists
// for the scripted victory and death checks.

import { doorAt, featureAt, inBounds, tileAt } from "../dungeon/grid.ts";
import { attack, cancelPrompt, cast, castFailure, choose, interact, move, pickUp, toggleRest, turn, useItem } from "./actions.ts";
import { itemType } from "./data/items.ts";
import { monsterType } from "./data/monsters.ts";
import { spellCost } from "./data/spells.ts";
import { canAct, countKeys, cur, itemsAt, monsterAt, wornItem } from "./state.ts";
import { DX, DY, T } from "./types.ts";
import type { Dir, GameState, Item, Level, Monster, Pos } from "./types.ts";
import { hostileInSight, update, walkableNow } from "./world.ts";

export type BotMode = "win" | "die";

interface BotMemory {
  /** Level the boulder script belongs to and how far along it is. */
  scriptDepth: number;
  scriptIndex: number;
  scriptStuck: number;
  nextGearCheck: number;
}

const memory = new WeakMap<GameState, BotMemory>();

function mem(state: GameState): BotMemory {
  let m = memory.get(state);
  if (!m) {
    m = { scriptDepth: -1, scriptIndex: 0, scriptStuck: 0, nextGearCheck: 0 };
    memory.set(state, m);
  }
  return m;
}

function face(state: GameState, dir: Dir): boolean {
  const p = state.player;
  if (p.dir === dir) return true;
  turn(state, ((dir - p.dir + 4) % 4) === 1 ? "right" : "left");
  return false;
}

/** Can the bot get through this cell, counting doors it holds keys for and monsters it can fight? */
function botPassable(state: GameState, level: Level, x: number, y: number): boolean {
  if (!inBounds(level, x, y)) return false;
  const t = tileAt(level, x, y);
  if (t === T.DOOR) {
    const d = doorAt(level, x, y);
    if (d && !d.open && d.locked) return !!countKeys(state.player, d.color ?? "plain");
  }
  if (!walkableNow(level, x, y)) return false;
  const m = monsterAt(level, x, y);
  return !(m && m.peaceful);
}

interface Routes {
  dist: Int32Array;
  parent: Int32Array;
}

function routes(state: GameState, avoidStairs: boolean): Routes {
  const level = cur(state);
  const p = state.player;
  const size = level.w * level.h;
  const dist = new Int32Array(size).fill(-1);
  const parent = new Int32Array(size).fill(-1);
  const start = p.y * level.w + p.x;
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head] as number;
    const cx = c % level.w;
    const cy = (c - cx) / level.w;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (DX[d] as number);
      const ny = cy + (DY[d] as number);
      if (!botPassable(state, level, nx, ny)) continue;
      const ni = ny * level.w + nx;
      if (dist[ni] !== -1) continue;
      dist[ni] = (dist[c] as number) + 1;
      parent[ni] = c;
      // Stairs can be a destination but never a stepping stone: walking onto them changes level.
      const nt = level.tiles[ni];
      if (avoidStairs && (nt === T.STAIRS_UP || nt === T.STAIRS_DOWN)) continue;
      queue.push(ni);
    }
  }
  return { dist, parent };
}

/** Take one step along the route to a cell. Returns false if there is no route. */
function stepToward(state: GameState, r: Routes, target: Pos): boolean {
  const level = cur(state);
  const p = state.player;
  let c = target.y * level.w + target.x;
  if ((r.dist[c] as number) <= 0) return false;
  const start = p.y * level.w + p.x;
  while ((r.parent[c] as number) !== start) {
    c = r.parent[c] as number;
    if (c < 0) return false;
  }
  const nx = c % level.w;
  const ny = (c - nx) / level.w;
  const dir = ([0, 1, 2, 3] as Dir[]).find((d) => p.x + (DX[d] as number) === nx && p.y + (DY[d] as number) === ny);
  if (dir === undefined) return false;
  if (!face(state, dir)) return true;
  if (monsterAt(level, nx, ny)) strikeAhead(state);
  else move(state, "forward");
  return true;
}

/** The bot reads an item's true enchantment and curse state; a player would have to find them out. */
function weaponScore(item: Item): number {
  const w = itemType(item.type).weapon;
  if (!w || w.launcher || w.ammo) return -1;
  return (w.dice[0] * (w.dice[1] + 1)) / 2 + w.bonus + item.ench + w.toHit / 2;
}

/** Would the bot put this on at once? It carries nothing else. */
function wanted(state: GameState, item: Item): boolean {
  const p = state.player;
  const type = itemType(item.type);
  if (type.id === "amulet_eye") return true;
  if (!state.debug.god && type.cls === "potion" && p.inventory.length < 40) return true;
  if (item.buc === "C" || p.inventory.length >= 45) return false;
  const main = wornItem(p, "main");
  if (type.armor) {
    if (type.armor.slot === "off" && main && itemType(main.type).weapon?.twoHanded) return false;
    return !wornItem(p, type.armor.slot);
  }
  if (type.weapon) {
    if (main && main.buc === "C") return false;
    if (type.weapon.twoHanded && wornItem(p, "off")) return false;
    return weaponScore(item) > (main ? weaponScore(main) : 1.5) + 0.6;
  }
  return false;
}

/** Wear armor into empty slots and swap to a clearly better weapon. */
function checkGear(state: GameState): boolean {
  const p = state.player;
  const main = wornItem(p, "main");
  const hasShield = !!wornItem(p, "off");
  for (const item of p.inventory) {
    if (item.slot || item.buc === "C") continue;
    const type = itemType(item.type);
    if (type.armor && !wornItem(p, type.armor.slot)) {
      if (type.armor.slot === "off" && main && itemType(main.type).weapon?.twoHanded) continue;
      useItem(state, item.uid, "wear");
      return true;
    }
    if (type.weapon && !(type.weapon.twoHanded && hasShield)) {
      const current = main ? weaponScore(main) : 1.5;
      if (weaponScore(item) > current + 0.6 && !(main && main.buc === "C")) {
        useItem(state, item.uid, "wield");
        return true;
      }
    }
  }
  return false;
}

/** Monsters that punish whoever hits them: left alone unless they are in the way. */
function isAwkward(m: Monster): boolean {
  const passive = monsterType(m.type).passive;
  return passive === "paralyze" || passive === "acid";
}

/** Attack what is ahead, with a spell when one is known and affordable. */
function strikeAhead(state: GameState): void {
  const p = state.player;
  if (state.time >= p.castReady) {
    for (const id of ["magic_missile", "force_bolt"]) {
      if (p.spells.includes(id) && p.pw >= spellCost(id) && castFailure(state, id) < 40) {
        cast(state, id);
        return;
      }
    }
  }
  attack(state);
}

function adjacentHostile(state: GameState, includePassive: boolean): { m: Monster; dir: Dir } | null {
  const level = cur(state);
  const p = state.player;
  for (const d of [p.dir, (p.dir + 1) % 4, (p.dir + 3) % 4, (p.dir + 2) % 4] as Dir[]) {
    const m = monsterAt(level, p.x + (DX[d] as number), p.y + (DY[d] as number));
    if (!m || m.peaceful) continue;
    if (!includePassive && isAwkward(m)) continue;
    return { m, dir: d };
  }
  return null;
}

function dismissPrompt(state: GameState): void {
  const prompt = state.prompt;
  if (!prompt) return;
  if (prompt.kind === "menu") choose(state, prompt.context === "attackPeaceful" ? "no" : "leave");
  else cancelPrompt(state);
}

/** Follow the level's stored boulder solution. Returns true while the script is still running. */
function runBoulderScript(state: GameState): boolean {
  const level = cur(state);
  const p = state.player;
  const m = mem(state);
  if (level.special !== "stoneyard" || !level.boulderSolution) return false;
  if (!level.tiles.includes(T.PIT)) return false;
  if (m.scriptDepth !== level.depth) {
    if (p.x !== level.up.x || p.y !== level.up.y) return false;
    m.scriptDepth = level.depth;
    m.scriptIndex = 0;
    m.scriptStuck = 0;
  }
  const dir = level.boulderSolution[m.scriptIndex];
  if (dir === undefined) return false;
  if (!face(state, dir)) return true;
  const bx = p.x;
  const by = p.y;
  const ahead = monsterAt(level, p.x + (DX[dir] as number), p.y + (DY[dir] as number));
  if (ahead && !ahead.peaceful) {
    attack(state);
    return true;
  }
  move(state, "forward");
  if (p.x !== bx || p.y !== by) {
    m.scriptIndex++;
    m.scriptStuck = 0;
  } else if (++m.scriptStuck > 400) {
    m.scriptDepth = -1;
    return false;
  }
  return true;
}

function winStep(state: GameState): void {
  const level = cur(state);
  const p = state.player;
  const m = mem(state);

  if (state.time >= m.nextGearCheck) {
    m.nextGearCheck = state.time + 3000;
    if (checkGear(state)) return;
  }
  // When it can die, it plays with a little care: drinks a healing potion in a pinch, rests when hurt.
  if (!state.debug.god && p.hp < p.maxHp * 0.35) {
    const potion = p.inventory.find((it) => (it.type === "potion_healing" || it.type === "potion_extra_healing") && state.discovered[it.type]);
    if (potion) {
      useItem(state, potion.uid, "quaff");
      return;
    }
  }
  const foe = adjacentHostile(state, false);
  if (foe) {
    if (face(state, foe.dir)) strikeAhead(state);
    return;
  }
  if (!state.debug.god && p.hp < p.maxHp * 0.6 && !hostileInSight(state)) {
    toggleRest(state);
    return;
  }
  const loot = itemsAt(level, p.x, p.y).find((it) => wanted(state, it));
  if (loot) {
    if (loot.type === "amulet_eye" && p.inventory.length >= 52) {
      const spare = p.inventory.find((it) => !it.slot);
      if (spare) {
        useItem(state, spare.uid, "drop");
        return;
      }
    }
    pickUp(state, loot.uid);
    m.nextGearCheck = 0;
    return;
  }
  if (runBoulderScript(state)) return;

  const r = routes(state, true);
  const reach = (pos: Pos): boolean => (r.dist[pos.y * level.w + pos.x] as number) > 0;

  const eye = level.items.find((fi) => fi.item.type === "amulet_eye");
  if (eye) {
    stepToward(state, r, eye);
    return;
  }
  // Clear the level as a player would: the experience is needed further down.
  let prey: Monster | null = null;
  let preyD = Infinity;
  for (const x of level.monsters) {
    if (x.peaceful || x.hp <= 0 || x.fleeUntil > state.time) continue;
    const t = monsterType(x.type);
    if (isAwkward(x) || t.id === "leprechaun") continue;
    const d = r.dist[x.y * level.w + x.x] as number;
    if (d > 0 && d < preyD) {
      preyD = d;
      prey = x;
    }
  }
  if (prey) {
    stepToward(state, r, prey);
    return;
  }
  if (level.down && reach(level.down)) {
    stepToward(state, r, level.down);
    return;
  }
  const key = level.items.filter((fi) => itemType(fi.item.type).keyColor && reach(fi)).sort((a, b) => (r.dist[a.y * level.w + a.x] as number) - (r.dist[b.y * level.w + b.x] as number))[0];
  if (key) {
    stepToward(state, r, key);
    return;
  }
  for (const sw of level.switches) {
    if (sw.on || sw.kind !== "switch") continue;
    for (let d = 0; d < 4; d++) {
      const fx = sw.x + (DX[d] as number);
      const fy = sw.y + (DY[d] as number);
      if (!inBounds(level, fx, fy)) continue;
      const here = fx === p.x && fy === p.y;
      if (!here && !reach({ x: fx, y: fy })) continue;
      if (featureAt(level, fx, fy) || tileAt(level, fx, fy) === T.WALL) continue;
      if (here) {
        if (face(state, ((d + 2) % 4) as Dir)) interact(state);
      } else {
        stepToward(state, r, { x: fx, y: fy });
      }
      return;
    }
  }
  const plate = level.plates.find((pl) => !pl.pressed && reach(pl));
  if (plate) {
    stepToward(state, r, plate);
    return;
  }
  const boss = level.monsters.find((x) => x.hp > 0 && monsterType(x.type).boss);
  if (boss && reach(boss)) {
    stepToward(state, r, boss);
    return;
  }
  // Nothing useful is reachable. A paralyzing eye may be the thing in the way.
  const blocker = adjacentHostile(state, true);
  if (blocker && face(state, blocker.dir)) attack(state);
}

function dieStep(state: GameState): void {
  const level = cur(state);
  const p = state.player;
  // Stand still beside anything that will hit back; a floating eye never will.
  const threat = level.monsters.some((m) => !m.peaceful && m.hp > 0 && monsterType(m.type).attacks.length > 0 && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1);
  if (threat) return;
  const r = routes(state, true);
  let best: Monster | null = null;
  let bestD = Infinity;
  for (const m of level.monsters) {
    if (m.peaceful || m.hp <= 0 || monsterType(m.type).attacks.length === 0) continue;
    const d = r.dist[m.y * level.w + m.x] as number;
    if (d > 0 && d < bestD) {
      bestD = d;
      best = m;
    }
  }
  if (best) {
    // Walk up to it without attacking.
    if (bestD > 1) stepToward(state, r, best);
    return;
  }
  if (level.down && (r.dist[level.down.y * level.w + level.down.x] as number) > 0) stepToward(state, r, level.down);
  else winStep(state);
}

/** One decision. Call once per simulation tick, before the world advances. */
export function botStep(state: GameState, mode: BotMode): void {
  if (state.dead || state.won) return;
  if (state.prompt) {
    dismissPrompt(state);
    return;
  }
  if (!canAct(state) || state.time < state.player.stepReady || state.player.resting) return;
  if (mode === "win") winStep(state);
  else dieStep(state);
}

export interface BotResult {
  outcome: "won" | "dead" | "timeout";
  gameMs: number;
  depth: number;
}

/** Play until the run ends or the time budget (in game milliseconds) runs out. */
export function runBot(state: GameState, mode: BotMode, budgetMs: number): BotResult {
  const start = state.time;
  while (!state.dead && !state.won && state.time - start < budgetMs) {
    botStep(state, mode);
    update(state, 50);
    if (state.prompt) dismissPrompt(state);
  }
  return { outcome: state.won ? "won" : state.dead ? "dead" : "timeout", gameMs: state.time - start, depth: state.depth };
}
