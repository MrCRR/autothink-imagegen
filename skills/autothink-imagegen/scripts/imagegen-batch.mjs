import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ClientError } from "./imagegen-core.mjs";

const MAX_PROMPTS = 5;
const MAX_CONCURRENCY = 3;
const singleCli = path.join(path.dirname(fileURLToPath(import.meta.url)), "imagegen.mjs");

export function parseBatchArgs(argv) {
  const prompts = [];
  let out = null;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--prompt" || flag === "--out") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new ClientError(`${flag} requires a value`);
      index += 1;
      if (flag === "--prompt") prompts.push(value);
      else out = value;
      continue;
    }
    throw new ClientError(`unknown option: ${flag}`);
  }
  if (prompts.length < 2 || prompts.length > MAX_PROMPTS) {
    throw new ClientError(`batch requires 2-${MAX_PROMPTS} prompts`);
  }
  if (prompts.some(prompt => !prompt.trim())) throw new ClientError("batch prompts must not be empty");
  return { prompts, out };
}

export async function runBatchCli({
  argv = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  stdout = line => console.log(line),
  stderr = line => console.error(line)
} = {}) {
  let args;
  try {
    args = parseBatchArgs(argv);
  } catch (error) {
    stderr(`ERROR: ${error.message}`);
    return error?.exitCode ?? 1;
  }

  const outputPath = path.resolve(cwd, args.out ?? "output");
  const results = Array(args.prompts.length);
  const children = new Set();
  let interrupted = false;
  const onInterrupt = () => {
    interrupted = true;
    for (const child of children) child.kill("SIGINT");
  };
  process.once("SIGINT", onInterrupt);

  let nextIndex = 0;
  const worker = async () => {
    while (!interrupted) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= args.prompts.length) return;
      results[index] = await runChild(args.prompts[index], outputPath, cwd, env, children);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, args.prompts.length) }, worker));
  } finally {
    process.removeListener("SIGINT", onInterrupt);
  }

  if (interrupted) {
    stderr("ERROR: batch interrupted");
    return 130;
  }

  let success = 0;
  for (let index = 0; index < results.length; index += 1) {
    const result = results[index];
    if (result?.ok) {
      success += 1;
      for (const savedPath of result.paths) stdout(`BATCH_RESULT: index=${index + 1} SAVED: ${savedPath}`);
    } else {
      stdout(`BATCH_RESULT: index=${index + 1} FAILED`);
    }
  }
  const failed = results.length - success;
  stdout(`BATCH_SUMMARY: success=${success} failed=${failed}`);
  return failed === 0 ? 0 : 1;
}

function runChild(prompt, outputPath, cwd, env, children) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [singleCli, "--prompt", prompt, "--out", outputPath], {
      cwd,
      env: { ...env },
      stdio: ["ignore", "pipe", "pipe"]
    });
    children.add(child);
    let stdout = "";
    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
      if (stdout.length > 1024 * 1024) child.kill("SIGTERM");
    });
    child.stderr.on("data", () => {});
    child.once("error", () => {
      children.delete(child);
      resolve({ ok: false, paths: [] });
    });
    child.once("close", code => {
      children.delete(child);
      const paths = [...stdout.matchAll(/^SAVED: (.+)$/gm)].map(match => match[1]);
      resolve({ ok: code === 0 && paths.length > 0, paths });
    });
  });
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (entryPath === modulePath) {
  process.exitCode = await runBatchCli();
}
