import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const skillPath = path.join(process.cwd(), "skills", "autothink-imagegen", "SKILL.md");

test("installation docs expose the short Codex command", async () => {
  const skill = await readFile(skillPath, "utf8");

  assert.match(skill, /npx skills add -g MrCRR\/autothink-imagegen/);
  assert.match(skill, /Codex session.*detect|detect.*Codex session/s);
  assert.match(skill, /API key.*local|local.*API key/s);
});
