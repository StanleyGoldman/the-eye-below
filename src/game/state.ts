// The game state and the helpers everything else builds on: new game,
// messages, random numbers, statuses, equipment, inventory, experience,
// damage, and death. No DOM.

import { resolveMods, scale3 } from "../core/modifiers.ts";
import type { Mods } from "../core/modifiers.ts";
import { Rng, stream } from "../core/rng.ts";
import { generateLevel } from "../dungeon/generate.ts";
import { featureAt, isOpenCell } from "../dungeon/grid.ts";
import { APPEARANCES, ITEM_TYPES, isMagicClass, itemName, itemType } from "./data/items.ts";
import type { Knowledge } from "./data/items.ts";
import { monsterType } from "./data/monsters.ts";
import { MAX_LEVEL, XP_FOR_LEVEL, roleDef } from "./data/roles.ts";
import { makeItem, makeMonster, rollItem } from "./factory.ts";
import type { UidSource } from "./factory.ts";
import { DX, DY, PERMANENT, STATUS_IDS } from "./types.ts";
import type { Buc, Dir, EquipSlot, GameEvent, GameState, Item, ItemClass, Level, Monster, MsgKind, Player, Pos, RoleId, StatusId } from "./types.ts";

export const SAVE_VERSION = 1;
const LOG_LIMIT = 200;
const INVENTORY_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// ---- random numbers ---------------------------------------------------

const liveRng = new WeakMap<GameState, Rng>();

/** The run-time random stream. Its state is written back with syncRng before saving. */
export function rng(state: GameState): Rng {
  let r = liveRng.get(state);
  if (!r) {
    r = new Rng(state.rng);
    liveRng.set(state, r);
  }
  return r;
}

export function syncRng(state: GameState): void {
  const r = liveRng.get(state);
  if (r) state.rng = r.state();
}

// ---- messages and events ---------------------------------------------

export function say(state: GameState, text: string, kind: MsgKind = "info"): void {
  const last = state.log[state.log.length - 1];
  if (last && last.text === text && state.time - last.t < 1500) return;
  state.log.push({ t: state.time, text, kind });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

export function emit(state: GameState, event: GameEvent): void {
  if (state.events.length < 200) state.events.push(event);
}

// ---- level access -----------------------------------------------------

export function cur(state: GameState): Level {
  return state.levels[state.depth] as Level;
}

export function ensureLevel(state: GameState, depth: number): Level {
  let level = state.levels[depth];
  if (!level) {
    level = generateLevel(state.run, depth);
    state.levels[depth] = level;
  }
  return level;
}

export function monsterAt(level: Level, x: number, y: number): Monster | undefined {
  for (const m of level.monsters) if (m.x === x && m.y === y && m.hp > 0) return m;
  return undefined;
}

export function facing(state: GameState, dir: Dir = state.player.dir): Pos {
  return { x: state.player.x + (DX[dir] as number), y: state.player.y + (DY[dir] as number) };
}

/** A cell the player or a monster could stand in right now. */
export function isFree(state: GameState, level: Level, x: number, y: number): boolean {
  if (!isOpenCell(level, x, y)) return false;
  if (monsterAt(level, x, y)) return false;
  return !(level === cur(state) && state.player.x === x && state.player.y === y);
}

// ---- knowledge --------------------------------------------------------

export function knowledge(state: GameState): Knowledge {
  return state;
}

export function nameOf(state: GameState, item: Item, withArticle = true): string {
  return itemName(state, item, withArticle);
}

/** Learn what an item type is. Returns true if this was news. */
export function discover(state: GameState, typeId: string): boolean {
  const type = itemType(typeId);
  if (!isMagicClass(type.cls) || state.discovered[typeId]) return false;
  state.discovered[typeId] = true;
  return true;
}

// ---- statuses ---------------------------------------------------------

export function wornItem(p: Player, slot: EquipSlot): Item | undefined {
  for (const it of p.inventory) if (it.slot === slot) return it;
  return undefined;
}

export function wearing(p: Player, typeId: string): boolean {
  for (const it of p.inventory) if (it.slot && it.type === typeId) return true;
  return false;
}

/** Remaining milliseconds of a status, counting what worn rings grant. */
export function statusLeft(state: GameState, id: StatusId): number {
  const p = state.player;
  if (id === "invisible" && wearing(p, "ring_invisibility")) return PERMANENT;
  if (id === "seeInvisible" && wearing(p, "ring_see_invisible")) return PERMANENT;
  return p.statuses[id] ?? 0;
}

export function has(state: GameState, id: StatusId): boolean {
  return statusLeft(state, id) > 0;
}

export function activeStatuses(state: GameState): { id: StatusId; left: number }[] {
  const out: { id: StatusId; left: number }[] = [];
  for (const id of STATUS_IDS) {
    const left = statusLeft(state, id);
    if (left > 0) out.push({ id, left });
  }
  return out;
}

export function reflects(state: GameState): boolean {
  return wearing(state.player, "amulet_reflection");
}

export function freeAction(state: GameState): boolean {
  return wearing(state.player, "ring_free_action");
}

const STATUS_START: Record<StatusId, string> = {
  confused: "",
  stunned: "You stagger.",
  blind: "",
  hallucinating: "",
  asleep: "",
  paralyzed: "You cannot move.",
  levitating: "",
  fast: "",
  slowed: "You feel yourself slowing down.",
  invisible: "You can no longer see your hands.",
  seeInvisible: "",
};

const STATUS_END: Record<StatusId, string> = {
  confused: "You feel less confused now.",
  stunned: "You feel steadier now.",
  blind: "You can see again.",
  hallucinating: "Everything looks so boring now.",
  asleep: "You wake up.",
  paralyzed: "You can move again.",
  levitating: "You float gently to the floor.",
  fast: "You feel yourself slowing down.",
  slowed: "You feel yourself speeding up.",
  invisible: "Your hands fade back into view.",
  seeInvisible: "Your vision narrows to the ordinary.",
};

/**
 * Give the player a status for a number of seconds (or PERMANENT).
 * Returns false when something they wear stops it.
 */
export function addStatus(state: GameState, id: StatusId, seconds: number, quiet = false): boolean {
  const p = state.player;
  if ((id === "asleep" || id === "paralyzed") && freeAction(state)) {
    say(state, id === "asleep" ? "You yawn. Your ring keeps you on your feet." : "You stiffen for a moment. Your ring keeps you moving.", "good");
    discover(state, "ring_free_action");
    return false;
  }
  const ms = seconds >= PERMANENT ? PERMANENT : Math.round(seconds * 1000);
  const before = p.statuses[id] ?? 0;
  p.statuses[id] = before >= PERMANENT || ms >= PERMANENT ? PERMANENT : Math.max(before, ms);
  if (before <= 0 && !quiet && STATUS_START[id]) say(state, STATUS_START[id], "bad");
  if (id === "asleep" || id === "paralyzed") {
    p.resting = false;
  }
  return true;
}

export function cure(state: GameState, id: StatusId, quiet = false): boolean {
  const p = state.player;
  if ((p.statuses[id] ?? 0) <= 0) return false;
  delete p.statuses[id];
  if (!quiet && statusLeft(state, id) <= 0) say(state, STATUS_END[id], id === "fast" || id === "levitating" || id === "invisible" || id === "seeInvisible" ? "info" : "good");
  return true;
}

/** Count statuses down by a slice of game time. */
export function tickStatuses(state: GameState, ms: number): void {
  const p = state.player;
  for (const id of STATUS_IDS) {
    const left = p.statuses[id];
    if (left === undefined || left >= PERMANENT) continue;
    if (left - ms <= 0) {
      delete p.statuses[id];
      if (statusLeft(state, id) <= 0) say(state, STATUS_END[id], id === "fast" ? "bad" : "info");
    } else {
      p.statuses[id] = left - ms;
    }
  }
}

/** Awake, unparalyzed, not busy, alive, and not being asked a question. */
export function canAct(state: GameState): boolean {
  if (state.dead || state.won || state.prompt) return false;
  if (has(state, "asleep") || has(state, "paralyzed")) return false;
  return state.time >= state.player.busyUntil;
}

/** Why the player cannot act, for the log. */
export function whyNot(state: GameState): string {
  if (has(state, "asleep")) return "You are asleep.";
  if (has(state, "paralyzed")) return "You cannot move.";
  if (state.time < state.player.busyUntil) return state.player.busyText || "You are busy.";
  return "";
}

/** Multiplier on the player's delays: under 1 is quicker. */
export function speedFactor(state: GameState): number {
  let f = 1;
  if (has(state, "fast")) f *= 0.65;
  if (has(state, "slowed")) f *= 1.6;
  return f;
}

// ---- equipment and armor class ---------------------------------------

export function armorClass(state: GameState): number {
  const p = state.player;
  let ac = 10 - p.protection;
  for (const it of p.inventory) {
    if (!it.slot) continue;
    const type = itemType(it.type);
    if (type.armor) ac -= type.armor.ac + it.ench;
    if (type.id === "ring_protection") ac -= it.ench;
  }
  return ac;
}

/** Added to spell failure by what is worn. */
export function armorSpellPenalty(p: Player): number {
  let total = 0;
  for (const it of p.inventory) {
    if (!it.slot) continue;
    const type = itemType(it.type);
    if (type.armor) total += type.armor.spellPenalty;
  }
  return total;
}

export function toHitBonus(p: Player): number {
  const { st, dx } = p.stats;
  let b = 0;
  if (st < 6) b -= 2;
  else if (st < 8) b -= 1;
  else if (st >= 17) b += 1;
  if (dx < 4) b -= 3;
  else if (dx < 6) b -= 2;
  else if (dx < 8) b -= 1;
  else if (dx >= 14) b += Math.min(4, dx - 14);
  return b;
}

export function damageBonus(p: Player): number {
  const st = p.stats.st;
  if (st < 6) return -1;
  if (st < 16) return 0;
  if (st < 18) return 1;
  if (st === 18) return 2;
  return 3;
}

// ---- inventory --------------------------------------------------------

export function findItem(state: GameState, uid: number): Item | undefined {
  return state.player.inventory.find((it) => it.uid === uid);
}

function canStack(a: Item, b: Item): boolean {
  if (a.type !== b.type || !itemType(a.type).stack) return false;
  return a.buc === b.buc && a.ench === b.ench && a.known === b.known && a.bucKnown === b.bucKnown && a.proof === b.proof && !a.slot && !b.slot;
}

function freeLetter(p: Player, preferred: string): string {
  const taken = new Set(p.inventory.map((it) => it.letter));
  if (preferred && !taken.has(preferred)) return preferred;
  for (const ch of INVENTORY_LETTERS) if (!taken.has(ch)) return ch;
  return "";
}

/** Put an item in the pack, merging stacks. Returns the pack item, or null if the pack is full. */
export function addToPack(state: GameState, item: Item): Item | null {
  const p = state.player;
  if (itemType(item.type).cls === "gold") {
    p.gold += item.qty;
    return item;
  }
  for (const other of p.inventory) {
    if (canStack(other, item)) {
      other.qty += item.qty;
      return other;
    }
  }
  const letter = freeLetter(p, item.letter);
  if (!letter) return null;
  item.letter = letter;
  item.slot = null;
  p.inventory.push(item);
  sortPack(p);
  return item;
}

const CLASS_RANK: Record<ItemClass, number> = { weapon: 0, armor: 1, potion: 2, scroll: 3, spellbook: 4, wand: 5, ring: 6, amulet: 7, tool: 8, gold: 9 };

function sortPack(p: Player): void {
  p.inventory.sort((a, b) => {
    const ca = CLASS_RANK[itemType(a.type).cls];
    const cb = CLASS_RANK[itemType(b.type).cls];
    if (ca !== cb) return ca - cb;
    return INVENTORY_LETTERS.indexOf(a.letter) - INVENTORY_LETTERS.indexOf(b.letter);
  });
}

/** Take some of a stack out of the pack. Returns the item removed (a new item when splitting). */
export function takeFromPack(state: GameState, item: Item, qty = item.qty): Item {
  const p = state.player;
  if (qty >= item.qty) {
    const i = p.inventory.indexOf(item);
    if (i >= 0) p.inventory.splice(i, 1);
    item.slot = null;
    return item;
  }
  item.qty -= qty;
  return { ...item, uid: state.nextUid++, qty, slot: null };
}

/** Use up one of a stack. */
export function consume(state: GameState, item: Item): void {
  takeFromPack(state, item, 1);
}

export function dropAt(level: Level, x: number, y: number, item: Item): void {
  item.slot = null;
  level.items.push({ x, y, item });
}

export function itemsAt(level: Level, x: number, y: number): Item[] {
  const out: Item[] = [];
  for (const fi of level.items) if (fi.x === x && fi.y === y) out.push(fi.item);
  return out;
}

export function countKeys(p: Player, color: string): Item | undefined {
  return p.inventory.find((it) => it.type === `key_${color}`);
}

// ---- things made during play ------------------------------------------

/** A new item with an id from the run's own counter. */
export function mintItem(state: GameState, type: string, qty = 1, buc: Buc = "U", ench = 0): Item {
  const src: UidSource = { next: state.nextUid };
  const item = makeItem(src, type, qty, buc, ench);
  state.nextUid = src.next;
  return item;
}

export function mintRandomItem(state: GameState, depth: number, cls?: ItemClass): Item {
  const src: UidSource = { next: state.nextUid };
  const item = rollItem(src, rng(state), depth, state.run.mods, cls);
  state.nextUid = src.next;
  return item;
}

export function mintMonster(state: GameState, typeId: string, x: number, y: number): Monster {
  const src: UidSource = { next: state.nextUid };
  const m = makeMonster(src, rng(state), typeId, state.depth, state.run.mods, x, y);
  state.nextUid = src.next;
  return m;
}

// ---- experience -------------------------------------------------------

function conBonus(p: Player): number {
  const co = p.stats.co;
  if (co < 7) return -1;
  if (co >= 17) return 2;
  if (co >= 15) return 1;
  return 0;
}

export function levelUp(state: GameState): void {
  const p = state.player;
  if (p.xl >= MAX_LEVEL) return;
  const role = roleDef(p.role);
  const r = rng(state);
  p.xl++;
  const hpGain = Math.max(1, r.rnd(role.hpDie) + role.hpBonus + conBonus(p));
  const pwGain = Math.max(1, r.rnd(role.pwDie) + role.pwBonus + (p.stats.in >= 16 ? 1 : 0));
  p.maxHp += hpGain;
  p.hp += hpGain;
  p.maxPw += pwGain;
  p.pw += pwGain;
  if (p.xp < (XP_FOR_LEVEL[p.xl] as number)) p.xp = XP_FOR_LEVEL[p.xl] as number;
  say(state, `Welcome to experience level ${p.xl}.`, "good");
  emit(state, { kind: "levelup" });
}

export function gainXp(state: GameState, amount: number): void {
  const p = state.player;
  p.xp += Math.max(0, Math.round(amount));
  while (p.xl < MAX_LEVEL && p.xp >= (XP_FOR_LEVEL[p.xl + 1] as number)) levelUp(state);
}

export function loseLevel(state: GameState, cause: string): void {
  const p = state.player;
  const role = roleDef(p.role);
  const r = rng(state);
  // The invulnerability debug option covers death by attrition too.
  if (state.debug.god) return;
  say(state, "You feel your life force draining away.", "danger");
  if (p.xl <= 1) {
    hurt(state, r.rnd(8), cause);
    return;
  }
  p.xl--;
  p.maxHp = Math.max(p.xl * 2, p.maxHp - r.rnd(role.hpDie) - role.hpBonus);
  p.hp = Math.min(p.hp, p.maxHp);
  p.maxPw = Math.max(1, p.maxPw - r.rnd(role.pwDie) - role.pwBonus);
  p.pw = Math.min(p.pw, p.maxPw);
  p.xp = XP_FOR_LEVEL[p.xl] as number;
}

// ---- damage and death -------------------------------------------------

export function hurt(state: GameState, amount: number, cause: string): void {
  if (state.dead || state.won) return;
  const p = state.player;
  const dmg = Math.max(0, Math.round(amount));
  if (dmg === 0) return;
  p.hp -= dmg;
  p.resting = false;
  p.hurtFlashUntil = state.time + 260;
  emit(state, { kind: "hurt", amount: dmg });
  if (p.hp <= 0) die(state, cause);
}

export function die(state: GameState, cause: string): void {
  if (state.dead || state.won) return;
  const p = state.player;
  if (state.debug.god) {
    p.hp = p.maxHp;
    p.stoning = 0;
    p.strangling = 0;
    p.stoneStage = 0;
    return;
  }
  const saver = wornItem(p, "amulet");
  if (saver && saver.type === "amulet_life_saving") {
    say(state, "But wait. Your amulet grows warm, then crumbles to dust. You are not dead after all.", "good");
    discover(state, "amulet_life_saving");
    takeFromPack(state, saver);
    p.hp = p.maxHp;
    p.stoning = 0;
    p.strangling = 0;
    p.stoneStage = 0;
    return;
  }
  p.hp = Math.min(p.hp, 0);
  p.resting = false;
  state.dead = true;
  state.cause = cause;
  state.prompt = null;
  say(state, "You die.", "danger");
}

export function heal(state: GameState, amount: number): void {
  const p = state.player;
  p.hp = Math.min(p.maxHp, p.hp + Math.max(0, Math.round(amount)));
}

// ---- score ------------------------------------------------------------

export interface ScoreLine {
  label: string;
  points: number;
}

export function score(state: GameState): { total: number; lines: ScoreLine[] } {
  const p = state.player;
  const lines: ScoreLine[] = [
    { label: `Experience (${p.xp} points, level ${p.xl})`, points: p.xp * 4 },
    { label: `Gold carried (${p.gold})`, points: p.gold },
    { label: `Deepest level reached (${p.deepest})`, points: 50 * (p.deepest - 1) + 1000 * Math.max(0, p.deepest - 20) },
  ];
  if (state.won) lines.push({ label: "The Unblinking Eye, recovered", points: 25000 });
  if (state.peacefulsKilled > 0) lines.push({ label: `Peaceful creatures killed (${state.peacefulsKilled})`, points: -500 * state.peacefulsKilled });
  let total = 0;
  for (const l of lines) total += l.points;
  return { total: Math.max(0, total), lines };
}

// ---- new game ---------------------------------------------------------

export interface NewGameOptions {
  seed: string;
  overrides?: Mods;
  role: RoleId;
  name?: string;
  god?: boolean;
  /** Start on this level instead of level 1 (debugging and the scripted checks). */
  startDepth?: number;
}

function shuffledAppearances(seed: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cls of Object.keys(APPEARANCES) as ItemClass[]) {
    const pool = APPEARANCES[cls];
    if (!pool) continue;
    const order = stream(seed, `appearance:${cls}`).shuffle(pool.map((_, i) => i));
    let n = 0;
    for (const t of ITEM_TYPES) {
      if (t.cls !== cls || t.artifact) continue;
      out[t.id] = order[n % order.length] as number;
      n++;
    }
  }
  return out;
}

export function newGame(options: NewGameOptions): GameState {
  const overrides = options.overrides ?? {};
  const mods = resolveMods(options.seed, overrides);
  const role = roleDef(options.role);
  const runtime = stream(options.seed, `runtime:${options.role}`);

  const player: Player = {
    name: options.name && options.name.trim() ? options.name.trim().slice(0, 16) : role.name,
    role: role.id,
    x: 1,
    y: 1,
    dir: 0,
    px: 1,
    py: 1,
    movedAt: -10000,
    pdir: 0,
    turnedAt: -10000,
    hp: role.hp,
    maxHp: role.hp,
    pw: role.pw,
    maxPw: role.pw,
    xl: 1,
    xp: 0,
    stats: { ...role.stats },
    gold: 0,
    luck: 0,
    protection: 0,
    inventory: [],
    spells: role.knownSpells.slice(),
    statuses: {},
    stepReady: 0,
    mainReady: 0,
    offReady: 0,
    castReady: 0,
    mainCooldown: 0,
    offCooldown: 0,
    busyUntil: 0,
    busyText: "",
    resting: false,
    stoning: 0,
    strangling: 0,
    prayerReady: 300000,
    regenCarry: 0,
    pwCarry: 0,
    litUntil: 0,
    detectUntil: 0,
    nextRingTeleport: 0,
    stoneStage: 0,
    kills: 0,
    deepest: 1,
    hurtFlashUntil: 0,
  };

  // Which magic item types are already known at the start.
  const unknownShare = scale3(mods["unidentified"] ?? 5, 0.3, 0.85, 1);
  const rk = stream(options.seed, "knowledge");
  const discovered: Record<string, boolean> = {};
  for (const t of ITEM_TYPES) {
    const roll = rk.next();
    if (isMagicClass(t.cls) && !t.artifact && roll >= unknownShare) discovered[t.id] = true;
  }

  const state: GameState = {
    version: SAVE_VERSION,
    run: { seed: options.seed, mods },
    overrides: { ...overrides },
    time: 0,
    depth: 1,
    levels: {},
    player,
    log: [],
    rng: runtime.state(),
    discovered,
    appearance: shuffledAppearances(options.seed),
    nextUid: 50_000_000,
    prompt: null,
    events: [],
    dead: false,
    won: false,
    cause: "",
    peacefulsKilled: 0,
    oracleTold: [],
    debug: { god: options.god === true },
    stats: { steps: 0, potions: 0, scrolls: 0, spellsCast: 0, prayers: 0 },
  };

  // Starting kit: identified, never cursed.
  const uids: UidSource = { next: state.nextUid };
  const kitRng = stream(options.seed, `kit:${options.role}`);
  for (const entry of role.kit) {
    const count = entry.cls ? (entry.qty ?? 1) : 1;
    for (let i = 0; i < count; i++) {
      let item: Item;
      if (entry.type) {
        item = makeItem(uids, entry.type, entry.qty ?? 1, "U", entry.ench ?? 0);
      } else {
        item = rollItem(uids, kitRng, 1, mods, entry.cls);
        if (item.buc === "C") item.buc = "U";
        if (item.ench < 0) item.ench = 0;
      }
      item.known = true;
      item.bucKnown = true;
      state.discovered[item.type] = true;
      const packed = addToPack(state, item);
      if (packed && entry.equip) packed.slot = entry.equip;
    }
  }
  state.nextUid = uids.next;

  const depth = Math.max(1, Math.min(25, options.startDepth ?? 1));
  state.depth = depth;
  player.deepest = depth;
  const level = ensureLevel(state, depth);
  placeAt(state, level.up.x, level.up.y);
  for (let d = 0; d < 4; d++) {
    if (isOpenCell(level, level.up.x + (DX[d] as number), level.up.y + (DY[d] as number))) {
      player.dir = d as Dir;
      player.pdir = player.dir;
      break;
    }
  }
  say(state, `You are ${player.name} the ${role.name}. ${roleLine(role.id)}`, "system");
  say(state, "The Guild of Honest Recovery wants the Unblinking Eye. It is 25 levels down, and its owner is using it.", "system");
  if (depth > 1) say(state, `You start on level ${depth}: ${level.name}.`, "system");
  return state;
}

function roleLine(role: RoleId): string {
  if (role === "valkyrie") return "The cellar door closes behind you with a sound like a verdict.";
  if (role === "wizard") return "You have read about dungeons. This one smells worse than the books said.";
  return "Nobody saw you come in. Nobody will see you leave, one way or the other.";
}

/** Put the player on a cell with no tween. */
export function placeAt(state: GameState, x: number, y: number): void {
  const p = state.player;
  p.x = x;
  p.y = y;
  p.px = x;
  p.py = y;
  p.movedAt = -10000;
}

export function monsterName(m: Monster): string {
  return monsterType(m.type).name;
}

/** "the jackal" or "Medusa". */
export function theMonster(m: Monster): string {
  const t = monsterType(m.type);
  return t.boss ? t.name : `the ${t.name}`;
}

export function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Is there a fountain, altar, or statue in this cell? */
export function fixtureAt(level: Level, x: number, y: number): string {
  const f = featureAt(level, x, y);
  return f ? f.kind : "";
}
