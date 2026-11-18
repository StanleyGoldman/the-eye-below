// Interprets the ops in the effect table. Every potion, scroll, wand,
// spell, and fountain outcome ends up here.

import { scale3 } from "../core/modifiers.ts";
import { featureAt, lineOfSight } from "../dungeon/grid.ts";
import { damageMonster, lineAhead, monsterInSight } from "./combat.ts";
import type { DamageKind } from "./combat.ts";
import type { BoltKind, EffectRule, Op } from "./data/effects.ts";
import { itemType, typeKnown } from "./data/items.ts";
import { monsterType } from "./data/monsters.ts";
import { XP_FOR_LEVEL, roleDef } from "./data/roles.ts";
import { addStatus, capital, consume, cur, cure, discover, emit, has, heal, hurt, levelUp, monsterAt, nameOf, rng, say, theMonster, wornItem } from "./state.ts";
import { DX, DY, PERMANENT } from "./types.ts";
import type { GameState, Item, Monster, Pos } from "./types.ts";
import { changeLevel, levelTeleport, mapLevel, summon, teleportPlayer, updateSeen } from "./world.ts";

export interface EffectContext {
  /** The item being used, dipped, or zapped, if any. */
  item?: Item;
  /** For death messages: "a potion of ...". */
  source: string;
}

/** Does anything about this item remain unknown to the player? */
export function isUnidentified(state: GameState, item: Item): boolean {
  const type = itemType(item.type);
  if (type.cls === "gold" || type.keyColor) return false;
  if (!typeKnown(state, type)) return true;
  if (!item.bucKnown && type.id !== "amulet_eye") return true;
  return !item.known && (type.cls === "weapon" || type.cls === "armor" || type.cls === "wand" || type.id === "ring_protection");
}

export function identifyItem(state: GameState, item: Item, quiet = false): void {
  discover(state, item.type);
  item.known = true;
  item.bucKnown = true;
  if (!quiet) say(state, `${item.letter} - ${nameOf(state, item)}.`, "loot");
}

const BOLT_COLOR: Record<BoltKind, string> = { force: "#e0e0ff", missile: "#c080f0", sleep: "#a0a0a0", fire: "#f08030", cold: "#90d0f0", lightning: "#fff080" };
const BOLT_DAMAGE: Record<BoltKind, DamageKind> = { force: "force", missile: "missile", sleep: "force", fire: "fire", cold: "cold", lightning: "lightning" };

function castBolt(state: GameState, op: Extract<Op, { op: "bolt" }>): void {
  const p = state.player;
  const level = cur(state);
  const r = rng(state);
  const cells = lineAhead(state, op.range);
  emit(state, { kind: "ray", color: BOLT_COLOR[op.kind], cells: cells.slice() });
  let hits = 0;
  for (const c of cells) {
    const m = monsterAt(level, c.x, c.y) ?? level.monsters.find((x) => x.hp <= 0 && x.reviveAt > 0 && x.x === c.x && x.y === c.y);
    if (!m) continue;
    hits++;
    if (m.peaceful && m.hp > 0) {
      m.peaceful = false;
      say(state, `${capital(theMonster(m))} gets angry!`, "danger");
    }
    if (op.kind === "sleep") {
      if (monsterType(m.type).boss || monsterType(m.type).undead) say(state, `${capital(theMonster(m))} shrugs off the ray.`);
      else {
        m.sleepUntil = state.time + r.range(15000, 30000);
        m.windupUntil = 0;
        m.windupKind = "";
        say(state, `${capital(theMonster(m))} falls asleep.`, "good");
      }
    } else {
      let n = op.n;
      let flat = 0;
      if (op.perLevel) {
        if (op.kind === "force") flat = Math.floor(p.xl / 2);
        else n = Math.floor(p.xl / 2) + 1;
      }
      const dmg = r.dice(n, op.s) + flat;
      if (m.hp > 0) say(state, `The ${op.kind === "force" ? "blow" : op.kind === "missile" ? "missiles" : `bolt of ${op.kind}`} ${op.kind === "missile" ? "hit" : "hits"} ${theMonster(m)}.`);
      const died = damageMonster(state, m, dmg, BOLT_DAMAGE[op.kind]);
      if (!died && op.kind === "cold" && m.hp > 0) m.nextMove = Math.max(m.nextMove, state.time) + 2500;
    }
    if (!op.ray) break;
  }
  if (op.kind === "force") {
    // Force breaks a boulder standing just past the end of its reach.
    const last = cells[cells.length - 1] ?? { x: p.x, y: p.y };
    if (hits === 0 && cells.length < op.range) {
      const bx = last.x + (DX[p.dir] as number);
      const by = last.y + (DY[p.dir] as number);
      const f = featureAt(level, bx, by);
      if (f && f.kind === "boulder") {
        level.features.splice(level.features.indexOf(f), 1);
        say(state, "The boulder shatters into gravel.", "good");
        hits++;
      }
    }
  }
  if (hits === 0) say(state, op.ray ? "It crackles away down the passage and hits nothing." : "It strikes nothing.");
}

function castFireball(state: GameState, op: Extract<Op, { op: "fireball" }>): void {
  const p = state.player;
  const level = cur(state);
  const r = rng(state);
  const cells = lineAhead(state, op.range);
  let center: Pos = cells[cells.length - 1] ?? { x: p.x, y: p.y };
  for (const c of cells) {
    if (monsterAt(level, c.x, c.y)) {
      center = c;
      break;
    }
  }
  emit(state, { kind: "ray", color: "#f08030", cells: cells.slice(0, cells.findIndex((c) => c.x === center.x && c.y === center.y) + 1) });
  emit(state, { kind: "flash", color: "#f08030" });
  let burned = 0;
  for (const m of level.monsters.slice()) {
    if (Math.max(Math.abs(m.x - center.x), Math.abs(m.y - center.y)) > 1) continue;
    if (!lineOfSight(level, center.x, center.y, m.x, m.y)) continue;
    burned++;
    damageMonster(state, m, r.dice(op.n, op.s), "fire");
  }
  if (Math.max(Math.abs(p.x - center.x), Math.abs(p.y - center.y)) <= 1) {
    say(state, "You are caught in your own fireball.", "danger");
    hurt(state, Math.round(r.dice(op.n, op.s) / 2), "killed by their own fireball");
  } else if (burned === 0) {
    say(state, "The fireball bursts against the stone and burns nothing.");
  } else {
    say(state, "The fireball bursts.", "good");
  }
}

function pickArmor(state: GameState): Item | undefined {
  const worn = state.player.inventory.filter((it) => it.slot && itemType(it.type).armor);
  return worn.length > 0 ? rng(state).pick(worn) : undefined;
}

function wieldedWeapon(state: GameState): Item | undefined {
  const w = wornItem(state.player, "main");
  return w && itemType(w.type).weapon ? w : undefined;
}

/** Run a list of ops. Returns false if nothing observable happened. */
export function applyOps(state: GameState, ops: readonly Op[], ctx: EffectContext): boolean {
  const p = state.player;
  const r = rng(state);
  const level = (): ReturnType<typeof cur> => cur(state);
  let noticed = true;
  for (const op of ops) {
    if (state.dead) break;
    switch (op.op) {
      case "heal": {
        const amount = r.dice(op.n, op.s);
        if (p.hp >= p.maxHp && op.raiseMax > 0) p.maxHp += op.raiseMax;
        heal(state, amount);
        break;
      }
      case "cure":
        cure(state, op.status);
        break;
      case "cureStone":
        if (p.stoning > 0) {
          p.stoning = 0;
          p.stoneStage = 0;
          say(state, "The stiffness leaves your limbs.", "good");
        }
        break;
      case "status":
        addStatus(state, op.status, r.range(op.min, op.max));
        break;
      case "statusForever":
        addStatus(state, op.status, PERMANENT);
        break;
      case "gainLevel":
        if (p.xl < XP_FOR_LEVEL.length - 1) p.xp = Math.max(p.xp, XP_FOR_LEVEL[p.xl + 1] as number);
        levelUp(state);
        break;
      case "ceiling":
        if (state.depth <= 1) {
          say(state, "You hit your head on the ceiling. Above it is somebody's kitchen, and they are not expecting you.", "bad");
          hurt(state, r.rnd(4), "killed by a low ceiling");
        } else {
          changeLevel(state, state.depth - 1, "port");
        }
        break;
      case "ceilingBump": {
        const helm = wornItem(p, "helm");
        if (helm) {
          say(state, `You hit the ceiling. Your ${itemType(helm.type).name} takes the blow.`, "info");
          hurt(state, 1, "killed by a ceiling");
        } else {
          say(state, "You hit your head on the ceiling. A helmet would have helped.", "bad");
          hurt(state, r.dice(op.n, op.s), "killed by a ceiling");
        }
        break;
      }
      case "damage":
        hurt(state, op.s <= 1 ? op.n : r.dice(op.n, op.s), `killed by ${op.cause}`);
        break;
      case "luck":
        p.luck = Math.max(-10, Math.min(10, p.luck + op.delta));
        break;
      case "identify": {
        const unknown = p.inventory.filter((it) => it !== ctx.item && isUnidentified(state, it));
        if (op.mode === "self") break;
        if (unknown.length === 0) {
          say(state, "You have nothing left to identify.");
          break;
        }
        if (op.mode === "all") for (const it of unknown) identifyItem(state, it);
        else if (op.mode === "random") identifyItem(state, r.pick(unknown));
        else state.prompt = { kind: "pick", title: "Identify which item?", purpose: "identify", count: 1 };
        break;
      }
      case "enchant": {
        const item = op.target === "weapon" ? wieldedWeapon(state) : pickArmor(state);
        if (!item) {
          say(state, op.target === "weapon" ? "Your hands twitch." : "Your skin glows, then fades.");
          noticed = false;
          break;
        }
        const delta = r.range(op.min, op.max);
        const limit = op.target === "weapon" ? 5 : 3;
        const what = itemType(item.type).name;
        if (delta > 0 && item.ench > limit && r.chance(0.66)) {
          say(state, `Your ${what} glows violently for a while, then evaporates.`, "danger");
          consume(state, item);
          break;
        }
        item.ench += delta;
        if (delta > 0 && item.buc === "C") item.buc = "U";
        break;
      }
      case "proof": {
        const item = op.target === "weapon" ? wieldedWeapon(state) : pickArmor(state);
        if (!item) {
          say(state, op.target === "weapon" ? "Your hands twitch." : "Your skin glows, then fades.");
          noticed = false;
          break;
        }
        item.proof = op.value;
        break;
      }
      case "uncurse":
        for (const it of p.inventory) if (it.buc === "C" && (op.scope === "all" || it.slot)) it.buc = "U";
        break;
      case "scramble":
        for (const it of p.inventory) {
          if (it.buc !== "U" || !r.chance(0.35)) continue;
          it.buc = r.chance(0.5) ? "B" : "C";
          it.bucKnown = false;
        }
        break;
      case "curseSome":
        for (const it of p.inventory) if (r.chance(op.chance)) it.buc = it.buc === "B" ? "U" : "C";
        break;
      case "curseItem":
        if (ctx.item) ctx.item.buc = ctx.item.buc === "B" ? "U" : "C";
        break;
      case "uncurseItem":
        if (ctx.item && ctx.item.buc === "C") ctx.item.buc = "U";
        break;
      case "map":
        mapLevel(state, op.mode);
        break;
      case "teleport":
        if (op.mode === "level") levelTeleport(state);
        else teleportPlayer(state, op.mode);
        break;
      case "fire": {
        emit(state, { kind: "flash", color: "#f08030" });
        for (const m of level().monsters.slice()) {
          if (Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) > 1) continue;
          damageMonster(state, m, r.dice(op.others[0], op.others[1]), "fire");
        }
        if (op.self[0] > 0) hurt(state, r.dice(op.self[0], op.self[1]), "burned by a scroll of fire");
        break;
      }
      case "burnItem": {
        const paper = p.inventory.filter((it) => it !== ctx.item && (itemType(it.type).cls === "scroll" || itemType(it.type).cls === "spellbook"));
        if (paper.length > 0) {
          const it = r.pick(paper);
          say(state, `Your ${nameOf(state, { ...it, qty: 1 }, false)} catches fire and burns.`, "bad");
          consume(state, it);
        }
        break;
      }
      case "scare":
        for (const m of level().monsters) {
          if (m.peaceful || monsterType(m.type).boss) continue;
          if (Math.abs(m.x - p.x) + Math.abs(m.y - p.y) > op.radius) continue;
          m.fleeUntil = state.time + op.seconds * 1000;
          m.asleep = false;
          m.windupUntil = 0;
          m.windupKind = "";
        }
        break;
      case "wake":
        for (const m of level().monsters) {
          if (m.peaceful) continue;
          m.asleep = false;
          m.sleepUntil = 0;
          m.aware = true;
        }
        break;
      case "bolt":
        castBolt(state, op);
        break;
      case "fireball":
        castFireball(state, op);
        break;
      case "light":
        p.litUntil = state.time + op.seconds * 1000;
        updateSeen(state);
        break;
      case "detect":
        p.detectUntil = state.time + op.seconds * 1000;
        break;
      case "turnUndead": {
        let turned = 0;
        for (const m of level().monsters.slice()) {
          if (!monsterType(m.type).undead || !monsterInSight(state, m, 7)) continue;
          turned++;
          if (m.level <= p.xl - 3) {
            say(state, `${capital(theMonster(m))} falls apart.`, "good");
            damageMonster(state, m, 99999, "force");
          } else {
            m.fleeUntil = state.time + 20000;
            m.windupUntil = 0;
            m.windupKind = "";
            say(state, `${capital(theMonster(m))} recoils and flees.`, "good");
          }
        }
        if (turned === 0) say(state, "Nothing answers. Nothing dead, anyway.");
        break;
      }
      case "hold": {
        let held: Monster | undefined;
        for (const c of lineAhead(state, op.range)) {
          held = monsterAt(level(), c.x, c.y);
          if (held) break;
        }
        if (!held) {
          say(state, "Your fist closes on nothing.");
          break;
        }
        const boss = monsterType(held.type).boss;
        held.heldUntil = state.time + (op.seconds * 1000) / (boss ? 3 : 1);
        held.windupUntil = 0;
        held.windupKind = "";
        say(state, `${capital(theMonster(held))} stiffens in place.`, "good");
        break;
      }
      case "drainPower":
        p.pw = 0;
        break;
      case "summon": {
        const made = summon(state, op.type, r.range(op.min, op.max), p);
        if (made === 0) noticed = false;
        break;
      }
      case "gold": {
        const amount = Math.max(1, Math.round(r.dice(op.n, op.s) * (1 + state.depth / 4) * scale3(state.run.mods["gold"] ?? 5, 0.3, 1, 3)));
        p.gold += amount;
        say(state, `${amount} gold pieces.`, "loot");
        break;
      }
      case "dryUp": {
        const ahead = { x: p.x + (DX[p.dir] as number), y: p.y + (DY[p.dir] as number) };
        const f = featureAt(level(), ahead.x, ahead.y);
        if (f && f.kind === "fountain") level().features.splice(level().features.indexOf(f), 1);
        break;
      }
      case "explodeWand":
        hurt(state, r.dice(2, 8), "killed by an exploding wand");
        if (ctx.item) consume(state, ctx.item);
        break;
      case "nothing":
        break;
    }
  }
  return noticed;
}

/** Apply one rule from the effect table: its message, its ops, and what the player learns. */
export function applyRule(state: GameState, rule: EffectRule, ctx: EffectContext): boolean {
  if (rule.msg) say(state, rule.msg, "info");
  const noticed = applyOps(state, rule.ops, ctx);
  return noticed && rule.reveals !== false;
}

/** Failure chance, 0 to 95, of casting a spell of this level. */
export function spellFailure(state: GameState, spellLevel: number, armorPenalty: number): number {
  const p = state.player;
  const role = roleDef(p.role);
  const chance = role.spellBase + spellLevel * 10 - p.xl * 3 - (p.stats.in - 10) * 2 + armorPenalty;
  return Math.max(0, Math.min(95, Math.round(chance)));
}

/** Can the player make out writing right now? */
export function canRead(state: GameState): boolean {
  return !has(state, "blind");
}
