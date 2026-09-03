---
name: autothink-imagegen
description: Use when a user asks Codex to generate, edit, remix, or locally save PNG images through an AutoThink-compatible Images API, including text-to-image, reference-image edits, masks, or small prompt batches.
---

# AutoThink Imagegen

## Overview

Use the bundled clients to turn an explicit image request into a PNG result through the user's local AutoThink configuration. Keep the user's prompt unchanged, preserve source-image intent, and report the saved result without exposing credentials or raw API output.

## Choose the Operation

| User input | Operation | Entry point |
| --- | --- | --- |
| No input image | Text-to-image generation | `scripts/imagegen.mjs` |
| One or more explicit image paths | Image edit/remix | `scripts/imagegen.mjs` with one `--image` per path |
| Explicit mask plus image path(s) | Masked edit | `scripts/imagegen.mjs` with `--mask` |
| 2-5 independent prompts | Bounded batch generation | `scripts/imagegen-batch.mjs` |

Treat a referenced image as an edit source only when its path or attachment is available in the current task. When the user says “最近生成的图片” but no unambiguous saved result or attachment can be identified, ask which image to use; never guess a path. If the user rejects the latest result and asks to edit the source, use the input image that produced that result when it is still available.

## Run the Client

Resolve this skill's directory from the location of this `SKILL.md`. Pass the original user prompt as the value of `--prompt`; do not translate, expand, or add style terms.

```bash
node "<SKILL_DIR>/scripts/imagegen.mjs" --prompt "<original prompt>"
node "<SKILL_DIR>/scripts/imagegen.mjs" --image "<source path>" --prompt "<original edit prompt>"
node "<SKILL_DIR>/scripts/imagegen.mjs" --image "<source path>" --mask "<mask path>" --prompt "<original edit prompt>"
node "<SKILL_DIR>/scripts/imagegen-batch.mjs" --prompt "<prompt 1>" --prompt "<prompt 2>"
```

Use `--out` when the user gives an output location. A path with an extension is a file stem; a path without one is an output directory. The client creates PNGs with exclusive creation and adds a numeric suffix instead of overwriting an existing file.

A single upstream generation or image-download request may wait up to five minutes before timing out. Do not retry automatically after a timeout.

Use `python3 "<SKILL_DIR>/scripts/imagegen.py"` with the same single-image arguments only when the Node runtime is unavailable. Do not retry failed image requests or silently switch to another provider. Batch generation is limited to 2-5 prompts and at most three concurrent child processes.

## Configuration

The client reads `<SKILL_DIR>/config.json` by default, or the path in `AUTOTHINK_IMAGEGEN_CONFIG`. If configuration is missing or still contains a placeholder key, stop with the configuration guidance and tell the user to copy `config.example.json` locally and fill it in there. Never ask the user to paste an API key into the conversation, and never print the config file.

The template uses:

```json
{
  "api_key": "replace-with-your-autothink-image-key",
  "base_url": "https://api.autothink.space/v1",
  "model": "gpt-image-2",
  "proxy": ""
}
```

The clients call `images/generations` for text-to-image and `images/edits` for edits, request a square `1024x1024` PNG with `output_format: "png"`, validate the PNG signature, and accept either `b64_json` or an HTTP(S) result URL. Result downloads follow at most five redirects and never reuse the API bearer header.

## Return Results Safely

Read `SAVED: <absolute-path>` lines internally and attach or report the resulting PNG paths to the user. Hide `SAVED`, `BATCH_RESULT`, `BATCH_SUMMARY`, configuration contents, API keys, bearer headers, raw response bodies, and stack traces from the user-facing response. A nonzero exit or `ERROR:` line means the image was not successfully saved; report the concise cause and the next local configuration/input action.

Do not invoke MCP, another image provider, a shell command from a prompt, or a real request merely to test configuration. Use the bundled scripts only after the user has requested the image operation. Keep the original source files unchanged and treat each generated image as a new result.

## Quick Contract

| Condition | Client behavior |
| --- | --- |
| Valid generation/edit | Save one or more validated PNGs and exit `0` |
| Missing or placeholder config | Emit configuration guidance and exit `78` |
| Invalid input, API response, network, or file write | Emit a redacted error and exit nonzero |
| More than five batch prompts | Reject before any API request |
