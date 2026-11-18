// The ComfyUI toolbox. Everything that talks to the local server goes
// through here, and every job leaves a generation record.
//
// Server:
//   node scripts/comfy.ts up | down | status
//
// One command per workflow (free-standing jobs; record written beside the output):
//   node scripts/comfy.ts image  --prompt "..." --seed 1 --size 1024x1024 --out raw/tests/a.png     (Flux 2 turbo)
//   node scripts/comfy.ts fast   --prompt "..." --seed 1 --size 1024x1024 --out raw/tests/b.png     (Z-Image turbo)
//   node scripts/comfy.ts style  --prompt "..." --seed 1 --input ref.png --out raw/tests/c.png      (Krea-2 style reference)
//   node scripts/comfy.ts edit   --prompt "..." --seed 1 --input base.png --out raw/tests/d.png     (Qwen edit)
//   node scripts/comfy.ts cutout --input sprite.png --out raw/tests/e.png                           (BiRefNet)
//   node scripts/comfy.ts music  --prompt "tags" --seed 1 --duration 60 --out raw/tests/f.mp3       (ACE-Step)
//   node scripts/comfy.ts sfx    --prompt "..." --seed 1 --duration 2 --out raw/tests/g.mp3         (Stable Audio)
//
// Manifest assets (what the Makefile calls):
//   node scripts/comfy.ts gen --id monster_newt          generate, or do nothing if already kept
//   node scripts/comfy.ts cut --id monster_newt          background removal of the kept raw image
//   node scripts/comfy.ts keep --id X --attempt 2 --note "why the others were rejected"
//   node scripts/comfy.ts regen --id X --note "why the kept one is rejected"
//   node scripts/comfy.ts fallback --id X --note "why"   give up after three attempts; the game uses code-drawn art

import { copyFileSync, existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, parseArgs } from "./lib/args.ts";
import { isUp, logJob, readRecord, runJob, serverDown, serverStatus, serverUp, upload, writeRecord } from "./lib/comfy-api.ts";
import type { Attempt, JobSpec, WorkflowKey } from "./lib/comfy-api.ts";
import { FALLBACKS_FILE, entryOf, extension, rawDir, readFallbacks, readManifest, readPrompts, requestKey, resolvePrompt, writeManifest } from "./lib/manifest.ts";
import type { ManifestEntry } from "./lib/manifest.ts";

const MAX_ATTEMPTS = 3;
const args = parseArgs(process.argv.slice(2));
const command = args.rest[0] ?? "";

const DIRECT: Record<string, WorkflowKey> = { image: "flux2", fast: "zimage", style: "krea2", edit: "qwen_edit", cutout: "birefnet", music: "ace_step", sfx: "stable_audio" };

function need(name: string): string {
  const v = args.flags[name];
  if (!v || v === "true") fail(`--${name} is required for "${command}"`);
  return v;
}

function parseSize(text: string | undefined, fallback: [number, number]): [number, number] {
  if (!text) return fallback;
  const m = /^(\d+)x(\d+)$/.exec(text);
  if (!m) fail(`--size must look like 1024x1024, not "${text}"`);
  return [Number(m[1]), Number(m[2])];
}

/** Jobs need the server. Start it if it is down, so an interrupted batch resumes by itself. */
async function requireServer(): Promise<void> {
  if (await isUp()) return;
  console.log(await serverUp());
}

function copyAtomic(from: string, to: string): void {
  const tmp = `${to}.part`;
  copyFileSync(from, tmp);
  renameSync(tmp, to);
}

/** A single free-standing job with its record beside the output. */
async function direct(workflow: WorkflowKey): Promise<void> {
  await requireServer();
  const out = need("out");
  const [w, h] = parseSize(args.flags["size"], [1024, 1024]);
  const spec: JobSpec = { workflow, seed: Number(args.flags["seed"] ?? 1), width: w, height: h, filenamePrefix: `crawler/test_${path.basename(out).replace(/\.[a-z0-9]+$/, "")}` };
  if (workflow !== "birefnet") spec.prompt = need("prompt");
  if (workflow === "krea2" || workflow === "qwen_edit" || workflow === "birefnet") {
    const input = need("input");
    spec.inputName = await upload(input, `eye_${path.basename(input)}`);
  }
  if (workflow === "ace_step" || workflow === "stable_audio") spec.duration = Number(need("duration"));
  if (args.flags["bpm"]) spec.bpm = Number(args.flags["bpm"]);
  if (args.flags["key"]) spec.keyscale = args.flags["key"];
  if (args.flags["slow"]) spec.lightning = false;
  const result = await runJob(spec, out);
  const record = {
    id: path.basename(out),
    workflowFile: result.workflowFile,
    prompt: spec.prompt ?? "",
    seed: spec.seed,
    ...result.summary,
    size: spec.duration ? `${spec.duration} s` : `${w}x${h}`,
    input: args.flags["input"] ?? "",
    promptId: result.promptId,
    comfyOutput: result.outputFilename,
    file: out,
    started: result.started,
    seconds: result.seconds,
    substitutions: result.substitutions,
    note: args.flags["note"] ?? "",
    workflow: result.workflow,
  };
  writeFileSync(`${out}.json`, `${JSON.stringify(record, null, 1)}\n`);
  logJob({ at: result.started, id: record.id, kind: "test", workflow: result.workflowFile, seed: spec.seed, seconds: result.seconds, promptId: result.promptId, file: out, ok: true });
  for (const s of result.substitutions) console.log(`  substituted ${s}`);
  console.log(`${command}: ${out} in ${result.seconds} s (${result.workflowFile}, seed ${spec.seed}); record ${out}.json`);
}

function attemptFile(entry: ManifestEntry, n: number): string {
  return path.join(rawDir(entry.type), `${entry.id}.a${n}.${extension(entry.type)}`);
}

function keptFile(entry: ManifestEntry): string {
  return path.join(rawDir(entry.type), `${entry.id}.${extension(entry.type)}`);
}

async function runAttempt(entry: ManifestEntry, n: number, seed: number, status: Attempt["status"], note: string): Promise<Attempt> {
  const prompts = readPrompts();
  const workflow = entry.workflow as WorkflowKey;
  const [w, h] = entry.gen ?? [1024, 1024];
  const prompt = resolvePrompt(prompts, entry);
  const spec: JobSpec = { workflow, prompt, seed, width: w, height: h, filenamePrefix: `crawler/${entry.id}_a${n}` };
  let input = "";
  if (entry.reference) {
    const manifest = readManifest();
    const ref = entryOf(manifest, entry.reference);
    input = keptFile(ref);
    if (!existsSync(input)) fail(`${entry.id} needs ${input} as its reference, and that has not been generated yet`);
    spec.inputName = await upload(input, `eye_${ref.id}.png`);
  }
  if (entry.type === "music" || entry.type === "sfx") spec.duration = entry.size[1];
  if (entry.bpm) spec.bpm = entry.bpm;
  if (entry.keyscale) spec.keyscale = entry.keyscale;
  const file = attemptFile(entry, n);
  const result = await runJob(spec, file);
  logJob({ at: result.started, id: entry.id, kind: entry.type, attempt: n, workflow: result.workflowFile, seed, seconds: result.seconds, promptId: result.promptId, file, ok: true });
  for (const s of result.substitutions) console.log(`  substituted ${s}`);
  console.log(`  ${entry.id} attempt ${n}: ${result.seconds} s (${result.workflowFile}, seed ${seed})`);
  return {
    n,
    status,
    note,
    workflowFile: result.workflowFile,
    prompt,
    seed,
    models: result.summary["models"],
    loras: result.summary["loras"],
    steps: result.summary["steps"],
    size: entry.type === "image" || entry.type === "frame" ? `${w}x${h}` : `${entry.size[1]} s`,
    input,
    promptId: result.promptId,
    comfyOutput: result.outputFilename,
    file,
    started: result.started,
    seconds: result.seconds,
    substitutions: result.substitutions,
    workflow: result.workflow,
    ...({ requestKey: requestKey(prompts, entry) } as object),
  } as Attempt;
}

function keyOfAttempt(a: Attempt): string {
  return (a as Attempt & { requestKey?: string }).requestKey ?? "";
}

/** Record the kept attempt's seed in the manifest, where the brief wants it. */
function recordSeed(id: string, seed: number): void {
  const manifest = readManifest();
  const entry = entryOf(manifest, id);
  if (entry.seed === seed) return;
  entry.seed = seed;
  writeManifest(manifest);
}

async function gen(): Promise<void> {
  const id = need("id");
  const manifest = readManifest();
  const entry = entryOf(manifest, id);
  const dir = rawDir(entry.type);
  const record = readRecord(dir, id);
  const out = keptFile(entry);
  const key = requestKey(readPrompts(), entry);
  const kept = record.attempts.find((a) => a.n === record.kept);

  if (record.fallback) {
    console.log(`gen: ${id} is a recorded fallback (${record.fallbackNote}); nothing to generate`);
    return;
  }
  if (kept && keyOfAttempt(kept) === key && existsSync(kept.file)) {
    copyAtomic(kept.file, out);
    console.log(`gen: ${id} already generated (attempt ${kept.n} kept); nothing to do`);
    return;
  }
  await requireServer();
  if (record.attempts.length >= MAX_ATTEMPTS) fail(`${id} has used its ${MAX_ATTEMPTS} attempts. Mark it a fallback: node scripts/comfy.ts fallback --id ${id} --note "..."`);
  if (kept) {
    kept.status = "rejected";
    kept.note = kept.note || "the manifest entry changed";
  }
  const first = record.attempts.length + 1;
  const count = Math.min(kept ? 1 : (entry.candidates ?? 1), MAX_ATTEMPTS - record.attempts.length);
  for (let i = 0; i < count; i++) {
    const n = first + i;
    const seed = n === 1 ? entry.seed : entry.seed + 7919 * (n - 1);
    record.attempts.push(await runAttempt(entry, n, seed, i === 0 ? "kept" : "candidate", i === 0 ? "" : "second candidate; awaiting review"));
    writeRecord(dir, record);
  }
  record.kept = first;
  writeRecord(dir, record);
  copyAtomic(attemptFile(entry, first), out);
  recordSeed(id, record.attempts.find((a) => a.n === first)!.seed);
  console.log(`gen: ${id} -> ${out} (attempt ${first}${count > 1 ? `, ${count} candidates to review` : ""})`);
}

async function cut(): Promise<void> {
  const id = need("id");
  const entry = entryOf(readManifest(), id);
  const dir = rawDir(entry.type);
  const record = readRecord(dir, id);
  if (record.fallback) {
    console.log(`cut: ${id} is a recorded fallback; nothing to cut`);
    return;
  }
  await requireServer();
  const input = keptFile(entry);
  const out = path.join(dir, `${id}.cut.png`);
  const inputName = await upload(input, `eye_${id}.png`);
  const result = await runJob({ workflow: "birefnet", seed: 0, inputName, filenamePrefix: `crawler/${id}_cut` }, out);
  record.cutout = { workflowFile: result.workflowFile, input, promptId: result.promptId, comfyOutput: result.outputFilename, file: out, started: result.started, seconds: result.seconds, workflow: result.workflow };
  writeRecord(dir, record);
  logJob({ at: result.started, id, kind: "cutout", workflow: result.workflowFile, seed: 0, seconds: result.seconds, promptId: result.promptId, file: out, ok: true });
  console.log(`cut: ${id} -> ${out} in ${result.seconds} s`);
}

function keep(): void {
  const id = need("id");
  const n = Number(need("attempt"));
  const note = need("note");
  const entry = entryOf(readManifest(), id);
  const dir = rawDir(entry.type);
  const record = readRecord(dir, id);
  const chosen = record.attempts.find((a) => a.n === n);
  if (!chosen) fail(`${id} has no attempt ${n} (it has ${record.attempts.length})`);
  for (const a of record.attempts) {
    if (a.n === n) {
      a.status = "kept";
      a.note = "";
    } else if (a.status !== "rejected") {
      a.status = "rejected";
      a.note = note;
    }
  }
  const changed = record.kept !== n;
  record.kept = n;
  writeRecord(dir, record);
  if (changed || !existsSync(keptFile(entry))) copyAtomic(chosen.file, keptFile(entry));
  recordSeed(id, chosen.seed);
  console.log(`keep: ${id} attempt ${n} kept${changed ? " (was a different attempt; downstream files will be rebuilt)" : ""}; others rejected: ${note}`);
}

async function regen(): Promise<void> {
  const id = need("id");
  const note = need("note");
  await requireServer();
  const entry = entryOf(readManifest(), id);
  const dir = rawDir(entry.type);
  const record = readRecord(dir, id);
  if (record.attempts.length >= MAX_ATTEMPTS) fail(`${id} has used its ${MAX_ATTEMPTS} attempts (2 regenerations). Mark it a fallback instead.`);
  for (const a of record.attempts) {
    if (a.status !== "rejected") {
      a.status = "rejected";
      a.note = note;
    }
  }
  const n = record.attempts.length + 1;
  const attempt = await runAttempt(entry, n, entry.seed + 7919 * (n - 1) + (n === 1 ? 0 : 0), "kept", "");
  record.attempts.push(attempt);
  record.kept = n;
  writeRecord(dir, record);
  copyAtomic(attempt.file, keptFile(entry));
  recordSeed(id, attempt.seed);
  console.log(`regen: ${id} attempt ${n} is now kept; earlier attempts rejected: ${note}`);
}

function fallback(): void {
  const id = need("id");
  const note = need("note");
  const entry = entryOf(readManifest(), id);
  const dir = rawDir(entry.type);
  const record = readRecord(dir, id);
  for (const a of record.attempts) {
    if (a.status !== "rejected") {
      a.status = "rejected";
      a.note = note;
    }
  }
  record.kept = 0;
  record.fallback = true;
  record.fallbackNote = note;
  writeRecord(dir, record);
  const list = new Set(readFallbacks());
  list.add(id);
  mkdirSync(path.dirname(FALLBACKS_FILE), { recursive: true });
  writeFileSync(FALLBACKS_FILE, `${JSON.stringify({ fallbacks: [...list].sort() }, null, 1)}\n`);
  console.log(`fallback: ${id} will use its code-drawn art (${note}); listed in ${FALLBACKS_FILE}`);
}

try {
  if (command === "up") console.log(await serverUp());
  else if (command === "down") console.log(await serverDown());
  else if (command === "status") console.log((await serverStatus()).text);
  else if (DIRECT[command]) await direct(DIRECT[command] as WorkflowKey);
  else if (command === "gen") await gen();
  else if (command === "cut") await cut();
  else if (command === "keep") keep();
  else if (command === "regen") await regen();
  else if (command === "fallback") fallback();
  else {
    console.log("usage: node scripts/comfy.ts up|down|status");
    console.log("       node scripts/comfy.ts image|fast|style|edit|cutout|music|sfx --prompt ... --seed n [--size WxH | --duration s] [--input file] --out file");
    console.log("       node scripts/comfy.ts gen|cut --id asset");
    console.log('       node scripts/comfy.ts keep --id asset --attempt n --note "..." | regen --id asset --note "..." | fallback --id asset --note "..."');
    process.exit(command === "" || args.flags["help"] ? 0 : 1);
  }
} catch (err) {
  fail((err as Error).message);
}
