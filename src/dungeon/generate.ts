// Level generation entry point. A level depends only on the seed, the
// modifiers, and its depth, never on what the player did before.

import { scale3 } from "../core/modifiers.ts";
import { stream } from "../core/rng.ts";
import { makeItem, makeMonster, rollItem } from "../game/factory.ts";
import { keeperName, makeStock, pickShopKind } from "../game/shops.ts";
import { ITEM_TYPES } from "../game/data/items.ts";
import { EPITAPHS } from "../game/data/rumors.ts";
import { monstersOfTier, tierOfDepth } from "../game/data/monsters.ts";
import type { MonsterType } from "../game/data/monsters.ts";
import { T } from "../game/types.ts";
import type { Item, Level, Pos, RunConfig, TrapKind } from "../game/types.ts";
import { boneFlag, carve, interiorCells, planLayout, roomCells } from "./layout.ts";
import type { Carved } from "./layout.ts";
import { doorIsCut, gateIsCut, solveLevel, startArea } from "./solve.ts";
import { buildSpecial, isSpecialDepth } from "./special.ts";

const MAX_ATTEMPTS = 30;

/** Rooms, corridors, stairs, and locks, verified solvable. No monsters or loot yet. */
export function buildLayout(run: RunConfig, depth: number): Carved {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const plan = planLayout(run, depth, attempt, true);
    const carved = carve(run, depth, attempt, plan);
    if (layoutIsSound(carved)) return carved;
  }
  // Last resort: the same kind of level with no locks at all, which is always connected.
  const plan = planLayout(run, depth, MAX_ATTEMPTS, false);
  return carve(run, depth, MAX_ATTEMPTS, plan);
}

function layoutIsSound(carved: Carved): boolean {
  const { level, plan } = carved;
  const bone = level.meta.boneDoor ? 1 : 0;
  if (!solveLevel(level).ok) return false;
  // Every lock on the route must be a real obstacle, and every closet must open.
  for (const lock of plan.locks) {
    const edge = plan.edges[lock.edge]!;
    const cell = (lock.to === edge.b ? edge.cells[edge.cells.length - 1] : edge.cells[0]) as Pos;
    if (!lock.onPath) continue;
    if (lock.kind === "key") {
      const di = level.doors.findIndex((d) => d.x === cell.x && d.y === cell.y);
      if (di < 0 || !doorIsCut(level, di)) return false;
    } else {
      const gi = level.gates.findIndex((g) => g.cells.some((c) => c.x === cell.x && c.y === cell.y));
      if (gi < 0 || !gateIsCut(level, gi)) return false;
    }
  }
  const full = solveLevel(level, { boneKeys: bone });
  const lockedDoors = level.doors.filter((d) => d.locked).length;
  return full.ok && full.doorsOpened === lockedDoors && full.gatesOpened === level.gates.length;
}

function pickMonsterType(rng: { weighted(w: readonly number[]): number }, depth: number): MonsterType {
  const tier = tierOfDepth(depth);
  const pool: MonsterType[] = [];
  const weights: number[] = [];
  for (const t of monstersOfTier(tier)) {
    pool.push(t);
    weights.push(t.freq);
  }
  if (tier > 1) {
    for (const t of monstersOfTier(tier - 1)) {
      pool.push(t);
      weights.push(t.freq * 0.25);
    }
  }
  if (tier < 5 && depth % 5 === 4) {
    for (const t of monstersOfTier(tier + 1)) {
      pool.push(t);
      weights.push(t.freq * 0.15);
    }
  }
  return pool[rng.weighted(weights)] as MonsterType;
}

const TRAPS: readonly { kind: TrapKind; weight: number; minDepth: number }[] = [
  { kind: "dart", weight: 3, minDepth: 1 },
  { kind: "squeak", weight: 2, minDepth: 1 },
  { kind: "pit", weight: 2, minDepth: 1 },
  { kind: "gas", weight: 2, minDepth: 2 },
  { kind: "flash", weight: 1, minDepth: 2 },
  { kind: "rust", weight: 1, minDepth: 3 },
  { kind: "teleport", weight: 1, minDepth: 3 },
  { kind: "trapdoor", weight: 1, minDepth: 2 },
];

function populate(run: RunConfig, carved: Carved): void {
  const { level, plan, used, uids } = carved;
  const depth = level.depth;
  const mods = run.mods;
  const at = (x: number, y: number): number => y * level.w + x;
  const startRoom = plan.rooms[plan.start]!;
  const openRooms = plan.rooms.filter((r) => !r.closet && !r.shop);
  const shop = plan.shopRoom >= 0 ? plan.rooms[plan.shopRoom]! : null;
  if (shop) for (const c of roomCells(shop)) used.add(at(c.x, c.y));
  const closets = plan.rooms.filter((r) => r.closet && !r.vault);
  const vault = plan.vaultRoom >= 0 ? plan.rooms[plan.vaultRoom]! : null;
  if (vault) for (const c of roomCells(vault)) used.add(at(c.x, c.y));

  // ---- fountains and altars: interior cells only, never side by side ----
  const rf = stream(run.seed, "features", depth);
  const featureSpots = (): Pos[] => {
    const spots: Pos[] = [];
    for (const room of openRooms) {
      if (room.w < 3 || room.h < 3) continue;
      for (const c of interiorCells(room)) {
        let clear = true;
        for (let dy = -1; dy <= 1 && clear; dy++) for (let dx = -1; dx <= 1; dx++) if (used.has(at(c.x + dx, c.y + dy))) clear = false;
        if (clear) spots.push(c);
      }
    }
    return spots;
  };
  const placeFeatures = (kind: "fountain" | "altar", expected: number): void => {
    const n = Math.floor(expected) + (rf.chance(expected - Math.floor(expected)) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const spots = featureSpots();
      if (spots.length === 0) return;
      const c = rf.pick(spots);
      used.add(at(c.x, c.y));
      level.features.push(kind === "fountain" ? { kind, x: c.x, y: c.y, uses: rf.range(2, 4) } : { kind, x: c.x, y: c.y });
    }
  };
  placeFeatures("fountain", scale3(mods["fountains"] ?? 5, 0, 0.9, 2.4));
  placeFeatures("altar", scale3(mods["fountains"] ?? 5, 0, 0.3, 0.9));

  // ---- the shop: a keeper beside the door, and a stock that lives in the ledger ----
  const rsh = stream(run.seed, "shopstock", depth);
  if (shop) {
    const inRoom = (x: number, y: number): boolean => x >= shop.x && x < shop.x + shop.w && y >= shop.y && y < shop.y + shop.h;
    const door = level.doors.find((d) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inRoom(d.x + dx!, d.y + dy!)));
    if (door) {
      const entry = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: door.x + dx!, y: door.y + dy! })).find((c) => inRoom(c.x, c.y))!;
      const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: entry.x + dx!, y: entry.y + dy! })).filter((c) => inRoom(c.x, c.y));
      // Prefer a spot to the side of the way in, so the keeper is "by the door" and not in it.
      const side = beside.filter((c) => c.x - entry.x !== entry.x - door.x || c.y - entry.y !== entry.y - door.y);
      const spot = rsh.pick(side.length > 0 ? side : beside);
      const kind = pickShopKind(rsh);
      const keeper = makeMonster(uids, rsh, "shopkeeper", depth, mods, spot.x, spot.y);
      keeper.asleep = false;
      keeper.npc = { kind: "shopkeeper", name: keeperName(rsh, kind), shop: kind, stock: makeStock(uids, rsh, kind, depth, mods), told: 0 };
      level.monsters.push(keeper);
      level.meta.shop = kind;
      level.meta.shopDoor = at(door.x, door.y);
    }
  }

  // ---- priests beside altars, and people with something to say ----
  const rn = stream(run.seed, "npcs", depth);
  const npcShare = scale3(mods["npcs"] ?? 5, 0, 0.5, 1);
  for (const altar of level.features.filter((ft) => ft.kind === "altar")) {
    if (!rn.chance(npcShare)) continue;
    const room = openRooms.find((r) => altar.x >= r.x && altar.x < r.x + r.w && altar.y >= r.y && altar.y < r.y + r.h);
    if (!room) continue;
    const spots = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => ({ x: altar.x + dx!, y: altar.y + dy! }))
      .filter((c) => !used.has(at(c.x, c.y)) && level.tiles[at(c.x, c.y)] === T.FLOOR)
      // Never on a cell that touches a way into the room.
      .filter((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => {
        const nx = c.x + dx!;
        const ny = c.y + dy!;
        const inside = nx >= room.x && nx < room.x + room.w && ny >= room.y && ny < room.y + room.h;
        return inside || level.tiles[at(nx, ny)] === T.WALL;
      }));
    if (spots.length === 0) continue;
    const spot = rn.pick(spots);
    used.add(at(spot.x, spot.y));
    const priest = makeMonster(uids, rn, "priest", depth, mods, spot.x, spot.y);
    priest.asleep = false;
    priest.npc = { kind: "priest", name: "the priest", told: 0 };
    level.monsters.push(priest);
  }
  const talkers = scale3(mods["npcs"] ?? 5, 0, 0.45, 1.4);
  const talkerCount = Math.floor(talkers) + (rn.chance(talkers - Math.floor(talkers)) ? 1 : 0);
  for (let i = 0; i < talkerCount; i++) {
    const spots = featureSpots();
    if (spots.length === 0) break;
    const spot = rn.pick(spots);
    used.add(at(spot.x, spot.y));
    const kind = rn.pick(["hermit", "adventurer", "gnome"] as const);
    const who = makeMonster(uids, rn, kind, depth, mods, spot.x, spot.y);
    who.asleep = false;
    who.npc = { kind, name: kind === "adventurer" ? "the lost adventurer" : `the ${kind}`, told: 0 };
    level.monsters.push(who);
  }

  // ---- torches ----
  for (let y = 1; y < level.h - 1; y++) {
    for (let x = 1; x < level.w - 1; x++) {
      if (level.tiles[at(x, y)] !== T.WALL || level.switches.some((s) => s.x === x && s.y === y)) continue;
      const facesFloor = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)].some((n) => level.tiles[n] === T.FLOOR);
      if (facesFloor && rf.chance(0.06)) level.torches.push(at(x, y));
    }
  }

  const freeIn = (rng: { shuffle<V>(l: V[]): V[] }, cells: Pos[]): Pos | null => {
    for (const c of rng.shuffle(cells.slice())) if (!used.has(at(c.x, c.y)) && level.tiles[at(c.x, c.y)] === T.FLOOR && !level.monsters.some((mo) => mo.peaceful && mo.x === c.x && mo.y === c.y)) return c;
    return null;
  };

  // ---- traps ----
  const rt = stream(run.seed, "traps", depth);
  const floorCells: Pos[] = [];
  const inStart = (x: number, y: number): boolean => x >= startRoom.x && x < startRoom.x + startRoom.w && y >= startRoom.y && y < startRoom.y + startRoom.h;
  const occupied = new Set(level.monsters.map((mo) => at(mo.x, mo.y)));
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) if (level.tiles[at(x, y)] === T.FLOOR && !used.has(at(x, y)) && !inStart(x, y) && !occupied.has(at(x, y))) floorCells.push({ x, y });
  const trapCount = Math.round(floorCells.length * scale3(mods["traps"] ?? 5, 0, 0.012, 0.045));
  // No trapdoors above a special level: those are entered by their stairs.
  const trapPool = TRAPS.filter((t) => t.minDepth <= depth && !(t.kind === "trapdoor" && (depth >= 24 || isSpecialDepth(depth + 1))));
  for (let i = 0; i < trapCount; i++) {
    const c = freeIn(rt, floorCells);
    if (!c) break;
    used.add(at(c.x, c.y));
    const kind = trapPool[rt.weighted(trapPool.map((t) => t.weight))]!.kind;
    level.traps.push({ kind, x: c.x, y: c.y, found: false, armed: true });
  }

  // ---- monsters ----
  const rm = stream(run.seed, "monsters", depth);
  const monsterRooms = openRooms.filter((r) => r.id !== plan.start);
  const taken = new Set<number>(level.monsters.map((mo) => at(mo.x, mo.y)));
  const monsterCount = Math.max(1, Math.round(plan.rooms.length * scale3(mods["monsterCount"] ?? 5, 0.35, 1, 2.3)));
  const placeMonster = (type: string, room: (typeof monsterRooms)[number]): boolean => {
    const cells = rm.shuffle(roomCells(room)).filter((c) => !taken.has(at(c.x, c.y)) && level.tiles[at(c.x, c.y)] === T.FLOOR && !level.features.some((f) => f.x === c.x && f.y === c.y));
    const c = cells[0];
    if (!c) return false;
    taken.add(at(c.x, c.y));
    level.monsters.push(makeMonster(uids, rm, type, depth, mods, c.x, c.y));
    return true;
  };
  let placed = 0;
  for (let tries = 0; placed < monsterCount && tries < monsterCount * 4 && monsterRooms.length > 0; tries++) {
    const type = pickMonsterType(rm, depth);
    const room = rm.pick(monsterRooms);
    const group = type.pack ? rm.range(2, 3) : 1;
    for (let g = 0; g < group; g++) if (placeMonster(type.id, room)) placed++;
  }

  // ---- loot ----
  const rl = stream(run.seed, "loot", depth);
  const lootCount = Math.round(plan.rooms.length * scale3(mods["lootAmount"] ?? 5, 0.2, 0.7, 1.6));
  for (let i = 0; i < lootCount; i++) {
    const c = freeIn(rl, roomCells(rl.pick(openRooms)));
    if (!c) continue;
    level.items.push({ x: c.x, y: c.y, item: rollItem(uids, rl, depth, mods) });
  }
  for (const room of closets) {
    const n = rl.range(2, 3);
    for (let i = 0; i < n; i++) {
      const c = freeIn(rl, roomCells(room));
      if (c) level.items.push({ x: c.x, y: c.y, item: rollItem(uids, rl, depth + 4, mods) });
    }
  }
  const artifactDepth = stream(run.seed, "artifact").range(16, 19);
  if (depth === artifactDepth) {
    const room = closets[0] ?? rl.pick(openRooms);
    const c = freeIn(rl, roomCells(room));
    if (c) {
      const hammer = makeItem(uids, "mjollnir", 1, "B", 2);
      level.items.push({ x: c.x, y: c.y, item: hammer });
    }
  }

  // ---- gold ----
  const rg = stream(run.seed, "gold", depth);
  const goldMod = scale3(mods["gold"] ?? 5, 0.3, 1, 3);
  const piles = Math.round(plan.rooms.length * scale3(mods["gold"] ?? 5, 0.1, 0.45, 1.1));
  for (let i = 0; i < piles + closets.length; i++) {
    const room = i < piles ? rg.pick(openRooms) : closets[i - piles]!;
    const c = freeIn(rg, roomCells(room));
    if (!c) continue;
    used.add(at(c.x, c.y));
    const amount = Math.max(1, Math.round(rg.range(5, 25) * (1 + depth / 3) * goldMod * (i < piles ? 1 : 3)));
    level.items.push({ x: c.x, y: c.y, item: makeItem(uids, "gold", amount) });
  }

  // ---- the vault's gold ----
  if (vault) {
    for (const c of roomCells(vault)) {
      if (!rg.chance(0.75)) continue;
      const amount = Math.max(10, Math.round(rg.range(40, 120) * (1 + depth / 3) * goldMod));
      level.items.push({ x: c.x, y: c.y, item: makeItem(uids, "gold", amount) });
    }
  }

  // ---- gems, and glass ----
  const rj = stream(run.seed, "gems", depth);
  const gemTypes = ITEM_TYPES.filter((t) => t.cls === "gem" && t.minDepth <= depth + 2);
  const gemExpected = scale3(mods["gold"] ?? 5, 0.1, 0.6, 1.6);
  const gemCount = Math.floor(gemExpected) + (rj.chance(gemExpected - Math.floor(gemExpected)) ? 1 : 0);
  const rollGem = (): Item => makeItem(uids, gemTypes[rj.weighted(gemTypes.map((t) => t.freq))]!.id);
  for (let i = 0; i < gemCount; i++) {
    const c = freeIn(rj, roomCells(rj.pick(openRooms)));
    if (c) level.items.push({ x: c.x, y: c.y, item: rollGem() });
  }

  // Chests and graves go in after loot and monsters, so they must not land on either.
  const emptySpots = (): Pos[] => featureSpots().filter((c) => !level.items.some((fi) => fi.x === c.x && fi.y === c.y) && !level.monsters.some((mo) => mo.x === c.x && mo.y === c.y));

  // ---- chests and large boxes ----
  const rc = stream(run.seed, "chests", depth);
  const chestExpected = scale3(mods["gold"] ?? 5, 0.2, 0.7, 1.5);
  const chestCount = Math.floor(chestExpected) + (rc.chance(chestExpected - Math.floor(chestExpected)) ? 1 : 0);
  for (let i = 0; i < chestCount; i++) {
    const spots = emptySpots();
    if (spots.length === 0) break;
    const c = rc.pick(spots);
    used.add(at(c.x, c.y));
    const box = rc.chance(0.25);
    const loot: Item[] = [makeItem(uids, "gold", Math.max(5, Math.round(rc.range(15, 60) * (1 + depth / 3) * goldMod)))];
    const extra = rc.range(1, box ? 3 : 2);
    for (let k = 0; k < extra; k++) loot.push(rollItem(uids, rc, depth + 3, mods));
    if (rc.chance(0.4)) loot.push(rollGem());
    const locked = !box && rc.chance(0.4);
    level.features.push({ kind: "chest", x: c.x, y: c.y, label: box ? "large box" : "chest", locked, trapped: rc.chance(0.2), opened: false, loot });
    // A locked chest's key is somewhere on the level more often than not; otherwise the lid has to be forced.
    if (locked && rc.chance(0.65)) {
      const k = freeIn(rc, roomCells(rc.pick(openRooms)));
      if (k) level.items.push({ x: k.x, y: k.y, item: makeItem(uids, "chest_key") });
    }
  }

  // ---- graves ----
  const rgv = stream(run.seed, "graves", depth);
  if (rgv.chance(0.22)) {
    const spots = emptySpots();
    if (spots.length > 0) {
      const c = rgv.pick(spots);
      used.add(at(c.x, c.y));
      level.features.push({ kind: "grave", x: c.x, y: c.y, text: rgv.pick(EPITAPHS) });
    }
  }

  // ---- the bone key for a door on the next level ----
  if (boneFlag(run.seed, depth) && !isSpecialDepth(depth + 1) && buildLayout(run, depth + 1).plan.boneCloset) {
    const rb = stream(run.seed, "bonekey", depth);
    const c = freeIn(rb, roomCells(rb.pick(openRooms)));
    if (c) {
      level.items.push({ x: c.x, y: c.y, item: makeItem(uids, "key_bone") });
      level.meta.boneKey = true;
    }
  }
}

export function generateLevel(run: RunConfig, depth: number): Level {
  if (isSpecialDepth(depth)) return buildSpecial(run, depth);
  const carved = buildLayout(run, depth);
  populate(run, carved);
  const level = carved.level;
  if (!solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok) {
    // Fixtures and peaceful characters are the only things added after the layout was verified that can block a cell.
    // Loot from chests that are removed is not lost: it lies where the chest stood.
    for (const ft of level.features) for (const it of ft.loot ?? []) level.items.push({ x: ft.x, y: ft.y, item: it });
    level.features = [];
    level.monsters = level.monsters.filter((mo) => !mo.peaceful);
    delete level.meta.shop;
    delete level.meta.shopDoor;
  }
  level.startArea = startArea(level);
  return level;
}
