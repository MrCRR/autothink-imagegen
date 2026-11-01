# Scene library

Every scene is one sub-composition: `<template>`, a root with `data-composition-id`, one paused timeline
on `window.__timelines["<id>"]`. **[shipped]** files are in `templates/project/compositions/`; copy and
rewrite the text. The rest are specs built from the same primitives.

Each card carries the corner watermark (`.wm`), and the film carries the subtitle track.

---

## Deck mode

### 1. 本期卡 **[shipped `s01-title.html`]**

- Centred: `INVESTING 101` kicker (Oswald 28, `.42em`), `本期` (gold, 34, `.5em`), the subject at 152px/900.
- 3px gold rule 400px wide under the subject; `取自 《系列》` at 40px `--deck-mute`.
- Choreography: kicker at 0, title `.04`, rule `.5` (`scaleX`), source `.62`. Push-in 1 → 1.02 over 4s.

### 2. 钩子 **[shipped `s02-hook.html`]**

- Left: the conflict at 96px/900 in **red**, on two lines, then a white supporting line with the accent
  words in gold.
- Right: a gauge (`svg` arc, gold fill drawn with dash offset, big Oswald number inside).
- Bottom-left: a panel `本期问题 / 低 PE → 真的低估值?`.
- Everything else — chart screenshots, a 3D object — goes bottom-right in later beats.

### 3. 章节卡 **[shipped `s03-section.html`]**

- `01` in Oswald 240 gold at the left, the section title at 128px/900 next to it, one line of setup under.
- A 1px divider spans the frame; a 0.18s white flash at `t=0`.
- 3 seconds max. It is a beat, not a slide to read.

### 4. 数据卡 **[shipped `s05-data.html`]**

- Header at 64px/900 with the key phrase in gold, two-tone divider under it.
- A panel containing bars: 4 series, 168px wide, 56px gaps, heights proportional, colours by meaning
  (grey = neutral, green = good, gold = attention, red = risk).
- Value labels above each bar in Oswald 42; category labels below in 30px `--deck-mute`.
- A dashed red box around the bar that carries the point, a source line at the bottom left, and a
  red-bordered callout bottom-right.
- Choreography: header 0, bars `scaleY 0→1` at `.45` stagger `.1`, box `.115`, callout `1.7`, source `1.9`.

### 5. 判断列表 **[shipped `s06-verdict.html`]**

- Header in **green** (`怎么用 三步过筛`), two-tone divider.
- 3-5 rows, 150px tall, 1px separators. Layout per row: `STEP n` in gold (34), title 44/700, detail 30 in
  `--deck-mute`, a green `✓ 动作` at the right edge.
- Rows slide in from `x:-34` at `.3s` stagger; the checks pop with `back.out(2)`.

### 6. 收口 **[shipped `s07-end.html`]**

- One line at 96px/900, the answer in gold; a second line at 46 `--deck-body` for the next episode.
- `NEXT / 02 现金流陷阱` at 34, disclaimer at 28 in `--deck-faint` at the bottom.
- Warm gold glow bottom-centre is allowed here and only here.

### 7. 图表截图卡

- A white screenshot in a panel (`border-radius: 10px`, shadow), 900-1100px wide, placed bottom-right.
- 1-3 annotations drawn **on top**: a 3px red circle around the point, a range highlight (semi-transparent
  gold rect), a text label in 30px with a leader line.
- Caption under the image: `图：<来源> / <口径>`.
- Choreography: panel fades at `.2`, annotations draw at `.8`-`1.4`, each with a click SFX.

### 8. 对比卡（A vs B）

- Two panels side by side (split at 50%), each with a label bar at the top: left red `风险`, right green
  `机会`, or `过去` / `现在`.
- 3-4 metric rows inside each panel, value right-aligned; the winning row gets a gold value.
- Panels slide in from opposite sides (`.3s`), rows stagger `.08`.

### 9. 三档情景（牛/基准/熊）

- Three columns, 380px each: 乐观 / 中性 / 悲观, each with a gold/white/red header, a big number, and two
  lines of assumption.
- Columns rise with `y:40 → 0`, `.1s` stagger; the middle (基准) gets a thin gold border.

---

## Whiteboard mode

### 10. 公式卡 **[shipped `s04-whiteboard.html`]**

- Paper ground + static grain dots + a soft vignette (never animated).
- Section tag top-left in red handwriting: `01 / 分母陷阱`.
- The formula at 104px handwriting: operands in black, the variable in blue, the term under attack in red.
- A red hand-drawn ellipse around that term, drawn with `strokeDashoffset` over 0.78s while the marker
  travels left→right above it.
- Two handwritten notes underneath (66px and 42px), one word in red; a red stamp box at the right
  (`先看分母`) that lands with `scale 1.35 → 1` and `rotation -8 → -3`.

### 11. 流程图卡（白板）

- 3-5 rounded rectangles (blue outline, no fill) connected by hand-drawn arrows; each box holds 4-8
  handwritten characters.
- Draw order = reading order: box 1, arrow, box 2 … Each arrow draws in 0.25s right after its box.
- A red `✗` or a red circle marks where the flow breaks.

### 12. 循环图卡（白板）

- A circle of 3-4 nodes with curved arrows (a loop), centre label 6-10 characters.
- The loop is drawn clockwise; the arrowheads land last. Used for "why it keeps happening" beats.

### 13. 数字对比（白板）

- Two hand-drawn bar stacks or two bags of coins (circles), sizes proportional, with handwritten numbers.
- The losing side gets a red strike-through; the winner a green check.

---

## Building a new archetype

1. Copy the closest shipped file; keep `<template>`, the root id, and `window.__timelines`.
2. Colours from tokens only (`style-lint` fails literal hex).
3. Add `.wm` (or `.wm.on-paper` on whiteboard cards).
4. First element at `t=0`; add a slow push-in; keep every entrance ≤ 0.42s.
5. `node <SKILL_DIR>/scripts/style-lint.mjs .` then `npx hyperframes snapshot --at <midpoint>` and look.
