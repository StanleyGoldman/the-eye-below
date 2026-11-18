// Room-and-corridor layout with lock-and-key planning.
//
// The map is a grid of sectors, one room per sector. Rooms are joined
// to neighbouring sectors by one-cell-wide corridors that cannot touch
// each other, so every corridor is the only way between its two rooms
// unless a loop is added on purpose. Locks go on corridors along the
// route from the up stairs to the down stairs, and whatever opens a
// lock is placed in a room that can be reached before it.

import { stream } from "../core/rng.ts";
import type { Rng } from "../core/rng.ts";
import { makeItem } from "../game/factory.ts";
import type { UidSource } from "../game/factory.ts";
import { KEY_COLORS, T } from "../game/types.ts";
import type { KeyColor, Level, Pos, RunConfig } from "../game/types.ts";
import { TIER_NAMES, tierOfDepth } from "../game/data/monsters.ts";
import { emptyLevel } from "./grid.ts";

export const SECT = 9;
/** Sector columns and rows for each map-size value. */
const GRID: readonly [number, number][] = [
  [2, 2],
  [3, 2],
  [3, 3],
  [4, 3],
  [4, 4],
  [5, 4],
  [5, 5],
  [6, 5],
  [6, 6],
];
const PATH_LOCKS: readonly number[] = [0, 0, 1, 1, 2, 2, 3, 3, 4];
const CLOSETS: readonly number[] = [0, 0, 0, 1, 1, 1, 2, 2, 2];

export interface Room {
  id: number;
  c: number;
  r: number;
  x: number;
  y: number;
  w: number;
  h: number;
  region: number;
  closet: boolean;
  /** Holds a key, switch, or plate, so it must stay reachable. */
  holdsOpener: boolean;
}

export type LockKind = "key" | "switch" | "plate";

export interface LockPlan {
  edge: number;
  kind: LockKind;
  color: KeyColor | null;
  /** Room on the near side (toward the up stairs) and on the far side. */
  from: number;
  to: number;
  openerRoom: number;
  onPath: boolean;
}

export interface Edge {
  a: number;
  b: number;
  tree: boolean;
  lock: number;
  cells: Pos[];
  plainDoor: boolean;
}

export interface Plan {
  cols: number;
  rows: number;
  w: number;
  h: number;
  rooms: Room[];
  edges: Edge[];
  start: number;
  end: number;
  path: number[];
  locks: LockPlan[];
  boneCloset: boolean;
}

/** Does the level above carry a bone key for a door on this one? Decided by the seed alone. */
export function boneFlag(seed: string, depth: number): boolean {
  if (depth < 1 || depth >= 25 || depth % 5 === 0 || (depth + 1) % 5 === 0) return false;
  return stream(seed, "bone", depth).chance(0.3);
}

function neighbours(cols: number, rows: number, id: number): number[] {
  const c = id % cols;
  const r = (id - c) / cols;
  const out: number[] = [];
  if (c > 0) out.push(id - 1);
  if (c < cols - 1) out.push(id + 1);
  if (r > 0) out.push(id - cols);
  if (r < rows - 1) out.push(id + cols);
  return out;
}

function sizeRoom(rng: Rng, room: Room, minSize: number): void {
  room.w = rng.range(minSize, 6);
  room.h = rng.range(minSize, 6);
  room.x = room.c * SECT + 1 + rng.range(0, 6 - room.w);
  room.y = room.r * SECT + 1 + rng.range(0, 6 - room.h);
}

export function planLayout(run: RunConfig, depth: number, attempt: number, withLocks: boolean): Plan {
  const key = depth * 64 + attempt;
  const rl = stream(run.seed, "layout", key);
  const rp = stream(run.seed, "puzzles", key);
  const [cols, rows] = GRID[(run.mods["mapSize"] ?? 5) - 1] ?? [4, 4];
  const count = cols * rows;

  const rooms: Room[] = [];
  for (let id = 0; id < count; id++) {
    const room: Room = { id, c: id % cols, r: Math.floor(id / cols), x: 0, y: 0, w: 1, h: 1, region: 0, closet: false, holdsOpener: false };
    if (rl.chance(0.14)) {
      room.x = room.c * SECT + 1 + rl.range(0, 5);
      room.y = room.r * SECT + 1 + rl.range(0, 5);
    } else {
      sizeRoom(rl, room, 2);
    }
    rooms.push(room);
  }

  // Spanning tree by randomized depth-first search.
  const edges: Edge[] = [];
  const edgeOf = new Map<string, number>();
  const addEdge = (a: number, b: number, tree: boolean): number => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    edges.push({ a: lo, b: hi, tree, lock: -1, cells: [], plainDoor: false });
    edgeOf.set(`${lo},${hi}`, edges.length - 1);
    return edges.length - 1;
  };
  const visited = new Array<boolean>(count).fill(false);
  const stack = [rl.int(count)];
  visited[stack[0] as number] = true;
  while (stack.length > 0) {
    const cur = stack[stack.length - 1] as number;
    const options = neighbours(cols, rows, cur).filter((n) => !visited[n]);
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const next = rl.pick(options);
    visited[next] = true;
    addEdge(cur, next, true);
    stack.push(next);
  }

  const adjacency = (): number[][] => {
    const adj: number[][] = rooms.map(() => []);
    for (const e of edges) {
      if (!e.tree) continue;
      adj[e.a]!.push(e.b);
      adj[e.b]!.push(e.a);
    }
    return adj;
  };
  const adj = adjacency();

  const treeDistances = (from: number): { dist: number[]; parent: number[] } => {
    const dist = new Array<number>(count).fill(-1);
    const parent = new Array<number>(count).fill(-1);
    const queue = [from];
    dist[from] = 0;
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head] as number;
      for (const n of adj[cur]!) {
        if (dist[n] !== -1) continue;
        dist[n] = (dist[cur] as number) + 1;
        parent[n] = cur;
        queue.push(n);
      }
    }
    return { dist, parent };
  };

  // Stairs: start at a random room, end at the room farthest from it.
  const start = rl.int(count);
  const fromStart = treeDistances(start);
  let far = 0;
  for (const d of fromStart.dist) far = Math.max(far, d);
  const farthest = rooms.filter((r) => fromStart.dist[r.id] === far).map((r) => r.id);
  const end = rl.pick(farthest);
  const path: number[] = [];
  for (let cur = end; cur !== -1; cur = fromStart.parent[cur] as number) path.unshift(cur);
  sizeRoom(rl, rooms[start]!, 3);
  sizeRoom(rl, rooms[end]!, 3);

  // Locks on the path.
  const locks: LockPlan[] = [];
  const colors = rp.shuffle(KEY_COLORS.slice());
  const pathEdges = path.length - 1;
  const wanted = withLocks ? Math.min(PATH_LOCKS[(run.mods["puzzles"] ?? 5) - 1] ?? 0, pathEdges) : 0;
  const slots = rp.shuffle(Array.from({ length: pathEdges }, (_, i) => i)).slice(0, wanted).sort((p, q) => p - q);
  const lockedEdge = new Set<number>();
  for (const s of slots) {
    const ei = edgeOf.get(`${Math.min(path[s]!, path[s + 1]!)},${Math.max(path[s]!, path[s + 1]!)}`) as number;
    lockedEdge.add(ei);
  }

  // Regions: how many path locks lie between the start and each room.
  const order = [start];
  const seenRoom = new Array<boolean>(count).fill(false);
  seenRoom[start] = true;
  for (let head = 0; head < order.length; head++) {
    const cur = order[head] as number;
    for (const n of adj[cur]!) {
      if (seenRoom[n]) continue;
      seenRoom[n] = true;
      const ei = edgeOf.get(`${Math.min(cur, n)},${Math.max(cur, n)}`) as number;
      rooms[n]!.region = rooms[cur]!.region + (lockedEdge.has(ei) ? 1 : 0);
      order.push(n);
    }
  }

  const onPath = new Set(path);
  const pickOpenerRoom = (maxRegion: number): number => {
    const candidates = rooms.filter((r) => r.region <= maxRegion && !r.closet);
    const weights = candidates.map((r) => (r.region === maxRegion ? 3 : 1) * (onPath.has(r.id) ? 1 : 2));
    const room = candidates[rp.weighted(weights)] as Room;
    room.holdsOpener = true;
    return room.id;
  };

  slots.forEach((s, i) => {
    const from = path[s] as number;
    const to = path[s + 1] as number;
    const ei = edgeOf.get(`${Math.min(from, to)},${Math.max(from, to)}`) as number;
    let kind: LockKind;
    let color: KeyColor | null = null;
    if (colors.length > 0 && rp.chance(0.5)) {
      kind = "key";
      color = colors.pop() as KeyColor;
    } else {
      kind = rp.chance(0.6) ? "switch" : "plate";
    }
    locks.push({ edge: ei, kind, color, from, to, openerRoom: pickOpenerRoom(i), onPath: true });
    edges[ei]!.lock = locks.length - 1;
  });

  // Closets: dead-end rooms off the path behind a coloured door, holding better loot.
  let boneCloset = false;
  if (withLocks) {
    const leaves = rp.shuffle(rooms.filter((r) => adj[r.id]!.length === 1 && !onPath.has(r.id) && !r.holdsOpener).map((r) => r.id));
    const wantBone = boneFlag(run.seed, depth - 1);
    let wantClosets = CLOSETS[(run.mods["puzzles"] ?? 5) - 1] ?? 0;
    for (const leaf of leaves) {
      if (rooms[leaf]!.holdsOpener) continue;
      let color: KeyColor | null = null;
      if (wantBone && !boneCloset) {
        color = "bone";
        boneCloset = true;
      } else if (wantClosets > 0 && colors.length > 0) {
        color = colors.pop() as KeyColor;
        wantClosets--;
      }
      if (!color) break;
      const room = rooms[leaf]!;
      room.closet = true;
      const other = adj[leaf]![0] as number;
      const ei = edgeOf.get(`${Math.min(leaf, other)},${Math.max(leaf, other)}`) as number;
      let openerRoom = -1;
      if (color !== "bone") {
        const candidates = rooms.filter((r) => !r.closet);
        const holder = rp.pick(candidates);
        holder.holdsOpener = true;
        openerRoom = holder.id;
      }
      locks.push({ edge: ei, kind: "key", color, from: other, to: leaf, openerRoom, onPath: false });
      edges[ei]!.lock = locks.length - 1;
    }
  }

  // Loops, only between rooms in the same region, so no lock can be walked around.
  for (let id = 0; id < count; id++) {
    for (const n of neighbours(cols, rows, id)) {
      if (n < id || edgeOf.has(`${id},${n}`)) continue;
      const ra = rooms[id]!;
      const rb = rooms[n]!;
      if (ra.region !== rb.region || ra.closet || rb.closet) continue;
      if (rl.chance(0.22)) addEdge(id, n, false);
    }
  }

  for (const e of edges) if (e.lock === -1 && rl.chance(0.25)) e.plainDoor = true;

  return { cols, rows, w: cols * SECT + 1, h: rows * SECT + 1, rooms, edges, start, end, path, locks, boneCloset };
}

function corridorCells(rng: Rng, a: Room, b: Room): Pos[] {
  const cells: Pos[] = [];
  if (a.r === b.r) {
    // a is to the left of b.
    const lo = Math.max(a.y, b.y);
    const hi = Math.min(a.y + a.h - 1, b.y + b.h - 1);
    if (lo <= hi) {
      const y = rng.range(lo, hi);
      for (let x = a.x + a.w; x < b.x; x++) cells.push({ x, y });
    } else {
      const ya = rng.range(a.y, a.y + a.h - 1);
      const yb = rng.range(b.y, b.y + b.h - 1);
      const gap = a.c * SECT + 8;
      for (let x = a.x + a.w; x <= gap; x++) cells.push({ x, y: ya });
      const step = yb > ya ? 1 : -1;
      for (let y = ya + step; y !== yb + step; y += step) cells.push({ x: gap, y });
      for (let x = gap + 1; x < b.x; x++) cells.push({ x, y: yb });
    }
  } else {
    // a is above b.
    const lo = Math.max(a.x, b.x);
    const hi = Math.min(a.x + a.w - 1, b.x + b.w - 1);
    if (lo <= hi) {
      const x = rng.range(lo, hi);
      for (let y = a.y + a.h; y < b.y; y++) cells.push({ x, y });
    } else {
      const xa = rng.range(a.x, a.x + a.w - 1);
      const xb = rng.range(b.x, b.x + b.w - 1);
      const gap = a.r * SECT + 8;
      for (let y = a.y + a.h; y <= gap; y++) cells.push({ x: xa, y });
      const step = xb > xa ? 1 : -1;
      for (let x = xa + step; x !== xb + step; x += step) cells.push({ x, y: gap });
      for (let y = gap + 1; y < b.y; y++) cells.push({ x: xb, y });
    }
  }
  return cells;
}

export function roomCells(room: Room): Pos[] {
  const out: Pos[] = [];
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) out.push({ x, y });
  return out;
}

/** Cells of a room that do not touch its edge. Stairs and features go here so they never block a doorway. */
export function interiorCells(room: Room): Pos[] {
  const out: Pos[] = [];
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) for (let x = room.x + 1; x < room.x + room.w - 1; x++) out.push({ x, y });
  return out;
}

export interface Carved {
  level: Level;
  plan: Plan;
  /** Cells already used by stairs, keys, plates, and features. */
  used: Set<number>;
  uids: UidSource;
}

export function carve(run: RunConfig, depth: number, attempt: number, plan: Plan): Carved {
  const rng = stream(run.seed, "carve", depth * 64 + attempt);
  const level = emptyLevel(depth, plan.w, plan.h, TIER_NAMES[tierOfDepth(depth)] ?? "The Cinderdeep");
  const uids: UidSource = { next: depth * 100000 + 1 };
  const used = new Set<number>();
  const at = (x: number, y: number): number => y * level.w + x;

  for (const room of plan.rooms) for (const c of roomCells(room)) level.tiles[at(c.x, c.y)] = T.FLOOR;
  for (const e of plan.edges) {
    e.cells = corridorCells(rng, plan.rooms[e.a]!, plan.rooms[e.b]!);
    for (const c of e.cells) level.tiles[at(c.x, c.y)] = T.FLOOR;
  }

  // Stairs, on interior cells so they are never in the way.
  const startRoom = plan.rooms[plan.start]!;
  const endRoom = plan.rooms[plan.end]!;
  const up = rng.pick(interiorCells(startRoom));
  level.up = up;
  level.tiles[at(up.x, up.y)] = T.STAIRS_UP;
  used.add(at(up.x, up.y));
  const down = rng.pick(interiorCells(endRoom));
  level.down = down;
  level.tiles[at(down.x, down.y)] = T.STAIRS_DOWN;
  used.add(at(down.x, down.y));

  const freeCell = (room: Room): Pos | null => {
    const cells = rng.shuffle(roomCells(room)).filter((c) => !used.has(at(c.x, c.y)));
    return cells[0] ?? null;
  };

  const switchSpot = (room: Room): Pos | null => {
    const spots: Pos[] = [];
    const consider = (wx: number, wy: number, fx: number, fy: number): void => {
      if (wx <= 0 || wy <= 0 || wx >= level.w - 1 || wy >= level.h - 1) return;
      if (level.tiles[at(wx, wy)] !== T.WALL) return;
      // The wall cell must touch floor only on the room side.
      const around: Pos[] = [
        { x: wx + 1, y: wy },
        { x: wx - 1, y: wy },
        { x: wx, y: wy + 1 },
        { x: wx, y: wy - 1 },
      ];
      for (const p of around) {
        if (p.x === fx && p.y === fy) continue;
        if (level.tiles[at(p.x, p.y)] !== T.WALL) return;
      }
      spots.push({ x: wx, y: wy });
    };
    for (let x = room.x; x < room.x + room.w; x++) {
      consider(x, room.y - 1, x, room.y);
      consider(x, room.y + room.h, x, room.y + room.h - 1);
    }
    for (let y = room.y; y < room.y + room.h; y++) {
      consider(room.x - 1, y, room.x, y);
      consider(room.x + room.w, y, room.x + room.w - 1, y);
    }
    const free = spots.filter((s) => !level.switches.some((o) => o.x === s.x && o.y === s.y));
    return free.length > 0 ? rng.pick(free) : null;
  };

  for (const lock of plan.locks) {
    const edge = plan.edges[lock.edge]!;
    const vertical = plan.rooms[edge.a]!.c === plan.rooms[edge.b]!.c;
    const cell = (lock.to === edge.b ? edge.cells[edge.cells.length - 1] : edge.cells[0]) as Pos;
    used.add(at(cell.x, cell.y));
    if (lock.kind === "key") {
      level.tiles[at(cell.x, cell.y)] = T.DOOR;
      level.doors.push({ id: level.doors.length, x: cell.x, y: cell.y, vertical, color: lock.color, locked: true, open: false });
      if (lock.openerRoom >= 0 && lock.color) {
        const spot = freeCell(plan.rooms[lock.openerRoom]!) ?? up;
        used.add(at(spot.x, spot.y));
        level.items.push({ x: spot.x, y: spot.y, item: makeItem(uids, `key_${lock.color}`) });
      }
      if (lock.color === "bone") level.meta.boneDoor = true;
    } else {
      const gateId = level.gates.length;
      level.tiles[at(cell.x, cell.y)] = T.GATE;
      level.gates.push({ id: gateId, kind: "portcullis", cells: [cell], vertical, open: false, opener: lock.kind });
      const room = plan.rooms[lock.openerRoom]!;
      const wall = lock.kind === "switch" ? switchSpot(room) : null;
      if (wall) {
        level.switches.push({ id: level.switches.length, x: wall.x, y: wall.y, gate: gateId, on: false, kind: "switch" });
      } else {
        const spot = freeCell(room) ?? up;
        used.add(at(spot.x, spot.y));
        level.gates[gateId]!.opener = "plate";
        level.plates.push({ id: level.plates.length, x: spot.x, y: spot.y, gate: gateId, pressed: false });
      }
    }
  }

  for (const edge of plan.edges) {
    if (!edge.plainDoor || edge.lock !== -1) continue;
    const vertical = plan.rooms[edge.a]!.c === plan.rooms[edge.b]!.c;
    const cell = (rng.chance(0.5) ? edge.cells[0] : edge.cells[edge.cells.length - 1]) as Pos;
    level.tiles[at(cell.x, cell.y)] = T.DOOR;
    used.add(at(cell.x, cell.y));
    level.doors.push({ id: level.doors.length, x: cell.x, y: cell.y, vertical, color: null, locked: false, open: false });
  }

  level.meta.rooms = plan.rooms.length;
  level.meta.locks = plan.locks.filter((l) => l.onPath).length;
  level.meta.closets = plan.locks.filter((l) => !l.onPath).length;
  level.meta.attempts = attempt + 1;
  return { level, plan, used, uids };
}
