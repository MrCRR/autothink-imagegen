import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";

import { execFileAsync, repoRoot, runCommand } from "./test-helpers.mjs";

const skillRoot = path.join(repoRoot, "skills", "meitou-explainer");
const templateRoot = path.join(skillRoot, "templates", "project");
const thumbnailRoot = path.join(skillRoot, "templates", "thumbnail");
const newProject = path.join(skillRoot, "scripts", "new-project.mjs");
const styleLint = path.join(skillRoot, "scripts", "style-lint.mjs");
const subtitles = path.join(skillRoot, "scripts", "subtitles.mjs");

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), "meitou-"));
}

async function scaffold() {
  const dir = await tempDir();
  const target = path.join(dir, "demo");
  await execFileAsync("node", [newProject, target, "--title", "市盈率 PE"], { cwd: repoRoot });
  return { dir, target, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("SKILL.md frontmatter is a valid skill contract", async () => {
  const text = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.ok(text.startsWith("---\n"));
  const frontmatter = text.slice(4, text.indexOf("\n---", 3));
  assert.equal(frontmatter.match(/^name:\s*(.+)$/m)?.[1].trim(), "meitou-explainer");
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1].trim();
  assert.match(description, /^Use when/);
  assert.ok(!/[<>]/.test(description), "validator rejects angle brackets");
  for (const ref of ["style-system.md", "script-formula.md", "scene-library.md", "thumbnail.md", "production.md"]) {
    assert.ok(text.includes(`references/${ref}`), `SKILL.md should route to ${ref}`);
  }
});

test("new-project scaffolds a runnable project and thumbnail", async () => {
  const project = await scaffold();
  try {
    const entries = await readdir(project.target);
    for (const entry of ["index.html", "hyperframes.json", "package.json", "SCRIPT.md", "vo.sample.srt", "compositions", "assets", "thumbnail"]) {
      assert.ok(entries.includes(entry), `missing ${entry}`);
    }
    const scenes = await readdir(path.join(project.target, "compositions"));
    assert.ok(scenes.length >= 8, "ships deck scenes, a whiteboard scene and subtitles");
    assert.ok(scenes.includes("s04-whiteboard.html"));
    assert.ok(scenes.includes("subtitles.html"));

    const script = await readFile(path.join(project.target, "SCRIPT.md"), "utf8");
    assert.match(script, /免责声明/);

    const noto = await readFile(path.join(project.target, "assets", "fonts", "NotoSansSC-VF.woff2"));
    const hand = await readFile(path.join(project.target, "assets", "fonts", "ZCOOLKuaiLe.woff2"));
    assert.ok(noto.length > 500_000, "deck font subset shipped");
    assert.ok(hand.length > 200_000, "handwriting font subset shipped");

    const thumb = await readFile(path.join(project.target, "thumbnail", "index.html"), "utf8");
    assert.match(thumb, /data-width="1280"/);
    assert.match(thumb, /data-height="720"/);
  } finally {
    await project.cleanup();
  }
});

test("new-project refuses a non-empty directory without --force", async () => {
  const project = await scaffold();
  try {
    const result = await runCommand("node", [newProject, project.target]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /not empty/);
  } finally {
    await project.cleanup();
  }
});

test("style-lint passes the shipped template", async () => {
  const result = await runCommand("node", [styleLint, templateRoot]);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /0 errors/);
});

test("style-lint enforces palette, type floor, glyphs and the disclaimer", async () => {
  const project = await scaffold();
  try {
    const scenePath = path.join(project.target, "compositions", "s06-verdict.html");
    const html = await readFile(scenePath, "utf8");
    await writeFile(scenePath, html
      .replace("color: var(--mt-green);", "color: #123456;")
      .replace("font-size: 44px", "font-size: 20px")
      .replace("先看分母", "先看分母龘"));

    const endPath = path.join(project.target, "compositions", "s07-end.html");
    const end = await readFile(endPath, "utf8");
    await writeFile(endPath, end.replace(/不构成[^<]*/, "仅供参考"));

    const result = await runCommand("node", [styleLint, project.target]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /off_palette_color/);
    assert.match(result.stdout, /type_floor/);
    assert.match(result.stdout, /missing_glyphs/);
    assert.match(result.stdout, /disclaimer_missing/);
  } finally {
    await project.cleanup();
  }
});

test("style-lint warns when a cut has no sound effect", async () => {
  const project = await scaffold();
  try {
    const indexPath = path.join(project.target, "index.html");
    await writeFile(indexPath, (await readFile(indexPath, "utf8")).replace(/ {2}<audio[^>]*><\/audio>\n/g, ""));
    const result = await runCommand("node", [styleLint, project.target]);
    assert.match(result.stdout, /cut_without_sfx/);
  } finally {
    await project.cleanup();
  }
});

test("subtitles splits long cues and stays under the line cap", async () => {
  const dir = await tempDir();
  try {
    const srt = path.join(dir, "vo.srt");
    await writeFile(srt, `1
00:00:01,000 --> 00:00:06,000
这是一句很长的口播，它会被拆成两行字幕，因为超过了单行的字数上限。

2
00:00:07,000 --> 00:00:08,000
短句。
`);
    const out = path.join(dir, "subs.html");
    const result = await runCommand("node", [subtitles, srt, "--out", out, "--max-chars", "16"]);
    assert.equal(result.code, 0, result.stderr);
    const html = await readFile(out, "utf8");
    const lines = [...html.matchAll(/class="sub-group clip"[^>]*>([^<]+)</g)].map((m) => m[1]);
    assert.ok(lines.length >= 2, "long cue is split");
    for (const line of lines) assert.ok([...line].length <= 16, `line too long: ${line}`);
    // time is spread by character count: the first part ends before the second starts
    const starts = [...html.matchAll(/data-start="([\d.]+)"/g)].map((m) => Number(m[1]));
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("template scenes satisfy the HyperFrames sub-composition contract", async () => {
  const dir = path.join(templateRoot, "compositions");
  const index = await readFile(path.join(templateRoot, "index.html"), "utf8");
  for (const scene of await readdir(dir)) {
    if (!scene.endsWith(".html")) continue;
    const html = await readFile(path.join(dir, scene), "utf8");
    assert.ok(html.includes("<template>"), `${scene} needs a template wrapper`);
    const id = html.match(/data-composition-id="([^"]+)"/)?.[1];
    assert.ok(id, `${scene} needs data-composition-id`);
    assert.ok(html.includes(`window.__timelines["${id}"]`), `${scene} must register ${id}`);
    assert.ok(index.includes(`data-composition-id="${id}"`), `${scene} is not mounted in index.html`);
  }
  const thumb = await readFile(path.join(thumbnailRoot, "index.html"), "utf8");
  assert.match(thumb, /window\.__timelines\["thumb"\]/);
});
