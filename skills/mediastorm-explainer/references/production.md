# Production: footage, voice, sound, delivery

## 1. Aspect and safe areas

| Target | Canvas | Notes |
| --- | --- | --- |
| B站 / YouTube | 1920x1080 | default. Margins 112px. |
| 抖音 / 视频号 | 1080x1920 | re-lay out, do not scale down. 72px side margins, type 30-40% smaller in px but the same visual weight. |

Captions and any line a viewer must read stay inside the 80% title-safe box (1536x864 on 16:9).
Studio draws the guides — never add your own.

## 2. Footage

The style is 60% footage. If the person has it:

- Place it under the cards as a full-bleed `<video>` (`muted`), or inside a card as a framed plate.
- Grade through the CLI, never with CSS filters:
  `npx hyperframes media-treatment` (`/media-use` → `references/media-treatments.md`). The house look is
  a cool-shadow / warm-highlight grade, slight contrast lift, mild vignette.
- If there is no footage, say so and build the card film. Do not invent a test rig in CSS and imply it
  is a real test.

Framing that matches the style: long lens, shallow depth of field, macro detail, top-down desk shots,
90-120fps slow motion for the reveal. A card over footage should occupy the lower-left third, never the
centre.

## 3. Voice-over

Three routes, best first:

1. **Recorded**: the person's own voice. Ask for a mono WAV/48k per chapter; the style is conversational,
   conclusion-first, 4.5-5.5 字/秒.
2. **Local TTS**: `npx hyperframes tts --voice zf_xiaobei --lang zh "<line>" -o assets/vo/01.wav`
   (Kokoro on device). Good enough to time the cut; tell the person it is a placeholder.
3. **None**: the type carries it. Then every card's hold time = `0.5s + 0.3s per word`, and the
   sound design gets more weight.

Timing procedure: generate VO first, read the real durations, then set `data-start`/`data-duration` on
the scene hosts. Never stretch audio to fit a storyboard.

## 4. Sound design

Minimum for a 30s card film (already wired in the starter project):

- whoosh on every cut (±0.35s before it, so the hit lands with the new picture)
- impact-bass on the hook and the payoff only
- click when a number or a chip lands
- riser into the payoff, once

More: `style-system.md` §6. Source SFX via `/media-use` (`--type sfx`, Pixabay/Openverse/bundled). BGM
via the person's own track first, else `/media-use` `--type bgm`.

Levels: VO 0 dB reference, BGM ~0.14, SFX 0.24-0.34, nothing above -1 dBTP, mix -16 to -14 LUFS for
social. Verify with `npx hyperframes audio <file> --json` after a render and report it as measured, not
heard.

## 5. Captions

- Burn-in for 抖音 / 视频号, SRT for B站.
- 1-2 lines, ≤16 字 per line, `--ms-ink` on a 60% `--ms-paper` scrim, 40-44px, bottom-centre inside the
  safe area.
- Word-level highlight only for the emphasis word: `--ms-amber`. Never highlight every word.
- `npx hyperframes transcribe` gives word timings if a VO exists.

## 6. Delivery checklist

- [ ] `node <SKILL_DIR>/scripts/style-lint.mjs .` — 0 errors
- [ ] `npx hyperframes check --json` — 0 errors, warnings weighed
- [ ] Snapshot at the midpoint of every scene looked at, text not clipped, nothing under 28px
- [ ] First frame is a card, not a background
- [ ] Every cut has a whoosh; impact exactly twice
- [ ] Source line on every data card
- [ ] `npx hyperframes render --quality looks --output out.mp4`, then `ffprobe` duration matches the
      root `data-duration`
- [ ] Say plainly which parts are cards and which would need real footage to reach the real thing
