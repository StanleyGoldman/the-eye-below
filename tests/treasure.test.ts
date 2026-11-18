import assert from "node:assert/strict";
import { test } from "node:test";
import { generateLevel } from "../src/dungeon/generate.ts";
import { solveLevel } from "../src/dungeon/solve.ts";
import { choose, interact, move, useItem } from "../src/game/actions.ts";
import { ITEM_TYPES, itemName } from "../src/game/data/items.ts";
import { soundFamily } from "../src/game/data/monsters.ts";
import { EPITAPHS } from "../src/game/data/rumors.ts";
import { sellPrice } from "../src/game/shops.ts";
import { cur, facing, mintItem, newGame, score } from "../src/game/state.ts";
import { VAULT_PATIENCE_MS, forceChance, lieChance } from "../src/game/treasure.ts";
import { DX, DY, T } from "../src/game/types.ts";
import type { Feature, GameState, Level } from "../src/game/types.ts";
import { walkableNow } from "../src/game/world.ts";
import { give, logHas, quiet, run, wait } from "./helpers.ts";

function chestAhead(s: GameState, options: Partial<Feature> = {}): Feature {
  const at = facing(s);
  const chest: Feature = { kind: "chest", x: at.x, y: at.y, label: "chest", locked: false, trapped: false, opened: false, loot: [mintItem(s, "gold", 40), mintItem(s, "potion_water"), mintItem(s, "mace")], ...options };
  cur(s).features.push(chest);
  return chest;
}

test("gems: a real stone and worthless glass of the same colour look alike until identified", () => {
  const s = quiet();
  const ruby = give(s, "gem_ruby");
  const glass = give(s, "glass_red");
  assert.equal(itemName(s, ruby), "a red gem");
  assert.equal(itemName(s, glass), "a red gem");
  useItem(s, give(s, "scroll_identify", "B").uid, "read");
  assert.equal(itemName(s, ruby), "an uncursed ruby");
  assert.match(itemName(s, glass), /worthless piece of red glass/);
});

test("gems: there are valuable stones and glass in every colour, and price tells them apart", () => {
  const gems = ITEM_TYPES.filter((t) => t.cls === "gem");
  const colours = new Set(gems.map((t) => t.gemColor));
  for (const c of colours) {
    assert.ok(gems.some((t) => t.gemColor === c && t.cost > 100), `no real ${c} stone`);
    assert.ok(gems.some((t) => t.gemColor === c && t.cost < 10), `no ${c} glass`);
  }
  const s = quiet();
  assert.ok(sellPrice(s, give(s, "gem_emerald")) > sellPrice(s, give(s, "glass_green")) * 100);
});

test("gems: they count toward the score at their true worth, known or not", () => {
  const s = quiet();
  const base = score(s).total;
  give(s, "gem_diamond");
  assert.equal(score(s).total, base + 4000);
  give(s, "glass_white");
  assert.equal(score(s).total, base + 4002);
});

test("chests: an unlocked chest opens and spills its contents at your feet", () => {
  const s = quiet();
  const chest = chestAhead(s);
  interact(s);
  assert.equal(chest.opened, true);
  const here = cur(s).items.filter((fi) => fi.x === s.player.x && fi.y === s.player.y).map((fi) => fi.item.type);
  assert.deepEqual(here.sort(), ["gold", "mace", "potion_water"]);
  interact(s);
  assert.ok(logHas(s, "open and empty"));
});

test("chests: a locked chest opens with a chest key, which is used up", () => {
  const s = quiet();
  const chest = chestAhead(s, { locked: true });
  interact(s);
  assert.ok(s.prompt && s.prompt.kind === "menu" && s.prompt.context === "chest");
  assert.ok(!s.prompt.options.some((o) => o.id === "key"), "no key, no key option");
  choose(s, "leave");
  assert.equal(chest.opened, false);
  give(s, "chest_key");
  interact(s);
  choose(s, "key");
  assert.equal(chest.opened, true);
  assert.ok(!s.player.inventory.some((it) => it.type === "chest_key"));
});

test("chests: forcing a lock can fail, and can break the potions inside", () => {
  let opened = 0;
  let failedFirst = 0;
  let broken = 0;
  for (let i = 0; i < 40; i++) {
    const s = quiet("valkyrie", `force-${i}`);
    const chest = chestAhead(s, { locked: true, loot: [mintItem(s, "potion_water", 1), mintItem(s, "potion_healing", 1), mintItem(s, "mace")] });
    interact(s);
    choose(s, "force");
    if (!chest.opened) failedFirst++;
    for (let k = 0; k < 40 && !chest.opened; k++) {
      wait(s, 1000);
      cur(s).monsters = [];
      interact(s);
      choose(s, "force");
    }
    if (chest.opened) opened++;
    const here = cur(s).items.filter((fi) => fi.x === s.player.x && fi.y === s.player.y);
    const potions = here.filter((fi) => fi.item.type.startsWith("potion_")).length;
    broken += 2 - potions;
    assert.ok(here.some((fi) => fi.item.type === "mace"), "what is not glass survives");
  }
  assert.equal(opened, 40);
  assert.ok(failedFirst > 0 && failedFirst < 40, `${failedFirst} of 40 first tries failed`);
  assert.ok(broken > 5 && broken < 60, `${broken} of 80 potions broke`);
  const strong = quiet();
  const weak = quiet("wizard");
  assert.ok(forceChance(strong) > forceChance(weak));
});

test("chests: a trapped chest springs its trap once, then opens", () => {
  const s = quiet();
  s.player.hp = s.player.maxHp = 200;
  const chest = chestAhead(s, { trapped: true });
  interact(s);
  assert.equal(chest.opened, true);
  assert.equal(chest.trapped, false);
  assert.ok(s.player.hp < 200 || s.player.statuses.asleep || s.player.statuses.blind);
});

function levelWithVault(secret: boolean): { level: Level; seed: string; depth: number } {
  for (let i = 0; i < 400; i++) {
    for (const depth of [1, 2, 3, 4]) {
      const seed = `vault-${i}`;
      const level = generateLevel(run(seed, { mapSize: 5 }), depth);
      if (!level.meta.vault) continue;
      if (level.doors.some((d) => d.secret) === secret) return { level, seed, depth };
    }
  }
  throw new Error("no vault found");
}

test("vaults: a sealed room of gold off the route, behind a hidden door or a switch", () => {
  let seen = 0;
  let levels = 0;
  for (let i = 0; i < 60; i++) {
    for (const depth of [1, 2, 3, 6, 7]) {
      const level = generateLevel(run(`vaults-${i}`, { mapSize: 5 }), depth);
      levels++;
      const vault = level.meta.vault;
      if (!vault) continue;
      seen++;
      assert.ok(solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok);
      const gold = level.items.filter((fi) => fi.item.type === "gold" && vault.cells.includes(fi.y * level.w + fi.x));
      assert.ok(gold.length >= 1, "a vault holds gold");
      assert.equal(level.monsters.filter((m) => vault.cells.includes(m.y * level.w + m.x)).length, 0);
      // The way down never runs through the vault.
      const without: Level = { ...level, tiles: level.tiles.map((t, c) => (vault.cells.includes(c) ? T.WALL : t)) };
      assert.ok(solveLevel(without, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok || level.gates.length > 0);
    }
  }
  assert.ok(seen >= 15 && seen < levels * 0.4, `${seen} vaults in ${levels} levels: occasional`);
});

test("hidden doors: wall until found, by walking into them or standing beside them", () => {
  const { seed, depth, level: plan } = levelWithVault(true);
  const s = newGame({ seed, role: "valkyrie", startDepth: depth, overrides: { mapSize: 5 } });
  const level = cur(s);
  level.monsters = [];
  level.traps = [];
  const door = level.doors.find((d) => d.secret)!;
  assert.ok(plan.doors.some((d) => d.secret));
  assert.equal(walkableNow(level, door.x, door.y), false);
  const vault = level.meta.vault!;
  const out = vault.outside;
  s.player.x = out.x;
  s.player.y = out.y;
  const dir = ([0, 1, 2, 3] as const).find((d) => out.x + DX[d]! === door.x && out.y + DY[d]! === door.y)!;
  s.player.dir = dir;
  move(s, "forward");
  assert.equal(door.secret, false);
  assert.ok(logHas(s, "hidden door"));
  assert.deepEqual({ x: s.player.x, y: s.player.y }, out, "finding it does not walk through it");
  wait(s, 400);
  move(s, "forward");
  assert.equal(door.open, true);

  const t = newGame({ seed, role: "valkyrie", startDepth: depth, overrides: { mapSize: 5 } });
  cur(t).monsters = [];
  const d2 = cur(t).doors.find((d) => d.secret)!;
  t.player.x = out.x;
  t.player.y = out.y;
  wait(t, 30000);
  assert.equal(d2.secret, false, "standing beside it long enough finds it");
});

function inVault(secret: boolean, role: "valkyrie" | "rogue" = "valkyrie"): GameState {
  const { seed, depth } = levelWithVault(secret);
  const s = newGame({ seed, role, startDepth: depth, overrides: { mapSize: 5 } });
  const level = cur(s);
  level.monsters = [];
  level.traps = [];
  const cell = level.meta.vault!.cells[0]!;
  s.player.x = cell % level.w;
  s.player.y = Math.floor(cell / level.w);
  return s;
}

test("the vault guard: turns up if you linger, asks who you are, and takes the gold back if you tell the truth", () => {
  const s = inVault(true);
  const level = cur(s);
  const vault = level.meta.vault!;
  // Pick up the gold under your feet by stepping onto a gold cell.
  s.player.gold = 100;
  vault.taken = 60;
  s.player.gold += 60;
  wait(s, VAULT_PATIENCE_MS + 500);
  assert.ok(s.prompt && s.prompt.kind === "menu" && s.prompt.context === "guard", "the guard has arrived");
  assert.ok(level.monsters.some((m) => m.npc?.kind === "guard" && m.peaceful));
  const t = s.time;
  wait(s, 2000);
  assert.equal(s.time, t, "the world waits for an answer");
  choose(s, "truth");
  assert.equal(s.player.gold, 100, "the vault's gold goes back");
  assert.deepEqual({ x: s.player.x, y: s.player.y }, vault.outside, "and you are walked out");
  assert.ok(!level.monsters.some((m) => m.npc?.kind === "guard"));
});

test("the vault guard: a lie works more often for the lucky and for rogues, and failing it means a fight", () => {
  let believed = 0;
  let fights = 0;
  for (let i = 0; i < 30; i++) {
    const s = inVault(i % 2 === 0);
    s.debug.god = true;
    // Vary the run-time rolls from run to run.
    wait(s, i * 50);
    wait(s, VAULT_PATIENCE_MS + 500);
    if (!s.prompt) continue;
    choose(s, "lie");
    const guard = cur(s).monsters.find((m) => m.npc?.kind === "guard");
    if (!guard) believed++;
    else if (!guard.peaceful) fights++;
  }
  assert.ok(believed >= 4 && fights >= 4, `${believed} believed, ${fights} fights`);
  const plain = inVault(true);
  const rogue = inVault(true, "rogue");
  assert.ok(lieChance(rogue) > lieChance(plain));
  plain.player.luck = -5;
  assert.ok(lieChance(plain) < 0.2);
});

test("graves: some levels have one, with an epitaph to read", () => {
  let found = 0;
  for (let i = 0; i < 80 && found < 6; i++) {
    const level = generateLevel(run(`graves-${i}`), 2);
    const grave = level.features.find((f) => f.kind === "grave");
    if (!grave) continue;
    found++;
    assert.ok(EPITAPHS.includes(grave.text ?? ""));
    assert.ok(solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok);
  }
  assert.ok(found >= 6);
  assert.ok(EPITAPHS.length >= 12);
});

test("the last dead character's grave waits on the level where they fell, without changing the level otherwise", () => {
  const fallen = { name: "Brannoch", role: "Rogue", cause: "killed by a newt", depth: 2 };
  const plain = newGame({ seed: "fallen-seed", role: "valkyrie", startDepth: 2 });
  const haunted = newGame({ seed: "fallen-seed", role: "valkyrie", startDepth: 2, lastDead: fallen });
  const a = cur(plain);
  const b = cur(haunted);
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.items.length, b.items.length);
  const graves = b.features.filter((f) => f.kind === "grave" && (f.text ?? "").includes("Brannoch"));
  assert.equal(graves.length, 1);
  assert.match(graves[0]!.text!, /Brannoch the Rogue, killed by a newt/);
  assert.equal(a.features.filter((f) => (f.text ?? "").includes("Brannoch")).length, 0);
  assert.ok(solveLevel(b, { boneKeys: b.meta.boneDoor ? 1 : 0 }).ok);
  // Not on another level, and only once.
  const elsewhere = newGame({ seed: "fallen-seed", role: "valkyrie", startDepth: 3, lastDead: fallen });
  assert.equal(cur(elsewhere).features.filter((f) => (f.text ?? "").includes("Brannoch")).length, 0);
  // Reading it.
  const grave = graves[0]!;
  const lvl = cur(haunted);
  lvl.monsters = [];
  haunted.player.x = grave.x;
  haunted.player.y = grave.y + 1;
  haunted.player.dir = 0;
  interact(haunted);
  assert.ok(logHas(haunted, "Here lies Brannoch"));
});

test("every monster has a voice for the sound effects", () => {
  const families = new Set(["beast", "humanoid", "undead", "insect", "reptile", "ooze"]);
  for (const id of ["newt", "jackal", "ghoul", "soldier_ant", "acid_blob", "fire_drake", "kobold", "morvane", "guard"]) assert.ok(families.has(soundFamily(id)), id);
  assert.equal(soundFamily("ghoul"), "undead");
  assert.equal(soundFamily("soldier_ant"), "insect");
});
