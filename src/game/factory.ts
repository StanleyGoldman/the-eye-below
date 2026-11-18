// Creating item and monster instances. Used by the generator and by the game.

import { scale3 } from "../core/modifiers.ts";
import type { Mods } from "../core/modifiers.ts";
import type { Rng } from "../core/rng.ts";
import { CLASS_WEIGHT, ITEM_TYPES, itemType } from "./data/items.ts";
import type { ItemType } from "./data/items.ts";
import { monsterType } from "./data/monsters.ts";
import type { Buc, Item, ItemClass, Monster } from "./types.ts";

export interface UidSource {
  next: number;
}

export function makeItem(uids: UidSource, type: string, qty = 1, buc: Buc = "U", ench = 0): Item {
  const t = itemType(type);
  return {
    uid: uids.next++,
    type,
    qty,
    buc,
    ench,
    charges: t.cls === "wand" ? 5 : 0,
    proof: false,
    known: false,
    bucKnown: false,
    letter: "",
    slot: null,
  };
}

const USUALLY_CURSED = new Set(["ring_teleportation", "amulet_strangulation"]);

export function cursedChance(mods: Mods): number {
  return scale3(mods["cursedShare"] ?? 5, 0.02, 0.12, 0.42);
}

export function blessedChance(mods: Mods): number {
  return scale3(mods["blessedShare"] ?? 5, 0.02, 0.1, 0.36);
}

function rollBuc(rng: Rng, mods: Mods, type: ItemType): Buc {
  if (USUALLY_CURSED.has(type.id) && rng.chance(0.85)) return "C";
  const r = rng.next();
  const c = cursedChance(mods);
  if (r < c) return "C";
  if (r < c + blessedChance(mods)) return "B";
  return "U";
}

/** How far loot quality shifts the depth used to pick item types. */
function qualityShift(mods: Mods): number {
  return Math.round(scale3(mods["lootQuality"] ?? 5, -3, 0, 6));
}

export function pickItemType(rng: Rng, depth: number, mods: Mods, cls?: ItemClass): ItemType {
  let chosen: ItemClass;
  if (cls) {
    chosen = cls;
  } else {
    const classes = Object.keys(CLASS_WEIGHT) as ItemClass[];
    chosen = classes[rng.weighted(classes.map((c) => CLASS_WEIGHT[c] ?? 0))] as ItemClass;
  }
  const effective = Math.max(1, depth + qualityShift(mods));
  const pool = ITEM_TYPES.filter((t) => t.cls === chosen && t.freq > 0 && t.minDepth <= effective);
  if (pool.length === 0) return itemType("dagger");
  return pool[rng.weighted(pool.map((t) => t.freq))] as ItemType;
}

/** A random item suited to the depth and the run's modifiers. */
export function rollItem(uids: UidSource, rng: Rng, depth: number, mods: Mods, cls?: ItemClass): Item {
  const type = pickItemType(rng, depth, mods, cls);
  const item = makeItem(uids, type.id);
  item.buc = rollBuc(rng, mods, type);
  const goodChance = scale3(mods["lootQuality"] ?? 5, 0.04, 0.16, 0.45);
  if (type.cls === "weapon" || type.cls === "armor" || type.id === "ring_protection") {
    if (item.buc === "C") item.ench = -rng.rnd(3);
    else if (rng.chance(goodChance)) item.ench = rng.rnd(item.buc === "B" ? 3 : 2);
    if (type.id === "ring_protection" && item.ench === 0) item.ench = 1;
  }
  if (type.cls === "wand") item.charges = rng.range(4, 8);
  if (type.id === "arrow") item.qty = rng.range(6, 14);
  else if (type.id === "dagger") item.qty = rng.chance(0.3) ? rng.range(2, 3) : 1;
  else if ((type.cls === "potion" || type.cls === "scroll") && rng.chance(0.08)) item.qty = 2;
  return item;
}

export function monsterLevelAt(typeId: string, depth: number): number {
  const type = monsterType(typeId);
  if (type.tier < 1) return type.level;
  const tierStart = (type.tier - 1) * 5 + 1;
  return type.level + Math.max(0, Math.floor((depth - tierStart) / 2));
}

export function makeMonster(uids: UidSource, rng: Rng, typeId: string, depth: number, mods: Mods, x: number, y: number): Monster {
  const type = monsterType(typeId);
  const level = monsterLevelAt(typeId, depth);
  const tough = scale3(mods["monsterToughness"] ?? 5, 0.6, 1, 1.8);
  const rolled = level > 0 ? rng.dice(level, 8) : rng.rnd(4);
  const hp = Math.max(1, Math.round((rolled + type.bonusHp) * tough));
  const goldMod = scale3(mods["gold"] ?? 5, 0.3, 1, 3);
  return {
    uid: uids.next++,
    type: typeId,
    x,
    y,
    hp,
    maxHp: hp,
    level,
    peaceful: type.peaceful,
    asleep: !type.boss && !type.peaceful && rng.chance(0.55),
    sleepUntil: 0,
    heldUntil: 0,
    fleeUntil: 0,
    nextMove: 0,
    nextAttack: 0,
    nextRanged: 0,
    windupUntil: 0,
    windupKind: "",
    aware: false,
    revived: false,
    reviveAt: 0,
    gold: rng.chance(type.gold) ? Math.round(rng.range(2, 12) * (1 + depth / 3) * goldMod) : 0,
    px: x,
    py: y,
    movedAt: -10000,
    attackAnimUntil: 0,
    hitFlashUntil: 0,
    memory: 0,
  };
}
