// The three roles and their starting kits.

import type { EquipSlot, ItemClass, RoleId, Stats } from "../types.ts";

export interface KitEntry {
  type?: string;
  /** A random item of this class instead of a fixed type. */
  cls?: ItemClass;
  qty?: number;
  ench?: number;
  equip?: EquipSlot;
}

export interface RoleDef {
  id: RoleId;
  name: string;
  blurb: string;
  god: string;
  portrait: string;
  hp: number;
  hpDie: number;
  hpBonus: number;
  pw: number;
  pwDie: number;
  pwBonus: number;
  stats: Stats;
  /** Base spell failure, before level, intelligence, and armor. */
  spellBase: number;
  coldResistant: boolean;
  kit: KitEntry[];
  knownSpells: string[];
}

export const ROLES: readonly RoleDef[] = [
  {
    id: "valkyrie",
    name: "Valkyrie",
    blurb: "Sword, shield, and stubbornness. The most hit points, the least magic. Cold does not bother her.",
    god: "the Storm-Father",
    portrait: "portrait_valkyrie",
    hp: 16,
    hpDie: 8,
    hpBonus: 1,
    pw: 5,
    pwDie: 2,
    pwBonus: 0,
    stats: { st: 18, dx: 14, co: 17, in: 8, wi: 10, ch: 10 },
    spellBase: 30,
    coldResistant: true,
    kit: [
      { type: "long_sword", ench: 1, equip: "main" },
      { type: "dagger" },
      { type: "small_shield", ench: 3, equip: "off" },
    ],
    knownSpells: [],
  },
  {
    id: "wizard",
    name: "Wizard",
    blurb: "Fragile, well read, and carrying more unlabelled magic than is wise. Starts with force bolt and the most power.",
    god: "the Lamplighter",
    portrait: "portrait_wizard",
    hp: 11,
    hpDie: 6,
    hpBonus: 0,
    pw: 15,
    pwDie: 6,
    pwBonus: 2,
    stats: { st: 10, dx: 14, co: 12, in: 18, wi: 12, ch: 11 },
    spellBase: 0,
    coldResistant: false,
    kit: [
      { type: "quarterstaff", ench: 1, equip: "main" },
      { type: "cloak", equip: "cloak" },
      { type: "book_force_bolt" },
      { cls: "ring" },
      { cls: "wand" },
      { cls: "potion", qty: 2 },
      { cls: "scroll", qty: 2 },
    ],
    knownSpells: ["force_bolt"],
  },
  {
    id: "rogue",
    name: "Rogue",
    blurb: "Quick and quiet. Strikes twice as hard at anything asleep, held, or running away, and throws daggers two at a time.",
    god: "the Quiet Hand",
    portrait: "portrait_rogue",
    hp: 12,
    hpDie: 8,
    hpBonus: 0,
    pw: 6,
    pwDie: 3,
    pwBonus: 0,
    stats: { st: 14, dx: 18, co: 13, in: 12, wi: 9, ch: 12 },
    spellBase: 15,
    coldResistant: false,
    kit: [
      { type: "short_sword", equip: "main" },
      { type: "dagger", qty: 6 },
      { type: "leather_armor", ench: 1, equip: "body" },
      { cls: "potion" },
    ],
    knownSpells: [],
  },
];

export function roleDef(id: RoleId): RoleDef {
  const r = ROLES.find((x) => x.id === id);
  if (!r) throw new Error(`unknown role ${id}`);
  return r;
}

/** Experience needed to reach each level; index is the level. */
export const XP_FOR_LEVEL: readonly number[] = [0, 0, 20, 40, 80, 160, 320, 640, 1280, 2560, 5120, 10000, 20000, 40000, 80000, 160000, 320000, 640000, 1280000, 2560000, 5120000];
export const MAX_LEVEL = XP_FOR_LEVEL.length - 1;
