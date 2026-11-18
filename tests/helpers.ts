// Shared setup for the rules tests: a small, quiet world to poke at.

import { resolveMods } from "../src/core/modifiers.ts";
import type { Mods } from "../src/core/modifiers.ts";
import { addToPack, cur, facing, mintItem, mintMonster, newGame } from "../src/game/state.ts";
import type { Buc, GameState, Item, Monster, RoleId, RunConfig } from "../src/game/types.ts";
import { update } from "../src/game/world.ts";

export function run(seed: string, overrides: Mods = {}): RunConfig {
  return { seed, mods: resolveMods(seed, overrides) };
}

/** A new game with the level emptied of monsters, so nothing interferes. */
export function quiet(role: RoleId = "valkyrie", seed = "test-seed", overrides: Mods = {}): GameState {
  const state = newGame({ seed, role, overrides });
  cur(state).monsters = [];
  cur(state).traps = [];
  return state;
}

/** Put an identified item of the given state in the pack. */
export function give(state: GameState, type: string, buc: Buc = "U", ench = 0, qty = 1): Item {
  const item = mintItem(state, type, qty, buc, ench);
  const packed = addToPack(state, item);
  if (!packed) throw new Error("pack full");
  return packed;
}

/** Put an awake, aware monster in the cell the player is facing. */
export function foeAhead(state: GameState, type: string): Monster {
  const at = facing(state);
  const m = mintMonster(state, type, at.x, at.y);
  m.asleep = false;
  m.aware = true;
  cur(state).monsters.push(m);
  return m;
}

/** Let game time pass. */
export function wait(state: GameState, ms: number): void {
  for (let t = 0; t < ms; t += 50) update(state, 50);
}

export function lastLog(state: GameState, n = 6): string {
  return state.log
    .slice(-n)
    .map((m) => m.text)
    .join(" | ");
}

export function logHas(state: GameState, text: string): boolean {
  return state.log.some((m) => m.text.includes(text));
}
