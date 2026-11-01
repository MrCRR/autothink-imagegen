#!/usr/bin/env node
// Rebuild the two CJK font subsets so every character in the project has a glyph.
//
//   node setup-fonts.mjs [project-dir] [--text "额外字符"] [--text-file <path>] [--full]
//
// Noto Sans SC  → deck slides, subtitles (variable, clamped to 400-900)
// ZCOOL KuaiLe  → whiteboard handwriting
// The source files are downloaded once into ~/.cache/meitou-explainer.

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(os.homedir(), ".cache", "meitou-explainer");

const SOURCES = [
  { key: "NotoSansSC", file: "NotoSansSC-VF.woff2", source: "NotoSansSC-VF.ttf", clamp: true,
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf" },
  { key: "ZCOOLKuaiLe", file: "ZCOOLKuaiLe.woff2", source: "ZCOOLKuaiLe-Regular.ttf", clamp: false,
    url: "https://raw.githubusercontent.com/google/fonts/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf" },
];

const EXTRA_SYMBOLS = "≠±×÷²³µ°→↑↓←≈㎡℃‰∞√∑·—…“”‘’《》【】（）％";

function parseArgs(argv) {
  const opts = { dir: ".", text: "", textFile: "", full: false, download: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--text") opts.text += argv[++i] ?? "";
    else if (arg === "--text-file") opts.textFile = argv[++i] ?? "";
    else if (arg === "--full") opts.full = true;
    else if (arg === "--download") opts.download = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown flag: ${arg}`);
    else opts.dir = arg;
  }
  return opts;
}

/** GB2312 symbols + hanzi, decoded with the runtime's gbk decoder. */
function gb2312(full) {
  const decoder = new TextDecoder("gbk");
  const chars = [];
  for (let hi = 0xa1; hi <= (full ? 0xf7 : 0xd7); hi += 1) {
    for (let lo = 0xa1; lo <= 0xfe; lo += 1) {
      const ch = decoder.decode(new Uint8Array([hi, lo]));
      if (ch !== "\ufffd" && ch.length === 1) chars.push(ch);
    }
  }
  return chars.join("");
}

const ascii = () => Array.from({ length: 0x5f }, (_, i) => String.fromCodePoint(0x20 + i)).join("");

async function projectText(dir) {
  const parts = [];
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".html")) parts.push(await readFile(full, "utf8"));
    }
  };
  await walk(dir);
  return parts.join("\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

async function ensureSource(entry, force) {
  const cached = path.join(CACHE, entry.source);
  if (!force && existsSync(cached)) return cached;
  await mkdir(CACHE, { recursive: true });
  console.log(`下载 ${entry.key} 源字体（一次性）...`);
  const response = await fetch(entry.url);
  if (!response.ok) throw new Error(`${entry.key} 下载失败：HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 500_000) throw new Error(`${entry.key} 下载不完整，删除缓存后重试`);
  writeFileSync(cached, bytes);
  return cached;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dir = path.resolve(opts.dir);
  const fontDir = path.join(dir, "assets", "fonts");
  if (!existsSync(path.join(dir, "index.html"))) throw new Error(`${dir} 没有 index.html —— 先跑 new-project.mjs`);

  try {
    await execFileAsync("python3", ["-c", "import fontTools, brotli"]);
  } catch {
    throw new Error("子集化需要 Python 3 + fontTools + brotli：pip install fonttools brotli");
  }

  const text = [...new Set([
    ...ascii(),
    ...gb2312(opts.full),
    ...EXTRA_SYMBOLS,
    ...(await projectText(dir)),
    ...(opts.textFile ? await readFile(opts.textFile, "utf8") : ""),
    ...opts.text,
  ])].filter((ch) => ch.trim() !== "").join("");

  const tmp = await mkdtemp(path.join(os.tmpdir(), "meitou-font-"));
  try {
    const charsFile = path.join(tmp, "chars.txt");
    await writeFile(charsFile, text);
    await mkdir(fontDir, { recursive: true });
    for (const entry of SOURCES) {
      const source = await ensureSource(entry, opts.download);
      const outFont = path.join(fontDir, entry.file);
      const outCoverage = path.join(fontDir, `${entry.key}-coverage.json`);
      const args = [path.join(SKILL_ROOT, "scripts", "lib", "subset-font.py"), source, charsFile, outFont, outCoverage];
      if (entry.clamp) args.push("--clamp-weights");
      await execFileAsync("python3", args, { maxBuffer: 8 * 1024 * 1024 });
      console.log(`OK ${path.relative(process.cwd(), outFont)} — ${(statSync(outFont).size / 1024 / 1024).toFixed(2)} MB`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  console.log(`OK ${text.length} 个字符已覆盖`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
