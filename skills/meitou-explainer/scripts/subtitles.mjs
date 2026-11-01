#!/usr/bin/env node
// Turn an SRT into the burned-in subtitle composition this style uses:
// one line at a time, bottom-centre, hard cut in and out.
//
//   node subtitles.mjs <file.srt> [--out compositions/subtitles.html]
//                                   [--max-chars 22] [--id subs] [--dark]
//
// Long lines are split at punctuation and their time is spread by character
// count, so a two-line sentence never sits on screen longer than it is spoken.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MAX = 22; // characters that fit one line at 46px on 1920
const MIN_HOLD = 0.6;

function parseArgs(argv) {
  const opts = { srt: "", out: "", maxChars: DEFAULT_MAX, id: "subs", dark: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") opts.out = argv[++i] ?? "";
    else if (arg === "--max-chars") opts.maxChars = Number(argv[++i]);
    else if (arg === "--id") opts.id = argv[++i] ?? "subs";
    else if (arg === "--dark") opts.dark = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown flag: ${arg}`);
    else opts.srt = arg;
  }
  if (!opts.srt) throw new Error("Usage: node subtitles.mjs <file.srt> [--out compositions/subtitles.html]");
  if (!Number.isFinite(opts.maxChars) || opts.maxChars < 6) throw new Error("--max-chars must be a number >= 6");
  return opts;
}

function toSeconds(stamp) {
  const match = stamp.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) throw new Error(`Bad timestamp: ${stamp}`);
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
}

export function parseSrt(text) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;
    const [startRaw, endRaw] = timeLine.split("-->");
    const body = lines.slice(lines.indexOf(timeLine) + 1).join("");
    if (!body) continue;
    cues.push({ start: toSeconds(startRaw), end: toSeconds(endRaw), text: body });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** Split one spoken sentence into subtitle lines that fit the frame. */
export function splitLine(text, maxChars) {
  const clean = text.replace(/\s+/g, "");
  if (clean.length <= maxChars) return [clean];
  const pieces = clean.split(/(?<=[，。、；：？！,.;:!?])/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const piece of pieces) {
    if (!current) {
      current = piece;
    } else if (current.length + piece.length <= maxChars) {
      current += piece;
    } else {
      lines.push(current);
      current = piece;
    }
  }
  if (current) lines.push(current);

  // A single piece longer than maxChars is cut at the nearest char before the limit.
  const out = [];
  for (const line of lines) {
    if (line.length <= maxChars) {
      out.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > maxChars) {
      out.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    if (rest) out.push(rest);
  }
  return out.filter(Boolean);
}

/** Spread a cue's window across its lines by character count. */
export function timeLines(cue, lines, minHold = MIN_HOLD) {
  const totalChars = lines.reduce((sum, line) => sum + line.length, 0) || 1;
  const window = Math.max(cue.end - cue.start, minHold * lines.length);
  let cursor = cue.start;
  return lines.map((line) => {
    const share = (line.length / totalChars) * window;
    const entry = { start: Number(cursor.toFixed(3)), end: Number((cursor + share).toFixed(3)), text: line };
    cursor += share;
    return entry;
  });
}

export function buildEntries(cues, maxChars) {
  return cues.flatMap((cue) => timeLines(cue, splitLine(cue.text, maxChars)));
}

function render(entries, id, dark) {
  const groups = entries
    .map((entry, index) => {
      const duration = Math.max(entry.end - entry.start, 0.2);
      const cls = dark ? "sub-group clip dark" : "sub-group clip";
      return `  <div id="${id}-${String(index + 1).padStart(2, "0")}" class="${cls}" data-start="${entry.start}" data-duration="${duration.toFixed(3)}">${escapeHtml(entry.text)}</div>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8" /></head>
<body>
<template>
<style>
  #subs-root { position: absolute; inset: 0; overflow: visible; }
  /* 字幕：一行、底部居中、硬切。白字黑描边（深色画面）/ 黑字纸色描边（白板画面） */
  #subs-root .sub-group { position: absolute; left: 0; right: 0; bottom: 96px; text-align: center;
    font-family: var(--font-cn); font-size: 46px; font-weight: 700; color: #FFFFFF;
    paint-order: stroke fill; -webkit-text-stroke: 5px rgba(0,0,0,.86);
    letter-spacing: .01em; line-height: 1.24; }
  #subs-root .sub-group.dark { color: #232323; -webkit-text-stroke: 5px rgba(247,245,239,.94); }
</style>
<div id="subs-root" data-composition-id="${id}" data-width="1920" data-height="1080">
${groups}
</div>
<script>
  // 字幕靠 clip 的 data-start/data-duration 显隐，不需要补间；这里只注册一个空时间线。
  const tl = gsap.timeline({ paused: true });
  window.__timelines["${id}"] = tl;
</script>
</template>
</body></html>
`;
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const srtPath = path.resolve(opts.srt);
  const cues = parseSrt(await readFile(srtPath, "utf8"));
  if (cues.length === 0) throw new Error(`No cues found in ${srtPath}`);
  const entries = buildEntries(cues, opts.maxChars);
  const outPath = path.resolve(opts.out || path.join(path.dirname(srtPath), "compositions", "subtitles.html"));
  await writeFile(outPath, render(entries, opts.id, opts.dark));
  console.log(`OK ${path.relative(process.cwd(), outPath)} — ${cues.length} cues, ${entries.length} caption lines`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  });
}
