---
name: meitou-explainer
description: Use when someone wants a Chinese finance/market explainer video in the 美投讲美股 (MeiTouJun) house style — a 15-25 minute voice-over analysis built from dark keynote slides, hand-drawn whiteboard segments, red/green/gold semantics, burned-in subtitles and a numbered 本期 / 结论 / 为什么 / 风险 / 如何投资 / 免责 structure. Trigger on "美投君风格", "复刻美投讲美股", "MeiTouJun style", "美股分析视频", "财经口播视频", "白板手绘财经讲解", or a request to restyle a market/company explainer that way.
---

# MeiTou Explainer

Turn a market or company topic into a 美投君-style Chinese finance explainer on HyperFrames: script
first, then slides, then the whiteboard segment, then voice and burned-in subtitles.

**Read `/hyperframes` first.** That skill owns the render contract, `check` / `snapshot` / `render` and the
`preview`-before-`render` rule. This skill adds the house style, the finance structure and its scaffolding.

## The two visual modes

The channel uses both, sometimes in one video:

| Mode | Look | Use for |
| --- | --- | --- |
| **deck** (深色幻灯片) | near-black gradient ground, white headline, panels, charts, big numbers, gold/red/green accents | company analysis, macro, data, section headers, the outro |
| **whiteboard** (手绘白板) | paper background, handwriting, a marker drawing live, hand-drawn circles/arrows/brackets | one concept explained from first principles, a formula, "why this happens" |

A 20-minute video is roughly 80% deck and 20% whiteboard: one whiteboard segment per conceptual
detour. Do not build the whole film in one mode.

## House rules

| Rule | Value |
| --- | --- |
| Ground | `--deck-bg` gradient only. No white slides, no bright backgrounds, except the whiteboard segment. |
| Type | Noto Sans SC 700-900 for everything on deck; **ZCOOL KuaiLe** for whiteboard handwriting. Body 34-44px, headline 56-96px, hero number 140-200px, **nothing under 28px**. |
| Colour semantics | **红 = 风险/下跌/问题**, **绿 = 机会/上涨/结论**, **金 = 中性强调/行动**. One role per colour; never use red for decoration. |
| Layout | headline top-left, divider under it, content below. Put the visual bottom-right, the "character/illustration" bottom-left. |
| Motion | 0.24-0.42s, `power3.out` / `expo.out`. Bars grow, rules draw, rows slide in. No bounce, no float, no spin. |
| Cuts | hard cuts with a whoosh. No crossfade between scenes. A white flash ≤ 0.2s is allowed on a section card. |
| Subtitles | **burned in, one line, bottom-centre, ≤ 24 characters**. White with a dark stroke (the same style over deck and paper). |
| Watermark | every scene carries a corner mark (`.wm`), top-right, 28px, ~45% opacity. |
| Sound | VO only — no music bed by default (that is the channel's actual mix). SFX: whoosh on cuts, one pop on a number landing. |
| Compliance | every number traces to a source; no price targets, no "buy now", no promised returns; **every film ends with 不构成投资建议**. |

Full numbers: `references/style-system.md`.

## Workflow

### 0. Lock the shape

Need: topic, instrument (single stock / sector / macro), duration, platform, and whether data is real or
illustrative. Default: **45s style sample, 16:9, illustrative numbers clearly labelled 示意图** — approve
the look before writing a 20-minute script.

### 1. Script first (`references/script-formula.md`)

Fixed spine, 15-25 minutes:

```
本期卡  4s       「本期：<标的>」+ 一句定位
钩子    7-12s    冲突：一个红色问题 + 一个反常识数字
结论    60-90s   先给判断，再给三个理由
正文    3-6 节   每节：现象 -> 数据 -> 图解 -> 判断（四拍）
风险   30-60s    反方与失败条件
如何投资 60-90s  可执行 3 条（不是买卖点位）
收口    5-10s   一句话 + 免责声明
```

VO at 4.5-5.5 字/秒; one sentence = one subtitle line. The script is written before any HTML.

### 2. Scaffold

```bash
node "<SKILL_DIR>/scripts/new-project.mjs" videos/<project> --title "市盈率 PE" --duration 45
```

Ships a working 43s example: deck scenes, one whiteboard scene, subtitles, watermark, SFX, both font
subsets, a `vo.sample.srt`, and a 1280x720 `thumbnail/` project.

### 3. Fill the scenes

One sub-composition per beat in `compositions/`, mounted in `index.html`. Archetypes and their numbers:
`references/scene-library.md`. Colours come from tokens only.

### 4. Voice and subtitles

`references/production.md`. Short version: record or TTS the VO, transcribe to SRT, then

```bash
node "<SKILL_DIR>/scripts/subtitles.mjs" vo.srt      # 写 compositions/subtitles.html
```

The generator splits long sentences at punctuation, caps a line at 24 characters, and spreads each cue's
window by character count.

### 5. Thumbnail

`templates/thumbnail/` is a 1280x720 standalone project: black band, one line of heavy type with two
coloured keywords, cinematic background, corner badge. `references/thumbnail.md` for the rules.

### 6. Gate

```bash
node "<SKILL_DIR>/scripts/style-lint.mjs" .   # 令牌 / 字号 / 字体缺字 / 切点音效 / 角标 / 免责声明
npx hyperframes check --json
npx hyperframes snapshot --at <每个场景的中点>
```

Then `preview` and wait for approval. Never render unasked.

## Failure modes this skill prevents

- White slides, drop shadows, gradients on text — not this channel.
- Bullet walls where a diagram belongs: this style explains with **arrows, panels, bars and a drawn
  circle**, not with a list of sentences.
- Red used as decoration: red means risk in every frame.
- A number with no source, a "目标价", or a return promise — the style is confident but sourced.
- Missing subtitles: the burned-in line is part of the look, not an accessibility afterthought.
- A film without the disclaimer.
- Imitating the channel's logo or presenting the output as theirs.
