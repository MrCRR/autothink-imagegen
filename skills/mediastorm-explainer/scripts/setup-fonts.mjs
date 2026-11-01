#!/usr/bin/env node
// Rebuild the shipped CJK font subset so every character in the project has a glyph.
//
//   node setup-fonts.mjs [project-dir] [--text "额外字符"] [--text-file <path>] [--full]
//
// The default charset is GB2312 level-1 + Chinese punctuation + ASCII + the common
// scientific symbols the style uses. --text / --text-file add whatever your script
// needs beyond that (place names, brand names, rare characters). The source
// variable font (17 MB) is downloaded once into ~/.cache/mediastorm-explainer.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf";
const CACHE_DIR = path.join(os.homedir(), ".cache", "mediastorm-explainer");
const CACHE_TTF = path.join(CACHE_DIR, "NotoSansSC-VF.ttf");

const EXTRA_SYMBOLS = "≠±×÷²³µ°→↑↓←≈㎡℃‰∞√∑·—…“”‘’《》【】（）";

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

/** GB2312 symbol rows + level-1 hanzi, decoded with the runtime's own gbk decoder. */
function gb2312Level1() {
  const decoder = new TextDecoder("gbk");
  const chars = [];
  for (let hi = 0xa1; hi <= 0xd7; hi += 1) {
    for (let lo = 0xa1; lo <= 0xfe; lo += 1) {
      const ch = decoder.decode(new Uint8Array([hi, lo]));
      if (ch !== "\ufffd" && ch.length === 1) chars.push(ch);
    }
  }
  return chars.join("");
}

function asciiChars() {
  return Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCodePoint(0x20 + i)).join("");
}

async function projectText(dir) {
  const parts = [];
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".html")) parts.push(await readFile(full, "utf8"));
    }
  };
  await walk(dir);
  return parts
    .join("\n")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

async function ensureSourceFont(force) {
  if (!force && existsSync(CACHE_TTF)) return CACHE_TTF;
  await mkdir(CACHE_DIR, { recursive: true });
  console.log(`Downloading Noto Sans SC (17 MB) once into ${CACHE_DIR} ...`);
  const response = await fetch(FONT_URL);
  if (!response.ok) throw new Error(`Font download failed: HTTP ${response.status}. Download NotoSansSC[wght].ttf by hand into ${CACHE_TTF}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1_000_000) throw new Error("Font download looks truncated — delete the cache and retry.");
  await writeFile(CACHE_TTF, bytes);
  return CACHE_TTF;
}

async function hasPythonFontTools() {
  try {
    await execFileAsync("python3", ["-c", "import fontTools, brotli"]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dir = path.resolve(opts.dir);
  const fontDir = path.join(dir, "assets", "fonts");
  const outFont = path.join(fontDir, "NotoSansSC-VF.woff2");
  const outCoverage = path.join(fontDir, "NotoSansSC-coverage.json");

  if (!existsSync(path.join(dir, "index.html"))) throw new Error(`${dir} has no index.html — run new-project.mjs first`);
  if (!(await hasPythonFontTools())) {
    throw new Error("Subsetting needs Python 3 with fontTools and brotli: pip install fonttools brotli");
  }

  const charset = new Set([
    ...asciiChars(),
    ...(opts.full ? gb2312Level1() : gb2312Level1()),
    ...EXTRA_SYMBOLS,
    ...(await projectText(dir)),
    ...(opts.textFile ? await readFile(opts.textFile, "utf8") : ""),
    ...opts.text,
  ]);
  // Drop whitespace and control characters: they cost nothing but confuse the report.
  const text = [...charset].filter((ch) => ch.trim() !== "").join("");

  const source = await ensureSourceFont(opts.download);
  await mkdir(fontDir, { recursive: true });

  const tmp = await mkdtemp(path.join(os.tmpdir(), "mediastorm-font-"));
  try {
    const charsFile = path.join(tmp, "chars.txt");
    await writeFile(charsFile, text);
    await execFileAsync("python3", [path.join(SKILL_ROOT, "scripts", "lib", "subset-font.py"), source, charsFile, outFont, outCoverage], { maxBuffer: 8 * 1024 * 1024 });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  const { size } = await import("node:fs").then((m) => m.statSync(outFont));
  const covered = JSON.parse(await readFile(outCoverage, "utf8")).ranges.length;
  console.log(`OK ${path.relative(process.cwd(), outFont)} — ${text.length} glyphs requested, ${covered} ranges, ${(size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`OK ${path.relative(process.cwd(), outCoverage)}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
