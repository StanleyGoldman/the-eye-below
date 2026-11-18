// Writes the two documents that are made from the generation records:
//
//   docs/asset-review.md    every manifest id, its attempts, and the verdict
//   docs/final-report.md    time per job for each workflow, what was generated,
//                           what fell back, the audio nobody has heard, and the
//                           make targets to rebuild and regenerate
//
//   node scripts/report.ts            (what "make report" runs)
//   node scripts/report.ts --print    also print the final report
//
// The reviewer's remarks on single assets are in assets/review.json.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "./lib/args.ts";
import { probeAudio } from "./lib/audio-tools.ts";
import { GENERATION_LOG, WORKFLOW_FILES, readRecord } from "./lib/comfy-api.ts";
import { assetDir, extension, rawDir, readFallbacks, readManifest } from "./lib/manifest.ts";

const args = parseArgs(process.argv.slice(2));
if (args.flags["help"]) {
  console.log("usage: node scripts/report.ts [--print]");
  process.exit(0);
}

interface LogLine {
  at: string;
  id: string;
  kind: string;
  workflow: string;
  seconds: number;
  ok: boolean;
}

interface Review {
  byType: Record<string, string>;
  notes: Record<string, string>;
}

const manifest = readManifest();
const fallbacks = new Set(readFallbacks());
const review = JSON.parse(readFileSync("assets/review.json", "utf8")) as Review;
const log: LogLine[] = existsSync(GENERATION_LOG)
  ? readFileSync(GENERATION_LOG, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as LogLine)
  : [];

const TYPE_NAMES: Record<string, string> = { image: "Images", frame: "Animation frames", music: "Music", sfx: "Sound effects" };
const WORKFLOW_USE: Record<string, string> = {
  flux2: "Flux 2: textures, fixtures, panels",
  zimage: "Z-Image Turbo: icons, decals, small pieces",
  krea2: "Krea 2 with a style reference: monsters, people, portraits",
  qwen_edit: "Qwen Image Edit: animation frames from a base picture",
  birefnet: "BiRefNet: background removal",
  ace_step: "ACE-Step: music",
  stable_audio: "Stable Audio: sound effects",
};

function cell(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

// ---- docs/asset-review.md -----------------------------------------------

function assetReview(): string {
  const lines: string[] = [];
  lines.push("# Asset review");
  lines.push("");
  lines.push("Every asset in `assets/manifest.json`, with what was decided about it. Written by `scripts/report.ts` from the generation records in `raw/` and the reviewer's remarks in `assets/review.json`; run `make report` after any regeneration.");
  lines.push("");
  lines.push("The reviewer was the agent that built the game. Images and frames were looked at on contact sheets (`make sheet`, in `out/sheets/`) at the size the game shows them. Music and sound effects could not be listened to: they were only measured (length, level, how much is sound and how much padding), and every one is unverified by ear.");
  lines.push("");
  lines.push("An asset may be generated three times: the first attempt and two more. After three rejected attempts it becomes a recorded fallback, and the game uses its code-drawn art, or silence.");
  lines.push("");
  let rows = 0;
  for (const type of ["image", "frame", "music", "sfx"] as const) {
    const entries = manifest.assets.filter((a) => a.type === type);
    const regenerated = entries.filter((a) => readRecord(rawDir(a.type), a.id).attempts.length > 1).length;
    const fellBack = entries.filter((a) => fallbacks.has(a.id)).length;
    lines.push(`## ${TYPE_NAMES[type]}`);
    lines.push("");
    lines.push(`${entries.length} entries; ${regenerated} needed more than one attempt; ${fellBack} fell back.`);
    lines.push("");
    lines.push("| Asset | Workflow | Attempts | Verdict | Remarks |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const entry of entries) {
      const record = readRecord(rawDir(entry.type), entry.id);
      const verdict = record.fallback ? "fallback" : `kept attempt ${record.kept}`;
      const rejected = record.attempts.filter((a) => a.status === "rejected" && a.note);
      const reasons = [...new Set(rejected.map((a) => a.note))].map((note) => `Rejected: ${note}`);
      const remark = review.notes[entry.id] ?? review.byType[entry.type] ?? "";
      const fallbackNote = record.fallback && record.fallbackNote ? `Fallback: ${record.fallbackNote}` : "";
      lines.push(`| \`${entry.id}\` | ${entry.workflow} | ${record.attempts.length} | ${verdict} | ${cell([remark, ...reasons, fallbackNote].filter(Boolean).join(" "))} |`);
      rows++;
    }
    lines.push("");
  }
  lines.push(`${rows} rows for ${manifest.assets.length} manifest entries.`);
  lines.push("");
  return lines.join("\n");
}

// ---- docs/final-report.md -----------------------------------------------

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function finalReport(): string {
  const lines: string[] = [];
  lines.push("# Final report");
  lines.push("");
  lines.push("The Eye Below, v1.0 \"Full dark\". Written by `scripts/report.ts` from `raw/generation-log.jsonl` and the generation records; run `make report` to bring it up to date.");
  lines.push("");

  // 1. Time per job.
  lines.push("## Time per job, by workflow");
  lines.push("");
  lines.push("Wall-clock seconds from submitting a job to ComfyUI to having its output downloaded, on this machine. The first job of a workflow loads its models, so it is listed apart from the median.");
  lines.push("");
  lines.push("| Workflow | Used for | Jobs | First job (s) | Median (s) | Mean (s) | Fastest (s) | Slowest (s) | Total (min) |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  let allJobs = 0;
  let allSeconds = 0;
  for (const [name, file] of Object.entries(WORKFLOW_FILES)) {
    const jobs = log.filter((l) => l.workflow === file && l.ok);
    if (jobs.length === 0) {
      lines.push(`| \`${file}\` | ${WORKFLOW_USE[name] ?? name} | 0 | - | - | - | - | - | - |`);
      continue;
    }
    const seconds = jobs.map((j) => j.seconds);
    const total = seconds.reduce((a, b) => a + b, 0);
    allJobs += jobs.length;
    allSeconds += total;
    lines.push(`| \`${file}\` | ${WORKFLOW_USE[name] ?? name} | ${jobs.length} | ${(seconds[0] as number).toFixed(1)} | ${median(seconds).toFixed(1)} | ${(total / jobs.length).toFixed(1)} | ${Math.min(...seconds).toFixed(1)} | ${Math.max(...seconds).toFixed(1)} | ${(total / 60).toFixed(1)} |`);
  }
  const failed = log.filter((l) => !l.ok).length;
  lines.push("");
  lines.push(`${allJobs} successful jobs in all, ${(allSeconds / 60).toFixed(0)} minutes of generation; ${failed} failed jobs in the log. The counts include the first test job of each workflow, kept in \`raw/tests/\`.`);
  lines.push("");
  lines.push("What was asked of each workflow, from the manifest:");
  lines.push("");
  for (const [name, file] of Object.entries(WORKFLOW_FILES)) {
    const entries = manifest.assets.filter((a) => a.workflow === name);
    if (entries.length === 0) continue;
    const asked = new Map<string, number>();
    for (const e of entries) {
      const what = e.type === "music" || e.type === "sfx" ? `${e.duration ?? e.size[1]} s of audio` : `${(e.gen ?? e.size).join(" by ")} pixels`;
      asked.set(what, (asked.get(what) ?? 0) + 1);
    }
    lines.push(`- \`${file}\`: ${[...asked.entries()].map(([what, n]) => `${n} at ${what}`).join(", ")}.`);
  }
  lines.push("- `utility_birefnet_remove_background.json`: every transparent image and frame, at the size it was generated.");
  lines.push("");

  // 2. Assets generated.
  lines.push("## Assets generated");
  lines.push("");
  lines.push("| Type | Entries | Generated | Fell back | Attempts | Rejected attempts | Entries that needed more than one attempt |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  const totals = [0, 0, 0, 0, 0, 0];
  for (const type of ["image", "frame", "music", "sfx"] as const) {
    const entries = manifest.assets.filter((a) => a.type === type);
    const records = entries.map((a) => readRecord(rawDir(a.type), a.id));
    const fell = entries.filter((a) => fallbacks.has(a.id)).length;
    const attempts = records.reduce((n, r) => n + r.attempts.length, 0);
    const rejected = records.reduce((n, r) => n + r.attempts.filter((a) => a.status === "rejected").length, 0);
    const again = records.filter((r) => r.attempts.length > 1).length;
    const row = [entries.length, entries.length - fell, fell, attempts, rejected, again];
    row.forEach((v, i) => (totals[i] = (totals[i] as number) + v));
    lines.push(`| ${TYPE_NAMES[type]} | ${row.join(" | ")} |`);
  }
  lines.push(`| All | ${totals.join(" | ")} |`);
  const cutouts = manifest.assets.filter((a) => readRecord(rawDir(a.type), a.id).cutout).length;
  lines.push("");
  lines.push(`A rejected attempt is either one that was regenerated or the unchosen one of two candidates. ${cutouts} of the images and frames also went through background removal. Every image and frame was scaled down with nearest-neighbour sampling and mapped to the shared 64-colour palette; the frames of one animation share one crop box. Every audio file had its silence trimmed and its loudness set. The verdict on each asset is in \`docs/asset-review.md\`.`);
  lines.push("");

  // 3. Fallbacks.
  lines.push("## Assets that fell back");
  lines.push("");
  const fell = manifest.assets.filter((a) => fallbacks.has(a.id));
  if (fell.length === 0) {
    lines.push("None. No asset used up its three attempts, so nothing in the finished game is drawn by code or left silent for want of a generated file. The code-drawn art and the silent fallback are still there: `index.html?noassets=1` and `index.html?noaudio=1` play the game on them alone.");
  } else {
    lines.push("| Asset | Type | Why |");
    lines.push("| --- | --- | --- |");
    for (const a of fell) lines.push(`| \`${a.id}\` | ${a.type} | ${cell(readRecord(rawDir(a.type), a.id).fallbackNote)} |`);
  }
  lines.push("");

  // 4. Audio.
  lines.push("## Audio files unverified by ear");
  lines.push("");
  const audio = manifest.assets.filter((a) => (a.type === "music" || a.type === "sfx") && !fallbacks.has(a.id));
  lines.push(`All ${audio.length} of them. The agent that built the game cannot listen: each file was checked only by measurement (length within its limits, mean level above -45 dB, at least 0.2 s of sound once silence is trimmed). Whether a track suits its level, whether a loop's seam is audible, and whether an effect sounds like what its name says are all unchecked. Please listen to each before relying on it.`);
  lines.push("");
  lines.push("| File | Used for | Length (s) | Of which sound (s) | Mean level (dB) | Attempts |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const a of audio) {
    const file = path.join(assetDir(a.type), `${a.id}.${extension(a.type)}`);
    const record = readRecord(rawDir(a.type), a.id);
    const trim = (record.processing as { trim?: { secondsOfSound?: number } } | null)?.trim;
    const probe = existsSync(file) ? probeAudio(file) : null;
    lines.push(`| \`${file}\` | ${cell(a.prompt.subject)} | ${probe ? probe.seconds.toFixed(1) : "missing"} | ${trim?.secondsOfSound !== undefined ? trim.secondsOfSound.toFixed(2) : "-"} | ${probe ? probe.mean.toFixed(1) : "-"} | ${record.attempts.length} |`);
  }
  lines.push("");

  // 5. Make targets.
  lines.push("## Make targets to rebuild and regenerate");
  lines.push("");
  lines.push("Rebuilding the game needs Node and nothing else; regenerating assets needs the local ComfyUI.");
  lines.push("");
  lines.push("| Command | What it does |");
  lines.push("| --- | --- |");
  const targets: [string, string][] = [
    ["make build", "Bundle `src/` into `dist/game.js`. Then open `index.html`."],
    ["make check", "Typecheck, tests, build, and the headless browser smoke run."],
    ["make test", "The unit tests."],
    ["make sweep", "Generate 3300 levels across all modifiers and verify each is solvable."],
    ["make goal-check SESSION=3", "Every acceptance check of a session, one PASS or FAIL line each."],
    ["make assets", "Bring every asset up to date: generate what is missing or whose manifest entry changed, cut out, post-process. Starts ComfyUI if it has to. Does nothing when all is current."],
    ["make base / styled / frames / music / sfx", "Only that stage of generation."],
    ["make cutouts", "Background removal for whatever needs it."],
    ["make processed", "Post-processing only; needs no ComfyUI."],
    ["make sheet", "Contact sheets in `out/sheets/`, one per kind and one per animation."],
    ["make report", "Rewrite this file and `docs/asset-review.md` from the records."],
    ["make comfy-up / comfy-down / comfy-status", "Start, stop, or report on ComfyUI. Only an instance this build started is ever stopped."],
    ["make settle", "After a fresh clone: mark the committed raw files, cutouts, and assets up to date, in that order, so `make assets` does not regenerate them."],
    ["make clean", "Remove the bundle and the typecheck stamp. Never touches assets or `raw/`."],
    ["make clean-assets", "Remove the processed files in `assets/` and the contact sheets; `raw/` is kept, so `make processed` brings them back without generating anything."],
  ];
  for (const [command, what] of targets) lines.push(`| \`${command}\` | ${what} |`);
  lines.push("");
  lines.push("To regenerate one asset: change its prompt or seed in `assets/manifest.json` and run `make assets`, or run `node scripts/comfy.ts regen --id <asset> --note \"why\"` to reject the kept attempt and make another (at most two regenerations), then `make assets`. To give up on one: `node scripts/comfy.ts fallback --id <asset> --note \"why\"`.");
  lines.push("");
  return lines.join("\n");
}

writeFileSync("docs/asset-review.md", assetReview());
const report = finalReport();
writeFileSync("docs/final-report.md", report);
console.log(`report: docs/asset-review.md (${manifest.assets.length} assets), docs/final-report.md`);
if (args.flags["print"]) console.log(`\n${report}`);
