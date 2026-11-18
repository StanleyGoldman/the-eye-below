// Chests and large boxes, vaults and their guard.

import { itemType } from "./data/items.ts";
import { roleDef } from "./data/roles.ts";
import { addStatus, capital, consume, cur, dropAt, emit, hurt, mintMonster, monsterAt, nameOf, placeAt, rng, say } from "./state.ts";
import { DX, DY } from "./types.ts";
import type { Dir, Feature, GameState, Level, Monster } from "./types.ts";
import { updateSeen } from "./world.ts";

export const VAULT_PATIENCE_MS = 6000;
/** The name a trespasser can give instead of their own. */
export const VAULT_OWNER = "Lord Cinder";

// ---- chests -------------------------------------------------------------

function chestName(f: Feature): string {
  return f.label ?? "chest";
}

/** What using a chest does: open it, or ask how to deal with the lock. */
export function approachChest(state: GameState, chest: Feature): void {
  const name = chestName(chest);
  if (chest.opened) {
    say(state, `The ${name} is open and empty.`);
    return;
  }
  if (!chest.locked) {
    openChest(state, chest);
    return;
  }
  const key = state.player.inventory.find((it) => it.type === "chest_key");
  state.prompt = {
    kind: "menu",
    title: `The ${name} is locked.`,
    context: "chest",
    target: chest.y * cur(state).w + chest.x,
    options: [
      ...(key ? [{ id: "key", label: "Unlock it with a chest key", hint: "The key is used up." }] : []),
      { id: "force", label: "Force the lid", hint: "Strength helps. Potions inside may not survive it, and the noise carries." },
      { id: "leave", label: "Leave it", hint: key ? "" : "A chest key would open it without the risk." },
    ],
  };
}

function springTrap(state: GameState, name: string): void {
  const r = rng(state);
  const roll = r.int(3);
  if (roll === 0) {
    say(state, `A needle springs from the ${name}'s lock!`, "bad");
    hurt(state, r.dice(2, 4), `killed by a trapped ${name}`);
  } else if (roll === 1) {
    say(state, `A puff of gas escapes the ${name}.`, "bad");
    if (addStatus(state, "asleep", r.range(4, 8), true)) say(state, "You fall asleep.", "danger");
  } else {
    say(state, `The ${name} goes off with a flash.`, "bad");
    addStatus(state, "blind", r.range(6, 10));
  }
}

/** Open a chest: spring its trap if it has one, and spill what is inside at the player's feet. */
export function openChest(state: GameState, chest: Feature): void {
  const level = cur(state);
  const p = state.player;
  const name = chestName(chest);
  chest.opened = true;
  chest.locked = false;
  emit(state, { kind: "sound", id: "chest" });
  if (chest.trapped) {
    chest.trapped = false;
    springTrap(state, name);
    if (state.dead) return;
  }
  const loot = chest.loot ?? [];
  chest.loot = [];
  if (loot.length === 0) {
    say(state, `You open the ${name}. It is empty.`);
    return;
  }
  say(state, `You open the ${name}. Inside: ${loot.map((it) => nameOf(state, it)).join(", ")}. It tumbles out at your feet.`, "loot");
  for (const item of loot) dropAt(level, p.x, p.y, item);
}

export function chestAt(level: Level, cell: number): Feature | undefined {
  return level.features.find((f) => f.kind === "chest" && f.y * level.w + f.x === cell);
}

/** Chance, 0 to 1, that forcing a lid works. */
export function forceChance(state: GameState): number {
  return Math.max(0.15, Math.min(0.85, 0.3 + (state.player.stats.st - 10) * 0.04));
}

export function answerChest(state: GameState, cell: number, optionId: string): void {
  const level = cur(state);
  const chest = chestAt(level, cell);
  if (!chest || chest.opened) return;
  const p = state.player;
  const r = rng(state);
  const name = chestName(chest);
  if (optionId === "key") {
    const key = p.inventory.find((it) => it.type === "chest_key");
    if (!key) return;
    consume(state, key);
    say(state, `The key turns. It stays in the lock.`, "good");
    openChest(state, chest);
    return;
  }
  if (optionId !== "force") return;
  p.busyUntil = state.time + 900;
  p.busyText = "You are wrenching at a lid.";
  if (r.next() >= forceChance(state)) {
    say(state, `You heave at the ${name}. The lid does not give.`, "bad");
    if (r.chance(0.3)) {
      for (const m of level.monsters) {
        if (!m.peaceful && Math.abs(m.x - p.x) + Math.abs(m.y - p.y) <= 9) {
          m.asleep = false;
          m.aware = true;
        }
      }
      say(state, "The noise carries.", "bad");
    }
    return;
  }
  // Forced open: glass inside takes its chances.
  const loot = chest.loot ?? [];
  let broken = 0;
  chest.loot = loot.filter((it) => {
    if (itemType(it.type).cls === "potion" && r.chance(0.35)) {
      broken += it.qty;
      return false;
    }
    return true;
  });
  say(state, `You force the lid of the ${name}.${broken > 0 ? ` Something inside breaks: ${broken} potion${broken === 1 ? "" : "s"} lost.` : ""}`, broken > 0 ? "bad" : "good");
  openChest(state, chest);
}

// ---- the vault and its guard -------------------------------------------

export function inVault(state: GameState): boolean {
  const level = cur(state);
  const vault = level.meta.vault;
  return !!vault && vault.cells.includes(state.player.y * level.w + state.player.x);
}

function vaultGuard(level: Level): Monster | undefined {
  return level.monsters.find((m) => m.npc?.kind === "guard" && m.hp > 0);
}

/** Gold picked up inside a vault is remembered, so the guard knows what to take back. */
export function noteGold(state: GameState, amount: number): void {
  const vault = cur(state).meta.vault;
  if (vault && inVault(state)) vault.taken += amount;
}

/** Counts the time the player spends in a vault, and sends the guard. */
export function tickVault(state: GameState, ms: number): void {
  const level = cur(state);
  const vault = level.meta.vault;
  if (!vault) return;
  if (!inVault(state)) {
    vault.timeIn = 0;
    if (vault.guardCalled && !vaultGuard(level) && vault.taken >= 0) vault.guardCalled = false;
    return;
  }
  vault.timeIn += ms;
  // taken < 0 marks a vault whose guard has been talked round for good.
  if (vault.guardCalled || vault.taken < 0 || vault.timeIn < VAULT_PATIENCE_MS) return;
  vault.guardCalled = true;
  const p = state.player;
  // The guard steps in beside the trespasser where there is room: ahead for preference, then any side, then anywhere in the vault, then the doorway.
  const free = vault.cells.map((i) => ({ x: i % level.w, y: Math.floor(i / level.w) })).filter((c) => !(c.x === p.x && c.y === p.y) && !monsterAt(level, c.x, c.y));
  const beside = (c: { x: number; y: number }): boolean => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) === 1;
  const ahead = free.find((c) => c.x === p.x + (DX[p.dir] as number) && c.y === p.y + (DY[p.dir] as number));
  const outside = monsterAt(level, vault.outside.x, vault.outside.y) ? undefined : vault.outside;
  const spot = ahead ?? free.find(beside) ?? free[0] ?? outside;
  if (!spot) return;
  const guard = mintMonster(state, "guard", spot.x, spot.y);
  // Whoever is hailed turns to look.
  for (let d = 0; d < 4; d++) if (p.x + (DX[d] as number) === spot.x && p.y + (DY[d] as number) === spot.y) p.dir = d as Dir;
  guard.asleep = false;
  guard.npc = { kind: "guard", name: "the vault guard", told: 0 };
  level.monsters.push(guard);
  p.resting = false;
  say(state, "Suddenly a lantern swings into the vault. \"Halt! Who are you, and what are you doing in here?\"", "npc");
  state.prompt = {
    kind: "menu",
    title: "\"Halt! Who are you, and what are you doing in here?\"",
    context: "guard",
    speaker: "The vault guard",
    target: guard.uid,
    options: [
      { id: "truth", label: `"${p.name}."`, hint: "The truth. The gold goes back and you are shown out." },
      { id: "lie", label: `"${VAULT_OWNER}. This is my gold."`, hint: "A lie. Luck helps, and so does being a rogue. Fail, and it is a fight." },
    ],
  };
}

/** Chance, 0 to 1, that the guard believes the lie. */
export function lieChance(state: GameState): number {
  const p = state.player;
  return Math.max(0.05, Math.min(0.9, 0.4 + p.luck * 0.1 + (p.role === "rogue" ? 0.2 : 0)));
}

export function answerGuard(state: GameState, guardUid: number, optionId: string): void {
  const level = cur(state);
  const vault = level.meta.vault;
  const guard = level.monsters.find((m) => m.uid === guardUid);
  if (!vault || !guard) return;
  const p = state.player;
  const leave = (): void => {
    const i = level.monsters.indexOf(guard);
    if (i >= 0) level.monsters.splice(i, 1);
  };
  if (optionId === "lie") {
    if (rng(state).next() < lieChance(state)) {
      say(state, `"${VAULT_OWNER}? My apologies, my lord. I did not know you in this light." The guard bows and goes back to his rounds.`, "good");
      leave();
      vault.taken = -1;
      return;
    }
    say(state, `"${VAULT_OWNER} has been dead forty years." The guard puts down the lantern and draws.`, "danger");
    guard.peaceful = false;
    guard.aware = true;
    guard.nextAttack = state.time + 600;
    return;
  }
  // The truth, or no answer at all.
  const back = Math.min(p.gold, Math.max(0, vault.taken));
  p.gold -= back;
  vault.taken = 0;
  vault.timeIn = 0;
  leave();
  placeAt(state, vault.outside.x, vault.outside.y);
  updateSeen(state);
  const god = roleDef(p.role).god;
  say(state, `"${capital(p.name)}? Not on my list." ${back > 0 ? `The guard takes back ${back} gold, ` : "The guard finds nothing of the vault's on you, "}walks you out, and suggests you thank ${god} he is in a good mood.`, "npc");
}
