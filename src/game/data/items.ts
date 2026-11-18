// Item types, shuffled appearances, and naming. Pure data and pure functions.

import type { EquipSlot, Item, ItemClass, KeyColor } from "../types.ts";

export interface WeaponData {
  dice: [number, number];
  bonus: number;
  toHit: number;
  twoHanded: boolean;
  /** Milliseconds between swings. */
  cooldown: number;
  throwable: boolean;
  launcher: boolean;
  ammo: boolean;
}

export interface ArmorData {
  slot: EquipSlot;
  ac: number;
  metal: boolean;
  /** Added to spell failure chance while worn. */
  spellPenalty: number;
}

export interface ItemType {
  id: string;
  cls: ItemClass;
  name: string;
  icon: string;
  /** Relative frequency within its class. Zero means never generated at random. */
  freq: number;
  minDepth: number;
  cost: number;
  stack: boolean;
  weapon?: WeaponData;
  armor?: ArmorData;
  /** Spellbooks: the spell taught and its level. */
  spell?: string;
  level?: number;
  artifact?: boolean;
  keyColor?: KeyColor;
  /** Fixed tint for the icon, where the type has one. */
  tint?: string;
}

export const CLASS_SYMBOL: Record<ItemClass, string> = {
  weapon: ")",
  armor: "[",
  potion: "!",
  scroll: "?",
  spellbook: "+",
  wand: "/",
  ring: "=",
  amulet: '"',
  tool: "(",
  gold: "$",
};

export const CLASS_ORDER: readonly ItemClass[] = ["weapon", "armor", "potion", "scroll", "spellbook", "wand", "ring", "amulet", "tool", "gold"];

export const CLASS_NAME: Record<ItemClass, string> = {
  weapon: "Weapons",
  armor: "Armor",
  potion: "Potions",
  scroll: "Scrolls",
  spellbook: "Spellbooks",
  wand: "Wands",
  ring: "Rings",
  amulet: "Amulets",
  tool: "Keys",
  gold: "Gold",
};

/** How often each class turns up as random loot. */
export const CLASS_WEIGHT: Partial<Record<ItemClass, number>> = {
  weapon: 11,
  armor: 11,
  potion: 24,
  scroll: 19,
  spellbook: 5,
  wand: 5,
  ring: 4,
  amulet: 2,
};

function w(id: string, name: string, dice: [number, number], cooldown: number, cost: number, freq: number, minDepth: number, extra: Partial<WeaponData> = {}, more: Partial<ItemType> = {}): ItemType {
  return {
    id,
    cls: "weapon",
    name,
    icon: `item_${id}`,
    freq,
    minDepth,
    cost,
    stack: false,
    weapon: { dice, bonus: 0, toHit: 0, twoHanded: false, cooldown, throwable: false, launcher: false, ammo: false, ...extra },
    ...more,
  };
}

function a(id: string, name: string, slot: EquipSlot, ac: number, metal: boolean, spellPenalty: number, cost: number, freq: number, minDepth: number): ItemType {
  return { id, cls: "armor", name, icon: `item_${id}`, freq, minDepth, cost, stack: false, armor: { slot, ac, metal, spellPenalty } };
}

function magic(cls: ItemClass, id: string, name: string, cost: number, freq: number, minDepth = 1, more: Partial<ItemType> = {}): ItemType {
  return { id, cls, name, icon: `item_${cls}`, freq, minDepth, cost, stack: cls === "potion" || cls === "scroll", ...more };
}

function book(spell: string, name: string, level: number, freq: number): ItemType {
  return { id: `book_${spell}`, cls: "spellbook", name: `spellbook of ${name}`, icon: "item_spellbook", freq, minDepth: Math.max(1, level * 3 - 4), cost: level * 100, stack: false, spell, level };
}

function key(color: KeyColor, tint: string): ItemType {
  return { id: `key_${color}`, cls: "tool", name: `${color} key`, icon: "item_key", freq: 0, minDepth: 1, cost: 10, stack: true, keyColor: color, tint };
}

export const KEY_TINT: Record<KeyColor, string> = {
  red: "#c0392b",
  green: "#3f9a4a",
  blue: "#3a6ac0",
  brass: "#c9a23a",
  bone: "#d8d2bd",
};

export const ITEM_TYPES: readonly ItemType[] = [
  // ---- weapons (12 plus 2 artifacts) ----
  w("dagger", "dagger", [1, 4], 650, 4, 30, 1, { throwable: true, toHit: 2 }, { stack: true }),
  w("short_sword", "short sword", [1, 6], 850, 10, 18, 1),
  w("long_sword", "long sword", [1, 8], 1000, 15, 14, 2),
  w("two_handed_sword", "two-handed sword", [1, 12], 1500, 50, 8, 6, { twoHanded: true }),
  w("mace", "mace", [1, 6], 950, 5, 14, 1, { bonus: 1 }),
  w("morning_star", "morning star", [2, 4], 1100, 10, 10, 4),
  w("war_hammer", "war hammer", [1, 4], 900, 5, 10, 1, { bonus: 1 }),
  w("axe", "axe", [1, 6], 950, 8, 14, 1),
  w("spear", "spear", [1, 6], 900, 3, 14, 1, { throwable: true }),
  w("quarterstaff", "quarterstaff", [1, 6], 1000, 5, 10, 1, { twoHanded: true }),
  w("bow", "bow", [1, 2], 900, 60, 8, 2, { twoHanded: true, launcher: true }),
  w("arrow", "arrow", [1, 6], 0, 2, 16, 1, { ammo: true }, { stack: true }),
  w("excalibur", "Excalibur", [1, 8], 900, 4000, 0, 1, { bonus: 5, toHit: 5 }, { artifact: true, icon: "item_long_sword", tint: "#e8e0a0" }),
  w("mjollnir", "Mjollnir", [1, 4], 900, 4000, 0, 1, { bonus: 9, toHit: 5 }, { artifact: true, icon: "item_war_hammer", tint: "#9ad0f0" }),

  // ---- armor ----
  a("leather_armor", "leather armor", "body", 2, false, 0, 5, 20, 1),
  a("ring_mail", "ring mail", "body", 3, true, 20, 100, 16, 2),
  a("chain_mail", "chain mail", "body", 5, true, 25, 75, 12, 6),
  a("plate_mail", "plate mail", "body", 7, true, 35, 600, 6, 11),
  a("leather_cap", "leather cap", "helm", 1, false, 0, 6, 14, 1),
  a("iron_helm", "iron helm", "helm", 2, true, 5, 20, 10, 4),
  a("small_shield", "small shield", "off", 1, false, 5, 3, 12, 1),
  a("large_shield", "large shield", "off", 2, true, 15, 10, 8, 5),
  a("low_boots", "low boots", "boots", 1, false, 0, 8, 14, 1),
  a("iron_shoes", "iron shoes", "boots", 2, true, 5, 16, 8, 5),
  a("cloak", "cloak", "cloak", 1, false, 0, 40, 12, 1),
  a("cloak_of_protection", "cloak of protection", "cloak", 3, false, 0, 250, 3, 9),

  // ---- potions (11) ----
  magic("potion", "potion_healing", "potion of healing", 100, 60),
  magic("potion", "potion_extra_healing", "potion of extra healing", 100, 40, 3),
  magic("potion", "potion_gain_level", "potion of gain level", 300, 16, 4),
  magic("potion", "potion_speed", "potion of speed", 200, 36),
  magic("potion", "potion_see_invisible", "potion of see invisible", 50, 32),
  magic("potion", "potion_levitation", "potion of levitation", 200, 34),
  magic("potion", "potion_sleeping", "potion of sleeping", 100, 36),
  magic("potion", "potion_blindness", "potion of blindness", 150, 34),
  magic("potion", "potion_confusion", "potion of confusion", 100, 36),
  magic("potion", "potion_hallucination", "potion of hallucination", 100, 30),
  magic("potion", "potion_water", "potion of water", 100, 60),

  // ---- scrolls (8) ----
  magic("scroll", "scroll_identify", "scroll of identify", 20, 150),
  magic("scroll", "scroll_enchant_weapon", "scroll of enchant weapon", 60, 70),
  magic("scroll", "scroll_enchant_armor", "scroll of enchant armor", 80, 60),
  magic("scroll", "scroll_remove_curse", "scroll of remove curse", 80, 65),
  magic("scroll", "scroll_magic_mapping", "scroll of magic mapping", 100, 45),
  magic("scroll", "scroll_teleportation", "scroll of teleportation", 100, 55),
  magic("scroll", "scroll_fire", "scroll of fire", 100, 35),
  magic("scroll", "scroll_scare_monster", "scroll of scare monster", 100, 35),

  // ---- wands (6) ----
  magic("wand", "wand_striking", "wand of striking", 150, 60),
  magic("wand", "wand_magic_missile", "wand of magic missile", 150, 50),
  magic("wand", "wand_sleep", "wand of sleep", 175, 45, 2),
  magic("wand", "wand_fire", "wand of fire", 175, 35, 6),
  magic("wand", "wand_cold", "wand of cold", 175, 35, 6),
  magic("wand", "wand_lightning", "wand of lightning", 175, 30, 8),

  // ---- spellbooks (11) ----
  book("force_bolt", "force bolt", 1, 35),
  book("sleep", "sleep", 1, 30),
  book("healing", "healing", 1, 40),
  book("light", "light", 1, 30),
  book("detect_monsters", "detect monsters", 1, 30),
  book("magic_missile", "magic missile", 2, 35),
  book("hold_monster", "hold monster", 2, 25),
  book("turn_undead", "turn undead", 2, 20),
  book("identify", "identify", 3, 25),
  book("cone_of_cold", "cone of cold", 4, 12),
  book("fireball", "fireball", 4, 12),

  // ---- rings (6) ----
  magic("ring", "ring_protection", "ring of protection", 100, 40),
  magic("ring", "ring_regeneration", "ring of regeneration", 200, 25, 3),
  magic("ring", "ring_see_invisible", "ring of see invisible", 150, 30),
  magic("ring", "ring_free_action", "ring of free action", 200, 25, 3),
  magic("ring", "ring_invisibility", "ring of invisibility", 150, 25, 3),
  magic("ring", "ring_teleportation", "ring of teleportation", 200, 30),

  // ---- amulets (4 plus the goal) ----
  magic("amulet", "amulet_reflection", "amulet of reflection", 150, 15, 8),
  magic("amulet", "amulet_life_saving", "amulet of life saving", 150, 15, 6),
  magic("amulet", "amulet_awareness", "amulet of awareness", 150, 35),
  magic("amulet", "amulet_strangulation", "amulet of strangulation", 150, 30),
  { id: "amulet_eye", cls: "amulet", name: "Unblinking Eye", icon: "item_eye", freq: 0, minDepth: 25, cost: 30000, stack: false, artifact: true },

  // ---- tools ----
  { id: "lamp", cls: "tool", name: "oil lamp", icon: "item_lamp", freq: 0, minDepth: 1, cost: 60, stack: false },

  // ---- keys and gold ----
  key("red", KEY_TINT.red),
  key("green", KEY_TINT.green),
  key("blue", KEY_TINT.blue),
  key("brass", KEY_TINT.brass),
  key("bone", KEY_TINT.bone),
  { id: "gold", cls: "gold", name: "gold piece", icon: "item_gold", freq: 0, minDepth: 1, cost: 1, stack: true },
];

const TYPE_BY_ID = new Map(ITEM_TYPES.map((t) => [t.id, t]));

export function itemType(id: string): ItemType {
  const t = TYPE_BY_ID.get(id);
  if (!t) throw new Error(`unknown item type ${id}`);
  return t;
}

export function typesOfClass(cls: ItemClass): ItemType[] {
  return ITEM_TYPES.filter((t) => t.cls === cls);
}

// ---- appearances -------------------------------------------------------

export interface Appearance {
  text: string;
  tint: string;
}

export const APPEARANCES: Partial<Record<ItemClass, readonly Appearance[]>> = {
  potion: [
    { text: "murky", tint: "#6b6a3a" },
    { text: "fizzy", tint: "#9fd8e8" },
    { text: "cloudy", tint: "#c9c9c9" },
    { text: "oily", tint: "#3a3320" },
    { text: "smoky", tint: "#70707c" },
    { text: "milky", tint: "#e8e2d0" },
    { text: "ruby", tint: "#b3262e" },
    { text: "viscous", tint: "#5a8a3a" },
    { text: "luminous", tint: "#e8e060" },
    { text: "speckled", tint: "#c07a3a" },
    { text: "indigo", tint: "#4a3aa0" },
    { text: "brackish", tint: "#3f6a5a" },
    { text: "rosy", tint: "#e08a9a" },
  ],
  scroll: [
    { text: "VORTH KELEM", tint: "#d8c9a3" },
    { text: "ASHK UL NAR", tint: "#d8c9a3" },
    { text: "OMBRIS TE", tint: "#d8c9a3" },
    { text: "QUELL DAVOR", tint: "#d8c9a3" },
    { text: "IXI MOR THANE", tint: "#d8c9a3" },
    { text: "PELDA WREN", tint: "#d8c9a3" },
    { text: "SUTH GARAM", tint: "#d8c9a3" },
    { text: "NEV OLIM", tint: "#d8c9a3" },
    { text: "DRAUMA KESH", tint: "#d8c9a3" },
    { text: "HYLO BRANT", tint: "#d8c9a3" },
  ],
  wand: [
    { text: "oak", tint: "#8a5a2b" },
    { text: "bone", tint: "#d8d2bd" },
    { text: "copper", tint: "#c0703a" },
    { text: "glass", tint: "#a8d0d8" },
    { text: "iron", tint: "#6a7078" },
    { text: "slate", tint: "#4a5560" },
    { text: "ash", tint: "#b8b0a0" },
    { text: "thorn", tint: "#4a5a2a" },
  ],
  ring: [
    { text: "opal", tint: "#d0e0e8" },
    { text: "jet", tint: "#2a2a30" },
    { text: "garnet", tint: "#9a2030" },
    { text: "amber", tint: "#d09030" },
    { text: "moonstone", tint: "#b0b8d8" },
    { text: "agate", tint: "#a0603a" },
    { text: "jade", tint: "#4a9a6a" },
    { text: "pearl", tint: "#e8e0d8" },
  ],
  amulet: [
    { text: "triangular", tint: "#c9a23a" },
    { text: "oval", tint: "#a8a8b0" },
    { text: "square", tint: "#b87a4a" },
    { text: "crescent", tint: "#d0d8e0" },
    { text: "spiked", tint: "#7a7a80" },
    { text: "knotted", tint: "#8a6a3a" },
  ],
  spellbook: [
    { text: "vellum", tint: "#d8c9a3" },
    { text: "leather", tint: "#7a4a2a" },
    { text: "cloth", tint: "#5a6a8a" },
    { text: "mottled", tint: "#7a7a5a" },
    { text: "dusty", tint: "#9a9080" },
    { text: "gilt", tint: "#c9a23a" },
    { text: "charred", tint: "#2a2422" },
    { text: "stained", tint: "#6a3a4a" },
    { text: "thin", tint: "#8aa0a0" },
    { text: "heavy", tint: "#4a3a2a" },
    { text: "ragged", tint: "#8a7a6a" },
    { text: "plain", tint: "#a09a90" },
  ],
};

/** Classes whose members are unknown until used. */
export function isMagicClass(cls: ItemClass): boolean {
  return APPEARANCES[cls] !== undefined;
}

export interface Knowledge {
  discovered: Record<string, boolean>;
  appearance: Record<string, number>;
}

export function appearanceOf(k: Knowledge, type: ItemType): Appearance | null {
  const pool = APPEARANCES[type.cls];
  if (!pool || type.artifact) return null;
  const index = k.appearance[type.id];
  if (index === undefined) return null;
  return pool[index % pool.length] ?? null;
}

export function typeKnown(k: Knowledge, type: ItemType): boolean {
  return !isMagicClass(type.cls) || type.artifact === true || k.discovered[type.id] === true;
}

function plural(name: string): string {
  if (name.startsWith("potion ")) return `potions ${name.slice(7)}`;
  if (name.startsWith("scroll ")) return `scrolls ${name.slice(7)}`;
  if (name.endsWith("s") || name.endsWith("x")) return `${name}es`;
  if (name.endsWith("key")) return `${name}s`;
  return `${name}s`;
}

function article(text: string): string {
  return /^[aeiou]/i.test(text) ? "an" : "a";
}

/** The name without article or count: "murky potion", "+1 long sword". */
export function baseName(k: Knowledge, item: Item): string {
  const type = itemType(item.type);
  if (type.cls === "gold") return item.qty === 1 ? "gold piece" : "gold pieces";
  let core: string;
  if (typeKnown(k, type)) {
    core = type.name;
  } else {
    const look = appearanceOf(k, type);
    const text = look ? look.text : "strange";
    if (type.cls === "scroll") core = `scroll labeled ${text}`;
    else if (type.cls === "potion") core = `${text} potion`;
    else if (type.cls === "spellbook") core = `${text} spellbook`;
    else core = `${text} ${type.cls}`;
  }
  if (item.qty > 1) core = typeKnown(k, type) ? plural(core) : core.replace(/^scroll /, "scrolls ").replace(/ potion$/, " potions");
  const showEnch = item.known && (type.cls === "weapon" || type.cls === "armor" || type.id === "ring_protection");
  if (showEnch) core = `${item.ench >= 0 ? "+" : ""}${item.ench} ${core}`;
  if (item.proof && item.known) core = `rustproof ${core}`;
  return core;
}

const BUC_WORD: Record<string, string> = { B: "blessed", U: "uncursed", C: "cursed" };

const SLOT_NOTE: Record<EquipSlot, string> = {
  main: "weapon in hand",
  off: "in off hand",
  body: "being worn",
  helm: "being worn",
  boots: "being worn",
  cloak: "being worn",
  ringL: "on left hand",
  ringR: "on right hand",
  amulet: "being worn",
};

/** Full description: "a cursed -1 dagger (weapon in hand)", "3 uncursed murky potions". */
export function itemName(k: Knowledge, item: Item, withArticle = true): string {
  const type = itemType(item.type);
  let text = baseName(k, item);
  if (type.cls === "gold") return `${item.qty} ${text}`;
  if (item.bucKnown && !type.keyColor && type.id !== "amulet_eye") text = `${BUC_WORD[item.buc]} ${text}`;
  if (type.cls === "wand" && item.known) text += ` (${item.charges} charge${item.charges === 1 ? "" : "s"})`;
  if (item.lit) text += " (lit)";
  if (item.slot) text += ` (${SLOT_NOTE[item.slot]})`;
  if (item.qty > 1) return `${item.qty} ${text}`;
  if (!withArticle) return text;
  if (type.artifact) return type.id === "amulet_eye" ? `the ${text}` : text;
  return `${article(text)} ${text}`;
}

export function theItem(k: Knowledge, item: Item): string {
  const type = itemType(item.type);
  if (type.artifact && type.id !== "amulet_eye") return baseName(k, item);
  return `the ${baseName(k, item)}`;
}
