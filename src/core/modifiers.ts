// Run modifiers. Every modifier is a whole number from 1 to 9, with 5
// as "normal". The seed gives each one a default; the player may
// override any of them. Seed plus overrides is the whole run.

import { Rng, stream } from "./rng.ts";

export interface ModifierDef {
  id: string;
  /** Two letters, used in the run code. */
  code: string;
  name: string;
  help: string;
  low: string;
  high: string;
  /** How much a step above 5 adds to the difficulty rating. Negative makes the run easier. */
  weight: number;
}

export const MOD_MIN = 1;
export const MOD_MAX = 9;
export const MOD_NORMAL = 5;

export const MODIFIERS: readonly ModifierDef[] = [
  { id: "mapSize", code: "ms", name: "Map size", help: "How large each generated level is. The dungeon is always 25 levels deep.", low: "cramped", high: "sprawling", weight: 0.4 },
  { id: "monsterCount", code: "mc", name: "Monster count", help: "How many monsters each level holds.", low: "few", high: "swarming", weight: 1.2 },
  { id: "monsterToughness", code: "mt", name: "Monster toughness", help: "Monster hit points and damage.", low: "frail", high: "brutal", weight: 1.5 },
  { id: "monsterSpeed", code: "mv", name: "Monster speed", help: "How quickly monsters move and attack.", low: "sluggish", high: "frantic", weight: 1.3 },
  { id: "lootAmount", code: "la", name: "Loot amount", help: "How many items lie around.", low: "bare", high: "lavish", weight: -0.8 },
  { id: "lootQuality", code: "lq", name: "Loot quality", help: "How good the items are, and how enchanted.", low: "junk", high: "superb", weight: -0.8 },
  { id: "cursedShare", code: "cs", name: "Cursed items", help: "Share of items that are cursed.", low: "rare", high: "rife", weight: 0.7 },
  { id: "blessedShare", code: "bs", name: "Blessed items", help: "Share of items that are blessed.", low: "rare", high: "common", weight: -0.5 },
  { id: "gold", code: "gd", name: "Gold", help: "How much gold is found. Gold counts toward the score and pays the oracle.", low: "pennies", high: "hoards", weight: -0.2 },
  { id: "puzzles", code: "pz", name: "Puzzles", help: "Locked doors, switches, and pressure plates per level.", low: "open", high: "labyrinthine", weight: 0.5 },
  { id: "traps", code: "tr", name: "Traps", help: "How many traps each level hides.", low: "safe", high: "riddled", weight: 0.7 },
  { id: "fountains", code: "fa", name: "Fountains and altars", help: "How often fountains and altars appear.", low: "dry", high: "blessed", weight: -0.3 },
  { id: "restSafety", code: "rs", name: "Resting safety", help: "How likely rest is to pass undisturbed.", low: "restless", high: "peaceful", weight: -0.7 },
  { id: "unidentified", code: "ui", name: "Unidentified items", help: "Share of magic items whose nature is unknown until used.", low: "labelled", high: "inscrutable", weight: 0.5 },
  { id: "shopFrequency", code: "sf", name: "Shops", help: "How often a level has a shop.", low: "none", high: "bazaar", weight: -0.3 },
  { id: "shopPrices", code: "sp", name: "Shop prices", help: "What shopkeepers charge. What they pay for your goods does not change.", low: "cheap", high: "extortionate", weight: 0.3 },
  { id: "npcs", code: "np", name: "Peaceful folk", help: "How many priests, hermits, and other peaceful characters appear.", low: "deserted", high: "sociable", weight: -0.1 },
];

export type Mods = Record<string, number>;

const BY_ID = new Map(MODIFIERS.map((m) => [m.id, m]));
const BY_CODE = new Map(MODIFIERS.map((m) => [m.code, m]));

export function modifierDef(id: string): ModifierDef {
  const def = BY_ID.get(id);
  if (!def) throw new Error(`unknown modifier ${id}`);
  return def;
}

function clampMod(v: number): number {
  return Math.max(MOD_MIN, Math.min(MOD_MAX, Math.round(v)));
}

/** The value the seed alone gives each modifier. Each has its own stream. */
export function seedMods(seed: string): Mods {
  const mods: Mods = {};
  for (const def of MODIFIERS) {
    const rng: Rng = stream(seed, `mod:${def.id}`);
    // Two dice give a hump around the middle: most seeds are near normal, a few are odd.
    const v = rng.range(0, 4) + rng.range(0, 4) + 1;
    mods[def.id] = clampMod(v);
  }
  // Very large maps make a run long; pull the default down a little. The player can still raise it.
  mods["mapSize"] = clampMod((mods["mapSize"] as number) - 1);
  return mods;
}

export function resolveMods(seed: string, overrides: Mods): Mods {
  const mods = seedMods(seed);
  for (const def of MODIFIERS) {
    const o = overrides[def.id];
    if (typeof o === "number" && Number.isFinite(o)) mods[def.id] = clampMod(o);
  }
  return mods;
}

/** Keep only overrides that are valid and differ from the seed's own value. */
export function cleanOverrides(seed: string, overrides: Mods): Mods {
  const base = seedMods(seed);
  const out: Mods = {};
  for (const def of MODIFIERS) {
    const o = overrides[def.id];
    if (typeof o === "number" && Number.isFinite(o) && clampMod(o) !== base[def.id]) out[def.id] = clampMod(o);
  }
  return out;
}

/** Linear map of a modifier value onto a range: 1 gives lo, 9 gives hi. */
export function scale(v: number, lo: number, hi: number): number {
  return lo + ((clampMod(v) - MOD_MIN) / (MOD_MAX - MOD_MIN)) * (hi - lo);
}

/** As scale, but 5 always gives mid, so "normal" is exact. */
export function scale3(v: number, lo: number, mid: number, hi: number): number {
  const c = clampMod(v);
  if (c <= MOD_NORMAL) return lo + ((c - MOD_MIN) / (MOD_NORMAL - MOD_MIN)) * (mid - lo);
  return mid + ((c - MOD_NORMAL) / (MOD_MAX - MOD_NORMAL)) * (hi - mid);
}

export interface Difficulty {
  /** 0 to 100. */
  score: number;
  label: string;
}

const DIFFICULTY_LABELS: readonly [number, string][] = [
  [20, "A stroll"],
  [38, "Forgiving"],
  [56, "Fair"],
  [72, "Grim"],
  [88, "Cruel"],
  [101, "Hopeless"],
];

export function difficulty(mods: Mods): Difficulty {
  let sum = 0;
  let span = 0;
  for (const def of MODIFIERS) {
    sum += def.weight * ((mods[def.id] ?? MOD_NORMAL) - MOD_NORMAL);
    span += Math.abs(def.weight) * (MOD_MAX - MOD_NORMAL);
  }
  const score = Math.round(Math.max(0, Math.min(100, 50 + (sum / span) * 50)));
  let label = "Fair";
  for (const [limit, name] of DIFFICULTY_LABELS) {
    if (score < limit) {
      label = name;
      break;
    }
  }
  return { score, label };
}

// ---- run codes -------------------------------------------------------

const CODE_PREFIX = "EB1";

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): string | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** A short code holding the seed and every override, e.g. EB1.candle.mc7tr2 */
export function encodeRunCode(seed: string, overrides: Mods): string {
  const clean = cleanOverrides(seed, overrides);
  const seedPart = /^[A-Za-z0-9]+$/.test(seed) ? seed : `~${toBase64Url(seed)}`;
  let mods = "";
  for (const def of MODIFIERS) {
    const o = clean[def.id];
    if (o !== undefined) mods += `${def.code}${o}`;
  }
  return mods ? `${CODE_PREFIX}.${seedPart}.${mods}` : `${CODE_PREFIX}.${seedPart}`;
}

export function decodeRunCode(code: string): { seed: string; overrides: Mods } | null {
  const parts = code.trim().split(".");
  if (parts.length < 2 || parts.length > 3 || parts[0] !== CODE_PREFIX) return null;
  const rawSeed = parts[1] as string;
  let seed: string | null;
  if (rawSeed.startsWith("~")) seed = fromBase64Url(rawSeed.slice(1));
  else seed = /^[A-Za-z0-9]+$/.test(rawSeed) ? rawSeed : null;
  if (seed === null || seed.length === 0) return null;
  const overrides: Mods = {};
  const modPart = parts[2] ?? "";
  if (modPart.length % 3 !== 0) return null;
  for (let i = 0; i < modPart.length; i += 3) {
    const def = BY_CODE.get(modPart.slice(i, i + 2));
    const value = Number(modPart[i + 2]);
    if (!def || !Number.isInteger(value) || value < MOD_MIN || value > MOD_MAX) return null;
    overrides[def.id] = value;
  }
  return { seed, overrides: cleanOverrides(seed, overrides) };
}

const SEED_WORDS_A = ["ashen", "bitter", "cold", "damp", "ember", "faint", "grim", "hollow", "iron", "lost", "mute", "pale", "quiet", "rusted", "sunken", "tallow", "umber", "weary"];
const SEED_WORDS_B = ["altar", "bell", "candle", "door", "ember", "ferry", "gate", "hinge", "idol", "key", "lantern", "moat", "niche", "oath", "pit", "quarry", "rope", "stair", "tomb", "vault", "well"];

/** A readable random seed. Uses the clock, so it is the one place that is not reproducible. */
export function randomSeed(entropy: number): string {
  const rng = Rng.fromString(`seed:${entropy}`);
  return `${rng.pick(SEED_WORDS_A)}${rng.pick(SEED_WORDS_B)}${rng.range(10, 99)}`;
}
