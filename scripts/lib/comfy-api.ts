// Talking to the local ComfyUI server: the seven workflows, job
// submission, polling, download, upload, and generation records.
// Only ever contacts 127.0.0.1:8188.

import { spawn } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const HOST = "http://127.0.0.1:8188";
const PID_FILE = "out/comfyui.pid";
const LOG_FILE = "out/comfyui.log";
export const GENERATION_LOG = "raw/generation-log.jsonl";

export type WorkflowKey = "flux2" | "zimage" | "krea2" | "qwen_edit" | "birefnet" | "ace_step" | "stable_audio";

export const WORKFLOW_FILES: Record<WorkflowKey, string> = {
  flux2: "image_flux2_text_to_image.json",
  zimage: "image_z_image_turbo.json",
  krea2: "image_krea2_turbo_int8_image_style_reference.json",
  qwen_edit: "image_qwen_image_edit_2511.json",
  birefnet: "utility_birefnet_remove_background.json",
  ace_step: "audio_ace_step1_5_xl_turbo.json",
  stable_audio: "audio_stable_audio_3_medium.json",
};

type Node = { class_type: string; inputs: Record<string, unknown> };
export type Workflow = Record<string, Node>;

// ---- the server ---------------------------------------------------------

export async function isUp(): Promise<boolean> {
  try {
    const r = await fetch(`${HOST}/system_stats`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

function ownedPid(): number | null {
  if (!existsSync(PID_FILE)) return null;
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

/** Start ComfyUI unless one is already answering. Returns a line saying what happened. */
export async function serverUp(): Promise<string> {
  if (await isUp()) return ownedPid() ? "ComfyUI is already up (started earlier by this build)" : "ComfyUI is already up (not started by this build; it will be left running)";
  mkdirSync("out", { recursive: true });
  const log = openSync(LOG_FILE, "a");
  const child = spawn(path.join(homedir(), "ai", "comfyui.sh"), [], { detached: true, stdio: ["ignore", log, log] });
  child.unref();
  closeSync(log);
  writeFileSync(PID_FILE, `${child.pid}\n`);
  const started = Date.now();
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isUp()) return `ComfyUI started (pid ${child.pid}) in ${Math.round((Date.now() - started) / 1000)} s; log in ${LOG_FILE}`;
  }
  let cause = "no Traceback in the log";
  if (existsSync(LOG_FILE)) {
    const lines = readFileSync(LOG_FILE, "utf8").split("\n");
    const at = lines.findIndex((l) => l.includes("Traceback"));
    if (at >= 0) cause = lines.slice(at, at + 12).join(" | ");
  }
  throw new Error(`ComfyUI did not answer within 90 s (${cause})`);
}

/** Stop the instance this build started. Never touches one it did not start. */
export async function serverDown(): Promise<string> {
  const pid = ownedPid();
  if (!pid) {
    if (existsSync(PID_FILE)) rmSync(PID_FILE);
    return (await isUp()) ? "ComfyUI is running but was not started by this build; left alone" : "no ComfyUI instance from this build is running";
  }
  try {
    // The launcher runs python in its own process group; stop the whole group.
    process.kill(-pid, "SIGTERM");
  } catch {
    process.kill(pid, "SIGTERM");
  }
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      process.kill(pid, 0);
    } catch {
      break;
    }
  }
  rmSync(PID_FILE, { force: true });
  return `stopped ComfyUI (pid ${pid})`;
}

export async function serverStatus(): Promise<{ up: boolean; owned: boolean; text: string }> {
  const up = await isUp();
  const pid = ownedPid();
  if (!up && !pid) return { up, owned: false, text: "ComfyUI is not running; no instance from this build is left running" };
  if (up && pid) return { up, owned: true, text: `ComfyUI is up, started by this build (pid ${pid})` };
  if (up) return { up, owned: false, text: "ComfyUI is up, not started by this build; no instance from this build is left running" };
  return { up, owned: true, text: `a ComfyUI process from this build exists (pid ${pid}) but is not answering yet` };
}

// ---- workflows ----------------------------------------------------------

export interface JobSpec {
  workflow: WorkflowKey;
  /** Prompt text: image description, edit instruction, music tags, or sound description. */
  prompt?: string;
  seed: number;
  width?: number;
  height?: number;
  /** Seconds, for audio. */
  duration?: number;
  bpm?: number;
  keyscale?: string;
  /** Uploaded name of the input or reference image. */
  inputName?: string;
  /** Use the 4-step Lightning LoRA for Qwen edit. */
  lightning?: boolean;
  filenamePrefix: string;
}

function node(w: Workflow, id: string): Node {
  const n = w[id];
  if (!n) throw new Error(`workflow has no node ${id}`);
  return n;
}

/** Load a workflow file and set its inputs for one job. Returns the workflow and the save node's id. */
export function prepare(spec: JobSpec): { workflow: Workflow; saveNode: string; summary: Record<string, unknown> } {
  const file = WORKFLOW_FILES[spec.workflow];
  const w = JSON.parse(readFileSync(path.join("workflows", file), "utf8")) as Workflow;
  const summary: Record<string, unknown> = {};
  let saveNode: string;
  switch (spec.workflow) {
    case "flux2":
      node(w, "98:6").inputs["text"] = spec.prompt;
      node(w, "98:25").inputs["noise_seed"] = spec.seed;
      for (const id of ["98:47", "98:48"]) {
        node(w, id).inputs["width"] = spec.width;
        node(w, id).inputs["height"] = spec.height;
      }
      // The export names three files that are not installed here.
      node(w, "98:10").inputs["vae_name"] = "flux2-vae.safetensors";
      node(w, "98:38").inputs["clip_name"] = "mistral_3_small_flux2_fp8.safetensors";
      node(w, "98:101").inputs["lora_name"] = "Flux2TurboComfyv2.safetensors";
      node(w, "98:104").inputs["value"] = true;
      saveNode = "9";
      summary["models"] = [node(w, "98:12").inputs["unet_name"], node(w, "98:38").inputs["clip_name"], node(w, "98:10").inputs["vae_name"]];
      summary["loras"] = [node(w, "98:101").inputs["lora_name"]];
      summary["steps"] = 8;
      break;
    case "zimage":
      node(w, "57:27").inputs["text"] = spec.prompt;
      node(w, "57:3").inputs["seed"] = spec.seed;
      node(w, "57:13").inputs["width"] = spec.width;
      node(w, "57:13").inputs["height"] = spec.height;
      saveNode = "9";
      summary["models"] = [node(w, "57:28").inputs["unet_name"], node(w, "57:30").inputs["clip_name"], node(w, "57:29").inputs["vae_name"]];
      summary["loras"] = [];
      summary["steps"] = node(w, "57:3").inputs["steps"];
      break;
    case "krea2":
      node(w, "69").inputs["image"] = spec.inputName;
      node(w, "30:19").inputs["value"] = spec.prompt;
      node(w, "30:24").inputs["value"] = false;
      node(w, "30:63").inputs["noise_seed"] = spec.seed;
      node(w, "71").inputs["aspect_ratio"] = "1:1 (Square)";
      node(w, "71").inputs["megapixels"] = 1;
      saveNode = "29";
      summary["models"] = [node(w, "30:10").inputs["unet_name"], node(w, "30:11").inputs["clip_name"], node(w, "30:12").inputs["vae_name"]];
      summary["loras"] = [node(w, "30:15").inputs["lora_name"]];
      summary["steps"] = node(w, "30:60").inputs["steps"];
      break;
    case "qwen_edit":
      node(w, "41").inputs["image"] = spec.inputName;
      // Single-image edit: drop the second reference image.
      delete node(w, "170:149").inputs["image2"];
      delete node(w, "170:151").inputs["image2"];
      delete w["83"];
      node(w, "170:151").inputs["prompt"] = spec.prompt;
      node(w, "170:169").inputs["seed"] = spec.seed;
      node(w, "170:168").inputs["value"] = spec.lightning !== false;
      saveNode = "9";
      summary["models"] = [node(w, "170:161").inputs["unet_name"], node(w, "170:162").inputs["clip_name"], node(w, "170:146").inputs["vae_name"]];
      summary["loras"] = spec.lightning !== false ? [node(w, "170:153").inputs["lora_name"]] : [];
      summary["steps"] = spec.lightning !== false ? 4 : 40;
      break;
    case "birefnet":
      node(w, "17").inputs["image"] = spec.inputName;
      saveNode = "18";
      summary["models"] = [node(w, "19:14").inputs["bg_removal_name"]];
      summary["loras"] = [];
      summary["steps"] = 1;
      break;
    case "ace_step":
      node(w, "94").inputs["tags"] = spec.prompt;
      node(w, "94").inputs["lyrics"] = "[Instrumental]";
      node(w, "94").inputs["bpm"] = spec.bpm ?? 90;
      node(w, "94").inputs["keyscale"] = spec.keyscale ?? "D minor";
      node(w, "94").inputs["timesignature"] = "4";
      node(w, "94").inputs["duration"] = spec.duration;
      node(w, "94").inputs["generate_audio_codes"] = true;
      node(w, "98").inputs["seconds"] = spec.duration;
      node(w, "109").inputs["value"] = spec.seed;
      saveNode = "111";
      summary["models"] = [node(w, "104").inputs["unet_name"], node(w, "105").inputs["clip_name1"], node(w, "105").inputs["clip_name2"], node(w, "106").inputs["vae_name"]];
      summary["loras"] = [];
      summary["steps"] = node(w, "3").inputs["steps"];
      break;
    case "stable_audio":
      node(w, "52:31").inputs["value"] = spec.prompt;
      node(w, "52:36").inputs["value"] = spec.duration;
      node(w, "52:43").inputs["choice"] = "SFX";
      node(w, "52:43").inputs["index"] = 2;
      node(w, "52:35").inputs["value"] = true;
      node(w, "52:3").inputs["seed"] = spec.seed;
      saveNode = "57";
      summary["models"] = [node(w, "52:25").inputs["ckpt_name"], node(w, "52:26").inputs["clip_name"], node(w, "52:29").inputs["clip_name"]];
      summary["loras"] = [];
      summary["steps"] = node(w, "52:3").inputs["steps"];
      break;
  }
  node(w, saveNode).inputs["filename_prefix"] = spec.filenamePrefix;
  return { workflow: w, saveNode, summary };
}

// ---- jobs ---------------------------------------------------------------

export async function upload(file: string, asName: string): Promise<string> {
  const form = new FormData();
  form.append("image", new Blob([readFileSync(file)]), asName);
  form.append("overwrite", "true");
  const r = await fetch(`${HOST}/upload/image`, { method: "POST", body: form });
  if (!r.ok) throw new Error(`upload of ${file} failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()) as { name: string; subfolder?: string };
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

interface PromptError {
  error?: { type?: string; message?: string };
  node_errors?: Record<string, { errors?: { type?: string; message?: string; details?: string; extra_info?: { input_name?: string; input_config?: unknown[]; received_value?: unknown } }[] }>;
}

function closest(wanted: string, options: string[]): string | null {
  const key = (s: string): string[] => s.toLowerCase().replace(/\.[a-z]+$/, "").split(/[^a-z0-9]+/).filter(Boolean);
  const want = new Set(key(wanted));
  let best: string | null = null;
  let bestScore = 0;
  for (const o of options) {
    let score = 0;
    for (const part of key(o)) if (want.has(part)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = o;
    }
  }
  return best;
}

/** Submit a workflow. If a model name is not installed, substitute the closest installed one and retry. */
async function submit(workflow: Workflow, substitutions: string[]): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(`${HOST}/prompt`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: workflow }) });
    const text = await r.text();
    if (r.ok) return (JSON.parse(text) as { prompt_id: string }).prompt_id;
    let data: PromptError;
    try {
      data = JSON.parse(text) as PromptError;
    } catch {
      throw new Error(`/prompt answered ${r.status}: ${text.slice(0, 300)}`);
    }
    let fixed = 0;
    for (const [id, info] of Object.entries(data.node_errors ?? {})) {
      for (const e of info.errors ?? []) {
        if (e.type !== "value_not_in_list") continue;
        const name = e.extra_info?.input_name;
        const config = e.extra_info?.input_config;
        const list = Array.isArray(config) && Array.isArray(config[0]) ? (config[0] as string[]) : [];
        const target = workflow[id];
        if (!name || !target || list.length === 0) continue;
        const pick = closest(String(e.extra_info?.received_value ?? ""), list);
        if (!pick) continue;
        substitutions.push(`${id}.${name}: ${String(e.extra_info?.received_value)} -> ${pick}`);
        target.inputs[name] = pick;
        fixed++;
      }
    }
    if (fixed === 0) throw new Error(`/prompt rejected the workflow: ${text.slice(0, 600)}`);
  }
  throw new Error("/prompt kept rejecting the workflow after substituting model names");
}

interface HistoryEntry {
  status?: { status_str?: string; completed?: boolean; messages?: unknown[] };
  outputs?: Record<string, Record<string, { filename: string; subfolder: string; type: string }[]>>;
}

async function waitFor(promptId: string, timeoutMs: number): Promise<HistoryEntry> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 700));
    let r: Response;
    try {
      r = await fetch(`${HOST}/history/${promptId}`);
    } catch {
      throw new Error("lost contact with ComfyUI while waiting (connection refused). Start it again and rerun; finished assets are skipped.");
    }
    const data = (await r.json()) as Record<string, HistoryEntry>;
    const entry = data[promptId];
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error(`the job failed inside ComfyUI: ${JSON.stringify(entry.status.messages).slice(0, 600)}`);
    return entry;
  }
  throw new Error(`the job did not finish within ${Math.round(timeoutMs / 1000)} s`);
}

export interface JobResult {
  promptId: string;
  outputFilename: string;
  started: string;
  seconds: number;
  workflowFile: string;
  workflow: Workflow;
  summary: Record<string, unknown>;
  substitutions: string[];
}

/** Run one job and save its output to a file, atomically. */
export async function runJob(spec: JobSpec, outFile: string, timeoutMs = 600000): Promise<JobResult> {
  const { workflow, saveNode, summary } = prepare(spec);
  const substitutions: string[] = [];
  const started = new Date();
  const promptId = await submit(workflow, substitutions);
  const entry = await waitFor(promptId, timeoutMs);
  const outputs = entry.outputs?.[saveNode] ?? {};
  const files = outputs["images"] ?? outputs["audio"] ?? Object.values(outputs)[0] ?? [];
  const first = files[0];
  if (!first) throw new Error(`the job finished but node ${saveNode} saved nothing: ${JSON.stringify(entry.outputs).slice(0, 300)}`);
  const url = `${HOST}/view?filename=${encodeURIComponent(first.filename)}&subfolder=${encodeURIComponent(first.subfolder)}&type=${encodeURIComponent(first.type)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  mkdirSync(path.dirname(outFile), { recursive: true });
  const tmp = `${outFile}.part`;
  writeFileSync(tmp, bytes);
  renameSync(tmp, outFile);
  const seconds = Math.round((Date.now() - started.getTime()) / 100) / 10;
  return { promptId, outputFilename: first.filename, started: started.toISOString(), seconds, workflowFile: WORKFLOW_FILES[spec.workflow], workflow, summary, substitutions };
}

// ---- records ------------------------------------------------------------

export interface Attempt {
  n: number;
  status: "kept" | "rejected" | "candidate";
  note: string;
  workflowFile: string;
  prompt: string;
  seed: number;
  models: unknown;
  loras: unknown;
  steps: unknown;
  size: string;
  input: string;
  promptId: string;
  comfyOutput: string;
  file: string;
  started: string;
  seconds: number;
  substitutions: string[];
  /** The workflow exactly as submitted. */
  workflow: Workflow;
}

export interface JobRecord {
  n?: number;
  workflowFile: string;
  input: string;
  promptId: string;
  comfyOutput: string;
  file: string;
  started: string;
  seconds: number;
  workflow: Workflow;
}

export interface AssetRecord {
  id: string;
  kept: number;
  fallback: boolean;
  fallbackNote: string;
  attempts: Attempt[];
  cutout: JobRecord | null;
  processing: Record<string, unknown> | null;
}

export function recordPath(dir: string, id: string): string {
  return path.join(dir, `${id}.json`);
}

export function readRecord(dir: string, id: string): AssetRecord {
  const file = recordPath(dir, id);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as AssetRecord;
  return { id, kept: 0, fallback: false, fallbackNote: "", attempts: [], cutout: null, processing: null };
}

export function writeRecord(dir: string, record: AssetRecord): void {
  mkdirSync(dir, { recursive: true });
  const file = recordPath(dir, record.id);
  const tmp = `${file}.part`;
  writeFileSync(tmp, `${JSON.stringify(record, null, 1)}\n`);
  renameSync(tmp, file);
}

/** One line per job in the running history. */
export function logJob(line: Record<string, unknown>): void {
  mkdirSync(path.dirname(GENERATION_LOG), { recursive: true });
  appendFileSync(GENERATION_LOG, `${JSON.stringify(line)}\n`);
}
