// Saving and loading. Storage is passed in and every access is guarded,
// so the game runs the same when storage is missing or refuses writes.

import { SAVE_VERSION, syncRng } from "./state.ts";
import type { GameState } from "./types.ts";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = "eye-below.save.v1";

export function serialize(state: GameState): string {
  syncRng(state);
  return JSON.stringify({ ...state, events: [], prompt: null });
}

export function deserialize(text: string): GameState | null {
  try {
    const data = JSON.parse(text) as Partial<GameState> | null;
    if (!data || typeof data !== "object") return null;
    if (data.version !== SAVE_VERSION) return null;
    if (!data.player || !data.levels || !data.run || typeof data.depth !== "number") return null;
    if (!data.levels[data.depth] || !Array.isArray(data.player.inventory) || !Array.isArray(data.rng)) return null;
    const state = data as GameState;
    state.events = [];
    state.prompt = null;
    return state;
  } catch {
    return null;
  }
}

export function saveGame(storage: StorageLike | null, state: GameState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage: StorageLike | null): GameState | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(SAVE_KEY);
    return text ? deserialize(text) : null;
  } catch {
    return null;
  }
}

export function clearSave(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do: there was no save to clear, or storage is unavailable.
  }
}

export function hasSave(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
