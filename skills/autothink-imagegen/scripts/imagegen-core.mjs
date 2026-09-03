import { randomUUID } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Buffer } from "node:buffer";
import { mkdir, open, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connect as tlsConnect } from "node:tls";

const DEFAULT_BASE_URL = "https://api.autothink.space/v1";
const DEFAULT_MODEL = "gpt-image-2";
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024;
const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 60_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DEFAULT_SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export class ClientError extends Error {
  constructor(message, { code = "CLIENT_ERROR", exitCode = 1 } = {}) {
    super(message);
    this.name = "ClientError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export class ConfigRequiredError extends ClientError {
  constructor(configPath, examplePath) {
    super(`configuration file is required at ${configPath}`, {
      code: "CONFIG_REQUIRED",
      exitCode: 78
    });
    this.configPath = configPath;
    this.examplePath = examplePath;
  }
}

export function parseArgs(argv) {
  const options = { prompt: null, images: [], mask: null, out: null };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--prompt" || flag === "--image" || flag === "--mask" || flag === "--out") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new ClientError(`${flag} requires a value`);
      }
      index += 1;
      if (flag === "--prompt") options.prompt = value;
      if (flag === "--image") options.images.push(value);
      if (flag === "--mask") options.mask = value;
      if (flag === "--out") options.out = value;
      continue;
    }
    throw new ClientError(`unknown option: ${flag}`);
  }

  if (options.prompt === null) throw new ClientError("--prompt is required");
  if (!options.prompt.trim()) throw new ClientError("--prompt must not be empty");
  if (options.mask && options.images.length === 0) {
    throw new ClientError("--mask requires at least one --image");
  }
  return options;
}

export async function loadConfig({ configPath, skillDir = DEFAULT_SKILL_DIR, env = process.env } = {}) {
  const resolvedSkillDir = path.resolve(skillDir);
  const resolvedConfigPath = path.resolve(
    configPath ?? env.AUTOTHINK_IMAGEGEN_CONFIG ?? path.join(resolvedSkillDir, "config.json")
  );
  let raw;
  try {
    raw = await readFile(resolvedConfigPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new ConfigRequiredError(resolvedConfigPath, path.join(resolvedSkillDir, "config.example.json"));
    }
    throw new ClientError(`cannot read configuration: ${error.code ?? "unknown error"}`);
  }

  let values;
  try {
    values = JSON.parse(raw);
  } catch {
    throw new ClientError(`configuration is not valid JSON: ${resolvedConfigPath}`);
  }
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new ClientError("configuration must be a JSON object");
  }

  const apiKey = typeof values.api_key === "string" ? values.api_key.trim() : "";
  if (!apiKey || isPlaceholderKey(apiKey)) {
    throw new ConfigRequiredError(resolvedConfigPath, path.join(resolvedSkillDir, "config.example.json"));
  }

  const baseUrl = validateHttpUrl(values.base_url || DEFAULT_BASE_URL, "base_url");
  const proxy = values.proxy ? validateHttpUrl(values.proxy, "proxy") : null;
  const model = typeof values.model === "string" && values.model.trim()
    ? values.model.trim()
    : DEFAULT_MODEL;

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    proxy,
    configPath: resolvedConfigPath,
    examplePath: path.join(resolvedSkillDir, "config.example.json")
  };
}

export async function generateImage({ config, prompt, images = [], mask = null, out = null, cwd = process.cwd() }) {
  if (!config || typeof config !== "object") throw new ClientError("configuration is required");
  if (typeof prompt !== "string" || !prompt.trim()) throw new ClientError("--prompt must not be empty");
  if (mask && images.length === 0) throw new ClientError("--mask requires at least one --image");

  const fields = {
    model: config.model || DEFAULT_MODEL,
    prompt,
    quality: "auto",
    size: "auto",
    background: "auto",
    output_format: "png"
  };
  let body;
  let contentType;
  let endpoint;
  if (images.length === 0) {
    body = Buffer.from(JSON.stringify(fields));
    contentType = "application/json";
    endpoint = joinUrl(config.baseUrl, "images/generations");
  } else {
    const files = [];
    for (const imagePath of images) {
      files.push(await readInputFile(imagePath, "image"));
      files[files.length - 1].fieldName = "image[]";
    }
    if (mask) {
      const maskFile = await readInputFile(mask, "mask");
      maskFile.fieldName = "mask";
      files.push(maskFile);
    }
    const multipart = buildMultipartBody(fields, files);
    body = multipart.body;
    contentType = multipart.contentType;
    endpoint = joinUrl(config.baseUrl, "images/edits");
  }

  const response = await requestBuffer(endpoint, {
    method: "POST",
    proxy: config.proxy,
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": contentType,
      "content-length": String(body.length),
      accept: "application/json"
    },
    body: Buffer.from(body)
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new ClientError(`image API returned HTTP ${response.statusCode}: ${remoteMessage(response.body)}`);
  }

  const buffers = await decodeImageResponse(response.body, config);
  const saved = [];
  for (const buffer of buffers) saved.push(await savePng(buffer, out, cwd));
  return saved;
}

export function buildMultipartBody(fields, files) {
  const boundary = `----autothink-imagegen-${randomUUID().replaceAll("-", "")}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${escapeHeader(name)}"\r\n\r\n`));
    chunks.push(Buffer.from(String(value)));
    chunks.push(Buffer.from("\r\n"));
  }
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(
      `Content-Disposition: form-data; name="${escapeHeader(file.fieldName)}"; filename="${escapeHeader(file.fileName)}"\r\n` +
      `Content-Type: ${file.contentType || "application/octet-stream"}\r\n\r\n`
    ));
    chunks.push(file.data);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

export function sanitizeError(error, secret = "") {
  let message = error instanceof Error ? error.message : String(error);
  if (secret) message = message.split(secret).join("[REDACTED]");
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/((?:api[_-]?key|token|signature|sig)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 600);
}

export function configEditCommand(error) {
  const source = quoteShellPath(error.examplePath);
  const target = quoteShellPath(error.configPath);
  return process.platform === "win32"
    ? `copy ${source} ${target}`
    : `cp ${source} ${target}`;
}

async function decodeImageResponse(rawBody, config) {
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new ClientError("image API returned invalid JSON");
  }
  if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new ClientError("image API returned no image data");
  }

  const buffers = [];
  for (const item of payload.data) {
    if (item && typeof item.b64_json === "string") {
      buffers.push(validatePng(decodeBase64(item.b64_json)));
    } else if (item && typeof item.url === "string") {
      buffers.push(validatePng(await downloadImage(item.url, config)));
    } else {
      throw new ClientError("image API response item has no b64_json or url");
    }
  }
  return buffers;
}

async function downloadImage(urlValue, config) {
  let current = urlValue;
  for (let redirectCount = 0; ; redirectCount += 1) {
    const parsed = validateHttpUrl(current, "image URL");
    const response = await requestBuffer(parsed, {
      method: "GET",
      proxy: config.proxy,
      headers: { accept: "image/png" }
    });
    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location;
      if (!location) throw new ClientError("image URL redirect has no location");
      if (redirectCount >= MAX_REDIRECTS) throw new ClientError("image URL exceeded redirect limit");
      current = new URL(location, parsed).toString();
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new ClientError(`image download returned HTTP ${response.statusCode}`);
    }
    return response.body;
  }
}

function decodeBase64(value) {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.length % 4 === 1) {
    throw new ClientError("image API returned invalid base64");
  }
  const withoutPadding = normalized.replace(/=+$/, "");
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.toString("base64").replace(/=+$/, "") !== withoutPadding) {
    throw new ClientError("image API returned invalid base64");
  }
  return decoded;
}

function validatePng(buffer) {
  if (buffer.length < PNG_SIGNATURE.length || !PNG_SIGNATURE.equals(buffer.subarray(0, PNG_SIGNATURE.length))) {
    throw new ClientError("image result is not a PNG");
  }
  return buffer;
}

async function readInputFile(filePath, label) {
  const resolved = path.resolve(filePath);
  let details;
  try {
    details = await stat(resolved);
  } catch (error) {
    throw new ClientError(`cannot read ${label} file: ${error.code ?? "unknown error"}`);
  }
  if (!details.isFile()) throw new ClientError(`${label} path is not a file`);
  if (details.size > MAX_INPUT_BYTES) throw new ClientError(`${label} file is too large`);
  let data;
  try {
    data = await readFile(resolved);
  } catch (error) {
    throw new ClientError(`cannot read ${label} file: ${error.code ?? "unknown error"}`);
  }
  return {
    fieldName: label,
    fileName: path.basename(resolved),
    contentType: mimeTypeFor(resolved),
    data
  };
}

async function savePng(buffer, out, cwd) {
  const target = outputTarget(out, cwd);
  await mkdir(target.directory, { recursive: true });
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt}`;
    const candidate = path.join(target.directory, `${target.stem}${suffix}${target.extension}`);
    let handle;
    try {
      handle = await open(candidate, "wx", 0o600);
    } catch (error) {
      if (error.code === "EEXIST") continue;
      throw new ClientError(`cannot create output file: ${error.code ?? "unknown error"}`);
    }
    try {
      await handle.writeFile(buffer);
      await handle.close();
      return candidate;
    } catch (error) {
      await handle.close().catch(() => {});
      await unlink(candidate).catch(() => {});
      throw new ClientError(`cannot write output file: ${error.code ?? "unknown error"}`);
    }
  }
  throw new ClientError("could not find an unused output filename");
}

function outputTarget(out, cwd) {
  const resolved = path.resolve(cwd, out ?? "output");
  const extension = path.extname(resolved);
  if (out && extension) {
    return {
      directory: path.dirname(resolved),
      stem: path.basename(resolved, extension),
      extension: ".png"
    };
  }
  return { directory: resolved, stem: "image", extension: ".png" };
}

function mimeTypeFor(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    default: return "image/png";
  }
}

function isPlaceholderKey(value) {
  const normalized = value.toLowerCase();
  return normalized.startsWith("replace-with") || normalized.startsWith("your-") ||
    normalized.startsWith("<") || normalized.includes("填写") || normalized.includes("placeholder");
}

function validateHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    throw new ClientError(`${label} must be a valid HTTP(S) URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ClientError(`${label} must use HTTP or HTTPS`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new ClientError(`${label} must not include credentials or query parameters`);
  }
  return parsed.toString().replace(/\/+$/, "");
}

function joinUrl(baseUrl, suffix) {
  return `${baseUrl.replace(/\/+$/, "")}/${suffix}`;
}

function escapeHeader(value) {
  return String(value).replace(/["\\\r\n]/g, character => `\\${character}`);
}

function quoteShellPath(value) {
  return `"${String(value).replace(/"/g, "\\\"")}"`;
}

function remoteMessage(body) {
  try {
    const payload = JSON.parse(body.toString("utf8"));
    const message = payload?.error?.message ?? payload?.message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 300);
  } catch {
    // Keep protocol errors concise and avoid returning arbitrary response bodies.
  }
  return "upstream request failed";
}

function requestBuffer(urlValue, { method = "GET", headers = {}, body = null, proxy = null } = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = new URL(urlValue);
    } catch {
      reject(new ClientError("request URL is invalid"));
      return;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      reject(new ClientError("request URL must use HTTP or HTTPS"));
      return;
    }

    const onResponse = response => {
      const chunks = [];
      let total = 0;
      response.on("data", chunk => {
        total += chunk.length;
        if (total > MAX_RESPONSE_BYTES) {
          response.destroy();
          reject(new ClientError("response exceeded size limit"));
          return;
        }
        chunks.push(chunk);
      });
      response.once("error", error => reject(error instanceof ClientError ? error : new ClientError("response read failed")));
      response.once("end", () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks)
      }));
    };

    const finishRequest = request => {
      request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new ClientError("request timed out")));
      request.once("error", error => reject(error instanceof ClientError ? error : new ClientError(`network request failed: ${error.code ?? "unknown error"}`)));
      if (body) request.write(body);
      request.end();
    };

    if (!proxy) {
      const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
      const request = transport({
        hostname: target.hostname,
        port: target.port || undefined,
        method,
        path: `${target.pathname}${target.search}`,
        headers
      }, onResponse);
      finishRequest(request);
      return;
    }

    let proxyUrl;
    try {
      proxyUrl = new URL(proxy);
    } catch {
      reject(new ClientError("proxy URL is invalid"));
      return;
    }
    const proxyTransport = proxyUrl.protocol === "https:" ? httpsRequest : httpRequest;
    if (target.protocol === "http:") {
      const proxyHeaders = { ...headers, host: target.host };
      const auth = proxyAuthorization(proxyUrl);
      if (auth) proxyHeaders["proxy-authorization"] = auth;
      const request = proxyTransport({
        hostname: proxyUrl.hostname,
        port: proxyUrl.port || undefined,
        method,
        path: target.toString(),
        headers: proxyHeaders
      }, onResponse);
      finishRequest(request);
      return;
    }

    const connectHeaders = { host: `${target.hostname}:${target.port || 443}` };
    const auth = proxyAuthorization(proxyUrl);
    if (auth) connectHeaders["proxy-authorization"] = auth;
    const connectRequest = proxyTransport({
      hostname: proxyUrl.hostname,
      port: proxyUrl.port || undefined,
      method: "CONNECT",
      path: `${target.hostname}:${target.port || 443}`,
      headers: connectHeaders
    });
    connectRequest.setTimeout(REQUEST_TIMEOUT_MS, () => connectRequest.destroy(new ClientError("proxy connection timed out")));
    connectRequest.once("error", error => reject(error instanceof ClientError ? error : new ClientError(`proxy connection failed: ${error.code ?? "unknown error"}`)));
    connectRequest.once("connect", (connectResponse, socket, head) => {
      if (connectResponse.statusCode !== 200) {
        connectResponse.resume();
        socket.destroy();
        reject(new ClientError(`proxy CONNECT returned HTTP ${connectResponse.statusCode ?? 0}`));
        return;
      }
      if (head.length) socket.unshift(head);
      const secureSocket = tlsConnect({ socket, servername: target.hostname });
      secureSocket.once("error", error => reject(new ClientError(`TLS tunnel failed: ${error.code ?? "unknown error"}`)));
      secureSocket.once("secureConnect", () => {
        const request = httpsRequest({
          hostname: target.hostname,
          port: target.port || undefined,
          method,
          path: `${target.pathname}${target.search}`,
          headers,
          createConnection: () => secureSocket
        }, onResponse);
        finishRequest(request);
      });
    });
    connectRequest.end();
  });
}

function proxyAuthorization(proxyUrl) {
  if (!proxyUrl.username && !proxyUrl.password) return null;
  const username = decodeURIComponent(proxyUrl.username);
  const password = decodeURIComponent(proxyUrl.password);
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}
