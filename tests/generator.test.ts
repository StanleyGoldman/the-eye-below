import assert from "node:assert/strict";
import { test } from "node:test";
import { MODIFIERS, resolveMods } from "../src/core/modifiers.ts";
import { playBoulderSolution } from "../src/dungeon/boulders.ts";
import { generateLevel } from "../src/dungeon/generate.ts";
import { doorIsCut, gateIsCut, solveLevel } from "../src/dungeon/solve.ts";
import { buildSpecial, specialTemplateRows } from "../src/dungeon/special.ts";
import { itemType } from "../src/game/data/items.ts";
import { monsterType } from "../src/game/data/monsters.ts";
import { T } from "../src/game/types.ts";
import type { Level } from "../src/game/types.ts";
import { run } from "./helpers.ts";

const SPECIALS = [5, 10, 15, 20, 25];

function solved(level: Level): boolean {
  return solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 }).ok;
}

test("generator: every regular level is solvable across many seeds", () => {
  let count = 0;
  for (let s = 0; s < 25; s++) {
    const r = run(`solve-${s}`);
    for (let depth = 1; depth <= 25; depth++) {
      if (depth % 5 === 0) continue;
      const level = generateLevel(r, depth);
      assert.ok(solved(level), `seed solve-${s} level ${depth}`);
      count++;
    }
  }
  assert.equal(count, 500);
});

test("generator: every modifier at its minimum and maximum still gives solvable levels", () => {
  for (const def of MODIFIERS) {
    for (const value of [1, 9]) {
      const r = run(`extreme-${def.id}`, { [def.id]: value });
      for (const depth of [1, 4, 9, 13, 19, 24]) {
        assert.ok(solved(generateLevel(r, depth)), `${def.id}=${value} level ${depth}`);
      }
    }
  }
});

test("generator: all five special levels are solvable in every mirroring", () => {
  for (const depth of SPECIALS) {
    for (const flipX of [false, true]) {
      for (const flipY of [false, true]) {
        const level = buildSpecial(run("special"), depth, { flipX, flipY });
        const result = solveLevel(level);
        assert.ok(result.ok, `level ${depth} flipX=${flipX} flipY=${flipY}: ${result.reason}`);
      }
    }
  }
});

test("generator: special levels are solvable for many seeds and ignore the map-size modifier", () => {
  for (let s = 0; s < 20; s++) {
    for (const depth of SPECIALS) {
      const small = generateLevel(run(`sp-${s}`, { mapSize: 1 }), depth);
      const large = generateLevel(run(`sp-${s}`, { mapSize: 9 }), depth);
      assert.ok(solveLevel(small).ok, `seed sp-${s} level ${depth}`);
      assert.equal(small.w, large.w);
      assert.equal(small.h, large.h);
      assert.deepEqual(small.tiles, large.tiles);
    }
  }
});

test("generator: special level templates are rectangular", () => {
  for (const depth of SPECIALS) {
    const rows = specialTemplateRows(depth);
    for (const row of rows) assert.equal(row.length, rows[0]!.length, `level ${depth}: "${row}"`);
  }
});

test("generator: the same seed and modifiers give an identical level twice", () => {
  for (const depth of [1, 7, 10, 18, 25]) {
    const a = JSON.stringify(generateLevel(run("twice"), depth));
    const b = JSON.stringify(generateLevel(run("twice"), depth));
    assert.equal(a, b, `level ${depth}`);
  }
});

test("generator: different seeds give different levels", () => {
  assert.notEqual(JSON.stringify(generateLevel(run("one"), 3).tiles), JSON.stringify(generateLevel(run("two"), 3).tiles));
});

test("generator: a level does not depend on which levels were generated before it", () => {
  const r = run("order");
  const direct = JSON.stringify(generateLevel(r, 8));
  for (const d of [1, 12, 3, 7, 9]) generateLevel(r, d);
  assert.equal(JSON.stringify(generateLevel(r, 8)), direct);
});

test("generator: changing the monster count does not move a wall", () => {
  const a = generateLevel(run("streams", { monsterCount: 2 }), 6);
  const b = generateLevel(run("streams", { monsterCount: 9 }), 6);
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.doors, b.doors);
  assert.notEqual(a.monsters.length, b.monsters.length);
});

test("generator: changing trap density does not reshuffle monsters or loot", () => {
  const a = generateLevel(run("streams2", { traps: 1 }), 6);
  const b = generateLevel(run("streams2", { traps: 9 }), 6);
  assert.deepEqual(a.monsters.map((m) => [m.type, m.x, m.y]), b.monsters.map((m) => [m.type, m.x, m.y]));
  assert.equal(a.traps.length, 0);
  assert.ok(b.traps.length > 0);
});

test("generator: the map-size modifier changes the size of regular levels", () => {
  const small = generateLevel(run("size", { mapSize: 1 }), 2);
  const large = generateLevel(run("size", { mapSize: 9 }), 2);
  assert.ok(large.w * large.h > small.w * small.h * 4);
});

test("generator: the puzzle modifier sets how many locks are on the route", () => {
  let none = 0;
  let many = 0;
  for (let s = 0; s < 10; s++) {
    none += generateLevel(run(`pz-${s}`, { puzzles: 1, mapSize: 6 }), 3).meta.locks;
    many += generateLevel(run(`pz-${s}`, { puzzles: 9, mapSize: 6 }), 3).meta.locks;
  }
  assert.equal(none, 0);
  assert.ok(many >= 25, `only ${many} locks over 10 levels`);
});

test("generator: every lock on the route is a real obstacle", () => {
  let checked = 0;
  for (let s = 0; s < 12; s++) {
    const level = generateLevel(run(`cut-${s}`, { puzzles: 9, mapSize: 5 }), 4);
    level.gates.forEach((_, gi) => {
      assert.ok(gateIsCut(level, gi), `seed cut-${s} gate ${gi} can be walked around`);
      checked++;
    });
    level.doors.forEach((d, di) => {
      if (!d.locked || d.color === "bone") return;
      // A closet door is not on the route; a route door must be a cut.
      const sealed = solveLevel(level, { sealDoor: di });
      if (!sealed.ok) checked++;
      else assert.ok(!doorIsCut(level, di));
    });
  }
  assert.ok(checked > 20, `only ${checked} locks checked`);
});

test("generator: every key and every locked door is used in the solution", () => {
  for (let s = 0; s < 15; s++) {
    const level = generateLevel(run(`keys-${s}`, { puzzles: 8, mapSize: 6 }), 7);
    const result = solveLevel(level, { boneKeys: level.meta.boneDoor ? 1 : 0 });
    assert.equal(result.doorsOpened, level.doors.filter((d) => d.locked).length, `seed keys-${s}`);
    assert.equal(result.gatesOpened, level.gates.length, `seed keys-${s}`);
    for (const fi of level.items) {
      if (itemType(fi.item.type).keyColor) assert.equal(result.reached[fi.y * level.w + fi.x], 1, `seed keys-${s}: a key is out of reach`);
    }
  }
});

test("generator: a bone key always has a bone door waiting on the next level", () => {
  let found = 0;
  for (let s = 0; s < 40 && found < 5; s++) {
    const r = run(`bone-${s}`, { puzzles: 7, mapSize: 6 });
    for (let depth = 1; depth < 24; depth++) {
      const level = generateLevel(r, depth);
      if (!level.meta.boneKey) continue;
      found++;
      const next = generateLevel(r, depth + 1);
      assert.ok(next.meta.boneDoor, `seed bone-${s}: key on ${depth}, no door on ${depth + 1}`);
      assert.ok(next.doors.some((d) => d.color === "bone"));
    }
  }
  assert.ok(found >= 5, `only ${found} bone keys found`);
});

test("generator: stairs are on separate cells inside the level, and the start area holds the up stairs", () => {
  for (let s = 0; s < 10; s++) {
    for (const depth of [1, 6, 11, 16, 21]) {
      const level = generateLevel(run(`stairs-${s}`), depth);
      assert.ok(level.down);
      assert.notDeepEqual(level.up, level.down);
      assert.equal(level.tiles[level.up.y * level.w + level.up.x], T.STAIRS_UP);
      assert.equal(level.tiles[level.down!.y * level.w + level.down!.x], T.STAIRS_DOWN);
      assert.ok(level.startArea.includes(level.up.y * level.w + level.up.x));
    }
  }
});

test("generator: no trapdoor opens onto a special level", () => {
  for (let s = 0; s < 15; s++) {
    const r = run(`trap-${s}`, { traps: 9, mapSize: 6 });
    for (const depth of [4, 9, 14, 19, 24]) {
      assert.ok(!generateLevel(r, depth).traps.some((t) => t.kind === "trapdoor"), `seed trap-${s} level ${depth}`);
    }
  }
});

test("generator: nothing is generated inside a wall or on top of a fixture", () => {
  for (let s = 0; s < 10; s++) {
    for (const depth of [2, 8, 14, 22]) {
      const level = generateLevel(run(`place-${s}`, { monsterCount: 9, lootAmount: 9, fountains: 9 }), depth);
      const solid = (x: number, y: number): boolean => level.tiles[y * level.w + x] === T.WALL || level.features.some((f) => f.x === x && f.y === y);
      for (const m of level.monsters) assert.ok(!solid(m.x, m.y), `monster ${m.type} in a wall`);
      for (const fi of level.items) assert.ok(!solid(fi.x, fi.y), `item ${fi.item.type} in a wall`);
      const seen = new Set<string>();
      for (const m of level.monsters) {
        assert.ok(!seen.has(`${m.x},${m.y}`), "two monsters share a cell");
        seen.add(`${m.x},${m.y}`);
      }
    }
  }
});

test("stoneyard: the stored solution fills every pit under the game's own boulder rules", () => {
  for (const flipX of [false, true]) {
    for (const flipY of [false, true]) {
      const level = buildSpecial(run("stones"), 10, { flipX, flipY });
      const after = playBoulderSolution(level);
      assert.ok(after, `flipX=${flipX} flipY=${flipY}`);
      assert.ok(!after!.tiles.includes(T.PIT));
    }
  }
});

test("stoneyard: without pushing boulders the stairs are out of reach", () => {
  const level = buildSpecial(run("stones"), 10);
  const untouched = solveLevel({ ...level, special: null });
  assert.equal(untouched.ok, false);
});

test("gorgon: the way down is shut until the boss can be reached, and the level holds the means to face her", () => {
  const level = buildSpecial(run("gorgon"), 15);
  assert.ok(level.monsters.some((m) => m.type === "medusa"));
  assert.ok(level.gates.some((g) => g.opener === "boss" && !g.open));
  assert.ok(level.items.some((fi) => fi.item.type === "potion_blindness"));
  assert.equal(solveLevel({ ...level, monsters: [] }).ok, false);
});

test("keep: the drawbridge is the only way in and its winch is on the near bank", () => {
  const level = buildSpecial(run("keep"), 20);
  const bridge = level.gates.findIndex((g) => g.kind === "drawbridge");
  assert.ok(bridge >= 0);
  assert.ok(gateIsCut(level, bridge));
  assert.ok(level.items.some((fi) => itemType(fi.item.type).cls === "wand" && fi.item.charges === 8));
  assert.ok(level.monsters.filter((m) => m.type === "soldier").length >= 4);
});

test("tower: the last level has no stairs down and holds the final boss", () => {
  const level = buildSpecial(run("tower"), 25);
  assert.equal(level.down, null);
  assert.ok(level.monsters.some((m) => monsterType(m.type).boss && m.type === "morvane"));
});

test("oracle and stoneyard: the oracle is peaceful and the prize is the amulet of reflection", () => {
  const court = buildSpecial(run("court"), 5);
  const oracle = court.monsters.find((m) => m.type === "oracle");
  assert.ok(oracle && oracle.peaceful);
  assert.ok(court.features.filter((f) => f.kind === "fountain").length >= 4);
  const yard = buildSpecial(run("court"), 10);
  assert.ok(yard.items.some((fi) => fi.item.type === "amulet_reflection"));
});

test("modifiers reach the generator: more loot, more gold, more traps, more fountains", () => {
  const count = (id: string, value: number, pick: (l: Level) => number): number => {
    let total = 0;
    for (let s = 0; s < 6; s++) total += pick(generateLevel({ seed: `amount-${s}`, mods: resolveMods(`amount-${s}`, { [id]: value, mapSize: 6 }) }, 3));
    return total;
  };
  const items = (l: Level): number => l.items.filter((fi) => itemType(fi.item.type).cls !== "gold" && !itemType(fi.item.type).keyColor).length;
  const gold = (l: Level): number => l.items.filter((fi) => fi.item.type === "gold").reduce((n, fi) => n + fi.item.qty, 0);
  assert.ok(count("lootAmount", 9, items) > count("lootAmount", 1, items) * 2);
  assert.ok(count("gold", 9, gold) > count("gold", 1, gold) * 4);
  assert.ok(count("traps", 9, (l) => l.traps.length) > count("traps", 1, (l) => l.traps.length));
  assert.ok(count("fountains", 9, (l) => l.features.length) > count("fountains", 1, (l) => l.features.length));
  assert.ok(count("monsterCount", 9, (l) => l.monsters.length) > count("monsterCount", 1, (l) => l.monsters.length) * 2);
});
