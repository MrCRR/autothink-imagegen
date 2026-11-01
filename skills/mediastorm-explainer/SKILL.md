---
name: mediastorm-explainer
description: Use when someone wants a Chinese tech/product explainer video in the 影视飓风 (Media Storm) house style — a hook to promise to chapters to payoff to CTA structure with near-black frames, giant heavy Chinese type, amber/cyan accents, hard cuts and a sound effect on every cut. Trigger on "影视飓风风格", "复刻影视飓风", "Media Storm style", "B站科技讲解视频", "数码测评视频开场/章节卡/数据卡", or any request to restyle an explainer with that look.
---

# MediaStorm Explainer

Turn a topic into a 影视飓风-style Chinese explainer built on HyperFrames: written script first, then
cards, then sound, then render. This skill is the style system plus a working 30-second starter project.

**Read `/hyperframes` first.** That skill owns the render contract, `check`/`snapshot`/`render`, and the
`preview`-before-`render` rule. This skill only adds the house style and its scaffolding — it never
replaces the HyperFrames work loop.

## What is being copied (and what cannot be)

The look is about 60% live footage: macro product shots, slow motion, test rigs, test-bench footage.
HTML motion graphics carry the other 40%: **type system, chapter cards, data cards, annotations,
transitions, sound, edit rhythm**. Build that 40% first. If the person has footage, put it behind the
cards (`references/production.md`); never fake a test rig with CSS.

Match the *system*, not the logo. Do not draw the 影视飓风 logo or copy its brand assets.

## House rules (violating these is what makes it look generic)

| Rule | Value |
| --- | --- |
| Palette | Only `var(--ms-*)` tokens from `index.html` `:root`. Near-black ground, near-white ink, one amber accent, cyan only for data. |
| Type | Chinese display in Noto Sans SC 900; numbers in Oswald 700. Title 128-200px, data number 300px+, body 44-56px, **nothing under 28px**. |
| Layout | 112px margins, left-aligned, one idea per card. Type lives in the left 2/3; the right side can bleed. |
| Motion | 0.10-0.34s, `expo.out` / `power4.out`. Snap in, never bounce, never float, never rotate in. One slow push-in (scale 1 -> 1.02-1.035) per card so nothing sits still. |
| Cuts | Hard cuts only. Every cut needs a whoosh within ±0.35s. No crossfades, no wipes between cards. |
| Sound | VO is the clock. BGM 26-30 dB under the voice (volume ~0.14). SFX volume 0.24-0.34. Riser/impact once, at the payoff. |
| Rhythm | Shot 1.5-3s, chapter card 1.2-2s, data card 3-5s, hook 0.6-1.5s per shot. |
| Honesty | Every number traces to a source line on screen. No invented figures. |

Full spec, including the type scale, motion vocabulary and the do-not list: `references/style-system.md`.

## Workflow

### 0. Decide the shape (ask once, then run)

Need: topic, audience, duration, aspect (16:9 B站 / 9:16 抖音), footage yes/no, voice (recorded / TTS /
none). Default for a first pass: **30s, 16:9, no footage, no VO** — a style sample the person can approve
before you write 3 minutes of script.

### 1. Write the script before any HTML

`references/script-formula.md`. Produce `SCRIPT.md` in the project: hook, promise, 2-4 chapters with the
four-beat chapter (提问 -> 演示 -> 数字 -> 小结), payoff, CTA. VO at 4.5-5.5 字/秒 gives every scene its
duration — the voice is the clock, not the other way round.

If the person gave no VO, the on-screen lines are the clock: 0.5s + 0.3s per word.

### 2. Scaffold

```bash
node "<SKILL_DIR>/scripts/new-project.mjs" videos/<project> --title "片名" --duration 30
```

Copies the starter project (6 scenes, tokens, fonts, SFX) and writes `SCRIPT.md`. Then:

- `references/scene-library.md` — pick a scene archetype per script beat, copy its markup contract.
- Keep `data-var-text` on every line a person would want to change in Studio.

### 3. Fill the scenes

One sub-composition per scene in `compositions/`, mounted in `index.html` with `data-composition-src`.
Every scene: `<template>` wrapper, `#root`, one paused timeline registered on `window.__timelines`.

Fonts: the shipped `assets/fonts/NotoSansSC-VF.woff2` covers GB2312 level-1 plus the style's symbols. If
a character is missing (rare names, place names), `node "<SKILL_DIR>/scripts/setup-fonts.mjs" . --text "那几个字"`
rebuilds the subset from the project's own text.

### 4. Sound

`references/production.md` § sound. Minimum bar for a 30s card film: whoosh on every cut, impact on the
hook and the payoff, click when a number lands. BGM if the person has a track; silence is better than a
guessed bed.

### 5. Gate before showing anything

```bash
node "<SKILL_DIR>/scripts/style-lint.mjs" .      # palette, type floor, glyphs, SFX on cuts
npx hyperframes check --json                     # lint + runtime + layout + contrast
npx hyperframes snapshot --at <each scene midpoint>   # look at every card
```

Both linters must be clean (warnings weighed, not ignored). Then `preview` and hand over the URL —
never render until the person approves the preview or asks for the file.

## Scene archetypes

| Beat | Archetype | File in the starter |
| --- | --- | --- |
| Hook | Giant claim, accent on the twist, one underline | `s01-hook.html` |
| Promise | Three numbered rows, value column in cyan | `s02-promise.html` |
| Chapter | Outlined `01` bleeding, title, short note | `s03-chapter.html` |
| Data | One huge number, two comparison bars, source line | `s04-data.html` |
| Compare | Split frame, grids/screens, red callout underline | `s05-compare.html` |
| Payoff | Two lines, second line dimmed, CTA row | `s06-outro.html` |

Twelve more (quote card, timeline, before/after, spec table, product callout with leader line, verdict
stamp) are specified in `references/scene-library.md` with layout numbers and choreography.

## Failure modes this skill exists to prevent

- Six cards of bullets and icons in circles — the style has no icon grid, no bullet slides.
- A card that holds still for 4s with no move — every shot pushes in or changes.
- Amber used on whole paragraphs — accent is for one keyword or one number per card.
- Type under 28px "so it fits" — cut a word instead.
- A whoosh on some cuts only — that is the single most audible tell.
- Numbers with no source line — the style is confident, not unsourced.
- Recreating real footage or a real test rig in CSS — say what is missing instead.
