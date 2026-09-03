import { createServer } from "node:http";
import { Buffer } from "node:buffer";

export const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0x00,
  0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x34, 0x27,
  0x34, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82
]);

export async function createMockImageServer(handler = defaultHandler) {
  const requests = [];
  const errors = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);

    const entry = {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks)
    };
    requests.push(entry);

    const context = {
      request: entry,
      origin: `http://${request.headers.host}`,
      png: PNG_BYTES,
      json(payload, status = 200) {
        const body = Buffer.from(JSON.stringify(payload));
        response.writeHead(status, {
          "content-type": "application/json",
          "content-length": body.length
        });
        response.end(body);
      },
      bytes(body, contentType = "image/png", status = 200) {
        response.writeHead(status, {
          "content-type": contentType,
          "content-length": body.length
        });
        response.end(body);
      },
      redirect(location, status = 302) {
        response.writeHead(status, { location });
        response.end();
      }
    };

    try {
      await handler(context);
    } catch (error) {
      errors.push(error);
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(`mock handler failed: ${error.message}`);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    baseUrl: `${origin}/v1`,
    requests,
    errors,
    async close() {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}

async function defaultHandler({ request, json, png }) {
  const pathname = new URL(request.url, "http://mock.local").pathname;
  if (pathname === "/v1/images/generations" || pathname === "/v1/images/edits") {
    json({ data: [{ b64_json: png.toString("base64") }] });
    return;
  }
  json({ error: { message: "unknown mock route" } }, 404);
}
