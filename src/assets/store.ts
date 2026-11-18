// Run-time images. Every lookup goes through the ASSETS table by id and
// returns a canvas: the code-drawn art, plus cached tinted, shaded, and
// flashed variants made with compositing only. Pixel data is never read.

import { Pen } from "./pen.ts";
import { ASSETS } from "./table.ts";

export const SHADE_LEVELS = 8;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function context(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext("2d");
  if (!g) throw new Error("2d canvas is not available");
  g.imageSmoothingEnabled = false;
  return g;
}

export class AssetStore {
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private readonly urls = new Map<string, string>();

  has(id: string): boolean {
    return ASSETS[id] !== undefined;
  }

  /** The image for an id. An unknown id gives a small dark square, never an error. */
  get(id: string): HTMLCanvasElement {
    let c = this.cache.get(id);
    if (c) return c;
    const def = ASSETS[id];
    if (!def) {
      c = makeCanvas(8, 8);
      const g = context(c);
      g.fillStyle = "#201020";
      g.fillRect(0, 0, 8, 8);
    } else {
      c = makeCanvas(def.w, def.h);
      def.paint(new Pen(context(c), def.w, def.h, id));
    }
    this.cache.set(id, c);
    return c;
  }

  /** Multiply-tinted copy that keeps the original transparency. */
  tinted(id: string, color: string): HTMLCanvasElement {
    const key = `${id}|tint|${color}`;
    let c = this.cache.get(key);
    if (c) return c;
    const src = this.get(id);
    c = makeCanvas(src.width, src.height);
    const g = context(c);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(src, 0, 0);
    this.cache.set(key, c);
    return c;
  }

  /** Darkened copy for distance: level 0 is full brightness, SHADE_LEVELS is black. */
  shaded(id: string, level: number, tint = ""): HTMLCanvasElement {
    const lv = Math.max(0, Math.min(SHADE_LEVELS, Math.round(level)));
    const base = tint ? this.tinted(id, tint) : this.get(id);
    if (lv === 0) return base;
    const key = `${id}|shade|${lv}|${tint}`;
    let c = this.cache.get(key);
    if (c) return c;
    c = makeCanvas(base.width, base.height);
    const g = context(c);
    g.drawImage(base, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = `rgba(0,0,0,${lv / SHADE_LEVELS})`;
    g.fillRect(0, 0, c.width, c.height);
    this.cache.set(key, c);
    return c;
  }

  /** A solid-colour silhouette, for the flash when something is hit. */
  flashed(id: string, color = "#ffffff"): HTMLCanvasElement {
    const key = `${id}|flash|${color}`;
    let c = this.cache.get(key);
    if (c) return c;
    const src = this.get(id);
    c = makeCanvas(src.width, src.height);
    const g = context(c);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    this.cache.set(key, c);
    return c;
  }

  /**
   * A URL for the untinted image, for CSS backgrounds. Code-drawn art
   * becomes a data URL; art loaded from a file must return the file's
   * own path here instead, because a canvas that has had a file drawn
   * on it cannot be exported.
   */
  url(id: string): string {
    let u = this.urls.get(id);
    if (!u) {
      u = this.get(id).toDataURL("image/png");
      this.urls.set(id, u);
    }
    return u;
  }
}
