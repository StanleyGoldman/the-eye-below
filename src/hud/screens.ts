// Everything that is not the dungeon itself: title, new game, pause,
// settings, the tombstone, and the victory screen.

import type { AssetStore } from "../assets/store.ts";
import { MODIFIERS, MOD_MAX, MOD_MIN, cleanOverrides, decodeRunCode, difficulty, encodeRunCode, randomSeed, resolveMods, seedMods } from "../core/modifiers.ts";
import type { Mods } from "../core/modifiers.ts";
import { ROLES, roleDef } from "../game/data/roles.ts";
import { score } from "../game/state.ts";
import type { GameState, RoleId } from "../game/types.ts";
import { ACTIONS, keyName } from "../input/keys.ts";
import type { ActionId, KeyMap } from "../input/keys.ts";
import { button, clear, el, tip } from "./dom.ts";

export const GAME_TITLE = "The Eye Below";
export const GAME_VERSION = "1.0";

export type ScreenName = "title" | "newgame" | "pause" | "settings" | "dead" | "won";

export interface StartOptions {
  seed: string;
  overrides: Mods;
  role: RoleId;
  name: string;
  god: boolean;
}

export interface SoundControls {
  music(): number;
  effects(): number;
  muted(): boolean;
  setMusic(v: number): void;
  setEffects(v: number): void;
  toggleMute(): void;
}

export interface ScreenCallbacks {
  sound: SoundControls;
  continueGame(): void;
  start(options: StartOptions): void;
  resume(): void;
  quitToTitle(): void;
  restart(sameSeed: boolean): void;
  hasSave(): boolean;
}

export class Screens {
  private readonly root: HTMLElement;
  private readonly store: AssetStore;
  private readonly keys: KeyMap;
  private readonly cb: ScreenCallbacks;
  private readonly debug: boolean;
  private name: ScreenName | null = null;
  private settingsReturn: ScreenName = "title";

  // New-game form state.
  private seed = "";
  private overrides: Mods = {};
  private role: RoleId = "valkyrie";
  private heroName = "";
  private god = false;
  private codeError = "";

  // Rebinding in progress.
  private listening: { action: ActionId; slot: 0 | 1 } | null = null;

  constructor(parent: HTMLElement, store: AssetStore, keys: KeyMap, cb: ScreenCallbacks, debug: boolean) {
    this.store = store;
    this.keys = keys;
    this.cb = cb;
    this.debug = debug;
    this.root = el("div", "screens");
    this.root.hidden = true;
    parent.appendChild(this.root);
    this.seed = randomSeed(Date.now());
  }

  current(): ScreenName | null {
    return this.name;
  }

  hide(): void {
    this.name = null;
    this.listening = null;
    this.root.hidden = true;
    clear(this.root);
  }

  /** Set the new-game form, as if typed in. Used for restarts and quick starts. */
  preset(options: Partial<StartOptions>): void {
    if (options.seed !== undefined) this.seed = options.seed;
    if (options.overrides !== undefined) this.overrides = { ...options.overrides };
    if (options.role !== undefined) this.role = options.role;
    if (options.name !== undefined) this.heroName = options.name;
    if (options.god !== undefined) this.god = options.god;
  }

  show(name: ScreenName, state: GameState | null = null): void {
    this.name = name;
    if (name !== "settings") this.listening = null;
    this.root.hidden = false;
    this.root.className = `screens screen-${name}`;
    clear(this.root);
    if (name === "title") this.title();
    else if (name === "newgame") this.newGame();
    else if (name === "pause" && state) this.pause(state);
    else if (name === "settings") this.settings();
    else if ((name === "dead" || name === "won") && state) this.ending(state, name === "won");
  }

  // ---- title -----------------------------------------------------------

  private title(): void {
    const page = el("div", "page titlepage");
    page.style.backgroundImage = `url(${this.store.url("title_bg")})`;
    page.appendChild(el("h1", "gametitle", GAME_TITLE));
    page.appendChild(el("div", "tagline", "Twenty-five levels down, something has not blinked since it was made."));
    const menu = el("div", "menu");
    if (this.cb.hasSave()) {
      const b = button("Continue", () => this.cb.continueGame(), "btn big");
      b.dataset["act"] = "continue";
      menu.appendChild(tip(b, "Pick up the saved run where it stopped."));
    }
    const fresh = button("New game", () => this.show("newgame"), "btn big");
    fresh.dataset["act"] = "new";
    menu.appendChild(fresh);
    const set = button("Settings", () => this.openSettings("title"), "btn big");
    set.dataset["act"] = "settings";
    menu.appendChild(set);
    page.appendChild(menu);
    page.appendChild(el("div", "footnote", `Version ${GAME_VERSION}. Runs from this file; nothing is sent anywhere.`));
    this.root.appendChild(page);
  }

  // ---- new game --------------------------------------------------------

  private newGame(): void {
    const page = el("div", "page newpage");
    page.appendChild(el("h2", "", "New game"));
    const cols = el("div", "cols");
    const left = el("div", "col");
    const right = el("div", "col wide");

    // Seed.
    const seedRow = el("div", "row");
    seedRow.appendChild(tip(el("label", "", "Seed"), "The seed decides the whole dungeon. The same seed and modifiers always give the same game."));
    const seedInput = el("input", "text");
    seedInput.type = "text";
    seedInput.value = this.seed;
    seedInput.maxLength = 40;
    seedInput.dataset["field"] = "seed";
    seedInput.addEventListener("input", () => {
      this.seed = seedInput.value;
      this.overrides = cleanOverrides(this.seed, this.overrides);
      this.codeError = "";
      refresh();
    });
    seedRow.appendChild(seedInput);
    const dice = button("Randomize", () => {
      this.seed = randomSeed(Date.now() + Math.floor(Math.random() * 1e9));
      this.overrides = {};
      seedInput.value = this.seed;
      this.codeError = "";
      refresh();
    });
    dice.dataset["act"] = "randomize";
    seedRow.appendChild(dice);
    left.appendChild(seedRow);

    // Run code.
    const codeRow = el("div", "row");
    codeRow.appendChild(tip(el("label", "", "Run code"), "Seed and overrides in one short code. Paste someone else's code here to play their exact run."));
    const codeInput = el("input", "text");
    codeInput.type = "text";
    codeInput.dataset["field"] = "code";
    codeInput.addEventListener("change", () => applyCode());
    codeInput.addEventListener("keydown", (e) => {
      if (e.code === "Enter") applyCode();
    });
    codeRow.appendChild(codeInput);
    const apply = button("Use code", () => applyCode());
    apply.dataset["act"] = "applycode";
    codeRow.appendChild(apply);
    left.appendChild(codeRow);
    const codeNote = el("div", "note");
    left.appendChild(codeNote);
    const applyCode = (): void => {
      const parsed = decodeRunCode(codeInput.value);
      if (!parsed) {
        this.codeError = "That is not a run code.";
      } else {
        this.seed = parsed.seed;
        this.overrides = parsed.overrides;
        seedInput.value = this.seed;
        this.codeError = "";
      }
      refresh(true);
    };

    // Name and role.
    const nameRow = el("div", "row");
    nameRow.appendChild(el("label", "", "Name"));
    const nameInput = el("input", "text");
    nameInput.type = "text";
    nameInput.maxLength = 16;
    nameInput.placeholder = "(left empty, the role supplies one)";
    nameInput.value = this.heroName;
    nameInput.dataset["field"] = "name";
    nameInput.addEventListener("input", () => {
      this.heroName = nameInput.value;
    });
    nameRow.appendChild(nameInput);
    left.appendChild(nameRow);

    const roles = el("div", "roles");
    const roleCards: HTMLElement[] = [];
    for (const role of ROLES) {
      const card = el("div", "rolecard");
      card.dataset["role"] = role.id;
      const pic = el("div", "portrait");
      pic.style.backgroundImage = `url(${this.store.url(role.portrait)})`;
      const text = el("div", "roletext");
      text.append(el("div", "rolename", role.name), el("div", "roleblurb", role.blurb));
      card.append(pic, text);
      card.addEventListener("click", () => {
        this.role = role.id;
        refresh();
      });
      roleCards.push(card);
      roles.appendChild(card);
    }
    left.appendChild(roles);

    if (this.debug) {
      const godRow = el("label", "row check");
      const box = el("input");
      box.type = "checkbox";
      box.checked = this.god;
      box.dataset["field"] = "god";
      box.addEventListener("change", () => {
        this.god = box.checked;
      });
      godRow.append(box, el("span", "", "Debug: cannot die or be drained (for the scripted checks)"));
      left.appendChild(godRow);
    }

    // Modifiers.
    right.appendChild(tip(el("div", "modhead", "Modifiers"), "Each seed sets these. Change any of them to bend the run; changed ones are marked and can be reset."));
    const modList = el("div", "modlist");
    const rows: { id: string; slider: HTMLInputElement; value: HTMLElement; mark: HTMLElement; reset: HTMLButtonElement }[] = [];
    for (const def of MODIFIERS) {
      const row = el("div", "modrow");
      row.dataset["mod"] = def.id;
      row.appendChild(tip(el("div", "modname", def.name), `${def.help}\n1 is ${def.low}, 9 is ${def.high}.`));
      const slider = el("input", "slider");
      slider.type = "range";
      slider.min = String(MOD_MIN);
      slider.max = String(MOD_MAX);
      slider.step = "1";
      slider.addEventListener("input", () => {
        this.overrides = cleanOverrides(this.seed, { ...this.overrides, [def.id]: Number(slider.value) });
        refresh();
      });
      const value = el("div", "modvalue");
      const mark = tip(el("div", "modmark"), "Changed from the seed's own value.");
      const reset = button("reset", () => {
        delete this.overrides[def.id];
        refresh();
      }, "btn tiny");
      tip(reset, "Back to the value this seed gives.");
      row.append(slider, value, mark, reset);
      rows.push({ id: def.id, slider, value, mark, reset });
      modList.appendChild(row);
    }
    right.appendChild(modList);

    const summary = el("div", "summary");
    const diff = tip(el("div", "difficulty"), "An overall rating worked out from the modifiers as they now stand.");
    const diffBar = el("div", "diffbar");
    const diffFill = el("div", "difffill");
    diffBar.appendChild(diffFill);
    const diffText = el("div", "difftext");
    diff.append(diffText, diffBar);
    const codeShow = tip(el("div", "codeshow"), "This code holds the seed and every change you made. Share it to share the run.");
    summary.append(diff, codeShow);
    right.appendChild(summary);

    cols.append(left, right);
    page.appendChild(cols);

    const foot = el("div", "menu rowmenu");
    const go = button("Descend", () => {
      const seed = this.seed.trim() || randomSeed(Date.now());
      this.seed = seed;
      this.cb.start({ seed, overrides: cleanOverrides(seed, this.overrides), role: this.role, name: this.heroName, god: this.god });
    }, "btn big");
    go.dataset["act"] = "begin";
    const back = button("Back", () => this.show("title"), "btn big");
    back.dataset["act"] = "back";
    foot.append(go, back);
    page.appendChild(foot);
    this.root.appendChild(page);

    const refresh = (keepCode = false): void => {
      const base = seedMods(this.seed);
      const mods = resolveMods(this.seed, this.overrides);
      for (const r of rows) {
        const def = MODIFIERS.find((m) => m.id === r.id)!;
        const v = mods[r.id] as number;
        const changed = this.overrides[r.id] !== undefined;
        r.slider.value = String(v);
        r.value.textContent = `${v}  ${v <= 3 ? def.low : v >= 7 ? def.high : "normal"}`;
        r.mark.textContent = changed ? `was ${base[r.id]}` : "";
        r.reset.style.visibility = changed ? "visible" : "hidden";
        r.slider.parentElement?.classList.toggle("changed", changed);
      }
      const d = difficulty(mods);
      diffText.textContent = `Difficulty: ${d.label} (${d.score} of 100)`;
      diffFill.style.width = `${d.score}%`;
      const code = encodeRunCode(this.seed || "x", this.overrides);
      codeShow.textContent = `Run code: ${this.seed ? code : "(enter a seed)"}`;
      codeShow.dataset["code"] = code;
      if (!keepCode && document.activeElement !== codeInput) codeInput.value = "";
      codeNote.textContent = this.codeError;
      roleCards.forEach((card) => card.classList.toggle("chosen", card.dataset["role"] === this.role));
    };
    refresh();
  }

  // ---- pause and settings ---------------------------------------------

  private pause(state: GameState): void {
    const page = el("div", "page pausepage");
    page.appendChild(el("h2", "", "Paused"));
    const info = el("div", "runinfo");
    const code = encodeRunCode(state.run.seed, state.overrides);
    const line = (label: string, value: string, id: string): void => {
      const row = el("div", "inforow");
      const v = el("span", "infovalue", value);
      v.dataset["info"] = id;
      row.append(el("span", "infolabel", label), v);
      info.appendChild(row);
    };
    line("Seed", state.run.seed, "seed");
    line("Run code", code, "code");
    line("Difficulty", `${difficulty(state.run.mods).label} (${difficulty(state.run.mods).score} of 100)`, "difficulty");
    const changed = Object.keys(state.overrides).length;
    line("Modifiers changed", changed === 0 ? "none" : MODIFIERS.filter((m) => state.overrides[m.id] !== undefined).map((m) => `${m.name} ${state.overrides[m.id]}`).join(", "), "mods");
    page.appendChild(info);
    const menu = el("div", "menu");
    const resume = button("Resume", () => this.cb.resume(), "btn big");
    resume.dataset["act"] = "resume";
    const set = button("Settings and controls", () => this.openSettings("pause"), "btn big");
    set.dataset["act"] = "settings";
    const quit = button("Save and quit to title", () => this.cb.quitToTitle(), "btn big");
    quit.dataset["act"] = "quit";
    menu.append(resume, set, quit);
    page.appendChild(menu);
    page.appendChild(el("div", "footnote", "The game saves itself as you go, and when you leave."));
    this.root.appendChild(page);
  }

  private pausedState: GameState | null = null;

  /** Remember the state so settings can return to the pause menu. */
  showPause(state: GameState): void {
    this.pausedState = state;
    this.show("pause", state);
  }

  private openSettings(from: ScreenName): void {
    this.settingsReturn = from;
    this.listening = null;
    this.show("settings");
  }

  private settings(): void {
    const page = el("div", "page settingspage");
    page.appendChild(el("h2", "", "Settings and controls"));
    page.appendChild(el("div", "note", "Click a key to change it, then press the new key. Esc cancels; Backspace clears. With a list open, letters pick an item or spell."));
    const sound = el("div", "soundrow");
    const slider = (label: string, help: string, id: string, value: number, set: (v: number) => void): void => {
      const wrap = el("label", "soundctl");
      wrap.appendChild(tip(el("span", "", label), help));
      const input = el("input", "slider");
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.step = "5";
      input.value = String(Math.round(value * 100));
      input.dataset["field"] = id;
      const shown = el("span", "soundvalue", `${Math.round(value * 100)}`);
      input.addEventListener("input", () => {
        set(Number(input.value) / 100);
        shown.textContent = input.value;
      });
      wrap.append(input, shown);
      sound.appendChild(wrap);
    };
    slider("Music", "How loud the music is.", "music", this.cb.sound.music(), (v) => this.cb.sound.setMusic(v));
    slider("Effects", "How loud footsteps, blows, doors, and the rest are.", "effects", this.cb.sound.effects(), (v) => this.cb.sound.setEffects(v));
    const mute = el("label", "soundctl");
    const box = el("input");
    box.type = "checkbox";
    box.checked = this.cb.sound.muted();
    box.dataset["field"] = "muted";
    box.addEventListener("change", () => {
      if (box.checked !== this.cb.sound.muted()) this.cb.sound.toggleMute();
    });
    mute.append(box, tip(el("span", "", "Mute everything"), "The mute key does the same in play."));
    sound.appendChild(mute);
    page.appendChild(sound);
    const table = el("div", "keytable");
    for (const action of ACTIONS) {
      const row = el("div", "keyrow");
      row.appendChild(tip(el("div", "keylabel", action.label), action.help));
      for (const slot of [0, 1] as const) {
        const code = this.keys.bindings[action.id][slot];
        const waiting = this.listening?.action === action.id && this.listening.slot === slot;
        const b = button(waiting ? "press a key" : keyName(code), () => {
          this.listening = { action: action.id, slot };
          this.show("settings");
        }, `btn key${waiting ? " listening" : ""}`);
        b.dataset["bind"] = `${action.id}:${slot}`;
        row.appendChild(b);
      }
      table.appendChild(row);
    }
    page.appendChild(table);
    const menu = el("div", "menu rowmenu");
    const reset = button("Restore defaults", () => {
      this.keys.reset();
      this.listening = null;
      this.show("settings");
    }, "btn big");
    reset.dataset["act"] = "defaults";
    const back = button("Back", () => this.closeSettings(), "btn big");
    back.dataset["act"] = "back";
    menu.append(reset, back);
    page.appendChild(menu);
    this.root.appendChild(page);
  }

  private closeSettings(): void {
    if (this.settingsReturn === "pause" && this.pausedState) this.show("pause", this.pausedState);
    else this.show("title");
  }

  /** Give the screens first refusal on a key press. Returns true if it was used. */
  handleKey(e: KeyboardEvent): boolean {
    if (this.name === "settings") {
      if (this.listening) {
        const { action, slot } = this.listening;
        this.listening = null;
        if (e.code === "Backspace") this.keys.rebind(action, slot, "");
        else if (e.code !== "Escape") this.keys.rebind(action, slot, e.code);
        this.show("settings");
        return true;
      }
      if (e.code === "Escape") {
        this.closeSettings();
        return true;
      }
    }
    if (this.name === "pause" && e.code === "Escape") {
      this.cb.resume();
      return true;
    }
    if (this.name === "newgame" && e.code === "Escape") {
      this.show("title");
      return true;
    }
    return this.name !== null;
  }

  // ---- endings ---------------------------------------------------------

  private ending(state: GameState, won: boolean): void {
    const p = state.player;
    const role = roleDef(p.role);
    const result = score(state);
    const code = encodeRunCode(state.run.seed, state.overrides);
    const page = el("div", `page endpage ${won ? "wonpage" : "deadpage"}`);
    if (won) {
      page.appendChild(el("h1", "gametitle", "The Eye is yours"));
      const text = el("div", "endtext");
      text.append(
        el("p", "", `${p.name} the ${role.name} carried the Unblinking Eye out of the Cinderdeep, at experience level ${p.xl}, after ${p.kills} kills.`),
        el("p", "", "The Guild of Honest Recovery paid in full and asked no questions. The Eye is in a drawer now. It is still open."),
      );
      page.appendChild(text);
    } else {
      const stone = el("div", "tombstone");
      stone.append(
        el("div", "rip", "REST IN PEACE"),
        el("div", "tombname", p.name),
        el("div", "tombrole", `the ${role.name}`),
        el("div", "tombcause", state.cause || "died of unknown causes"),
        el("div", "tombwhere", `on level ${state.depth} of the Cinderdeep`),
        el("div", "tombgold", `${p.gold} gold`),
      );
      stone.dataset["cause"] = state.cause;
      page.appendChild(stone);
    }
    const tally = el("div", "tally");
    for (const line of result.lines) {
      const row = el("div", "tallyrow");
      row.append(el("span", "", line.label), el("span", "", String(line.points)));
      tally.appendChild(row);
    }
    const total = el("div", "tallyrow total");
    const totalValue = el("span", "", String(result.total));
    totalValue.dataset["info"] = "score";
    total.append(el("span", "", "Score"), totalValue);
    tally.appendChild(total);
    page.appendChild(tally);
    const run = el("div", "runinfo");
    const seedRow = el("div", "inforow");
    seedRow.append(el("span", "infolabel", "Seed"), el("span", "infovalue", state.run.seed));
    const codeRow = el("div", "inforow");
    const codeValue = el("span", "infovalue", code);
    codeValue.dataset["info"] = "code";
    codeRow.append(tip(el("span", "infolabel", "Run code"), "Enter this on the new-game screen to play the same dungeon again."), codeValue);
    run.append(seedRow, codeRow);
    page.appendChild(run);
    const menu = el("div", "menu rowmenu");
    const again = button("Again, same seed", () => this.cb.restart(true), "btn big");
    again.dataset["act"] = "again";
    const fresh = button("New seed", () => this.cb.restart(false), "btn big");
    fresh.dataset["act"] = "newseed";
    const title = button("Title", () => this.cb.quitToTitle(), "btn big");
    title.dataset["act"] = "title";
    menu.append(again, fresh, title);
    page.appendChild(menu);
    this.root.appendChild(page);
  }
}
