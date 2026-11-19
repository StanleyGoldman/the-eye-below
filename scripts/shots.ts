// Screenshots of the game for blog posts, from each tagged version, and a page to pick from.
//
//   node scripts/shots.ts                         all scenes and bot runs, for session-1, session-2 and session-3
//   node scripts/shots.ts --versions session-3    one version only
//   node scripts/shots.ts --only monsters,specials --no-bot
//   node scripts/shots.ts --collect ~/Downloads/picks.txt --to ~/blog/img
//
// Each version is checked out as a detached worktree under out/versions/<tag>/ and built
// there, the first time only. Two kinds of shot:
//
// - Set-up scenes: a fixed seed and level, the player placed in front of something with the
//   game's debug hook, then a few key presses. Seeds are chosen with each version's own level
//   generator, so where the versions generate the same level the shots line up side by side.
// - Bot runs: the autopilot plays for a while (unkillable) and the most eventful frames are kept,
//   scored by what the game reports (fighting, low health, someone talking, a new level), by a
//   monster in the target bar, and by how much is on screen.
//
// Output: out/shots/blog/<tag>/*.png, out/shots/blog/manifest.json, and out/shots/blog/index.html,
// the page to pick from. Picks are saved in that browser and downloaded as picks.txt, which
// --collect copies into a folder along with captions.txt: version, scene and caption for each.
//
// Options: --versions tag,tag  --only scene,scene  --no-bot  --bot-runs n (3)  --bot-seconds n (60)
// --keep n (frames kept per bot run, 6)  --victory (also play a whole run to the victory screen: slow)
// --scale n (pixel density, 2: 1920x1080)  --out folder  --headed

import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import sharp from "sharp";
import { fail, parseArgs } from "./lib/args.ts";

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/shots.ts [--versions session-1,session-2,session-3] [--only scene,...] [--no-bot] [--bot-runs n] [--bot-seconds n] [--keep n] [--victory] [--scale n] [--out dir] [--headed]");
  console.log("       node scripts/shots.ts --collect picks.txt --to folder");
  process.exit(0);
}

/** The game's own version numbers for the session tags. */
const VERSION_NAMES: Record<string, string> = { "session-1": "0.1", "session-2": "0.2", "session-3": "1.0" };

const root = process.cwd();
let outDir = path.resolve(args.flags["out"] ?? "out/shots/blog");

// ---- --collect: copy the picked files into a folder -----------------------

if (args.flags["collect"]) {
  const to = args.flags["to"];
  if (!to) fail("--collect needs --to <folder>");
  const lines = (await readFile(args.flags["collect"], "utf8")).split("\n").map((l) => l.trim()).filter(Boolean);
  // The page writes the folder it lives in as the first line, so picks made in any checkout or
  // worktree are found from anywhere. --out still wins.
  const from = lines.find((l) => l.startsWith("# shots: "))?.slice("# shots: ".length);
  if (from && !args.flags["out"]) outDir = from;
  const list = lines.filter((l) => !l.startsWith("#"));
  const missing: string[] = [];
  for (const rel of list) if (!(await exists(path.join(outDir, rel)))) missing.push(rel);
  if (missing.length > 0) {
    fail(
      `${missing.length} of ${list.length} picked file(s) are not in ${outDir} (first: ${missing[0]}). ` +
        (from ? "They may have been replaced by a later run." : "Pass --out <the shots folder the picks were made in>, or download picks.txt again from that folder's page."),
    );
  }
  await mkdir(to, { recursive: true });
  for (const rel of list) {
    const dest = path.join(to, rel.replaceAll("/", "_"));
    await copyFile(path.join(outDir, rel), dest);
    console.log(`  ${rel} -> ${dest}`);
  }
  // captions.txt describes every screenshot in the folder, so collecting twice into one folder keeps both lots.
  const shots = JSON.parse(await readFile(path.join(outDir, "manifest.json"), "utf8")) as Shot[];
  const byName = new Map(shots.map((s) => [s.file.replaceAll("/", "_"), s]));
  const here = (await readdir(to)).filter((f) => byName.has(f)).sort();
  const entries: string[] = [];
  for (const name of here) {
    const s = byName.get(name) as Shot;
    const { width, height } = await sharp(path.join(to, name)).metadata();
    const lines = [name, `  Version: ${VERSION_NAMES[s.version] ?? s.version} (${s.version})`, `  Scene: ${s.title}`, `  Caption: ${s.caption}`, `  Size: ${width}x${height}`];
    if (s.score !== undefined) lines.push(`  Interest score: ${s.score}`);
    entries.push(lines.join("\n"));
  }
  await writeFile(path.join(to, "captions.txt"), `The Eye Below: screenshots\n\n${entries.join("\n\n")}\n`);
  console.log(`shots: copied ${list.length} picked file(s) to ${to}; captions.txt describes ${here.length}`);
  process.exit(0);
}

const versions = (args.flags["versions"] ?? "session-1,session-2,session-3").split(",").map((v) => v.trim()).filter(Boolean);
const only = args.flags["only"] ? new Set(args.flags["only"].split(",").map((s) => s.trim())) : null;
const scale = Number(args.flags["scale"] ?? 2);
const botRunCount = Number(args.flags["bot-runs"] ?? 3);
const botSeconds = Number(args.flags["bot-seconds"] ?? 60);
const keepPerRun = Number(args.flags["keep"] ?? 6);
const withBot = args.flags["no-bot"] !== "true";

// ---- versions -------------------------------------------------------------

interface Gen {
  generateLevel: (run: { seed: string; mods: unknown }, depth: number) => GenLevel;
  resolveMods: (seed: string, overrides: Record<string, number>) => unknown;
  encodeRunCode: (seed: string, overrides: Record<string, number>) => string;
}

interface GenLevel {
  special?: string;
  monsters: { type: string; peaceful?: boolean; npc?: { kind: string } }[];
  features: { kind: string; locked?: boolean }[];
  gates: { kind: string }[];
  items: { item: { type: string } }[];
  meta: { vault?: unknown };
}

interface Version {
  tag: string;
  /** 1, 2 or 3: which features exist (shops from 2, treasure and animation from 3). */
  n: number;
  dir: string;
  gen: Gen;
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Check out a tag as a detached worktree under out/versions/ and build it, unless that was done already. */
async function prepare(tag: string): Promise<Version> {
  const dir = path.join(root, "out/versions", tag);
  if (!(await exists(dir))) {
    console.log(`  checking out ${tag} into ${path.relative(root, dir)}/`);
    execFileSync("git", ["worktree", "add", "--detach", dir, tag], { stdio: "inherit" });
  }
  // The version builds with this checkout's packages (the nearest node_modules up from here).
  const link = path.join(dir, "node_modules");
  if (!(await exists(link))) {
    await rm(link, { force: true });
    let up = root;
    while (!(await exists(path.join(up, "node_modules/esbuild"))) && path.dirname(up) !== up) up = path.dirname(up);
    if (!(await exists(path.join(up, "node_modules/esbuild")))) fail('no node_modules found: run "make deps" first');
    await symlink(path.join(up, "node_modules"), link);
  }
  if (!(await exists(path.join(dir, "dist/game.js")))) {
    console.log(`  building ${tag}`);
    execFileSync(process.execPath, ["scripts/build.ts"], { cwd: dir, stdio: "inherit" });
  }
  const generate = await import(path.join(dir, "src/dungeon/generate.ts"));
  const modifiers = await import(path.join(dir, "src/core/modifiers.ts"));
  const digits = /(\d+)\s*$/.exec(tag);
  const n = Math.min(3, Math.max(1, Number(args.flags["as"] ?? (digits ? digits[1] : 3))));
  return { tag, n, dir, gen: { generateLevel: generate.generateLevel, resolveMods: modifiers.resolveMods, encodeRunCode: modifiers.encodeRunCode } };
}

// ---- the browser side -----------------------------------------------------

interface Info {
  screen: string;
  depth: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  won: boolean;
  prompt: string;
  time: number;
  log: string[];
}

interface Shot {
  version: string;
  scene: string;
  title: string;
  file: string;
  caption: string;
  score?: number;
}

const manifest: Shot[] = [];
const warnings: string[] = [];

class Ctx {
  readonly browser: Browser;
  readonly v: Version;
  readonly scene: string;
  readonly title: string;

  constructor(browser: Browser, v: Version, scene: string, title: string) {
    this.browser = browser;
    this.v = v;
    this.scene = scene;
    this.title = title;
  }

  private count = 0;

  async open(query: string, debug = true): Promise<Page> {
    const context = await this.browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    const url = `file://${path.join(this.v.dir, "index.html")}?${debug ? "debug=1&" : ""}${query}`;
    await page.goto(url);
    if (debug) await page.waitForFunction("typeof window.__eye === 'object'", undefined, { timeout: 10000 });
    else await page.waitForSelector(".gametitle", { timeout: 10000 });
    await page.evaluate("document.fonts.ready");
    return page;
  }

  /** A running game on a level, unkillable. */
  async start(opts: { seed?: string; code?: string; level?: number; role?: string }): Promise<Page> {
    const q = [
      "start=1",
      "god=1",
      opts.code ? `code=${encodeURIComponent(opts.code)}` : `seed=${encodeURIComponent(opts.seed ?? "blog")}`,
      `level=${opts.level ?? 1}`,
      `role=${opts.role ?? "valkyrie"}`,
    ].join("&");
    const page = await this.open(q);
    await waitFor(page, (i) => i.screen === "game" && i.depth === (opts.level ?? 1));
    await page.waitForTimeout(400);
    return page;
  }

  async shot(page: Page, caption: string): Promise<void> {
    this.count++;
    const rel = `${this.v.tag}/${this.scene}-${String(this.count).padStart(2, "0")}.png`;
    await page.screenshot({ path: path.join(outDir, rel) });
    manifest.push({ version: this.v.tag, scene: this.scene, title: this.title, file: rel, caption });
  }

  eye(page: Page, expr: string): Promise<unknown> {
    return page.evaluate(`window.__eye.${expr}`);
  }

  /** Stand in front of something. Version 1 cannot name a target, so it takes the first one the game picks. */
  async face(page: Page, dist: number | undefined, type?: string): Promise<boolean> {
    const d = dist === undefined ? "undefined" : String(dist);
    const ok = type && this.v.n >= 2 ? await this.eye(page, `vantage(${d}, ${JSON.stringify(type)})`) : await this.eye(page, `vantage(${d})`);
    await page.waitForTimeout(350);
    return ok === true;
  }
}

async function info(page: Page): Promise<Info> {
  return (await page.evaluate("window.__eye.info()")) as Info;
}

async function waitFor(page: Page, test: (i: Info) => boolean, timeoutMs = 15000): Promise<Info> {
  const started = Date.now();
  let last = await info(page);
  while (!test(last)) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out (screen ${last.screen}, depth ${last.depth})`);
    await page.waitForTimeout(100);
    last = await info(page);
  }
  return last;
}

/** The name in the target bar: what the player is actually looking at. */
async function facing(page: Page): Promise<string> {
  const el = page.locator(".target .targetname");
  if ((await el.count()) === 0 || !(await el.first().isVisible())) return "";
  return ((await el.first().textContent()) ?? "").trim();
}

async function press(page: Page, code: string, waitMs = 300): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(waitMs);
}

// ---- choosing levels ------------------------------------------------------

const TIERS: Record<number, string[]> = {
  1: ["newt", "jackal", "kobold", "floating_eye"],
  2: ["giant_bat", "acid_blob", "hill_orc", "dwarf"],
  3: ["soldier_ant", "cockatrice", "ghoul", "leprechaun"],
  4: ["troll", "wraith", "ogre"], // the stalker is invisible
  5: ["vampire", "minotaur", "fire_drake", "lich"],
};

/** Levels that are not special, by tier. */
const TIER_DEPTHS: Record<number, number[]> = { 1: [1, 2, 3, 4], 2: [6, 7, 8, 9], 3: [11, 12, 13, 14], 4: [16, 17, 18, 19], 5: [21, 22, 23, 24] };

/**
 * Seeds and levels where a monster type is what the game will put in front of the player, first
 * in every version being shot (so the shots line up), then in this version alone. In version 1
 * that means it is the first monster and nothing outranks it (bosses, peaceful folk, boulders, the
 * drawbridge, fountains), since vantage there cannot be told what to face.
 */
function findMonsters(all: Version[], self: Version, type: string, tier: number, limit = 6): { seed: string; depth: number }[] {
  const fits = (v: Version, seed: string, depth: number): boolean => {
    const level = v.gen.generateLevel({ seed, mods: v.gen.resolveMods(seed, {}) }, depth);
    if (v.n === 1) {
      const outranked = level.monsters.some((m) => m.peaceful) || level.features.some((f) => f.kind === "boulder" || f.kind === "fountain") || level.gates.some((g) => g.kind === "drawbridge");
      return !outranked && level.monsters[0]?.type === type;
    }
    return level.monsters.some((m) => m.type === type);
  };
  const found: { seed: string; depth: number }[] = [];
  for (const group of [all, [self]]) {
    let taken = 0;
    for (let i = 0; i < 400 && taken < limit; i++) {
      const seed = `blog-${type}-${i}`;
      for (const depth of TIER_DEPTHS[tier] ?? []) {
        if (taken >= limit) break;
        if (found.some((f) => f.seed === seed && f.depth === depth)) continue;
        if (group.every((v) => fits(v, seed, depth))) {
          found.push({ seed, depth });
          taken++;
        }
      }
    }
  }
  return found;
}

const monsterName = (type: string): string => type.replaceAll("_", " ");

/**
 * A running game with the player facing a monster of a type, checked against the target bar (a
 * monster can wander off before the shot, and version 1 picks its own target). Tries one level
 * after another, and one step away when further off does not work; null if none worked.
 */
async function faceMonster(c: Ctx, all: Version[], type: string, tier: number, dist: number, role = "valkyrie"): Promise<{ page: Page; seed: string; depth: number; name: string } | null> {
  for (const at of findMonsters(all, c.v, type, tier)) {
    const page = await c.start({ seed: at.seed, level: at.depth, role });
    // On the darkest levels a monster two steps off is not in the target bar yet, so step closer.
    for (const d of new Set([dist, 1])) {
      if (!(await c.face(page, d, type))) continue;
      const name = await facing(page);
      if (name.toLowerCase().startsWith(monsterName(type))) return { page, ...at, name };
    }
    await page.context().close();
  }
  warnings.push(`${c.v.tag} ${c.scene}: could not get a ${monsterName(type)} in front of the player`);
  return null;
}

function findLevel(v: Version, overrides: Record<string, number>, prefix: string, test: (l: GenLevel) => boolean, depths = [1, 2, 3, 4]): { code: string; depth: number } | null {
  for (let i = 0; i < 3000; i++) {
    const seed = `${prefix}${i}`;
    const mods = v.gen.resolveMods(seed, overrides);
    for (const depth of depths) if (test(v.gen.generateLevel({ seed, mods }, depth))) return { code: v.gen.encodeRunCode(seed, overrides), depth };
  }
  return null;
}

// ---- scenes ---------------------------------------------------------------

interface Scene {
  id: string;
  title: string;
  /** The first version that has what the scene shows. */
  since: number;
  run: (c: Ctx, all: Version[]) => Promise<void>;
}

const SCENES: Scene[] = [
  {
    id: "title",
    title: "Title and new-game screens",
    since: 1,
    run: async (c) => {
      const page = await c.open("", false);
      await page.waitForTimeout(600);
      await c.shot(page, "Title screen");
      await page.click('[data-act="new"]');
      await page.fill('[data-field="seed"]', "blog");
      await page.click('[data-role="wizard"]');
      await page.waitForTimeout(300);
      await c.shot(page, "New game: seed, role and modifiers");
      await page.context().close();
    },
  },
  {
    id: "arrival",
    title: "First steps, one level per tier",
    since: 1,
    run: async (c) => {
      for (const depth of [1, 7, 12, 17, 22]) {
        const page = await c.start({ seed: "blog", level: depth });
        await c.shot(page, `Arriving on level ${depth}`);
        for (const k of ["KeyW", "KeyW", "KeyE", "KeyW"]) await press(page, k, 260);
        await c.shot(page, `A few steps into level ${depth}`);
        await page.context().close();
      }
    },
  },
  {
    id: "monsters",
    title: "Monsters, face to face",
    since: 1,
    run: async (c, all) => {
      for (const [tierText, types] of Object.entries(TIERS)) {
        const tier = Number(tierText);
        for (const type of types) {
          const got = await faceMonster(c, all, type, tier, 2);
          if (!got) continue;
          const page = got.page;
          await c.shot(page, `${got.name} (level ${got.depth}, seed ${got.seed})`);
          await page.context().close();
        }
      }
    },
  },
  {
    id: "fight",
    title: "In a fight",
    since: 1,
    run: async (c, all) => {
      for (const [type, tier, role] of [["hill_orc", 2, "valkyrie"], ["ghoul", 3, "rogue"], ["troll", 4, "valkyrie"], ["minotaur", 5, "valkyrie"]] as const) {
        const got = await faceMonster(c, all, type, tier, 1, role);
        if (!got) continue;
        const page = got.page;
        await page.keyboard.press("Space");
        await page.waitForTimeout(120);
        const foe = got.name.toLowerCase().replace(/ \(.*\)$/, "");
        await c.shot(page, `Swinging at a ${foe}`);
        await page.waitForTimeout(700);
        await press(page, "Space", 160);
        await c.shot(page, `Still fighting the ${foe}`);
        await page.context().close();
      }
    },
  },
  {
    id: "spell",
    title: "A wizard casting",
    since: 1,
    run: async (c, all) => {
      const got = await faceMonster(c, all, "kobold", 1, 2, "wizard");
      if (!got) return;
      const page = got.page;
      await press(page, "KeyC", 250);
      await c.shot(page, "The spell list");
      await page.keyboard.press("a");
      await page.waitForTimeout(90);
      await c.shot(page, "Casting at a kobold");
      await page.waitForTimeout(250);
      await c.shot(page, "Just after the spell");
      await page.context().close();
    },
  },
  {
    id: "specials",
    title: "The five special levels",
    since: 1,
    run: async (c) => {
      for (const depth of [5, 10, 15, 20, 25]) {
        const page = await c.start({ seed: "blog", level: depth });
        await c.shot(page, `Arriving on level ${depth}`);
        if (await c.face(page, undefined)) await c.shot(page, `What level ${depth} is known for`);
        await press(page, "KeyM", 300);
        await c.shot(page, `The map of level ${depth}`);
        await page.context().close();
      }
    },
  },
  {
    id: "oracle",
    title: "Talking to the Oracle",
    since: 1,
    run: async (c) => {
      const page = await c.start({ seed: "blog", level: 5 });
      await c.face(page, 1);
      await press(page, "KeyF", 300);
      await c.shot(page, "The Oracle's question");
      await page.context().close();
    },
  },
  {
    id: "panels",
    title: "Inventory, map and menus",
    since: 1,
    run: async (c) => {
      const page = await c.start({ seed: "blog", level: 3, role: "rogue" });
      await page.evaluate("window.__eye.runBot('win', 90000)").catch(() => undefined);
      await page.waitForTimeout(400);
      await press(page, "KeyI", 200);
      await c.shot(page, "The inventory");
      await page.keyboard.press("a");
      await page.waitForTimeout(200);
      await c.shot(page, "An item's actions");
      await press(page, "Escape", 150);
      await page.hover(".slot");
      await page.waitForTimeout(250);
      await c.shot(page, "An item's tooltip");
      await page.mouse.move(480, 200);
      await press(page, "KeyM", 300);
      await c.shot(page, "The full map, part explored");
      await press(page, "KeyM", 150);
      await press(page, "Escape", 300);
      await c.shot(page, "The pause menu");
      await page.context().close();
    },
  },
  {
    id: "market",
    title: "Shop, rumors and a priest",
    since: 2,
    run: async (c) => {
      const market = findLevel(c.v, { shopFrequency: 9, npcs: 9 }, "blogmarket", (l) => {
        const kinds = new Set(l.monsters.map((m) => m.npc?.kind));
        return kinds.has("shopkeeper") && kinds.has("priest") && (kinds.has("hermit") || kinds.has("adventurer") || kinds.has("gnome"));
      });
      if (!market) throw new Error("no level with a shop, a priest and a rumor-monger");
      const page = await c.start({ code: market.code, level: market.depth });
      await c.eye(page, "gold(3000)");
      if (await c.face(page, 2, "shopkeeper")) await c.shot(page, "A shopkeeper at the door");
      if (await c.face(page, 1, "shopkeeper")) {
        await press(page, "KeyF", 400);
        await c.shot(page, "Buying and selling");
        await press(page, "Escape", 200);
      }
      for (const kind of ["hermit", "adventurer", "gnome"]) {
        if (!(await c.face(page, 1, kind))) continue;
        await press(page, "KeyF", 400);
        await c.shot(page, `A ${kind} with a rumor`);
        await press(page, "Escape", 200);
        break;
      }
      if (await c.face(page, 1, "priest")) {
        await press(page, "KeyF", 400);
        await c.shot(page, "A temple priest");
        await press(page, "Escape", 200);
      }
      await page.context().close();
    },
  },
  {
    id: "treasure",
    title: "Chests, a vault and its guard",
    since: 3,
    run: async (c) => {
      const hoard = findLevel(c.v, { gold: 9, monsterCount: 1 }, "bloghoard", (l) => !!l.meta.vault && l.features.filter((f) => f.kind === "chest" && f.locked).length >= 1);
      if (!hoard) throw new Error("no level with a vault and a locked chest");
      const page = await c.start({ code: hoard.code, level: hoard.depth });
      if (await c.face(page, 2, "chest_locked")) await c.shot(page, "A locked chest");
      if (await c.face(page, 1, "chest_locked")) {
        await press(page, "KeyF", 300);
        await c.shot(page, "How to open it");
        await page.click('[data-option="force"]').catch(() => undefined);
        await page.waitForTimeout(500);
        await c.shot(page, "Forcing the lid");
      }
      if (await c.eye(page, "goto('vault')")) {
        await page.waitForTimeout(400);
        await c.shot(page, "Inside a vault");
        await page.evaluate("window.__eye.speed(20)");
        const started = Date.now();
        while (Date.now() - started < 20000 && (await info(page)).prompt === "") await page.waitForTimeout(250);
        await page.evaluate("window.__eye.speed(1)");
        await page.waitForTimeout(300);
        await c.shot(page, "The vault guard asks who you are");
      }
      await page.context().close();
    },
  },
  {
    id: "death",
    title: "Death, and the grave in the next run",
    since: 1,
    run: async (c) => {
      const code = c.v.gen.encodeRunCode("goal1", { monsterCount: 9, monsterToughness: 9 });
      const page = await c.open(`start=1&code=${encodeURIComponent(code)}&role=wizard`);
      await waitFor(page, (i) => i.screen === "game");
      let i = await info(page);
      const started = Date.now();
      // Game time, as in scripts/play.ts: a hard run can take the bot a while to lose.
      while (!i.dead && i.time < 3600 * 1000 && Date.now() - started < 300000) {
        await page.evaluate("window.__eye.runBot('die', 20000)");
        i = await info(page);
      }
      if (!i.dead) throw new Error("the character did not die");
      await waitFor(page, (x) => x.screen === "dead");
      await page.waitForTimeout(600);
      await c.shot(page, `The tombstone (died on level ${i.depth})`);
      if (c.v.n >= 3) {
        // Same browser storage, so the next run on that level has the grave.
        const next = await page.context().newPage();
        await next.goto(`file://${path.join(c.v.dir, "index.html")}?debug=1&start=1&god=1&seed=goal1&level=${i.depth}`);
        await next.waitForFunction("typeof window.__eye === 'object'");
        await waitFor(next, (x) => x.screen === "game" && x.depth === i.depth);
        if (await c.face(next, 2, "grave_fallen")) await c.shot(next, "The grave of the last character, in the next run");
      }
      await page.context().close();
    },
  },
  {
    id: "victory",
    title: "Victory",
    since: 1,
    run: async (c) => {
      if (args.flags["victory"] !== "true") return;
      const page = await c.start({ seed: "blog", level: 1 });
      let i = await info(page);
      while (!i.won) {
        await page.evaluate("window.__eye.runBot('win', 60000)");
        i = await info(page);
      }
      await waitFor(page, (x) => x.screen === "won");
      await page.waitForTimeout(600);
      await c.shot(page, "The victory screen");
      await page.context().close();
    },
  },
];

// ---- bot runs -------------------------------------------------------------

const ACTION = /\b(hit|hits|miss|misses|bites|claws|strikes|kill|kills|destroy|cast|casts|breathes|hurls|zap|throw|fire|burn|freez|poison|paralyz|stun|drain|blind)/i;

/** How much a frame has going on: luminance spread and colour, from a small copy. */
async function busyness(png: Buffer): Promise<number> {
  const stats = await sharp(png).resize(240, 135).stats();
  const [r, g, b] = stats.channels;
  if (!r || !g || !b) return 0;
  const spread = (r.stdev + g.stdev + b.stdev) / 3;
  const colour = Math.abs(r.mean - g.mean) + Math.abs(g.mean - b.mean) + Math.abs(r.mean - b.mean);
  return spread / 12 + colour / 30;
}

async function botRuns(browser: Browser, v: Version): Promise<void> {
  const starts = [1, 8, 13, 18, 23];
  const roles = ["valkyrie", "wizard", "rogue"];
  for (let run = 0; run < botRunCount; run++) {
    const level = starts[run % starts.length] as number;
    const c = new Ctx(browser, v, `bot${run + 1}`, `Bot run ${run + 1}, from level ${level}`);
    const page = await c.start({ seed: `blogbot${run}`, level, role: roles[run % roles.length] });
    await page.evaluate("window.__eye.speed(3); window.__eye.auto('win')");
    const frames: { png: Buffer; score: number; at: number; caption: string }[] = [];
    let prev = await info(page);
    let lastDepthChange = -99;
    const started = Date.now();
    while (Date.now() - started < botSeconds * 1000) {
      await page.waitForTimeout(700);
      const i = await info(page);
      if (i.screen !== "game" || i.dead || i.won) break;
      const fresh = i.log.filter((l) => !prev.log.includes(l));
      const t = (Date.now() - started) / 1000;
      if (i.depth !== prev.depth) lastDepthChange = t;
      let score = fresh.length * 0.5;
      if (fresh.some((l) => ACTION.test(l))) score += 3;
      if (i.maxHp > 0 && i.hp / i.maxHp < 0.5) score += 2;
      if (i.prompt) score += 3;
      // A monster in the target bar: something is in front of the player, not just in the log.
      if (await facing(page)) score += 3;
      if (t - lastDepthChange < 2) score += 1.5;
      const png = await page.screenshot();
      score += await busyness(png);
      frames.push({ png, score, at: t, caption: `${t.toFixed(0)} s in, level ${i.depth}${fresh.length ? `: ${fresh[fresh.length - 1]}` : ""}` });
      prev = i;
    }
    await page.evaluate("window.__eye.auto(null)");
    // The best frames, at least four seconds apart.
    const kept: typeof frames = [];
    for (const f of [...frames].sort((a, b) => b.score - a.score)) {
      if (kept.length >= keepPerRun) break;
      if (kept.some((k) => Math.abs(k.at - f.at) < 4)) continue;
      kept.push(f);
    }
    kept.sort((a, b) => a.at - b.at);
    for (const [n, f] of kept.entries()) {
      const rel = `${v.tag}/bot${run + 1}-${String(n + 1).padStart(2, "0")}.png`;
      await writeFile(path.join(outDir, rel), f.png);
      manifest.push({ version: v.tag, scene: `bot${run + 1}`, title: c.title, file: rel, caption: f.caption, score: Math.round(f.score * 10) / 10 });
    }
    console.log(`  ${v.tag} bot run ${run + 1}: ${frames.length} frames, kept ${kept.length}`);
    await page.context().close();
  }
}

// ---- the picking page -----------------------------------------------------

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] as string);
}

function pickingPage(shots: Shot[], tags: string[], folder: string): string {
  const scenes: { id: string; title: string }[] = [];
  for (const s of shots) if (!scenes.some((x) => x.id === s.scene)) scenes.push({ id: s.scene, title: s.title });
  const rows = scenes
    .map((sc) => {
      const cols = tags
        .map((tag) => {
          const here = shots.filter((s) => s.scene === sc.id && s.version === tag);
          const cells = here.length
            ? here.map((s) => `<figure data-file="${esc(s.file)}"><img loading="lazy" src="${esc(s.file)}" alt="${esc(s.caption)}"><figcaption>${esc(s.caption)}${s.score !== undefined ? ` <span class="score">${s.score}</span>` : ""}</figcaption></figure>`).join("")
            : `<p class="none">Not in this version.</p>`;
          return `<div class="col"><h3>${esc(tag)}</h3>${cells}</div>`;
        })
        .join("");
      return `<section><h2>${esc(sc.title)}</h2><div class="cols" style="--n:${tags.length}">${cols}</div></section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Screenshot picker</title>
<style>
:root { --bg:#111; --fg:#ddd; --muted:#888; --pick:#e8b84a; }
body { margin:0; background:var(--bg); color:var(--fg); font:14px/1.4 system-ui, sans-serif; }
header { position:sticky; top:0; z-index:2; background:#000d; padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
header h1 { font-size:16px; margin:0 12px 0 0; }
button, label { background:#222; color:var(--fg); border:1px solid #444; border-radius:4px; padding:5px 10px; font:inherit; cursor:pointer; }
main { padding:0 16px 40px; }
h2 { font-size:15px; margin:28px 0 8px; border-bottom:1px solid #333; padding-bottom:4px; }
h3 { font-size:12px; color:var(--muted); margin:0 0 6px; font-weight:normal; }
.cols { display:grid; grid-template-columns:repeat(var(--n), minmax(0, 1fr)); gap:14px; }
@media (max-width: 800px) { .cols { grid-template-columns:1fr; } }
figure { margin:0 0 12px; cursor:pointer; position:relative; }
figure img { width:100%; display:block; border:3px solid transparent; border-radius:3px; image-rendering:pixelated; }
figure.picked img { border-color:var(--pick); }
figure.picked::after { content:"★"; position:absolute; top:6px; right:10px; color:var(--pick); font-size:22px; text-shadow:0 0 4px #000; }
figcaption { font-size:12px; color:var(--muted); margin-top:3px; }
.score { color:#6a6; }
.none { color:#555; font-style:italic; }
body.only-picked figure:not(.picked), body.only-picked .none { display:none; }
#big { position:fixed; inset:0; background:#000e; display:none; align-items:center; justify-content:center; z-index:5; }
#big img { max-width:96vw; max-height:92vh; image-rendering:pixelated; }
#big.on { display:flex; }
</style></head><body>
<header><h1>Screenshot picker</h1>
<span id="count">0 picked</span>
<button id="dl">Download picks.txt</button>
<button id="copy">Copy list</button>
<label><input type="checkbox" id="onlyp"> Picked only</label>
<button id="clear">Clear picks</button>
<span style="color:var(--muted)">Click to pick, double-click to view full size.</span>
</header>
<main>
${rows}
</main>
<div id="big"><img alt=""></div>
<script>
const KEY = "shot-picks";
let picks;
try { picks = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { picks = new Set(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...picks])); } catch {} };
const figs = [...document.querySelectorAll("figure")];
function paint() {
  for (const f of figs) f.classList.toggle("picked", picks.has(f.dataset.file));
  document.getElementById("count").textContent = picks.size + " picked";
}
for (const f of figs) {
  let timer = null;
  f.addEventListener("click", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { picks.has(f.dataset.file) ? picks.delete(f.dataset.file) : picks.add(f.dataset.file); save(); paint(); }, 220);
  });
  f.addEventListener("dblclick", () => {
    clearTimeout(timer);
    const big = document.getElementById("big");
    big.querySelector("img").src = f.dataset.file;
    big.classList.add("on");
  });
}
document.getElementById("big").addEventListener("click", (e) => e.currentTarget.classList.remove("on"));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("big").classList.remove("on"); });
const FOLDER = ${JSON.stringify(folder).replaceAll("<", "\\u003c")};
const list = () => "# shots: " + FOLDER + "\\n" + [...picks].sort().join("\\n") + "\\n";
document.getElementById("dl").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([list()], { type: "text/plain" }));
  a.download = "picks.txt";
  a.click();
};
document.getElementById("copy").onclick = () => navigator.clipboard.writeText(list());
document.getElementById("onlyp").onchange = (e) => document.body.classList.toggle("only-picked", e.target.checked);
document.getElementById("clear").onclick = () => { if (confirm("Clear all picks?")) { picks.clear(); save(); paint(); } };
paint();
</script>
</body></html>
`;
}

// ---- main -----------------------------------------------------------------

console.log(`shots: versions ${versions.join(", ")}`);
const prepared: Version[] = [];
for (const tag of versions) prepared.push(await prepare(tag));

// Shots from an earlier run of other scenes or versions stay in the page.
const manifestFile = path.join(outDir, "manifest.json");
let earlier: Shot[] = [];
if (await exists(manifestFile)) earlier = JSON.parse(await readFile(manifestFile, "utf8")) as Shot[];

let browser: Browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: args.flags["headed"] !== "true" });
} catch (err) {
  fail(`could not start Google Chrome through Playwright: ${(err as Error).message.split("\n")[0]}`);
}

const startedAt = Date.now();
const redone = new Set<string>();
try {
  for (const v of prepared) {
    await mkdir(path.join(outDir, v.tag), { recursive: true });
    for (const scene of SCENES) {
      if (only && !only.has(scene.id)) continue;
      if (v.n < scene.since) continue;
      redone.add(`${v.tag}/${scene.id}`);
      const before = manifest.length;
      try {
        await scene.run(new Ctx(browser, v, scene.id, scene.title), prepared);
      } catch (err) {
        warnings.push(`${v.tag} ${scene.id}: ${(err as Error).message.split("\n")[0]}`);
      }
      console.log(`  ${v.tag} ${scene.id}: ${manifest.length - before} shot(s)`);
    }
    if (withBot && (!only || only.has("bot"))) {
      for (let r = 0; r < botRunCount; r++) redone.add(`${v.tag}/bot${r + 1}`);
      await botRuns(browser, v);
    }
  }
} finally {
  await browser.close();
}

const all = [...earlier.filter((s) => !redone.has(`${s.version}/${s.scene}`)), ...manifest];
const order = (s: Shot): number => {
  const i = SCENES.findIndex((x) => x.id === s.scene);
  return i >= 0 ? i : SCENES.length + Number(s.scene.replace(/\D/g, ""));
};
all.sort((a, b) => order(a) - order(b) || a.file.localeCompare(b.file));
const tags = [...new Set([...versions, ...all.map((s) => s.version)])].sort();
await writeFile(manifestFile, JSON.stringify(all, null, 2));
await writeFile(path.join(outDir, "index.html"), pickingPage(all, tags, outDir));

const seconds = ((Date.now() - startedAt) / 1000).toFixed(0);
console.log(`shots: ${manifest.length} new screenshot(s) in ${seconds} s; ${all.length} on the page`);
for (const w of warnings) console.log(`  warning: ${w}`);
console.log(`shots: pick from file://${path.join(outDir, "index.html")}`);
