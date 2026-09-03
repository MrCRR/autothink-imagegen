#!/usr/bin/env python3
"""Standard-library fallback for the AutoThink image generation skill."""

import argparse
import base64
import binascii
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


DEFAULT_BASE_URL = "https://api.autothink.space/v1"
DEFAULT_MODEL = "gpt-image-2"
MAX_RESPONSE_BYTES = 64 * 1024 * 1024
MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_REDIRECTS = 5
REQUEST_TIMEOUT_SECONDS = 300
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class ClientError(Exception):
    def __init__(self, message, exit_code=1):
        super().__init__(message)
        self.exit_code = exit_code


class ConfigRequiredError(ClientError):
    def __init__(self, config_path, example_path):
        super().__init__(f"configuration file is required at {config_path}", exit_code=78)
        self.config_path = config_path
        self.example_path = example_path


def parse_args(argv):
    parser = argparse.ArgumentParser(description="Generate or edit a PNG through AutoThink.")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--image", action="append", default=[])
    parser.add_argument("--mask")
    parser.add_argument("--out")
    args = parser.parse_args(argv)
    if not args.prompt.strip():
        raise ClientError("--prompt must not be empty")
    if args.mask and not args.image:
        raise ClientError("--mask requires at least one --image")
    return args


def load_config(config_path=None, skill_dir=None, environ=None):
    environ = os.environ if environ is None else environ
    resolved_skill_dir = Path(skill_dir or Path(__file__).resolve().parent.parent).resolve()
    selected_path = config_path or environ.get("AUTOTHINK_IMAGEGEN_CONFIG")
    resolved_config_path = Path(selected_path or resolved_skill_dir / "config.json").resolve()
    example_path = resolved_skill_dir / "config.example.json"
    try:
        raw = resolved_config_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise ConfigRequiredError(resolved_config_path, example_path)
    except OSError as error:
        raise ClientError(f"cannot read configuration: {error.errno or 'unknown error'}")

    try:
        values = json.loads(raw)
    except json.JSONDecodeError:
        raise ClientError(f"configuration is not valid JSON: {resolved_config_path}")
    if not isinstance(values, dict):
        raise ClientError("configuration must be a JSON object")

    api_key = values.get("api_key", "")
    if not isinstance(api_key, str):
        api_key = ""
    api_key = api_key.strip()
    if not api_key or is_placeholder_key(api_key):
        raise ConfigRequiredError(resolved_config_path, example_path)

    base_url = validate_http_url(values.get("base_url") or DEFAULT_BASE_URL, "base_url")
    proxy_value = values.get("proxy") or ""
    proxy = validate_http_url(proxy_value, "proxy") if proxy_value else None
    model = values.get("model")
    model = model.strip() if isinstance(model, str) else ""
    return {
        "api_key": api_key,
        "base_url": base_url.rstrip("/"),
        "model": model or DEFAULT_MODEL,
        "proxy": proxy,
        "config_path": str(resolved_config_path),
        "example_path": str(example_path),
    }


def generate_image(config, prompt, images=None, mask=None, out=None, cwd=None):
    images = [] if images is None else images
    cwd = os.getcwd() if cwd is None else cwd
    if not isinstance(prompt, str) or not prompt.strip():
        raise ClientError("--prompt must not be empty")
    if mask and not images:
        raise ClientError("--mask requires at least one --image")

    fields = {
        "model": config["model"],
        "prompt": prompt,
        "quality": "auto",
        "size": "1024x1024",
        "background": "auto",
        "output_format": "png",
    }
    if not images:
        body = json.dumps(fields, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        content_type = "application/json"
        endpoint = join_url(config["base_url"], "images/generations")
    else:
        files = []
        for image_path in images:
            file_info = read_input_file(image_path, "image")
            file_info["field_name"] = "image[]"
            files.append(file_info)
        if mask:
            mask_info = read_input_file(mask, "mask")
            mask_info["field_name"] = "mask"
            files.append(mask_info)
        body, content_type = build_multipart_body(fields, files)
        endpoint = join_url(config["base_url"], "images/edits")

    status, _, response_body = request_bytes(
        endpoint,
        method="POST",
        headers={
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": content_type,
            "Content-Length": str(len(body)),
            "Accept": "application/json",
        },
        data=body,
        proxy=config["proxy"],
    )
    if status < 200 or status >= 300:
        raise ClientError(f"image API returned HTTP {status}: {remote_message(response_body)}")

    buffers = decode_image_response(response_body, config)
    return [save_png(buffer, out, cwd) for buffer in buffers]


def build_multipart_body(fields, files):
    boundary = "----autothink-imagegen-" + uuid.uuid4().hex
    chunks = []
    for name, value in fields.items():
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            f'Content-Disposition: form-data; name="{escape_header(name)}"\r\n\r\n'.encode("utf-8"),
            str(value).encode("utf-8"),
            b"\r\n",
        ])
    for file_info in files:
        chunks.extend([
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{escape_header(file_info["field_name"])}"; '
                f'filename="{escape_header(file_info["file_name"])}"\r\n'
                f'Content-Type: {file_info["content_type"]}\r\n\r\n'
            ).encode("utf-8"),
            file_info["data"],
            b"\r\n",
        ])
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def request_bytes(url, method="GET", headers=None, data=None, proxy=None):
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ClientError("request URL must use HTTP or HTTPS")
    request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    handlers = [LimitedRedirectHandler(MAX_REDIRECTS)]
    handlers.append(urllib.request.ProxyHandler({"http": proxy, "https": proxy} if proxy else {}))
    opener = urllib.request.build_opener(*handlers)
    try:
        with opener.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            body = response.read(MAX_RESPONSE_BYTES + 1)
            if len(body) > MAX_RESPONSE_BYTES:
                raise ClientError("response exceeded size limit")
            return response.status, dict(response.headers.items()), body
    except urllib.error.HTTPError as error:
        body = error.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise ClientError("response exceeded size limit")
        return error.code, dict(error.headers.items()), body
    except urllib.error.URLError as error:
        reason = getattr(error, "reason", None)
        code = getattr(reason, "errno", None) or "unknown error"
        raise ClientError(f"network request failed: {code}")


class LimitedRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.count = 0

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.count += 1
        if self.count > self.limit:
            raise ClientError("image URL exceeded redirect limit")
        parsed = urllib.parse.urlparse(newurl)
        if parsed.scheme not in ("http", "https"):
            raise ClientError("image URL must use HTTP or HTTPS")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def decode_image_response(raw_body, config):
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ClientError("image API returned invalid JSON")
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list) or not data:
        raise ClientError("image API returned no image data")

    buffers = []
    for item in data:
        if isinstance(item, dict) and isinstance(item.get("b64_json"), str):
            buffers.append(validate_png(decode_base64(item["b64_json"])))
        elif isinstance(item, dict) and isinstance(item.get("url"), str):
            status, _, body = request_bytes(
                validate_http_url(item["url"], "image URL", allow_query=True),
                headers={"Accept": "image/png"},
                proxy=config["proxy"],
            )
            if status < 200 or status >= 300:
                raise ClientError(f"image download returned HTTP {status}")
            buffers.append(validate_png(body))
        else:
            raise ClientError("image API response item has no b64_json or url")
    return buffers


def decode_base64(value):
    normalized = re.sub(r"\s+", "", value)
    if not normalized or not re.fullmatch(r"[A-Za-z0-9+/]*={0,2}", normalized) or len(normalized) % 4 == 1:
        raise ClientError("image API returned invalid base64")
    unpadded = normalized.rstrip("=")
    padded = normalized + "=" * ((4 - len(normalized) % 4) % 4)
    try:
        decoded = base64.b64decode(padded, validate=True)
    except (binascii.Error, ValueError):
        raise ClientError("image API returned invalid base64")
    if base64.b64encode(decoded).decode("ascii").rstrip("=") != unpadded:
        raise ClientError("image API returned invalid base64")
    return decoded


def validate_png(data):
    if not data.startswith(PNG_SIGNATURE):
        raise ClientError("image result is not a PNG")
    return data


def read_input_file(file_path, label):
    resolved = Path(file_path).resolve()
    try:
        details = resolved.stat()
    except OSError as error:
        raise ClientError(f"cannot read {label} file: {error.errno or 'unknown error'}")
    if not details.is_file():
        raise ClientError(f"{label} path is not a file")
    if details.st_size > MAX_INPUT_BYTES:
        raise ClientError(f"{label} file is too large")
    try:
        data = resolved.read_bytes()
    except OSError as error:
        raise ClientError(f"cannot read {label} file: {error.errno or 'unknown error'}")
    return {
        "field_name": label,
        "file_name": resolved.name,
        "content_type": mime_type_for(resolved.name),
        "data": data,
    }


def save_png(data, out, cwd):
    resolved = Path(out or "output")
    if not resolved.is_absolute():
        resolved = Path(cwd) / resolved
    resolved = resolved.resolve()
    extension = resolved.suffix
    if out and extension:
        directory = resolved.parent
        stem = resolved.stem
    else:
        directory = resolved
        stem = "image"
    directory.mkdir(parents=True, exist_ok=True)
    for attempt in range(10_000):
        suffix = "" if attempt == 0 else f"-{attempt}"
        candidate = directory / f"{stem}{suffix}.png"
        try:
            descriptor = os.open(str(candidate), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            continue
        try:
            with os.fdopen(descriptor, "wb") as output_file:
                output_file.write(data)
            return str(candidate)
        except OSError as error:
            try:
                os.unlink(candidate)
            except OSError:
                pass
            raise ClientError(f"cannot write output file: {error.errno or 'unknown error'}")
    raise ClientError("could not find an unused output filename")


def main(argv=None):
    config = None
    try:
        args = parse_args(argv)
        config = load_config()
        for saved_path in generate_image(config, args.prompt, args.image, args.mask, args.out):
            print(f"SAVED: {saved_path}")
        return 0
    except ConfigRequiredError as error:
        print(f"ERROR: CONFIG_REQUIRED: create a local config at {error.config_path}", file=sys.stderr)
        print(f"CONFIG_EDIT_COMMAND: {config_edit_command(error)}", file=sys.stderr)
        return 78
    except Exception as error:
        secret = config.get("api_key", "") if config else ""
        print(f"ERROR: {sanitize_error(error, secret)}", file=sys.stderr)
        return getattr(error, "exit_code", 1)


def config_edit_command(error):
    source = quote_shell_path(error.example_path)
    target = quote_shell_path(error.config_path)
    return f"copy {source} {target}" if os.name == "nt" else f"cp {source} {target}"


def sanitize_error(error, secret=""):
    message = str(error)
    if secret:
        message = message.replace(secret, "[REDACTED]")
    message = re.sub(r"Bearer\s+\S+", "Bearer [REDACTED]", message, flags=re.IGNORECASE)
    message = re.sub(r"((?:api[_-]?key|token|signature|sig)=)[^&\s]+", r"\1[REDACTED]", message, flags=re.IGNORECASE)
    return message[:600]


def validate_http_url(value, label, allow_query=False):
    parsed = urllib.parse.urlparse(str(value))
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ClientError(f"{label} must be a valid HTTP(S) URL")
    if parsed.username or parsed.password or (parsed.query and not allow_query) or parsed.fragment:
        raise ClientError(f"{label} must not include credentials or query parameters")
    return urllib.parse.urlunparse(parsed)


def join_url(base_url, suffix):
    return base_url.rstrip("/") + "/" + suffix


def is_placeholder_key(value):
    normalized = value.lower()
    return normalized.startswith(("replace-with", "your-", "<")) or "填写" in normalized or "placeholder" in normalized


def escape_header(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\r", "\\r").replace("\n", "\\n")


def quote_shell_path(value):
    return '"' + str(value).replace('"', '\\"') + '"'


def mime_type_for(file_name):
    suffix = Path(file_name).suffix.lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(suffix, "image/png")


def remote_message(body):
    try:
        payload = json.loads(body.decode("utf-8"))
        if isinstance(payload, dict):
            error = payload.get("error")
            message = error.get("message") if isinstance(error, dict) else payload.get("message")
            if isinstance(message, str) and message.strip():
                return message.strip()[:300]
    except (UnicodeDecodeError, json.JSONDecodeError, AttributeError):
        pass
    return "upstream request failed"


if __name__ == "__main__":
    sys.exit(main())
