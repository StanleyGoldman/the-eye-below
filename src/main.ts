// Entry point: builds the page, runs the frame loop, and routes input
// to the game. Everything about the rules lives in src/game; this file
// only connects it to a browser.

import fontUrl from "@fontsource/vt323/files/vt323-latin-400-normal.woff2";
import { AssetStore } from "./assets/store.ts";
import { decodeRunCode, randomSeed } from "./core/modifiers.ts";
import type { Mods } from "./core/modifiers.ts";
import { attack, cancelPrompt, cast, choose, interact, itemActions, move, pickItem, pickUp, quickThrow, resetPuzzle, toggleRest, turn, useItem } from "./game/actions.ts";
import type { ItemAction } from "./game/actions.ts";
import { botStep, runBot } from "./game/bot.ts";
import type { BotMode } from "./game/bot.ts";
import { clearSave, hasSave, loadGame, saveGame } from "./game/save.ts";
import { buy, closeShop, sell } from "./game/shops.ts";
import type { StorageLike } from "./game/save.ts";
import { monsterType } from "./game/data/monsters.ts";
import { newGame, placeAt } from "./game/state.ts";
import { DX, DY } from "./game/types.ts";
import type { Dir, GameState, RoleId } from "./game/types.ts";
import { update, updateSeen, walkableNow } from "./game/world.ts";
import { installTooltips } from "./hud/dom.ts";
import { Hud, ITEM_ACTION_KEYS } from "./hud/hud.ts";
import { GAME_TITLE, Screens } from "./hud/screens.ts";
import type { StartOptions } from "./hud/screens.ts";
import css from "./hud/style.css";
import { ACTIONS, KeyMap } from "./input/keys.ts";
import type { ActionId } from "./input/keys.ts";
import { ViewRenderer } from "./render/view.ts";
import type { ViewFx } from "./render/view.ts";

const WIDTH = 960;
const HEIGHT = 540;

function safeStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    s.getItem("eye-below.probe");
    return s;
  } catch {
    return null;
  }
}

class App {
  private readonly root: HTMLElement;
  private readonly storage = safeStorage();
  private readonly store: AssetStore;
  private readonly keys = new KeyMap(this.storage);
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly renderer: ViewRenderer;
  private readonly params = new URLSearchParams(window.location.search);
  private readonly debug: boolean;
  private readonly held = new Set<ActionId>();
  private readonly fx: ViewFx = { now: 0, shakeUntil: 0, flashUntil: 0, flashColor: "#ffffff", fadeUntil: 0, rays: [] };

  private state: GameState | null = null;
  private last: StartOptions | null = null;
  private scale = 1;
  private lastFrame = 0;
  private lastSave = 0;
  private endAt = 0;
  private auto: BotMode | null = null;
  private timeScale = 1;
  private readonly errors: string[] = [];

  constructor(store: AssetStore) {
    this.store = store;
    this.debug = this.params.has("debug");
    const style = document.createElement("style");
    style.textContent = `@font-face{font-family:"VT323";src:url(${fontUrl}) format("woff2");font-display:block;}\n${css}\n.btn{background-image:url(${this.store.url("ui_button")});background-size:100% 100%;}`;
    document.head.appendChild(style);
    document.title = GAME_TITLE;

    this.root = document.createElement("div");
    this.root.id = "app";
    document.body.appendChild(this.root);

    this.hud = new Hud(this.root, this.store, this.keys, {
      act: (a) => this.act(a),
      useItem: (uid, action) => this.useItem(uid, action),
      cast: (id) => this.castSpell(id),
      choose: (id) => this.withState((s) => choose(s, id)),
      pickItem: (uid) => this.withState((s) => pickItem(s, uid)),
      cancelPrompt: () => this.withState((s) => cancelPrompt(s)),
      resetPuzzle: () => this.withState((s) => resetPuzzle(s)),
      selectItem: (uid) => this.hud.setSelected(uid, this.state),
      shopBuy: (uid) => this.withState((s) => void buy(s, uid)),
      shopSell: (uid) => this.withState((s) => void sell(s, uid)),
      shopClose: () => this.withState((s) => closeShop(s)),
    });
    this.renderer = new ViewRenderer(this.hud.view, this.store);
    this.screens = new Screens(
      this.root,
      this.store,
      this.keys,
      {
        continueGame: () => this.continueGame(),
        start: (o) => this.start(o),
        resume: () => this.resume(),
        quitToTitle: () => this.quitToTitle(),
        restart: (same) => this.restart(same),
        hasSave: () => hasSave(this.storage),
      },
      this.debug,
    );
    installTooltips(this.root, () => this.scale);

    window.addEventListener("resize", () => this.fit());
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.onKeyUp(e));
    window.addEventListener("blur", () => this.held.clear());
    window.addEventListener("error", (e) => this.errors.push(String(e.message)));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.held.clear();
        this.save();
      }
    });
    window.addEventListener("beforeunload", () => this.save());
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
    this.fit();

    if (this.debug) this.installDebug();
    if (this.params.has("start")) this.quickStart();
    else this.screens.show("title");

    // Fonts load late on some browsers; the canvas maps need it before they draw text.
    void document.fonts?.load('16px "VT323"');
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- layout ----------------------------------------------------------

  private fit(): void {
    const sx = window.innerWidth / WIDTH;
    const sy = window.innerHeight / HEIGHT;
    let k = Math.min(sx, sy);
    // Whole multiples keep the pixels square where the window allows it.
    if (k >= 1 && k - Math.floor(k) < 0.12) k = Math.floor(k);
    this.scale = Math.max(0.25, k);
    const left = Math.max(0, Math.floor((window.innerWidth - WIDTH * this.scale) / 2));
    const top = Math.max(0, Math.floor((window.innerHeight - HEIGHT * this.scale) / 2));
    this.root.style.transform = `translate(${left}px, ${top}px) scale(${this.scale})`;
  }

  // ---- starting and ending runs ---------------------------------------

  private start(options: StartOptions, startDepth = 1): void {
    this.last = { ...options, overrides: { ...options.overrides } };
    this.state = newGame({ seed: options.seed, overrides: options.overrides, role: options.role, name: options.name, god: options.god, startDepth });
    this.enterGame();
    this.save();
  }

  private enterGame(): void {
    this.hud.reset();
    this.screens.hide();
    this.held.clear();
    this.endAt = 0;
    this.auto = null;
    this.fx.rays = [];
    this.fx.fadeUntil = performance.now() + 300;
  }

  private continueGame(): void {
    const saved = loadGame(this.storage);
    if (!saved) {
      this.screens.show("title");
      return;
    }
    this.state = saved;
    this.last = { seed: saved.run.seed, overrides: { ...saved.overrides }, role: saved.player.role, name: saved.player.name, god: saved.debug.god };
    this.enterGame();
  }

  private resume(): void {
    this.screens.hide();
    this.held.clear();
  }

  private quitToTitle(): void {
    if (this.state && !this.state.dead && !this.state.won) this.save();
    this.state = null;
    this.screens.show("title");
  }

  private restart(sameSeed: boolean): void {
    const prev = this.last;
    const role: RoleId = prev?.role ?? "valkyrie";
    if (sameSeed && prev) {
      this.start({ ...prev, overrides: { ...prev.overrides } });
      return;
    }
    this.screens.preset({ seed: randomSeed(Date.now()), overrides: {}, role, name: prev?.name ?? "", god: prev?.god ?? false });
    this.state = null;
    this.screens.show("newgame");
  }

  private save(): void {
    if (!this.state || this.state.dead || this.state.won) return;
    saveGame(this.storage, this.state);
    this.lastSave = performance.now();
  }

  private quickStart(): void {
    let seed = this.params.get("seed") ?? "candle";
    let overrides: Mods = {};
    const code = this.params.get("code");
    if (code) {
      const parsed = decodeRunCode(code);
      if (parsed) {
        seed = parsed.seed;
        overrides = parsed.overrides;
      }
    }
    const roleParam = this.params.get("role");
    const role: RoleId = roleParam === "wizard" || roleParam === "rogue" ? roleParam : "valkyrie";
    const level = Number(this.params.get("level") ?? 1);
    const options: StartOptions = { seed, overrides, role, name: "", god: this.debug && this.params.has("god") };
    this.screens.preset(options);
    this.start(options, Number.isInteger(level) ? level : 1);
  }

  // ---- actions ---------------------------------------------------------

  private withState(fn: (s: GameState) => void): void {
    if (this.state && !this.state.dead && !this.state.won) fn(this.state);
  }

  private inGame(): boolean {
    return this.state !== null && this.screens.current() === null;
  }

  private useItem(uid: number, action: ItemAction): void {
    this.hud.setSelected(null, this.state);
    this.hud.setInventoryMode(false);
    this.withState((s) => useItem(s, uid, action));
  }

  private castSpell(id: string): void {
    this.hud.setSpellsOpen(false, this.state);
    this.withState((s) => cast(s, id));
  }

  /** One named action, from a key or an on-screen button. */
  private act(action: ActionId): void {
    const state = this.state;
    if (!state || !this.inGame()) return;
    if (action === "pause") {
      if (this.closePanels()) return;
      if (state.dead || state.won) return;
      this.save();
      this.screens.showPause(state);
      return;
    }
    if (state.dead || state.won) return;
    if (action === "map") {
      this.hud.setMapOpen(!this.hud.isMapOpen());
      return;
    }
    if (state.prompt) return;
    if (state.player.resting && action !== "rest") {
      toggleRest(state);
      return;
    }
    switch (action) {
      case "forward":
        move(state, "forward");
        break;
      case "back":
        move(state, "back");
        break;
      case "strafeLeft":
        move(state, "left");
        break;
      case "strafeRight":
        move(state, "right");
        break;
      case "turnLeft":
        turn(state, "left");
        break;
      case "turnRight":
        turn(state, "right");
        break;
      case "attack":
        attack(state);
        break;
      case "interact":
        interact(state);
        break;
      case "pickup":
        pickUp(state);
        break;
      case "throw":
        quickThrow(state);
        break;
      case "rest":
        toggleRest(state);
        break;
      case "cast":
        this.hud.setSelected(null, state);
        this.hud.setInventoryMode(false);
        this.hud.setSpellsOpen(!this.hud.isSpellsOpen(), state);
        break;
      case "inventory":
        this.hud.setSpellsOpen(false, state);
        this.hud.setSelected(null, state);
        this.hud.setInventoryMode(!this.hud.isInventoryMode());
        break;
    }
  }

  /** Close whichever panel is open. Returns true if something closed. */
  private closePanels(): boolean {
    const state = this.state;
    if (state?.prompt) {
      if (state.prompt.kind === "shop") {
        closeShop(state);
      } else if (state.prompt.kind === "menu") {
        const way = state.prompt.options.find((o) => o.id === "leave" || o.id === "no" || o.id === "cancel");
        choose(state, way ? way.id : "leave");
      } else {
        cancelPrompt(state);
      }
      return true;
    }
    if (this.hud.selectedItem() !== null) {
      this.hud.setSelected(null, state);
      return true;
    }
    if (this.hud.isInventoryMode()) {
      this.hud.setInventoryMode(false);
      return true;
    }
    if (this.hud.isSpellsOpen()) {
      this.hud.setSpellsOpen(false, state);
      return true;
    }
    if (this.hud.isMapOpen()) {
      this.hud.setMapOpen(false);
      return true;
    }
    return false;
  }

  // ---- keyboard --------------------------------------------------------

  private onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
    if (this.screens.current() !== null) {
      if (typing && e.code !== "Escape") return;
      if (this.screens.handleKey(e) && (e.code === "Escape" || e.code === "Space")) e.preventDefault();
      return;
    }
    const state = this.state;
    if (!state || typing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const action = this.keys.actionFor(e.code);
    if (action || e.code === "Space" || e.code.startsWith("Arrow") || e.code === "Tab") e.preventDefault();
    if (e.repeat && (!action || !ACTIONS.find((a) => a.id === action)?.held)) return;

    if (e.code === "Escape" || action === "pause") {
      this.act("pause");
      return;
    }
    if (state.dead || state.won) return;

    // A question is open: numbers answer a menu, letters pick an item.
    if (state.prompt) {
      if (state.prompt.kind === "shop") return;
      if (state.prompt.kind === "menu") {
        const n = Number(e.key);
        const option = Number.isInteger(n) && n >= 1 ? state.prompt.options[n - 1] : undefined;
        if (option) choose(state, option.id);
      } else if (e.key.length === 1) {
        const item = state.player.inventory.find((it) => it.letter === e.key);
        if (item) pickItem(state, item.uid);
      }
      return;
    }
    // An item's action menu is open.
    const selected = this.hud.selectedItem();
    if (selected !== null) {
      const item = state.player.inventory.find((it) => it.uid === selected);
      const choice = item ? itemActions(state, item).find((a) => ITEM_ACTION_KEYS[a.id] === e.key) : undefined;
      if (item && choice) this.useItem(item.uid, choice.id);
      else if (e.key.length === 1) this.hud.setSelected(null, state);
      return;
    }
    // Waiting for an item letter.
    if (this.hud.isInventoryMode()) {
      if (e.key.length === 1) {
        const item = state.player.inventory.find((it) => it.letter === e.key);
        this.hud.setInventoryMode(false);
        if (item) this.hud.setSelected(item.uid, state);
      } else if (action === "inventory") {
        this.hud.setInventoryMode(false);
      }
      return;
    }
    // The spell list is open.
    if (this.hud.isSpellsOpen()) {
      const spell = e.key.length === 1 ? this.hud.spellForLetter(state, e.key) : null;
      if (spell) this.castSpell(spell);
      else this.hud.setSpellsOpen(false, state);
      return;
    }
    if (!action) return;
    const def = ACTIONS.find((a) => a.id === action);
    if (def?.held) {
      if (!this.held.has(action)) {
        this.held.add(action);
        this.act(action);
      }
      return;
    }
    this.act(action);
  }

  private onKeyUp(e: KeyboardEvent): void {
    const action = this.keys.actionFor(e.code);
    if (action) this.held.delete(action);
  }

  // ---- the frame loop --------------------------------------------------

  private drainEvents(state: GameState, now: number): void {
    for (const ev of state.events) {
      switch (ev.kind) {
        case "locked":
          this.fx.shakeUntil = now + 220;
          break;
        case "hit":
          this.hud.float(`-${ev.amount}`, "hit");
          break;
        case "miss":
          this.hud.float("miss", "miss");
          break;
        case "hurt":
          this.hud.float(`-${ev.amount}`, "hurt");
          break;
        case "bump":
          this.fx.shakeUntil = Math.max(this.fx.shakeUntil, now + 90);
          break;
        case "ray":
          this.fx.rays.push({ cells: ev.cells, color: ev.color, until: now + 280 });
          break;
        case "flash":
          this.fx.flashColor = ev.color;
          this.fx.flashUntil = now + 260;
          break;
        case "levelup":
          this.fx.flashColor = "#e0b040";
          this.fx.flashUntil = now + 320;
          break;
        case "descend":
          this.fx.fadeUntil = now + 320;
          this.save();
          break;
        default:
          break;
      }
    }
    state.events.length = 0;
    if (this.fx.rays.length > 0) this.fx.rays = this.fx.rays.filter((r) => r.until > now);
  }

  private frame(now: number): void {
    const dt = Math.min(100, now - this.lastFrame);
    this.lastFrame = now;
    this.fx.now = now;
    const state = this.state;
    try {
      if (state) {
        const running = this.screens.current() === null && !state.dead && !state.won;
        if (running) {
          if (!state.prompt) {
            if (this.auto) botStep(state, this.auto);
            else for (const action of this.held) this.act(action);
          }
          update(state, dt * this.timeScale);
          if (now - this.lastSave > 15000) this.save();
        }
        this.drainEvents(state, now);
        this.renderer.render(state, this.fx);
        this.hud.refresh(state, now);
        if ((state.dead || state.won) && this.screens.current() === null) {
          if (this.endAt === 0) {
            this.endAt = now + (this.auto || this.timeScale > 1 ? 50 : 1100);
            clearSave(this.storage);
            this.closePanels();
            this.hud.setMapOpen(false);
          } else if (now >= this.endAt) {
            this.screens.show(state.won ? "won" : "dead", state);
          }
        }
      }
    } catch (err) {
      this.errors.push(err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err));
      console.error(err);
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---- debugging and the scripted checks ------------------------------

  private installDebug(): void {
    const api = {
      info: (): Record<string, unknown> => {
        const s = this.state;
        const level = s ? s.levels[s.depth] : undefined;
        return {
          screen: this.screens.current() ?? (s ? "game" : "none"),
          mapOpen: this.hud.isMapOpen(),
          spellsOpen: this.hud.isSpellsOpen(),
          inventoryMode: this.hud.isInventoryMode(),
          selected: this.hud.selectedItem(),
          depth: s?.depth ?? 0,
          levelName: level?.name ?? "",
          special: level?.special ?? "",
          x: s?.player.x ?? 0,
          y: s?.player.y ?? 0,
          dir: s?.player.dir ?? 0,
          hp: s?.player.hp ?? 0,
          maxHp: s?.player.maxHp ?? 0,
          xl: s?.player.xl ?? 0,
          dead: s?.dead ?? false,
          won: s?.won ?? false,
          cause: s?.cause ?? "",
          steps: s?.stats.steps ?? 0,
          kills: s?.player.kills ?? 0,
          time: s?.time ?? 0,
          doorsOpened: s?.stats.doors ?? 0,
          monsters: level ? level.monsters.length : 0,
          inventory: s?.player.inventory.length ?? 0,
          prompt: s?.prompt ? (s.prompt.kind === "menu" ? s.prompt.context : s.prompt.kind) : "",
          gold: s?.player.gold ?? 0,
          protection: s?.player.protection ?? 0,
          shop: level?.meta.shop ?? "",
          seed: s?.run.seed ?? "",
          god: s?.debug.god ?? false,
          log: s ? s.log.slice(-5).map((m) => m.text) : [],
          errors: this.errors.slice(),
        };
      },
      /** Run the bot synchronously for a span of game time. */
      runBot: (mode: BotMode, gameMs: number): unknown => (this.state ? runBot(this.state, mode, gameMs) : null),
      /** Let the bot play inside the normal frame loop, or stop it with null. */
      auto: (mode: BotMode | null): void => {
        this.auto = mode;
      },
      speed: (n: number): void => {
        this.timeScale = Math.max(0.1, Math.min(50, n));
      },
      state: (): GameState | null => this.state,
      assets: (): { expected: number; loaded: number; failed: string[] } => this.store.report(),
      /** Stand the player a few cells from the level's main attraction, facing it. For screenshots. */
      gold: (amount: number): void => {
        if (this.state) this.state.player.gold = amount;
      },
      vantage: (only?: number, type?: string): boolean => {
        const s = this.state;
        const level = s ? s.levels[s.depth] : undefined;
        if (!s || !level) return false;
        const targets: { x: number; y: number }[] = [];
        if (type) {
          for (const m of level.monsters) if (m.type === type || m.npc?.kind === type) targets.push(m);
          if (targets.length === 0) return false;
        }
        if (!type) {
          for (const m of level.monsters) if (monsterType(m.type).boss || m.peaceful) targets.push(m);
          for (const f of level.features) if (f.kind === "boulder") targets.push(f);
          for (const g of level.gates) if (g.kind === "drawbridge") targets.push(...g.cells);
          for (const f of level.features) if (f.kind === "fountain") targets.push(f);
          for (const m of level.monsters) targets.push(m);
        }
        const start = new Set(level.startArea);
        // First try to stand somewhere the player could have walked to unaided; failing that, anywhere.
        for (const strict of [true, false])
        for (const target of targets) {
          for (const dist of only ? [only] : [2, 3, 1]) {
            for (let d = 0; d < 4; d++) {
              let clear = true;
              const sx = target.x - (DX[d] as number) * dist;
              const sy = target.y - (DY[d] as number) * dist;
              if (strict && !start.has(sy * level.w + sx)) continue;
              for (let k = 1; k <= dist && clear; k++) {
                const x = target.x - (DX[d] as number) * k;
                const y = target.y - (DY[d] as number) * k;
                if (!walkableNow(level, x, y) || level.monsters.some((m) => m.x === x && m.y === y)) clear = false;
              }
              if (!clear) continue;
              placeAt(s, target.x - (DX[d] as number) * dist, target.y - (DY[d] as number) * dist);
              s.player.dir = d as Dir;
              s.player.pdir = s.player.dir;
              updateSeen(s);
              return true;
            }
          }
        }
        return false;
      },
    };
    (window as unknown as { __eye: typeof api }).__eye = api;
  }
}

async function boot(): Promise<void> {
  const store = new AssetStore();
  // "noassets" plays on code-drawn art alone, which is also what happens when files are missing.
  if (!new URLSearchParams(window.location.search).has("noassets")) await store.loadFiles();
  new App(store);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void boot());
else void boot();
