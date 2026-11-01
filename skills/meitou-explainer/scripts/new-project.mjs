#!/usr/bin/env node
// Scaffold a 美投君-style finance explainer project (and its thumbnail) from the shipped templates.
//
//   node new-project.mjs <target-dir> [--title "片名"] [--duration 43] [--no-thumbnail] [--force]
//
// The project ships as a 43-second, 16:9 worked example (deck scenes + one whiteboard
// scene + burned-in subtitles + watermark). Replace the copy, keep the structure.

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(SKILL_ROOT, "templates", "project");
const THUMBNAIL = path.join(SKILL_ROOT, "templates", "thumbnail");

const SCRIPT_TEMPLATE = (title) => `# SCRIPT — ${title}

> 口播稿。VO 是时钟：先写稿、再录音、最后才定时长。
> 语速 4.5-5.5 字/秒。单句 15-25 字，最多一行字幕（22 字）。

## 本期卡（0-4s）
- 屏幕字：本期｜${title}
- VO：

## 钩子（4-11s）
- 冲突一句（红字）：
- 支撑一句（白字）：
- 视觉：数据示意 / 3D 素材 / 图表截图
- VO：

## 01 第几节（11-14s）
- 章节标题：
- 一句话说明：
- VO：

## 正文（14s 之后，每节 4 拍）
### 现象
- VO：
### 数据
- VO：
- 图：来源（口径、时间范围）
### 图解
- 画什么：
- VO：
### 判断
- 一句话：
- VO：

## 如何投资（可执行 3 条）
1.
2.
3.

## 收口
- 结论一句：
- 免责声明：科普内容，不构成投资建议。

## 合规检查
- [ ] 每个数字有来源
- [ ] 没有具体买卖点位、目标价、收益承诺
- [ ] 片尾有免责声明
`;

function parseArgs(argv) {
  const opts = { target: "", title: "", duration: 43, thumbnail: true, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") opts.force = true;
    else if (arg === "--no-thumbnail") opts.thumbnail = false;
    else if (arg === "--title") opts.title = argv[++i] ?? "";
    else if (arg === "--duration") opts.duration = Number(argv[++i]);
    else if (arg.startsWith("-")) throw new Error(`Unknown flag: ${arg}`);
    else if (!opts.target) opts.target = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (!opts.target) throw new Error("Usage: node new-project.mjs <target-dir> [--title 片名] [--force]");
  if (!Number.isFinite(opts.duration) || opts.duration <= 0) throw new Error("--duration must be a positive number of seconds");
  return opts;
}

async function isEmptyDir(dir) {
  try {
    return (await readdir(dir)).length === 0;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const target = path.resolve(opts.target);
  const name = path.basename(target);

  if (!(await isEmptyDir(target)) && !opts.force) {
    throw new Error(`${target} is not empty. Pass --force to overwrite the generated files.`);
  }
  await mkdir(target, { recursive: true });
  if (opts.force) {
    for (const entry of ["compositions", "assets", "index.html", "hyperframes.json", "package.json", "SCRIPT.md", "thumbnail"]) {
      await rm(path.join(target, entry), { recursive: true, force: true });
    }
  }

  await cp(TEMPLATE, target, { recursive: true, force: true });

  const pkgPath = path.join(target, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = name;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const indexPath = path.join(target, "index.html");
  const index = await readFile(indexPath, "utf8");
  const durationPattern = /(data-composition-id="main"[^>]*data-duration=")\d+(?:\.\d+)?(")/;
  const hasDuration = durationPattern.test(index);
  if (hasDuration) await writeFile(indexPath, index.replace(durationPattern, `$1${opts.duration}$2`));

  let thumbnailNote = "skipped";
  if (opts.thumbnail) {
    const thumbDir = path.join(target, "thumbnail");
    await cp(THUMBNAIL, thumbDir, { recursive: true, force: true });
    const fontDir = path.join(target, "assets", "fonts");
    await mkdir(path.join(thumbDir, "assets", "fonts"), { recursive: true });
    for (const font of ["NotoSansSC-VF.woff2", "ZCOOLKuaiLe.woff2"]) {
      await cp(path.join(fontDir, font), path.join(thumbDir, "assets", "fonts", font)).catch(() => {});
    }
    thumbnailNote = "thumbnail/index.html (1280x720)";
  }

  await writeFile(path.join(target, "SCRIPT.md"), SCRIPT_TEMPLATE(opts.title || name));

  const lastSceneEnd = Math.max(...[...index.matchAll(/data-start="([\d.]+)"\s+data-duration="([\d.]+)"/g)]
    .map((m) => Number(m[1]) + Number(m[2])));
  const outruns = opts.duration < lastSceneEnd;

  console.log(`OK scaffolded ${target}`);
  console.log(`   index.html      根合成：${opts.duration}s、7 个场景、字幕轨、水印、音效`);
  console.log(`   compositions/    deck 场景 + 一个手绘白板场景 + subtitles.html`);
  console.log(`   vo.sample.srt   示例口播时间轴（改它，再跑 subtitles.mjs）`);
  console.log(`   assets/fonts/    Noto Sans SC + ZCOOL KuaiLe 子集`);
  console.log(`   ${thumbnailNote}`);
  console.log(`   SCRIPT.md       先填稿，再改 HTML`);
  if (!hasDuration) console.log("   ! root data-duration not found — set it in index.html");
  if (outruns) console.log(`   ! 场景仍排到 ${lastSceneEnd}s —— 在 index.html 里重新定时，否则会被截断`);
  console.log("");
  console.log("下一步：");
  console.log(`   cd ${path.relative(process.cwd(), target) || "."}`);
  console.log("   node <SKILL_DIR>/scripts/subtitles.mjs vo.sample.srt   # 改完稿重生成字幕");
  console.log("   node <SKILL_DIR>/scripts/style-lint.mjs .");
  console.log("   npx hyperframes check --json");
  console.log("   npx hyperframes preview --background");
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
