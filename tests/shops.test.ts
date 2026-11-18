import assert from "node:assert/strict";
import { test } from "node:test";
import { MODIFIERS } from "../src/core/modifiers.ts";
import { generateLevel } from "../src/dungeon/generate.ts";
import { solveLevel } from "../src/dungeon/solve.ts";
import { choose, interact, useItem } from "../src/game/actions.ts";
import { damageMonster } from "../src/game/combat.ts";
import { itemName } from "../src/game/data/items.ts";
import { RUMORS } from "../src/game/data/rumors.ts";
import { SHOPS, buy, buyPrice, closeShop, nextRumor, seedRumors, sell, sellPrice } from "../src/game/shops.ts";
import { addStatus, armorClass, cur, isLit, newGame } from "../src/game/state.ts";
import { DX, DY, T } from "../src/game/types.ts";
import type { GameState, Monster } from "../src/game/types.ts";
import { update, updateSeen } from "../src/game/world.ts";
import { give, logHas, quiet, run, wait } from "./helpers.ts";

/** A game on a level that has the wanted kind of character, standing next to it and facing it. */
function beside(kind: string, overrides: Record<string, number> = {}): { s: GameState; who: Monster } {
  for (let i = 0; i < 200; i++) {
    for (const depth of [1, 2, 3]) {
      const s = newGame({ seed: `folk-${i}`, role: "valkyrie", startDepth: depth, overrides: { shopFrequency: 9, npcs: 9, fountains: 9, mapSize: 5, ...overrides } });
      const level = cur(s);
      const who = level.monsters.find((m) => m.npc?.kind === kind);
      if (!who) continue;
      for (let d = 0; d < 4; d++) {
        const x = who.x - DX[d]!;
        const y = who.y - DY[d]!;
        if (level.tiles[y * level.w + x] !== T.FLOOR || level.features.some((f) => f.x === x && f.y === y) || level.monsters.some((m) => m.x === x && m.y === y)) continue;
        level.monsters = level.monsters.filter((m) => m.peaceful);
        level.traps = [];
        s.player.x = x;
        s.player.y = y;
        s.player.dir = d as 0 | 1 | 2 | 3;
        return { s, who };
      }
    }
  }
  throw new Error(`no ${kind} found`);
}

test("modifiers: seventeen, with unique codes", () => {
  assert.equal(MODIFIERS.length, 17);
  assert.equal(new Set(MODIFIERS.map((m) => m.code)).size, 17);
  for (const id of ["shopFrequency", "shopPrices", "npcs"]) assert.ok(MODIFIERS.some((m) => m.id === id), id);
});

test("shops: frequency follows the modifier, and a level never has more than one", () => {
  let none = 0;
  let many = 0;
  for (let s = 0; s < 30; s++) {
    const off = generateLevel(run(`shopfreq-${s}`, { shopFrequency: 1, mapSize: 5 }), 3);
    const on = generateLevel(run(`shopfreq-${s}`, { shopFrequency: 9, mapSize: 5 }), 3);
    none += off.monsters.filter((m) => m.type === "shopkeeper").length;
    const keepers = on.monsters.filter((m) => m.type === "shopkeeper").length;
    assert.ok(keepers <= 1);
    many += keepers;
  }
  assert.equal(none, 0);
  assert.ok(many >= 20, `only ${many} shops in 30 levels at the maximum`);
});

test("shops: a room with one door, the keeper inside beside it, nothing else generated in it", () => {
  let checked = 0;
  for (let s = 0; s < 40 && checked < 12; s++) {
    const level = generateLevel(run(`shoproom-${s}`, { shopFrequency: 9, monsterCount: 9, lootAmount: 9, mapSize: 5 }), 4);
    const keeper = level.monsters.find((m) => m.type === "shopkeeper");
    if (!keeper) continue;
    checked++;
    // Flood the room from the keeper without passing doors: that is the shop.
    const room = new Set<number>([keeper.y * level.w + keeper.x]);
    const queue = [...room];
    const doors = new Set<number>();
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head]!;
      for (let d = 0; d < 4; d++) {
        const x = (c % level.w) + DX[d]!;
        const y = Math.floor(c / level.w) + DY[d]!;
        const i = y * level.w + x;
        if (level.tiles[i] === T.DOOR) doors.add(i);
        if (level.tiles[i] !== T.FLOOR || room.has(i)) continue;
        room.add(i);
        queue.push(i);
      }
    }
    assert.equal(doors.size, 1, `seed shoproom-${s}: the shop has ${doors.size} doors`);
    assert.ok(room.size >= 9);
    const door = [...doors][0]!;
    const dist = Math.abs((door % level.w) - keeper.x) + Math.abs(Math.floor(door / level.w) - keeper.y);
    assert.ok(dist <= 2, "the keeper stands by the door");
    assert.equal(level.monsters.filter((m) => m !== keeper && room.has(m.y * level.w + m.x)).length, 0, "no monsters in the shop");
    assert.equal(level.items.filter((fi) => room.has(fi.y * level.w + fi.x)).length, 0, "no loose items in the shop");
    assert.ok(keeper.npc && keeper.npc.stock && keeper.npc.stock.length >= 4);
    assert.ok(solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok);
  }
  assert.ok(checked >= 12);
});

test("shops: all six kinds turn up, and the lamp shop is Old Wick's", () => {
  const seen = new Map<string, string>();
  for (let s = 0; s < 400 && seen.size < SHOPS.length; s++) {
    const level = generateLevel(run(`kinds-${s}`, { shopFrequency: 9 }), 2);
    const keeper = level.monsters.find((m) => m.type === "shopkeeper");
    if (keeper?.npc?.shop) seen.set(keeper.npc.shop, keeper.npc.name);
  }
  assert.equal(seen.size, 6);
  assert.equal(seen.get("lighting"), "Old Wick");
  assert.ok(SHOPS.length >= 5);
});

test("peaceful characters never block the way down", () => {
  for (let s = 0; s < 25; s++) {
    for (const depth of [1, 6, 12, 18, 23]) {
      const level = generateLevel(run(`crowd-${s}`, { npcs: 9, shopFrequency: 9, fountains: 9 }), depth);
      assert.ok(solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok, `seed crowd-${s} level ${depth}`);
    }
  }
});

test("buying: gold falls by the quoted price and the item arrives in the pack", () => {
  const { s, who } = beside("shopkeeper");
  s.player.gold = 5000;
  interact(s);
  assert.ok(s.prompt && s.prompt.kind === "shop");
  const item = who.npc!.stock![0]!;
  const price = buyPrice(s, item);
  const type = item.type;
  const had = s.player.inventory.filter((it) => it.type === type).reduce((n, it) => n + it.qty, 0);
  assert.equal(buy(s, item.uid), true);
  assert.equal(s.player.gold, 5000 - price);
  assert.equal(s.player.inventory.filter((it) => it.type === type).reduce((n, it) => n + it.qty, 0), had + 1);

  s.player.gold = 0;
  const next = who.npc!.stock![0]!;
  assert.equal(buy(s, next.uid), false);
  assert.equal(s.player.gold, 0);
});

test("selling: pays half an item's worth, less than buying it costs, and only for the shop's own kind of goods", () => {
  const { s, who } = beside("shopkeeper");
  interact(s);
  const kind = who.npc!.shop!;
  const def = SHOPS.find((x) => x.id === kind)!;
  const sellable = def.classes === null || def.classes.includes("weapon") ? "mace" : def.classes.includes("armor") ? "leather_cap" : def.classes.includes("potion") ? "potion_water" : def.classes.includes("scroll") ? "scroll_fire" : "lamp";
  const mine = give(s, sellable);
  const price = sellPrice(s, mine);
  assert.ok(price < buyPrice(s, mine));
  const gold = s.player.gold;
  assert.equal(sell(s, mine.uid), true);
  assert.equal(s.player.gold, gold + price);
  assert.ok(who.npc!.stock!.some((it) => it.type === sellable));

  if (def.classes !== null) {
    const other = give(s, def.classes.includes("weapon") ? "potion_water" : "mace");
    assert.equal(sell(s, other.uid), false);
  }
  const worn = s.player.inventory.find((it) => it.slot)!;
  assert.equal(sell(s, worn.uid), false, "equipped things are not for sale");
});

test("prices: set by what a thing is, not by what the buyer knows; the price modifier moves buying, not selling", () => {
  const cheap = quiet("valkyrie", "prices", { shopPrices: 1, unidentified: 9 });
  const dear = quiet("valkyrie", "prices", { shopPrices: 9, unidentified: 9 });
  const a = give(cheap, "potion_gain_level");
  const b = give(dear, "potion_gain_level");
  assert.ok(buyPrice(dear, b) > buyPrice(cheap, a) * 2);
  assert.equal(sellPrice(dear, b), sellPrice(cheap, a));
  delete cheap.discovered["potion_gain_level"];
  const unknown = buyPrice(cheap, a);
  assert.ok(!itemName(cheap, a).includes("gain level"));
  cheap.discovered["potion_gain_level"] = true;
  assert.equal(buyPrice(cheap, a), unknown);
  assert.ok(buyPrice(cheap, a) > buyPrice(cheap, give(cheap, "potion_water")), "a dearer potion is a better potion");
});

test("the world clock stops while the shop panel is open", () => {
  const { s } = beside("shopkeeper");
  interact(s);
  const t = s.time;
  for (let i = 0; i < 100; i++) update(s, 50);
  assert.equal(s.time, t);
  closeShop(s);
  for (let i = 0; i < 10; i++) update(s, 50);
  assert.equal(s.time, t + 500);
});

test("shopkeepers do not serve the invisible", () => {
  const { s } = beside("shopkeeper");
  addStatus(s, "invisible", 600, true);
  interact(s);
  assert.equal(s.prompt, null);
  assert.ok(logHas(s, "cannot see"));
});

test("priests: a large offering buys protection, up to a point; a small one eases bad luck", () => {
  const { s } = beside("priest");
  s.player.gold = 100000;
  const ac = armorClass(s);
  interact(s);
  assert.ok(s.prompt && s.prompt.kind === "menu" && s.prompt.context === "priest");
  choose(s, "large");
  assert.equal(armorClass(s), ac - 1);
  assert.equal(s.player.gold, 100000 - 400);
  for (let i = 0; i < 6; i++) {
    interact(s);
    choose(s, "large");
  }
  assert.equal(s.player.protection, 4, "protection is capped");
  s.player.luck = -3;
  interact(s);
  choose(s, "small");
  assert.equal(s.player.luck, -2);
  s.player.gold = 10;
  const before = s.player.protection;
  interact(s);
  choose(s, "large");
  assert.equal(s.player.protection, before);
  assert.equal(s.player.gold, 10);
});

test("rumors: at least forty, a good share true and a good share false", () => {
  assert.ok(RUMORS.length >= 40);
  assert.ok(RUMORS.filter((r) => r.truth).length >= 10);
  assert.ok(RUMORS.filter((r) => !r.truth).length >= 10);
  assert.equal(new Set(RUMORS.map((r) => r.text)).size, RUMORS.length);
});

test("rumors about this dungeon: the true ones are true and the false ones are false", () => {
  const s = quiet("valkyrie", "rumor-seed", { unidentified: 9 });
  const rumors = seedRumors(s);
  assert.ok(rumors.some((r) => r.truth) && rumors.some((r) => !r.truth));
  let checked = 0;
  for (const r of rumors) {
    const m = /^They say the (\w+) potion is a (potion of [a-z ]+)\.$/.exec(r.text);
    if (!m) continue;
    for (const id of Object.keys(s.discovered)) delete s.discovered[id];
    const probe = give(s, Object.keys(s.appearance).find((id) => itemName(s, { uid: 0, type: id, qty: 1, buc: "U", ench: 0, charges: 0, proof: false, known: false, bucKnown: false, letter: "", slot: null }).includes(`${m[1]} potion`))!);
    s.discovered[probe.type] = true;
    const really = itemName(s, probe).replace(/^an? /, "");
    assert.equal(really === m[2], r.truth, r.text);
    checked++;
  }
  assert.ok(checked >= 8);
});

test("a rumor-monger says three different things, then repeats himself", () => {
  let found = false;
  for (const kind of ["hermit", "adventurer", "gnome"]) {
    let pair;
    try {
      pair = beside(kind);
    } catch {
      continue;
    }
    found = true;
    const { s, who } = pair;
    const heard: string[] = [];
    interact(s);
    assert.ok(s.prompt && s.prompt.kind === "menu" && s.prompt.context === "talk" && s.prompt.speaker);
    heard.push(s.prompt.title);
    choose(s, "more");
    heard.push(s.prompt!.title);
    choose(s, "more");
    heard.push(s.prompt!.title);
    assert.equal(who.npc!.told, 3);
    assert.equal(new Set(heard).size, 3);
    assert.ok(!(s.prompt as { options: { id: string }[] }).options.some((o) => o.id === "more"));
    choose(s, "leave");
    assert.equal(s.prompt, null);
    assert.ok(nextRumor(s, who).text.length > 0);
    assert.equal(who.npc!.told, 3);
  }
  assert.ok(found);
});

test("killing a peaceful character turns shopkeepers hostile", () => {
  const { s, who } = beside("shopkeeper");
  const hermit = { ...who, uid: 999999, type: "hermit", x: 0, y: 0, npc: { kind: "hermit" as const, name: "the hermit", told: 0 } };
  cur(s).monsters.push(hermit);
  damageMonster(s, hermit, 99999, "phys");
  assert.equal(s.shopkeepersAngry, true);
  s.debug.god = true;
  wait(s, 300);
  assert.equal(who.peaceful, false);
  assert.ok(logHas(s, "Murderer!"));
});

test("an oil lamp, lit, lets you see further", () => {
  const s = quiet("valkyrie", "lamp-seed", { mapSize: 6 });
  const seen = (): number => cur(s).seen.reduce((n, v) => n + v, 0);
  updateSeen(s);
  const dark = seen();
  const lamp = give(s, "lamp");
  assert.equal(isLit(s), false);
  useItem(s, lamp.uid, "apply");
  assert.equal(isLit(s), true);
  assert.ok(seen() >= dark);
  assert.match(itemName(s, lamp), /\(lit\)/);
  useItem(s, lamp.uid, "apply");
  assert.equal(isLit(s), false);
});
