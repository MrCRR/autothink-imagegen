import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";

import { createMockImageServer } from "./mock-image-api.mjs";
import { assertMockHealthy, makeFixture, runCommand, skillRoot } from "./test-helpers.mjs";

const pythonCli = path.join(skillRoot, "scripts", "imagegen.py");

test("Python fallback allows five minutes for generation", async () => {
  const result = await runCommand("python3", [
    "-c",
    `import runpy; print(runpy.run_path(${JSON.stringify(pythonCli)})["REQUEST_TIMEOUT_SECONDS"])`
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout.trim(), "300");
});

test("python fallback sends a generation request and saves the PNG", async () => {
  const server = await createMockImageServer(async ({ request, json, png }) => {
    assert.equal(request.method, "POST");
    assert.equal(new URL(request.url, server.origin).pathname, "/v1/images/generations");
    const payload = JSON.parse(request.body);
    assert.equal(payload.prompt, "python prompt");
    json({ data: [{ b64_json: png.toString("base64") }] });
  });
  const fixture = await makeFixture(server.baseUrl);
  try {
    const result = await runCommand("python3", [
      pythonCli, "--prompt", "python prompt", "--out", path.join(fixture.directory, "python.png")
    ], { AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /^SAVED: .*python\.png\n$/);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("python fallback accepts a signed result URL with query parameters", async () => {
  const server = await createMockImageServer(async ({ request, json, redirect, bytes, origin, png }) => {
    const pathname = new URL(request.url, origin).pathname;
    if (pathname === "/v1/images/generations") {
      json({ data: [{ url: `${origin}/python-redirect?signature=mock-signature` }] });
    } else if (pathname === "/python-redirect") {
      redirect(`${origin}/python-image.png?signature=mock-signature`);
    } else if (pathname === "/python-image.png") {
      bytes(png);
    } else {
      json({ error: { message: "unexpected route" } }, 404);
    }
  });
  const fixture = await makeFixture(server.baseUrl);
  try {
    const result = await runCommand("python3", [
      pythonCli, "--prompt", "python url", "--out", path.join(fixture.directory, "python-url.png")
    ], { AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /^SAVED: .*python-url\.png\n$/);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});
