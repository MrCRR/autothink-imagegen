import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import * as imagegenCore from "../skills/autothink-imagegen/scripts/imagegen-core.mjs";
import { createMockImageServer, PNG_BYTES } from "./mock-image-api.mjs";
import { assertMockHealthy, makeFixture, readBytes, runCommand, skillRoot } from "./test-helpers.mjs";

const nodeCli = path.join(skillRoot, "scripts", "imagegen.mjs");
const batchCli = path.join(skillRoot, "scripts", "imagegen-batch.mjs");

test("Node image requests allow five minutes for generation", () => {
  assert.equal(imagegenCore.REQUEST_TIMEOUT_MS, 300_000);
});

test("parseArgs preserves the prompt and separates image inputs", () => {
  assert.deepEqual(imagegenCore.parseArgs([
    "--prompt", " draw a tree ",
    "--image", "/tmp/source.png",
    "--mask", "/tmp/mask.png",
    "--out", "/tmp/result.png"
  ]), {
    prompt: " draw a tree ",
    images: ["/tmp/source.png"],
    mask: "/tmp/mask.png",
    out: "/tmp/result.png"
  });
});

test("generation sends the exact prompt and saves a base64 PNG", async () => {
  const server = await createMockImageServer(async ({ request, json, png }) => {
    assert.equal(request.method, "POST");
    assert.equal(new URL(request.url, server.origin).pathname, "/v1/images/generations");
    assert.equal(request.headers.authorization, "Bearer test-only-key");
    const payload = JSON.parse(request.body);
    assert.deepEqual(payload, {
      model: "gpt-image-2.6",
      prompt: " draw a tree ",
      quality: "auto",
      size: "1024x1024",
      background: "auto",
      output_format: "png"
    });
    json({ data: [{ b64_json: png.toString("base64") }] });
  });
  const fixture = await makeFixture(server.baseUrl);
  try {
    const output = path.join(fixture.directory, "result.png");
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", " draw a tree ", "--out", output], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /^SAVED: .*result\.png\n$/);
    assert.deepEqual(await readBytes(output), PNG_BYTES);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /test-only-key/);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("configuration without a model uses the bundled default model", async () => {
  const server = await createMockImageServer(async ({ request, json, png }) => {
    assert.equal(JSON.parse(request.body).model, "gpt-image-2.6");
    json({ data: [{ b64_json: png.toString("base64") }] });
  });
  const fixture = await makeFixture(server.baseUrl);
  await writeFile(fixture.configPath, JSON.stringify({
    api_key: "test-only-key",
    base_url: server.baseUrl,
    proxy: ""
  }));
  try {
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", "default model"], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.equal(result.code, 0, result.stderr);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("editing sends repeated image fields and a mask as multipart data", async () => {
  const server = await createMockImageServer(async ({ request, json, png }) => {
    assert.equal(new URL(request.url, server.origin).pathname, "/v1/images/edits");
    assert.match(request.headers["content-type"], /^multipart\/form-data; boundary=/);
    const body = request.body.toString("latin1");
    assert.equal((body.match(/name="image\[\]"/g) ?? []).length, 2);
    assert.match(body, /name="mask"/);
    assert.match(body, /name="prompt"[\s\S]*?make it nocturnal/);
    assert.match(body, /name="output_format"[\s\S]*?png/);
    json({ data: [{ b64_json: png.toString("base64") }] });
  });
  const fixture = await makeFixture(server.baseUrl);
  const sourceA = path.join(fixture.directory, "a.png");
  const sourceB = path.join(fixture.directory, "b.png");
  const mask = path.join(fixture.directory, "mask.png");
  await Promise.all([writeFile(sourceA, PNG_BYTES), writeFile(sourceB, PNG_BYTES), writeFile(mask, PNG_BYTES)]);
  try {
    const result = await runCommand(process.execPath, [
      nodeCli, "--image", sourceA, "--image", sourceB, "--mask", mask,
      "--prompt", "make it nocturnal", "--out", path.join(fixture.directory, "edit.png")
    ], { AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /^SAVED: .*edit\.png\n$/);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("result URLs follow one redirect and do not reuse the API bearer header", async () => {
  const server = await createMockImageServer(async ({ request, json, redirect, bytes, origin }) => {
    const pathname = new URL(request.url, origin).pathname;
    if (pathname === "/v1/images/generations") {
      json({ data: [{ url: `${origin}/redirect?signature=mock-signature&expires=9999999999` }] });
    } else if (pathname === "/redirect") {
      assert.equal(request.headers.authorization, undefined);
      redirect(`${origin}/image.png`);
    } else if (pathname === "/image.png") {
      assert.equal(request.headers.authorization, undefined);
      bytes(PNG_BYTES);
    } else {
      json({ error: { message: "unexpected route" } }, 404);
    }
  });
  const fixture = await makeFixture(server.baseUrl);
  try {
    const output = path.join(fixture.directory, "url-result.png");
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", "download this", "--out", output], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await readBytes(output), PNG_BYTES);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("empty prompts are rejected before an API request", async () => {
  const server = await createMockImageServer();
  const fixture = await makeFixture(server.baseUrl);
  try {
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", "   "], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.notEqual(result.code, 0);
    assert.equal(server.requests.length, 0);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("a mask without an image is rejected before an API request", async () => {
  const server = await createMockImageServer();
  const fixture = await makeFixture(server.baseUrl);
  try {
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", "fix it", "--mask", "mask.png"], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.notEqual(result.code, 0);
    assert.equal(server.requests.length, 0);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("existing output files are preserved and receive a collision suffix", async () => {
  const server = await createMockImageServer();
  const fixture = await makeFixture(server.baseUrl);
  const output = path.join(fixture.directory, "result.png");
  await writeFile(output, Buffer.from("original"));
  try {
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", "new", "--out", output], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(await readBytes(output), Buffer.from("original"));
    assert.deepEqual(await readBytes(path.join(fixture.directory, "result-1.png")), PNG_BYTES);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("API failures are nonzero and redact the configured key", async () => {
  const server = await createMockImageServer(async ({ json }) => {
    json({ error: { message: "upstream rejected test-only-key" } }, 401);
  });
  const fixture = await makeFixture(server.baseUrl);
  try {
    const result = await runCommand(process.execPath, [nodeCli, "--prompt", "fail"], {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.notEqual(result.code, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /ERROR:/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /test-only-key/);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("batch rejects six prompts before starting any request", async () => {
  const server = await createMockImageServer();
  const fixture = await makeFixture(server.baseUrl);
  try {
    const args = [batchCli, "--out", path.join(fixture.directory, "output")];
    for (const prompt of ["one", "two", "three", "four", "five", "six"]) args.push("--prompt", prompt);
    const result = await runCommand(process.execPath, args, {
      AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath
    });
    assert.notEqual(result.code, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /2.*5|five/i);
    assert.equal(server.requests.length, 0);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});

test("batch reports two successful child results and a summary", async () => {
  const server = await createMockImageServer(async ({ json, png }) => {
    await new Promise(resolve => setTimeout(resolve, 20));
    json({ data: [{ b64_json: png.toString("base64") }] });
  });
  const fixture = await makeFixture(server.baseUrl);
  try {
    const outputDir = path.join(fixture.directory, "output");
    const result = await runCommand(process.execPath, [
      batchCli, "--out", outputDir, "--prompt", "one", "--prompt", "two"
    ], { AUTOTHINK_IMAGEGEN_CONFIG: fixture.configPath });
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /BATCH_RESULT: index=1 SAVED:/);
    assert.match(result.stdout, /BATCH_RESULT: index=2 SAVED:/);
    assert.match(result.stdout, /BATCH_SUMMARY: success=2 failed=0/);
    assertMockHealthy(server);
  } finally {
    await fixture.cleanup();
    await server.close();
  }
});
