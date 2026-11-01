# Style system

Two modes, one vocabulary. Every number here is already wired into the starter project's
`index.html` `:root` — change a token once and all scenes follow.

## 1. Tokens

### deck (深色幻灯片)

| Token | Value | Use |
| --- | --- | --- |
| `--deck-bg` / `--deck-bg-hi` / `--deck-bg-lo` | `#14181F` / `#232B36` / `#0E1116` | radial ground: lighter behind the content, vignetted edges |
| `--deck-ink` | `#F2F4F7` | headline and primary text |
| `--deck-body` | `#C6CDD6` | supporting sentence, bullets |
| `--deck-mute` | `#8B95A3` | axis labels, captions, secondary columns |
| `--deck-faint` | `#6C7684` | fine print, disclaimer |
| `--deck-panel` | `rgba(255,255,255,.045)` | card / chart background |
| `--deck-line` | `rgba(255,255,255,.14)` | hairlines, dividers, chart axis |

### semantic (both modes)

| Token | Value | Meaning — never decorative |
| --- | --- | --- |
| `--mt-red` | `#E5342A` | 风险、下跌、问题、反方 |
| `--mt-green` | `#35C46B` | 机会、上涨、结论、可执行 |
| `--mt-gold` | `#F5B02E` | 中性强调、关键数字、行动 |

### whiteboard (手绘白板)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#F7F5EF` | paper ground |
| `--ink` | `#232323` | marker black |
| `--mark-red` / `--mark-green` / `--mark-blue` | `#D8352A` / `#1F9D55` / `#2F6FD0` | the marker colours |
| `--paper-ink-soft` | `#6B6B6B` | small handwritten note |

Rules:

- One semantic colour per idea. If a card needs red and green, they are two sides of a comparison, not
  decoration.
- Gold is the only highlight on a number. Cyan is not part of this palette (that is a different channel).
- `style-lint` fails any literal hex outside `:root`, on purpose.

## 2. Type

| Role | Family | Weight | Size (1920x1080) |
| --- | --- | --- | --- |
| 本期卡标题 | Noto Sans SC | 900 | 140-160px |
| 场景主标题 | Noto Sans SC | 900 | 64-96px |
| 章节数字 | Oswald | 700 | 200-240px |
| 正文 / bullets | Noto Sans SC | 500-700 | 34-44px |
| 数据大数字 | Oswald | 700 | 140-200px |
| 坐标轴 / 图注 | Noto Sans SC | 500 | 26-30px (≥28 where it must be read) |
| 白板手写 | ZCOOL KuaiLe | 400 | 64-110px |
| 字幕 | Noto Sans SC | 700 | 46px，描边 5px |
| 角标 | Noto Sans SC | 700 | 28px，字距 .12em |

- Never below **28px**. If it does not fit, cut words.
- Latin and digits inside a headline stay in Noto; **big numbers switch to Oswald** (condensed, tall).
- A headline is a claim, not a label: `同一个 PE，三种命运`, not `关于 PE 的说明`.
- A subtitle line is one breath: ≤24 characters, no full stop needed.

## 3. Layout

Deck, 1920x1080:

- Margins 120px. Headline at y=110-200, divider at y≈200, content from y=250.
- Divider = 1px `--deck-line` spanning 120→1800, with a 132px × 3px segment of the accent colour at the
  left end. That two-tone rule is the signature header treatment.
- Panels: radius 14-16px, 1px `--deck-line`, `--deck-panel` fill, content padding 32-40px.
- Charts sit in a panel; the axis line is 1px `--deck-line`; bars use the semantic colours.
- The visual goes **bottom-right**, the figure/illustration **bottom-left**, the text top. That
  diagonal is what makes a dense analysis slide readable.
- Safe area: keep anything a viewer must read inside 1536x864. Subtitles live at y≈930-990.

Whiteboard:

- 96-130px margins, content hung on a loose baseline grid, nothing perfectly centred.
- Section tag top-left in red handwriting (`01 / 分母陷阱`).
- One formula or one diagram per card, 100-110px handwriting, plus at most two annotations.
- A red hand-drawn ellipse around the word that matters; a stamp box for the takeaway.

## 4. Motion

| Move | Recipe | Where |
| --- | --- | --- |
| Rise | `fromTo(el, {opacity:.001, y:30}, {opacity:1, y:0, duration:.34, ease:"expo.out"})` | headlines, cards |
| Draw | `fromTo(path, {strokeDasharray:L, strokeDashoffset:L}, {strokeDashoffset:0, duration:.6-.9, ease:"power1.inOut"})` | rules, circles, arrows, chart lines |
| Grow | `fromTo(bar, {scaleY:0}, {scaleY:1, duration:.5, ease:"power3.out", stagger:.1})` | bars, panels |
| Slide | `fromTo(row, {opacity:.001, x:-34}, {opacity:1, x:0, duration:.28})` | list rows |
| Flash | `fromTo(flash, {opacity:.35}, {opacity:0, duration:.18})` | section cards |
| Hand | marker travels left→right in the same window as the stroke draw | whiteboard only |

- Eases: `expo.out`, `power3.out`, `power2.inOut`. **Never** elastic, bounce, or a spin.
- Every scene's first element starts at 0 — a cut shows its content immediately.
- One slow push-in per scene (`scale 1 → 1.02-1.025` over the scene length) so nothing is static.
- Nothing animates longer than 0.9s except a chart draw.

## 5. Subtitles and watermark

- Subtitles: one line, bottom-centre, `bottom: 96px`, 46px/700, white with a 5px `rgba(0,0,0,.86)`
  stroke (`paint-order: stroke fill`). Hard cut in and out — no fade, no per-word highlight.
- The same subtitle style is used over paper and over the deck; do not invert it on the whiteboard.
- Watermark: `.wm`, top-right (56px, 46px), 28px, 700, `.12em` tracking, `rgba(255,255,255,.46)`; on the
  whiteboard add `.on-paper` (`rgba(35,35,35,.42)`).
- The watermark is per-scene, not a global overlay — the whiteboard needs the dark variant.

## 6. Sound

The channel is **voice-first, no music bed**. That is unusual and worth keeping:

| Element | Level | Where |
| --- | --- | --- |
| VO | 0 dB reference | the whole film |
| whoosh-short | 0.22 | every cut, ±0.35s |
| pop | 0.20 | a number or badge landing |
| impact | optional, 0.25 | the hook and the final line, twice max |

If the person wants music, put a quiet bed at ~0.10-0.14 — never louder than that, and never under the
VO's first and last sentence.

## 7. Do not

- White or light slides (except the whiteboard segment), glassmorphism, drop shadows on text.
- Icon grids, three cards in a row, bullet walls with more than 5 rows.
- Cyan, purple, or brand gradients as accents.
- Red as decoration, green for anything that is not "good", gold on whole paragraphs.
- A number without a source line, a price target, a promised return.
- A film that ends without 不构成投资建议.
- The channel's logo, its exact brand assets, or a claim that the video is theirs.
