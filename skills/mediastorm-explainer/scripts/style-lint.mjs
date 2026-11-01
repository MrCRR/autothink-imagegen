#!/usr/bin/env node
// Check a MediaStorm-style project against the house style instead of the eye.
//
//   node style-lint.mjs [project-dir] [--json]
//
// Errors exit 1, warnings exit 0. Every finding names the file and the fix.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPE_FLOOR_PX = 28;     // 2.6% of 1080 — the phone-readable floor
const SCENE_MIN_S = 1.2;
const SCENE_MAX_S = 9;
const CUT_SFX_WINDOW_S = 0.35;

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const CJK = /[\u3000-\u303f\u4e00-\u9fff\uff00-\uffef]/;

function parseArgs(argv) {
  const opts = { dir: ".", json: false };
  for (const arg of argv) {
    if (arg === "--json") opts.json = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown flag: ${arg}`);
    else opts.dir = arg;
  }
  return opts;
}

async function readIfExists(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return null;
  }
}

function stripMarkup(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ");
}

function collectTokens(css) {
  const block = css.match(/:root\s*\{([\s\S]*?)\}/);
  const tokens = new Map();
  if (!block) return tokens;
  for (const match of block[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) {
    tokens.set(match[2].toLowerCase(), match[1]);
  }
  return tokens;
}

function loadCoverage(json) {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.ranges) ? parsed.ranges : null;
  } catch {
    return null;
  }
}

function inCoverage(ranges, codePoint) {
  for (const [start, end] of ranges) {
    if (codePoint >= start && codePoint <= end) return true;
    if (codePoint < start) return false;
  }
  return false;
}

async function lint(dir) {
  const findings = [];
  const add = (level, code, message, file) => findings.push({ level, code, message, file });

  const indexPath = path.join(dir, "index.html");
  const index = await readIfExists(indexPath);
  if (!index) {
    add("error", "missing_root", "index.html not found — run new-project.mjs first", indexPath);
    return findings;
  }

  const tokens = collectTokens(index);
  const allowed = new Set([...tokens.keys(), "#ffffff", "#000000"]);

  // Palette: every literal colour in the project must be a declared token.
  const scanPalette = (text, file) => {
    for (const match of text.matchAll(HEX)) {
      const hex = match[0].toLowerCase();
      if (!allowed.has(hex)) {
        add("error", "off_palette_color", `${match[0]} is not in the design tokens — use var(--ms-*), or add it to :root`, file);
      }
    }
  };
  const rootBlock = index.match(/:root\s*\{[\s\S]*?\}/)?.[0] ?? "";
  scanPalette(index.replace(rootBlock, ""), indexPath);

  // Scene roots and the contract each one has to satisfy.
  const hosts = [...index.matchAll(/data-composition-src="([^"]+)"/g)].map((m) => m[1]);
  if (hosts.length === 0) add("error", "no_scenes", "index.html mounts no scene (data-composition-src)", indexPath);

  const sceneTexts = new Map();
  for (const rel of hosts) {
    const file = path.join(dir, rel);
    const html = await readIfExists(file);
    if (html === null) {
      add("error", "host_missing_source", `scene file not found: ${rel}`, indexPath);
      continue;
    }
    sceneTexts.set(rel, html);
    if (!html.includes("<template>")) add("error", "scene_missing_template", "scene needs a <template> wrapper or its styles and script are dropped", file);
    if (!/id="root"/.test(html)) add("error", "scene_missing_root", "scene needs <div id=\"root\">", file);
    if (!/data-composition-id="/.test(html)) add("error", "scene_missing_id", "scene root needs data-composition-id", file);
    if (!/window\.__timelines\[/.test(html)) add("error", "scene_missing_timeline", "scene must register window.__timelines[\"<id>\"]", file);
    if (!/tl\.(fromTo|to|from|set)\(/.test(html)) add("error", "scene_static", "scene has no timeline move — it will read as a dead card", file);
    if (/(^|[\s;])transition\s*:/.test(html)) add("error", "css_transition", "CSS transition interpolates outside the seek — animate with GSAP instead", file);
    if (/<br\s*\/?>/i.test(html)) add("warn", "br_in_text", "no <br> in body text — split into block elements", file);

    scanPalette(html.replace(/<style[\s\S]*?<\/style>/gi, (css) => css), file);

    for (const match of html.matchAll(/font-size:\s*([\d.]+)px/g)) {
      const size = Number(match[1]);
      if (size < TYPE_FLOOR_PX) {
        add("error", "type_floor", `font-size ${size}px is under the ${TYPE_FLOOR_PX}px phone-readable floor`, file);
      }
    }
  }

  // Scene slots: length bounds and a sound on every cut.
  const hostBlocks = [...index.matchAll(/<div\b[^>]*data-composition-src="[^"]+"[^>]*>/g)].map((m) => m[0]);
  const cuts = [];
  for (const block of hostBlocks) {
    const start = Number(block.match(/data-start="([\d.]+)"/)?.[1] ?? NaN);
    const duration = Number(block.match(/data-duration="([\d.]+)"/)?.[1] ?? NaN);
    if (!Number.isFinite(start) || !Number.isFinite(duration)) {
      add("error", "host_missing_timing", "scene host needs numeric data-start and data-duration", indexPath);
      continue;
    }
    if (duration < SCENE_MIN_S) add("warn", "scene_too_short", `scene at ${start}s lasts ${duration}s — under ${SCENE_MIN_S}s reads as a glitch, not a beat`, indexPath);
    if (duration > SCENE_MAX_S) add("warn", "scene_too_long", `scene at ${start}s lasts ${duration}s — over ${SCENE_MAX_S}s needs an internal change`, indexPath);
    if (start > 0) cuts.push(start);
  }

  const audioStarts = [...index.matchAll(/<audio\b[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  for (const cut of cuts) {
    const hit = audioStarts.some((start) => Math.abs(start - cut) <= CUT_SFX_WINDOW_S);
    if (!hit) add("warn", "cut_without_sfx", `cut at ${cut}s has no sound effect within ${CUT_SFX_WINDOW_S}s`, indexPath);
  }

  // Glyph coverage: a subset font silently renders tofu for anything missing.
  const coverage = loadCoverage(await readIfExists(path.join(dir, "assets", "fonts", "NotoSansSC-coverage.json")));
  if (coverage) {
    const missing = new Map();
    for (const [rel, html] of sceneTexts) {
      for (const ch of stripMarkup(html)) {
        if (!CJK.test(ch)) continue;
        if (!inCoverage(coverage, ch.codePointAt(0))) {
          if (!missing.has(ch)) missing.set(ch, rel);
        }
      }
    }
    if (missing.size > 0) {
      const sample = [...missing.keys()].slice(0, 12).join("");
      add("error", "missing_glyphs",
        `characters outside the shipped font subset: ${sample} — rerun scripts/setup-fonts.mjs with --text including your script`,
        path.join(dir, "assets", "fonts", "NotoSansSC-VF.woff2"));
    }
  }

  return findings;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dir = path.resolve(opts.dir);
  const info = await stat(dir).catch(() => null);
  if (!info || !info.isDirectory()) throw new Error(`Not a directory: ${dir}`);

  const findings = await lint(dir);
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warn");

  if (opts.json) {
    console.log(JSON.stringify({ ok: errors.length === 0, errorCount: errors.length, warningCount: warnings.length, findings }, null, 2));
  } else {
    for (const finding of findings) {
      const where = finding.file ? ` (${path.relative(dir, finding.file)})` : "";
      console.log(`${finding.level === "error" ? "✗" : "!"} ${finding.code}: ${finding.message}${where}`);
    }
    console.log(errors.length === 0
      ? `style-lint: ok — 0 errors, ${warnings.length} warning(s)`
      : `style-lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
