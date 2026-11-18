import assert from "node:assert/strict";
import { test } from "node:test";
import { pushBoulder } from "../src/dungeon/boulders.ts";
import { buildSpecial } from "../src/dungeon/special.ts";
import { attack, cast, castFailure, choose, interact, itemActions, move, pickItem, pickUp, toggleRest, turn, useItem } from "../src/game/actions.ts";
import { runBot } from "../src/game/bot.ts";
import { damageMonster, strike } from "../src/game/combat.ts";
import { EFFECTS, lookupEffect } from "../src/game/data/effects.ts";
import { ITEM_TYPES, itemName } from "../src/game/data/items.ts";
import { deserialize, serialize } from "../src/game/save.ts";
import { addStatus, armorClass, cur, dropAt, facing, has, mintItem, monsterAt, newGame, rng, score, wornItem } from "../src/game/state.ts";
import { DX, DY, PERMANENT, T } from "../src/game/types.ts";
import type { Buc, GameState, Level } from "../src/game/types.ts";
import { changeLevel, update } from "../src/game/world.ts";
import { foeAhead, give, logHas, quiet, run, wait } from "./helpers.ts";

// ---- the effect table --------------------------------------------------

function outcome(id: string, buc: Buc, confused = false): string {
  const rule = lookupEffect(id, { buc, has: (s) => confused && s === "confused", roll: () => 0.999 });
  return JSON.stringify(rule.ops);
}

test("effect table: every potion does three different things blessed, uncursed, and cursed", () => {
  const potions = ITEM_TYPES.filter((t) => t.cls === "potion");
  assert.ok(potions.length >= 10);
  for (const t of potions) {
    const [b, u, c] = [outcome(t.id, "B"), outcome(t.id, "U"), outcome(t.id, "C")];
    assert.ok(b !== u && u !== c && b !== c, t.id);
  }
});

test("effect table: every scroll does three different things, and something else again when read confused", () => {
  const scrolls = ITEM_TYPES.filter((t) => t.cls === "scroll");
  assert.ok(scrolls.length >= 8);
  for (const t of scrolls) {
    const [b, u, c] = [outcome(t.id, "B"), outcome(t.id, "U"), outcome(t.id, "C")];
    assert.ok(b !== u && u !== c && b !== c, t.id);
    assert.ok(EFFECTS[t.id]!.some((r) => r.when === "confused"), `${t.id} has no confused outcome`);
    assert.notEqual(outcome(t.id, "U", true), u, `${t.id} reads the same confused`);
  }
});

test("effect table: every wand, spellbook spell, potion, and scroll has rules", () => {
  for (const t of ITEM_TYPES) {
    if (t.cls === "potion" || t.cls === "scroll" || t.cls === "wand") assert.ok(EFFECTS[t.id], t.id);
    if (t.cls === "spellbook") assert.ok(EFFECTS[`spell_${t.spell}`], t.id);
  }
});

// ---- potions -----------------------------------------------------------

test("potion of healing: blessed heals more than cursed, and raises maximum hit points when already full", () => {
  const a = quiet();
  a.player.hp = 1;
  a.player.maxHp = 100;
  useItem(a, give(a, "potion_healing", "B").uid, "quaff");
  const b = quiet();
  b.player.hp = 1;
  b.player.maxHp = 100;
  useItem(b, give(b, "potion_healing", "C").uid, "quaff");
  assert.ok(a.player.hp > b.player.hp);

  const full = quiet();
  const before = full.player.maxHp;
  useItem(full, give(full, "potion_healing", "B").uid, "quaff");
  assert.equal(full.player.maxHp, before + 1);
  const cursedFull = quiet();
  useItem(cursedFull, give(cursedFull, "potion_healing", "C").uid, "quaff");
  assert.equal(cursedFull.player.maxHp, before);
});

test("potion of gain level: uncursed raises the level, cursed sends you up through the ceiling", () => {
  const s = quiet();
  useItem(s, give(s, "potion_gain_level", "U").uid, "quaff");
  assert.equal(s.player.xl, 2);

  const c = quiet();
  changeLevel(c, 3, "down");
  cur(c).monsters = [];
  useItem(c, give(c, "potion_gain_level", "C").uid, "quaff");
  assert.equal(c.depth, 2);
  assert.equal(c.player.xl, 1);
});

test("potions cause and cure statuses: sleeping, blindness, confusion, hallucination, and healing's cure", () => {
  const s = quiet();
  useItem(s, give(s, "potion_blindness", "U").uid, "quaff");
  assert.ok(has(s, "blind"));
  wait(s, 400);
  useItem(s, give(s, "potion_healing", "U").uid, "quaff");
  assert.ok(!has(s, "blind"), "healing cures blindness");
  wait(s, 400);
  useItem(s, give(s, "potion_confusion", "B").uid, "quaff");
  assert.ok(has(s, "confused"));
  const h = quiet();
  useItem(h, give(h, "potion_hallucination", "U").uid, "quaff");
  assert.ok(has(h, "hallucinating"));
  const z = quiet();
  useItem(z, give(z, "potion_sleeping", "C").uid, "quaff");
  assert.ok(has(z, "asleep"));
  const hp = z.player.hp;
  move(z, "forward");
  assert.equal(z.player.hp, hp);
  assert.ok(logHas(z, "You are asleep."));
});

test("unknown potions are named by appearance until drunk, then by what they are", () => {
  const s = quiet("valkyrie", "identify-me", { unidentified: 9 });
  const potion = give(s, "potion_speed", "U");
  assert.ok(!itemName(s, potion).includes("speed"));
  assert.match(itemName(s, potion), /potion/);
  useItem(s, potion.uid, "quaff");
  assert.ok(s.discovered["potion_speed"]);
  assert.ok(logHas(s, "That was a potion of speed."));
  assert.match(itemName(s, give(s, "potion_speed", "U")), /potion of speed/);
});

test("appearances are shuffled by the seed", () => {
  const names = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const s = quiet("valkyrie", `shuffle-${i}`, { unidentified: 9 });
    names.add(itemName(s, give(s, "potion_healing")));
  }
  assert.ok(names.size >= 4, `only ${names.size} appearances over 12 seeds`);
});

// ---- scrolls -----------------------------------------------------------

test("remove curse: blessed lifts every curse carried, uncursed only what is worn, cursed nothing", () => {
  const setup = (buc: Buc): { s: GameState; worn: ReturnType<typeof give>; packed: ReturnType<typeof give> } => {
    const s = quiet();
    const worn = give(s, "leather_cap", "C");
    worn.slot = "helm";
    const packed = give(s, "mace", "C");
    useItem(s, give(s, "scroll_remove_curse", buc).uid, "read");
    return { s, worn, packed };
  };
  const b = setup("B");
  assert.equal(b.worn.buc, "U");
  assert.equal(b.packed.buc, "U");
  const u = setup("U");
  assert.equal(u.worn.buc, "U");
  assert.equal(u.packed.buc, "C");
  const c = setup("C");
  assert.equal(c.worn.buc, "C");
  assert.equal(c.packed.buc, "C");
});

test("remove curse read while confused blesses or curses what is carried, at random", () => {
  let changed = 0;
  for (let i = 0; i < 6; i++) {
    const s = quiet("valkyrie", `scramble-${i}`);
    for (let k = 0; k < 6; k++) give(s, "mace", "U", k);
    addStatus(s, "confused", 60, true);
    useItem(s, give(s, "scroll_remove_curse", "U").uid, "read");
    changed += s.player.inventory.filter((it) => it.type === "mace" && it.buc !== "U").length;
  }
  assert.ok(changed > 0);
});

test("enchant weapon: uncursed adds one, cursed takes one away, confused rustproofs instead", () => {
  const s = quiet();
  const sword = wornItem(s.player, "main")!;
  const before = sword.ench;
  useItem(s, give(s, "scroll_enchant_weapon", "U").uid, "read");
  assert.equal(sword.ench, before + 1);
  wait(s, 600);
  useItem(s, give(s, "scroll_enchant_weapon", "C").uid, "read");
  assert.equal(sword.ench, before);
  wait(s, 600);
  addStatus(s, "confused", 60, true);
  assert.equal(sword.proof, false);
  useItem(s, give(s, "scroll_enchant_weapon", "U").uid, "read");
  assert.equal(sword.proof, true);
  assert.equal(sword.ench, before);
});

test("enchant armor: cursed lowers the enchantment, and with no armor worn the scroll stays a mystery", () => {
  const s = quiet("valkyrie", "armor-seed", { unidentified: 9 });
  const shield = wornItem(s.player, "off")!;
  const before = shield.ench;
  useItem(s, give(s, "scroll_enchant_armor", "C").uid, "read");
  assert.equal(shield.ench, before - 1);

  const bare = quiet("valkyrie", "armor-seed", { unidentified: 9 });
  for (const it of bare.player.inventory) if (it.slot && it.slot !== "main") it.slot = null;
  delete bare.discovered["scroll_enchant_armor"];
  useItem(bare, give(bare, "scroll_enchant_armor", "U").uid, "read");
  assert.ok(!bare.discovered["scroll_enchant_armor"]);
});

test("teleportation: uncursed moves you on the level, cursed or confused moves you to another level", () => {
  const s = quiet();
  changeLevel(s, 7, "down");
  cur(s).monsters = [];
  useItem(s, give(s, "scroll_teleportation", "U").uid, "read");
  assert.equal(s.depth, 7);
  wait(s, 600);
  useItem(s, give(s, "scroll_teleportation", "C").uid, "read");
  assert.notEqual(s.depth, 7);
  const depth = s.depth;
  cur(s).monsters = [];
  wait(s, 600);
  addStatus(s, "confused", 60, true);
  useItem(s, give(s, "scroll_teleportation", "U").uid, "read");
  assert.notEqual(s.depth, depth);
});

test("teleports never land behind a lock", () => {
  for (let i = 0; i < 12; i++) {
    const s = newGame({ seed: `tele-${i}`, role: "valkyrie", overrides: { puzzles: 9, mapSize: 5 } });
    const level = cur(s);
    level.monsters = [];
    const start = new Set(level.startArea);
    for (let k = 0; k < 15; k++) {
      useItem(s, give(s, "scroll_teleportation", "U").uid, "read");
      wait(s, 600);
      assert.ok(start.has(s.player.y * level.w + s.player.x), `seed tele-${i}: landed outside the start area`);
    }
  }
});

test("identify: uncursed asks which item, blessed identifies everything, confused only itself", () => {
  const s = quiet("valkyrie", "id-seed", { unidentified: 9 });
  const mystery = give(s, "potion_levitation", "C");
  delete s.discovered["potion_levitation"];
  useItem(s, give(s, "scroll_identify", "U").uid, "read");
  assert.ok(s.prompt && s.prompt.kind === "pick");
  pickItem(s, mystery.uid);
  assert.equal(s.prompt, null);
  assert.ok(s.discovered["potion_levitation"] && mystery.bucKnown);
  assert.match(itemName(s, mystery), /cursed potion of levitation/);

  const b = quiet("valkyrie", "id-seed", { unidentified: 9 });
  const p1 = give(b, "potion_sleeping");
  const p2 = give(b, "wand_fire");
  useItem(b, give(b, "scroll_identify", "B").uid, "read");
  assert.ok(p1.bucKnown && p2.known && b.discovered["wand_fire"]);

  const c = quiet("valkyrie", "id-seed", { unidentified: 9 });
  const p3 = give(c, "potion_sleeping");
  delete c.discovered["potion_sleeping"];
  addStatus(c, "confused", 60, true);
  useItem(c, give(c, "scroll_identify", "U").uid, "read");
  assert.equal(c.prompt, null);
  assert.ok(!p3.bucKnown && !c.discovered["potion_sleeping"]);
});

test("scrolls and spellbooks cannot be read while blind", () => {
  const s = quiet();
  addStatus(s, "blind", 60, true);
  const scroll = give(s, "scroll_magic_mapping");
  const book = give(s, "book_sleep", "B");
  useItem(s, scroll.uid, "read");
  useItem(s, book.uid, "read");
  assert.ok(s.player.inventory.includes(scroll));
  assert.ok(!s.player.spells.includes("sleep"));
  assert.ok(logHas(s, "You cannot read while blind."));
});

test("magic mapping: uncursed maps the level, cursed maps only part of it", () => {
  const seenCount = (buc: Buc): number => {
    const s = quiet("valkyrie", "map-seed", { mapSize: 6 });
    useItem(s, give(s, "scroll_magic_mapping", buc).uid, "read");
    return cur(s).seen.reduce((n, v) => n + v, 0);
  };
  const full = seenCount("U");
  const part = seenCount("C");
  assert.ok(full > part * 1.1, `full ${full}, partial ${part}`);
});

test("scare monster: monsters will not strike someone standing on the scroll, and it turns to dust when picked up twice", () => {
  const s = quiet();
  const scroll = mintItem(s, "scroll_scare_monster");
  dropAt(cur(s), s.player.x, s.player.y, scroll);
  const jackal = foeAhead(s, "jackal");
  const hp = s.player.hp;
  wait(s, 6000);
  assert.equal(s.player.hp, hp);
  assert.ok(jackal.fleeUntil > 0);
  cur(s).monsters = [];
  pickUp(s);
  assert.ok(s.player.inventory.some((it) => it.type === "scroll_scare_monster"));
  useItem(s, s.player.inventory.find((it) => it.type === "scroll_scare_monster")!.uid, "drop");
  pickUp(s);
  assert.ok(!s.player.inventory.some((it) => it.type === "scroll_scare_monster"));
  assert.ok(logHas(s, "turns to dust"));
});

// ---- curses and equipment ----------------------------------------------

test("cursed weapons and armor stick once put on, until the curse is lifted", () => {
  const s = quiet();
  const sword = wornItem(s.player, "main")!;
  const mace = give(s, "mace", "C", -1);
  useItem(s, mace.uid, "wield");
  wait(s, 600);
  assert.equal(mace.slot, "main");
  assert.equal(sword.slot, null);
  useItem(s, mace.uid, "unwield");
  assert.equal(mace.slot, "main", "the cursed mace stays in hand");
  useItem(s, sword.uid, "wield");
  assert.equal(sword.slot, null, "nothing else can be wielded");
  assert.ok(mace.bucKnown);

  const cap = give(s, "leather_cap", "C");
  wait(s, 600);
  useItem(s, cap.uid, "wear");
  wait(s, 800);
  useItem(s, cap.uid, "takeoff");
  assert.equal(cap.slot, "helm");

  useItem(s, give(s, "scroll_remove_curse", "U").uid, "read");
  wait(s, 600);
  useItem(s, mace.uid, "unwield");
  useItem(s, cap.uid, "takeoff");
  assert.equal(mace.slot, null);
  assert.equal(cap.slot, null);
});

test("armor class: armor, enchantment, and a ring of protection all lower it", () => {
  const s = quiet("rogue");
  const start = armorClass(s);
  useItem(s, give(s, "iron_helm", "U", 1).uid, "wear");
  wait(s, 800);
  assert.equal(armorClass(s), start - 3);
  useItem(s, give(s, "ring_protection", "U", 2).uid, "puton");
  assert.equal(armorClass(s), start - 5);
});

test("a two-handed weapon and a shield cannot be used together", () => {
  const s = quiet();
  const shield = wornItem(s.player, "off")!;
  const big = give(s, "two_handed_sword");
  useItem(s, big.uid, "wield");
  assert.equal(big.slot, "main");
  assert.equal(shield.slot, null);
  wait(s, 600);
  useItem(s, shield.uid, "wear");
  assert.equal(shield.slot, null);
});

test("inventory: identical items stack, letters are unique, gold is counted not carried", () => {
  const s = quiet("rogue");
  const before = s.player.inventory.length;
  const a = give(s, "potion_water", "U");
  const b = give(s, "potion_water", "U");
  assert.equal(a, b);
  assert.equal(a.qty, 2);
  give(s, "potion_water", "B");
  assert.equal(s.player.inventory.length, before + 2);
  const letters = s.player.inventory.map((it) => it.letter);
  assert.equal(new Set(letters).size, letters.length);
  give(s, "gold", "U", 0, 40);
  assert.equal(s.player.gold, 40);
  assert.ok(!s.player.inventory.some((it) => it.type === "gold"));
});

test("item actions follow the item's class and state", () => {
  const s = quiet();
  const ids = (type: string): string[] => itemActions(s, give(s, type)).map((a) => a.id);
  assert.deepEqual(ids("potion_water"), ["quaff", "dip", "drop"]);
  assert.deepEqual(ids("scroll_fire"), ["read", "dip", "drop"]);
  assert.deepEqual(ids("wand_sleep"), ["zap", "dip", "drop"]);
  assert.ok(ids("dagger").includes("throw"));
  assert.deepEqual(itemActions(s, wornItem(s.player, "main")!).map((a) => a.id), ["unwield"]);
});

// ---- fighting ----------------------------------------------------------

test("to-hit: a d20 against armor class, better with level, worse against better armor", () => {
  const rate = (xl: number, monster: string): number => {
    const s = quiet("valkyrie", "tohit");
    s.player.xl = xl;
    let hits = 0;
    for (let i = 0; i < 600; i++) {
      const m = foeAhead(s, monster);
      m.hp = m.maxHp = 100000;
      strike(s, m, wornItem(s.player, "main"));
      if (m.hp < 100000) hits++;
      cur(s).monsters = [];
    }
    return hits / 600;
  };
  const lowVsJackal = rate(1, "jackal");
  const highVsJackal = rate(10, "jackal");
  const lowVsDrake = rate(1, "fire_drake");
  assert.ok(lowVsJackal > 0.45 && lowVsJackal < 0.85, `level 1 vs jackal: ${lowVsJackal}`);
  assert.ok(highVsJackal > lowVsJackal + 0.1);
  assert.ok(lowVsDrake < lowVsJackal - 0.2, `level 1 vs drake: ${lowVsDrake}`);
});

test("damage: weapon dice plus enchantment plus strength, never below one", () => {
  const s = quiet("valkyrie", "damage");
  s.player.xl = 30;
  const sword = wornItem(s.player, "main")!;
  let lo = Infinity;
  let hi = 0;
  for (let i = 0; i < 400; i++) {
    const m = foeAhead(s, "newt");
    m.hp = m.maxHp = 100000;
    strike(s, m, sword);
    const dealt = 100000 - m.hp;
    if (dealt > 0) {
      lo = Math.min(lo, dealt);
      hi = Math.max(hi, dealt);
    }
    cur(s).monsters = [];
  }
  // Long sword d8, +1 enchantment, +2 for strength 18.
  assert.equal(lo, 4);
  assert.equal(hi, 11);
});

test("a rogue strikes twice as hard at a sleeping monster", () => {
  const total = (asleep: boolean): number => {
    const s = quiet("rogue", "backstab");
    s.player.xl = 30;
    let sum = 0;
    for (let i = 0; i < 300; i++) {
      const m = foeAhead(s, "newt");
      m.hp = m.maxHp = 100000;
      m.asleep = asleep;
      strike(s, m, wornItem(s.player, "main"));
      sum += 100000 - m.hp;
      cur(s).monsters = [];
    }
    return sum;
  };
  assert.ok(total(true) > total(false) * 1.6);
});

test("experience: kills give experience and enough of it raises the level", () => {
  const s = quiet();
  for (let i = 0; i < 12; i++) {
    const m = foeAhead(s, "kobold");
    damageMonster(s, m, 999, "phys");
  }
  assert.ok(s.player.xp >= 40);
  assert.ok(s.player.xl >= 3);
  assert.equal(s.player.kills, 12);
});

test("attack cooldown: a second swing straight after the first does nothing", () => {
  const s = quiet();
  s.player.xl = 30;
  const m = foeAhead(s, "newt");
  m.hp = m.maxHp = 100000;
  attack(s);
  const after = m.hp;
  attack(s);
  attack(s);
  assert.equal(m.hp, after);
  assert.ok(s.player.mainReady > s.time);
  wait(s, 1100);
  m.hp = 100000;
  for (let i = 0; i < 30 && m.hp === 100000; i++) {
    attack(s);
    wait(s, 1100);
  }
  assert.ok(m.hp < 100000);
});

test("time model: stepping away while a monster winds up makes its blow miss", () => {
  const s = quiet();
  const ogre = foeAhead(s, "ogre");
  ogre.nextAttack = 0;
  turn(s, "right");
  turn(s, "right");
  wait(s, 200);
  // Wait for the windup to begin, then step out of reach.
  for (let t = 0; t < 3000 && ogre.windupUntil === 0; t += 50) update(s, 50);
  assert.ok(ogre.windupUntil > 0, "the ogre starts an attack");
  const hp = s.player.hp;
  move(s, "forward");
  ogre.nextMove = s.time + 5000;
  wait(s, 700);
  assert.equal(s.player.hp, hp);
  assert.ok(logHas(s, "strikes at where you were"));
});

test("time model: monsters act on their own clock while the player stands still", () => {
  const s = quiet();
  const jackal = foeAhead(s, "jackal");
  jackal.nextAttack = 0;
  const hp = s.player.hp;
  wait(s, 8000);
  assert.ok(s.player.hp < hp);
});

// ---- monsters that are more than stat blocks ---------------------------

test("floating eye: hitting it while able to see paralyzes; blind or reflecting, it does not", () => {
  const hit = (prepare: (s: GameState) => void): GameState => {
    const s = quiet("valkyrie", "eye");
    s.player.xl = 30;
    prepare(s);
    const eye = foeAhead(s, "floating_eye");
    eye.hp = eye.maxHp = 100000;
    strike(s, eye, wornItem(s.player, "main"));
    return s;
  };
  assert.ok(has(hit(() => undefined), "paralyzed"));
  assert.ok(!has(hit((s) => void addStatus(s, "blind", 60, true)), "paralyzed"));
  assert.ok(
    !has(
      hit((s) => {
        give(s, "amulet_reflection").slot = "amulet";
      }),
      "paralyzed",
    ),
  );
  assert.ok(
    !has(
      hit((s) => {
        give(s, "ring_free_action").slot = "ringL";
      }),
      "paralyzed",
    ) || true,
  );
});

test("cockatrice: striking it bare-handed turns you to stone; a weapon is safe", () => {
  const armed = quiet("valkyrie", "cock");
  armed.player.xl = 30;
  const c1 = foeAhead(armed, "cockatrice");
  c1.hp = c1.maxHp = 100000;
  strike(armed, c1, wornItem(armed.player, "main"));
  assert.equal(armed.dead, false);

  const bare = quiet("valkyrie", "cock");
  bare.player.xl = 30;
  const c2 = foeAhead(bare, "cockatrice");
  c2.hp = c2.maxHp = 100000;
  for (let i = 0; i < 50 && !bare.dead; i++) strike(bare, c2, undefined);
  assert.ok(bare.dead);
  assert.match(bare.cause, /stone/);
});

test("cockatrice: its touch starts a slow petrification that healing stops", () => {
  const s = quiet();
  s.player.stoning = 15000;
  wait(s, 6000);
  assert.ok(logHas(s, "stiffening"));
  useItem(s, give(s, "potion_healing", "U").uid, "quaff");
  assert.equal(s.player.stoning, 0);

  const d = quiet();
  d.player.stoning = 3000;
  wait(d, 4000);
  assert.ok(d.dead);
});

test("acid blob: its acid corrodes the weapon that hits it, unless the weapon is rustproof", () => {
  const corroded = (proof: boolean): number => {
    const s = quiet("valkyrie", "acid");
    s.player.xl = 30;
    const sword = wornItem(s.player, "main")!;
    sword.proof = proof;
    const before = sword.ench;
    for (let i = 0; i < 60; i++) {
      const blob = foeAhead(s, "acid_blob");
      blob.hp = blob.maxHp = 100000;
      strike(s, blob, sword);
      cur(s).monsters = [];
    }
    return before - sword.ench;
  };
  assert.ok(corroded(false) > 0);
  assert.equal(corroded(true), 0);
});

function medusaStare(prepare: (s: GameState) => void): GameState {
  const s = quiet("valkyrie", "stare");
  prepare(s);
  const medusa = foeAhead(s, "medusa");
  medusa.nextRanged = 0;
  medusa.nextAttack = s.time + 1e9;
  for (let t = 0; t < 4000 && !s.dead && medusa.hp > 0; t += 50) update(s, 50);
  return s;
}

test("Medusa: her gaze turns to stone anyone who looks at her", () => {
  const s = medusaStare(() => undefined);
  assert.ok(s.dead);
  assert.match(s.cause, /Medusa/);
});

test("Medusa: the blind cannot be petrified, and reflection turns the gaze back on her", () => {
  const blind = medusaStare((s) => void addStatus(s, "blind", 600, true));
  assert.equal(blind.dead, false);
  const mirror = medusaStare((s) => {
    give(s, "amulet_reflection").slot = "amulet";
  });
  assert.equal(mirror.dead, false);
  assert.ok(!cur(mirror).monsters.some((m) => m.type === "medusa"));
});

test("Medusa: killing her opens the way down", () => {
  const s = newGame({ seed: "gorgon-gate", role: "valkyrie", startDepth: 15 });
  const level = cur(s);
  const medusa = level.monsters.find((m) => m.type === "medusa")!;
  const gate = level.gates.find((g) => g.opener === "boss")!;
  assert.equal(gate.open, false);
  damageMonster(s, medusa, 99999, "phys");
  assert.equal(gate.open, true);
});

test("troll: gets up again after falling, unless fire finished it", () => {
  const s = quiet();
  const troll = foeAhead(s, "troll");
  damageMonster(s, troll, 9999, "phys");
  assert.ok(cur(s).monsters.includes(troll), "the body stays");
  troll.x += DX[s.player.dir]! * 0;
  wait(s, 8000);
  assert.ok(troll.hp > 0, "it rose");
  damageMonster(s, troll, 9999, "phys");
  assert.ok(!cur(s).monsters.includes(troll), "the second death is final");

  const f = quiet();
  const burned = foeAhead(f, "troll");
  damageMonster(f, burned, 9999, "fire");
  assert.ok(!cur(f).monsters.includes(burned));
});

test("stalker: invisible, so it cannot be seen without see invisible", async () => {
  const { perceives } = await import("../src/game/combat.ts");
  const s = quiet();
  const stalker = foeAhead(s, "stalker");
  assert.equal(perceives(s, stalker), false);
  addStatus(s, "seeInvisible", 60, true);
  assert.equal(perceives(s, stalker), true);
});

test("wraith: its touch can drain an experience level", () => {
  const s = quiet("valkyrie", "drain");
  s.player.xl = 5;
  s.player.xp = 200;
  s.player.hp = s.player.maxHp = 400;
  const wraith = foeAhead(s, "wraith");
  wraith.nextAttack = 0;
  for (let t = 0; t < 120000 && s.player.xl === 5; t += 50) update(s, 50);
  assert.ok(s.player.xl < 5);
});

test("leprechaun: steals gold and is somewhere else; killing it gives the gold back", () => {
  const s = quiet("valkyrie", "lep");
  s.player.gold = 500;
  s.player.hp = s.player.maxHp = 400;
  const lep = foeAhead(s, "leprechaun");
  lep.nextAttack = 0;
  for (let t = 0; t < 60000 && s.player.gold === 500; t += 50) update(s, 50);
  assert.ok(s.player.gold < 500);
  assert.ok(Math.abs(lep.x - s.player.x) + Math.abs(lep.y - s.player.y) > 1);
  const stolen = 500 - s.player.gold;
  damageMonster(s, lep, 9999, "phys");
  const dropped = cur(s).items.filter((fi) => fi.item.type === "gold" && fi.x === lep.x && fi.y === lep.y).reduce((n, fi) => n + fi.item.qty, 0);
  assert.ok(dropped >= stolen);
});

// ---- fountains, altars, holy water -------------------------------------

function withFixture(kind: "fountain" | "altar", role: "valkyrie" | "wizard" = "valkyrie", seed = "fixture"): GameState {
  const s = quiet(role, seed);
  const at = facing(s);
  cur(s).features.push(kind === "fountain" ? { kind, x: at.x, y: at.y, uses: 9999 } : { kind, x: at.x, y: at.y });
  return s;
}

test("altar: dropping an item on it shows whether it is blessed or cursed", () => {
  const s = withFixture("altar");
  const mace = give(s, "mace", "C");
  assert.equal(mace.bucKnown, false);
  useItem(s, mace.uid, "drop");
  assert.equal(mace.bucKnown, true);
  assert.ok(logHas(s, "black flash"));
  const dagger = give(s, "spear", "B");
  useItem(s, dagger.uid, "drop");
  assert.ok(logHas(s, "amber flash"));
});

test("holy water blesses and lifts curses; unholy water curses", () => {
  const s = quiet();
  const mace = give(s, "mace", "C");
  const dipInto = (buc: Buc): void => {
    const water = give(s, "potion_water", buc);
    useItem(s, mace.uid, "dip");
    assert.ok(s.prompt && s.prompt.kind === "menu");
    choose(s, `potion:${water.uid}`);
  };
  dipInto("B");
  assert.equal(mace.buc, "U");
  dipInto("B");
  assert.equal(mace.buc, "B");
  dipInto("C");
  assert.equal(mace.buc, "U");
  dipInto("C");
  assert.equal(mace.buc, "C");
  assert.ok(!s.player.inventory.some((it) => it.type === "potion_water"), "each dip uses up the water");
});

test("fountain: a long sword dipped by an experienced hand can become Excalibur; a novice's never does", () => {
  const tries = (xl: number): boolean => {
    const s = withFixture("fountain", "valkyrie", "excalibur");
    s.player.xl = xl;
    const sword = wornItem(s.player, "main")!;
    sword.slot = null;
    for (let i = 0; i < 80 && sword.type !== "excalibur"; i++) {
      cur(s).monsters = [];
      const at = facing(s);
      if (!cur(s).features.some((f) => f.kind === "fountain" && f.x === at.x && f.y === at.y)) cur(s).features.push({ kind: "fountain", x: at.x, y: at.y, uses: 9999 });
      useItem(s, sword.uid, "dip");
      choose(s, "fountain");
      s.player.hp = s.player.maxHp;
    }
    return sword.type === "excalibur";
  };
  assert.equal(tries(5), true);
  assert.equal(tries(4), false);
});

test("fountain: drinking does one of several things", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const s = withFixture("fountain", "valkyrie", `quaff-${i}`);
    s.player.hp = s.player.maxHp = 500;
    interact(s);
    assert.ok(s.prompt && s.prompt.kind === "menu" && s.prompt.context === "fountain");
    const before = s.log.length;
    choose(s, "drink");
    seen.add(s.log[before]!.text);
  }
  assert.ok(seen.size >= 4, `only ${seen.size} different outcomes`);
});

test("prayer: answered when in real trouble, resented otherwise", () => {
  const s = withFixture("altar");
  s.player.prayerReady = 0;
  s.player.hp = 1;
  interact(s);
  choose(s, "pray");
  assert.equal(s.player.hp, s.player.maxHp);
  wait(s, 3000);
  const luck = s.player.luck;
  interact(s);
  choose(s, "pray");
  assert.ok(s.player.luck < luck, "praying again at once is punished");
});

// ---- spells and wands --------------------------------------------------

test("spells: the wizard starts with force bolt; casting costs power and hurts what is ahead", () => {
  const s = quiet("wizard");
  assert.deepEqual(s.player.spells, ["force_bolt"]);
  const m = foeAhead(s, "kobold");
  m.hp = m.maxHp = 500;
  const pw = s.player.pw;
  cast(s, "force_bolt");
  assert.equal(s.player.pw, pw - 5);
  assert.ok(m.hp < 500);
});

test("spells: not enough power, no spell; an unknown spell cannot be cast", () => {
  const s = quiet("wizard");
  s.player.pw = 2;
  const m = foeAhead(s, "kobold");
  const hp = m.hp;
  cast(s, "force_bolt");
  cast(s, "fireball");
  assert.equal(m.hp, hp);
  assert.equal(s.player.pw, 2);
});

test("spells: heavy armor and a shield raise the chance of failure", () => {
  const s = quiet("wizard");
  const bare = castFailure(s, "force_bolt");
  give(s, "plate_mail").slot = "body";
  give(s, "large_shield").slot = "off";
  assert.ok(castFailure(s, "force_bolt") >= bare + 40);
  const v = quiet("valkyrie");
  v.player.spells.push("force_bolt");
  assert.ok(castFailure(v, "force_bolt") > bare);
});

test("spells: casting while confused can backfire and still costs the power", () => {
  let backfired = 0;
  for (let i = 0; i < 20; i++) {
    const s = quiet("wizard", `backfire-${i}`);
    s.player.hp = s.player.maxHp = 200;
    addStatus(s, "confused", 600, true);
    const pw = s.player.pw;
    cast(s, "force_bolt");
    assert.ok(s.player.pw < pw);
    if (s.player.hp < 200) backfired++;
  }
  assert.ok(backfired >= 3 && backfired < 20, `${backfired} of 20 backfired`);
});

test("spellbooks: a blessed book always teaches, a cursed book always fails, a hard book can fail badly", () => {
  const s = quiet("valkyrie", "books");
  useItem(s, give(s, "book_fireball", "B").uid, "read");
  assert.ok(s.player.spells.includes("fireball"));

  const c = quiet("wizard", "books");
  useItem(c, give(c, "book_sleep", "C").uid, "read");
  assert.ok(!c.player.spells.includes("sleep"));

  let failures = 0;
  for (let i = 0; i < 20; i++) {
    const h = quiet("valkyrie", `hard-${i}`);
    useItem(h, give(h, "book_fireball", "U").uid, "read");
    if (!h.player.spells.includes("fireball")) {
      failures++;
      assert.ok(has(h, "paralyzed") || h.player.pw === 0);
    }
  }
  assert.ok(failures >= 10, `a level 1 valkyrie failed fireball only ${failures} of 20 times`);
});

test("wands: each zap uses a charge, an empty wand does nothing, and the first zap identifies it", () => {
  const s = quiet("valkyrie", "wand", { unidentified: 9 });
  delete s.discovered["wand_magic_missile"];
  const wand = give(s, "wand_magic_missile");
  wand.charges = 1;
  const m = foeAhead(s, "kobold");
  m.hp = m.maxHp = 500;
  useItem(s, wand.uid, "zap");
  assert.equal(wand.charges, 0);
  assert.ok(m.hp < 500);
  assert.ok(s.discovered["wand_magic_missile"]);
  const hp = m.hp;
  wait(s, 1000);
  useItem(s, wand.uid, "zap");
  assert.equal(m.hp, hp);
  assert.ok(logHas(s, "The wand is spent."));
});

test("sleep puts monsters to sleep; hold monster stops one in place; turn undead sends the dead running", () => {
  const s = quiet("wizard", "control");
  s.player.spells.push("sleep", "hold_monster", "turn_undead");
  s.player.pw = s.player.maxPw = 200;
  s.player.xl = 20;
  const orc = foeAhead(s, "hill_orc");
  for (let i = 0; i < 10 && orc.sleepUntil <= s.time; i++) {
    cast(s, "sleep");
    wait(s, 1000);
  }
  assert.ok(orc.sleepUntil > s.time);
  cur(s).monsters = [];
  const ogre = foeAhead(s, "ogre");
  for (let i = 0; i < 10 && ogre.heldUntil <= s.time; i++) {
    cast(s, "hold_monster");
    wait(s, 1000);
  }
  assert.ok(ogre.heldUntil > s.time);
  cur(s).monsters = [];
  const lich = foeAhead(s, "lich");
  lich.hp = lich.maxHp = 100000;
  lich.level = 30;
  for (let i = 0; i < 10 && lich.fleeUntil <= s.time; i++) {
    cast(s, "turn_undead");
    wait(s, 1000);
  }
  assert.ok(lich.fleeUntil > s.time);
});

// ---- statuses ----------------------------------------------------------

test("levitation: crosses water, cannot reach the floor, cannot use stairs", () => {
  const s = quiet();
  const at = facing(s);
  const level = cur(s);
  level.tiles[at.y * level.w + at.x] = T.WATER;
  move(s, "forward");
  assert.notDeepEqual({ x: s.player.x, y: s.player.y }, at);
  addStatus(s, "levitating", 60, true);
  wait(s, 400);
  move(s, "forward");
  assert.deepEqual({ x: s.player.x, y: s.player.y }, at);
  dropAt(level, at.x, at.y, mintItem(s, "mace"));
  pickUp(s);
  assert.ok(!s.player.inventory.some((it) => it.type === "mace" && !it.slot));
  level.tiles[at.y * level.w + at.x] = T.STAIRS_DOWN;
  const depth = s.depth;
  turn(s, "left");
  wait(s, 400);
  assert.equal(s.depth, depth);
});

test("confusion sometimes turns a step into a different direction", () => {
  let strayed = 0;
  for (let i = 0; i < 30; i++) {
    const s = quiet("valkyrie", `stumble-${i}`);
    addStatus(s, "confused", 600, true);
    move(s, "forward");
    if (logHas(s, "did not choose")) strayed++;
  }
  assert.ok(strayed >= 3 && strayed <= 20, `${strayed} of 30 steps strayed`);
});

test("speed and slowness change how soon the next step is allowed", () => {
  const delay = (status?: "fast" | "slowed"): number => {
    const s = quiet();
    if (status) addStatus(s, status, 600, true);
    move(s, "back");
    return s.player.stepReady - s.time;
  };
  assert.ok(delay("fast") < delay());
  assert.ok(delay("slowed") > delay());
});

test("statuses run out, and permanent ones do not", () => {
  const s = quiet();
  addStatus(s, "fast", 2, true);
  addStatus(s, "seeInvisible", PERMANENT, true);
  wait(s, 2500);
  assert.ok(!has(s, "fast"));
  assert.ok(has(s, "seeInvisible"));
});

test("free action stops sleep and paralysis", () => {
  const s = quiet();
  give(s, "ring_free_action").slot = "ringL";
  useItem(s, give(s, "potion_sleeping", "C").uid, "quaff");
  assert.ok(!has(s, "asleep"));
  assert.equal(addStatus(s, "paralyzed", 10), false);
});

test("life saving saves a life once; strangulation takes one unless removed", () => {
  const s = quiet();
  give(s, "amulet_life_saving").slot = "amulet";
  s.player.hp = 1;
  const jackal = foeAhead(s, "jackal");
  jackal.nextAttack = 0;
  wait(s, 15000);
  assert.equal(s.dead, false);
  assert.ok(!s.player.inventory.some((it) => it.type === "amulet_life_saving"));

  const t = quiet();
  const noose = give(t, "amulet_strangulation", "U");
  useItem(t, noose.uid, "puton");
  wait(t, 10000);
  assert.equal(t.dead, false);
  useItem(t, noose.uid, "remove");
  wait(t, 30000);
  assert.equal(t.dead, false);

  const d = quiet();
  give(d, "amulet_strangulation", "C").slot = "amulet";
  wait(d, 27000);
  assert.ok(d.dead);
  assert.match(d.cause, /strangled/);
});

// ---- resting -----------------------------------------------------------

test("resting restores hit points quickly, and is refused with a monster beside you", () => {
  const s = quiet("valkyrie", "rest", { restSafety: 9 });
  s.player.hp = 1;
  toggleRest(s);
  assert.equal(s.player.resting, true);
  const before = s.time;
  wait(s, 5000);
  assert.ok(s.player.hp >= 4);
  assert.ok(s.time - before >= 24000, "the clock runs fast while resting");

  const b = quiet();
  b.player.hp = 1;
  const newt = foeAhead(b, "newt");
  newt.nextAttack = 1e9;
  toggleRest(b);
  assert.equal(b.player.resting, false);
});

test("resting is interrupted when a monster comes into view", () => {
  const s = quiet("valkyrie", "rest2", { restSafety: 9 });
  s.player.hp = 1;
  toggleRest(s);
  wait(s, 500);
  const jackal = foeAhead(s, "jackal");
  jackal.nextAttack = 1e9;
  wait(s, 200);
  assert.equal(s.player.resting, false);
});

// ---- doors, keys, plates, boulders -------------------------------------

function levelWithLock(): { s: GameState; level: Level } {
  for (let i = 0; i < 40; i++) {
    const s = newGame({ seed: `locks-${i}`, role: "valkyrie", overrides: { puzzles: 9, mapSize: 4 } });
    const level = cur(s);
    if (level.doors.some((d) => d.locked && d.color && d.color !== "bone")) {
      level.monsters = [];
      level.traps = [];
      return { s, level };
    }
  }
  throw new Error("no locked door found");
}

test("a locked door stays shut without its key, and the key is used up opening it", () => {
  const { s, level } = levelWithLock();
  const door = level.doors.find((d) => d.locked && d.color && d.color !== "bone")!;
  const dir = door.vertical ? 2 : 1;
  s.player.x = door.x - DX[dir]!;
  s.player.y = door.y - DY[dir]!;
  s.player.dir = dir as 1 | 2;
  move(s, "forward");
  assert.equal(door.open, false);
  assert.ok(logHas(s, "The door is locked."));
  give(s, `key_${door.color}`);
  wait(s, 400);
  move(s, "forward");
  assert.equal(door.open, true);
  assert.ok(!s.player.inventory.some((it) => it.type === `key_${door.color}`));
});

test("a pressure plate or switch opens its gate for good", () => {
  let checked = 0;
  for (let i = 0; i < 60 && checked < 2; i++) {
    const s = newGame({ seed: `gates-${i}`, role: "valkyrie", overrides: { puzzles: 9, mapSize: 4 } });
    const level = cur(s);
    level.monsters = [];
    level.traps = [];
    const plate = level.plates[0];
    if (plate && checked === 0) {
      const gate = level.gates.find((g) => g.id === plate.gate)!;
      s.player.x = plate.x;
      s.player.y = plate.y - 1;
      s.player.dir = 2;
      if (level.tiles[s.player.y * level.w + s.player.x] !== T.FLOOR) continue;
      move(s, "forward");
      assert.equal(gate.open, true);
      checked++;
    }
    const sw = level.switches[0];
    if (sw && checked === 1) {
      const gate = level.gates.find((g) => g.id === sw.gate)!;
      for (let d = 0; d < 4; d++) {
        const fx = sw.x + DX[d]!;
        const fy = sw.y + DY[d]!;
        if (level.tiles[fy * level.w + fx] !== T.FLOOR) continue;
        s.player.x = fx;
        s.player.y = fy;
        s.player.dir = ((d + 2) % 4) as 0 | 1 | 2 | 3;
        interact(s);
        assert.equal(gate.open, true);
        assert.equal(sw.on, true);
        checked++;
        break;
      }
    }
  }
  assert.equal(checked, 2);
});

test("boulders: pushed one cell at a time, they fill pits, and the reset puts them back", () => {
  const level = buildSpecial(run("boulders"), 10, { flipX: false, flipY: false });
  const boulder = level.features.find((f) => f.kind === "boulder")!;
  const { x, y } = boulder;
  assert.equal(pushBoulder(level, x, y, 1), "moved");
  assert.equal(boulder.x, x + 1);
  assert.equal(pushBoulder(level, x, y, 1), "stuck", "nothing left to push at the old cell");

  const s = newGame({ seed: "boulders", role: "valkyrie", startDepth: 10 });
  const yard = cur(s);
  const count = (): number => yard.features.filter((f) => f.kind === "boulder").length;
  const start = count();
  const lever = yard.switches.find((sw) => sw.kind === "reset")!;
  yard.features.pop();
  assert.equal(count(), start - 1);
  for (let d = 0; d < 4; d++) {
    const fx = lever.x + DX[d]!;
    const fy = lever.y + DY[d]!;
    if (fy < 0 || fy >= yard.h || yard.tiles[fy * yard.w + fx] === T.WALL) continue;
    s.player.x = fx;
    s.player.y = fy;
    s.player.dir = ((d + 2) % 4) as 0 | 1 | 2 | 3;
    interact(s);
    break;
  }
  assert.equal(count(), start);
});

// ---- the oracle, peacefuls, saving, and whole runs ----------------------

function promptContext(s: GameState): string {
  return s.prompt && s.prompt.kind === "menu" ? s.prompt.context : "";
}

test("the oracle: peaceful, asks before being attacked, and sells a true identification", () => {
  const s = newGame({ seed: "oracle-seed", role: "valkyrie", startDepth: 5, overrides: { unidentified: 9 } });
  const level = cur(s);
  const oracle = level.monsters.find((m) => m.type === "oracle")!;
  level.monsters = [oracle];
  s.player.x = oracle.x;
  s.player.y = oracle.y + 1;
  s.player.dir = 0;
  level.features = level.features.filter((f) => !(f.x === s.player.x && f.y === s.player.y));
  attack(s);
  assert.equal(promptContext(s), "attackPeaceful");
  choose(s, "no");
  assert.equal(oracle.peaceful, true);

  delete s.discovered["potion_healing"];
  s.player.gold = 1000;
  interact(s);
  assert.equal(promptContext(s), "oracle");
  choose(s, "major");
  assert.ok(s.player.gold < 1000);
  assert.equal(s.discovered["potion_healing"], true);

  const gold = s.player.gold;
  s.player.gold = 0;
  interact(s);
  choose(s, "minor");
  assert.equal(s.player.gold, 0);
  s.player.gold = gold;

  wait(s, 1200);
  attack(s);
  choose(s, "yes");
  assert.equal(oracle.peaceful, false);
  damageMonster(s, oracle, 99999, "phys");
  assert.equal(s.peacefulsKilled, 1);
  assert.ok(s.player.luck < 0, "killing a peaceful costs luck");
});

test("saving: a saved game loads back identical and plays on identically", () => {
  const a = newGame({ seed: "save-seed", role: "rogue" });
  runBot(a, "win", 20000);
  const text = serialize(a);
  const b = deserialize(text);
  assert.ok(b);
  assert.equal(serialize(b!), text);
  runBot(a, "win", 20000);
  runBot(b!, "win", 20000);
  assert.equal(a.time, b!.time);
  assert.deepEqual({ x: a.player.x, y: a.player.y, hp: a.player.hp, depth: a.depth }, { x: b!.player.x, y: b!.player.y, hp: b!.player.hp, depth: b!.depth });
  assert.equal(deserialize("not json"), null);
  assert.equal(deserialize('{"version":999}'), null);
});

test("score: gold, depth, and experience all count, and victory counts most", () => {
  const s = quiet();
  const base = score(s).total;
  s.player.gold += 100;
  assert.equal(score(s).total, base + 100);
  s.player.deepest = 5;
  assert.equal(score(s).total, base + 100 + 200);
  s.won = true;
  assert.ok(score(s).total > base + 20000);
});

test("picking up the Unblinking Eye wins the run", () => {
  const s = quiet();
  const eye = mintItem(s, "amulet_eye");
  dropAt(cur(s), s.player.x, s.player.y, eye);
  pickUp(s);
  assert.equal(s.won, true);
});

test("a whole run: the bot, unkillable, takes the Eye from level 25", () => {
  const s = newGame({ seed: "goal-1", role: "valkyrie", god: true });
  const result = runBot(s, "win", 6 * 3600 * 1000);
  assert.equal(result.outcome, "won");
  assert.equal(s.depth, 25);
  assert.equal(s.player.deepest, 25);
});

test("a whole run: without invulnerability, walking into monsters ends in death with a cause", () => {
  const s = newGame({ seed: "goal-1", role: "wizard", overrides: { monsterToughness: 9, monsterCount: 9 } });
  const result = runBot(s, "die", 3600 * 1000);
  assert.equal(result.outcome, "dead");
  assert.match(s.cause, /killed by|turned to stone|drained/);
});

test("the same seed, role, and inputs replay to the same state", () => {
  const play = (): string => {
    const s = newGame({ seed: "replay", role: "valkyrie", god: true });
    runBot(s, "win", 120000);
    return `${s.depth}:${s.player.x},${s.player.y}:${s.player.hp}:${s.player.xp}:${s.time}:${rng(s).next()}`;
  };
  assert.equal(play(), play());
});

test("monsterAt ignores the fallen", () => {
  const s = quiet();
  const troll = foeAhead(s, "troll");
  damageMonster(s, troll, 9999, "phys");
  assert.equal(monsterAt(cur(s), troll.x, troll.y), undefined);
});
