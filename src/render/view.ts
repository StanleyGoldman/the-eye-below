// The first-person view. One ray per screen column walks the grid; each
// wall is drawn as a vertical strip of its texture scaled by distance,
// so the camera can sit anywhere between cells and steps and turns can
// glide. Floors and ceilings are drawn a row at a time. Sprites are
// clipped against the walls column by column.

import type { AssetStore } from "../assets/store.ts";
import { SHADE_LEVELS } from "../assets/store.ts";
import { doorAt, gateAt } from "../dungeon/grid.ts";
import { monsterSprite } from "../game/data/assets.ts";
import { APPEARANCES, KEY_TINT, itemType } from "../game/data/items.ts";
import { monsterType, regularMonsters, tierOfDepth } from "../game/data/monsters.ts";
import { has } from "../game/state.ts";
import { T } from "../game/types.ts";
import type { GameState, Item, Level, Pos } from "../game/types.ts";

export const VIEW_W = 304;
export const VIEW_H = 208;
const PLANE = 0.66;
/** Height in pixels of one cell's wall at a distance of one cell. */
const WALL_SCALE = VIEW_W * 0.62;
const BACK = 0.3;
const STEP_TWEEN = 190;
const TURN_TWEEN = 140;
const TEX = 64;

export interface ViewFx {
  /** Real-time clock, milliseconds. */
  now: number;
  shakeUntil: number;
  flashUntil: number;
  flashColor: string;
  fadeUntil: number;
  rays: { cells: Pos[]; color: string; until: number }[];
}

interface Camera {
  x: number;
  y: number;
  dx: number;
  dy: number;
  px: number;
  py: number;
}

interface Drawable {
  depth: number;
  draw: () => void;
}

function ease(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c);
}

export function itemTint(state: GameState, item: Item): string {
  const type = itemType(item.type);
  if (type.tint) return type.tint;
  if (type.keyColor) return KEY_TINT[type.keyColor];
  const pool = APPEARANCES[type.cls];
  if (pool && !type.artifact) {
    const index = state.appearance[type.id];
    if (index !== undefined) return pool[index % pool.length]!.tint;
  }
  return "";
}

const FLYERS: Record<string, number> = { giant_bat: 0.3, floating_eye: 0.22, wraith: 0.08, stalker: 0.05 };

export class ViewRenderer {
  private readonly g: CanvasRenderingContext2D;
  private readonly store: AssetStore;
  private readonly zbuf = new Float64Array(VIEW_W);
  private readonly patterns = new Map<string, CanvasPattern>();
  private readonly doorSeen = new Map<string, { open: boolean; at: number }>();
  private far = 4.6;

  constructor(canvas: HTMLCanvasElement, store: AssetStore) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("2d canvas is not available");
    this.g = g;
    this.store = store;
  }

  private camera(state: GameState, fx: ViewFx): Camera {
    const p = state.player;
    const tt = ease((state.time - p.turnedAt) / TURN_TWEEN);
    let delta = p.dir - p.pdir;
    if (delta === 3) delta = -1;
    if (delta === -3) delta = 1;
    const angle = ((p.pdir + delta * tt) * Math.PI) / 2;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const mt = ease((state.time - p.movedAt) / STEP_TWEEN);
    let cx = p.px + (p.x - p.px) * mt + 0.5 - dx * BACK;
    let cy = p.py + (p.y - p.py) * mt + 0.5 - dy * BACK;
    if (fx.now < fx.shakeUntil) {
      const s = Math.sin(fx.now / 14) * 0.035;
      cx += -dy * s;
      cy += dx * s;
    }
    return { x: cx, y: cy, dx, dy, px: -dy * PLANE, py: dx * PLANE };
  }

  private shadeOf(dist: number): number {
    const t = (dist - 0.7) / (this.far - 0.7);
    return Math.max(0, Math.min(1, t));
  }

  private pattern(id: string): CanvasPattern | null {
    let p = this.patterns.get(id);
    if (!p) {
      const made = this.g.createPattern(this.store.get(id), "repeat");
      if (!made) return null;
      p = made;
      this.patterns.set(id, p);
    }
    return p;
  }

  private drawFloorAndCeiling(cam: Camera, tier: number): void {
    const g = this.g;
    const floor = this.pattern(`floor_${tier}`);
    const ceil = this.pattern(`ceil_${tier}`);
    const half = VIEW_H / 2;
    const sx = (2 * cam.px) / VIEW_W;
    const sy = (2 * cam.py) / VIEW_W;
    for (let row = 0; row < half; row++) {
      const yFloor = half + row;
      const dist = WALL_SCALE / 2 / (row + 0.5);
      const shade = this.shadeOf(dist);
      if (shade >= 1 || !floor || !ceil) continue;
      const fx = cam.x + dist * (cam.dx - cam.px);
      const fy = cam.y + dist * (cam.dy - cam.py);
      const a = TEX * sx * dist;
      const b = TEX * sy * dist;
      const n = a * a + b * b;
      if (n < 1e-9) continue;
      const a11 = a / n;
      const a12 = b / n;
      const a21 = -b / n;
      const a22 = a / n;
      const qx = TEX * fx;
      const qy = TEX * fy;
      const tx = -(a11 * qx + a12 * qy);
      const tyBase = -(a21 * qx + a22 * qy);
      floor.setTransform(new DOMMatrix([a11, a21, a12, a22, tx, tyBase + yFloor]));
      g.fillStyle = floor;
      g.fillRect(0, yFloor, VIEW_W, 1);
      const yCeil = half - 1 - row;
      ceil.setTransform(new DOMMatrix([a11, a21, a12, a22, tx, tyBase + yCeil]));
      g.fillStyle = ceil;
      g.fillRect(0, yCeil, VIEW_W, 1);
      if (shade > 0.02) {
        g.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
        g.fillRect(0, yFloor, VIEW_W, 1);
        g.fillRect(0, yCeil, VIEW_W, 1);
      }
    }
  }

  /** World point to camera space: x across, y depth. */
  private toCamera(cam: Camera, wx: number, wy: number): [number, number] {
    const rx = wx - cam.x;
    const ry = wy - cam.y;
    const inv = 1 / (cam.px * cam.dy - cam.dx * cam.py);
    return [inv * (cam.dy * rx - cam.dx * ry), inv * (-cam.py * rx + cam.px * ry)];
  }

  /** Fill a rectangle lying on the floor, in world coordinates. */
  private fillFloorRect(cam: Camera, x0: number, y0: number, x1: number, y1: number, color: string): void {
    const near = 0.12;
    let poly: [number, number][] = [this.toCamera(cam, x0, y0), this.toCamera(cam, x1, y0), this.toCamera(cam, x1, y1), this.toCamera(cam, x0, y1)];
    const out: [number, number][] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ain = a[1] >= near;
      const bin = b[1] >= near;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (near - a[1]) / (b[1] - a[1]);
        out.push([a[0] + (b[0] - a[0]) * t, near]);
      }
    }
    poly = out;
    if (poly.length < 3) return;
    let depth = 0;
    for (const c of poly) depth += c[1];
    depth /= poly.length;
    const shade = this.shadeOf(depth);
    if (shade >= 1) return;
    const g = this.g;
    g.beginPath();
    poly.forEach((c, i) => {
      const sx = (VIEW_W / 2) * (1 + c[0] / c[1]);
      const sy = VIEW_H / 2 + WALL_SCALE / 2 / c[1];
      if (i === 0) g.moveTo(sx, sy);
      else g.lineTo(sx, sy);
    });
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (shade > 0.02) {
      g.fillStyle = `rgba(0,0,0,${shade.toFixed(3)})`;
      g.fill();
    }
  }

  /** An image laid flat on the floor of a cell, drawn into the screen box its footprint covers. */
  private drawDecal(cam: Camera, id: string, cx: number, cy: number, inset: number): void {
    const corners = [this.toCamera(cam, cx + inset, cy + inset), this.toCamera(cam, cx + 1 - inset, cy + inset), this.toCamera(cam, cx + 1 - inset, cy + 1 - inset), this.toCamera(cam, cx + inset, cy + 1 - inset)];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let depth = 0;
    for (const c of corners) {
      if (c[1] < 0.2) return;
      const sx = (VIEW_W / 2) * (1 + c[0] / c[1]);
      const sy = VIEW_H / 2 + WALL_SCALE / 2 / c[1];
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
      depth += c[1] / 4;
    }
    const shade = this.shadeOf(depth);
    if (shade >= 1) return;
    this.g.drawImage(this.store.shaded(id, shade * SHADE_LEVELS), Math.round(minX), Math.round(minY), Math.max(1, Math.round(maxX - minX)), Math.max(1, Math.round(maxY - minY)));
  }

  private doorStage(level: Level, id: number, open: boolean, now: number): "door" | "door_half" | "door_open" {
    const key = `${level.depth}:${id}`;
    const seen = this.doorSeen.get(key);
    if (!seen) {
      this.doorSeen.set(key, { open, at: -1e9 });
      return open ? "door_open" : "door";
    }
    if (seen.open !== open) {
      seen.open = open;
      seen.at = now;
    }
    if (now - seen.at < 170) return "door_half";
    return open ? "door_open" : "door";
  }

  private strip(id: string, u: number, x: number, dist: number, darker: number, tint: string): void {
    const lineH = WALL_SCALE / dist;
    const top = VIEW_H / 2 - lineH / 2;
    const shade = Math.min(1, this.shadeOf(dist) + darker);
    if (shade >= 1) return;
    const img = this.store.shaded(id, shade * SHADE_LEVELS, tint);
    const tx = Math.min(TEX - 1, Math.max(0, Math.floor(u * img.width)));
    this.g.drawImage(img, tx, 0, 1, img.height, x, top, 1, lineH);
  }

  private castWalls(level: Level, cam: Camera, fx: ViewFx, tier: number, drawables: Drawable[]): void {
    const wallId = `wall_${tier}`;
    const torchSet = new Set(level.torches);
    const switchAt = new Map<number, string>();
    for (const s of level.switches) switchAt.set(s.y * level.w + s.x, s.kind === "reset" ? "lever" : s.on ? "switch_on" : "switch_off");
    const torchFrame = Math.floor(fx.now / 170);

    for (let x = 0; x < VIEW_W; x++) {
      const camX = (2 * (x + 0.5)) / VIEW_W - 1;
      const rdx = cam.dx + cam.px * camX;
      const rdy = cam.dy + cam.py * camX;
      let mapX = Math.floor(cam.x);
      let mapY = Math.floor(cam.y);
      const deltaX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const deltaY = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      const stepX = rdx < 0 ? -1 : 1;
      const stepY = rdy < 0 ? -1 : 1;
      let sideX = rdx < 0 ? (cam.x - mapX) * deltaX : (mapX + 1 - cam.x) * deltaX;
      let sideY = rdy < 0 ? (cam.y - mapY) * deltaY : (mapY + 1 - cam.y) * deltaY;
      let solid = 1e9;

      for (let guard = 0; guard < 16; guard++) {
        let side: number;
        if (sideX < sideY) {
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= level.w || mapY >= level.h) break;
        const entry = side === 0 ? sideX - deltaX : sideY - deltaY;
        if (entry > this.far + 0.6) break;
        const cell = mapY * level.w + mapX;
        const t = level.tiles[cell];
        if (t === T.WALL) {
          let u = side === 0 ? cam.y + entry * rdy : cam.x + entry * rdx;
          u -= Math.floor(u);
          if ((side === 0 && rdx < 0) || (side === 1 && rdy > 0)) u = 1 - u;
          solid = entry;
          this.strip(wallId, u, x, entry, side === 1 ? 0.12 : 0, "");
          const sw = switchAt.get(cell);
          if (sw) this.strip(sw, u, x, entry, 0, "");
          else if (torchSet.has(cell)) this.strip((torchFrame + cell) % 2 === 0 ? "torch_1" : "torch_2", u, x, entry, -0.35, "");
          break;
        }
        if (t !== T.DOOR && t !== T.GATE) continue;

        // A thin plane across the middle of the cell.
        const door = t === T.DOOR ? doorAt(level, mapX, mapY) : undefined;
        const gate = t === T.GATE ? gateAt(level, mapX, mapY) : undefined;
        const vertical = door ? door.vertical : gate ? gate.vertical : false;
        let hit: number;
        let u: number;
        if (vertical) {
          if (rdy === 0) continue;
          hit = (mapY + 0.5 - cam.y) / rdy;
          u = cam.x + hit * rdx;
          if (hit <= 0 || Math.floor(u) !== mapX) continue;
        } else {
          if (rdx === 0) continue;
          hit = (mapX + 0.5 - cam.x) / rdx;
          u = cam.y + hit * rdy;
          if (hit <= 0 || Math.floor(u) !== mapY) continue;
        }
        u -= Math.floor(u);
        if (door) {
          const stage = this.doorStage(level, door.id, door.open, fx.now);
          const tint = door.color ? KEY_TINT[door.color] : "#c8b090";
          if (stage === "door") {
            solid = hit;
            this.strip("door", u, x, hit, 0, tint);
            break;
          }
          const depth = hit;
          const uu = u;
          drawables.push({ depth, draw: () => this.strip(stage, uu, x, depth, 0, tint) });
        } else if (gate) {
          if (gate.kind === "drawbridge") {
            if (!gate.open) {
              solid = hit;
              this.strip("drawbridge", u, x, hit, 0, "");
              break;
            }
          } else {
            const depth = hit;
            const uu = u;
            const id = gate.open ? "gate_open" : "gate";
            drawables.push({ depth, draw: () => this.strip(id, uu, x, depth, 0, "") });
          }
        }
      }
      this.zbuf[x] = solid;
    }
  }

  private sprite(cam: Camera, drawables: Drawable[], img: (shade: number) => CanvasImageSource & { width: number; height: number }, wx: number, wy: number, height: number, lift: number, alpha: number, widthScale = 1): void {
    const [tx, ty] = this.toCamera(cam, wx, wy);
    // Anything closer than this is in the player's own cell: under their feet, not in front of them.
    if (ty < 0.55 || ty > this.far + 0.5) return;
    const shade = this.shadeOf(ty);
    if (shade >= 1) return;
    drawables.push({
      depth: ty,
      draw: () => {
        const g = this.g;
        const unit = WALL_SCALE / ty;
        const source = img(shade);
        const hPx = height * unit;
        const wPx = hPx * (source.width / source.height) * widthScale;
        const centre = (VIEW_W / 2) * (1 + tx / ty);
        const left = centre - wPx / 2;
        const bottom = VIEW_H / 2 + unit / 2 - lift * unit;
        const top = bottom - hPx;
        const x0 = Math.max(0, Math.floor(left));
        const x1 = Math.min(VIEW_W - 1, Math.ceil(left + wPx) - 1);
        if (alpha < 1) g.globalAlpha = alpha;
        let runStart = -1;
        for (let x = x0; x <= x1 + 1; x++) {
          const visible = x <= x1 && ty < (this.zbuf[x] as number);
          if (visible && runStart < 0) runStart = x;
          if (!visible && runStart >= 0) {
            const sx = ((runStart - left) / wPx) * source.width;
            const sw = ((x - runStart) / wPx) * source.width;
            g.drawImage(source, sx, 0, sw, source.height, runStart, top, x - runStart, hPx);
            runStart = -1;
          }
        }
        if (alpha < 1) g.globalAlpha = 1;
      },
    });
  }

  private addSprites(state: GameState, level: Level, cam: Camera, fx: ViewFx, drawables: Drawable[]): void {
    const store = this.store;
    const p = state.player;
    const seeInvisible = has(state, "seeInvisible");
    const tripping = has(state, "hallucinating");
    const regulars = regularMonsters();
    const inRange = (x: number, y: number): boolean => Math.abs(x - p.x) <= 7 && Math.abs(y - p.y) <= 7;

    if (inRange(level.up.x, level.up.y)) this.sprite(cam, drawables, (s) => store.shaded("stairs_up", s * SHADE_LEVELS), level.up.x + 0.5, level.up.y + 0.5, 0.95, 0, 1);
    if (level.down && inRange(level.down.x, level.down.y)) {
      const d = level.down;
      this.sprite(cam, drawables, (s) => store.shaded("stairs_down", s * SHADE_LEVELS), d.x + 0.5, d.y + 0.5, 0.95, 0, 1);
    }
    for (const f of level.features) {
      if (!inRange(f.x, f.y)) continue;
      const height = f.kind === "altar" ? 0.6 : f.kind === "fountain" ? 0.8 : f.kind === "statue" ? 0.9 : 0.8;
      this.sprite(cam, drawables, (s) => store.shaded(f.kind, s * SHADE_LEVELS), f.x + 0.5, f.y + 0.5, height, 0, 1);
    }
    // Items: up to three shown per cell, spread sideways.
    const perCell = new Map<number, number>();
    for (const fi of level.items) {
      if (!inRange(fi.x, fi.y)) continue;
      const key = fi.y * level.w + fi.x;
      const n = perCell.get(key) ?? 0;
      perCell.set(key, n + 1);
      if (n >= 3) continue;
      const type = itemType(fi.item.type);
      const tint = itemTint(state, fi.item);
      const off = (n - 1) * 0.22 + (n === 0 ? 0.22 : 0);
      const ox = fi.x + 0.5 + (n === 0 ? 0 : off * -cam.dy);
      const oy = fi.y + 0.5 + (n === 0 ? 0 : off * cam.dx);
      this.sprite(cam, drawables, (s) => store.shaded(type.icon, s * SHADE_LEVELS, tint), ox, oy, type.cls === "gold" ? 0.2 : 0.26, 0.01, 1);
    }
    for (const m of level.monsters) {
      if (!inRange(m.x, m.y)) continue;
      const type = monsterType(m.type);
      const fallen = m.hp <= 0;
      if (fallen && m.reviveAt <= 0) continue;
      let alpha = 1;
      if (type.invisible) {
        if (!seeInvisible) continue;
        alpha = 0.55;
      }
      let shown = m.type;
      if (tripping && !fallen) shown = regulars[(m.uid * 7 + Math.floor(state.time / 2500)) % regulars.length]!.id;
      const look = monsterType(shown);
      const attacking = !fallen && state.time < m.attackAnimUntil;
      const id = monsterSprite(shown, attacking);
      const mt = ease((state.time - m.movedAt) / Math.min(240, Math.max(120, type.moveMs)));
      let wx = m.px + (m.x - m.px) * mt + 0.5;
      let wy = m.py + (m.y - m.py) * mt + 0.5;
      if (attacking) {
        // Lunge toward the player.
        const lx = p.x + 0.5 - wx;
        const ly = p.y + 0.5 - wy;
        const len = Math.hypot(lx, ly) || 1;
        wx += (lx / len) * 0.14;
        wy += (ly / len) * 0.14;
      }
      const flash = state.time < m.hitFlashUntil;
      const height = fallen ? look.size * 0.25 : look.size * (attacking ? 1.08 : 1);
      const lift = fallen ? 0 : (FLYERS[shown] ?? 0) + (FLYERS[shown] ? Math.sin(fx.now / 300 + m.uid) * 0.02 : 0);
      this.sprite(cam, drawables, (s) => (flash ? store.flashed(id) : store.shaded(id, s * SHADE_LEVELS)), wx, wy, height, lift, alpha, fallen ? 2.2 : 1);
      if (m.peaceful && !fallen) {
        // A pale marker over anything peaceful.
        const [tx, ty] = this.toCamera(cam, wx, wy);
        if (ty > 0.3 && ty < this.far) {
          drawables.push({
            depth: ty - 0.01,
            draw: () => {
              const unit = WALL_SCALE / ty;
              const cx = Math.round((VIEW_W / 2) * (1 + tx / ty));
              const cy = Math.round(VIEW_H / 2 + unit / 2 - (look.size + 0.08) * unit);
              if (cx < 0 || cx >= VIEW_W || ty >= (this.zbuf[cx] as number)) return;
              const r = Math.max(1, Math.round(unit * 0.03));
              this.g.fillStyle = "#9fd8e8";
              this.g.fillRect(cx - r, cy - r, r * 2, r * 2);
              this.g.fillStyle = "#ffffff";
              this.g.fillRect(cx - r, cy - r, r, r);
            },
          });
        }
      }
    }
    // Bolts and rays in flight.
    for (const ray of fx.rays) {
      if (fx.now >= ray.until) continue;
      const g = this.g;
      for (const c of ray.cells) {
        const [tx, ty] = this.toCamera(cam, c.x + 0.5, c.y + 0.5);
        if (ty < 0.3 || ty > this.far + 1) continue;
        drawables.push({
          depth: ty,
          draw: () => {
            const unit = WALL_SCALE / ty;
            const cx = Math.round((VIEW_W / 2) * (1 + tx / ty));
            if (cx < 0 || cx >= VIEW_W || ty >= (this.zbuf[cx] as number)) return;
            const r = Math.max(2, Math.round(unit * 0.12));
            g.fillStyle = ray.color;
            g.fillRect(cx - r, VIEW_H / 2 - r, r * 2, r * 2);
            g.fillStyle = "#ffffff";
            g.fillRect(cx - Math.ceil(r / 2), VIEW_H / 2 - Math.ceil(r / 2), r, r);
          },
        });
      }
    }
  }

  render(state: GameState, fx: ViewFx): void {
    const g = this.g;
    const level = state.levels[state.depth];
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#000000";
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!level) return;
    if (has(state, "blind")) return;
    const p = state.player;
    const lit = p.litUntil > state.time;
    this.far = lit ? 7 : 4.6;
    const tier = tierOfDepth(state.depth);
    const cam = this.camera(state, fx);

    this.drawFloorAndCeiling(cam, tier);

    // Things that lie on the floor.
    const near = (x: number, y: number): boolean => Math.abs(x - p.x) <= 6 && Math.abs(y - p.y) <= 6;
    for (let y = Math.max(0, p.y - 6); y <= Math.min(level.h - 1, p.y + 6); y++) {
      for (let x = Math.max(0, p.x - 6); x <= Math.min(level.w - 1, p.x + 6); x++) {
        const t = level.tiles[y * level.w + x];
        if (t === T.WATER) this.fillFloorRect(cam, x, y, x + 1, y + 1, "#1c3a66");
        else if (t === T.PIT) this.fillFloorRect(cam, x + 0.06, y + 0.06, x + 0.94, y + 0.94, "#020202");
        else if (t === T.GATE) {
          const gate = gateAt(level, x, y);
          if (gate && gate.kind === "drawbridge") this.fillFloorRect(cam, x, y, x + 1, y + 1, gate.open ? "#6b4a22" : "#1c3a66");
        }
      }
    }
    for (const plate of level.plates) if (near(plate.x, plate.y)) this.drawDecal(cam, "plate", plate.x, plate.y, plate.pressed ? 0.3 : 0.24);
    for (const trap of level.traps) if (trap.found && near(trap.x, trap.y)) this.drawDecal(cam, "trap", trap.x, trap.y, 0.28);

    const drawables: Drawable[] = [];
    this.castWalls(level, cam, fx, tier, drawables);
    this.addSprites(state, level, cam, fx, drawables);
    drawables.sort((a, b) => b.depth - a.depth);
    for (const d of drawables) d.draw();

    if (state.time < p.hurtFlashUntil) {
      g.fillStyle = "rgba(192,40,30,0.32)";
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (fx.now < fx.flashUntil) {
      g.globalAlpha = 0.3 * Math.min(1, (fx.flashUntil - fx.now) / 150);
      g.fillStyle = fx.flashColor;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.globalAlpha = 1;
    }
    if (has(state, "asleep") || has(state, "paralyzed")) {
      g.fillStyle = "rgba(0,0,10,0.5)";
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    if (fx.now < fx.fadeUntil) {
      g.globalAlpha = Math.min(1, (fx.fadeUntil - fx.now) / 300);
      g.fillStyle = "#000000";
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.globalAlpha = 1;
    }
  }
}
