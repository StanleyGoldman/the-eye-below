// Fighting: the player's swings and shots, damage to monsters, their
// deaths, and their attacks on the player. Tabletop rules: a d20 against
// armor class, dice for damage.

import { scale3 } from "../core/modifiers.ts";
import { featureAt, gateAt, doorAt, inBounds, lineOfSight, tileAt } from "../dungeon/grid.ts";
import { itemType } from "./data/items.ts";
import { experienceFor, monsterType } from "./data/monsters.ts";
import type { MonsterAttack } from "./data/monsters.ts";
import { roleDef } from "./data/roles.ts";
import { addStatus, armorClass, capital, consume, cur, damageBonus, die, discover, dropAt, emit, facing, freeAction, gainXp, has, hurt, isFree, loseLevel, mintItem, mintRandomItem, monsterAt, nameOf, reflects, rng, say, speedFactor, takeFromPack, theMonster, toHitBonus, wornItem } from "./state.ts";
import { DX, DY, T } from "./types.ts";
import type { GameState, Item, Level, Monster, Pos } from "./types.ts";

export type DamageKind = "phys" | "force" | "missile" | "fire" | "cold" | "lightning";

/** Can the player see this monster, were it in view? */
export function perceives(state: GameState, m: Monster): boolean {
  if (has(state, "blind")) return false;
  if (monsterType(m.type).invisible && !has(state, "seeInvisible")) return false;
  return true;
}

export function monsterInSight(state: GameState, m: Monster, range = 6): boolean {
  if (m.hp <= 0 || !perceives(state, m)) return false;
  const p = state.player;
  if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > range) return false;
  return lineOfSight(cur(state), p.x, p.y, m.x, m.y);
}

function nameFor(state: GameState, m: Monster): string {
  return perceives(state, m) ? theMonster(m) : "it";
}

// ---- damage to monsters ----------------------------------------------

/** Returns true if the monster died (or fell, for trolls). */
export function damageMonster(state: GameState, m: Monster, amount: number, kind: DamageKind): boolean {
  if (m.hp <= 0) {
    // A fallen troll: fire finishes it.
    if (m.reviveAt > 0 && kind === "fire") {
      say(state, `${capital(theMonster(m))}'s body burns to ash.`, "good");
      m.reviveAt = 0;
      m.revived = true;
      removeMonster(state, m, true);
    }
    return false;
  }
  const type = monsterType(m.type);
  let dmg = Math.max(0, Math.round(amount));
  if (type.resists.includes(kind)) dmg = Math.floor(dmg / 4);
  if (type.weak.includes(kind)) dmg = Math.round(dmg * 1.5);
  m.hp -= dmg;
  m.asleep = false;
  m.sleepUntil = 0;
  m.aware = true;
  m.hitFlashUntil = state.time + 180;
  emit(state, { kind: "hit", monster: m.uid, amount: dmg });
  if (m.hp <= 0) {
    killMonster(state, m, kind);
    return true;
  }
  return false;
}

function removeMonster(state: GameState, m: Monster, reward: boolean): void {
  const level = cur(state);
  const i = level.monsters.indexOf(m);
  if (i >= 0) level.monsters.splice(i, 1);
  if (!reward) return;
  const type = monsterType(m.type);
  const p = state.player;
  const r = rng(state);
  p.kills++;
  // Peaceful by nature, even if it had been provoked into fighting back.
  if (type.peaceful) {
    state.peacefulsKilled++;
    p.luck = Math.max(-10, p.luck - 5);
    say(state, "You murderer! You feel that luck has left the room, and it will not be back soon.", "danger");
  } else {
    gainXp(state, experienceFor(type, m.level));
  }
  if (m.gold > 0) dropAt(level, m.x, m.y, mintItem(state, "gold", m.gold));
  for (const d of type.drops) if (r.chance(d.chance)) dropAt(level, m.x, m.y, mintItem(state, d.type));
  if (!type.boss && r.chance(0.1 * scale3(state.run.mods["lootAmount"] ?? 5, 0.4, 1, 1.8))) dropAt(level, m.x, m.y, mintRandomItem(state, state.depth));
}

export function killMonster(state: GameState, m: Monster, kind: DamageKind): void {
  const type = monsterType(m.type);
  const level = cur(state);
  m.hp = 0;
  m.windupUntil = 0;
  m.windupKind = "";
  if (type.revives && !m.revived && kind !== "fire") {
    m.reviveAt = state.time + 7000;
    say(state, `${capital(theMonster(m))} collapses. It is still twitching.`, "info");
    return;
  }
  say(state, `You ${type.undead ? "destroy" : "kill"} ${theMonster(m)}!`, "good");
  removeMonster(state, m, true);
  if (type.id === "medusa") {
    let opened = false;
    for (const g of level.gates) {
      if (g.opener === "boss" && !g.open) {
        g.open = true;
        opened = true;
      }
    }
    if (opened) say(state, "Beyond the island, a portcullis grinds open.", "good");
  }
  if (type.id === "morvane") {
    const eye = mintItem(state, "amulet_eye");
    eye.known = true;
    eye.bucKnown = true;
    dropAt(level, m.x, m.y, eye);
    say(state, "Morvane comes apart like wet paper. Something small and round rolls free of the robes, and looks at you.", "good");
  }
}

// ---- the player's attacks --------------------------------------------

function toHitRoll(state: GameState, m: Monster, bonus: number): boolean {
  const p = state.player;
  const type = monsterType(m.type);
  let need = 3 + p.luck + toHitBonus(p) + type.ac + p.xl + bonus;
  if (m.asleep || m.sleepUntil > state.time || m.heldUntil > state.time) need += 4;
  if (has(state, "blind") || !perceives(state, m)) need -= 2;
  return need > rng(state).rnd(20);
}

/** Things that happen to whoever hits certain monsters in melee. */
function passiveReaction(state: GameState, m: Monster, weapon: Item | undefined): void {
  const type = monsterType(m.type);
  const r = rng(state);
  if (type.passive === "paralyze") {
    if (has(state, "blind")) {
      say(state, "You cannot see the floating eye's gaze, which is the only safe way to hit one.", "info");
    } else if (reflects(state)) {
      say(state, "The floating eye's gaze is reflected by your amulet.", "good");
      discover(state, "amulet_reflection");
    } else if (freeAction(state)) {
      addStatus(state, "paralyzed", 1);
    } else {
      addStatus(state, "paralyzed", r.range(10, 20), true);
      say(state, "You are frozen by the floating eye's gaze! Hitting it while able to see was avoidable.", "danger");
    }
  } else if (type.passive === "acid") {
    if (!weapon) {
      say(state, "The acid blob burns your bare hands.", "bad");
      hurt(state, r.rnd(4), "killed by an acid blob's acid");
    } else if (r.chance(0.3)) {
      if (weapon.proof) {
        say(state, `Acid runs off your ${itemType(weapon.type).name}. It is not affected.`, "info");
      } else if (weapon.ench <= -3) {
        say(state, `Your ${itemType(weapon.type).name} is already as corroded as it can get.`, "info");
      } else {
        weapon.ench--;
        say(state, `Your ${itemType(weapon.type).name} corrodes!`, "bad");
      }
    }
  } else if (type.passive === "stone" && !weapon) {
    say(state, "You hit the cockatrice with your bare hands. This is the last mistake you make as a mammal.", "danger");
    die(state, "turned to stone by touching a cockatrice");
  }
}

function meleeDamage(state: GameState, m: Monster, weapon: Item | undefined): number {
  const p = state.player;
  const r = rng(state);
  let dmg: number;
  if (weapon && itemType(weapon.type).weapon && !itemType(weapon.type).weapon!.launcher) {
    const w = itemType(weapon.type).weapon!;
    dmg = r.dice(w.dice[0], w.dice[1]) + w.bonus + weapon.ench;
  } else {
    dmg = r.rnd(2);
  }
  dmg += damageBonus(p);
  const helpless = m.asleep || m.sleepUntil > state.time || m.heldUntil > state.time || m.fleeUntil > state.time;
  if (p.role === "rogue" && helpless) {
    dmg *= 2;
    say(state, "You strike where it is not looking.", "good");
  }
  return Math.max(1, dmg);
}

export function strike(state: GameState, m: Monster, weapon: Item | undefined): void {
  const who = nameFor(state, m);
  const weaponType = weapon ? itemType(weapon.type) : null;
  const bonus = weapon && weaponType?.weapon ? weapon.ench + weaponType.weapon.toHit : 0;
  if (!toHitRoll(state, m, bonus)) {
    emit(state, { kind: "miss", monster: m.uid });
    say(state, `You miss ${who}.`);
    m.asleep = false;
    m.aware = true;
    return;
  }
  const dmg = meleeDamage(state, m, weapon);
  say(state, `You hit ${who}.`);
  emit(state, { kind: "sound", id: "hit" });
  const died = damageMonster(state, m, dmg, "phys");
  if (!died && weapon && weapon.type === "mjollnir" && rng(state).chance(0.4)) {
    say(state, "Lightning leaps from the hammer.", "good");
    damageMonster(state, m, rng(state).dice(2, 12), "lightning");
  }
  passiveReaction(state, m, weapon && weaponType?.weapon ? weapon : undefined);
}

/** Swing with a ready hand at whatever is ahead. */
export function swing(state: GameState, confirmed = false): void {
  const p = state.player;
  const main = wornItem(p, "main");
  const off = wornItem(p, "off");
  const offIsWeapon = !!off && !!itemType(off.type).weapon;
  let hand: "main" | "off";
  if (state.time >= p.mainReady) hand = "main";
  else if (offIsWeapon && state.time >= p.offReady) hand = "off";
  else return;
  const weapon = hand === "main" ? main : off;
  const wdata = weapon ? itemType(weapon.type).weapon : undefined;
  const target = facing(state);
  const m = monsterAt(cur(state), target.x, target.y);

  if (m && m.peaceful && !confirmed) {
    state.prompt = {
      kind: "menu",
      title: `Really attack ${theMonster(m)}? It is peaceful.`,
      context: "attackPeaceful",
      target: m.uid,
      options: [
        { id: "no", label: "No", hint: "Lower your weapon." },
        { id: "yes", label: "Yes, attack", hint: "Killing a peaceful creature costs you luck for the rest of the run." },
      ],
    };
    return;
  }

  const cooldown = Math.round((wdata ? Math.max(500, wdata.cooldown) : 700) * speedFactor(state));
  if (hand === "main") {
    p.mainReady = state.time + cooldown;
    p.mainCooldown = cooldown;
  } else {
    p.offReady = state.time + cooldown;
    p.offCooldown = cooldown;
  }
  p.resting = false;
  emit(state, { kind: "sound", id: "swing" });

  if (wdata && wdata.launcher && weapon) {
    const arrows = p.inventory.find((it) => it.type === "arrow");
    if (!arrows) {
      say(state, "You have no arrows. The bow makes a poor club.");
      if (m) strike(state, m, undefined);
      return;
    }
    const shot = takeFromPack(state, arrows, 1);
    launch(state, shot, weapon.ench + 2, true);
    return;
  }
  if (!m) {
    say(state, "You swing at the air.");
    return;
  }
  if (m.peaceful) {
    m.peaceful = false;
    m.aware = true;
    say(state, `${capital(theMonster(m))} gets angry!`, "danger");
  }
  strike(state, m, weapon);
}

function projectileBlocked(level: Level, x: number, y: number): boolean {
  if (!inBounds(level, x, y)) return true;
  const t = tileAt(level, x, y);
  if (t === T.WALL) return true;
  if (t === T.DOOR) {
    const d = doorAt(level, x, y);
    if (d && !d.open) return true;
  }
  if (t === T.GATE) {
    const g = gateAt(level, x, y);
    if (g && !g.open && g.kind === "portcullis") return true;
  }
  return featureAt(level, x, y) !== undefined;
}

/** Cells ahead of the player in a straight line, stopping at the first thing that blocks a missile. */
export function lineAhead(state: GameState, range: number): Pos[] {
  const p = state.player;
  const level = cur(state);
  const out: Pos[] = [];
  for (let i = 1; i <= range; i++) {
    const x = p.x + (DX[p.dir] as number) * i;
    const y = p.y + (DY[p.dir] as number) * i;
    if (projectileBlocked(level, x, y)) break;
    out.push({ x, y });
  }
  return out;
}

/** Send one item flying ahead. It hits the first monster it reaches or lands where it stops. */
export function launch(state: GameState, item: Item, bonus: number, fired: boolean): void {
  const p = state.player;
  const level = cur(state);
  const r = rng(state);
  const type = itemType(item.type);
  const cells = lineAhead(state, 6);
  let land: Pos = { x: p.x, y: p.y };
  for (const c of cells) {
    land = c;
    const m = monsterAt(level, c.x, c.y);
    if (!m) continue;
    if (m.peaceful) {
      m.peaceful = false;
      say(state, `${capital(theMonster(m))} gets angry!`, "danger");
    }
    const w = type.weapon;
    const dex = Math.max(0, p.stats.dx - 12) >> 1;
    if (toHitRoll(state, m, bonus + dex + (w ? w.toHit : 0))) {
      let dmg = w ? r.dice(w.dice[0], w.dice[1]) + w.bonus + item.ench : 1;
      if (fired) dmg += r.rnd(4);
      const helpless = m.asleep || m.heldUntil > state.time || m.fleeUntil > state.time;
      if (p.role === "rogue" && helpless) dmg *= 2;
      say(state, `The ${type.name} hits ${nameFor(state, m)}.`);
      damageMonster(state, m, Math.max(1, dmg), "phys");
      if (type.id === "arrow" && r.chance(0.5)) return;
    } else {
      say(state, `The ${type.name} misses ${nameFor(state, m)}.`);
      m.asleep = false;
      m.aware = true;
    }
    break;
  }
  dropAt(level, land.x, land.y, item);
}

export function throwItem(state: GameState, item: Item): void {
  const p = state.player;
  const type = itemType(item.type);
  const volley = p.role === "rogue" && type.id === "dagger" ? Math.min(2, item.qty) : 1;
  say(state, volley > 1 ? `You throw ${volley} daggers.` : `You throw ${nameOf(state, { ...item, qty: 1 }, true)}.`);
  for (let i = 0; i < volley; i++) {
    const one = takeFromPack(state, item, 1);
    launch(state, one, one.ench, false);
  }
  const cooldown = Math.round(700 * speedFactor(state));
  p.mainReady = state.time + cooldown;
  p.mainCooldown = cooldown;
  emit(state, { kind: "sound", id: "swing" });
}

// ---- monsters attacking the player -----------------------------------

function damageMod(state: GameState): number {
  return scale3(state.run.mods["monsterToughness"] ?? 5, 0.7, 1, 1.5);
}

function applyAttackEffect(state: GameState, m: Monster, attack: MonsterAttack): void {
  const p = state.player;
  const r = rng(state);
  const level = cur(state);
  switch (attack.effect) {
    case "stone":
      if (p.stoning <= 0) {
        p.stoning = 15000;
        p.stoneStage = 0;
        say(state, "You hear the cockatrice's hissing. You are slowing down.", "danger");
      }
      break;
    case "paralyze":
      if (!has(state, "paralyzed") && addStatus(state, "paralyzed", r.range(10, 20) / 10, true)) say(state, `You are frozen by ${theMonster(m)}'s touch!`, "danger");
      break;
    case "steal": {
      if (p.gold <= 0) break;
      const amount = Math.max(1, Math.round(p.gold * r.range(20, 60) / 100));
      p.gold -= amount;
      m.gold += amount;
      say(state, `${capital(theMonster(m))} grabs ${amount} of your gold and is suddenly somewhere else.`, "bad");
      const spots: Pos[] = [];
      for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) if (Math.abs(x - p.x) + Math.abs(y - p.y) > 8 && isFree(state, level, x, y)) spots.push({ x, y });
      if (spots.length > 0) {
        const s = r.pick(spots);
        m.x = s.x;
        m.y = s.y;
        m.px = s.x;
        m.py = s.y;
      }
      m.fleeUntil = state.time + 20000;
      break;
    }
    case "drain":
      loseLevel(state, `drained by ${article(monsterType(m.type).name)}`);
      break;
    case "stun":
      addStatus(state, "stunned", r.range(3, 5));
      break;
    case "poison":
      say(state, "The bite was poisoned.", "bad");
      hurt(state, r.rnd(6), `poisoned by ${article(monsterType(m.type).name)}`);
      if (r.chance(0.25) && p.stats.st > 3) {
        p.stats.st--;
        say(state, "You feel weaker.", "bad");
      }
      break;
    case "cold":
      if (!roleDef(p.role).coldResistant) addStatus(state, "slowed", r.range(3, 5));
      break;
    default:
      break;
  }
}

function article(name: string): string {
  if (/^[A-Z]/.test(name)) return name;
  return `${/^[aeiou]/.test(name) ? "an" : "a"} ${name}`;
}

/** Resolve a melee attack that was wound up earlier. The player may have stepped away. */
export function monsterStrikes(state: GameState, m: Monster): void {
  const p = state.player;
  const type = monsterType(m.type);
  const r = rng(state);
  if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) !== 1) {
    say(state, `${capital(nameFor(state, m))} strikes at where you were.`);
    return;
  }
  const helpless = has(state, "asleep") || has(state, "paralyzed");
  const ac = armorClass(state);
  for (const attack of type.attacks) {
    if (state.dead) return;
    let need = 10 + m.level + (ac >= 0 ? ac : -r.rnd(-ac));
    if (has(state, "invisible") && !type.boss) need -= 4;
    if (!helpless && need <= r.rnd(20)) {
      say(state, `${capital(nameFor(state, m))} misses.`);
      continue;
    }
    if (attack.dice[0] > 0) {
      let dmg = Math.round(r.dice(attack.dice[0], attack.dice[1]) * damageMod(state));
      if (ac < 0) dmg -= r.rnd(-ac);
      say(state, `${capital(nameFor(state, m))} ${attack.verb} you!`, "bad");
      hurt(state, Math.max(1, dmg), `killed by ${article(type.name)}`);
      emit(state, { kind: "sound", id: "hurt" });
    }
    if (!state.dead && attack.effect && r.chance(attack.chance)) applyAttackEffect(state, m, attack);
  }
}

/** Cells strictly between a monster and the player when they share a row or column and nothing blocks; null otherwise. */
export function clearLine(state: GameState, m: Monster, range: number): Pos[] | null {
  const p = state.player;
  const level = cur(state);
  if (m.x !== p.x && m.y !== p.y) return null;
  const dist = Math.abs(m.x - p.x) + Math.abs(m.y - p.y);
  if (dist === 0 || dist > range) return null;
  const sx = Math.sign(p.x - m.x);
  const sy = Math.sign(p.y - m.y);
  const cells: Pos[] = [];
  for (let i = 1; i < dist; i++) {
    const x = m.x + sx * i;
    const y = m.y + sy * i;
    if (projectileBlocked(level, x, y)) return null;
    cells.push({ x, y });
  }
  return cells;
}

/** Resolve a ranged attack that was wound up earlier. Stepping out of line avoids it. */
export function monsterShoots(state: GameState, m: Monster): void {
  const p = state.player;
  const type = monsterType(m.type);
  const ranged = type.ranged;
  if (!ranged) return;
  const r = rng(state);
  const line = clearLine(state, m, ranged.range);
  if (!line) {
    if (ranged.kind !== "gaze") say(state, `${capital(theMonster(m))} ${ranged.text}, and hits the wall where you were.`);
    return;
  }
  if (ranged.kind === "gaze") {
    const towardMonster = Math.sign(m.x - p.x) === (DX[p.dir] as number) && Math.sign(m.y - p.y) === (DY[p.dir] as number);
    if (has(state, "blind")) {
      say(state, "You feel a gaze pass over you. Being unable to see it, you are unharmed.", "good");
    } else if (reflects(state)) {
      say(state, "Medusa meets her own gaze in your amulet. She is, briefly, surprised. Then she is a statue.", "good");
      discover(state, "amulet_reflection");
      damageMonster(state, m, 99999, "force");
    } else if (towardMonster) {
      say(state, "You meet Medusa's gaze. Your skin greys, hardens, and stops being skin.", "danger");
      die(state, "turned to stone by Medusa's gaze");
    } else {
      say(state, "You feel eyes on you. Do not look.", "danger");
    }
    return;
  }
  const color = ranged.kind === "fire" ? "#f08030" : ranged.kind === "cold" ? "#90d0f0" : "#c080f0";
  emit(state, { kind: "ray", color, cells: [...line, { x: p.x, y: p.y }] });
  say(state, `${capital(theMonster(m))} ${ranged.text}!`, "bad");
  const roll = Math.round(r.dice(ranged.dice[0], ranged.dice[1]) * damageMod(state));
  if (ranged.reflectable && reflects(state)) {
    say(state, "It bounces off your amulet and goes back the way it came.", "good");
    discover(state, "amulet_reflection");
    damageMonster(state, m, roll, ranged.kind === "bolt" ? "force" : ranged.kind);
    return;
  }
  if (ranged.kind === "cold" && roleDef(p.role).coldResistant) {
    say(state, "You feel a chill. It does not trouble you.", "good");
    return;
  }
  hurt(state, roll, `killed by ${article(type.name)}'s ${ranged.kind === "fire" ? "fire" : ranged.kind === "cold" ? "bolt of cold" : "bolt of force"}`);
  if (ranged.kind === "cold" && !state.dead) addStatus(state, "slowed", r.range(3, 5));
}

/** Use up an item with a message when a monster's or trap's effect destroys it. */
export function destroyItem(state: GameState, item: Item, why: string): void {
  say(state, `Your ${itemType(item.type).name} ${why}`, "bad");
  consume(state, item);
}
