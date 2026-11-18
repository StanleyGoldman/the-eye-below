// Drives the built game in a headless browser, takes screenshots, and
// fails on any console error. One script, several scenarios:
//
//   node scripts/play.ts --scenario smoke      title, new game, walk, fight, open a door
//   node scripts/play.ts --scenario victory    a whole run to the victory screen (unkillable debug option)
//   node scripts/play.ts --scenario death      a run to the death screen, then restart
//   node scripts/play.ts --scenario specials   one screenshot from inside each special level
//   node scripts/play.ts --scenario economy    buy, sell, hear a rumor, pay a priest
//   node scripts/play.ts --scenario assets     generated images all load; the game also runs with none
//   node scripts/play.ts --scenario treasure   chests by key and by force, a gem, the vault guard, the grave of the last character to die
//   node scripts/play.ts --scenario audio      silence before the first input, music by tier and for the boss, mute, saved volumes, and a run with no audio
//   node scripts/play.ts --scenario keys --seed candle --level 3 --keys "KeyW,KeyW,KeyQ,Space"
//
// Options: --seed text, --role valkyrie|wizard|rogue, --mods id=1-9,..., --level 1-25,
// --keys "Code,Code,...", --out folder, --god (unkillable), --headed (show the browser).
// Screenshots go to out/shots/<scenario>/ unless --out says otherwise.

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { encodeRunCode, resolveMods } from "../src/core/modifiers.ts";
import { generateLevel } from "../src/dungeon/generate.ts";
import { fail, parseArgs, parseOverrides } from "./lib/args.ts";

interface Info {
  screen: string;
  depth: number;
  special: string;
  hp: number;
  dead: boolean;
  won: boolean;
  cause: string;
  steps: number;
  kills: number;
  doorsOpened: number;
  time: number;
  seed: string;
  god: boolean;
  mapOpen: boolean;
  prompt: string;
  spellsOpen: boolean;
  selected: number | null;
  inventory: number;
  gold: number;
  name: string;
  chestKeys: number;
  gems: number;
  chestsOpened: number;
  chestsLocked: number;
  inVault: boolean;
  guards: number;
  log: string[];
  errors: string[];
}

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log('usage: node scripts/play.ts --scenario smoke|victory|death|specials|economy|assets|treasure|audio|keys [--seed text] [--role name] [--mods id=n,...] [--level n] [--keys "Code,..."] [--out dir] [--god] [--headed]');
  process.exit(0);
}
const scenario = args.flags["scenario"] ?? "smoke";
const outDir = path.resolve(args.flags["out"] ?? `out/shots/${scenario}`);
const indexUrl = `file://${path.resolve("index.html")}`;
const problems: string[] = [];
let shots = 0;

function check(ok: boolean, what: string): void {
  if (ok) console.log(`  ok: ${what}`);
  else {
    console.log(`  FAILED: ${what}`);
    problems.push(what);
  }
}

async function info(page: Page): Promise<Info> {
  return (await page.evaluate("window.__eye.info()")) as Info;
}

async function shot(page: Page, name: string): Promise<string> {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  shots++;
  return file;
}

async function waitFor(page: Page, what: string, test: (i: Info) => boolean, timeoutMs = 15000): Promise<Info> {
  const start = Date.now();
  let last = await info(page);
  while (!test(last)) {
    if (Date.now() - start > timeoutMs) {
      check(false, `timed out waiting for ${what} (screen ${last.screen}, depth ${last.depth}, log: ${last.log.join(" / ")})`);
      return last;
    }
    await page.waitForTimeout(100);
    last = await info(page);
  }
  return last;
}

async function open(browser: Browser, query: string): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console error: ${msg.text()}`);
  });
  page.on("pageerror", (err) => problems.push(`page error: ${err.message}`));
  await page.goto(`${indexUrl}?debug=1${query}`);
  await page.waitForFunction("typeof window.__eye === 'object'", undefined, { timeout: 10000 });
  await page.evaluate("document.fonts.ready");
  return page;
}

async function press(page: Page, code: string, waitMs = 320): Promise<void> {
  await page.keyboard.press(code);
  await page.waitForTimeout(waitMs);
}

/** From the title screen to a running game, through the real new-game form. */
async function newGameThroughUi(page: Page, options: { seed?: string; code?: string; role: string; god: boolean }): Promise<void> {
  await page.click('[data-act="new"]');
  if (options.code) {
    await page.fill('[data-field="code"]', options.code);
    await page.click('[data-act="applycode"]');
  } else if (options.seed) {
    await page.fill('[data-field="seed"]', options.seed);
  }
  await page.click(`[data-role="${options.role}"]`);
  if (options.god) await page.check('[data-field="god"]');
}

async function smoke(browser: Browser): Promise<void> {
  const page = await open(browser, "");
  check((await page.textContent(".gametitle")) === "The Eye Below", "title screen shows the game's name");
  await shot(page, "01-title");

  // Unkillable, so the autopilot stretch below cannot end early; nothing here depends on surviving fairly.
  await newGameThroughUi(page, { seed: args.flags["seed"] ?? "smoke7", role: args.flags["role"] ?? "valkyrie", god: true });
  // Override one modifier, see it marked, and reset it.
  const slider = page.locator('[data-mod="traps"] .slider');
  const before = await slider.inputValue();
  await slider.focus();
  await page.keyboard.press(before === "9" ? "ArrowLeft" : "ArrowRight");
  check((await page.textContent('[data-mod="traps"] .modmark')) !== "", "an overridden modifier is marked");
  const code = (await page.getAttribute(".codeshow", "data-code")) ?? "";
  check(/^EB1\.smoke7\.tr\d$/.test(code), `the run code carries the override (${code})`);
  await shot(page, "02-newgame");
  await page.click('[data-mod="traps"] .tiny');
  check((await page.textContent('[data-mod="traps"] .modmark')) === "", "reset returns a modifier to the seed's value");
  await page.click('[data-act="begin"]');
  let i = await waitFor(page, "the game to start", (x) => x.screen === "game");
  check(i.depth === 1 && i.hp > 0, "a run starts on level 1, alive");
  await page.waitForTimeout(500);
  await shot(page, "03-start");

  // Real key presses: turn all the way round, try every step direction.
  for (let k = 0; k < 4; k++) await press(page, "KeyE", 220);
  for (const code of ["KeyW", "KeyS", "KeyA", "KeyD", "KeyQ", "KeyW", "KeyW"]) await press(page, code);
  i = await info(page);
  check(i.steps >= 1, `walking with the keyboard moves the player (${i.steps} steps)`);
  await shot(page, "04-walked");

  // Inventory by letter, the item menu, and a tooltip.
  await press(page, "KeyI", 150);
  await page.keyboard.press("a");
  await page.waitForTimeout(150);
  check((await info(page)).selected !== null, "I then a letter opens that item's actions");
  await shot(page, "05-item-menu");
  await press(page, "Escape", 150);
  await page.hover(".slot");
  await page.waitForTimeout(150);
  check(await page.isVisible(".tooltip"), "hovering an item shows a tooltip");
  await shot(page, "06-tooltip");
  await page.mouse.move(300, 300);

  // Map, spell list, pause menu.
  await press(page, "KeyM", 250);
  check((await info(page)).mapOpen, "M opens the map");
  await shot(page, "07-map");
  await press(page, "KeyM", 150);
  await press(page, "KeyC", 150);
  check((await info(page)).spellsOpen, "C opens the spell list");
  await press(page, "Escape", 150);
  await press(page, "Escape", 200);
  check((await info(page)).screen === "pause", "Esc opens the pause menu");
  check(((await page.textContent('[data-info="seed"]')) ?? "") === "smoke7", "the pause menu shows the seed");
  await shot(page, "08-pause");
  await page.click('[data-act="settings"]');
  await page.click('[data-bind="rest:1"]');
  await page.keyboard.press("KeyZ");
  check(((await page.textContent('[data-bind="rest:1"]')) ?? "") === "Z", "a key can be rebound");
  await shot(page, "09-settings");
  await page.click('[data-act="defaults"]');
  await page.click('[data-act="back"]');
  await page.click('[data-act="resume"]');
  check((await info(page)).screen === "game", "resume returns to the game");
  await page.click('[data-action="turnLeft"]');
  await page.waitForTimeout(250);

  // Let the autopilot walk, fight, and open a door inside the normal frame loop.
  await page.evaluate("window.__eye.speed(8); window.__eye.auto('win')");
  let frames = 0;
  const started = Date.now();
  i = await info(page);
  while ((i.kills < 1 || i.doorsOpened < 1 || i.steps < 30) && !i.dead && Date.now() - started < 90000) {
    await page.waitForTimeout(700);
    if (frames < 6) await shot(page, `10-play-${frames + 1}`);
    frames++;
    i = await info(page);
  }
  await page.evaluate("window.__eye.auto(null); window.__eye.speed(1)");
  check(i.steps >= 30, `walked (${i.steps} steps)`);
  check(i.kills >= 1, `fought (${i.kills} kills)`);
  check(i.doorsOpened >= 1, `opened a door (${i.doorsOpened})`);
  await page.waitForTimeout(300);
  await shot(page, "11-after-play");

  // Save, leave, and come back.
  const saved = await info(page);
  await press(page, "Escape", 200);
  if ((await info(page)).screen !== "pause") await press(page, "Escape", 200);
  await page.click('[data-act="quit"]');
  check(await page.isVisible('[data-act="continue"]'), "after quitting, the title screen offers to continue");
  await page.click('[data-act="continue"]');
  const after = await waitFor(page, "the saved game to load", (x) => x.screen === "game");
  check(after.depth === saved.depth && after.steps === saved.steps && after.kills === saved.kills && after.hp === saved.hp, `the saved run comes back as it was (level ${after.depth}, ${after.steps} steps)`);
  await page.waitForTimeout(300);
  await shot(page, "12-continued");
  check((await info(page)).errors.length === 0, "no errors were caught in the frame loop");
  await page.context().close();

  // Questions the game asks: talking to a peaceful character, and thinking twice about attacking one.
  const court = await open(browser, "&start=1&god=1&seed=goal-1&level=5");
  await waitFor(court, "level 5", (x) => x.screen === "game" && x.depth === 5);
  check((await court.evaluate("window.__eye.vantage(1)")) === true, "stood next to the oracle");
  await court.waitForTimeout(300);
  await press(court, "KeyF", 250);
  check((await info(court)).prompt === "oracle" && (await court.isVisible(".modal")), "using the oracle opens a question");
  await shot(court, "13-oracle");
  await press(court, "Digit3", 200);
  check((await info(court)).prompt === "", "a number key answers it");
  await press(court, "Space", 250);
  check((await info(court)).prompt === "attackPeaceful", "attacking a peaceful character asks first");
  await shot(court, "14-really-attack");
  await press(court, "Escape", 200);
  check((await info(court)).prompt === "", "Esc backs out of it");
  check((await info(court)).errors.length === 0, "no errors on the oracle's level");
  await court.context().close();
}

async function victory(browser: Browser): Promise<void> {
  const seed = args.flags["seed"] ?? "goal-1";
  const page = await open(browser, "");
  await newGameThroughUi(page, { seed, role: args.flags["role"] ?? "valkyrie", god: true });
  await page.click('[data-act="begin"]');
  let i = await waitFor(page, "the game to start", (x) => x.screen === "game");
  check(i.god, "the unkillable debug option is on for this run");
  await shot(page, "01-start");
  const budgetMs = 12 * 3600 * 1000;
  let lastDepth = 0;
  while (!i.won && !i.dead && i.time < budgetMs) {
    await page.evaluate("window.__eye.runBot('win', 60000)");
    i = await info(page);
    if (i.depth !== lastDepth && i.depth % 5 === 0) {
      lastDepth = i.depth;
      await page.waitForTimeout(120);
      await shot(page, `02-level-${String(i.depth).padStart(2, "0")}`);
    }
  }
  check(i.won, `the bot took the Eye (level ${i.depth}, ${Math.round(i.time / 60000)} game minutes, ${i.kills} kills)`);
  i = await waitFor(page, "the victory screen", (x) => x.screen === "won");
  check(await page.isVisible(".wonpage"), "the victory screen is showing");
  const code = ((await page.textContent('[data-info="code"]')) ?? "").trim();
  check(code === encodeRunCode(seed, {}), `the victory screen shows the run code (${code})`);
  check(Number((await page.textContent('[data-info="score"]')) ?? "0") > 25000, "the victory screen shows a score");
  await shot(page, "03-victory");
  check(i.errors.length === 0, "no errors were caught in the frame loop");
  await page.context().close();
}

async function death(browser: Browser): Promise<void> {
  const page = await open(browser, "");
  // Entered as a run code, which also exercises pasting a shared run.
  const code = "EB1.goal1.mc9mt9";
  await newGameThroughUi(page, { code, role: args.flags["role"] ?? "wizard", god: false });
  check((await page.inputValue('[data-field="seed"]')) === "goal1", "a pasted run code sets the seed");
  check((await page.inputValue('[data-mod="monsterToughness"] .slider')) === "9", "a pasted run code sets its overrides");
  await page.click('[data-act="begin"]');
  let i = await waitFor(page, "the game to start", (x) => x.screen === "game");
  check(!i.god, "this run is not invulnerable");
  while (!i.dead && !i.won && i.time < 3600 * 1000) {
    await page.evaluate("window.__eye.runBot('die', 20000)");
    i = await info(page);
  }
  check(i.dead, `the character died (${i.cause})`);
  i = await waitFor(page, "the death screen", (x) => x.screen === "dead");
  check(await page.isVisible(".tombstone"), "the tombstone is showing");
  check(((await page.textContent(".tombcause")) ?? "").length > 5, "the tombstone gives the cause of death");
  check(((await page.textContent('[data-info="code"]')) ?? "").trim() === code, "the death screen shows the run code");
  await shot(page, "01-tombstone");
  await page.click('[data-act="again"]');
  i = await waitFor(page, "the restarted game", (x) => x.screen === "game" && !x.dead);
  check(i.depth === 1 && i.hp > 0 && i.seed === "goal1" && i.steps === 0, "restarting with the same seed puts a fresh character on level 1");
  await page.waitForTimeout(400);
  await shot(page, "02-restarted");
  check(i.errors.length === 0, "no errors were caught in the frame loop");
  await page.context().close();
}

const SPECIALS: readonly [number, string][] = [
  [5, "oracle"],
  [10, "stoneyard"],
  [15, "gorgon"],
  [20, "keep"],
  [25, "tower"],
];

async function specials(browser: Browser): Promise<void> {
  const seed = args.flags["seed"] ?? "goal-1";
  for (const [depth, id] of SPECIALS) {
    const page = await open(browser, `&start=1&god=1&seed=${encodeURIComponent(seed)}&level=${depth}`);
    const i = await waitFor(page, `level ${depth}`, (x) => x.screen === "game" && x.depth === depth);
    check(i.special === id, `level ${depth} is the ${id} level`);
    await page.waitForTimeout(400);
    await shot(page, `special-${String(depth).padStart(2, "0")}-arrival`);
    // Stand in front of what the level is known for, so the shot shows more than the stairs.
    check((await page.evaluate("window.__eye.vantage()")) === true, `found a place to stand on level ${depth}`);
    await page.waitForTimeout(350);
    const file = await shot(page, `special-${String(depth).padStart(2, "0")}`);
    check((await stat(file)).size > 2000, `screenshot saved: ${path.relative(process.cwd(), file)}`);
    await press(page, "KeyM", 250);
    await shot(page, `special-${String(depth).padStart(2, "0")}-map`);
    check((await info(page)).errors.length === 0, `no errors on level ${depth}`);
    await page.context().close();
  }
}

async function keys(browser: Browser): Promise<void> {
  const seed = args.flags["seed"] ?? "candle";
  const overrides = parseOverrides(args.flags["mods"]);
  const role = args.flags["role"] ?? "valkyrie";
  const level = args.flags["level"] ?? "1";
  const code = encodeRunCode(seed, overrides);
  const page = await open(browser, `&start=1&code=${encodeURIComponent(code)}&role=${role}&level=${level}${args.flags["god"] ? "&god=1" : ""}`);
  await waitFor(page, "the game to start", (x) => x.screen === "game");
  await page.waitForTimeout(400);
  await shot(page, "000-start");
  const list = (args.flags["keys"] ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  let n = 1;
  for (const key of list) {
    await press(page, key, 350);
    await shot(page, `${String(n).padStart(3, "0")}-${key}`);
    n++;
  }
  const i = await info(page);
  console.log(`  level ${i.depth}, hp ${i.hp}, steps ${i.steps}, kills ${i.kills}`);
  console.log(`  log: ${i.log.join(" / ")}`);
  check(i.errors.length === 0, "no errors were caught in the frame loop");
  await page.context().close();
}

/** A level, found by generating, that has a shop, a priest, and someone with rumors. */
function findMarket(): { seed: string; depth: number; code: string } {
  const overrides = { shopFrequency: 9, npcs: 9, fountains: 9 };
  for (let i = 0; i < 300; i++) {
    const seed = `market${i}`;
    const mods = resolveMods(seed, overrides);
    for (let depth = 1; depth <= 4; depth++) {
      const level = generateLevel({ seed, mods }, depth);
      const kinds = new Set(level.monsters.map((m) => m.npc?.kind));
      if (kinds.has("shopkeeper") && kinds.has("priest") && (kinds.has("hermit") || kinds.has("adventurer") || kinds.has("gnome"))) return { seed, depth, code: encodeRunCode(seed, overrides) };
    }
  }
  fail("no level with a shop, a priest, and a rumor-monger was found");
}

async function economy(browser: Browser): Promise<void> {
  const market = findMarket();
  console.log(`  using run code ${market.code}, level ${market.depth}`);
  const page = await open(browser, `&start=1&god=1&code=${encodeURIComponent(market.code)}&level=${market.depth}`);
  await waitFor(page, "the game to start", (x) => x.screen === "game" && x.depth === market.depth);
  await page.evaluate("window.__eye.gold(5000)");
  const eye = (expr: string): Promise<unknown> => page.evaluate(`window.__eye.${expr}`);
  const gold = async (): Promise<number> => ((await info(page)) as Info & { gold: number }).gold;

  // The shop.
  check((await eye("vantage(1, 'shopkeeper')")) === true, "stood next to the shopkeeper");
  await page.waitForTimeout(300);
  await press(page, "KeyF", 300);
  check((await info(page)).prompt === "shop" && (await page.isVisible(".shop")), "talking to the shopkeeper opens the buy and sell panel");
  const t0 = (await info(page)).time;
  await page.waitForTimeout(700);
  check((await info(page)).time === t0, "the world clock is paused while the panel is open");
  await shot(page, "01-shop");
  const buyRow = page.locator("[data-shop-buy]:not(.dim)").first();
  const buyPrice = Number(await buyRow.getAttribute("data-price"));
  const before = await gold();
  await buyRow.click();
  await page.waitForTimeout(150);
  check((await gold()) === before - buyPrice && buyPrice > 0, `buying takes the quoted price (${buyPrice} gold)`);
  const sellRow = page.locator('[data-shop-sell]:not([data-price=""])').first();
  check((await sellRow.count()) > 0, "something in the pack can be sold here");
  const sellPrice = Number(await sellRow.getAttribute("data-price"));
  const mid = await gold();
  await sellRow.click();
  await page.waitForTimeout(150);
  check((await gold()) === mid + sellPrice && sellPrice > 0, `selling pays the quoted price (${sellPrice} gold)`);
  await shot(page, "02-shop-after");
  await press(page, "Escape", 200);
  check((await info(page)).prompt === "", "Esc leaves the shop");
  const t1 = (await info(page)).time;
  await page.waitForTimeout(400);
  check((await info(page)).time > t1, "the clock runs again outside the shop");

  // A rumor.
  let talker = "";
  for (const kind of ["hermit", "adventurer", "gnome"]) {
    if ((await eye(`vantage(1, '${kind}')`)) === true) {
      talker = kind;
      break;
    }
  }
  check(talker !== "", `stood next to someone with rumors (${talker})`);
  await page.waitForTimeout(300);
  await press(page, "KeyF", 300);
  check((await info(page)).prompt === "talk" && (await page.isVisible(".modal.dialogue")), "talking opens the dialogue panel");
  const said = (await page.textContent(".modal .modaltitle")) ?? "";
  check(said.length > 20, `a rumor is told (${said.slice(0, 60)}...)`);
  await shot(page, "03-rumor");
  await press(page, "Digit1", 250);
  const again = (await page.textContent(".modal .modaltitle")) ?? "";
  check(again.length > 20 && again !== said, "asking again gets a different rumor");
  await press(page, "Escape", 200);

  // A priest.
  check((await eye("vantage(1, 'priest')")) === true, "stood next to the priest");
  await page.waitForTimeout(300);
  await press(page, "KeyF", 300);
  const atPriest = await info(page);
  check(atPriest.prompt === "priest", `talking to the priest offers a donation (prompt "${atPriest.prompt}", log: ${atPriest.log.slice(-2).join(" / ")})`);
  await shot(page, "04-priest");
  const purse = await gold();
  await page.click('[data-option="large"]');
  await page.waitForTimeout(200);
  const after = (await info(page)) as Info & { gold: number; protection: number };
  check(after.protection === 1 && after.gold < purse, `a large donation buys protection (${purse - after.gold} gold)`);
  check(after.errors.length === 0, "no errors were caught in the frame loop");
  await page.context().close();
}

interface AssetReport {
  expected: number;
  loaded: number;
  failed: string[];
}

async function assets(browser: Browser): Promise<void> {
  // First pass: every generated image must load.
  const page = await open(browser, "&start=1&god=1&seed=goal-1&level=1");
  await waitFor(page, "the game to start", (x) => x.screen === "game");
  const report = (await page.evaluate("window.__eye.assets()")) as AssetReport;
  check(report.expected >= 90, `the manifest lists ${report.expected} generated images to load`);
  check(report.failed.length === 0 && report.loaded === report.expected, `${report.loaded} of ${report.expected} images loaded, ${report.failed.length} failed${report.failed.length ? ` (${report.failed.slice(0, 6).join(", ")})` : ""}`);
  await page.waitForTimeout(400);
  await shot(page, "01-generated-art");
  await page.evaluate("window.__eye.vantage()");
  await page.waitForTimeout(300);
  await shot(page, "02-generated-art-monster");
  check((await info(page)).errors.length === 0, "no errors with generated art");
  await page.context().close();

  // Second pass: no files at all. The game must run the same on its code-drawn art.
  const bare = await open(browser, "&noassets=1&start=1&god=1&seed=goal-1&level=1");
  await waitFor(bare, "the game to start without assets", (x) => x.screen === "game");
  const none = (await bare.evaluate("window.__eye.assets()")) as AssetReport;
  check(none.loaded === 0, "with asset loading disabled, nothing is loaded");
  for (const code of ["KeyE", "KeyW", "KeyW", "KeyM", "KeyM", "KeyI", "Escape"]) await press(bare, code, 200);
  await bare.evaluate("window.__eye.speed(8); window.__eye.auto('win')");
  let i = await info(bare);
  const started = Date.now();
  while ((i.kills < 1 || i.steps < 30) && Date.now() - started < 60000) {
    await bare.waitForTimeout(500);
    i = await info(bare);
  }
  await bare.evaluate("window.__eye.auto(null); window.__eye.speed(1)");
  check(i.steps >= 30 && i.kills >= 1, `on code-drawn art alone the run still walks and fights (${i.steps} steps, ${i.kills} kills)`);
  await bare.waitForTimeout(300);
  await shot(bare, "03-code-drawn-art");
  check((await info(bare)).errors.length === 0, "no errors on code-drawn art");
  await bare.context().close();
}

/** A fixed level that has everything the treasure run needs: two locked chests, a chest key, a loose gem, and a vault with gold in it. */
function findHoard(): { seed: string; depth: number; code: string } {
  const overrides = { gold: 9, monsterCount: 1 };
  for (let i = 0; i < 4000; i++) {
    const seed = `hoard${i}`;
    const mods = resolveMods(seed, overrides);
    for (let depth = 1; depth <= 4; depth++) {
      const level = generateLevel({ seed, mods }, depth);
      const vault = level.meta.vault;
      if (!vault) continue;
      const locked = level.features.filter((f) => f.kind === "chest" && f.locked).length;
      const keys = level.items.filter((fi) => fi.item.type === "chest_key").length;
      const gems = level.items.filter((fi) => fi.item.type.startsWith("gem_") || fi.item.type.startsWith("glass_")).length;
      const vaultGold = level.items.filter((fi) => fi.item.type === "gold" && vault.cells.includes(fi.y * level.w + fi.x)).length;
      if (locked >= 2 && keys >= 1 && gems >= 1 && vaultGold >= 3) return { seed, depth, code: encodeRunCode(seed, overrides) };
    }
  }
  fail("no level with two locked chests, a chest key, a gem, and a vault was found");
}

async function treasure(browser: Browser): Promise<void> {
  const hoard = findHoard();
  console.log(`  using run code ${hoard.code}, level ${hoard.depth}`);
  const page = await open(browser, `&start=1&god=1&code=${encodeURIComponent(hoard.code)}&level=${hoard.depth}`);
  await waitFor(page, "the game to start", (x) => x.screen === "game" && x.depth === hoard.depth);
  const eye = (expr: string): Promise<unknown> => page.evaluate(`window.__eye.${expr}`);

  // A chest, opened with its key.
  check((await eye("goto('chest_key')")) === true, "stood on the cell where a chest key lies");
  await press(page, "KeyG", 250);
  check((await info(page)).chestKeys === 1, "picked up the chest key");
  check((await eye("vantage(1, 'chest_locked')")) === true, "stood facing a locked chest");
  await page.waitForTimeout(300);
  await shot(page, "01-locked-chest");
  await press(page, "KeyF", 300);
  let i = await info(page);
  check(i.prompt === "chest", "using a locked chest asks how to open it");
  const lockedBefore = i.chestsLocked;
  await page.click('[data-option="key"]');
  await page.waitForTimeout(250);
  i = await info(page);
  check(i.chestsOpened === 1 && i.chestKeys === 0 && i.chestsLocked === lockedBefore - 1, "the key opens the chest and is used up");
  await shot(page, "02-chest-open");
  await press(page, "KeyG", 250);
  check((await info(page)).inventory > 1, "what spilled out can be picked up");

  // A second chest, forced.
  check((await eye("vantage(1, 'chest_locked')")) === true, "stood facing another locked chest");
  let tries = 0;
  while (tries < 40 && (await info(page)).chestsOpened < 2) {
    tries++;
    await press(page, "KeyF", 150);
    if ((await info(page)).prompt !== "chest") continue;
    if (tries === 1) check(!(await page.isVisible('[data-option="key"]')), "with no key left, the key option is not offered");
    await page.click('[data-option="force"]');
    await page.waitForTimeout(150);
  }
  check((await info(page)).chestsOpened === 2, `forced the second chest open (${tries} ${tries === 1 ? "try" : "tries"})`);

  // A gem. (Wrenching at a lid keeps the hands busy for a moment.)
  await page.waitForTimeout(1100);
  const gemsBefore = (await info(page)).gems;
  check((await eye("goto('gem')")) === true, "stood on a cell with a gem");
  await press(page, "KeyG", 250);
  i = await info(page);
  check(i.gems > gemsBefore, `picked up a gem (${i.log[i.log.length - 1] ?? ""})`);

  // The vault, and its guard.
  check((await eye("goto('vault')")) === true, "stood inside the vault");
  const purse = (await info(page)).gold;
  for (const code of ["KeyW", "KeyE", "KeyW", "KeyE", "KeyW", "KeyE", "KeyW", "KeyE", "KeyW"]) await press(page, code, 220);
  i = await info(page);
  check(i.inVault && i.gold > purse, `walked the vault and picked up its gold (${i.gold - purse} gold)`);
  await shot(page, "03-vault");
  await eye("speed(4)");
  i = await waitFor(page, "the vault guard", (x) => x.prompt === "guard", 20000);
  await eye("speed(1)");
  check(i.guards === 1, "a guard has come into the vault and asks who you are");
  await page.waitForTimeout(300);
  await shot(page, "04-guard");
  const paused = (await info(page)).time;
  await page.waitForTimeout(500);
  check((await info(page)).time === paused, "the world waits for the answer");
  await page.click('[data-option="truth"]');
  await page.waitForTimeout(300);
  i = await info(page);
  check(i.gold === purse && !i.inVault && i.guards === 0, "telling the truth costs the vault's gold and an escort out");
  check(i.errors.length === 0, "no errors were caught in the frame loop");

  // A death, saved, and the grave it leaves for the next character.
  await page.goto(`${indexUrl}?debug=1`);
  await page.waitForFunction("typeof window.__eye === 'object'", undefined, { timeout: 10000 });
  await newGameThroughUi(page, { code: "EB1.goal1.mc9mt9", role: "wizard", god: false });
  await page.click('[data-act="begin"]');
  i = await waitFor(page, "the mortal run to start", (x) => x.screen === "game");
  const fallen = i.name;
  check((await eye("vantage(1, 'grave_fallen')")) === false, "no fresh grave before anyone has died");
  while (!i.dead && !i.won && i.time < 3600 * 1000) {
    await page.evaluate("window.__eye.runBot('die', 20000)");
    i = await info(page);
  }
  const fellAt = i.depth;
  check(i.dead && fallen.length > 0, `${fallen} died on level ${fellAt} (${i.cause})`);
  await waitFor(page, "the death screen", (x) => x.screen === "dead");
  await page.click('[data-act="again"]');
  i = await waitFor(page, "the next run", (x) => x.screen === "game" && !x.dead);
  check(i.depth === fellAt, "the next character starts on the level where the last one fell");
  check((await eye("vantage(1, 'grave_fallen')")) === true, "the next run has a fresh grave on that level");
  await page.waitForTimeout(300);
  await shot(page, "05-grave");
  await press(page, "KeyF", 300);
  i = await info(page);
  check(i.log.some((line) => line.includes(`Here lies ${fallen}`)), `the stone names the dead character (${i.log[i.log.length - 1] ?? ""})`);
  check(i.errors.length === 0, "no errors were caught in the frame loop");
  await page.context().close();
}

interface AudioReport {
  enabled: boolean;
  unlocked: boolean;
  music: string;
  musicPlaying: boolean;
  musicTime: number;
  musicVolume: number;
  effectsVolume: number;
  loudestElement: number;
  muted: boolean;
  playing: number;
  effectsPlayed: number;
  lastEffect: string;
  failed: string[];
}

async function audio(browser: Browser): Promise<void> {
  const page = await open(browser, "");
  const report = async (p: Page = page): Promise<AudioReport> => (await p.evaluate("window.__eye.audio()")) as AudioReport;
  /** Wait until the wanted track is the one named and its clock is moving. */
  const playing = async (p: Page, track: string): Promise<AudioReport> => {
    let r = await report(p);
    for (let n = 0; n < 50 && !(r.music === track && r.musicPlaying && r.musicTime > 0.1); n++) {
      await p.waitForTimeout(100);
      r = await report(p);
    }
    return r;
  };
  // Start from known settings, whatever an earlier run left behind.
  await page.evaluate("localStorage.removeItem('eye-below.audio.v1')");
  await page.reload();
  await page.waitForFunction("typeof window.__eye === 'object'", undefined, { timeout: 10000 });

  // Nothing before the first input.
  await page.waitForTimeout(900);
  let r = await report();
  check(r.enabled && !r.unlocked && r.playing === 0 && !r.musicPlaying, `before any input no audio element is playing (${r.playing} playing)`);

  // The first click starts the title music.
  await page.click('[data-act="new"]');
  r = await playing(page, "music_title");
  check(r.unlocked && r.music === "music_title" && r.musicPlaying && r.musicTime > 0.1, `after the first input the title music plays (${r.musicTime.toFixed(2)} s in)`);
  await page.click('[data-role="valkyrie"]');
  await page.check('[data-field="god"]');
  await page.fill('[data-field="seed"]', "goal-1");
  await page.click('[data-act="begin"]');
  await waitFor(page, "the game to start", (x) => x.screen === "game");
  r = await playing(page, "music_tier1");
  const t0 = r.musicTime;
  await page.waitForTimeout(500);
  const t1 = (await report()).musicTime;
  check(r.music === "music_tier1" && r.musicPlaying && t1 > t0, `on level 1 the first tier's track is playing (${t0.toFixed(2)} s, then ${t1.toFixed(2)} s)`);
  check(r.failed.length === 0, `no audio file failed to load (${r.failed.join(", ") || "none"})`);

  // Effects.
  for (const code of ["KeyW", "KeyW", "KeyE", "KeyW", "KeyW", "KeyQ", "KeyW"]) await press(page, code, 260);
  r = await report();
  check(r.effectsPlayed > 0 && r.lastEffect.startsWith("sfx_"), `walking plays sound effects (${r.effectsPlayed} so far, last ${r.lastEffect})`);
  check(r.loudestElement > 0, "music and effects are audible before muting");

  // The mute key.
  await press(page, "KeyN", 250);
  r = await report();
  check(r.muted && r.musicVolume === 0 && r.effectsVolume === 0 && r.loudestElement === 0, "the mute key silences both music and effects");
  await press(page, "KeyW", 260);
  check((await report()).loudestElement === 0, "an effect played while muted is silent too");
  await shot(page, "01-muted");
  await press(page, "KeyN", 250);
  r = await report();
  check(!r.muted && r.musicVolume > 0 && r.effectsVolume > 0 && r.loudestElement > 0, "pressing it again brings both back");

  // Volumes, set in the settings menu, survive a reload.
  await press(page, "Escape", 250);
  await page.click('[data-act="settings"]');
  await page.waitForTimeout(200);
  const slide = async (field: string, value: number): Promise<void> => {
    await page.evaluate(`(() => { const el = document.querySelector('input[data-field="${field}"]'); el.value = "${value}"; el.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  };
  await slide("music", 30);
  await slide("effects", 45);
  await page.waitForTimeout(150);
  r = await report();
  check(Math.abs(r.musicVolume - 0.3) < 0.001 && Math.abs(r.effectsVolume - 0.45) < 0.001, "the settings menu has separate sliders for music and effects");
  await shot(page, "02-volume-settings");
  await page.reload();
  await page.waitForFunction("typeof window.__eye === 'object'", undefined, { timeout: 10000 });
  await page.waitForTimeout(500);
  r = await report();
  check(Math.abs(r.musicVolume - 0.3) < 0.001 && Math.abs(r.effectsVolume - 0.45) < 0.001, `the volumes survive a reload (music ${r.musicVolume}, effects ${r.effectsVolume})`);
  check(!r.unlocked && r.playing === 0, "and after the reload it is silent again until the next input");
  await page.evaluate("localStorage.removeItem('eye-below.audio.v1')");
  await page.context().close();

  // A boss level has its own track.
  const boss = await open(browser, "&start=1&god=1&seed=goal-1&level=15");
  await waitFor(boss, "the boss level", (x) => x.screen === "game" && x.depth === 15);
  check((await report(boss)).playing === 0, "arriving by link is silent until an input");
  await press(boss, "KeyQ", 300);
  r = await playing(boss, "music_boss");
  check(r.music === "music_boss" && r.musicPlaying, `with the level's boss alive the boss track plays (${r.music})`);
  await boss.context().close();
  const deep = await open(browser, "&start=1&god=1&seed=goal-1&level=14");
  await waitFor(deep, "level 14", (x) => x.screen === "game" && x.depth === 14);
  await press(deep, "KeyQ", 300);
  r = await playing(deep, "music_tier3");
  check(r.music === "music_tier3" && r.musicPlaying, `one level up it is the third tier's track (${r.music})`);
  await deep.context().close();

  // With audio off altogether the game still runs to the end.
  const quiet = await open(browser, "&noaudio=1");
  await newGameThroughUi(quiet, { seed: "goal-1", role: "valkyrie", god: true });
  await quiet.click('[data-act="begin"]');
  let i = await waitFor(quiet, "the silent run to start", (x) => x.screen === "game");
  for (const code of ["KeyW", "KeyN", "KeyN", "KeyW"]) await press(quiet, code, 200);
  while (!i.won && !i.dead && i.time < 12 * 3600 * 1000) {
    await quiet.evaluate("window.__eye.runBot('win', 60000)");
    i = await info(quiet);
  }
  i = await waitFor(quiet, "the victory screen", (x) => x.screen === "won");
  r = await report(quiet);
  check(i.won && !r.enabled && r.playing === 0 && !r.musicPlaying, `with audio disabled the run still reaches the victory screen (level ${i.depth}, nothing playing)`);
  check(i.errors.length === 0, "no errors were caught in the frame loop");
  await quiet.context().close();
}

const SCENARIOS: Record<string, (b: Browser) => Promise<void>> = { smoke, victory, death, specials, keys, economy, assets, treasure, audio };
const runScenario = SCENARIOS[scenario];
if (!runScenario) fail(`unknown scenario "${scenario}". Known: ${Object.keys(SCENARIOS).join(", ")}`);

try {
  await stat("dist/game.js");
} catch {
  fail('dist/game.js is missing. Run "make build" first.');
}
await mkdir(outDir, { recursive: true });

let browser: Browser;
try {
  browser = await chromium.launch({ channel: "chrome", headless: args.flags["headed"] !== "true" });
} catch (err) {
  fail(`could not start Google Chrome through Playwright: ${(err as Error).message.split("\n")[0]}`);
}
console.log(`play: scenario ${scenario}`);
const startedAt = Date.now();
try {
  await runScenario(browser);
} catch (err) {
  problems.push(`the script itself failed: ${(err as Error).message.split("\n")[0]}`);
} finally {
  await browser.close();
}
const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
if (problems.length > 0) {
  console.log(`play: ${scenario} FAILED in ${seconds} s with ${problems.length} problem(s), ${shots} screenshot(s) in ${path.relative(process.cwd(), outDir)}/`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log(`play: ${scenario} passed in ${seconds} s, ${shots} screenshot(s) in ${path.relative(process.cwd(), outDir)}/`);
