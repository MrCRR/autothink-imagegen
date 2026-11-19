# AutoThink Image Generation Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the local `test-driven-development` skill to implement this plan task-by-task. Each task ends with a focused test run and a commit.

**Goal:** 在当前仓库交付一个可通过 `npx skills add -g` 发现的 `autothink-imagegen` skill，使用 AutoThink OpenAI-compatible Images API 完成文生图、参考图编辑、`mask` 局部重绘和有限批量生成。

**Architecture:** `skills/autothink-imagegen/SKILL.md` 只描述 Codex 的调用决策和结果处理；Node 客户端负责默认运行时，`imagegen-core.mjs` 负责配置、HTTP、multipart、响应解码和独占文件保存，两个 CLI 只负责参数与协议；Python 3 标准库客户端提供同等的单图 fallback。测试只访问本地 mock HTTP 服务。

**Tech Stack:** Node.js 18+ built-ins (`node:test`, `http`, `https`, `fs`), Python 3 standard library (`urllib`, `argparse`), YAML frontmatter, `quick_validate.py`。

## Global Constraints

- 默认网关为 `https://ai.autothink.space/v1`，默认模型为 `gpt-image-2.6`。
- 生成接口为 `POST /images/generations`，编辑接口为 `POST /images/edits`；编辑参考图字段重复使用 `image[]`，遮罩字段为 `mask`。
- 所有成功结果请求 `output_format: "png"` 并验证 PNG 签名。
- 不保存或打印真实 API key；配置文件只从本地 `config.json` 或 `AUTOTHINK_IMAGEGEN_CONFIG` 指定路径读取。
- API、下载、base64、JSON 和本地写入失败必须产生非零退出码；缺失配置使用退出码 `78`。
- 默认结果使用独占创建，绝不覆盖已有输出文件；批量入口最多接受 5 个 prompt，最多 3 个并行子进程，不自动重试。
- 客户端无第三方运行时依赖，不发起真实上游计费请求，不修改 AutoThink 服务端。

---

### Task 1: Establish Test Harness and Red Contract

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tests/mock-image-api.mjs`
- Create: `tests/imagegen.test.mjs`
- Create: `tests/python-imagegen.test.mjs`

**Interfaces:**
- `tests/mock-image-api.mjs` exports `createMockImageServer(handler)` and returns `{ baseUrl, requests, close }`.
- `tests/imagegen.test.mjs` invokes `skills/autothink-imagegen/scripts/imagegen.mjs` through `child_process.execFile` and asserts stdout, exit codes, saved PNG bytes, request bodies, and secret redaction.
- `tests/python-imagegen.test.mjs` invokes the future `skills/autothink-imagegen/scripts/imagegen.py` with the same mock server and configuration contract.

- [ ] **Step 1: Write the mock server and failing contract tests**

  The mock must bind to `127.0.0.1` on an ephemeral port, record method, URL, headers, and raw body, expose a PNG `b64_json` response, expose a URL response with one redirect, and return controlled JSON errors. Tests must cover: generation JSON fields and bearer header; repeated `image[]` and `mask` multipart fields; URL download; invalid base64; empty prompt; mask without image; non-overwriting output; API error without key leakage; batch preflight rejecting six prompts; and Python generation.

- [ ] **Step 2: Run the contract tests and verify the expected RED failure**

  Run `npm test`. Expected result: the tests fail because `skills/autothink-imagegen/scripts/imagegen.mjs`, `imagegen-batch.mjs`, and `imagegen.py` do not exist yet; no test should pass merely because the feature already exists.

- [ ] **Step 3: Commit the red harness**

  Run `git add .gitignore package.json tests` and `git commit -m "test: define image generation skill contract"`.

### Task 2: Implement the Node Single-Image Client

**Files:**
- Create: `skills/autothink-imagegen/scripts/imagegen-core.mjs`
- Create: `skills/autothink-imagegen/scripts/imagegen.mjs`
- Test: `tests/imagegen.test.mjs`

**Interfaces:**
- `imagegen-core.mjs` exports `parseArgs(argv)`, `loadConfig(options)`, `generateImage(options)`, `buildMultipartBody(fields, files)`, and `sanitizeError(error, secret)`.
- `generateImage({ config, prompt, images, mask, out, cwd })` returns absolute saved paths in response order.
- `imagegen.mjs` prints one `SAVED: <absolute-path>` line per result and uses exit code `78` for missing/invalid local configuration and `1` for all input, network, response, or filesystem failures.

- [ ] **Step 1: Add the first focused failing assertion for the public core contract**

  Assert that calling `parseArgs(["--prompt", "draw a tree"])` returns the original prompt, an empty image list, no mask, and no explicit output path. Assert that an empty or whitespace-only prompt is rejected before any HTTP request.

- [ ] **Step 2: Run the focused test and verify it fails for the missing module**

  Run `node --test tests/imagegen.test.mjs`. Expected result: RED with the missing `imagegen-core.mjs` import.

- [ ] **Step 3: Implement the minimal core and CLI**

  Read `config.json` beside the skill by default, or the path in `AUTOTHINK_IMAGEGEN_CONFIG`; reject placeholder/empty keys; normalize and validate HTTP(S) `base_url` and `proxy`. Build JSON generation requests with `model`, `prompt`, `quality: "auto"`, `size: "auto"`, `background: "auto"`, and `output_format: "png"`. Build multipart edits with repeated `image[]`, optional `mask`, the same scalar fields, and binary file contents. Use native Node HTTP clients with a bounded response reader, manual HTTP(S) redirects capped at five for result URLs, optional HTTP(S) proxy support, and no authorization header on result downloads. Accept `data[].b64_json` or `data[].url`, strictly decode/check PNG bytes, then save via `O_CREAT|O_EXCL` with suffixes such as `image-1.png` on collisions. Catch errors into redacted `ERROR:` lines without printing response bodies or keys.

- [ ] **Step 4: Run Node tests and verify GREEN**

  Run `node --test tests/imagegen.test.mjs`. Expected result: all generation, edit, download, validation, collision, and redaction tests pass.

- [ ] **Step 5: Commit the Node client**

  Run `git add skills/autothink-imagegen/scripts tests/imagegen.test.mjs` and `git commit -m "feat: add node image generation client"`.

### Task 3: Implement the Bounded Batch Entry Point

**Files:**
- Create: `skills/autothink-imagegen/scripts/imagegen-batch.mjs`
- Test: `tests/imagegen.test.mjs`

**Interfaces:**
- The CLI accepts repeated `--prompt` (2-5 values) and optional directory `--out`; it reuses the single-image CLI and the same config.
- It prints only `BATCH_RESULT: index=<n> SAVED: <absolute-path>` or `BATCH_RESULT: index=<n> FAILED`, followed by `BATCH_SUMMARY: success=<n> failed=<n>`.

- [ ] **Step 1: Add failing batch assertions**

  Assert that six prompts exit before the mock server receives any request, and that two prompts produce two result lines and one summary with bounded concurrent children.

- [ ] **Step 2: Run the batch tests and verify RED**

  Run `node --test tests/imagegen.test.mjs --test-name-pattern="batch"`. Expected result: RED because `imagegen-batch.mjs` is absent.

- [ ] **Step 3: Implement preflight, concurrency, and interruption handling**

  Parse all prompts before loading the API or starting a child. Reject fewer than two or more than five prompts. Run at most three `imagegen.mjs` child processes, preserve input indexes in reports, do not retry failures, and terminate active children on `SIGINT` before exiting with `130`.

- [ ] **Step 4: Run batch tests and the complete Node suite**

  Run `node --test tests/imagegen.test.mjs --test-name-pattern="batch"`, then `npm test`. Expected result: batch and prior Node tests pass without leaked key text.

- [ ] **Step 5: Commit the batch entry point**

  Run `git add skills/autothink-imagegen/scripts/imagegen-batch.mjs tests/imagegen.test.mjs` and `git commit -m "feat: add bounded image batch client"`.

### Task 4: Implement the Python Standard-Library Fallback

**Files:**
- Create: `skills/autothink-imagegen/scripts/imagegen.py`
- Test: `tests/python-imagegen.test.mjs`

**Interfaces:**
- `imagegen.py` accepts the same `--prompt`, repeatable `--image`, optional `--mask`, and `--out` flags.
- It reads the same config keys and emits the same `SAVED:`, `ERROR:`, `CONFIG_EDIT_COMMAND:`, and exit-code contract.

- [ ] **Step 1: Run the existing Python-focused test and verify RED**

  Run `node --test tests/python-imagegen.test.mjs`. Expected result: RED because `imagegen.py` does not exist.

- [ ] **Step 2: Implement the fallback with standard-library HTTP and filesystem APIs**

  Use `argparse`, `urllib.request`, `urllib.error`, `base64`, and `os.open`. Encode JSON and multipart requests, install a validated HTTP(S) proxy handler, cap response bytes and redirects, redact the API key in errors, verify PNG signatures, and use exclusive output creation with collision suffixes. Keep the Python implementation behaviorally equivalent to the Node CLI while avoiding third-party imports.

- [ ] **Step 3: Run Python syntax and integration tests**

  Run `python3 -m py_compile skills/autothink-imagegen/scripts/imagegen.py`, then `node --test tests/python-imagegen.test.mjs`. Expected result: syntax and mock generation tests pass.

- [ ] **Step 4: Commit the fallback**

  Run `git add skills/autothink-imagegen/scripts/imagegen.py tests/python-imagegen.test.mjs` and `git commit -m "feat: add python image generation fallback"`.

### Task 5: Add the Codex Skill Contract and Metadata

**Files:**
- Create: `skills/autothink-imagegen/SKILL.md`
- Create: `skills/autothink-imagegen/agents/openai.yaml`
- Create: `skills/autothink-imagegen/config.example.json`

**Interfaces:**
- `SKILL.md` must use lowercase hyphenated `name`, a `description` beginning with `Use when...`, and imperative instructions that direct Codex to the bundled scripts.
- `agents/openai.yaml` must contain deterministic `display_name`, `short_description`, and `default_prompt` values matching the skill.
- `config.example.json` contains placeholder values only.

- [ ] **Step 1: Run the skill validator before the skill exists and record RED**

  Run `python3 /Users/cero/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/autothink-imagegen`. Expected result: failure because the skill directory is not initialized yet.

- [ ] **Step 2: Initialize the skill scaffold**

  Run `python3 /Users/cero/.codex/skills/.system/skill-creator/scripts/init_skill.py autothink-imagegen --path skills --resources scripts --interface display_name="AutoThink Imagegen" --interface short_description="Generate and edit PNGs through AutoThink" --interface default_prompt="Use AutoThink image generation for this request."`. Keep only the required scaffold files and replace template placeholders before validation.

- [ ] **Step 3: Write the minimal skill instructions and configuration template**

  Tell Codex to choose generation when no input image is present and editing when one or more images are explicitly available; pass the user's prompt unchanged; ask for clarification instead of guessing a missing “recent image”; use `--mask` only with an edit image; call only `imagegen.mjs` or `imagegen-batch.mjs`; explain configuration through a local copy of `config.example.json` without asking the user to paste a key; hide protocol lines and response bodies from the user; and report saved image paths or attach the saved PNG. Include the recent-result/reference mapping and the non-goals from the approved session design.

- [ ] **Step 4: Validate metadata and scan for secrets/placeholders**

  Run `python3 /Users/cero/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/autothink-imagegen`, `rg -n "TODO|TBD|replace-with|api[_-]?key|Bearer" skills/autothink-imagegen`, and `git diff --check`. Placeholder matches are allowed only in `config.example.json` and the explicit configuration instructions; no real credential or generated output may be present.

- [ ] **Step 5: Commit the skill metadata**

  Run `git add skills/autothink-imagegen/SKILL.md skills/autothink-imagegen/agents/openai.yaml skills/autothink-imagegen/config.example.json` and `git commit -m "docs: package autothink imagegen skill"`.

### Task 6: Complete Verification and Handoff

**Files:**
- Modify: `.codex/task-states/20260903-165051-01a06676-29f1-7123-898c-7965afd98359.md`

- [ ] **Step 1: Run the complete local verification suite**

  Run `npm test`, `python3 -m py_compile skills/autothink-imagegen/scripts/imagegen.py`, `npm run validate`, and `git diff --check`. Expected result: all tests pass, validator reports valid, and the diff has no whitespace errors.

- [ ] **Step 2: Forward-test the installed skill behavior**

  Run one fresh-context validation prompt against the completed skill: “用 AutoThink 生成一张赛博城市图，保存后把结果返回。” Verify the instructions select `imagegen.mjs`, preserve the prompt, and do not request a pasted key or claim support for MCP. Do not make a real API call; inspect the selected command and local mock results only.

- [ ] **Step 3: Scan repository state**

  Run `git status --short --branch`, `git log --oneline --decorate -8`, and `git ls-files | rg '(^|/)(config\.json|output/|node_modules/)'`. Expected result: only intended source/test/docs files are tracked, local config/output paths are ignored, and the feature branch contains the implementation commits.

- [ ] **Step 4: Update and verify the recovery snapshot**

  Record the completed goal, decisions, current phase, changed files, verification results, remaining risks, and next action in the exact eight Chinese fields required by the repository instructions. Re-read the full snapshot, confirm it is ignored and untracked, and confirm it contains no credentials.

- [ ] **Step 5: Commit any final source change and report handoff**

  If verification required a source correction, run the focused failing test first, then the complete suite, and commit it. Report branch `codex/autothink-imagegen`, worktree path `/Users/cero/Project/autothink-skills/.worktrees/autothink-imagegen`, validation commands, and that no merge into `main` was performed.
