// The game screen: viewport on the left, character panel on the right,
// message log and buttons below. Built once, then refreshed from the
// game state every frame, touching the DOM only where something changed.

import type { AssetStore } from "../assets/store.ts";
import { castFailure, itemActions } from "../game/actions.ts";
import type { ItemAction } from "../game/actions.ts";
import { perceives } from "../game/combat.ts";
import { CLASS_NAME, CLASS_ORDER, CLASS_SYMBOL, itemName, itemType, typeKnown } from "../game/data/items.ts";
import { monsterType } from "../game/data/monsters.ts";
import { roleDef, XP_FOR_LEVEL } from "../game/data/roles.ts";
import { spellCost, spellDef } from "../game/data/spells.ts";
import { ITEM_BLURB, STATUS_INFO, STAT_HELP } from "../game/data/text.ts";
import { isUnidentified } from "../game/effects.ts";
import { activeStatuses, armorClass, capital, facing, has, monsterAt, wornItem } from "../game/state.ts";
import { DIR_NAMES, PERMANENT } from "../game/types.ts";
import type { GameState, Item, ItemClass, Msg, Prompt } from "../game/types.ts";
import type { ActionId, KeyMap } from "../input/keys.ts";
import { itemTint } from "../render/view.ts";
import { MAP_LEGEND, centredView, drawMap, fullView } from "./automap.ts";
import { button, clear, el, tip } from "./dom.ts";

export const FONT = '"VT323", "Courier New", monospace';
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

export const ITEM_ACTION_KEYS: Record<ItemAction, string> = {
  wield: "w",
  offhand: "x",
  unwield: "w",
  wear: "W",
  takeoff: "T",
  puton: "P",
  remove: "R",
  quaff: "q",
  read: "r",
  zap: "z",
  throw: "t",
  dip: "D",
  drop: "d",
};

export interface HudCallbacks {
  act(action: ActionId): void;
  useItem(uid: number, action: ItemAction): void;
  cast(spellId: string): void;
  choose(optionId: string): void;
  pickItem(uid: number): void;
  cancelPrompt(): void;
  resetPuzzle(): void;
  selectItem(uid: number | null): void;
}

function describeItem(state: GameState, item: Item): string {
  const type = itemType(item.type);
  const lines = [capital(itemName(state, item))];
  const known = typeKnown(state, type);
  if (type.weapon) {
    const w = type.weapon;
    const bonus = w.bonus + (item.known ? item.ench : 0);
    let text = `Damage ${w.dice[0]}d${w.dice[1]}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ""}`;
    if (w.launcher) text = "Fires arrows from your pack";
    else if (w.ammo) text += " when fired from a bow";
    if (w.twoHanded) text += ", two-handed";
    if (w.cooldown > 0) text += `, one swing every ${(w.cooldown / 1000).toFixed(1)} s`;
    if (w.throwable) text += ". Can be thrown";
    lines.push(`${text}.`);
    if (!item.known) lines.push("Its enchantment is unknown.");
  } else if (type.armor) {
    lines.push(`Armor ${type.armor.ac}${item.known && item.ench !== 0 ? ` ${item.ench > 0 ? "+" : ""}${item.ench}` : ""}.${type.armor.spellPenalty > 0 ? ` Adds ${type.armor.spellPenalty}% to spell failure.` : ""}`);
    if (!item.known) lines.push("Its enchantment is unknown until worn.");
  } else if (type.keyColor) {
    lines.push(type.keyColor === "bone" ? "Fits no lock on this level. Try the next one down." : "Opens one lock of its colour, and stays in it.");
  } else if (type.cls === "spellbook") {
    if (known && type.spell) lines.push(`Teaches ${spellDef(type.spell).name} (level ${type.level}). ${spellDef(type.spell).blurb}`);
    else lines.push("An unread spellbook. Hard books punish the unready.");
  } else if (known) {
    const blurb = ITEM_BLURB[type.id];
    if (blurb) lines.push(blurb);
  } else if (type.cls !== "gold") {
    lines.push("Unidentified. Using it will tell you what it is, one way or another.");
  }
  if (!item.bucKnown && !type.keyColor && type.cls !== "gold" && type.id !== "amulet_eye") lines.push("Not known to be blessed or cursed. An altar would tell.");
  return lines.join("\n");
}

export class Hud {
  readonly root: HTMLElement;
  readonly view: HTMLCanvasElement;
  private readonly store: AssetStore;
  private readonly keys: KeyMap;
  private readonly cb: HudCallbacks;

  private readonly minimap: HTMLCanvasElement;
  private readonly bigmap: HTMLCanvasElement;
  private readonly mapPanel: HTMLElement;
  private readonly target: HTMLElement;
  private readonly targetName: HTMLElement;
  private readonly targetBar: HTMLElement;
  private readonly viewMsg: HTMLElement;
  private readonly depthTag: HTMLElement;
  private readonly compass: HTMLElement;
  private readonly logBox: HTMLElement;
  private readonly portrait: HTMLElement;
  private readonly who: HTMLElement;
  private readonly hpBar: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly pwBar: HTMLElement;
  private readonly pwText: HTMLElement;
  private readonly statBox: HTMLElement;
  private readonly statusBox: HTMLElement;
  private readonly mainHand: HTMLElement;
  private readonly offHand: HTMLElement;
  private readonly mainCool: HTMLElement;
  private readonly offCool: HTMLElement;
  private readonly invBox: HTMLElement;
  private readonly invHint: HTMLElement;
  private readonly modal: HTMLElement;
  private readonly itemMenu: HTMLElement;
  private readonly spellBox: HTMLElement;
  private readonly resetButton: HTMLElement;
  private readonly floats: HTMLElement;

  private logShown = new WeakSet<Msg>();
  private logStamp = -1;
  private invSig = "";
  private statSig = "";
  private statusSig = "";
  private handSig = "";
  private promptSig = "";
  private whoSig = "";
  private lastMap = 0;
  private mapOpen = false;
  private spellsOpen = false;
  private invMode = false;
  private selected: number | null = null;

  constructor(parent: HTMLElement, store: AssetStore, keys: KeyMap, cb: HudCallbacks) {
    this.store = store;
    this.keys = keys;
    this.cb = cb;
    this.root = el("div", "game");
    parent.appendChild(this.root);

    // ---- viewport ----
    const wrap = el("div", "viewwrap");
    this.view = el("canvas", "view");
    wrap.appendChild(this.view);
    this.depthTag = tip(el("div", "depthtag"), STAT_HELP["depth"] as string);
    wrap.appendChild(this.depthTag);
    this.target = el("div", "target");
    this.targetName = el("div", "targetname");
    const barWrap = el("div", "targetbarwrap");
    this.targetBar = el("div", "targetbar");
    barWrap.appendChild(this.targetBar);
    this.target.append(this.targetName, barWrap);
    wrap.appendChild(this.target);
    this.viewMsg = el("div", "viewmsg");
    wrap.appendChild(this.viewMsg);
    this.floats = el("div", "floats");
    wrap.appendChild(this.floats);
    this.minimap = el("canvas", "minimap");
    this.minimap.width = 110;
    this.minimap.height = 110;
    tip(this.minimap, "The minimap: a crop of the automap around you. Press the map key for the whole level.");
    this.minimap.addEventListener("click", () => this.cb.act("map"));
    wrap.appendChild(this.minimap);
    this.compass = tip(el("div", "compass"), "The way you are facing.");
    this.compass.style.backgroundImage = `url(${store.url("ui_compass")})`;
    wrap.appendChild(this.compass);

    this.mapPanel = el("div", "mappanel");
    this.bigmap = el("canvas", "bigmap");
    this.bigmap.width = 440;
    this.bigmap.height = 400;
    const legend = el("div", "maplegend");
    legend.appendChild(el("div", "legendtitle", "Map"));
    for (const [ch, color, text] of MAP_LEGEND) {
      const row = el("div", "legendrow");
      const g = el("span", "legendglyph", ch);
      g.style.color = color;
      row.append(g, el("span", "", text));
      legend.appendChild(row);
    }
    this.mapPanel.append(this.bigmap, legend);
    this.mapPanel.hidden = true;
    wrap.appendChild(this.mapPanel);
    this.root.appendChild(wrap);

    // ---- log and buttons ----
    const bottom = el("div", "bottom");
    this.logBox = el("div", "log");
    bottom.appendChild(this.logBox);
    const pad = el("div", "pad");
    const move = el("div", "movepad");
    const padButton = (cls: string, label: string, action: ActionId, help: string): HTMLButtonElement => {
      const b = button(label, () => this.cb.act(action), `btn pad-${cls}`);
      b.dataset["action"] = action;
      tip(b, help);
      return b;
    };
    move.append(
      padButton("turn", "<", "turnLeft", "Turn left"),
      padButton("go", "^", "forward", "Step forward"),
      padButton("turn", ">", "turnRight", "Turn right"),
      padButton("side", "<<", "strafeLeft", "Sidestep left"),
      padButton("go", "v", "back", "Step back"),
      padButton("side", ">>", "strafeRight", "Sidestep right"),
    );
    const acts = el("div", "actpad");
    acts.append(
      padButton("act", "Attack", "attack", "Swing or fire at what is ahead"),
      padButton("act", "Use", "interact", "Doors, switches, fountains, altars, talking"),
      padButton("act", "Get", "pickup", "Pick up what lies here"),
      padButton("act", "Rest", "rest", "Sit and recover; time runs fast"),
      padButton("act", "Cast", "cast", "Open the spell list"),
      padButton("act", "Map", "map", "Show the whole level"),
    );
    this.resetButton = tip(button("Reset boulders", () => this.cb.resetPuzzle(), "btn pad-reset"), "Put every boulder back where it started and return to the stairs. Filled pits stay filled. Always available on this level.");
    this.resetButton.hidden = true;
    pad.append(move, acts, this.resetButton);
    bottom.appendChild(pad);
    this.root.appendChild(bottom);

    // ---- character panel ----
    const side = el("div", "side");
    side.style.backgroundImage = `url(${store.url("ui_frame")})`;
    bottom.style.backgroundImage = `url(${store.url("ui_frame")})`;
    const head = el("div", "head");
    this.portrait = el("div", "portrait");
    this.who = el("div", "who");
    head.append(this.portrait, this.who);
    const bars = el("div", "bars");
    const hpWrap = tip(el("div", "bar hp"), "Hit points. At zero you die.");
    this.hpBar = el("div", "fill");
    this.hpText = el("div", "bartext");
    hpWrap.append(this.hpBar, this.hpText);
    const pwWrap = tip(el("div", "bar pw"), "Power. Spells spend it; it returns slowly, faster when resting.");
    this.pwBar = el("div", "fill");
    this.pwText = el("div", "bartext");
    pwWrap.append(this.pwBar, this.pwText);
    bars.append(hpWrap, pwWrap);
    head.appendChild(bars);
    side.appendChild(head);
    this.statBox = el("div", "stats");
    side.appendChild(this.statBox);
    this.statusBox = el("div", "statuses");
    side.appendChild(this.statusBox);

    const hands = el("div", "hands");
    const hand = (label: string): { slot: HTMLElement; cool: HTMLElement } => {
      const slot = el("div", "hand");
      slot.style.backgroundImage = `url(${store.url("ui_slot")})`;
      const icon = el("canvas", "handicon");
      icon.width = 32;
      icon.height = 32;
      const cool = el("div", "cool");
      const tag = el("div", "handtag", label);
      slot.append(icon, cool, tag);
      slot.addEventListener("click", () => this.cb.act("attack"));
      return { slot, cool };
    };
    const main = hand("Main");
    const off = hand("Off");
    this.mainHand = main.slot;
    this.mainCool = main.cool;
    this.offHand = off.slot;
    this.offCool = off.cool;
    hands.append(this.mainHand, this.offHand);
    side.appendChild(hands);

    const invHead = el("div", "invhead");
    invHead.appendChild(el("span", "", "Pack"));
    this.invHint = el("span", "invhint");
    invHead.appendChild(this.invHint);
    side.appendChild(invHead);
    this.invBox = el("div", "inv");
    side.appendChild(this.invBox);
    this.root.appendChild(side);

    // ---- floating panels ----
    this.modal = el("div", "modal");
    this.modal.hidden = true;
    this.itemMenu = el("div", "itemmenu");
    this.itemMenu.hidden = true;
    this.spellBox = el("div", "spellbox");
    this.spellBox.hidden = true;
    this.root.append(this.modal, this.itemMenu, this.spellBox);
  }

  /** A number or word that rises from the middle of the view and fades: damage dealt and taken. */
  float(text: string, kind: "hit" | "miss" | "hurt"): void {
    if (this.floats.childElementCount > 8) return;
    const node = el("div", `float ${kind}`, text);
    node.style.marginLeft = `${Math.round((Math.random() - 0.5) * 70)}px`;
    node.addEventListener("animationend", () => node.remove());
    this.floats.appendChild(node);
  }

  // ---- modes the input layer toggles ------------------------------------

  isMapOpen(): boolean {
    return this.mapOpen;
  }

  setMapOpen(open: boolean): void {
    this.mapOpen = open;
    this.mapPanel.hidden = !open;
    this.lastMap = 0;
  }

  isSpellsOpen(): boolean {
    return this.spellsOpen;
  }

  setSpellsOpen(open: boolean, state: GameState | null): void {
    this.spellsOpen = open;
    this.spellBox.hidden = !open;
    if (open && state) this.renderSpells(state);
  }

  isInventoryMode(): boolean {
    return this.invMode;
  }

  setInventoryMode(on: boolean): void {
    this.invMode = on;
    this.root.classList.toggle("invmode", on);
  }

  selectedItem(): number | null {
    return this.selected;
  }

  /** Open the action menu for an item, or close it with null. */
  setSelected(uid: number | null, state: GameState | null): void {
    this.selected = uid;
    this.invSig = "";
    if (uid === null || !state) {
      this.itemMenu.hidden = true;
      return;
    }
    const item = state.player.inventory.find((it) => it.uid === uid);
    if (!item) {
      this.selected = null;
      this.itemMenu.hidden = true;
      return;
    }
    clear(this.itemMenu);
    this.itemMenu.appendChild(el("div", "menutitle", `${item.letter} - ${itemName(state, item)}`));
    for (const action of itemActions(state, item)) {
      const key = ITEM_ACTION_KEYS[action.id];
      const b = button(`[${key}] ${action.label}`, () => this.cb.useItem(item.uid, action.id), "btn menuitem");
      b.dataset["itemAction"] = action.id;
      this.itemMenu.appendChild(b);
    }
    this.itemMenu.appendChild(button("[Esc] Never mind", () => this.cb.selectItem(null), "btn menuitem"));
    this.itemMenu.hidden = false;
  }

  /** Reset everything that remembers the previous game. */
  reset(): void {
    clear(this.logBox);
    this.logShown = new WeakSet<Msg>();
    this.logStamp = -1;
    this.invSig = "";
    this.statSig = "";
    this.statusSig = "";
    this.handSig = "";
    this.promptSig = "";
    this.whoSig = "";
    this.setMapOpen(false);
    this.setSpellsOpen(false, null);
    this.setInventoryMode(false);
    this.setSelected(null, null);
    this.modal.hidden = true;
  }

  // ---- refresh ----------------------------------------------------------

  refresh(state: GameState, now: number): void {
    const p = state.player;
    const level = state.levels[state.depth];

    const who = `${p.name}|${p.role}|${p.xl}`;
    if (who !== this.whoSig) {
      this.whoSig = who;
      const role = roleDef(p.role);
      this.portrait.style.backgroundImage = `url(${this.store.url(role.portrait)})`;
      tip(this.portrait, `${p.name} the ${role.name}. ${role.blurb}`);
      clear(this.who);
      this.who.append(el("div", "name", p.name), el("div", "role", `${role.name}, level ${p.xl}`));
    }

    this.hpBar.style.width = `${Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))}%`;
    this.hpText.textContent = `HP ${Math.max(0, p.hp)}/${p.maxHp}`;
    this.hpBar.parentElement?.classList.toggle("low", p.hp <= Math.max(5, p.maxHp / 4));
    this.pwBar.style.width = `${Math.max(0, Math.min(100, (p.pw / Math.max(1, p.maxPw)) * 100))}%`;
    this.pwText.textContent = `Pw ${p.pw}/${p.maxPw}`;

    const ac = armorClass(state);
    const nextXp = XP_FOR_LEVEL[p.xl + 1];
    const statSig = `${p.stats.st},${p.stats.dx},${p.stats.co},${p.stats.in},${p.stats.wi},${p.stats.ch},${ac},${p.xp},${p.gold},${p.luck},${state.depth}`;
    if (statSig !== this.statSig) {
      this.statSig = statSig;
      clear(this.statBox);
      const stat = (label: string, value: string, key: string, extra = ""): void => {
        const cell = tip(el("div", "stat"), `${STAT_HELP[key] ?? ""}${extra}`);
        cell.append(el("span", "statlabel", label), el("span", "statvalue", value));
        this.statBox.appendChild(cell);
      };
      stat("St", String(p.stats.st), "st");
      stat("Dx", String(p.stats.dx), "dx");
      stat("Co", String(p.stats.co), "co");
      stat("In", String(p.stats.in), "in");
      stat("Wi", String(p.stats.wi), "wi");
      stat("Ch", String(p.stats.ch), "ch");
      stat("AC", String(ac), "ac");
      stat("XP", String(p.xp), "xp", nextXp !== undefined ? `\nNext level at ${nextXp}.` : "");
      stat("$", String(p.gold), "gold");
      stat("Lk", p.luck > 0 ? `+${p.luck}` : String(p.luck), "luck");
    }

    const statuses = activeStatuses(state);
    const extra: string[] = [];
    if (p.stoning > 0) extra.push("stone");
    if (p.strangling > 0) extra.push("strangle");
    if (p.litUntil > state.time) extra.push("lit");
    const statusSig = statuses.map((s) => `${s.id}:${s.left >= PERMANENT ? "p" : Math.ceil(s.left / 1000)}`).join(",") + extra.join(",") + (p.stoning > 0 ? Math.ceil(p.stoning / 1000) : "") + (p.strangling > 0 ? Math.ceil(p.strangling / 1000) : "");
    if (statusSig !== this.statusSig) {
      this.statusSig = statusSig;
      clear(this.statusBox);
      for (const s of statuses) {
        const info = STATUS_INFO[s.id];
        const left = s.left >= PERMANENT ? "Does not wear off." : `${Math.ceil(s.left / 1000)} seconds left.`;
        const chip = tip(el("div", "status"), `${info.name}. ${info.help}\n${left}`);
        chip.dataset["status"] = s.id;
        const glyph = el("span", "statusglyph", info.glyph);
        glyph.style.color = info.color;
        chip.append(glyph, el("span", "", info.name));
        this.statusBox.appendChild(chip);
      }
      const special = (name: string, color: string, help: string): void => {
        const chip = tip(el("div", "status danger"), help);
        const glyph = el("span", "statusglyph", "!");
        glyph.style.color = color;
        chip.append(glyph, el("span", "", name));
        this.statusBox.appendChild(chip);
      };
      if (p.stoning > 0) special("Turning to stone", "#c0c0c0", `You will be a statue in ${Math.ceil(p.stoning / 1000)} seconds. Anything that heals stops it: a potion of healing, the healing spell, or prayer at an altar.`);
      if (p.strangling > 0) special("Strangling", "#e04040", `The amulet kills you in ${Math.ceil(p.strangling / 1000)} seconds. Remove it; if it is cursed, lift the curse or pray.`);
      if (p.litUntil > state.time) {
        const chip = tip(el("div", "status"), "A lit field surrounds you: you see further, in every direction.");
        const glyph = el("span", "statusglyph", "*");
        glyph.style.color = "#f0e080";
        chip.append(glyph, el("span", "", "Lit"));
        this.statusBox.appendChild(chip);
      }
    }

    // ---- hands ----
    const main = wornItem(p, "main");
    const off = wornItem(p, "off");
    const handSig = `${main?.uid ?? 0}:${main?.ench ?? 0}:${main?.known ?? 0}:${off?.uid ?? 0}:${off?.ench ?? 0}:${Object.keys(state.discovered).length}`;
    if (handSig !== this.handSig) {
      this.handSig = handSig;
      const paint = (slot: HTMLElement, item: Item | undefined, empty: string): void => {
        this.drawIcon(slot.firstElementChild as HTMLCanvasElement, state, item);
        tip(slot, item ? `${describeItem(state, item)}\nClick to attack.` : empty);
      };
      paint(this.mainHand, main, "Your main hand is empty. Bare fists do 1d2.\nClick to attack.");
      paint(this.offHand, off, "Your off hand is empty. A shield or a second one-handed weapon goes here.");
    }
    const coolOf = (ready: number, total: number): string => (state.time >= ready || total <= 0 ? "0%" : `${Math.min(100, ((ready - state.time) / total) * 100)}%`);
    this.mainCool.style.height = coolOf(p.mainReady, p.mainCooldown);
    this.offCool.style.height = off && itemType(off.type).weapon ? coolOf(p.offReady, p.offCooldown) : "0%";

    // ---- inventory ----
    const picking = state.prompt?.kind === "pick";
    const invSig = p.inventory.map((it) => `${it.uid}.${it.type}.${it.qty}.${it.slot ?? ""}.${it.known ? 1 : 0}${it.bucKnown ? it.buc : "?"}${it.ench}.${it.charges}.${it.letter}`).join("|") + `#${Object.keys(state.discovered).length}#${this.selected}#${picking}`;
    if (invSig !== this.invSig) {
      this.invSig = invSig;
      this.renderInventory(state, picking);
      if (this.selected !== null && !p.inventory.some((it) => it.uid === this.selected)) this.setSelected(null, state);
    }
    this.invHint.textContent = picking ? "press a letter to choose" : this.invMode ? "press a letter" : `${this.keys.label("inventory")}, then a letter`;

    // ---- log ----
    const last = state.log[state.log.length - 1];
    const stamp = last ? last.t * 1000 + state.log.length : 0;
    if (stamp !== this.logStamp) {
      this.logStamp = stamp;
      for (const m of state.log) {
        if (this.logShown.has(m)) continue;
        this.logShown.add(m);
        this.logBox.appendChild(el("div", `msg ${m.kind}`, m.text));
      }
      while (this.logBox.childElementCount > 80) this.logBox.removeChild(this.logBox.firstChild as Node);
      this.logBox.scrollTop = this.logBox.scrollHeight;
    }

    // ---- over the view ----
    if (level) {
      this.depthTag.textContent = `Level ${state.depth} - ${level.name}`;
      this.resetButton.hidden = level.special !== "stoneyard";
    }
    this.compass.textContent = (DIR_NAMES[p.dir] as string).charAt(0).toUpperCase();
    const ahead = facing(state);
    const m = level ? monsterAt(level, ahead.x, ahead.y) : undefined;
    if (m && perceives(state, m)) {
      const type = monsterType(m.type);
      this.target.hidden = false;
      const asleep = m.asleep || m.sleepUntil > state.time;
      this.targetName.textContent = `${capital(type.name)}${m.peaceful ? " (peaceful)" : asleep ? " (asleep)" : m.heldUntil > state.time ? " (held)" : m.fleeUntil > state.time ? " (fleeing)" : ""}`;
      this.target.classList.toggle("peaceful", m.peaceful);
      this.targetBar.style.width = `${Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100))}%`;
    } else {
      this.target.hidden = true;
    }
    let msg = "";
    if (has(state, "blind")) msg = "You are blind.";
    if (has(state, "asleep")) msg = "You are asleep.";
    else if (has(state, "paralyzed")) msg = "You cannot move.";
    else if (p.resting) msg = "Resting. Any key to get up.";
    else if (state.time < p.busyUntil) msg = p.busyText;
    if (this.viewMsg.textContent !== msg) this.viewMsg.textContent = msg;
    this.viewMsg.hidden = msg === "";

    // ---- maps ----
    if (now - this.lastMap > 120) {
      this.lastMap = now;
      const g = this.minimap.getContext("2d");
      if (g) drawMap(g, state, centredView(state, 10, 11, 11, FONT));
      if (this.mapOpen) {
        const bg = this.bigmap.getContext("2d");
        if (bg) drawMap(bg, state, fullView(state, this.bigmap.width, this.bigmap.height, FONT));
      }
    }

    // ---- prompt ----
    const promptSig = state.prompt ? JSON.stringify(state.prompt) : "";
    if (promptSig !== this.promptSig) {
      this.promptSig = promptSig;
      this.renderPrompt(state.prompt);
    }
    if (this.spellsOpen) this.renderSpells(state);
  }

  /** Icons are drawn onto small canvases, tint and all, so nothing ever needs an image's pixels read back. */
  private drawIcon(canvas: HTMLCanvasElement, state: GameState, item: Item | undefined): void {
    const g = canvas.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    if (!item) return;
    g.imageSmoothingEnabled = false;
    const tint = itemTint(state, item);
    const icon = itemType(item.type).icon;
    g.drawImage(tint ? this.store.tinted(icon, tint) : this.store.get(icon), 0, 0, canvas.width, canvas.height);
  }

  private renderInventory(state: GameState, picking: boolean): void {
    const p = state.player;
    clear(this.invBox);
    if (p.inventory.length === 0) {
      this.invBox.appendChild(el("div", "invempty", "Your pack is empty."));
      return;
    }
    const groups = new Map<ItemClass, Item[]>();
    for (const item of p.inventory) {
      const cls = itemType(item.type).cls;
      const list = groups.get(cls) ?? [];
      list.push(item);
      groups.set(cls, list);
    }
    for (const cls of CLASS_ORDER) {
      const items = groups.get(cls);
      if (!items) continue;
      const head = el("div", "invclass");
      head.append(el("span", "sym", CLASS_SYMBOL[cls]), el("span", "", CLASS_NAME[cls]));
      this.invBox.appendChild(head);
      const row = el("div", "invrow");
      for (const item of items) {
        const slot = el("div", "slot");
        slot.dataset["uid"] = String(item.uid);
        slot.dataset["letter"] = item.letter;
        slot.style.backgroundImage = `url(${this.store.url("ui_slot")})`;
        const icon = el("canvas", "sloticon");
        icon.width = 32;
        icon.height = 32;
        this.drawIcon(icon, state, item);
        slot.appendChild(icon);
        if (item.slot) slot.classList.add("worn");
        if (item.bucKnown && item.buc === "C") slot.classList.add("cursed");
        if (item.bucKnown && item.buc === "B") slot.classList.add("blessed");
        if (this.selected === item.uid) slot.classList.add("selected");
        if (picking && !isUnidentified(state, item)) slot.classList.add("dim");
        slot.appendChild(el("span", "letter", item.letter));
        if (item.qty > 1) slot.appendChild(el("span", "qty", String(item.qty)));
        if (item.slot) slot.appendChild(el("span", "wornmark", item.slot === "main" || item.slot === "off" ? "h" : "w"));
        tip(slot, describeItem(state, item));
        slot.addEventListener("click", () => {
          if (state.prompt?.kind === "pick") this.cb.pickItem(item.uid);
          else this.cb.selectItem(this.selected === item.uid ? null : item.uid);
        });
        row.appendChild(slot);
      }
      this.invBox.appendChild(row);
    }
  }

  private renderPrompt(prompt: Prompt | null): void {
    clear(this.modal);
    if (!prompt) {
      this.modal.hidden = true;
      return;
    }
    this.modal.hidden = false;
    this.modal.appendChild(el("div", "modaltitle", prompt.title));
    if (prompt.kind === "pick") {
      this.modal.appendChild(el("div", "modalhint", "Click an item in your pack, or press its letter."));
      this.modal.appendChild(button("[Esc] Never mind", () => this.cb.cancelPrompt(), "btn modalbtn"));
      return;
    }
    prompt.options.forEach((option, i) => {
      const b = button(`[${i + 1}] ${option.label}`, () => this.cb.choose(option.id), "btn modalbtn");
      b.dataset["option"] = option.id;
      if (option.hint) tip(b, option.hint);
      this.modal.appendChild(b);
      if (option.hint) this.modal.appendChild(el("div", "modalhint", option.hint));
    });
  }

  private renderSpells(state: GameState): void {
    const p = state.player;
    const sig = `${p.spells.join(",")}|${p.pw}|${p.xl}`;
    if (this.spellBox.dataset["sig"] === sig) return;
    this.spellBox.dataset["sig"] = sig;
    clear(this.spellBox);
    this.spellBox.appendChild(el("div", "menutitle", "Spells"));
    if (p.spells.length === 0) {
      this.spellBox.appendChild(el("div", "modalhint", "You know no spells. Spellbooks teach them; any role can learn."));
    }
    p.spells.forEach((id, i) => {
      const def = spellDef(id);
      const cost = spellCost(id);
      const b = button(`[${LETTERS[i]}] ${def.name}  ${cost} Pw  fail ${castFailure(state, id)}%`, () => this.cb.cast(id), "btn menuitem");
      b.dataset["spell"] = id;
      if (p.pw < cost) b.classList.add("dim");
      tip(b, `${capital(def.name)}, level ${def.level}. ${def.blurb}\nCosts ${cost} power. Heavy armor, a shield, and low intelligence raise the chance of failure.`);
      this.spellBox.appendChild(b);
    });
    this.spellBox.appendChild(button("[Esc] Close", () => this.cb.act("cast"), "btn menuitem"));
  }

  /** The spell a letter selects in the open list. */
  spellForLetter(state: GameState, letter: string): string | null {
    const i = LETTERS.indexOf(letter);
    return i >= 0 ? (state.player.spells[i] ?? null) : null;
  }
}
