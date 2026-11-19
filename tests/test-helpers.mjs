import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);
export const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
export const skillRoot = path.join(repoRoot, "skills", "autothink-imagegen");

export async function makeFixture(baseUrl) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "autothink-imagegen-"));
  const configPath = path.join(directory, "config.json");
  await writeFile(configPath, JSON.stringify({
    api_key: "test-only-key",
    base_url: baseUrl,
    model: "gpt-image-2.6",
    proxy: ""
  }));
  return {
    directory,
    configPath,
    async cleanup() {
      await rm(directory, { recursive: true, force: true });
    }
  };
}

export async function runCommand(command, args, env = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...env },
      maxBuffer: 1024 * 1024
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      error
    };
  }
}

export async function readBytes(filePath) {
  return readFile(filePath);
}

export function assertMockHealthy(server) {
  assert.equal(server.errors.length, 0, server.errors.map(error => error.stack).join("\n"));
}
