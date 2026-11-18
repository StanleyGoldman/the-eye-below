// Seeded random numbers. One seed string, one independent stream per
// system, so changing how one system draws never reshuffles another.

export function hashString(s: string): number {
  // xmur3
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export type RngState = [number, number, number, number];

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    this.a = state[0] >>> 0;
    this.b = state[1] >>> 0;
    this.c = state[2] >>> 0;
    this.d = state[3] >>> 0;
  }

  static fromString(s: string): Rng {
    const h1 = hashString(s);
    const h2 = hashString(s + "\u0001");
    const h3 = hashString(s + "\u0002");
    const r = new Rng([h1, h2, h3, 1]);
    for (let i = 0; i < 12; i++) r.next();
    return r;
  }

  state(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  /** Uniform float in [0, 1). sfc32. */
  next(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return n <= 0 ? 0 : Math.floor(this.next() * n);
  }

  /** Integer in [lo, hi], inclusive. */
  range(lo: number, hi: number): number {
    return hi <= lo ? lo : lo + this.int(hi - lo + 1);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Sum of n dice with the given number of sides. */
  dice(n: number, sides: number): number {
    let total = 0;
    for (let i = 0; i < n; i++) total += 1 + this.int(sides);
    return total;
  }

  /** 1..n, like a single die. */
  rnd(n: number): number {
    return 1 + this.int(n);
  }

  pick<T>(list: readonly T[]): T {
    return list[this.int(list.length)] as T;
  }

  shuffle<T>(list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const t = list[i] as T;
      list[i] = list[j] as T;
      list[j] = t;
    }
    return list;
  }

  /** Pick an index by weight. Weights that are zero or less are never picked. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) if (w > 0) total += w;
    if (total <= 0) return 0;
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] as number;
      if (w <= 0) continue;
      roll -= w;
      if (roll < 0) return i;
    }
    return weights.length - 1;
  }
}

/** A named stream for one system, optionally for one level. */
export function stream(seed: string, name: string, n = 0): Rng {
  return Rng.fromString(`${seed}\u001f${name}\u001f${n}`);
}
