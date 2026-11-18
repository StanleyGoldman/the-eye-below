// A small pixel-drawing kit for the code-drawn art. Everything lands on
// whole pixels, so the result scales cleanly with smoothing off.

import { Rng } from "../core/rng.ts";

export interface Surface {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
}

export class Pen {
  readonly g: Surface;
  readonly w: number;
  readonly h: number;
  readonly rng: Rng;

  constructor(g: Surface, w: number, h: number, seed: string) {
    this.g = g;
    this.w = w;
    this.h = h;
    this.rng = Rng.fromString(`art:${seed}`);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    if (w <= 0 || h <= 0) return;
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x: number, y: number, color: string): void {
    this.rect(x, y, 1, 1, color);
  }

  clear(x: number, y: number, w: number, h: number): void {
    this.g.clearRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** Filled ellipse, one row at a time. */
  ell(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const t = ry === 0 ? 0 : (y - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
      this.rect(Math.round(cx - half), y, Math.max(1, Math.round(half * 2)), 1, color);
    }
  }

  /** Checkerboard dither inside an ellipse: the VGA way to shade. */
  ditherEll(cx: number, cy: number, rx: number, ry: number, color: string): void {
    this.g.fillStyle = color;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
      const t = ry === 0 ? 0 : (y - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - t * t));
      for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) if ((x + y) % 2 === 0) this.g.fillRect(x, y, 1, 1);
    }
  }

  dither(x: number, y: number, w: number, h: number, color: string): void {
    this.g.fillStyle = color;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((x + i + y + j) % 2 === 0) this.g.fillRect(Math.round(x + i), Math.round(y + j), 1, 1);
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string, thick = 1): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      this.rect(x - (thick - 1) / 2, y - (thick - 1) / 2, thick, thick, color);
    }
  }

  /** Filled triangle by scanline. */
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, color: string): void {
    const minY = Math.floor(Math.min(y0, y1, y2));
    const maxY = Math.ceil(Math.max(y0, y1, y2));
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (const [ax, ay, bx, by] of edges) {
        if (ay === by) continue;
        const t = (y + 0.5 - ay) / (by - ay);
        if (t >= 0 && t <= 1) xs.push(ax + (bx - ax) * t);
      }
      if (xs.length >= 2) {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        this.rect(Math.round(lo), y, Math.max(1, Math.round(hi - lo)), 1, color);
      }
    }
  }

  /** Sprinkle single pixels of the given colours over an area. */
  speckle(x: number, y: number, w: number, h: number, colors: readonly string[], density: number): void {
    const n = Math.round(w * h * density);
    for (let i = 0; i < n; i++) this.px(x + this.rng.int(w), y + this.rng.int(h), this.rng.pick(colors));
  }
}
