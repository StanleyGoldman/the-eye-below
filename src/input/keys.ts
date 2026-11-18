// Key bindings: defaults, rebinding, and storage. Bindings use physical
// key codes so they survive keyboard layouts.

export type ActionId = "forward" | "back" | "strafeLeft" | "strafeRight" | "turnLeft" | "turnRight" | "attack" | "interact" | "pickup" | "throw" | "rest" | "cast" | "inventory" | "map" | "mute" | "pause";

export interface ActionDef {
  id: ActionId;
  label: string;
  help: string;
  defaults: [string, string];
  /** Repeats while the key is held. */
  held: boolean;
}

export const ACTIONS: readonly ActionDef[] = [
  { id: "forward", label: "Step forward", help: "Walk one cell ahead. Walking into a door opens it; into a monster, attacks it.", defaults: ["KeyW", "ArrowUp"], held: true },
  { id: "back", label: "Step back", help: "Walk one cell backward without turning.", defaults: ["KeyS", "ArrowDown"], held: true },
  { id: "strafeLeft", label: "Sidestep left", help: "Walk one cell to the left without turning.", defaults: ["KeyA", ""], held: true },
  { id: "strafeRight", label: "Sidestep right", help: "Walk one cell to the right without turning.", defaults: ["KeyD", ""], held: true },
  { id: "turnLeft", label: "Turn left", help: "Turn a quarter circle to the left.", defaults: ["KeyQ", "ArrowLeft"], held: true },
  { id: "turnRight", label: "Turn right", help: "Turn a quarter circle to the right.", defaults: ["KeyE", "ArrowRight"], held: true },
  { id: "attack", label: "Attack", help: "Swing the weapon in hand, or fire the bow, at whatever is ahead.", defaults: ["Space", ""], held: true },
  { id: "interact", label: "Use what is ahead", help: "Open or close a door, throw a switch, drink from a fountain, pray at an altar, talk.", defaults: ["KeyF", "Enter"], held: false },
  { id: "pickup", label: "Pick up", help: "Pick up what lies in your cell.", defaults: ["KeyG", "Comma"], held: false },
  { id: "throw", label: "Throw", help: "Throw the first throwable weapon in your pack.", defaults: ["KeyT", ""], held: false },
  { id: "rest", label: "Rest", help: "Sit and recover. Time runs fast. Impossible with a monster in view.", defaults: ["KeyR", ""], held: false },
  { id: "cast", label: "Cast a spell", help: "Open the spell list, then press a spell's letter.", defaults: ["KeyC", ""], held: false },
  { id: "inventory", label: "Inventory", help: "Then press an item's letter to choose what to do with it.", defaults: ["KeyI", ""], held: false },
  { id: "map", label: "Map", help: "Show or hide the full map of this level.", defaults: ["KeyM", ""], held: false },
  { id: "mute", label: "Mute", help: "Silence music and effects, or bring them back.", defaults: ["KeyN", ""], held: false },
  { id: "pause", label: "Pause", help: "Open the pause menu. Also closes whatever is open.", defaults: ["Escape", ""], held: false },
];

export type Bindings = Record<ActionId, [string, string]>;

export interface KeyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "eye-below.keys.v1";

export function defaultBindings(): Bindings {
  const out = {} as Bindings;
  for (const a of ACTIONS) out[a.id] = [a.defaults[0], a.defaults[1]];
  return out;
}

export class KeyMap {
  bindings: Bindings = defaultBindings();
  private readonly storage: KeyStorage | null;

  constructor(storage: KeyStorage | null) {
    this.storage = storage;
    this.load();
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const text = this.storage.getItem(STORAGE_KEY);
      if (!text) return;
      const saved = JSON.parse(text) as Partial<Record<string, unknown>>;
      for (const a of ACTIONS) {
        const pair = saved[a.id];
        if (Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string") this.bindings[a.id] = [pair[0], pair[1]];
      }
    } catch {
      this.bindings = defaultBindings();
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.bindings));
    } catch {
      // Storage is unavailable; the bindings still hold for this session.
    }
  }

  actionFor(code: string): ActionId | null {
    for (const a of ACTIONS) {
      const pair = this.bindings[a.id];
      if (pair[0] === code || pair[1] === code) return a.id;
    }
    return null;
  }

  /** Bind a key to a slot. The key is taken away from any other action that had it. */
  rebind(action: ActionId, slot: 0 | 1, code: string): void {
    for (const a of ACTIONS) {
      const pair = this.bindings[a.id];
      if (pair[0] === code) pair[0] = "";
      if (pair[1] === code) pair[1] = "";
    }
    this.bindings[action][slot] = code;
    this.save();
  }

  reset(): void {
    this.bindings = defaultBindings();
    this.save();
  }

  /** The first key bound to an action, for labels. */
  label(action: ActionId): string {
    const pair = this.bindings[action];
    return keyName(pair[0] || pair[1]);
  }
}

const NAMES: Record<string, string> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Space: "Space",
  Escape: "Esc",
  Enter: "Enter",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Minus: "-",
  Equal: "=",
  Backquote: "`",
  Backspace: "Bksp",
  Tab: "Tab",
  ShiftLeft: "L Shift",
  ShiftRight: "R Shift",
  ControlLeft: "L Ctrl",
  ControlRight: "R Ctrl",
  AltLeft: "L Alt",
  AltRight: "R Alt",
};

export function keyName(code: string): string {
  if (!code) return "-";
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}
