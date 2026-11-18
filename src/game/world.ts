// The world clock: what happens as time passes, whether or not the
// player acts. Monsters, statuses, regeneration, traps, level changes,
// teleports, and what the player has seen.

import { scale3 } from "../core/modifiers.ts";
import { doorAt, featureAt, floodDistances, gateAt, inBounds, isOpenCell, lineOfSight, tileAt } from "../dungeon/grid.ts";
import { clearLine, monsterInSight, monsterShoots, monsterStrikes } from "./combat.ts";
import { itemType } from "./data/items.ts";
import { monsterType, monstersOfTier, tierOfDepth } from "./data/monsters.ts";
import { addStatus, addToPack, capital, cur, die, discover, emit, ensureLevel, has, hurt, isFree, itemsAt, mintMonster, monsterAt, nameOf, placeAt, rng, say, theMonster, tickStatuses, wearing, wornItem } from "./state.ts";
import { DX, DY, T } from "./types.ts";
import type { Dir, GameState, Level, Monster, Pos, Trap } from "./types.ts";

const TICK_MS = 50;

// ---- what the player can walk to -------------------------------------

/** Cells the player could walk to right now. Plain closed doors count as passable; locks do not. */
export function walkableNow(level: Level, x: number, y: number, levitating = false): boolean {
  if (!inBounds(level, x, y)) return false;
  const t = tileAt(level, x, y);
  if (t === T.WALL) return false;
  if (t === T.WATER || t === T.PIT) return levitating;
  if (t === T.DOOR) {
    const d = doorAt(level, x, y);
    if (d && !d.open && d.locked) return false;
  }
  if (t === T.GATE) {
    const g = gateAt(level, x, y);
    if (g && !g.open) return levitating && g.kind === "drawbridge";
  }
  return featureAt(level, x, y) === undefined;
}

export function reachableCells(state: GameState): Pos[] {
  const level = cur(state);
  const p = state.player;
  const dist = floodDistances(level, p, (x, y) => walkableNow(level, x, y));
  const out: Pos[] = [];
  for (let i = 0; i < dist.length; i++) {
    if ((dist[i] as number) <= 0) continue;
    const x = i % level.w;
    const y = (i - x) / level.w;
    if (tileAt(level, x, y) !== T.FLOOR || monsterAt(level, x, y)) continue;
    out.push({ x, y });
  }
  return out;
}

export function teleportPlayer(state: GameState, mode: "random" | "safe"): boolean {
  const level = cur(state);
  const cells = reachableCells(state);
  if (cells.length === 0) {
    say(state, "You shudder for a moment. Nothing else happens.");
    return false;
  }
  let target: Pos;
  if (mode === "safe") {
    const hostile = level.monsters.filter((m) => !m.peaceful && m.hp > 0);
    let best = cells[0] as Pos;
    let bestScore = -1;
    for (const c of cells) {
      let nearest = 999;
      for (const m of hostile) nearest = Math.min(nearest, Math.abs(m.x - c.x) + Math.abs(m.y - c.y));
      if (nearest > bestScore) {
        bestScore = nearest;
        best = c;
      }
    }
    target = best;
  } else {
    target = rng(state).pick(cells);
  }
  placeAt(state, target.x, target.y);
  emit(state, { kind: "flash", color: "#b090ff" });
  updateSeen(state);
  return true;
}

export function levelTeleport(state: GameState): void {
  const r = rng(state);
  let target = state.depth;
  for (let i = 0; i < 20 && target === state.depth; i++) target = Math.max(1, Math.min(24, state.depth + r.range(-3, 3)));
  if (target === state.depth) target = state.depth > 1 ? state.depth - 1 : 2;
  changeLevel(state, target, "port");
}

const ARRIVAL_LINES: Record<string, string> = {
  oracle: "Water runs somewhere ahead, and the statues here are better company than most.",
  stoneyard: "Boulders, pits, and a lever by the stairs. Someone built this on purpose.",
  gorgon: "The statues here are extremely lifelike. You have a bad feeling about looking around.",
  keep: "A moat, a raised drawbridge, and the sound of boots on the far side.",
  tower: "The air tastes of ash. Somewhere ahead, someone is humming.",
};

export function changeLevel(state: GameState, depth: number, how: "down" | "up" | "fall" | "port"): void {
  const p = state.player;
  const first = state.levels[depth] === undefined;
  const level = ensureLevel(state, depth);
  state.depth = depth;
  p.deepest = Math.max(p.deepest, depth);
  p.resting = false;
  let spot: Pos = level.up;
  if (how === "up" && level.down) spot = level.down;
  if (how === "fall" || how === "port") {
    const r = rng(state);
    const cells = level.startArea
      .map((i) => ({ x: i % level.w, y: Math.floor(i / level.w) }))
      .filter((c) => tileAt(level, c.x, c.y) === T.FLOOR && !monsterAt(level, c.x, c.y) && !featureAt(level, c.x, c.y));
    if (cells.length > 0) spot = r.pick(cells);
  }
  // Something may be standing on the arrival cell; it steps aside.
  const blocker = monsterAt(level, spot.x, spot.y);
  if (blocker) {
    for (let d = 0; d < 4; d++) {
      const nx = spot.x + (DX[d] as number);
      const ny = spot.y + (DY[d] as number);
      if (isOpenCell(level, nx, ny) && !monsterAt(level, nx, ny)) {
        blocker.x = nx;
        blocker.y = ny;
        blocker.px = nx;
        blocker.py = ny;
        break;
      }
    }
  }
  placeAt(state, spot.x, spot.y);
  if (!walkableNow(level, spot.x + (DX[p.dir] as number), spot.y + (DY[p.dir] as number))) {
    for (let d = 0; d < 4; d++) {
      if (walkableNow(level, spot.x + (DX[d] as number), spot.y + (DY[d] as number))) {
        p.dir = d as Dir;
        break;
      }
    }
  }
  p.pdir = p.dir;
  p.turnedAt = -10000;
  for (const m of level.monsters) {
    m.windupUntil = 0;
    m.windupKind = "";
    m.nextMove = Math.max(m.nextMove, state.time + 400);
    m.nextAttack = Math.max(m.nextAttack, state.time + 600);
    m.nextRanged = Math.max(m.nextRanged, state.time + 1500);
  }
  emit(state, { kind: "descend" });
  if (how === "fall") say(state, `You land on level ${depth}.`, "bad");
  else say(state, `Level ${depth}: ${level.name}.`, "system");
  if (first && level.special) say(state, ARRIVAL_LINES[level.special] ?? "", "info");
  updateSeen(state);
}

// ---- seeing and mapping ----------------------------------------------

export function updateSeen(state: GameState): void {
  const level = cur(state);
  const p = state.player;
  level.seen[p.y * level.w + p.x] = 1;
  if (has(state, "blind")) return;
  const lit = p.litUntil > state.time;
  const radius = lit ? 7 : 5;
  const fx = DX[p.dir] as number;
  const fy = DY[p.dir] as number;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (!inBounds(level, x, y)) continue;
      const i = y * level.w + x;
      if (level.seen[i]) continue;
      const ahead = dx * fx + dy * fy;
      const near = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      if (!lit && !near && ahead < 0) continue;
      if (lineOfSight(level, p.x, p.y, x, y)) level.seen[i] = 1;
    }
  }
}

export function mapLevel(state: GameState, mode: "full" | "partial" | "reveal"): void {
  const level = cur(state);
  const r = rng(state);
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      if (tileAt(level, x, y) === T.WALL) continue;
      if (mode === "partial" && r.chance(0.6)) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inBounds(level, x + dx, y + dy)) level.seen[(y + dy) * level.w + x + dx] = 1;
    }
  }
  if (mode === "reveal") for (const t of level.traps) t.found = true;
}

// ---- arriving in a cell ----------------------------------------------

function corrodeArmor(state: GameState): void {
  const p = state.player;
  const metal = p.inventory.filter((it) => it.slot && itemType(it.type).armor?.metal);
  if (metal.length === 0) {
    say(state, "A gush of water hits you. You are wet, and otherwise unharmed.");
    return;
  }
  const item = rng(state).pick(metal);
  if (item.proof) {
    say(state, `A gush of water hits your ${itemType(item.type).name}. The rustproofing holds.`, "good");
    return;
  }
  if (item.ench <= -3) {
    say(state, `A gush of water hits your ${itemType(item.type).name}. It cannot rust any further.`);
    return;
  }
  item.ench--;
  say(state, `A gush of water hits your ${itemType(item.type).name}. It rusts.`, "bad");
}

export function triggerTrap(state: GameState, trap: Trap): void {
  const r = rng(state);
  const p = state.player;
  trap.found = true;
  switch (trap.kind) {
    case "dart":
      say(state, "A little dart shoots out at you!", "bad");
      hurt(state, r.rnd(6), "killed by a little dart");
      break;
    case "pit":
      say(state, "You fall into a pit! Climbing out takes a moment.", "bad");
      hurt(state, r.rnd(6), "killed by falling into a pit");
      p.busyUntil = state.time + 1500;
      p.busyText = "You are climbing out of a pit.";
      break;
    case "gas":
      say(state, "A cloud of gas puffs up from the floor.", "bad");
      if (addStatus(state, "asleep", r.range(5, 10), true)) say(state, "You fall asleep.", "danger");
      trap.armed = false;
      break;
    case "teleport":
      say(state, "You step on a slab that hums. You feel a wrenching sensation.", "info");
      teleportPlayer(state, "random");
      break;
    case "trapdoor":
      if (state.depth >= 25) break;
      say(state, "A trapdoor opens under you!", "bad");
      changeLevel(state, state.depth + 1, "fall");
      break;
    case "squeak":
      say(state, "A board beneath you squeaks loudly.", "bad");
      for (const m of cur(state).monsters) {
        if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 10 && !m.peaceful) {
          m.asleep = false;
          m.aware = true;
        }
      }
      break;
    case "rust":
      corrodeArmor(state);
      break;
    case "flash":
      say(state, "A flash of light goes off in your face.", "bad");
      addStatus(state, "blind", r.range(8, 15));
      trap.armed = false;
      break;
  }
}

/** Everything that follows from the player entering a cell. */
export function arrive(state: GameState): void {
  const level = cur(state);
  const p = state.player;
  const floating = has(state, "levitating");
  const t = tileAt(level, p.x, p.y);

  if (!floating) {
    for (const plate of level.plates) {
      if (plate.x !== p.x || plate.y !== p.y || plate.pressed) continue;
      plate.pressed = true;
      const gate = level.gates.find((g) => g.id === plate.gate);
      if (gate && !gate.open) {
        gate.open = true;
        say(state, "A plate sinks under your foot. Somewhere, something heavy moves.", "good");
        emit(state, { kind: "sound", id: "switch" });
      }
    }
    const trap = level.traps.find((tr) => tr.x === p.x && tr.y === p.y && tr.armed);
    if (trap) {
      const depthBefore = state.depth;
      triggerTrap(state, trap);
      if (state.dead || state.depth !== depthBefore || p.x !== trap.x || p.y !== trap.y) return;
    }
  }

  if (t === T.STAIRS_DOWN || t === T.STAIRS_UP) {
    if (floating) {
      say(state, "You float over the stairs, unable to use them.");
    } else if (t === T.STAIRS_DOWN) {
      changeLevel(state, state.depth + 1, "down");
      return;
    } else if (state.depth > 1) {
      changeLevel(state, state.depth - 1, "up");
      return;
    } else {
      say(state, "These stairs lead out. The Guild does not pay for a pleasant walk; you are not leaving without the Eye.");
    }
  }

  const here = itemsAt(level, p.x, p.y);
  if (here.length === 0) return;
  if (floating) {
    say(state, "Something lies on the floor below you, out of reach.");
    return;
  }
  // Gold and keys are picked up without asking.
  for (const item of here) {
    const type = itemType(item.type);
    if (type.cls !== "gold" && !type.keyColor) continue;
    const label = nameOf(state, item);
    if (addToPack(state, item)) {
      level.items = level.items.filter((fi) => fi.item !== item);
      say(state, type.cls === "gold" ? `You pick up ${label}.` : `You pick up ${label}. It will fit a lock of the same colour.`, "loot");
      emit(state, { kind: "sound", id: type.cls === "gold" ? "coins" : "key" });
    }
  }
  const rest = itemsAt(level, p.x, p.y);
  if (rest.length === 1) say(state, `You see here ${nameOf(state, rest[0] as (typeof rest)[number])}.`);
  else if (rest.length > 1) say(state, `You see here ${rest.length} things.`);
}

// ---- monsters ---------------------------------------------------------

function speedMod(state: GameState): number {
  return scale3(state.run.mods["monsterSpeed"] ?? 5, 0.65, 1, 1.6);
}

function stepMonster(state: GameState, m: Monster, nx: number, ny: number): void {
  m.px = m.x;
  m.py = m.y;
  m.movedAt = state.time;
  m.x = nx;
  m.y = ny;
}

function freeNeighbours(state: GameState, level: Level, m: Monster): Pos[] {
  const out: Pos[] = [];
  for (let d = 0; d < 4; d++) {
    const nx = m.x + (DX[d] as number);
    const ny = m.y + (DY[d] as number);
    if (isFree(state, level, nx, ny)) out.push({ x: nx, y: ny });
  }
  return out;
}

/** Free cells near a point, nearest first. */
export function nearbyFree(state: GameState, from: Pos, count: number): Pos[] {
  const level = cur(state);
  const dist = floodDistances(level, from, (x, y) => isOpenCell(level, x, y) || (x === from.x && y === from.y), 6);
  const cells: { p: Pos; d: number }[] = [];
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i] as number;
    if (d <= 0) continue;
    const x = i % level.w;
    const y = (i - x) / level.w;
    if (isFree(state, level, x, y)) cells.push({ p: { x, y }, d });
  }
  cells.sort((a, b) => a.d - b.d);
  return cells.slice(0, count).map((c) => c.p);
}

export function summon(state: GameState, typeId: string, count: number, near: Pos): number {
  const level = cur(state);
  let made = 0;
  for (const spot of nearbyFree(state, near, count)) {
    const m = mintMonster(state, typeId, spot.x, spot.y);
    m.asleep = false;
    m.aware = true;
    m.nextMove = state.time + 500;
    m.nextAttack = state.time + 800;
    level.monsters.push(m);
    made++;
  }
  return made;
}

function randomTierMonster(state: GameState): string {
  const pool = monstersOfTier(tierOfDepth(state.depth));
  return (pool[rng(state).weighted(pool.map((t) => t.freq))] ?? pool[0]!).id;
}

function spawnWanderer(state: GameState): void {
  const level = cur(state);
  const p = state.player;
  const dist = floodDistances(level, p, (x, y) => isOpenCell(level, x, y), 12);
  const spots: Pos[] = [];
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i] as number;
    if (d < 6) continue;
    const x = i % level.w;
    const y = (i - x) / level.w;
    if (isFree(state, level, x, y) && !lineOfSight(level, p.x, p.y, x, y)) spots.push({ x, y });
  }
  if (spots.length === 0) return;
  const spot = rng(state).pick(spots);
  const m = mintMonster(state, randomTierMonster(state), spot.x, spot.y);
  m.asleep = false;
  m.aware = true;
  level.monsters.push(m);
}

function morvanePhase(state: GameState, m: Monster): void {
  if (m.type !== "morvane" || m.memory !== 0 || m.hp >= m.maxHp * 0.5) return;
  m.memory = 1;
  const level = cur(state);
  const p = state.player;
  const dist = floodDistances(level, p, (x, y) => isOpenCell(level, x, y), 14);
  let best: Pos | null = null;
  let bestD = 0;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i] as number;
    const x = i % level.w;
    const y = (i - x) / level.w;
    if (d > bestD && isFree(state, level, x, y)) {
      bestD = d;
      best = { x, y };
    }
  }
  if (best) {
    m.x = best.x;
    m.y = best.y;
    m.px = best.x;
    m.py = best.y;
  }
  m.windupUntil = 0;
  m.windupKind = "";
  const made = summon(state, randomTierMonster(state), 2, p);
  say(state, made > 0 ? "Morvane steps sideways out of the room, and back in somewhere else. He has brought company." : "Morvane steps sideways out of the room, and back in somewhere else.", "danger");
}

const TELEGRAPH: Record<string, string> = {
  fire: "draws a long breath",
  cold: "raises a hand rimed with frost",
  bolt: "raises a hand",
  gaze: "turns her head toward you",
};

function tickMonsters(state: GameState, ms: number): void {
  const level = cur(state);
  const p = state.player;
  const time = state.time;
  const sm = speedMod(state);
  let distMap: Int32Array | null = null;
  const distances = (): Int32Array => {
    if (!distMap) distMap = floodDistances(level, p, (x, y) => isOpenCell(level, x, y) || (x === p.x && y === p.y), 18);
    return distMap;
  };
  const playerHidden = has(state, "invisible");
  const scareHere = itemsAt(level, p.x, p.y).some((it) => it.type === "scroll_scare_monster");
  const r = rng(state);

  for (const m of level.monsters.slice()) {
    if (state.dead || state.depth !== level.depth) return;
    const type = monsterType(m.type);
    if (m.hp <= 0) {
      if (m.reviveAt > 0 && time >= m.reviveAt) {
        if (isFree(state, level, m.x, m.y)) {
          m.hp = Math.max(1, Math.round(m.maxHp / 2));
          m.revived = true;
          m.reviveAt = 0;
          m.aware = true;
          m.asleep = false;
          m.nextAttack = time + 900;
          say(state, `${capital(theMonster(m))} gets up again. Fire would have prevented this.`, "danger");
        } else {
          m.reviveAt = time + 1000;
        }
      }
      continue;
    }
    if (type.regen > 0 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + (type.regen * ms) / 1000);
    if (m.peaceful) continue;
    if (m.heldUntil > time || m.sleepUntil > time) {
      m.windupUntil = 0;
      m.windupKind = "";
      continue;
    }
    const dist = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
    if (m.asleep) {
      const chance = (dist <= 2 ? 0.05 : dist <= 5 ? 0.012 : 0) * (p.role === "rogue" ? 0.4 : 1);
      if (chance > 0 && r.chance(chance)) m.asleep = false;
      else continue;
    }
    if (!m.aware) {
      const noticeRange = playerHidden && !type.boss ? 2 : 7;
      if (dist <= noticeRange && lineOfSight(level, m.x, m.y, p.x, p.y)) m.aware = true;
      else continue;
    }

    if (m.windupUntil > 0) {
      if (time >= m.windupUntil) {
        const kind = m.windupKind;
        m.windupUntil = 0;
        m.windupKind = "";
        if (kind === "melee") {
          m.nextAttack = time + type.attackMs / sm;
          monsterStrikes(state, m);
        } else if (kind === "ranged" && type.ranged) {
          m.nextRanged = time + type.ranged.every / sm;
          monsterShoots(state, m);
        }
        if (m.hp > 0) morvanePhase(state, m);
      }
      continue;
    }

    morvanePhase(state, m);
    const fleeing = m.fleeUntil > time;
    const adjacent = dist === 1;

    if (type.ranged && !fleeing && time >= m.nextRanged && (dist >= 2 || type.ranged.kind === "gaze") && (!playerHidden || type.boss)) {
      if (clearLine(state, m, type.ranged.range)) {
        m.windupUntil = time + 700;
        m.windupKind = "ranged";
        m.attackAnimUntil = m.windupUntil + 200;
        if (monsterInSight(state, m, 8)) say(state, `${capital(theMonster(m))} ${TELEGRAPH[type.ranged.kind]}.`, "bad");
        continue;
      }
    }

    if (adjacent && !fleeing && type.attacks.length > 0 && time >= m.nextAttack) {
      if (scareHere && !type.boss) {
        m.fleeUntil = time + 8000;
        continue;
      }
      m.windupUntil = time + type.windupMs;
      m.windupKind = "melee";
      m.attackAnimUntil = m.windupUntil + 160;
      continue;
    }

    if (type.moveMs > 0 && time >= m.nextMove) {
      m.nextMove = time + type.moveMs / sm;
      if (adjacent && !fleeing) continue;
      const options = freeNeighbours(state, level, m);
      if (options.length === 0) continue;
      const wander = (type.erratic && r.chance(0.4)) || (playerHidden && !type.boss && r.chance(0.5));
      if (wander) {
        const o = r.pick(options);
        stepMonster(state, m, o.x, o.y);
        continue;
      }
      const dm = distances();
      const here = dm[m.y * level.w + m.x] as number;
      let best: Pos | null = null;
      let bestD = fleeing ? here : here === -1 ? 9999 : here;
      for (const o of options) {
        const d = dm[o.y * level.w + o.x] as number;
        if (d === -1) continue;
        if (fleeing ? d > bestD : d < bestD) {
          bestD = d;
          best = o;
        }
      }
      if (best) stepMonster(state, m, best.x, best.y);
    }
  }
}

// ---- the tick ---------------------------------------------------------

function tickConditions(state: GameState, ms: number): void {
  const p = state.player;
  if (p.stoning > 0) {
    p.stoning -= ms;
    const stage = p.stoning > 10000 ? 0 : p.stoning > 5000 ? 1 : 2;
    if (stage > p.stoneStage) {
      p.stoneStage = stage;
      say(state, stage === 1 ? "Your limbs are stiffening. Something that heals would stop this." : "Your limbs have turned to stone. Seconds remain.", "danger");
    }
    if (p.stoning <= 0) {
      p.stoning = 0;
      say(state, "You are a statue.", "danger");
      die(state, "turned to stone by a cockatrice");
    }
  }
  const amulet = wornItem(p, "amulet");
  if (amulet && amulet.type === "amulet_strangulation") {
    const before = p.strangling;
    p.strangling = before <= 0 ? 25000 : before - ms;
    if (before > 12000 && p.strangling <= 12000) say(state, "You find it hard to breathe. The amulet is tightening.", "danger");
    if (before > 5000 && p.strangling <= 5000) say(state, "You are turning blue.", "danger");
    if (before > 0 && p.strangling <= 0) {
      p.strangling = 0.001;
      say(state, "You suffocate.", "danger");
      die(state, "strangled by an amulet");
      if (!state.dead) p.strangling = 25000;
    }
  } else {
    p.strangling = 0;
  }
  if (wearing(p, "ring_teleportation")) {
    if (p.nextRingTeleport <= 0) p.nextRingTeleport = state.time + rng(state).range(20000, 60000);
    else if (state.time >= p.nextRingTeleport) {
      p.nextRingTeleport = 0;
      say(state, "Your ring tugs at you. You feel a wrenching sensation.", "bad");
      discover(state, "ring_teleportation");
      teleportPlayer(state, "random");
    }
  } else {
    p.nextRingTeleport = 0;
  }
}

function tickRegen(state: GameState, ms: number): void {
  const p = state.player;
  const boost = p.resting ? 4 : 1;
  if (p.hp < p.maxHp && p.stoning <= 0) {
    const rate = (0.05 + p.xl * 0.02 + (wearing(p, "ring_regeneration") ? 0.5 : 0)) * boost;
    p.regenCarry += (rate * ms) / 1000;
    if (p.regenCarry >= 1) {
      const whole = Math.floor(p.regenCarry);
      p.regenCarry -= whole;
      p.hp = Math.min(p.maxHp, p.hp + whole);
    }
  }
  if (p.pw < p.maxPw) {
    const rate = (0.06 + p.xl * 0.012 + (p.role === "wizard" ? 0.12 : 0) + Math.max(0, p.stats.wi - 10) * 0.004) * boost;
    p.pwCarry += (rate * ms) / 1000;
    if (p.pwCarry >= 1) {
      const whole = Math.floor(p.pwCarry);
      p.pwCarry -= whole;
      p.pw = Math.min(p.maxPw, p.pw + whole);
    }
  }
}

export function hostileInSight(state: GameState): Monster | undefined {
  for (const m of cur(state).monsters) if (!m.peaceful && monsterInSight(state, m, 6)) return m;
  return undefined;
}

export function hostileAdjacent(state: GameState): Monster | undefined {
  const p = state.player;
  for (const m of cur(state).monsters) if (!m.peaceful && m.hp > 0 && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) === 1) return m;
  return undefined;
}

function tickRest(state: GameState, ms: number): void {
  const p = state.player;
  if (!p.resting) return;
  const seen = hostileInSight(state) ?? hostileAdjacent(state);
  if (seen) {
    p.resting = false;
    say(state, `You stop resting: ${theMonster(seen)} is here.`, "bad");
    return;
  }
  if (p.hp >= p.maxHp && p.pw >= p.maxPw) {
    p.resting = false;
    say(state, "You are rested.", "good");
    return;
  }
  const perSecond = scale3(state.run.mods["restSafety"] ?? 5, 0.03, 0.008, 0);
  if (perSecond > 0 && rng(state).chance((perSecond * ms) / 1000)) {
    spawnWanderer(state);
    say(state, "You hear footsteps. Something has found you.", "bad");
  }
}

function simTick(state: GameState, ms: number): void {
  state.time += ms;
  tickStatuses(state, ms);
  tickConditions(state, ms);
  if (state.dead) return;
  tickRegen(state, ms);
  tickRest(state, ms);
  tickMonsters(state, ms);
  if (!state.dead) updateSeen(state);
}

/** Advance the world by a span of real time. Resting runs the clock faster. */
export function update(state: GameState, dtMs: number): void {
  let left = Math.min(dtMs, 2000);
  while (left > 0) {
    if (state.dead || state.won || state.prompt) return;
    const slice = Math.min(TICK_MS, left);
    const reps = state.player.resting ? 5 : 1;
    for (let i = 0; i < reps; i++) {
      if (state.dead || state.won || state.prompt) return;
      simTick(state, slice);
    }
    left -= slice;
  }
}

