# Scene library

Each archetype is one sub-composition: `<template>`, `<div id="root" data-composition-id="...">`, one
paused timeline on `window.__timelines["<id>"]`. The six marked **[shipped]** are in
`templates/project/compositions/` as working code — copy the file and rewrite the text. The rest are
specs: build them from the same primitives (title / kicker / rule / row / number / source).

Every card carries: a kicker (English, 30px, `--ms-mute` or `--ms-amber`), the content, and — when it
shows a number — a source line at the bottom left.

---

## 1. Hook — giant claim **[shipped `s01-hook.html`]**

- Kicker at (112, 126), 30px, `letter-spacing: .34em`, cyan.
- Hero at (106, 292), 200px/900, `line-height: .98`, `letter-spacing: -.045em`. The claim word in
  `--ms-amber`; `≠` in Oswald or amber.
- A 8px amber rule under the whole hero: `scaleX 0 -> 1`, `.36s power4.inOut`, at `t=.30`.
- Supporting line at (112, 636), 56px/500; the flipped value in 900 weight.
- Hairline + source line at the bottom.
- Choreography: kicker `t=0`, hero words slam `t=.08` stagger `.06`, rule `.30`, support `.46`,
  hairline `.56`, source `.66`. Push-in over the full scene.

## 2. Promise — three numbered rows **[shipped `s02-promise.html`]**

- Title at (106, 206), 128px/900; the reversal word in amber.
- Rows start at y=452, 150px each, 1px `--ms-line` separators.
- Row: number (Oswald 56, amber, x=0) / label (66px/900, x=130) / value (40px/500, right-aligned,
  900-weight accent in cyan).
- Choreography: title `.04`, each row slides in from `x:-40` at `.44 + i*.22`, values fade `.56`
  stagger `.22`.

## 3. Chapter card — outlined number **[shipped `s03-chapter.html`]**

- Outlined `01` at 820px Oswald, `-webkit-text-stroke: 3px rgba(255,255,255,.14)`, bleeding off the
  right edge (`right: -40px`), `data-layout-allow-overflow`.
- Kicker at (112, 340); title at (106, 412), 168px/900; 8px amber rule at y=686 (760px wide);
  one-line note at y=740, 40px `--ms-quiet`.
- 1-2 frame `--ms-flash` at `t=0` (`opacity .5 -> 0` in `.16s`), ghost slides in from `x:140`.
- Total 1.2-2.0s. This card is a beat, not a section header to read.

## 4. Data callout — one number + two bars **[shipped `s04-data.html`]**

- Kicker at (112, 118): `实验 01 / 单像素面积`.
- Number at (104, 186), Oswald 300. Split it for meaning: `1` white, `/4` amber.
- Caption at (112, 496), 44px/500; the conclusion word in 900.
- Two bars: name + value in the left gutter (x=0, 36px/900 and Oswald 46), track from x=430 to the
  right margin, 56px tall, fill in amber (first series) and cyan (second series).
- Choreography: number slams `.04`; caption `.30`; values `.46`; fills `scaleX 0 -> 1` at `.58` and
  `.78` (staggered so the comparison reads left then right).
- Source line bottom-left, 28px. Always.

## 5. Compare — split frame **[shipped `s05-compare.html`]**

- Two halves. Left cool (`--ms-press`), right warm (`--ms-press-warm`), both fading to `--ms-paper`.
- Head at y=116: name 36px/900 (amber left, cyan right) + a 28px spec line under it.
- Panel: 500x500 at y=282. A 1px border box plus a CSS grid whose `background-size` encodes the value
  (e.g. 25px cells vs 50px cells is a 4x area difference — the picture is the argument).
- A 1px centre divider (`scaleY 0 -> 1`), a `VS` disc at y=480 (96px circle, `back.out`).
- Unit note under each panel at y=812, 30px `--ms-quiet`.
- Red callout at the bottom: 3px `--ms-red` line (`scaleX`), then a 46px/900 sentence with the
  conclusion word in red. This is the only place red is allowed on a compare card.

## 6. Payoff / outro **[shipped `s06-outro.html`]**

- Brand lockup at (112, 118), Oswald 28, `letter-spacing: .34em`, `--ms-mute`, episode in amber.
- Line 1 at (106, 292), 136px/900, accent on the answer.
- Line 2 at (106, 452), same size, in `--ms-dim` — this is the contrast that carries the whole video.
- 6px amber rule at y=664 (`scaleX`), CTA at y=712, 42px/900 with amber `·` separators.
- `NEXT / 02 xxx` bottom-right, Oswald 28.
- Warm glow bottom-centre, the only bright background in the film.

---

## 7. Quote card

- A verbatim line from a source, set as a poster: 96px/900, max 3 lines, left-aligned at 112px.
- Above: a 30px kicker with the speaker. Below: the source line.
- No quotation marks as decoration; no oversized “ ” glyph.
- Motion: line-by-line `x:-30` slide, `.28s`, stagger `.09`. No typewriter.

## 8. Spec table

- 4-6 rows, 96px tall, 1px hairlines. Column A = parameter (36px/500 `--ms-quiet`), column B = value
  (44px/900). The winning value in amber, the losing one in `--ms-dim`.
- Rows enter with a `.06s` stagger from `x:-24`; the winner gets one extra beat: a 2-frame flash on its
  value and a click.
- Never a zebra-striped table; never a border on every cell.

## 9. Before / after

- One frame, two states. Split at 50% with a 1px line, or wipe with `clip-path: inset(0 X% 0 0)`.
- Labels `BEFORE` / `AFTER` in the top corners, 30px Oswald, second one amber.
- Motion: the wipe is `.5s power4.inOut` with a whoosh; hold each state at least 1.2s.

## 10. Product callout (needs footage or a still)

- `<img>` or `<video>` full-bleed, graded dark (`media-treatment`, never CSS filters).
- A 1px `--ms-line` leader from the label to the exact point, plus a 64px circle (2px stroke) around it.
- Label at the end of the leader: 34px/900 for the part name, 26-28px `--ms-mute` for the spec.
- Motion: leader `scaleX/scaleY 0 -> 1` (`.22s`), circle `scale .6 -> 1` (`back.out`), label fade last.
  Camera: slow push-in on the plate (1.0 -> 1.06).

## 11. Timeline / process

- A horizontal 2px `--ms-line` at y=560; 3-5 nodes; each node a 20px amber square (not a circle).
- Time labels above in Oswald 40, event labels below in 36px/900.
- The line draws `scaleX 0 -> 1`, nodes pop in order (`.12s` stagger, `back.out(2)`), the current node
  keeps a 2s pulse via a child element's scale — never the clip itself.

## 12. Verdict stamp

- The conclusion, struck like a stamp: 120px/900, rotated `-3deg`, in amber, over a dimmed product
  still or a dim grid.
- Behind it, a 1px rule that sweeps. Enter with `scale 1.4 -> 1` and `opacity 0 -> 1` in `.18s`
  `expo.out` plus an impact — this is a payoff-only card, twice per video at most.

---

## Building a new archetype

1. Copy the closest shipped file; keep `<template>`, `#root`, the `window.__timelines` line.
2. Take colours from tokens only (`style-lint` fails literal hex).
3. Keep the scene's first element at `t=0` and add a full-length push-in so nothing is static.
4. Add the source line if a number appears.
5. `node <SKILL_DIR>/scripts/style-lint.mjs .` then `npx hyperframes snapshot --at <midpoint>` and look.
