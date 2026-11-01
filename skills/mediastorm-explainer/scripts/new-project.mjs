#!/usr/bin/env node
// Scaffold a MediaStorm-style explainer video project from the shipped template.
//
//   node new-project.mjs <target-dir> [--title "片名"] [--duration 30] [--force]
//
// Copies templates/project -> <target-dir>, rewrites the project name, and
// writes meta.json / SCRIPT.md. Never overwrites a non-empty directory unless
// --force is given.

import { cp, mkdir, readFile, readdir, writeFile, stat, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = path.join(SKILL_ROOT, "templates", "project");

const SCRIPT_TEMPLATE = (title) => `# SCRIPT — ${title}

> 每一行 = 一个镜头 / 一个卡片。VO 是时钟：先写 VO，再定时长。
> 语速 4.5–5.5 字/秒。单句 VO 不超过 22 字。

## 0. 钩子 (0–8s)
- 画面：最狠的一镜 / 一个反常识结论
- VO：
- 屏幕字：

## 1. 承诺 (8–20s)
- VO：这期视频，我们……
- 屏幕字：3 个看点（章节预告）

## 2. 章节一
### 提问
- VO：
### 演示
- VO：
### 数字证据
- VO：
### 小结（≤14 字）
- 屏幕字：

## 3. 章节二 …（同上四拍）

## 4. 收口
- 观点（一句）：
- 引导（三连 / 下一期）：
`;

function parseArgs(argv) {
  const opts = { target: "", title: "", duration: 30, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--force") opts.force = true;
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
    const entries = await readdir(dir);
    return entries.length === 0;
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
    for (const entry of ["compositions", "assets", "index.html", "hyperframes.json", "package.json", "meta.json", "SCRIPT.md"]) {
      await rm(path.join(target, entry), { recursive: true, force: true });
    }
  }

  await cp(TEMPLATE, target, { recursive: true, errorOnExist: false, force: true });

  const pkgPath = path.join(target, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  pkg.name = name;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  await writeFile(path.join(target, "meta.json"), `${JSON.stringify({
    id: name,
    name: opts.title || name,
    createdAt: new Date().toISOString(),
  }, null, 2)}\n`);

  let indexHasDuration = true;
  const indexPath = path.join(target, "index.html");
  const index = await readFile(indexPath, "utf8");
  if (opts.duration && /data-duration="\d+(\.\d+)?"/.test(index)) {
    indexHasDuration = true;
    await writeFile(indexPath, index.replace(/(data-composition-id="main"[^>]*data-duration=")\d+(\.\d+)?(")/, `$1${opts.duration}$3`));
  }

  await writeFile(path.join(target, "SCRIPT.md"), SCRIPT_TEMPLATE(opts.title || name));

  const assetCheck = await stat(path.join(target, "assets", "fonts", "NotoSansSC-VF.woff2")).catch(() => null);

  console.log(`OK scaffolded ${target}`);
  console.log(`   index.html          root composition, ${opts.duration}s, 6 scene hosts`);
  console.log(`   compositions/       one file per scene (s01-hook ... s06-outro)`);
  console.log(`   assets/fonts/       ${assetCheck ? "Noto Sans SC VF subset (GB2312 L1)" : "MISSING — run setup-fonts.mjs"}`);
  console.log(`   assets/sfx/         whoosh / impact / click (Pixabay, no attribution required)`);
  console.log(`   SCRIPT.md           beat sheet to fill in before touching HTML`);
  if (!indexHasDuration) console.log("   ! root data-duration not found — set it in index.html");
  console.log("");
  console.log("Next:");
  console.log(`   cd ${path.relative(process.cwd(), target) || "."}`);
  console.log("   node <SKILL_DIR>/scripts/style-lint.mjs .");
  console.log("   npx hyperframes check --json");
  console.log("   npx hyperframes preview --background");
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
