// The effect table. What a potion, scroll, wand, spell, or fountain does
// is looked up here by its id, its blessed/uncursed/cursed state, and
// the player's current statuses. Rules are tried in order and the first
// that matches wins, so status-specific rules come first.
//
// Nothing in this file acts on the game; src/game/effects.ts interprets
// the ops.

import type { Buc, StatusId } from "../types.ts";

export type BoltKind = "force" | "missile" | "sleep" | "fire" | "cold" | "lightning";

export type Op =
  | { op: "heal"; n: number; s: number; raiseMax: number }
  | { op: "cure"; status: StatusId }
  | { op: "cureStone" }
  | { op: "status"; status: StatusId; min: number; max: number }
  | { op: "statusForever"; status: StatusId }
  | { op: "gainLevel" }
  | { op: "ceiling" }
  | { op: "ceilingBump"; n: number; s: number }
  | { op: "damage"; n: number; s: number; cause: string }
  | { op: "luck"; delta: number }
  | { op: "identify"; mode: "pick" | "random" | "all" | "self" }
  | { op: "enchant"; target: "weapon" | "armor"; min: number; max: number }
  | { op: "proof"; target: "weapon" | "armor"; value: boolean }
  | { op: "uncurse"; scope: "worn" | "all" }
  | { op: "scramble" }
  | { op: "curseSome"; chance: number }
  | { op: "curseItem" }
  | { op: "uncurseItem" }
  | { op: "map"; mode: "full" | "partial" | "reveal" }
  | { op: "teleport"; mode: "random" | "safe" | "level" }
  | { op: "fire"; self: [number, number]; others: [number, number] }
  | { op: "burnItem" }
  | { op: "scare"; seconds: number; radius: number }
  | { op: "wake" }
  | { op: "bolt"; kind: BoltKind; n: number; s: number; range: number; ray: boolean; perLevel?: boolean }
  | { op: "fireball"; n: number; s: number; range: number }
  | { op: "light"; seconds: number }
  | { op: "detect"; seconds: number }
  | { op: "turnUndead" }
  | { op: "hold"; seconds: number; range: number }
  | { op: "drainPower" }
  | { op: "summon"; type: string; min: number; max: number }
  | { op: "gold"; n: number; s: number }
  | { op: "dryUp" }
  | { op: "explodeWand" }
  | { op: "nothing" };

export interface EffectRule {
  /** Applies only to these states; any state when left out. */
  buc?: Buc[];
  /** The player must have this status. */
  when?: StatusId;
  /** Applies only this often, even when everything else matches. */
  chance?: number;
  ops: Op[];
  msg: string;
  /** False when the outcome gives no clue what the item was. Default true. */
  reveals?: boolean;
  /** For tests and the audit: a short label for the outcome. */
  tag?: string;
}

const B: Buc[] = ["B"];
const U: Buc[] = ["U"];
const C: Buc[] = ["C"];
const BU: Buc[] = ["B", "U"];

function timed(status: StatusId, id: string, b: [number, number], u: [number, number], c: [number, number], msgs: [string, string, string]): EffectRule[] {
  return [
    { buc: B, ops: [{ op: "status", status, min: b[0], max: b[1] }], msg: msgs[0], tag: `${id}:B` },
    { buc: U, ops: [{ op: "status", status, min: u[0], max: u[1] }], msg: msgs[1], tag: `${id}:U` },
    { buc: C, ops: [{ op: "status", status, min: c[0], max: c[1] }], msg: msgs[2], tag: `${id}:C` },
  ];
}

/** Any potion drunk while stunned may end up down the drinker's front. */
const SPILL: EffectRule = { when: "stunned", chance: 0.3, ops: [{ op: "nothing" }], msg: "Your hands shake. Most of it goes down your front.", reveals: false, tag: "spill" };

const POTIONS: Record<string, EffectRule[]> = {
  potion_healing: [
    { buc: B, ops: [{ op: "heal", n: 8, s: 4, raiseMax: 1 }, { op: "cure", status: "blind" }, { op: "cureStone" }], msg: "You feel much better.", tag: "B" },
    { buc: U, ops: [{ op: "heal", n: 6, s: 4, raiseMax: 1 }, { op: "cure", status: "blind" }, { op: "cureStone" }], msg: "You feel better.", tag: "U" },
    { buc: C, ops: [{ op: "heal", n: 4, s: 4, raiseMax: 0 }], msg: "You feel a little better. It had gone off.", tag: "C" },
  ],
  potion_extra_healing: [
    { buc: B, ops: [{ op: "heal", n: 8, s: 8, raiseMax: 5 }, { op: "cure", status: "blind" }, { op: "cure", status: "hallucinating" }, { op: "cureStone" }], msg: "You feel completely healed.", tag: "B" },
    { buc: U, ops: [{ op: "heal", n: 6, s: 8, raiseMax: 2 }, { op: "cure", status: "blind" }, { op: "cure", status: "hallucinating" }, { op: "cureStone" }], msg: "You feel much, much better.", tag: "U" },
    { buc: C, ops: [{ op: "heal", n: 4, s: 8, raiseMax: 0 }, { op: "cure", status: "blind" }, { op: "cureStone" }], msg: "You feel much better, with an aftertaste.", tag: "C" },
  ],
  potion_gain_level: [
    { buc: B, ops: [{ op: "gainLevel" }, { op: "heal", n: 4, s: 8, raiseMax: 0 }], msg: "You feel more experienced, and rather well.", tag: "B" },
    { buc: U, ops: [{ op: "gainLevel" }], msg: "You feel more experienced.", tag: "U" },
    { buc: C, ops: [{ op: "ceiling" }], msg: "You rise up, through the ceiling!", tag: "C" },
  ],
  potion_speed: [
    { buc: B, ops: [{ op: "cure", status: "slowed" }, { op: "status", status: "fast", min: 140, max: 180 }], msg: "You are suddenly moving much faster.", tag: "B" },
    { buc: U, ops: [{ op: "status", status: "fast", min: 80, max: 120 }], msg: "You are suddenly moving faster.", tag: "U" },
    { buc: C, ops: [{ op: "status", status: "fast", min: 12, max: 25 }], msg: "Your legs get new energy. It will not last.", tag: "C" },
  ],
  potion_see_invisible: [
    { buc: B, ops: [{ op: "cure", status: "blind" }, { op: "statusForever", status: "seeInvisible" }], msg: "You can see through things that are not there. Permanently, it seems.", tag: "B" },
    { buc: U, ops: [{ op: "cure", status: "blind" }, { op: "status", status: "seeInvisible", min: 250, max: 400 }], msg: "You can see through things that are not there.", tag: "U" },
    { buc: C, ops: [{ op: "nothing" }], msg: "Yecch. This tastes like rotten fruit juice.", reveals: false, tag: "C" },
  ],
  potion_levitation: [
    { buc: B, ops: [{ op: "status", status: "levitating", min: 30, max: 50 }], msg: "You float gently off the floor.", tag: "B" },
    { buc: U, ops: [{ op: "status", status: "levitating", min: 60, max: 120 }], msg: "You float up, out of reach of the floor.", tag: "U" },
    { buc: C, ops: [{ op: "ceilingBump", n: 1, s: 10 }, { op: "status", status: "levitating", min: 120, max: 200 }], msg: "You shoot upward.", tag: "C" },
  ],
  potion_sleeping: timed("asleep", "sleeping", [2, 4], [8, 14], [18, 28], ["You yawn.", "You suddenly fall asleep.", "You fall into a deep, unhelpful sleep."]),
  potion_blindness: timed("blind", "blindness", [20, 30], [50, 80], [110, 160], ["A cloud of darkness falls upon you, lightly.", "A cloud of darkness falls upon you.", "A thick cloud of darkness falls upon you."]),
  potion_confusion: timed("confused", "confusion", [8, 12], [25, 40], [60, 90], ["Huh? It passes quickly.", "Huh, what? Where are you?", "Huh, what? Where is anyone?"]),
  potion_hallucination: timed("hallucinating", "hallucination", [20, 30], [60, 100], [150, 220], ["Oh wow. Briefly.", "Oh wow. Everything looks so cosmic.", "Oh wow. Everything looks so cosmic, and it is not going to stop."]),
  potion_water: [
    { buc: B, ops: [{ op: "cure", status: "confused" }, { op: "cure", status: "stunned" }, { op: "cure", status: "hallucinating" }, { op: "luck", delta: 1 }], msg: "You feel full of awe. It passes.", tag: "B" },
    { buc: U, ops: [{ op: "nothing" }], msg: "This tastes like water.", tag: "U" },
    { buc: C, ops: [{ op: "damage", n: 2, s: 6, cause: "unholy water" }, { op: "luck", delta: -1 }], msg: "This burns! You feel full of dread.", tag: "C" },
  ],
};
for (const rules of Object.values(POTIONS)) rules.unshift(SPILL);

const SCROLLS: Record<string, EffectRule[]> = {
  scroll_identify: [
    { when: "confused", ops: [{ op: "identify", mode: "self" }], msg: "You identify this as an identify scroll. That is all.", tag: "confused" },
    { buc: B, ops: [{ op: "identify", mode: "all" }], msg: "Everything you carry explains itself.", tag: "B" },
    { buc: U, ops: [{ op: "identify", mode: "pick" }], msg: "This is an identify scroll.", tag: "U" },
    { buc: C, ops: [{ op: "identify", mode: "random" }], msg: "This is an identify scroll, and it has opinions about what you should learn.", tag: "C" },
  ],
  scroll_enchant_weapon: [
    { when: "confused", buc: BU, ops: [{ op: "proof", target: "weapon", value: true }], msg: "Your weapon is covered by a shimmering golden shield.", tag: "confused" },
    { when: "confused", buc: C, ops: [{ op: "proof", target: "weapon", value: false }], msg: "Your weapon is covered by a mottled purple glow.", tag: "confused:C" },
    { buc: B, ops: [{ op: "enchant", target: "weapon", min: 1, max: 3 }], msg: "Your weapon glows blue for a while.", tag: "B" },
    { buc: U, ops: [{ op: "enchant", target: "weapon", min: 1, max: 1 }], msg: "Your weapon glows blue for a moment.", tag: "U" },
    { buc: C, ops: [{ op: "enchant", target: "weapon", min: -1, max: -1 }], msg: "Your weapon glows black for a moment.", tag: "C" },
  ],
  scroll_enchant_armor: [
    { when: "confused", buc: BU, ops: [{ op: "proof", target: "armor", value: true }], msg: "Your armor is covered by a shimmering golden shield.", tag: "confused" },
    { when: "confused", buc: C, ops: [{ op: "proof", target: "armor", value: false }], msg: "Your armor is covered by a mottled purple glow.", tag: "confused:C" },
    { buc: B, ops: [{ op: "enchant", target: "armor", min: 1, max: 3 }], msg: "Your armor glows silver for a while.", tag: "B" },
    { buc: U, ops: [{ op: "enchant", target: "armor", min: 1, max: 1 }], msg: "Your armor glows silver for a moment.", tag: "U" },
    { buc: C, ops: [{ op: "enchant", target: "armor", min: -1, max: -1 }], msg: "Your armor glows black for a moment.", tag: "C" },
  ],
  scroll_remove_curse: [
    { when: "confused", ops: [{ op: "scramble" }], msg: "You feel like you need some help.", tag: "confused" },
    { buc: B, ops: [{ op: "uncurse", scope: "all" }], msg: "You feel like someone is helping you, thoroughly.", tag: "B" },
    { buc: U, ops: [{ op: "uncurse", scope: "worn" }], msg: "You feel like someone is helping you.", tag: "U" },
    { buc: C, ops: [{ op: "nothing" }], msg: "The scroll disintegrates. Nobody helps you.", reveals: false, tag: "C" },
  ],
  scroll_magic_mapping: [
    { when: "confused", ops: [{ op: "map", mode: "partial" }], msg: "A map forms in your mind. Your mind is not in a state to hold it.", tag: "confused" },
    { buc: B, ops: [{ op: "map", mode: "reveal" }], msg: "A map forms in your mind, with annotations.", tag: "B" },
    { buc: U, ops: [{ op: "map", mode: "full" }], msg: "A map forms in your mind.", tag: "U" },
    { buc: C, ops: [{ op: "map", mode: "partial" }], msg: "A map forms in your mind. Unfortunately, you cannot grasp the details.", tag: "C" },
  ],
  scroll_teleportation: [
    { when: "confused", ops: [{ op: "teleport", mode: "level" }], msg: "You feel very disoriented for a moment.", tag: "confused" },
    { buc: B, ops: [{ op: "teleport", mode: "safe" }], msg: "You feel a wrenching sensation, and land somewhere quiet.", tag: "B" },
    { buc: U, ops: [{ op: "teleport", mode: "random" }], msg: "You feel a wrenching sensation.", tag: "U" },
    { buc: C, ops: [{ op: "teleport", mode: "level" }], msg: "You feel a wrenching sensation, vertically.", tag: "C" },
  ],
  scroll_fire: [
    { when: "confused", ops: [{ op: "damage", n: 1, s: 1, cause: "a scroll of fire" }], msg: "Oh, look, what a pretty fire in your hands.", tag: "confused" },
    { buc: B, ops: [{ op: "fire", self: [0, 0], others: [4, 4] }], msg: "The scroll erupts in a tower of flame that leaves you alone.", tag: "B" },
    { buc: U, ops: [{ op: "fire", self: [1, 4], others: [2, 4] }], msg: "The scroll erupts in a tower of flame.", tag: "U" },
    { buc: C, ops: [{ op: "fire", self: [2, 4], others: [1, 4] }, { op: "burnItem" }], msg: "The scroll catches fire, and so do you.", tag: "C" },
  ],
  scroll_scare_monster: [
    { when: "confused", ops: [{ op: "wake" }], msg: "You hear sad wailing in the distance. It is getting closer.", tag: "confused" },
    { buc: B, ops: [{ op: "scare", seconds: 60, radius: 8 }], msg: "You hear maniacal laughter close by. It is yours, apparently.", tag: "B" },
    { buc: U, ops: [{ op: "scare", seconds: 30, radius: 6 }], msg: "You hear maniacal laughter in the distance.", tag: "U" },
    { buc: C, ops: [{ op: "wake" }], msg: "You hear sad wailing in the distance. It is getting closer.", tag: "C" },
  ],
};

const EXPLODE: EffectRule = { buc: C, chance: 0.06, ops: [{ op: "explodeWand" }], msg: "The wand shudders and explodes.", tag: "explode" };

function wand(kind: BoltKind, n: number, s: number, range: number, ray: boolean, msg: string): EffectRule[] {
  return [EXPLODE, { ops: [{ op: "bolt", kind, n, s, range, ray }], msg, tag: "zap" }];
}

const WANDS: Record<string, EffectRule[]> = {
  wand_striking: wand("force", 2, 12, 4, false, "The wand strikes."),
  wand_magic_missile: wand("missile", 2, 6, 6, true, "A missile of magic darts out."),
  wand_sleep: wand("sleep", 0, 0, 6, true, "A grey ray shoots out."),
  wand_fire: wand("fire", 6, 6, 6, true, "A bolt of fire shoots out."),
  wand_cold: wand("cold", 6, 6, 6, true, "A bolt of cold shoots out."),
  wand_lightning: [EXPLODE, { ops: [{ op: "bolt", kind: "lightning", n: 6, s: 6, range: 6, ray: true }, { op: "status", status: "blind", min: 2, max: 4 }], msg: "A bolt of lightning shoots out. The flash is not kind to your eyes.", tag: "zap" }],
};

export type SpellKind = "attack" | "heal" | "divine" | "control";

/** What happens when a spell goes wrong in a confused or stunned caster's hands. */
const BACKFIRE: Record<SpellKind, { ops: Op[]; msg: string }> = {
  attack: { ops: [{ op: "damage", n: 2, s: 6, cause: "a spell gone wrong" }], msg: "The spell twists in your grip and goes off in your face." },
  heal: { ops: [{ op: "status", status: "confused", min: 8, max: 14 }], msg: "The spell turns inward and stirs your thoughts." },
  divine: { ops: [{ op: "status", status: "blind", min: 6, max: 12 }], msg: "The spell shows you everything at once. Then nothing." },
  control: { ops: [{ op: "status", status: "paralyzed", min: 3, max: 5 }], msg: "The spell takes hold of the nearest mind. Yours." },
};

function spell(kind: SpellKind, ops: Op[], msg: string): EffectRule[] {
  const bad = BACKFIRE[kind];
  return [
    { when: "confused", chance: 0.5, ops: bad.ops, msg: bad.msg, tag: "backfire:confused" },
    { when: "stunned", chance: 0.75, ops: bad.ops, msg: bad.msg, tag: "backfire:stunned" },
    { ops, msg, tag: "cast" },
  ];
}

export const SPELL_KIND: Record<string, SpellKind> = {
  force_bolt: "attack",
  magic_missile: "attack",
  sleep: "control",
  healing: "heal",
  identify: "divine",
  light: "divine",
  detect_monsters: "divine",
  fireball: "attack",
  cone_of_cold: "attack",
  turn_undead: "control",
  hold_monster: "control",
};

const SPELLS: Record<string, EffectRule[]> = {
  spell_force_bolt: spell("attack", [{ op: "bolt", kind: "force", n: 2, s: 12, range: 4, ray: false, perLevel: true }], "You thrust out a hand."),
  spell_magic_missile: spell("attack", [{ op: "bolt", kind: "missile", n: 2, s: 6, range: 6, ray: true, perLevel: true }], "Missiles of magic leap from your fingers."),
  spell_sleep: spell("control", [{ op: "bolt", kind: "sleep", n: 0, s: 0, range: 6, ray: true }], "A grey ray leaves your hand."),
  spell_healing: spell("heal", [{ op: "heal", n: 4, s: 4, raiseMax: 0 }, { op: "cure", status: "blind" }, { op: "cureStone" }], "Warmth spreads through you."),
  spell_identify: spell("divine", [{ op: "identify", mode: "pick" }], "You hold a question in your mind."),
  spell_light: spell("divine", [{ op: "light", seconds: 120 }], "A lit field surrounds you."),
  spell_detect_monsters: spell("divine", [{ op: "detect", seconds: 60 }], "You sense what is breathing nearby, and what is not but moves anyway."),
  spell_fireball: spell("attack", [{ op: "fireball", n: 6, s: 6, range: 4 }], "A bead of fire streaks from your hand."),
  spell_cone_of_cold: spell("attack", [{ op: "bolt", kind: "cold", n: 6, s: 6, range: 4, ray: true }], "A cone of bitter cold rolls out."),
  spell_turn_undead: spell("control", [{ op: "turnUndead" }], "You speak a word the dead dislike."),
  spell_hold_monster: spell("control", [{ op: "hold", seconds: 15, range: 5 }], "You close your fist on the air."),
};

export const EFFECTS: Record<string, EffectRule[]> = { ...POTIONS, ...SCROLLS, ...WANDS, ...SPELLS };

export interface EffectQuery {
  buc: Buc;
  has: (status: StatusId) => boolean;
  /** A roll in [0, 1) for each chance-limited rule that otherwise matches. */
  roll: () => number;
}

/** The first rule that matches the item's state and the player's statuses. */
export function lookupEffect(id: string, q: EffectQuery): EffectRule {
  const rules = EFFECTS[id];
  if (!rules) throw new Error(`no effect rules for ${id}`);
  for (const rule of rules) {
    if (rule.buc && !rule.buc.includes(q.buc)) continue;
    if (rule.when && !q.has(rule.when)) continue;
    if (rule.chance !== undefined && q.roll() >= rule.chance) continue;
    return rule;
  }
  throw new Error(`no effect rule matches ${id} in state ${q.buc}`);
}

// ---- failed spellbooks, by book level ---------------------------------

export const BOOK_FAILURE: Record<number, { ops: Op[]; msg: string }> = {
  1: { ops: [{ op: "teleport", mode: "random" }], msg: "The runes slide off the page. You feel a wrenching sensation." },
  2: { ops: [{ op: "wake" }, { op: "status", status: "blind", min: 15, max: 30 }], msg: "The page flares white. Something heard that." },
  3: { ops: [{ op: "drainPower" }, { op: "status", status: "confused", min: 15, max: 25 }], msg: "The book drinks your power and leaves you with a headache." },
  4: { ops: [{ op: "status", status: "paralyzed", min: 6, max: 12 }, { op: "drainPower" }], msg: "These runes were just too much to comprehend. You cannot move." },
};

// ---- fountains --------------------------------------------------------

export interface WeightedEffect {
  weight: number;
  ops: Op[];
  msg: string;
}

export const FOUNTAIN_QUAFF: readonly WeightedEffect[] = [
  { weight: 40, ops: [{ op: "heal", n: 1, s: 4, raiseMax: 0 }], msg: "The cool draught refreshes you." },
  { weight: 8, ops: [{ op: "summon", type: "water_snake", min: 1, max: 3 }], msg: "An endless stream of snakes pours forth. On inspection, it has an end." },
  { weight: 8, ops: [{ op: "curseSome", chance: 0.2 }], msg: "This water's no good. You feel a sudden chill in your pack." },
  { weight: 8, ops: [{ op: "status", status: "seeInvisible", min: 100, max: 200 }], msg: "You see an image of someone stalking you. But it disappears." },
  { weight: 8, ops: [{ op: "gold", n: 4, s: 10 }], msg: "You spot coins glinting in the basin and fish them out." },
  { weight: 8, ops: [{ op: "detect", seconds: 30 }], msg: "You feel a strange tingling. Shapes move behind the walls." },
  { weight: 6, ops: [{ op: "identify", mode: "random" }], msg: "You feel self-knowledgeable. About one thing." },
  { weight: 6, ops: [{ op: "damage", n: 1, s: 4, cause: "foul fountain water" }, { op: "status", status: "confused", min: 5, max: 10 }], msg: "The water is foul. You gag." },
  { weight: 8, ops: [{ op: "scare", seconds: 20, radius: 5 }], msg: "This water gives you bad breath. Things nearby reconsider." },
];

export const FOUNTAIN_DIP: readonly WeightedEffect[] = [
  { weight: 55, ops: [{ op: "nothing" }], msg: "The water runs off it. Nothing else happens." },
  { weight: 10, ops: [{ op: "curseItem" }], msg: "The water glows red for a moment." },
  { weight: 10, ops: [{ op: "uncurseItem" }], msg: "The water glows for a moment. A feeling of loss comes over you." },
  { weight: 10, ops: [{ op: "summon", type: "water_snake", min: 1, max: 2 }], msg: "Something in the basin objects to being disturbed." },
  { weight: 10, ops: [{ op: "gold", n: 2, s: 10 }], msg: "Your hand finds coins on the bottom." },
  { weight: 5, ops: [{ op: "dryUp" }], msg: "The fountain gurgles and dries up." },
];
