// Run-time images. Every lookup goes through the ASSETS table by id and
// returns a canvas: the code-drawn art, plus cached tinted, shaded, and
// flashed variants made with compositing only. Pixel data is never read.

import { FILE_IDS, filePath } from "./files.ts";
import { Pen } from "./pen.ts";
import { ASSETS } from "./table.ts";
import type { FrameOp } from "./table.ts";

/** A picture that can be drawn: a loaded file or a canvas. */
export type Pic = HTMLCanvasElement | HTMLImageElement;

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

/** Make a frame out of its base picture: the stand-in until the frame has a file of its own. */
function derive(base: Pic, op: FrameOp): Pic {
  if (op === "same") return base;
  const c = makeCanvas(base.width, base.height);
  const g = context(c);
  const w = base.width;
  const h = base.height;
  if (op === "flipV") {
    g.translate(0, h);
    g.scale(1, -1);
    g.drawImage(base, 0, 0);
  } else if (op === "flipH") {
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(base, 0, 0);
  } else if (op === "leftHalf") {
    g.drawImage(base, 0, 0, w, h, 0, 0, Math.round(w * 0.46), h);
  } else if (op === "leftEdge") {
    g.drawImage(base, 0, 0, w, h, 0, 0, Math.round(w * 0.1), h);
  } else {
    const strip = Math.round(h * 0.16);
    g.drawImage(base, 0, h - strip, w, strip, 0, 0, w, strip);
  }
  return c;
}

export class AssetStore {
  private readonly cache = new Map<string, Pic>();
  private readonly urls = new Map<string, string>();
  private readonly files = new Map<string, HTMLImageElement>();
  private readonly failed: string[] = [];
  private expected = 0;

  /**
   * Load every generated image the manifest lists. A file that is
   * missing or broken is simply left out, and its id keeps its
   * code-drawn art. Call before anything asks for an image.
   */
  async loadFiles(): Promise<void> {
    this.expected = FILE_IDS.length;
    await Promise.all(
      FILE_IDS.map(
        (id) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            const timer = window.setTimeout(() => {
              this.failed.push(id);
              resolve();
            }, 8000);
            img.onload = () => {
              window.clearTimeout(timer);
              if (ASSETS[id]) this.files.set(id, img);
              resolve();
            };
            img.onerror = () => {
              window.clearTimeout(timer);
              this.failed.push(id);
              resolve();
            };
            img.src = filePath(id);
          }),
      ),
    );
  }

  /** What loading achieved, for the checks. */
  report(): { expected: number; loaded: number; failed: string[] } {
    return { expected: this.expected, loaded: this.files.size, failed: this.failed.slice() };
  }

  has(id: string): boolean {
    return ASSETS[id] !== undefined;
  }

  /**
   * The picture for an id: its generated file if one loaded; otherwise,
   * for a frame, a stand-in made from its base picture's file; otherwise
   * the code-drawn art. An unknown id gives a small dark square, never an error.
   */
  get(id: string): Pic {
    let c = this.cache.get(id);
    if (c) return c;
    const def = ASSETS[id];
    const file = this.files.get(id);
    const baseFile = def?.frame ? this.files.get(def.frame.of) : undefined;
    if (file) {
      c = file;
    } else if (def?.frame && baseFile) {
      c = derive(baseFile, def.frame.op);
    } else if (!def) {
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
  tinted(id: string, color: string): Pic {
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
  shaded(id: string, level: number, tint = ""): Pic {
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
  flashed(id: string, color = "#ffffff"): Pic {
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
      const pic = this.get(id);
      u = pic instanceof HTMLCanvasElement && !this.files.has(id) ? pic.toDataURL("image/png") : filePath(id);
      this.urls.set(id, u);
    }
    return u;
  }
}
