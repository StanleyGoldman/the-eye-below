// Everything the player can do. The keyboard, the on-screen buttons, the
// tests, and the bot all go through these functions.

import { pushBoulder, resetBoulders } from "../dungeon/boulders.ts";
import { doorAt, featureAt, gateAt, tileAt } from "../dungeon/grid.ts";
import { swing, throwItem } from "./combat.ts";
import { BOOK_FAILURE, FOUNTAIN_DIP, FOUNTAIN_QUAFF, lookupEffect } from "./data/effects.ts";
import type { WeightedEffect } from "./data/effects.ts";
import { APPEARANCES, itemType, typeKnown } from "./data/items.ts";
import { monsterType } from "./data/monsters.ts";
import { roleDef } from "./data/roles.ts";
import { NPC_GREETING, donate, donationFor, nextRumor, openShop } from "./shops.ts";
import { spellCost, spellDef } from "./data/spells.ts";
import { applyOps, applyRule, canRead, identifyItem, isUnidentified, spellFailure } from "./effects.ts";
import {
  addToPack,
  armorSpellPenalty,
  canAct,
  capital,
  consume,
  countKeys,
  cur,
  cure,
  discover,
  dropAt,
  emit,
  facing,
  findItem,
  has,
  heal,
  hurt,
  itemsAt,
  monsterAt,
  nameOf,
  placeAt,
  rng,
  say,
  speedFactor,
  takeFromPack,
  theMonster,
  whyNot,
  wornItem,
} from "./state.ts";
import { DX, DY, T } from "./types.ts";
import type { Dir, EquipSlot, GameState, Item, PromptOption } from "./types.ts";
import { arrive, hostileAdjacent, hostileInSight, summon, updateSeen } from "./world.ts";

export type MoveRel = "forward" | "right" | "back" | "left";
const REL_TURNS: Record<MoveRel, number> = { forward: 0, right: 1, back: 2, left: 3 };

const STEP_MS = 250;
const TURN_MS = 150;

function ready(state: GameState): boolean {
  if (canAct(state)) return true;
  const why = whyNot(state);
  if (why) say(state, why);
  return false;
}

function busy(state: GameState, ms: number, text: string): void {
  state.player.busyUntil = state.time + ms;
  state.player.busyText = text;
}

// ---- moving -----------------------------------------------------------

/** Open, or unlock and open, the door in a cell. Returns true if it is now open. */
function tryDoor(state: GameState, x: number, y: number): boolean {
  const level = cur(state);
  const door = doorAt(level, x, y);
  if (!door || door.open) return true;
  const p = state.player;
  if (door.locked) {
    const color = door.color ?? "plain";
    const key = countKeys(p, color);
    if (!key) {
      emit(state, { kind: "locked", color });
      say(state, `The door is locked. The lock is ${color}, and you have no ${color} key.`, "bad");
      return false;
    }
    consume(state, key);
    door.locked = false;
    door.open = true;
    state.stats.doors++;
    say(state, `You unlock the door with the ${color} key. The key stays in the lock.`, "good");
    emit(state, { kind: "sound", id: "door" });
    return true;
  }
  door.open = true;
  state.stats.doors++;
  say(state, "You open the door.");
  emit(state, { kind: "sound", id: "door" });
  return true;
}

export function move(state: GameState, rel: MoveRel): void {
  if (!ready(state)) return;
  const p = state.player;
  if (state.time < p.stepReady) return;
  p.resting = false;
  const level = cur(state);
  const r = rng(state);
  let dir = ((p.dir + REL_TURNS[rel]) % 4) as Dir;
  if ((has(state, "stunned") && r.chance(0.6)) || (has(state, "confused") && r.chance(0.3))) {
    dir = r.int(4) as Dir;
    say(state, "You stumble in a direction you did not choose.", "bad");
  }
  const nx = p.x + (DX[dir] as number);
  const ny = p.y + (DY[dir] as number);
  const stepMs = Math.round(STEP_MS * speedFactor(state));
  const floating = has(state, "levitating");
  const t = tileAt(level, nx, ny);

  const blocked = (text: string): void => {
    p.stepReady = state.time + Math.round(stepMs * 0.6);
    emit(state, { kind: "bump" });
    say(state, text);
  };

  const m = monsterAt(level, nx, ny);
  if (m) {
    if (m.peaceful) return blocked(`${capital(theMonster(m))} is in the way.`);
    if (rel === "forward" && dir === p.dir) {
      swing(state);
      return;
    }
    return blocked(`${capital(theMonster(m))} is in the way.`);
  }
  if (t === T.WALL) return blocked("You bump into the wall.");
  if (t === T.DOOR) {
    const door = doorAt(level, nx, ny);
    if (door && !door.open) {
      p.stepReady = state.time + stepMs;
      if (!tryDoor(state, nx, ny)) emit(state, { kind: "bump" });
      return;
    }
  }
  if (t === T.GATE) {
    const gate = gateAt(level, nx, ny);
    if (gate && !gate.open && !(floating && gate.kind === "drawbridge")) {
      return blocked(gate.kind === "drawbridge" ? "The drawbridge is up, and the moat is in the way. There will be a winch somewhere." : gate.opener === "boss" ? "A portcullis bars the way. It has no lever on this side." : "A portcullis bars the way. Something elsewhere on this level opens it.");
    }
  }
  if (t === T.WATER && !floating) return blocked("Deep water. You would rather not, in armor.");
  if (t === T.PIT && !floating) return blocked("A pit yawns across the passage. It wants filling.");
  const f = featureAt(level, nx, ny);
  if (f) {
    if (f.kind === "boulder") {
      const result = pushBoulder(level, nx, ny, dir);
      if (result === "stuck") return blocked("The boulder will not move that way.");
      emit(state, { kind: "sound", id: "boulder" });
      say(state, result === "filled" ? "The boulder drops into the pit and fills it." : "With great effort you move the boulder.", result === "filled" ? "good" : "info");
    } else if (f.kind === "statue") {
      return blocked(f.text ?? "A statue.");
    } else {
      return blocked(f.kind === "fountain" ? "A fountain. Face it and use it to drink." : "An altar. Face it and use it to pray.");
    }
  }

  p.px = p.x;
  p.py = p.y;
  p.movedAt = state.time;
  p.x = nx;
  p.y = ny;
  p.stepReady = state.time + stepMs;
  state.stats.steps++;
  emit(state, { kind: "step" });
  arrive(state);
  if (!state.dead) updateSeen(state);
}

export function turn(state: GameState, side: "left" | "right"): void {
  if (!ready(state)) return;
  const p = state.player;
  if (state.time < p.stepReady) return;
  p.resting = false;
  p.pdir = p.dir;
  p.turnedAt = state.time;
  p.dir = ((p.dir + (side === "right" ? 1 : 3)) % 4) as Dir;
  p.stepReady = state.time + Math.round(TURN_MS * speedFactor(state));
  updateSeen(state);
}

export function attack(state: GameState): void {
  if (!ready(state)) return;
  swing(state);
}

// ---- picking up -------------------------------------------------------

/** Pick up everything in the cell, or just one item when its id is given. */
export function pickUp(state: GameState, onlyUid?: number): void {
  if (!ready(state)) return;
  const level = cur(state);
  const p = state.player;
  const here = itemsAt(level, p.x, p.y).filter((it) => onlyUid === undefined || it.uid === onlyUid);
  if (here.length === 0) {
    say(state, "There is nothing here to pick up.");
    return;
  }
  if (has(state, "levitating")) {
    say(state, "You cannot reach the floor.");
    return;
  }
  p.resting = false;
  for (const item of here) {
    if (item.type === "scroll_scare_monster") {
      if (item.handled) {
        level.items = level.items.filter((fi) => fi.item !== item);
        say(state, "The scroll turns to dust as you pick it up. It only tolerates being handled once.", "bad");
        discover(state, item.type);
        continue;
      }
      item.handled = true;
    }
    const wasEye = item.type === "amulet_eye";
    const packed = addToPack(state, item);
    if (!packed) {
      say(state, "Your pack cannot hold another kind of thing.", "bad");
      break;
    }
    level.items = level.items.filter((fi) => fi.item !== item);
    say(state, itemType(item.type).cls === "gold" ? `You pick up ${nameOf(state, item)}.` : `${packed.letter} - ${nameOf(state, packed)}.`, "loot");
    emit(state, { kind: "sound", id: "pickup" });
    if (wasEye) {
      state.won = true;
      state.prompt = null;
      say(state, "You close your hand around the Unblinking Eye. It blinks, once. The tower starts to come down, and the Guild's way out opens under your feet.", "good");
      return;
    }
  }
}

// ---- using what is ahead ---------------------------------------------

function flipSwitch(state: GameState, x: number, y: number): boolean {
  const level = cur(state);
  const sw = level.switches.find((s) => s.x === x && s.y === y);
  if (!sw) return false;
  if (sw.kind === "reset") {
    resetPuzzle(state);
    return true;
  }
  if (sw.on) {
    say(state, "The switch is already thrown.");
    return true;
  }
  sw.on = true;
  emit(state, { kind: "sound", id: "switch" });
  const gate = level.gates.find((g) => g.id === sw.gate);
  if (gate && !gate.open) {
    gate.open = true;
    say(state, gate.kind === "drawbridge" ? "The winch turns. Chains rattle, and the drawbridge comes down." : "You throw the switch. Somewhere, a portcullis grinds open.", "good");
  } else {
    say(state, "You throw the switch. Nothing seems to happen.");
  }
  return true;
}

export function resetPuzzle(state: GameState): void {
  const level = cur(state);
  if (level.special !== "stoneyard") return;
  resetBoulders(level);
  placeAt(state, level.up.x, level.up.y);
  say(state, "You haul on the lever. Counterweights drop, and every boulder rolls back to where it started. Filled pits stay filled.", "good");
  emit(state, { kind: "sound", id: "boulder" });
  updateSeen(state);
}

function oracleOptions(state: GameState): PromptOption[] {
  const minor = 30 + state.depth * 4;
  const major = 120 + state.depth * 12;
  return [
    { id: "minor", label: `A small truth (${minor} gold)`, hint: "One true statement about this dungeon." },
    { id: "major", label: `A large truth (${major} gold)`, hint: "The oracle names one potion or scroll you have not identified." },
    { id: "leave", label: "Leave", hint: "The oracle does not mind." },
  ];
}

export function interact(state: GameState): void {
  if (!ready(state)) return;
  const level = cur(state);
  const p = state.player;
  const ahead = facing(state);
  const m = monsterAt(level, ahead.x, ahead.y);
  p.resting = false;
  if (m) {
    if (!m.peaceful) {
      swing(state);
      return;
    }
    if (m.type === "oracle") {
      state.prompt = { kind: "menu", title: "The oracle looks through you, then at you. \"Ask, and pay.\"", context: "oracle", target: m.uid, options: oracleOptions(state) };
      return;
    }
    const npc = m.npc;
    if (npc?.kind === "shopkeeper") {
      openShop(state, m);
      return;
    }
    if (npc?.kind === "priest") {
      state.prompt = {
        kind: "menu",
        title: "The priest inclines his head. \"The temple keeps its lamps lit on what visitors leave.\"",
        context: "priest",
        speaker: "The priest",
        target: m.uid,
        options: [
          { id: "large", label: `Give ${donationFor(state, "large")} gold`, hint: "A proper offering. The temple's protection improves your armor class, up to a point." },
          { id: "small", label: `Give ${donationFor(state, "small")} gold`, hint: "A modest offering. It eases bad luck, if you have any." },
          { id: "leave", label: "Leave", hint: "The priest does not press the matter." },
        ],
      };
      return;
    }
    if (npc && (npc.kind === "hermit" || npc.kind === "adventurer" || npc.kind === "gnome")) {
      talk(state, m.uid);
      return;
    }
    say(state, `${capital(theMonster(m))} has nothing to say.`);
    return;
  }
  const t = tileAt(level, ahead.x, ahead.y);
  if (t === T.DOOR) {
    const door = doorAt(level, ahead.x, ahead.y);
    if (door && door.open) {
      if (itemsAt(level, ahead.x, ahead.y).length > 0) {
        say(state, "Something is in the doorway.");
        return;
      }
      door.open = false;
      say(state, "You close the door.");
      emit(state, { kind: "sound", id: "door" });
      return;
    }
    if (!tryDoor(state, ahead.x, ahead.y)) emit(state, { kind: "bump" });
    return;
  }
  if (t === T.WALL && flipSwitch(state, ahead.x, ahead.y)) return;
  const f = featureAt(level, ahead.x, ahead.y);
  if (f) {
    if (f.kind === "fountain") {
      state.prompt = {
        kind: "menu",
        title: "A fountain. Water falls into a stone basin with more enthusiasm than the setting deserves.",
        context: "fountain",
        target: 0,
        options: [
          { id: "drink", label: "Drink from it", hint: "Fountains do many things. Some of them are good." },
          { id: "leave", label: "Leave it", hint: "To dip an item, choose Dip from that item's actions while facing the fountain." },
        ],
      };
    } else if (f.kind === "altar") {
      state.prompt = {
        kind: "menu",
        title: `An altar to ${roleDef(p.role).god}.`,
        context: "altar",
        target: 0,
        options: [
          { id: "pray", label: "Pray", hint: "Helps when you are in real trouble and have not prayed lately. Otherwise it annoys." },
          { id: "leave", label: "Leave it", hint: "Drop an item while facing the altar to learn whether it is blessed or cursed." },
        ],
      };
    } else if (f.kind === "statue") {
      say(state, f.text ?? "A statue.");
    } else {
      say(state, "A boulder. Walk into it to push it.");
    }
    return;
  }
  if (t === T.GATE) {
    const gate = gateAt(level, ahead.x, ahead.y);
    if (gate && !gate.open) {
      say(state, gate.kind === "drawbridge" ? "The drawbridge is raised. Its winch must be on this side of the moat." : "The portcullis does not lift by hand.");
      return;
    }
  }
  if (itemsAt(level, p.x, p.y).length > 0) {
    pickUp(state);
    return;
  }
  say(state, "There is nothing here to use.");
}

/** Hear what a rumor-monger has to say, in the dialogue panel and the log. */
function talk(state: GameState, uid: number): void {
  const speaker = cur(state).monsters.find((x) => x.uid === uid);
  const npc = speaker?.npc;
  if (!speaker || !npc) return;
  const first = npc.told === 0;
  const hadMore = npc.told < 3;
  const rumor = nextRumor(state, speaker);
  const name = capital(npc.name);
  const greeting = first ? `${rng(state).pick(NPC_GREETING[npc.kind] ?? [""])} ` : "";
  const text = hadMore ? `${greeting}"${rumor.text}"` : `"I have told you what I know. ${rumor.text}"`;
  say(state, first ? text : `${name}: ${text}`, "npc");
  const options: PromptOption[] = [];
  if (npc.told < 3) options.push({ id: "more", label: "Anything else?", hint: "Not everything said down here is true." });
  options.push({ id: "leave", label: "Farewell" });
  state.prompt = { kind: "menu", title: text, context: "talk", speaker: name, target: uid, options };
}

// ---- fountains, altars, the oracle -----------------------------------

function rollWeighted(state: GameState, table: readonly WeightedEffect[]): WeightedEffect {
  return table[rng(state).weighted(table.map((e) => e.weight))] as WeightedEffect;
}

function fountainAhead(state: GameState): ReturnType<typeof featureAt> {
  const ahead = facing(state);
  const f = featureAt(cur(state), ahead.x, ahead.y);
  return f && f.kind === "fountain" ? f : undefined;
}

function wearFountain(state: GameState): void {
  const f = fountainAhead(state);
  if (!f || !rng(state).chance(1 / 3)) return;
  f.uses = (f.uses ?? 1) - 1;
  if (f.uses <= 0) {
    const level = cur(state);
    level.features.splice(level.features.indexOf(f), 1);
    say(state, "The fountain gurgles, slows, and dries up.");
  }
}

function drinkFountain(state: GameState): void {
  if (!fountainAhead(state)) return;
  const effect = rollWeighted(state, FOUNTAIN_QUAFF);
  say(state, effect.msg);
  applyOps(state, effect.ops, { source: "a fountain" });
  busy(state, 500, "You are drinking.");
  wearFountain(state);
}

function dipInFountain(state: GameState, item: Item): void {
  const f = fountainAhead(state);
  if (!f) return;
  const p = state.player;
  const level = cur(state);
  if (item.type === "long_sword" && p.xl >= 5 && rng(state).chance(1 / 6)) {
    item.type = "excalibur";
    item.buc = "B";
    item.proof = true;
    item.known = true;
    item.bucKnown = true;
    level.features.splice(level.features.indexOf(f), 1);
    say(state, "Something under the water takes hold of the blade, turns it once, and lets go. The fountain is gone. The sword is not the sword you put in: it is Excalibur.", "good");
    return;
  }
  const effect = rollWeighted(state, FOUNTAIN_DIP);
  say(state, `You dip ${nameOf(state, item)} into the fountain. ${effect.msg}`);
  applyOps(state, effect.ops, { item, source: "a fountain" });
  wearFountain(state);
}

function dipInPotion(state: GameState, item: Item, potion: Item): void {
  const what = nameOf(state, { ...item, qty: 1 }, false);
  if (potion.type !== "potion_water") {
    say(state, `You dip your ${what} into the potion. It comes out wet. Nothing else happens.`);
    return;
  }
  discover(state, "potion_water");
  if (potion.buc === "B") {
    if (item.buc === "C") item.buc = "U";
    else if (item.buc === "U") item.buc = "B";
    say(state, `Your ${what} glows with a light blue aura. The water was holy.`, "good");
    item.bucKnown = true;
  } else if (potion.buc === "C") {
    if (item.buc === "B") item.buc = "U";
    else if (item.buc === "U") item.buc = "C";
    say(state, `Your ${what} glows with a black aura. The water was unholy.`, "bad");
    item.bucKnown = true;
  } else {
    say(state, `Your ${what} gets wet.`);
  }
  potion.bucKnown = true;
  consume(state, potion);
}

function pray(state: GameState): void {
  const p = state.player;
  const r = rng(state);
  const god = roleDef(p.role).god;
  state.stats.prayers++;
  busy(state, 2500, "You are praying.");
  const cursedWorn = p.inventory.filter((it) => it.slot && it.buc === "C");
  const major = p.hp < Math.max(6, p.maxHp / 7) || p.stoning > 0 || p.strangling > 0;
  const minor = cursedWorn.length > 0 || has(state, "blind") || has(state, "hallucinating") || has(state, "confused") || has(state, "stunned");
  const waited = state.time >= p.prayerReady - (major ? 150000 : minor ? 60000 : 0);
  say(state, `You kneel and pray to ${god}.`);
  if (p.luck >= 0 && waited) {
    p.prayerReady = state.time + r.range(300000, 500000);
    if (major || minor) {
      say(state, "You are surrounded by a shimmering light.", "good");
      if (p.hp < Math.max(6, p.maxHp / 7)) heal(state, p.maxHp);
      if (p.stoning > 0) {
        p.stoning = 0;
        p.stoneStage = 0;
        say(state, "The stiffness leaves your limbs.", "good");
      }
      const amulet = wornItem(p, "amulet");
      if (amulet && amulet.type === "amulet_strangulation") {
        takeFromPack(state, amulet);
        p.strangling = 0;
        say(state, "The amulet at your throat crumbles away. You can breathe.", "good");
      }
      for (const it of cursedWorn) it.buc = "U";
      if (cursedWorn.length > 0) say(state, "You feel as if a weight has been lifted from what you wear.", "good");
      cure(state, "blind");
      cure(state, "hallucinating");
      cure(state, "confused");
      cure(state, "stunned");
      say(state, `You feel that ${god} is satisfied, and that you should not make a habit of this.`);
    } else {
      p.luck = Math.min(10, p.luck + 1);
      say(state, `You feel that ${god} is well-pleased. You had nothing to ask for, which may be why.`, "good");
    }
    return;
  }
  p.prayerReady = Math.max(p.prayerReady, state.time) + 200000;
  p.luck = Math.max(-10, p.luck - 1);
  say(state, `You feel that ${god} is displeased.`, "danger");
  const roll = r.int(10);
  if (roll < 4) {
    for (const it of p.inventory) if (r.chance(0.3)) it.buc = "C";
    say(state, "A malignant aura settles on your pack.", "bad");
  } else if (roll < 7) {
    say(state, "A bolt of lightning strikes you. It is a comment.", "danger");
    hurt(state, r.dice(3, 8), `struck down by ${god}`);
  } else {
    const kind = monsterType("water_snake").id;
    summon(state, kind, 2, p);
    say(state, "Something has been sent to discuss your manners.", "danger");
  }
}

const ORACLE_PRIORITY = ["potion_healing", "potion_extra_healing", "scroll_remove_curse", "scroll_enchant_weapon", "scroll_enchant_armor", "potion_gain_level", "scroll_identify", "potion_blindness", "potion_sleeping", "scroll_teleportation", "potion_speed", "scroll_magic_mapping", "potion_see_invisible", "potion_levitation", "potion_confusion", "potion_hallucination", "scroll_fire", "scroll_scare_monster", "potion_water"];

/** True statements about this run that the oracle has not yet made. */
export function oracleFacts(state: GameState): { id: string; text: string }[] {
  const facts: { id: string; text: string }[] = [];
  const keep = state.levels[20] ?? null;
  facts.push({ id: "gorgon", text: "On the fifteenth level a woman waits whose glance is the last thing men see. A mirror at the throat turns it back on her. So does seeing nothing at all." });
  facts.push({ id: "stoneyard", text: "On the tenth level, fill the pits and take what lies beyond them. You will want it five levels later." });
  facts.push({ id: "eye", text: "A floating eye harms no one who cannot see it, and no one who does not strike it." });
  facts.push({ id: "troll", text: "What a troll's own strength knits back together, fire leaves in pieces." });
  facts.push({ id: "altar", text: "Lay a thing upon an altar and the altar will say what it thinks of it: amber for blessed, black for cursed." });
  facts.push({ id: "sword", text: "A long sword, a fountain, and five levels of experience have made a king's blade before. Not often. One time in six." });
  facts.push({ id: "prices", text: `The master of the Hollow Tower leaves his rooms when half his blood has. He does not go far.` });
  if (keep) {
    const wand = keep.items.map((fi) => fi.item).find((it) => itemType(it.type).cls === "wand");
    if (wand) facts.push({ id: "keepwand", text: `In the strongroom of the Keep lies a ${itemType(wand.type).name}.` });
  }
  return facts.filter((f) => !state.oracleTold.includes(f.id));
}

function consultOracle(state: GameState, which: "minor" | "major"): void {
  const p = state.player;
  const options = oracleOptions(state);
  const cost = Number(/\((\d+) gold\)/.exec(options.find((o) => o.id === which)?.label ?? "")?.[1] ?? 0);
  if (p.gold < cost) {
    say(state, "The oracle regards your purse, and says nothing. The price was stated.", "npc");
    return;
  }
  if (which === "minor") {
    const facts = oracleFacts(state);
    if (facts.length === 0) {
      say(state, "\"I have told you every small thing I know.\" The oracle takes no payment.", "npc");
      return;
    }
    const fact = rng(state).pick(facts);
    p.gold -= cost;
    state.oracleTold.push(fact.id);
    say(state, `The oracle takes ${cost} gold and says: "${fact.text}"`, "npc");
    return;
  }
  const unknown = ORACLE_PRIORITY.find((id) => !typeKnown(state, itemType(id)));
  if (!unknown) {
    say(state, "\"You already know your potions and your scrolls. Keep your gold.\"", "npc");
    return;
  }
  p.gold -= cost;
  const type = itemType(unknown);
  const pool = APPEARANCES[type.cls];
  const look = pool ? pool[(state.appearance[unknown] ?? 0) % pool.length] : undefined;
  discover(state, unknown);
  const described = type.cls === "potion" ? `The ${look?.text ?? "unmarked"} potion` : `The scroll labeled ${look?.text ?? "nothing"}`;
  say(state, `The oracle takes ${cost} gold and says: "${described} is a ${type.name}. In this dungeon. This time."`, "npc");
}

// ---- prompts ----------------------------------------------------------

export function choose(state: GameState, optionId: string): void {
  const prompt = state.prompt;
  if (!prompt || prompt.kind !== "menu") return;
  state.prompt = null;
  if (optionId === "leave" || optionId === "no" || optionId === "cancel") return;
  switch (prompt.context) {
    case "attackPeaceful":
      if (optionId === "yes") swing(state, true);
      break;
    case "fountain":
      if (optionId === "drink") drinkFountain(state);
      break;
    case "altar":
      if (optionId === "pray") pray(state);
      break;
    case "oracle":
      if (optionId === "minor" || optionId === "major") consultOracle(state, optionId);
      break;
    case "priest":
      if (optionId === "small" || optionId === "large") donate(state, optionId);
      break;
    case "talk":
      if (optionId === "more") talk(state, prompt.target);
      break;
    case "dip": {
      const item = findItem(state, prompt.target);
      if (!item) break;
      if (optionId === "fountain") dipInFountain(state, item);
      else if (optionId.startsWith("potion:")) {
        const potion = findItem(state, Number(optionId.slice(7)));
        if (potion) dipInPotion(state, item, potion);
      }
      break;
    }
  }
}

export function pickItem(state: GameState, uid: number): void {
  const prompt = state.prompt;
  if (!prompt || prompt.kind !== "pick") return;
  const item = findItem(state, uid);
  if (!item) return;
  if (prompt.purpose === "identify") {
    if (!isUnidentified(state, item)) {
      say(state, "You already know all there is to know about that.");
      return;
    }
    identifyItem(state, item);
    prompt.count--;
    if (prompt.count <= 0 || !state.player.inventory.some((it) => isUnidentified(state, it))) state.prompt = null;
  }
}

export function cancelPrompt(state: GameState): void {
  if (!state.prompt) return;
  if (state.prompt.kind === "pick") say(state, "You let the moment pass.");
  state.prompt = null;
}

// ---- resting ----------------------------------------------------------

export function toggleRest(state: GameState): void {
  const p = state.player;
  if (p.resting) {
    p.resting = false;
    say(state, "You get up.");
    return;
  }
  if (!ready(state)) return;
  const beside = hostileAdjacent(state);
  if (beside) {
    say(state, `You cannot rest with ${theMonster(beside)} beside you.`, "bad");
    return;
  }
  const seen = hostileInSight(state);
  if (seen) {
    say(state, `You cannot rest with ${theMonster(seen)} in view.`, "bad");
    return;
  }
  if (p.hp >= p.maxHp && p.pw >= p.maxPw) {
    say(state, "You do not need rest.");
    return;
  }
  p.resting = true;
  say(state, "You sit with your back to the wall and rest. Time passes quickly.");
}

// ---- spells -----------------------------------------------------------

export function castFailure(state: GameState, spellId: string): number {
  return spellFailure(state, spellDef(spellId).level, armorSpellPenalty(state.player));
}

export function cast(state: GameState, spellId: string): void {
  if (!ready(state)) return;
  const p = state.player;
  if (!p.spells.includes(spellId)) {
    say(state, "You do not know that spell.");
    return;
  }
  if (state.time < p.castReady) return;
  const def = spellDef(spellId);
  const cost = spellCost(spellId);
  if (p.pw < cost) {
    say(state, `You do not have enough power to cast ${def.name}. It needs ${cost}.`, "bad");
    return;
  }
  p.resting = false;
  p.castReady = state.time + Math.round(900 * speedFactor(state));
  state.stats.spellsCast++;
  const r = rng(state);
  if (r.int(100) < castFailure(state, spellId)) {
    p.pw -= Math.ceil(cost / 2);
    say(state, "You fail to cast the spell correctly. Half the power is gone anyway.", "bad");
    return;
  }
  p.pw -= cost;
  emit(state, { kind: "sound", id: "spell" });
  const rule = lookupEffect(`spell_${spellId}`, { buc: "U", has: (s) => has(state, s), roll: () => r.next() });
  applyRule(state, rule, { source: `the spell of ${def.name}` });
}

// ---- items ------------------------------------------------------------

export type ItemAction = "wield" | "offhand" | "unwield" | "wear" | "takeoff" | "puton" | "remove" | "quaff" | "read" | "zap" | "throw" | "apply" | "dip" | "drop";

export interface ActionChoice {
  id: ItemAction;
  label: string;
}

export function itemActions(state: GameState, item: Item): ActionChoice[] {
  const type = itemType(item.type);
  const out: ActionChoice[] = [];
  if (type.cls === "weapon") {
    if (item.slot) out.push({ id: "unwield", label: "Put away" });
    else {
      out.push({ id: "wield", label: "Wield" });
      if (type.weapon && !type.weapon.twoHanded && !type.weapon.ammo) out.push({ id: "offhand", label: "Off hand" });
    }
    if (type.weapon?.throwable && !item.slot) out.push({ id: "throw", label: "Throw" });
  } else if (type.cls === "armor") {
    out.push(item.slot ? { id: "takeoff", label: "Take off" } : { id: "wear", label: "Wear" });
  } else if (type.cls === "potion") {
    out.push({ id: "quaff", label: "Quaff" });
  } else if (type.cls === "scroll" || type.cls === "spellbook") {
    out.push({ id: "read", label: "Read" });
  } else if (type.cls === "wand") {
    out.push({ id: "zap", label: "Zap" });
  } else if (type.cls === "ring" || type.cls === "amulet") {
    out.push(item.slot ? { id: "remove", label: "Remove" } : { id: "puton", label: "Put on" });
  } else if (type.id === "lamp") {
    out.push({ id: "apply", label: item.lit ? "Snuff" : "Light" });
  }
  if (!item.slot) {
    out.push({ id: "dip", label: "Dip" });
    out.push({ id: "drop", label: "Drop" });
  }
  return out;
}

/** Split one off a stack so it can be equipped on its own. */
function single(state: GameState, item: Item): Item {
  if (item.qty <= 1) return item;
  const one = takeFromPack(state, item, 1);
  const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const taken = new Set(state.player.inventory.map((it) => it.letter));
  one.letter = [...letters].find((ch) => !taken.has(ch)) ?? item.letter;
  const at = state.player.inventory.indexOf(item);
  state.player.inventory.splice(at + 1, 0, one);
  return one;
}

/** After unequipping, fold the item back into a matching stack if there is one. */
function restack(state: GameState, item: Item): void {
  const p = state.player;
  item.slot = null;
  if (!itemType(item.type).stack) return;
  const i = p.inventory.indexOf(item);
  if (i < 0) return;
  p.inventory.splice(i, 1);
  addToPack(state, item);
}

function stuck(state: GameState, item: Item, text: string): boolean {
  if (item.buc !== "C") return false;
  item.bucKnown = true;
  say(state, text, "bad");
  return true;
}

function unequip(state: GameState, slot: EquipSlot, quiet = false): boolean {
  const p = state.player;
  const item = wornItem(p, slot);
  if (!item) return true;
  const name = itemType(item.type).name;
  if (stuck(state, item, slot === "main" || (slot === "off" && itemType(item.type).weapon) ? `Your ${name} is welded to your hand. It is cursed.` : `You cannot take off your ${name}. It is cursed.`)) return false;
  restack(state, item);
  if (!quiet) say(state, slot === "main" || slot === "off" ? `You put away your ${name}.` : `You take off your ${name}.`);
  return true;
}

function equip(state: GameState, item: Item, slot: EquipSlot): void {
  const type = itemType(item.type);
  item.slot = slot;
  if (item.buc === "C" && (type.cls === "weapon" || type.cls === "armor")) {
    item.bucKnown = true;
    say(state, type.cls === "weapon" ? `Your ${type.name} welds itself to your hand!` : `Your ${type.name} tightens. You have a bad feeling about getting it off.`, "bad");
  }
}

function wield(state: GameState, item: Item, hand: "main" | "off"): void {
  const p = state.player;
  const data = itemType(item.type).weapon;
  if (!data) return;
  const main = wornItem(p, "main");
  const mainTwoHanded = !!main && !!itemType(main.type).weapon?.twoHanded;
  if (hand === "off") {
    if (data.twoHanded) {
      say(state, "That needs both hands.");
      return;
    }
    if (mainTwoHanded) {
      say(state, "Both your hands are full already.");
      return;
    }
    if (!unequip(state, "off", true)) return;
    const one = single(state, item);
    equip(state, one, "off");
    say(state, `${one.letter} - ${nameOf(state, one)}.`);
    busy(state, 400, "You are changing weapons.");
    return;
  }
  if (!unequip(state, "main", true)) return;
  if (data.twoHanded && !unequip(state, "off", true)) return;
  const one = single(state, item);
  equip(state, one, "main");
  say(state, `${one.letter} - ${nameOf(state, one)}.`);
  busy(state, 400, "You are changing weapons.");
}

function wear(state: GameState, item: Item): void {
  const p = state.player;
  const data = itemType(item.type).armor;
  if (!data) return;
  if (data.slot === "off") {
    const main = wornItem(p, "main");
    if (main && itemType(main.type).weapon?.twoHanded) {
      say(state, "You cannot carry a shield with a two-handed weapon.");
      return;
    }
  }
  if (!unequip(state, data.slot, true)) return;
  equip(state, item, data.slot);
  item.known = true;
  say(state, `You are now wearing ${nameOf(state, item)}.`);
  busy(state, data.slot === "body" ? 2000 : 600, "You are putting on armor.");
}

function putOn(state: GameState, item: Item): void {
  const p = state.player;
  const type = itemType(item.type);
  let slot: EquipSlot;
  if (type.cls === "amulet") {
    if (wornItem(p, "amulet")) {
      say(state, "You are already wearing an amulet. Remove it first.");
      return;
    }
    slot = "amulet";
  } else {
    if (!wornItem(p, "ringL")) slot = "ringL";
    else if (!wornItem(p, "ringR")) slot = "ringR";
    else {
      say(state, "Both your ring fingers are taken. Remove a ring first.");
      return;
    }
  }
  item.slot = slot;
  say(state, `You put on ${nameOf(state, { ...item, slot: null })}.`);
  switch (type.id) {
    case "ring_invisibility":
      discover(state, type.id);
      say(state, has(state, "seeInvisible") ? "Your body takes on a strange transparency." : "Suddenly you cannot see yourself.");
      break;
    case "ring_protection":
      if (item.ench !== 0) {
        discover(state, type.id);
        item.known = true;
        say(state, item.ench > 0 ? "You feel safer." : "You feel exposed.");
      }
      break;
    case "amulet_strangulation":
      discover(state, type.id);
      say(state, "It constricts your throat!", "danger");
      break;
    case "amulet_awareness":
      discover(state, type.id);
      say(state, "You become aware of everything that moves on this level.", "good");
      break;
    case "amulet_eye":
      say(state, "The Eye regards the room from your chest. It does not blink.");
      break;
    default:
      break;
  }
  busy(state, 300, "You are putting something on.");
}

function removeWorn(state: GameState, item: Item): void {
  if (!item.slot) return;
  const name = itemType(item.type).cls;
  if (stuck(state, item, `You cannot remove the ${name}. It is cursed.`)) return;
  item.slot = null;
  say(state, `You remove ${nameOf(state, item)}.`);
}

function quaff(state: GameState, chosen: Item): void {
  const p = state.player;
  const r = rng(state);
  let item = chosen;
  if (has(state, "confused") && r.chance(0.25)) {
    const others = p.inventory.filter((it) => it !== chosen && itemType(it.type).cls === "potion");
    if (others.length > 0) {
      item = r.pick(others);
      say(state, "In your confusion you drink from the wrong bottle.", "bad");
    }
  }
  const type = itemType(item.type);
  const rule = lookupEffect(type.id, { buc: item.buc, has: (s) => has(state, s), roll: () => r.next() });
  say(state, `You drink ${nameOf(state, { ...item, qty: 1 })}.`);
  consume(state, item);
  state.stats.potions++;
  emit(state, { kind: "sound", id: "quaff" });
  const revealed = applyRule(state, rule, { item, source: `a ${type.name}` });
  if (revealed && discover(state, type.id)) say(state, `That was a ${type.name}.`, "loot");
  if (!state.dead) busy(state, 350, "You are drinking.");
}

function readScroll(state: GameState, item: Item): void {
  const r = rng(state);
  const type = itemType(item.type);
  const rule = lookupEffect(type.id, { buc: item.buc, has: (s) => has(state, s), roll: () => r.next() });
  say(state, `You read ${nameOf(state, { ...item, qty: 1 })}. It crumbles as you finish.`);
  consume(state, item);
  state.stats.scrolls++;
  emit(state, { kind: "sound", id: "scroll" });
  const revealed = applyRule(state, rule, { item, source: `a ${type.name}` });
  if (revealed && discover(state, type.id)) say(state, `That was a ${type.name}.`, "loot");
  if (!state.dead) busy(state, 450, "You are reading.");
}

function readBook(state: GameState, item: Item): void {
  const p = state.player;
  const r = rng(state);
  const type = itemType(item.type);
  const spellId = type.spell as string;
  const level = type.level ?? 1;
  if (typeKnown(state, type) && p.spells.includes(spellId)) {
    say(state, "You already know that spell by heart.");
    return;
  }
  const ability = p.stats.in + 4 + Math.floor(p.xl / 2) - 2 * level;
  let ok: boolean;
  if (item.buc === "C") ok = false;
  else if (item.buc === "B") ok = true;
  else ok = !has(state, "confused") && r.rnd(20) <= ability;
  if (!ok) {
    const failure = BOOK_FAILURE[Math.min(4, level)] as (typeof BOOK_FAILURE)[number];
    if (item.buc === "C") item.bucKnown = true;
    say(state, item.buc === "C" ? "The book is cursed. The runes writhe as you read them." : has(state, "confused") ? "The runes swim. You were in no state to study." : "This book is beyond you, for now.", "bad");
    say(state, failure.msg, "bad");
    applyOps(state, failure.ops, { item, source: "a spellbook" });
    if (r.chance(1 / 3) && findItem(state, item.uid)) {
      say(state, "The spellbook crumbles to dust.", "bad");
      consume(state, item);
    }
    return;
  }
  discover(state, type.id);
  item.known = true;
  if (!p.spells.includes(spellId)) p.spells.push(spellId);
  busy(state, level * 2000, "You are memorizing runes.");
  say(state, `You study the runes and learn the spell of ${spellDef(spellId).name}. It costs ${spellCost(spellId)} power to cast.`, "good");
}

function zap(state: GameState, item: Item): void {
  const p = state.player;
  const r = rng(state);
  const type = itemType(item.type);
  if (state.time < p.castReady) return;
  p.castReady = state.time + Math.round(700 * speedFactor(state));
  if (item.charges <= 0) {
    item.known = true;
    say(state, "Nothing happens. The wand is spent.");
    return;
  }
  item.charges--;
  emit(state, { kind: "sound", id: "zap" });
  const rule = lookupEffect(type.id, { buc: item.buc, has: (s) => has(state, s), roll: () => r.next() });
  applyRule(state, rule, { item, source: `a ${type.name}` });
  if (discover(state, type.id)) say(state, `That was a ${type.name}.`, "loot");
}

function drop(state: GameState, item: Item): void {
  const level = cur(state);
  const p = state.player;
  const ahead = facing(state);
  const f = featureAt(level, ahead.x, ahead.y);
  const label = nameOf(state, item);
  takeFromPack(state, item);
  if (f && f.kind === "altar") {
    item.bucKnown = true;
    const flash = item.buc === "B" ? "There is an amber flash: blessed." : item.buc === "C" ? "There is a black flash: cursed." : "Nothing flashes: neither blessed nor cursed.";
    say(state, `You lay ${label} on the altar. ${flash} It slides off to your feet.`, item.buc === "C" ? "bad" : "info");
  } else {
    say(state, `You drop ${label}.`);
  }
  dropAt(level, p.x, p.y, item);
}

function offerDip(state: GameState, item: Item): void {
  const p = state.player;
  const options: PromptOption[] = [];
  if (fountainAhead(state)) options.push({ id: "fountain", label: "Into the fountain", hint: "Usually nothing. Sometimes not." });
  for (const it of p.inventory) {
    if (it === item || itemType(it.type).cls !== "potion") continue;
    options.push({ id: `potion:${it.uid}`, label: `Into ${nameOf(state, { ...it, qty: 1 })}`, hint: "Holy water blesses and lifts curses. Unholy water does the opposite." });
  }
  if (options.length === 0) {
    say(state, "You have nothing to dip it into. A fountain or a potion would do.");
    return;
  }
  options.push({ id: "cancel", label: "Never mind" });
  state.prompt = { kind: "menu", title: `Dip ${nameOf(state, item)} into what?`, context: "dip", target: item.uid, options };
}

export function useItem(state: GameState, uid: number, action: ItemAction): void {
  if (!ready(state)) return;
  const item = findItem(state, uid);
  if (!item) return;
  if (!itemActions(state, item).some((a) => a.id === action)) return;
  state.player.resting = false;
  switch (action) {
    case "wield":
      wield(state, item, "main");
      break;
    case "offhand":
      wield(state, item, "off");
      break;
    case "unwield":
      if (item.slot) unequip(state, item.slot);
      break;
    case "wear":
      wear(state, item);
      break;
    case "takeoff":
      if (item.slot && unequip(state, item.slot)) busy(state, 500, "You are taking off armor.");
      break;
    case "puton":
      putOn(state, item);
      break;
    case "remove":
      removeWorn(state, item);
      break;
    case "quaff":
      quaff(state, item);
      break;
    case "read":
      if (!canRead(state)) {
        say(state, "You cannot read while blind.", "bad");
        break;
      }
      if (itemType(item.type).cls === "spellbook") readBook(state, item);
      else readScroll(state, item);
      break;
    case "zap":
      zap(state, item);
      break;
    case "throw":
      throwItem(state, item);
      break;
    case "apply":
      item.lit = !item.lit;
      say(state, item.lit ? "You light the lamp. The dark backs off a little, in every direction." : "You snuff the lamp.");
      updateSeen(state);
      break;
    case "dip":
      offerDip(state, item);
      break;
    case "drop":
      drop(state, item);
      break;
  }
}

/** Fire the bow or throw the first stack of daggers: the quick ranged action. */
export function quickThrow(state: GameState): void {
  if (!ready(state)) return;
  const p = state.player;
  const stack = p.inventory.find((it) => !it.slot && itemType(it.type).weapon?.throwable);
  if (!stack) {
    say(state, "You have nothing ready to throw.");
    return;
  }
  if (state.time < p.mainReady) return;
  throwItem(state, stack);
}
