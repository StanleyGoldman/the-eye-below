// Monster types. Stat blocks plus the rule flags that make some of them
// more than stat blocks.

export type AttackEffect = "" | "stone" | "paralyze" | "steal" | "drain" | "stun" | "poison" | "acid" | "cold";

export interface MonsterAttack {
  dice: [number, number];
  effect: AttackEffect;
  /** Chance that the effect applies on a hit. */
  chance: number;
  verb: string;
}

export type PassiveKind = "" | "paralyze" | "acid" | "stone";

export interface RangedAttack {
  kind: "fire" | "cold" | "gaze" | "bolt";
  dice: [number, number];
  range: number;
  /** Milliseconds between uses. */
  every: number;
  reflectable: boolean;
  text: string;
}

export interface MonsterType {
  id: string;
  name: string;
  glyph: string;
  /** 1 to 5, or 0 for monsters that are only placed by hand. */
  tier: number;
  level: number;
  ac: number;
  /** Milliseconds per step; 0 never moves. */
  moveMs: number;
  attackMs: number;
  /** How long an attack is telegraphed before it lands. */
  windupMs: number;
  attacks: MonsterAttack[];
  passive: PassiveKind;
  ranged: RangedAttack | null;
  freq: number;
  /** Sprite height as a share of the cell, for the view. */
  size: number;
  undead: boolean;
  pack: boolean;
  erratic: boolean;
  invisible: boolean;
  /** Hit points regained per second. */
  regen: number;
  revives: boolean;
  boss: boolean;
  peaceful: boolean;
  /** Extra hit points on top of the level roll (bosses). */
  bonusHp: number;
  /** Chance to carry gold. */
  gold: number;
  drops: { type: string; chance: number }[];
  /** Fire or cold resistance and weakness. */
  resists: string[];
  weak: string[];
}

function atk(n: number, s: number, verb = "hits", effect: AttackEffect = "", chance = 1): MonsterAttack {
  return { dice: [n, s], effect, chance, verb };
}

function m(base: Pick<MonsterType, "id" | "name" | "glyph" | "tier" | "level" | "ac" | "moveMs" | "attackMs" | "attacks"> & Partial<MonsterType>): MonsterType {
  return {
    windupMs: 420,
    passive: "",
    ranged: null,
    freq: 10,
    size: 0.7,
    undead: false,
    pack: false,
    erratic: false,
    invisible: false,
    regen: 0,
    revives: false,
    boss: false,
    peaceful: false,
    bonusHp: 0,
    gold: 0.15,
    drops: [],
    resists: [],
    weak: [],
    ...base,
  };
}

export const MONSTER_TYPES: readonly MonsterType[] = [
  // ---- tier 1: the Cellars ----
  m({ id: "newt", name: "newt", glyph: ":", tier: 1, level: 0, ac: 8, moveMs: 950, attackMs: 1300, attacks: [atk(1, 3, "bites")], size: 0.3, gold: 0, freq: 14 }),
  m({ id: "jackal", name: "jackal", glyph: "d", tier: 1, level: 0, ac: 7, moveMs: 420, attackMs: 950, attacks: [atk(1, 2, "bites")], size: 0.45, pack: true, gold: 0, freq: 12 }),
  m({ id: "kobold", name: "kobold", glyph: "k", tier: 1, level: 1, ac: 6, moveMs: 720, attackMs: 1150, attacks: [atk(1, 5, "stabs")], size: 0.55, gold: 0.4, freq: 12 }),
  m({ id: "floating_eye", name: "floating eye", glyph: "e", tier: 1, level: 2, ac: 9, moveMs: 5000, attackMs: 0, attacks: [], passive: "paralyze", size: 0.5, gold: 0, freq: 6 }),

  // ---- tier 2: the Mines ----
  m({ id: "giant_bat", name: "giant bat", glyph: "B", tier: 2, level: 2, ac: 7, moveMs: 300, attackMs: 800, attacks: [atk(1, 6, "bites")], size: 0.45, erratic: true, gold: 0, freq: 10 }),
  m({ id: "acid_blob", name: "acid blob", glyph: "b", tier: 2, level: 1, ac: 8, moveMs: 1500, attackMs: 1600, attacks: [atk(1, 4, "oozes onto", "acid", 1)], passive: "acid", size: 0.4, gold: 0, freq: 7 }),
  m({ id: "hill_orc", name: "hill orc", glyph: "o", tier: 2, level: 2, ac: 8, moveMs: 650, attackMs: 1100, attacks: [atk(1, 6, "hits")], size: 0.7, pack: true, gold: 0.4, freq: 12 }),
  m({ id: "dwarf", name: "dwarf", glyph: "h", tier: 2, level: 3, ac: 4, moveMs: 760, attackMs: 1200, attacks: [atk(1, 8, "hacks at")], size: 0.6, gold: 0.6, drops: [{ type: "iron_helm", chance: 0.3 }, { type: "axe", chance: 0.3 }], freq: 9 }),

  // ---- tier 3: the Catacombs ----
  m({ id: "soldier_ant", name: "soldier ant", glyph: "a", tier: 3, level: 4, ac: 3, moveMs: 280, attackMs: 620, attacks: [atk(2, 4, "bites"), atk(3, 4, "stings")], windupMs: 300, size: 0.4, gold: 0, freq: 9 }),
  m({ id: "cockatrice", name: "cockatrice", glyph: "c", tier: 3, level: 5, ac: 6, moveMs: 800, attackMs: 1200, attacks: [atk(1, 3, "pecks"), atk(0, 0, "touches", "stone", 0.3)], passive: "stone", size: 0.45, gold: 0, freq: 7 }),
  m({ id: "ghoul", name: "ghoul", glyph: "Z", tier: 3, level: 4, ac: 4, moveMs: 1100, attackMs: 1300, attacks: [atk(1, 3, "claws", "paralyze", 0.5), atk(1, 4, "bites")], size: 0.75, undead: true, freq: 10 }),
  m({ id: "leprechaun", name: "leprechaun", glyph: "l", tier: 3, level: 5, ac: 8, moveMs: 330, attackMs: 900, attacks: [atk(1, 2, "pokes", "steal", 1)], size: 0.45, gold: 1, freq: 6 }),

  // ---- tier 4: the Undercroft ----
  m({ id: "troll", name: "troll", glyph: "T", tier: 4, level: 7, ac: 4, moveMs: 600, attackMs: 1100, attacks: [atk(4, 2, "clubs"), atk(2, 6, "bites")], size: 0.9, regen: 1, revives: true, weak: ["fire"], freq: 9 }),
  m({ id: "wraith", name: "wraith", glyph: "W", tier: 4, level: 6, ac: 4, moveMs: 600, attackMs: 1200, attacks: [atk(1, 6, "touches", "drain", 0.35)], size: 0.8, undead: true, resists: ["cold"], freq: 8 }),
  m({ id: "stalker", name: "stalker", glyph: "E", tier: 4, level: 8, ac: 3, moveMs: 600, attackMs: 1100, attacks: [atk(4, 4, "strikes")], size: 0.85, invisible: true, freq: 7 }),
  m({ id: "ogre", name: "ogre", glyph: "O", tier: 4, level: 7, ac: 5, moveMs: 850, attackMs: 1500, attacks: [atk(2, 6, "smashes", "stun", 0.2)], windupMs: 600, size: 0.95, gold: 0.5, freq: 10 }),

  // ---- tier 5: the Tower Roots ----
  m({ id: "vampire", name: "vampire", glyph: "V", tier: 5, level: 10, ac: 1, moveMs: 500, attackMs: 1000, attacks: [atk(1, 6, "claws"), atk(1, 6, "bites", "drain", 0.3)], size: 0.85, undead: true, regen: 2, freq: 8 }),
  m({ id: "minotaur", name: "minotaur", glyph: "H", tier: 5, level: 13, ac: 6, moveMs: 480, attackMs: 1150, attacks: [atk(3, 8, "gores"), atk(2, 8, "butts")], windupMs: 500, size: 1, freq: 6 }),
  m({ id: "fire_drake", name: "fire drake", glyph: "D", tier: 5, level: 12, ac: 0, moveMs: 680, attackMs: 1300, attacks: [atk(3, 6, "bites"), atk(1, 4, "claws")], ranged: { kind: "fire", dice: [5, 6], range: 4, every: 5200, reflectable: true, text: "breathes fire" }, size: 1, resists: ["fire"], weak: ["cold"], gold: 0.8, freq: 5 }),
  m({ id: "lich", name: "lich", glyph: "L", tier: 5, level: 11, ac: 0, moveMs: 900, attackMs: 1400, attacks: [atk(1, 10, "touches", "cold", 1)], ranged: { kind: "cold", dice: [4, 6], range: 4, every: 4600, reflectable: true, text: "hurls a bolt of cold" }, size: 0.85, undead: true, resists: ["cold"], gold: 0.6, freq: 6 }),

  // ---- placed by hand ----
  m({ id: "water_snake", name: "water snake", glyph: "S", tier: 0, level: 4, ac: 3, moveMs: 500, attackMs: 950, attacks: [atk(1, 6, "bites", "poison", 0.3)], size: 0.35, gold: 0, freq: 0 }),
  m({ id: "soldier", name: "keep soldier", glyph: "s", tier: 0, level: 8, ac: 2, moveMs: 600, attackMs: 1100, attacks: [atk(2, 6, "slashes")], size: 0.85, gold: 0.7, drops: [{ type: "long_sword", chance: 0.15 }, { type: "chain_mail", chance: 0.1 }], freq: 0 }),
  m({ id: "medusa", name: "Medusa", glyph: "m", tier: 0, level: 16, ac: 2, moveMs: 700, attackMs: 1200, attacks: [atk(2, 6, "claws"), atk(1, 6, "bites", "poison", 0.5)], ranged: { kind: "gaze", dice: [0, 0], range: 4, every: 2600, reflectable: true, text: "meets your eyes" }, size: 0.9, boss: true, bonusHp: 60, gold: 0, freq: 0 }),
  m({ id: "morvane", name: "Morvane", glyph: "M", tier: 0, level: 22, ac: -4, moveMs: 520, attackMs: 1100, attacks: [atk(2, 10, "strikes"), atk(1, 8, "curses", "stun", 0.15)], ranged: { kind: "bolt", dice: [6, 6], range: 5, every: 3800, reflectable: true, text: "hurls a bolt of force" }, size: 0.95, boss: true, bonusHp: 140, gold: 0, resists: ["fire", "cold"], freq: 0 }),
  m({ id: "oracle", name: "oracle", glyph: "@", tier: 0, level: 12, ac: 0, moveMs: 0, attackMs: 1200, attacks: [atk(2, 8, "rebukes")], size: 0.85, peaceful: true, bonusHp: 60, gold: 0, freq: 0 }),
];

const BY_ID = new Map(MONSTER_TYPES.map((t) => [t.id, t]));

export function monsterType(id: string): MonsterType {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`unknown monster type ${id}`);
  return t;
}

export function monstersOfTier(tier: number): MonsterType[] {
  return MONSTER_TYPES.filter((t) => t.tier === tier);
}

/** Regular monsters: the ones generated at random. */
export function regularMonsters(): MonsterType[] {
  return MONSTER_TYPES.filter((t) => t.tier >= 1);
}

export function tierOfDepth(depth: number): number {
  return Math.min(5, Math.floor((depth - 1) / 5) + 1);
}

export const TIER_NAMES: readonly string[] = ["", "The Cellars", "The Mines", "The Catacombs", "The Undercroft", "The Tower Roots"];

export function experienceFor(type: MonsterType, level: number): number {
  let xp = 1 + level * level + level * 2;
  if (type.passive) xp += 10;
  if (type.ranged) xp += 30;
  if (type.boss) xp += 500;
  for (const a of type.attacks) if (a.effect) xp += 8;
  return xp;
}
