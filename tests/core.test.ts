import assert from "node:assert/strict";
import { test } from "node:test";
import { MODIFIERS, cleanOverrides, decodeRunCode, difficulty, encodeRunCode, resolveMods, seedMods } from "../src/core/modifiers.ts";
import { Rng, stream } from "../src/core/rng.ts";

test("rng: the same stream gives the same numbers", () => {
  const a = stream("seed", "layout", 3);
  const b = stream("seed", "layout", 3);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
});

test("rng: streams with different names or levels differ", () => {
  const base = stream("seed", "layout", 3).next();
  assert.notEqual(base, stream("seed", "loot", 3).next());
  assert.notEqual(base, stream("seed", "layout", 4).next());
  assert.notEqual(base, stream("other", "layout", 3).next());
});

test("rng: dice and ranges stay in bounds", () => {
  const r = stream("bounds", "x");
  for (let i = 0; i < 2000; i++) {
    const d = r.dice(3, 6);
    assert.ok(d >= 3 && d <= 18);
    const n = r.range(-2, 2);
    assert.ok(n >= -2 && n <= 2);
    const f = r.next();
    assert.ok(f >= 0 && f < 1);
  }
});

test("rng: weighted never picks a zero weight", () => {
  const r = stream("w", "x");
  for (let i = 0; i < 500; i++) assert.notEqual(r.weighted([1, 0, 3, 0]) % 2, 1);
});

test("rng: state can be saved and resumed", () => {
  const a = stream("resume", "x");
  for (let i = 0; i < 7; i++) a.next();
  const b = new Rng(a.state());
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

test("modifiers: every seed gives every modifier a value from 1 to 9", () => {
  for (let i = 0; i < 300; i++) {
    const mods = seedMods(`seed-${i}`);
    for (const def of MODIFIERS) {
      const v = mods[def.id] as number;
      assert.ok(Number.isInteger(v) && v >= 1 && v <= 9, `${def.id}=${v}`);
    }
  }
});

test("modifiers: the same seed always gives the same values", () => {
  assert.deepEqual(seedMods("lantern"), seedMods("lantern"));
  assert.notDeepEqual(seedMods("lantern"), seedMods("lantern2"));
});

test("modifiers: overriding one leaves the others at the seed's values", () => {
  const base = seedMods("lantern");
  const changed = resolveMods("lantern", { traps: base["traps"] === 9 ? 1 : 9 });
  for (const def of MODIFIERS) {
    if (def.id === "traps") assert.notEqual(changed[def.id], base[def.id]);
    else assert.equal(changed[def.id], base[def.id]);
  }
});

test("modifiers: overrides equal to the seed's value are not overrides", () => {
  const base = seedMods("lantern");
  assert.deepEqual(cleanOverrides("lantern", { traps: base["traps"] as number }), {});
});

test("modifiers: difficulty rises with toughness and falls with loot", () => {
  const base = resolveMods("lantern", { monsterToughness: 5, lootAmount: 5 });
  const hard = resolveMods("lantern", { monsterToughness: 9, lootAmount: 5 });
  const easy = resolveMods("lantern", { monsterToughness: 5, lootAmount: 9 });
  assert.ok(difficulty(hard).score > difficulty(base).score);
  assert.ok(difficulty(easy).score < difficulty(base).score);
  assert.ok(difficulty(base).label.length > 0);
});

test("run code: a plain seed with overrides survives a round trip", () => {
  const base = seedMods("candle");
  const overrides = { traps: base["traps"] === 2 ? 3 : 2, mapSize: base["mapSize"] === 7 ? 8 : 7 };
  const code = encodeRunCode("candle", overrides);
  assert.match(code, /^EB1\.candle\./);
  assert.deepEqual(decodeRunCode(code), { seed: "candle", overrides });
});

test("run code: seeds with spaces and other characters survive a round trip", () => {
  for (const seed of ["two words", "ünïcödé ✓", "a.b.c", "~tilde", "x"]) {
    const code = encodeRunCode(seed, {});
    assert.deepEqual(decodeRunCode(code), { seed, overrides: {} });
  }
});

test("run code: garbage is rejected", () => {
  for (const bad of ["", "hello", "EB1", "EB2.candle", "EB1.candle.zz9", "EB1.candle.tr0", "EB1.candle.tr", "EB1.can dle"]) {
    assert.equal(decodeRunCode(bad), null, bad);
  }
});
