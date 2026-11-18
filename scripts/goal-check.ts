// Runs every acceptance check for a session and prints one PASS or FAIL
// line per check, then a summary line. The checks are the numbered ones
// in goals/session-N.md.
//
//   node scripts/goal-check.ts 1       (what "make goal-check SESSION=1" runs)

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";

interface Result {
  ok: boolean;
  note: string;
}

interface Check {
  name: string;
  run: () => Result;
}

function sh(command: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function lastLine(text: string): string {
  const lines = text.trim().split("\n");
  return (lines[lines.length - 1] ?? "").trim();
}

function command(command: string, args: string[], describe?: (out: string) => string): () => Result {
  return () => {
    const r = sh(command, args);
    return { ok: r.code === 0, note: r.code === 0 ? (describe ? describe(r.out) : lastLine(r.out)) : `exit ${r.code}: ${lastLine(r.out)}` };
  };
}

function testCount(minimum: number): () => Result {
  return () => {
    const r = sh("make", ["-s", "test"]);
    const pass = Number(/^ℹ pass (\d+)/m.exec(r.out)?.[1] ?? -1);
    const failCount = Number(/^ℹ fail (\d+)/m.exec(r.out)?.[1] ?? -1);
    return { ok: r.code === 0 && pass >= minimum && failCount === 0, note: `${pass} passed, ${failCount} failed (at least ${minimum} needed)` };
  };
}

function specials(): Result {
  const r = sh("node", ["scripts/play.ts", "--scenario", "specials", "--out", "out/goal"]);
  const files = ["05", "10", "15", "20", "25"].map((n) => `out/goal/special-${n}.png`);
  const present = files.filter((f) => existsSync(f) && statSync(f).size > 2000);
  return { ok: r.code === 0 && present.length === 5, note: `${present.length} of 5 screenshots saved; ${lastLine(r.out)}` };
}

const SOURCE_DIRS = ["src", "scripts"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else out.push(full);
  }
  return out;
}

function noStubs(): Result {
  // Built from pieces so this file does not match itself.
  const words = ["TO" + "DO", "FIX" + "ME", "X" + "XX", "coming " + "soon", "not " + "implemented"];
  const pattern = new RegExp(words.join("|"), "i");
  const hits: string[] = [];
  for (const file of [...SOURCE_DIRS.flatMap(sourceFiles), "index.html"]) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push(`${file}:${i + 1}`);
    });
  }
  return { ok: hits.length === 0, note: hits.length === 0 ? "no stub markers in src/, scripts/, index.html" : `found at ${hits.slice(0, 5).join(", ")}` };
}

function offline(): Result {
  if (!existsSync("dist/game.js")) return { ok: false, note: "dist/game.js is missing" };
  const html = readFileSync("index.html", "utf8");
  const bundle = readFileSync("dist/game.js", "utf8");
  const problems: string[] = [];
  if (!/<script src="dist\/game\.js"><\/script>/.test(html)) problems.push("index.html does not load dist/game.js with a classic script tag");
  for (const [name, text] of [["index.html", html], ["dist/game.js", bundle]] as const) {
    if (/https?:\/\//.test(text)) problems.push(`${name} contains a URL`);
    if (/\bfetch\(/.test(text)) problems.push(`${name} calls fetch`);
    if (/XMLHttpRequest/.test(text)) problems.push(`${name} uses XMLHttpRequest`);
    if (/\bimport\(/.test(text)) problems.push(`${name} has a dynamic import`);
  }
  return { ok: problems.length === 0, note: problems.length === 0 ? `classic script tag; no URLs or network calls in index.html or the ${Math.round(bundle.length / 1024)} kB bundle` : problems.join("; ") };
}

const ROOT_ALLOWED = new Set(["index.html", "src", "assets", "raw", ".claude", "workflows", "Makefile", "make", "scripts", "tests", "docs", "goals", "README.md", "PROMPT.md", "package.json", "package-lock.json", "tsconfig.json", ".gitignore"]);
const WORKFLOWS = ["audio_ace_step1_5_xl_turbo.json", "audio_stable_audio_3_medium.json", "image_flux2_text_to_image.json", "image_krea2_turbo_int8_image_style_reference.json", "image_qwen_image_edit_2511.json", "image_z_image_turbo.json", "utility_birefnet_remove_background.json"];

function layout(): Result {
  const tracked = sh("git", ["ls-files"]).out.trim().split("\n");
  const roots = [...new Set(tracked.map((f) => f.split("/")[0] as string))];
  const stray = roots.filter((r) => !ROOT_ALLOWED.has(r));
  const missing = WORKFLOWS.filter((w) => !tracked.includes(`workflows/${w}`));
  const ok = stray.length === 0 && missing.length === 0;
  return { ok, note: ok ? `7 workflow files in workflows/; ${roots.length} root entries, all in the layout` : `stray root entries: ${stray.join(", ") || "none"}; missing workflows: ${missing.join(", ") || "none"}` };
}

function docs(session: number): () => Result {
  return () => {
    const problems: string[] = [];
    const need = ["docs/creative-brief.md", "docs/decisions.md", `goals/handoff-${session}.md`];
    for (const f of need) if (!existsSync(f) || statSync(f).size < 200) problems.push(`${f} is missing or empty`);
    const readme = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
    if (!/^##+ What is in this version/m.test(readme)) problems.push('README.md has no "What is in this version" section');
    const scripts = readdirSync("scripts").filter((f) => f.endsWith(".ts"));
    const unlisted = scripts.filter((f) => !readme.includes(`scripts/${f}`));
    if (unlisted.length > 0) problems.push(`README.md does not name ${unlisted.join(", ")}`);
    return { ok: problems.length === 0, note: problems.length === 0 ? `brief, decisions, handoff present; README names all ${scripts.length} scripts` : problems.join("; ") };
  };
}

function gitClean(): Result {
  const out = sh("git", ["status", "--porcelain"]).out.trim();
  return { ok: out === "", note: out === "" ? "working tree clean" : `${out.split("\n").length} uncommitted change(s): ${out.split("\n").slice(0, 3).join("; ")}` };
}

function tagAtHead(session: number): () => Result {
  return () => {
    const head = sh("git", ["rev-parse", "HEAD"]).out.trim();
    const tag = sh("git", ["rev-parse", "-q", "--verify", `refs/tags/session-${session}^{commit}`]);
    const at = tag.out.trim();
    if (tag.code !== 0) return { ok: false, note: `tag session-${session} does not exist` };
    return { ok: at === head, note: at === head ? `session-${session} is ${head.slice(0, 7)}` : `session-${session} is ${at.slice(0, 7)}, HEAD is ${head.slice(0, 7)}` };
  };
}

const play = (scenario: string): (() => Result) => command("node", ["scripts/play.ts", "--scenario", scenario]);

const SESSIONS: Record<number, Check[]> = {
  1: [
    { name: "make check exits 0", run: command("make", ["-s", "check"]) },
    { name: "at least 60 tests pass, 0 fail", run: testCount(60) },
    { name: "make sweep prints unsolvable: 0", run: command("make", ["-s", "sweep"], (out) => `${/sweep: \d+ levels[^\n]*/.exec(out)?.[0] ?? ""}; ${lastLine(out)}`) },
    { name: "determinism across two processes", run: command("node", ["scripts/determinism.ts"], (out) => out.trim().split("\n").slice(0, 2).join("; ").replace(/determinism: /g, "")) },
    { name: "scripted run reaches the victory screen", run: play("victory") },
    { name: "scripted run reaches the death screen and restarts", run: play("death") },
    { name: "five special-level screenshots, no console errors", run: specials },
    { name: "content audit", run: command("node", ["scripts/audit.ts"]) },
    { name: "no stubs", run: noStubs },
    { name: "offline: no URLs or network calls", run: offline },
    { name: "repository layout", run: layout },
    { name: "docs and README", run: docs(1) },
    { name: "git status clean", run: gitClean },
    { name: "tag session-1 at HEAD", run: tagAtHead(1) },
  ],
};

const session = Number(process.argv[2] ?? 1);
const checks = SESSIONS[session];
if (!checks) {
  console.error(`error: no acceptance checks are defined for session ${process.argv[2] ?? ""}. Defined: ${Object.keys(SESSIONS).join(", ")}. Later sessions add theirs to this script from goals/session-N.md.`);
  process.exit(2);
}

console.log(`goal-check: session ${session}, ${checks.length} checks (goals/session-${session}.md)`);
let passed = 0;
checks.forEach((check, i) => {
  let result: Result;
  try {
    result = check.run();
  } catch (err) {
    result = { ok: false, note: `the check itself failed: ${(err as Error).message}` };
  }
  if (result.ok) passed++;
  console.log(`${result.ok ? "PASS" : "FAIL"} ${String(i + 1).padStart(2)}. ${check.name} - ${result.note}`);
});
console.log(`goal-check: session ${session}: ${passed} of ${checks.length} checks pass`);
process.exit(passed === checks.length ? 0 : 1);
