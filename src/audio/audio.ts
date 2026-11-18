// Music and sound effects, played with plain audio elements (decoding
// through fetch does not work from file://). Nothing plays until the
// first user input. A file that is missing or broken is silence.

import { MUSIC_IDS, SFX_IDS, audioPath } from "../assets/files.ts";

export interface AudioSettings {
  music: number;
  effects: number;
  muted: boolean;
}

export interface AudioStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AudioReport {
  enabled: boolean;
  unlocked: boolean;
  /** The track that should be playing. */
  music: string;
  musicPlaying: boolean;
  /** Seconds into the current track, read from the element. */
  musicTime: number;
  musicVolume: number;
  effectsVolume: number;
  /** The loudest volume actually set on any element, music or effect. */
  loudestElement: number;
  muted: boolean;
  /** Elements currently making sound, music and effects together. */
  playing: number;
  effectsPlayed: number;
  lastEffect: string;
  failed: string[];
}

const STORAGE_KEY = "eye-below.audio.v1";
/** Pieces that play once and stop. */
const ONE_SHOT = new Set(["music_death", "music_victory"]);
/** Shortest gap, in milliseconds, between two plays of the same effect. */
const MIN_GAP: Record<string, number> = { sfx_step: 140, sfx_bump: 250, sfx_swing: 200, sfx_hurt: 250, sfx_hit: 120 };

export class AudioEngine {
  readonly enabled: boolean;
  settings: AudioSettings = { music: 0.6, effects: 0.8, muted: false };
  private readonly storage: AudioStorage | null;
  private readonly tracks = new Map<string, HTMLAudioElement>();
  private readonly effects = new Map<string, HTMLAudioElement[]>();
  private readonly lastPlayed = new Map<string, number>();
  private readonly failed = new Set<string>();
  private unlocked = false;
  private wanted = "";
  private current = "";
  private effectsPlayed = 0;
  private lastEffect = "";

  constructor(storage: AudioStorage | null, enabled: boolean) {
    this.storage = storage;
    this.enabled = enabled;
    if (storage) {
      try {
        const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as Partial<AudioSettings> | null;
        if (saved) {
          if (typeof saved.music === "number") this.settings.music = Math.max(0, Math.min(1, saved.music));
          if (typeof saved.effects === "number") this.settings.effects = Math.max(0, Math.min(1, saved.effects));
          if (typeof saved.muted === "boolean") this.settings.muted = saved.muted;
        }
      } catch {
        // Unreadable settings: keep the defaults.
      }
    }
  }

  private save(): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Storage is unavailable; the settings hold for this session.
    }
  }

  private musicVolume(): number {
    return this.settings.muted ? 0 : this.settings.music;
  }

  private effectsVolume(): number {
    return this.settings.muted ? 0 : this.settings.effects;
  }

  private track(id: string): HTMLAudioElement | null {
    if (!this.enabled || this.failed.has(id) || !MUSIC_IDS.includes(id)) return null;
    let a = this.tracks.get(id);
    if (!a) {
      a = new Audio(audioPath(id));
      a.loop = !ONE_SHOT.has(id);
      a.preload = "auto";
      a.addEventListener("error", () => this.failed.add(id));
      this.tracks.set(id, a);
    }
    return a;
  }

  /** Call on the first key press or click. Until then nothing makes a sound. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.applyMusic();
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Say which track should be playing; an empty string means silence. */
  setMusic(id: string): void {
    if (id === this.wanted) return;
    this.wanted = id;
    if (this.unlocked) this.applyMusic();
  }

  private applyMusic(): void {
    if (this.current === this.wanted) return;
    const old = this.tracks.get(this.current);
    if (old) old.pause();
    this.current = this.wanted;
    const next = this.track(this.current);
    if (!next) return;
    next.currentTime = 0;
    next.volume = this.musicVolume();
    void next.play().catch(() => undefined);
  }

  /** Play a sound effect by its asset id. */
  effect(id: string): void {
    if (!this.enabled || !this.unlocked || this.failed.has(id) || !SFX_IDS.includes(id)) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(id) ?? -1e9) < (MIN_GAP[id] ?? 60)) return;
    this.lastPlayed.set(id, now);
    let pool = this.effects.get(id);
    if (!pool) {
      pool = [];
      this.effects.set(id, pool);
    }
    let a = pool.find((x) => x.paused || x.ended);
    if (!a) {
      if (pool.length >= 3) return;
      a = new Audio(audioPath(id));
      a.preload = "auto";
      a.addEventListener("error", () => this.failed.add(id));
      pool.push(a);
    }
    a.currentTime = 0;
    a.volume = this.effectsVolume();
    void a.play().catch(() => undefined);
    this.effectsPlayed++;
    this.lastEffect = id;
  }

  private applyVolumes(): void {
    const t = this.tracks.get(this.current);
    if (t) t.volume = this.musicVolume();
    for (const pool of this.effects.values()) for (const a of pool) a.volume = this.effectsVolume();
  }

  setVolume(kind: "music" | "effects", value: number): void {
    this.settings[kind] = Math.max(0, Math.min(1, value));
    this.applyVolumes();
    this.save();
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    this.applyVolumes();
    this.save();
    return this.settings.muted;
  }

  report(): AudioReport {
    const t = this.tracks.get(this.current);
    let playing = t && !t.paused && !t.ended ? 1 : 0;
    let loudest = t ? t.volume : 0;
    for (const pool of this.effects.values()) {
      for (const a of pool) {
        if (!a.paused && !a.ended) playing++;
        loudest = Math.max(loudest, a.volume);
      }
    }
    return {
      enabled: this.enabled,
      unlocked: this.unlocked,
      music: this.wanted,
      musicPlaying: !!t && !t.paused && !t.ended,
      musicTime: t ? t.currentTime : 0,
      musicVolume: this.musicVolume(),
      effectsVolume: this.effectsVolume(),
      loudestElement: loudest,
      muted: this.settings.muted,
      playing,
      effectsPlayed: this.effectsPlayed,
      lastEffect: this.lastEffect,
      failed: [...this.failed],
    };
  }
}
