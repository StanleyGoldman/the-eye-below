// Shared types for the dungeon and the game state. No DOM, no logic.

import type { Mods } from "../core/modifiers.ts";
import type { RngState } from "../core/rng.ts";

// ---- geometry ---------------------------------------------------------

/** 0 north, 1 east, 2 south, 3 west. */
export type Dir = 0 | 1 | 2 | 3;
export const DX: readonly number[] = [0, 1, 0, -1];
export const DY: readonly number[] = [-1, 0, 1, 0];
export const DIR_NAMES: readonly string[] = ["north", "east", "south", "west"];

export interface Pos {
  x: number;
  y: number;
}

// ---- tiles ------------------------------------------------------------

export const T = {
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
  GATE: 3,
  WATER: 4,
  STAIRS_UP: 5,
  STAIRS_DOWN: 6,
  PIT: 7,
} as const;

export type KeyColor = "red" | "green" | "blue" | "brass" | "bone";
export const KEY_COLORS: readonly KeyColor[] = ["red", "green", "blue", "brass"];

export interface Door {
  id: number;
  x: number;
  y: number;
  /** True when travel through the door runs north-south. */
  vertical: boolean;
  /** Null for a plain door that needs no key. */
  color: KeyColor | null;
  locked: boolean;
  open: boolean;
}

export type GateKind = "portcullis" | "drawbridge";
export type GateOpener = "switch" | "plate" | "boss";

export interface Gate {
  id: number;
  kind: GateKind;
  cells: Pos[];
  vertical: boolean;
  open: boolean;
  opener: GateOpener;
}

export interface Switch {
  id: number;
  /** The wall cell the switch is mounted on. */
  x: number;
  y: number;
  /** The gate it opens, or -1 for the boulder reset lever. */
  gate: number;
  on: boolean;
  kind: "switch" | "reset";
}

export interface Plate {
  id: number;
  x: number;
  y: number;
  gate: number;
  pressed: boolean;
}

export type FeatureKind = "fountain" | "altar" | "statue" | "boulder";

export interface Feature {
  kind: FeatureKind;
  x: number;
  y: number;
  /** Statues carry an inscription; fountains count remaining uses. */
  text?: string;
  uses?: number;
}

export type TrapKind = "dart" | "pit" | "gas" | "teleport" | "trapdoor" | "squeak" | "rust" | "flash";

export interface Trap {
  kind: TrapKind;
  x: number;
  y: number;
  found: boolean;
  /** Some traps are spent after one use. */
  armed: boolean;
}

export type SpecialId = "oracle" | "stoneyard" | "gorgon" | "keep" | "tower";

export interface Level {
  depth: number;
  w: number;
  h: number;
  name: string;
  special: SpecialId | null;
  tiles: number[];
  doors: Door[];
  gates: Gate[];
  switches: Switch[];
  plates: Plate[];
  features: Feature[];
  traps: Trap[];
  /** Wall cells that carry a torch (decoration and light). */
  torches: number[];
  items: FloorItem[];
  monsters: Monster[];
  up: Pos;
  /** Null on the last level. */
  down: Pos | null;
  /** Cells that can be walked to from the up stairs before any lock is opened. Safe arrival area. */
  startArea: number[];
  /** Automap memory, 1 for every cell that has been seen. */
  seen: number[];
  /** Where boulders and pits start, so the Stoneyard can be reset. */
  boulderStart?: Pos[];
  pitStart?: Pos[];
  /** A known solution to the boulder puzzle as a list of step directions, for the bot and the tests. */
  boulderSolution?: Dir[];
  /** Generation notes used by tests and the level dump. */
  meta: LevelMeta;
}

export interface LevelMeta {
  rooms: number;
  locks: number;
  closets: number;
  attempts: number;
  /** Set when this level carries the bone key for a door on the next one. */
  boneKey: boolean;
  boneDoor: boolean;
}

// ---- items ------------------------------------------------------------

export type ItemClass = "weapon" | "armor" | "potion" | "scroll" | "spellbook" | "wand" | "ring" | "amulet" | "tool" | "gold";
export type Buc = "B" | "U" | "C";
export type EquipSlot = "main" | "off" | "body" | "helm" | "boots" | "cloak" | "ringL" | "ringR" | "amulet";

export interface Item {
  uid: number;
  type: string;
  qty: number;
  buc: Buc;
  ench: number;
  charges: number;
  /** Rustproofed: acid and rust cannot lower its enchantment. */
  proof: boolean;
  /** Enchantment or charges are known. */
  known: boolean;
  bucKnown: boolean;
  letter: string;
  slot: EquipSlot | null;
  /** A scare monster scroll that has been picked up once turns to dust the second time. */
  handled?: boolean;
}

export interface FloorItem {
  x: number;
  y: number;
  item: Item;
}

// ---- monsters ---------------------------------------------------------

export interface Monster {
  uid: number;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  peaceful: boolean;
  asleep: boolean;
  /** Game times (ms). Zero means "not in effect". */
  sleepUntil: number;
  heldUntil: number;
  fleeUntil: number;
  nextMove: number;
  nextAttack: number;
  nextRanged: number;
  /** A melee or ranged attack that has been started and will land at this time. */
  windupUntil: number;
  windupKind: "" | "melee" | "ranged";
  aware: boolean;
  /** Has already risen once (trolls). */
  revived: boolean;
  /** Dies at this time and rises again unless burned (trolls). */
  reviveAt: number;
  gold: number;
  /** Previous cell and the time the move started, for tweening. */
  px: number;
  py: number;
  movedAt: number;
  attackAnimUntil: number;
  hitFlashUntil: number;
  /** Morvane's phase counter and similar per-monster memory. */
  memory: number;
}

// ---- statuses ---------------------------------------------------------

export type StatusId = "confused" | "stunned" | "blind" | "hallucinating" | "asleep" | "paralyzed" | "levitating" | "fast" | "slowed" | "invisible" | "seeInvisible";

export const STATUS_IDS: readonly StatusId[] = ["confused", "stunned", "blind", "hallucinating", "asleep", "paralyzed", "levitating", "fast", "slowed", "invisible", "seeInvisible"];

/** Remaining milliseconds; PERMANENT for statuses that do not time out. */
export const PERMANENT = 1e12;

// ---- player -----------------------------------------------------------

export type RoleId = "valkyrie" | "wizard" | "rogue";

export interface Stats {
  st: number;
  dx: number;
  co: number;
  in: number;
  wi: number;
  ch: number;
}

export interface Player {
  name: string;
  role: RoleId;
  x: number;
  y: number;
  dir: Dir;
  /** Previous cell and facing with the time the move or turn began, for tweening. */
  px: number;
  py: number;
  movedAt: number;
  pdir: Dir;
  turnedAt: number;
  hp: number;
  maxHp: number;
  pw: number;
  maxPw: number;
  xl: number;
  xp: number;
  stats: Stats;
  gold: number;
  luck: number;
  /** Bonus to armor class bought or granted (session 2 priests add to it). */
  protection: number;
  inventory: Item[];
  spells: string[];
  statuses: Partial<Record<StatusId, number>>;
  /** Game times (ms) at which each thing becomes available again. */
  stepReady: number;
  mainReady: number;
  offReady: number;
  castReady: number;
  /** Duration of the cooldown last started on each hand, for drawing the greyed-out hand. */
  mainCooldown: number;
  offCooldown: number;
  busyUntil: number;
  busyText: string;
  resting: boolean;
  /** Time left before turning fully to stone; zero when not petrifying. */
  stoning: number;
  strangling: number;
  prayerReady: number;
  regenCarry: number;
  pwCarry: number;
  /** Game times (ms) until which the light and detect-monsters spells last, and when a teleport ring next fires. */
  litUntil: number;
  detectUntil: number;
  nextRingTeleport: number;
  /** Stage of petrification already announced, so each warning is given once. */
  stoneStage: number;
  kills: number;
  deepest: number;
  hurtFlashUntil: number;
}

// ---- messages, prompts, events ---------------------------------------

export type MsgKind = "info" | "good" | "bad" | "danger" | "loot" | "npc" | "system";

export interface Msg {
  t: number;
  text: string;
  kind: MsgKind;
}

/** Something the interface must ask before the game continues. */
export interface PromptOption {
  id: string;
  label: string;
  hint?: string;
}

export type Prompt =
  | { kind: "menu"; title: string; context: "attackPeaceful" | "fountain" | "altar" | "oracle" | "dip"; options: PromptOption[]; target: number }
  | { kind: "pick"; title: string; purpose: "identify"; count: number };

/** Transient things for the renderer and HUD to show; drained every frame. */
export type GameEvent =
  | { kind: "hit"; monster: number; amount: number }
  | { kind: "miss"; monster: number }
  | { kind: "hurt"; amount: number }
  | { kind: "locked"; color: string }
  | { kind: "bump" }
  | { kind: "ray"; color: string; cells: Pos[] }
  | { kind: "flash"; color: string }
  | { kind: "levelup" }
  | { kind: "step" }
  | { kind: "descend" }
  | { kind: "sound"; id: string };

export interface RunConfig {
  seed: string;
  mods: Mods;
}

export interface DebugFlags {
  /** The player cannot die. For the scripted victory check only. */
  god: boolean;
}

export interface GameState {
  version: number;
  run: RunConfig;
  overrides: Mods;
  time: number;
  depth: number;
  levels: Record<number, Level>;
  player: Player;
  log: Msg[];
  rng: RngState;
  /** Item types whose nature the player has learned. */
  discovered: Record<string, boolean>;
  /** Shuffled appearance index for every magic item type. */
  appearance: Record<string, number>;
  nextUid: number;
  prompt: Prompt | null;
  events: GameEvent[];
  dead: boolean;
  won: boolean;
  cause: string;
  peacefulsKilled: number;
  /** Things the oracle has already told this run, so it does not repeat itself. */
  oracleTold: string[];
  debug: DebugFlags;
  /** Counts for the end screens. */
  stats: { steps: number; potions: number; scrolls: number; spellsCast: number; prayers: number; doors: number };
}
