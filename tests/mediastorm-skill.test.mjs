import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { test } from "node:test";
import os from "node:os";
import path from "node:path";

import { execFileAsync, repoRoot, runCommand } from "./test-helpers.mjs";

const skillRoot = path.join(repoRoot, "skills", "mediastorm-explainer");
const templateRoot = path.join(skillRoot, "templates", "project");
const newProject = path.join(skillRoot, "scripts", "new-project.mjs");
const styleLint = path.join(skillRoot, "scripts", "style-lint.mjs");

async function tempDir() {
  return mkdtemp(path.join(os.tmpdir(), "mediastorm-"));
}

async function scaffold() {
  const dir = await tempDir();
  const target = path.join(dir, "demo");
  await execFileAsync("node", [newProject, target, "--title", "测试片"], { cwd: repoRoot });
  return { dir, target, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test("SKILL.md frontmatter is a valid skill contract", async () => {
  const text = await readFile(path.join(skillRoot, "SKILL.md"), "utf8");
  assert.ok(text.startsWith("---\n"));
  const frontmatter = text.slice(4, text.indexOf("\n---", 3));
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1].trim();
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1].trim();
  assert.equal(name, "mediastorm-explainer");
  assert.match(description, /^Use when/);
  assert.ok(description.length < 900, "description stays short enough to route on");
  assert.ok(text.includes("references/style-system.md"));
  assert.ok(text.includes("scripts/style-lint.mjs"));
});

test("new-project scaffolds a runnable project", async () => {
  const project = await scaffold();
  try {
    const entries = await readdir(project.target);
    for (const entry of ["index.html", "hyperframes.json", "package.json", "meta.json", "SCRIPT.md", "compositions", "assets"]) {
      assert.ok(entries.includes(entry), `missing ${entry}`);
    }
    const scenes = await readdir(path.join(project.target, "compositions"));
    assert.equal(scenes.length, 6);
    assert.ok(scenes.includes("s01-hook.html"));

    const meta = JSON.parse(await readFile(path.join(project.target, "meta.json"), "utf8"));
    assert.equal(meta.name, "测试片");

    const pkg = JSON.parse(await readFile(path.join(project.target, "package.json"), "utf8"));
    assert.equal(pkg.name, "demo");

    const script = await readFile(path.join(project.target, "SCRIPT.md"), "utf8");
    assert.match(script, /钩子/);

    const font = await readFile(path.join(project.target, "assets", "fonts", "NotoSansSC-VF.woff2"));
    assert.ok(font.length > 100_000, "font subset shipped with the scaffold");
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

test("style-lint rejects off-palette colours, small type and missing glyphs", async () => {
  const project = await scaffold();
  try {
    const scenePath = path.join(project.target, "compositions", "s02-promise.html");
    const html = await readFile(scenePath, "utf8");
    const broken = html
      .replace("color: var(--ms-quiet);", "color: #12AB34;")
      .replace("font-size: 66px", "font-size: 22px")
      .replace("算法补偿", "算法补偿龘");
    await writeFile(scenePath, broken);

    const result = await runCommand("node", [styleLint, project.target]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /off_palette_color/);
    assert.match(result.stdout, /type_floor/);
    assert.match(result.stdout, /missing_glyphs/);
  } finally {
    await project.cleanup();
  }
});

test("style-lint json reports counts and findings", async () => {
  const project = await scaffold();
  try {
    const scenePath = path.join(project.target, "compositions", "s01-hook.html");
    await writeFile(scenePath, (await readFile(scenePath, "utf8")).replace("window.__timelines[\"s01-hook\"] = tl;", ""));
    const result = await runCommand("node", [styleLint, project.target, "--json"]);
    assert.equal(result.code, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.ok(report.errorCount >= 1);
    assert.ok(report.findings.some((f) => f.code === "scene_missing_timeline"));
  } finally {
    await project.cleanup();
  }
});

test("template scenes satisfy the HyperFrames sub-composition contract", async () => {
  const dir = path.join(templateRoot, "compositions");
  const scenes = (await readdir(dir)).filter((name) => name.endsWith(".html"));
  assert.ok(scenes.length >= 6);
  const index = await readFile(path.join(templateRoot, "index.html"), "utf8");
  for (const scene of scenes) {
    const html = await readFile(path.join(dir, scene), "utf8");
    assert.ok(html.includes("<template>"), `${scene} needs a template wrapper`);
    assert.match(html, /id="root"/);
    const id = html.match(/data-composition-id="([^"]+)"/)?.[1];
    assert.ok(id, `${scene} needs data-composition-id`);
    assert.ok(html.includes(`window.__timelines["${id}"]`), `${scene} must register ${id}`);
    assert.ok(index.includes(`data-composition-id="${id}"`), `${scene} is not mounted in index.html`);
    assert.ok(index.includes(`data-composition-src="compositions/${scene}"`), `${scene} has no host`);
  }
  const audioIds = [...index.matchAll(/<audio[^>]*id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(audioIds.length >= 4, "starter project ships SFX on its cuts");
});

test("style-lint warns when a cut has no sound effect", async () => {
  const project = await scaffold();
  try {
    const indexPath = path.join(project.target, "index.html");
    const html = await readFile(indexPath, "utf8");
    const stripped = html.replace(/ {2}<audio[^>]*><\/audio>\n/g, "");
    await writeFile(indexPath, stripped);
    const result = await runCommand("node", [styleLint, project.target]);
    assert.match(result.stdout, /cut_without_sfx/);
  } finally {
    await project.cleanup();
  }
});
