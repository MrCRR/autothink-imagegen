# Production: voice, subtitles, data, delivery

## 1. Why there is no music

Measured on the channel's own uploads: the mix is **speech only** — the gaps between sentences are silent
all the way down the spectrum, with no bed underneath. That is unusual and it is part of the identity: it
reads as a research call, not as a produced show.

- Keep it silent under the VO. If the person insists on music, `~0.10-0.14` and never under the first or
  last sentence.
- SFX only where something lands: a whoosh on a cut, a pop on a number. `style-system.md` §6.

## 2. Voice-over

Order of preference:

1. **Recorded** by the person: mono 48k. The delivery is 口播 — conversational, conclusion first.
2. **Local TTS** for a timing draft:
   `npx hyperframes tts --voice zf_xiaobei --lang zh "<line>" -o assets/vo/01.wav`
   Say plainly that it is a placeholder; the channel's appeal is the voice.
3. **None**: rare here. If there is no VO, the subtitles carry the clock and every card must hold for
   `0.5s + 0.3s per word`.

Pace: 4.5-5.5 字/秒. A 20-minute film is about 5,000-6,000 characters. If a section is short on time, cut
a sentence, do not speed up the read.

## 3. Subtitles

The burned-in line is mandatory — it is the most recognisable element after the palette.

```bash
# 1) 拿到时间轴：录音稿自己标，或转写
npx hyperframes transcribe assets/vo/01.wav --model small --language zh --to srt

# 2) 生成字幕轨（一行、≤24 字、按字数分配时间）
node "<SKILL_DIR>/scripts/subtitles.mjs" vo.srt --out compositions/subtitles.html
```

- The generator splits at `，。、；：！？`, caps a line at 24 characters, and spreads a cue's window by
  character count. It writes plain `.clip` groups — no tweens, hard cut in and out.
- `--max-chars` when the script is mostly Latin or the font is wider; `--id` if the composition id
  collides; `--dark` only if a project inverts the subtitle style (this house does not).
- Mount it once, across the whole film:

```html
<div id="subs-host" data-composition-id="subs" data-composition-src="compositions/subtitles.html"
     data-start="0" data-duration="43" data-track-index="8" data-track-kind="captions"
     data-width="1920" data-height="1080"></div>
```

- Read a frame at the densest line before rendering: one line, inside the safe area, never over a chart's
  axis labels.

## 4. Data honesty

This is a finance channel. The style is confident; the obligations are not optional.

- Every number on screen has a source line: `图：<来源> / <口径> / <时间范围>`.
- If you did not have a real figure, use an illustrative one **and label it** `示意图 / 非真实标的`. The
  starter project does exactly this.
- No target prices, no "now is the bottom", no return promises, no personalised advice.
- State the bear case in every analysis; a film without a 风险 beat is not this style.
- The last frame carries `科普内容，不构成投资建议`. `style-lint` fails a project without it.

Charts: build them in SVG inside the slide (bars, lines, ranges) so they are deterministic and restyle
with the tokens. Do not screenshot a live terminal; a static, labelled chart is more credible and renders
identically every time.

## 5. Assets

- Cartoon figures and 3D props are what make the deck feel like the channel. If you have them, put PNGs in
  `assets/figures/` and place them bottom-left at 380-460px tall. If not, do not draw a fake one — use a
  diagram instead. The skill never generates a person.
- Logos: only with rights; never redraw a brand mark.
- Fonts: `assets/fonts/` ships Noto Sans SC (deck, subtitles) and ZCOOL KuaiLe (handwriting), both
  SIL OFL. Need a rare character? `node "<SKILL_DIR>/scripts/setup-fonts.mjs" . --text "那几个字"`.

## 6. Delivery checklist

- [ ] `node <SKILL_DIR>/scripts/style-lint.mjs .` — 0 errors
- [ ] `npx hyperframes check --json` — 0 errors, warnings weighed
- [ ] Snapshot every scene midpoint; no clipped text, nothing under 28px
- [ ] Subtitles regenerate after the final script edit
- [ ] Corner mark on every scene, correct variant on the whiteboard
- [ ] Source line under every number; 风险 beat present; disclaimer on the last frame
- [ ] Every cut has a whoosh; nothing but VO under the speech
- [ ] Thumbnail rendered from `thumbnail/` and checked at 320px wide
- [ ] `npx hyperframes render --quality looks --output out.mp4`, then `ffprobe` duration matches the root
      `data-duration`
- [ ] Say which parts are cards vs. would need the channel's real footage/figures to reach the original
