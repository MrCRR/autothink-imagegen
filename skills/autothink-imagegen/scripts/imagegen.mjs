import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  configEditCommand,
  generateImage,
  loadConfig,
  parseArgs,
  sanitizeError
} from "./imagegen-core.mjs";

export async function runCli({
  argv = process.argv.slice(2),
  env = process.env,
  cwd = process.cwd(),
  stdout = line => console.log(line),
  stderr = line => console.error(line)
} = {}) {
  let config;
  try {
    const args = parseArgs(argv);
    config = await loadConfig({ env });
    const savedPaths = await generateImage({ ...args, config, cwd });
    for (const savedPath of savedPaths) stdout(`SAVED: ${savedPath}`);
    return 0;
  } catch (error) {
    const secret = config?.apiKey ?? "";
    if (error?.code === "CONFIG_REQUIRED") {
      stderr(`ERROR: CONFIG_REQUIRED: create a local config at ${error.configPath}`);
      stderr(`CONFIG_EDIT_COMMAND: ${configEditCommand(error)}`);
      return 78;
    }
    stderr(`ERROR: ${sanitizeError(error, secret)}`);
    return error?.exitCode ?? 1;
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (entryPath === modulePath) {
  const exitCode = await runCli();
  process.exitCode = exitCode;
}
