#!/usr/bin/env node
// Check a 美投君-style project against the house rules instead of the eye.
//
//   node style-lint.mjs [project-dir] [--json]
//
// Errors exit 1, warnings exit 0. Every finding names the file and the fix.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const TYPE_FLOOR_PX = 28;
const SCENE_MIN_S = 1.2;
const SCENE_MAX_S = 15;      // long whiteboard scenes are the norm here
const CUT_SFX_WINDOW_S = 0.35;
const MAX_SUB_CHARS = 24;    // one burned-in line at 46px

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

const readIfExists = async (file) => readFile(file, "utf8").catch(() => null);

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

function loadRanges(json) {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed.ranges) ? parsed.ranges : null;
  } catch {
    return null;
  }
}

function covered(ranges, codePoint) {
  for (const [start, end] of ranges) {
    if (codePoint >= start && codePoint <= end) return true;
    if (codePoint < start) return false;
  }
  return false;
}

async function lint(dir) {
  const findings = [];
  const add = (level, code, message, file) => findings.push({ level, code, message, file: file ? path.relative(dir, file) : undefined });

  const indexPath = path.join(dir, "index.html");
  const index = await readIfExists(indexPath);
  if (!index) {
    add("error", "missing_root", "index.html not found — run new-project.mjs first", indexPath);
    return findings;
  }

  const tokens = collectTokens(index);
  const allowed = new Set([...tokens.keys(), "#ffffff", "#000000"]);
  const rootBlock = index.match(/:root\s*\{[\s\S]*?\}/)?.[0] ?? "";

  const checkPalette = (text, file) => {
    for (const match of text.matchAll(HEX)) {
      if (!allowed.has(match[0].toLowerCase())) {
        add("error", "off_palette_color", `${match[0]} 不是设计令牌 —— 用 var(--...)，或把它加进 :root`, file);
      }
    }
  };
  checkPalette(index.replace(rootBlock, ""), indexPath);

  // 字幕轨豁免“每个场景都要有动效”这条：字幕靠 clip 显隐。
  const hosts = [...index.matchAll(/<div\b[^>]*data-composition-src="[^"]+"[^>]*>/g)]
    .map((m) => m[0]);
  if (hosts.length === 0) add("error", "no_scenes", "index.html 没有挂载任何场景", indexPath);

  const sceneFiles = [];
  for (const block of hosts) {
    const rel = block.match(/data-composition-src="([^"]+)"/)?.[1];
    const start = Number(block.match(/data-start="([\d.]+)"/)?.[1] ?? NaN);
    const duration = Number(block.match(/data-duration="([\d.]+)"/)?.[1] ?? NaN);
    const isCaptions = /data-track-kind="captions"/.test(block);
    const file = path.join(dir, rel);
    const html = await readIfExists(file);
    if (html === null) {
      add("error", "host_missing_source", `场景文件不存在：${rel}`, indexPath);
      continue;
    }
    sceneFiles.push({ rel, html, isCaptions, start, duration });

    if (!html.includes("<template>")) add("error", "scene_missing_template", "场景要用 <template> 包住，否则样式和脚本会被丢掉", file);
    if (!/id="[^"]+"[^>]*data-composition-id="|data-composition-id="[^"]+"[^>]*id="/.test(html) && !/id="[^"]+"/.test(html)) {
      add("error", "scene_missing_root", "场景根节点需要一个稳定的 id（约定用 root）", file);
    }
    if (!/data-composition-id="/.test(html)) add("error", "scene_missing_id", "场景根节点缺少 data-composition-id", file);
    if (!/window\.__timelines\[/.test(html)) add("error", "scene_missing_timeline", "场景必须注册 window.__timelines[\"<id>\"]", file);
    if (!isCaptions && !/tl\.(fromTo|to|from|set)\(/.test(html)) add("error", "scene_static", "场景没有任何补间 —— 会变成一张静止卡片", file);
    if (/(^|[\s;])transition\s*:/.test(html)) add("error", "css_transition", "CSS transition 不受 seek 控制 —— 用 GSAP", file);
    if (/<br\s*\/?>/i.test(html)) add("warn", "br_in_text", "正文不要用 <br>，拆成块级元素", file);

    checkPalette(html, file);

    for (const match of html.matchAll(/font-size:\s*([\d.]+)px/g)) {
      const size = Number(match[1]);
      if (size < TYPE_FLOOR_PX) add("error", "type_floor", `字号 ${size}px 低于 ${TYPE_FLOOR_PX}px 手机可读下限`, file);
    }

    if (!isCaptions && !/class="[^"]*\bwm\b/.test(html)) {
      add("warn", "watermark_missing", "缺角标（<div class=\"wm\">）—— 这个账号每帧都带角标", file);
    }

    if (isCaptions) {
      for (const match of html.matchAll(/<div[^>]*class="[^"]*sub-group[^"]*"[^>]*>([^<]*)</g)) {
        const text = match[1].trim();
        if (text.length > MAX_SUB_CHARS) {
          add("warn", "subtitle_line_long", `字幕行 ${text.length} 字，超过 ${MAX_SUB_CHARS} 字会被挤出画面：${text.slice(0, 12)}…`, file);
        }
      }
    }

    if (!Number.isFinite(start) || !Number.isFinite(duration)) {
      add("error", "host_missing_timing", "场景 host 需要数字 data-start / data-duration", indexPath);
    } else if (!isCaptions) {
      if (duration < SCENE_MIN_S) add("warn", "scene_too_short", `${start}s 的场景只有 ${duration}s —— 少于 ${SCENE_MIN_S}s 会像闪帧`, indexPath);
      if (duration > SCENE_MAX_S) add("warn", "scene_too_long", `${start}s 的场景有 ${duration}s —— 超过 ${SCENE_MAX_S}s 需要内部变化`, indexPath);
    }
  }

  // 每个切点都要有音效
  const cuts = sceneFiles.filter((s) => !s.isCaptions && s.start > 0).map((s) => s.start);
  const audioStarts = [...index.matchAll(/<audio\b[^>]*data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
  for (const cut of cuts) {
    if (!audioStarts.some((a) => Math.abs(a - cut) <= CUT_SFX_WINDOW_S)) {
      add("warn", "cut_without_sfx", `${cut}s 的切点没有音效（±${CUT_SFX_WINDOW_S}s）`, indexPath);
    }
  }

  // 字体子集覆盖
  const noto = loadRanges(await readIfExists(path.join(dir, "assets", "fonts", "NotoSansSC-coverage.json")));
  const hand = loadRanges(await readIfExists(path.join(dir, "assets", "fonts", "ZCOOLKuaiLe-coverage.json")));
  if (noto || hand) {
    for (const { rel, html } of sceneFiles) {
      const isHand = /var\(--font-hand\)|ZCOOL/.test(html);
      const ranges = isHand ? hand || noto : noto || hand;
      if (!ranges) continue;
      const missing = new Set();
      for (const ch of stripMarkup(html)) {
        if (!CJK.test(ch)) continue;
        if (!covered(ranges, ch.codePointAt(0))) missing.add(ch);
      }
      if (missing.size > 0) {
        add("error", "missing_glyphs",
          `字体子集缺字：${[...missing].slice(0, 10).join("")} —— 运行 scripts/setup-fonts.mjs --text 重建子集`,
          path.join(dir, rel));
      }
    }
  }

  // 财经内容底线：全片必须有免责声明
  if (!index.includes("不构成任何投资建议") && !index.includes("不构成投资建议")) {
    const hasDisclaimer = sceneFiles.some((s) => s.html.includes("不构成"));
    if (!hasDisclaimer) add("error", "disclaimer_missing", "全片没有免责声明 —— 财经内容必须写明“不构成投资建议”", indexPath);
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
    for (const f of findings) {
      console.log(`${f.level === "error" ? "✗" : "!"} ${f.code}: ${f.message}${f.file ? ` (${f.file})` : ""}`);
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
