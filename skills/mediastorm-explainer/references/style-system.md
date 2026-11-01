# Style system

The numbers behind the look. Everything here is already wired in the starter project's
`index.html` `:root`; change a token once and every scene follows.

## 1. Palette

| Token | Value | Use |
| --- | --- | --- |
| `--ms-paper` | `#0A0C0F` | ground. Never pure black, never grey. |
| `--ms-ink` | `#F4F6F8` | display type, the one line the viewer should read. |
| `--ms-body` | `#C9D1DA` | supporting sentence under a title. |
| `--ms-quiet` | `#9AA3AE` | secondary values, right-hand columns. |
| `--ms-mute` | `#767F8B` | source lines, kickers, English sub-labels. |
| `--ms-dim` | `#5A636E` | the "wrong idea" line, de-emphasised half of a contrast. |
| `--ms-amber` | `#FFB020` | **the accent.** One keyword or number per card. Chapter rules, underlines. |
| `--ms-cyan` | `#38E1FF` | data only: bars, second series, technical labels. |
| `--ms-red` | `#FF3B30` | a correction, a "this is wrong" underline, a contrast callout. |
| `--ms-line` | `rgba(255,255,255,.14)` | hairlines, row dividers. |
| `--ms-press` / `--ms-press-warm` | `#161C24` / `#1C1710` | the two halves of a split frame. |
| `--ms-flash` | `#EAF6FF` | 1-3 frame exposure flash on a hard cut. |

Rules:

- **One accent per card.** Two amber elements at the same size means neither is the point.
- Amber is type or a rule, not a background block behind a paragraph. A short amber rule under a
  headline is the house underline.
- Cyan appears only where there is data (bar, value, series label). Never for prose.
- Red only when the card says "this is wrong" or draws a correction line.
- Backgrounds are gradients at 8-13% alpha over `--ms-paper`: a cool glow top-right, a warm glow
  bottom-left. Two at most; a third reads as decoration.
- Every colour is a token. `style-lint` fails a literal hex outside `:root`.

## 2. Type

Two families only.

| Role | Family | Weight | Size (1920x1080) |
| --- | --- | --- | --- |
| Hero claim | Noto Sans SC | 900 | 180-220px, `letter-spacing: -.045em`, `line-height: .96` |
| Scene title | Noto Sans SC | 900 | 128-168px |
| Data number | Oswald | 700 | 280-360px (it is condensed: it stays readable when huge) |
| Row label | Noto Sans SC | 900 | 60-72px |
| Supporting line | Noto Sans SC | 500 | 44-56px |
| Value / secondary | Noto Sans SC | 500 | 36-42px |
| Kicker (English) | Oswald | 500 | 30px, `letter-spacing: .30-.34em`, uppercase |
| Source line | Noto Sans SC | 500 | 28-30px, `--ms-mute` |

Hard floor: **28px**. That is 2.6% of the short side — the smallest line a phone viewer can read. If a
line does not fit, delete words; never shrink below it. `style-lint` fails it.

Latin and digits inside a Chinese line stay in Noto (it has good Latin). Big numbers, years, percentages
and units switch to Oswald: `4K`, `1080P`, `1/4`, `99%`. That contrast is a large part of the look.

Sentence shapes:

- A title is a claim, not a label: `像素不是画质`, not `关于像素的说明`.
- Two lines maximum. The second line can be dimmed `--ms-dim` to make the contrast land.
- The accent goes on the word that flips the meaning: `决定画质的，是 <amber>进光量</amber>`.
- Kicker above the title, source line under the content — both small, both always present on data cards.

## 3. Grid

- Canvas 1920x1080. Margins **112px** left/right, 108px bottom, 118-126px top for the kicker.
- Everything left-aligned on the 112px line. Centred layouts read as a slide deck, not as this style.
- Type occupies the left ~2/3 (up to ~1250px). The right third is for a bleeding number, a grid, or a
  frame — it is what stops the card looking like a webpage.
- Rows: 150px tall, separated by 1px `--ms-line`. Numbers in the left gutter, label next to it, value
  right-aligned to the 1808px line.
- Bars: track from x=430 to the right margin; fill grows from x=430.
- Safe area: keep captions and any text a viewer must read inside 1536x864 (80%).

## 4. Motion

Base vocabulary — five moves, nothing else.

| Move | Recipe | Where |
| --- | --- | --- |
| Slam | `fromTo(el, {opacity:.001, y:64, scale:1.06}, {opacity:1, y:0, scale:1, duration:.32, ease:"expo.out"})` | hero words, staggered `.06s` |
| Slide | `fromTo(el, {opacity:.001, x:-40}, {opacity:1, x:0, duration:.3, ease:"power3.out"})` | rows, supporting lines |
| Rule wipe | `fromTo(el, {scaleX:0}, {scaleX:1, duration:.36, ease:"power4.inOut"})` with `transform-origin: 0 50%` | underlines, dividers, callout lines |
| Push-in | `fromTo(root, {scale:1}, {scale:1.025, duration:<scene length>, ease:"none"})` | every card, so nothing is static |
| Flash | `fromTo(flash, {opacity:.5}, {opacity:0, duration:.16, ease:"power2.in"})` | chapter cards, hard cuts |

Rules:

- Durations live in 0.10-0.34s. A 0.6s entrance reads as a UI animation, not as this style.
- Eases: `expo.out`, `power4.out`, `power3.out`. `back.out` only on a small badge. **Never** elastic,
  bounce, or a spin-in.
- Stagger: `.05-.07s` inside one line, `.22s` between rows. A group must land as one beat.
- The scene's first element starts at 0, not at 0.2s — a cut shows content immediately.
- Everything enters; nothing exits. The cut does the exiting.
- Never animate `width`/`height`/`top`/`left`. Use `scale`, `x`, `y`, `clip-path`, `transform-origin`.

## 5. Cuts, transitions, rhythm

- **Hard cuts only** between cards. The 1-3 frame `--ms-flash` plus a whoosh is the transition.
- Within a card, change the frame with a camera move (push-in, GL-style zoom 1.0 -> 1.12 on a detail),
  never with a crossfade.
- Optional, sparingly: RGB split / glitch on the hook only (2-4 frames), speed ramp inside footage.

Timing by beat:

| Beat | Shot length | Text hold |
| --- | --- | --- |
| Hook | 0.6-1.5s per shot | 1.2-2s |
| Promise / chapter list | 2-3s | 2-3s |
| Chapter card | 1.2-2.0s | whole card |
| Explanation card | 2-4s | `chars x 0.22s + 0.6s` minimum |
| Data card | 3-5s | read-aloud time + 0.5s |
| Payoff | 0.5-1.0s per shot | 2-3s |
| Outro / CTA | 3-6s | 4-6s |

A 30s sample: 4s hook, 4s promise, 3.5s chapter, 7s data, 6.5s compare, 5s payoff.

## 6. Sound

| Element | Level | Where |
| --- | --- | --- |
| VO | 0 dB reference | always, when there is one |
| BGM | ~0.14 (26-30 dB under VO) | under everything, lifted 4-6 dB at the hook and the payoff |
| whoosh | 0.28 | every cut, ±0.35s |
| impact-bass | 0.30-0.34 | hook slam, payoff line. Twice per video, not more |
| click | 0.24 | a number landing, a chip appearing |
| riser | 0.25 | the 2-4s before the payoff, once |

- SFX peak 3-6 dB over the bed, never over the voice.
- Rotate at least two whoosh takes; the same file on every cut is the most audible tell.
- Never synthesise a tone or chime.

## 7. Do not

- Icon grids, three cards in a row, bullet lists, rounded-corner white cards.
- Centred text, drop shadows, glow on type, gradient text.
- More than two background gradients, or any gradient that reads as a "designed background".
- A card with no move, or a card longer than 9s with no internal change.
- Amber paragraphs, cyan prose, red used as decoration.
- Fake footage, fake screenshots, fake test rigs.
- The 影视飓风 logo, its exact brand assets, or a claim that the video is theirs.
