// Drives the built game in a headless browser, takes screenshots, and
// fails on any console error. One script, several scenarios:
//
//   node scripts/play.ts --scenario smoke      title, new game, walk, fight, open a door
//   node scripts/play.ts --scenario victory    a whole run to the victory screen (unkillable debug option)
//   node scripts/play.ts --scenario death      a run to the death screen, then restart
//   node scripts/play.ts --scenario specials   one screenshot from inside each special level
//   node scripts/play.ts --scenario keys --seed candle --level 3 --keys "KeyW,KeyW,KeyQ,Space"
//
// Options: --seed text, --role valkyrie|wizard|rogue, --mods id=1-9,..., --level 1-25,
// --keys "Code,Code,...", --out folder, --god (unkillable), --headed (show the browser).
// Screenshots go to out/shots/<scenario>/ unless --out says otherwise.

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
import type { Browser, Page } from "playwright-core";
import { encodeRunCode } from "../src/core/modifiers.ts";
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
  log: string[];
  errors: string[];
}

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log('usage: node scripts/play.ts --scenario smoke|victory|death|specials|keys [--seed text] [--role name] [--mods id=n,...] [--level n] [--keys "Code,..."] [--out dir] [--god] [--headed]');
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

const SCENARIOS: Record<string, (b: Browser) => Promise<void>> = { smoke, victory, death, specials, keys };
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
