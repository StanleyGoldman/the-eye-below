// Shops, priests, and the characters who trade in rumors. All of it is
// talk and trade; none of it is combat.

import { scale3 } from "../core/modifiers.ts";
import type { Mods } from "../core/modifiers.ts";
import { stream } from "../core/rng.ts";
import type { Rng } from "../core/rng.ts";
import { APPEARANCES, itemType, typeKnown } from "./data/items.ts";
import { RUMORS } from "./data/rumors.ts";
import type { Rumor } from "./data/rumors.ts";
import { makeItem, rollItem } from "./factory.ts";
import type { UidSource } from "./factory.ts";
import { addToPack, armorClass, cur, emit, has, nameOf, say, takeFromPack } from "./state.ts";
import type { GameState, Item, ItemClass, Monster, ShopKind } from "./types.ts";

export interface ShopDef {
  id: ShopKind;
  name: string;
  /** Item classes it stocks and buys; null means anything. */
  classes: ItemClass[] | null;
  weight: number;
}

export const SHOPS: readonly ShopDef[] = [
  { id: "general", name: "general store", classes: null, weight: 40 },
  { id: "weapons", name: "weapon shop", classes: ["weapon"], weight: 12 },
  { id: "armor", name: "armory", classes: ["armor"], weight: 12 },
  { id: "potions", name: "apothecary", classes: ["potion"], weight: 12 },
  { id: "books", name: "scroll and book shop", classes: ["scroll", "spellbook"], weight: 12 },
  { id: "lighting", name: "lamp shop", classes: ["tool"], weight: 8 },
];

const KEEPER_NAMES = ["Aldith", "Borrin", "Cassel", "Dunmore", "Ephra", "Garrow", "Hesk", "Ilsabet", "Jorum", "Kettle", "Marrow", "Nessa", "Orrin", "Pell"];

export function shopDef(kind: ShopKind): ShopDef {
  return SHOPS.find((s) => s.id === kind) as ShopDef;
}

export function pickShopKind(rng: Rng): ShopKind {
  return (SHOPS[rng.weighted(SHOPS.map((s) => s.weight))] as ShopDef).id;
}

/** The lamp shop is always Old Wick's. */
export function keeperName(rng: Rng, kind: ShopKind): string {
  return kind === "lighting" ? "Old Wick" : rng.pick(KEEPER_NAMES);
}

export function makeStock(uids: UidSource, rng: Rng, kind: ShopKind, depth: number, mods: Mods): Item[] {
  const def = shopDef(kind);
  const stock: Item[] = [];
  if (kind === "lighting") {
    for (let i = 0; i < rng.range(2, 4); i++) stock.push(makeItem(uids, "lamp"));
    stock.push(makeItem(uids, "book_light"));
    stock.push(makeItem(uids, "scroll_fire", rng.range(1, 2)));
    if (rng.chance(0.4)) {
      const wand = makeItem(uids, "wand_lightning");
      wand.charges = rng.range(4, 8);
      stock.push(wand);
    }
    return stock;
  }
  const count = rng.range(8, 13);
  for (let i = 0; i < count; i++) {
    const cls = def.classes ? rng.pick(def.classes) : undefined;
    const item = rollItem(uids, rng, depth + 2, mods, cls);
    // Shopkeepers do not knowingly sell cursed goods. Mostly.
    if (item.buc === "C" && rng.chance(0.8)) {
      item.buc = "U";
      if (item.ench < 0) item.ench = 0;
    }
    stock.push(item);
  }
  return stock;
}

function charismaFactor(state: GameState): number {
  const ch = state.player.stats.ch;
  if (ch >= 18) return 0.75;
  if (ch >= 16) return 0.85;
  if (ch <= 5) return 1.5;
  if (ch <= 7) return 1.25;
  return 1;
}

/**
 * What one of an item costs to buy. It depends on what the item really
 * is, never on what the buyer knows, so a price is a clue.
 */
export function buyPrice(state: GameState, item: Item): number {
  const type = itemType(item.type);
  const base = type.cost + Math.max(0, item.ench) * 10;
  return Math.max(1, Math.round(base * scale3(state.run.mods["shopPrices"] ?? 5, 0.6, 1, 1.8) * charismaFactor(state)));
}

/** What a shopkeeper pays for one of an item: half its worth, whatever the price modifier says. */
export function sellPrice(_state: GameState, item: Item): number {
  const type = itemType(item.type);
  return Math.max(1, Math.floor((type.cost + Math.max(0, item.ench) * 10) / 2));
}

export function shopBuys(kind: ShopKind, item: Item): boolean {
  const type = itemType(item.type);
  if (type.cls === "gold" || type.keyColor || type.id === "amulet_eye" || item.slot) return false;
  const def = shopDef(kind);
  return def.classes === null || def.classes.includes(type.cls);
}

export function keeperOf(state: GameState): Monster | undefined {
  const prompt = state.prompt;
  if (!prompt || prompt.kind !== "shop") return undefined;
  return cur(state).monsters.find((m) => m.uid === prompt.keeper);
}

export function openShop(state: GameState, keeper: Monster): void {
  const npc = keeper.npc;
  if (!npc || !npc.shop) return;
  if (has(state, "invisible")) {
    say(state, `${npc.name} looks around, sees no customer, and goes back to the ledger. Shopkeepers do not serve what they cannot see.`, "npc");
    return;
  }
  say(state, `"Welcome to ${npc.name}'s ${shopDef(npc.shop).name}."`, "npc");
  emit(state, { kind: "sound", id: "shopbell" });
  state.prompt = { kind: "shop", title: `${npc.name}'s ${shopDef(npc.shop).name}`, keeper: keeper.uid };
}

export function closeShop(state: GameState): void {
  if (state.prompt?.kind === "shop") state.prompt = null;
}

/** Buy one of a stock item. */
export function buy(state: GameState, uid: number): boolean {
  const keeper = keeperOf(state);
  const stock = keeper?.npc?.stock;
  if (!keeper || !stock) return false;
  const item = stock.find((it) => it.uid === uid);
  if (!item) return false;
  const p = state.player;
  const price = buyPrice(state, item);
  if (p.gold < price) {
    say(state, `"That is ${price} gold. You have ${p.gold}."`, "npc");
    return false;
  }
  let one: Item;
  if (item.qty > 1) {
    item.qty--;
    one = { ...item, uid: state.nextUid++, qty: 1 };
  } else {
    stock.splice(stock.indexOf(item), 1);
    one = item;
  }
  one.letter = "";
  const packed = addToPack(state, one);
  if (!packed) {
    // No room: put it back.
    if (one === item) stock.push(item);
    else item.qty++;
    say(state, "Your pack cannot hold another kind of thing.", "bad");
    return false;
  }
  p.gold -= price;
  keeper.gold += price;
  say(state, `You buy ${nameOf(state, { ...one, qty: 1, slot: null })} for ${price} gold. ${packed.letter} - ${nameOf(state, packed)}.`, "loot");
  emit(state, { kind: "sound", id: "purchase" });
  return true;
}

/** Sell one of a pack item. */
export function sell(state: GameState, uid: number): boolean {
  const keeper = keeperOf(state);
  const npc = keeper?.npc;
  if (!keeper || !npc || !npc.shop || !npc.stock) return false;
  const p = state.player;
  const item = p.inventory.find((it) => it.uid === uid);
  if (!item) return false;
  if (!shopBuys(npc.shop, item)) {
    say(state, item.slot ? '"Take it off first."' : `"I have no use for that. This is a ${shopDef(npc.shop).name}."`, "npc");
    return false;
  }
  const price = sellPrice(state, item);
  const label = nameOf(state, { ...item, qty: 1 });
  const one = takeFromPack(state, item, 1);
  one.letter = "";
  const same = npc.stock.find((it) => it.type === one.type && it.buc === one.buc && it.ench === one.ench && itemType(it.type).stack);
  if (same) same.qty++;
  else npc.stock.push(one);
  p.gold += price;
  say(state, `You sell ${label} for ${price} gold.`, "loot");
  emit(state, { kind: "sound", id: "coins" });
  return true;
}

// ---- priests -----------------------------------------------------------

export function donationFor(state: GameState, size: "small" | "large"): number {
  return (size === "large" ? 400 : 100) * state.player.xl;
}

export function donate(state: GameState, size: "small" | "large"): void {
  const p = state.player;
  const cost = donationFor(state, size);
  if (p.gold < cost) {
    say(state, '"The thought is noted. The offering is not."', "npc");
    return;
  }
  p.gold -= cost;
  if (size === "large") {
    if (p.protection < 4) {
      const before = armorClass(state);
      p.protection++;
      say(state, `You give ${cost} gold. "You are under the temple's protection." You feel a certain watchfulness around you. Armor class ${before} becomes ${armorClass(state)}.`, "good");
    } else {
      p.luck = Math.min(10, p.luck + 1);
      say(state, `You give ${cost} gold. "You are as protected as the temple can make you. Take our goodwill instead."`, "good");
    }
    return;
  }
  if (p.luck < 0) {
    p.luck++;
    say(state, `You give ${cost} gold. "Go more gently than you came." You feel a little less watched from below.`, "good");
  } else {
    say(state, `You give ${cost} gold. "Thank you for your contribution." Nothing else happens, which was the price of a small one.`, "npc");
  }
}

// ---- rumors ------------------------------------------------------------

/** Rumors about this particular dungeon: some true, some false. */
export function seedRumors(state: GameState): Rumor[] {
  const out: Rumor[] = [];
  const seed = state.run.seed;
  const rng = stream(seed, "seedrumors");
  const artifact = stream(seed, "artifact").range(16, 19);
  out.push({ text: `A hammer that throws lightning lies on level ${artifact}.`, truth: true });
  out.push({ text: `A hammer that throws lightning lies on level ${artifact > 17 ? artifact - 5 : artifact + 4}.`, truth: false });
  for (const cls of ["potion", "scroll"] as const) {
    const pool = APPEARANCES[cls];
    if (!pool) continue;
    const types = Object.keys(state.appearance).filter((id) => itemType(id).cls === cls);
    for (const id of types) {
      const look = pool[(state.appearance[id] as number) % pool.length];
      if (!look) continue;
      const lie = rng.chance(0.4);
      const named = lie ? itemType(rng.pick(types.filter((x) => x !== id))).name : itemType(id).name;
      const what = cls === "potion" ? `the ${look.text} potion` : `the scroll labeled ${look.text}`;
      out.push({ text: `They say ${what} is a ${named}.`, truth: !lie });
    }
  }
  return out;
}

/** The next thing this character says. Each has three things to say, then repeats itself. */
export function nextRumor(state: GameState, speaker: Monster): Rumor {
  const npc = speaker.npc;
  const told = npc ? npc.told : 0;
  const pool = [...RUMORS, ...seedRumors(state)];
  // Drop what the listener already knows for a fact, where that can be told.
  const fresh = pool.filter((r) => {
    const m = /is a (potion|scroll) of/.exec(r.text);
    if (!m) return true;
    const type = Object.keys(state.appearance).find((id) => r.text.endsWith(`is a ${itemType(id).name}.`));
    return !(type && r.truth && typeKnown(state, itemType(type)));
  });
  const rng = stream(state.run.seed, "rumor", speaker.uid);
  const order = rng.shuffle(fresh.slice());
  const rumor = order[Math.min(told, 2) % order.length] as Rumor;
  if (npc && told < 3) npc.told = told + 1;
  return rumor;
}

export const NPC_GREETING: Record<string, string[]> = {
  hermit: ["The hermit does not look up.", "The hermit speaks to the wall, but loud enough for you."],
  adventurer: ["The adventurer flinches, then lowers the lantern.", "\"You're not one of them. Good. Listen.\""],
  gnome: ["The gnome peers up at you.", "The gnome taps the side of its nose."],
};
