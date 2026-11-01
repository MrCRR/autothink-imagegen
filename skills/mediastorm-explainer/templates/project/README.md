# MediaStorm starter project

A 30s, 16:9 card film that demonstrates the whole style system. Replace the copy, keep the structure.

## What is here

```
index.html                 root composition: tokens, fonts, scene hosts, SFX
compositions/
  s01-hook.html            giant claim + amber rule
  s02-promise.html         three numbered rows
  s03-chapter.html         outlined 01, chapter title
  s04-data.html            1/4 + two comparison bars
  s05-compare.html         split frame, pixel grids, red callout
  s06-outro.html           payoff + CTA
assets/fonts/              Noto Sans SC VF subset (GB2312 L1 + symbols) + coverage map
assets/sfx/                whoosh / impact / click (Pixabay licence, no attribution required)
SCRIPT.md                  the beat sheet — fill this before editing HTML
```

## Run it

```bash
npx hyperframes check --json        # contract + layout + contrast
npx hyperframes preview --background
npx hyperframes snapshot --at 2.4,6.0,9.8,14.2,21.2,27.6
npx hyperframes render --quality looks --output out.mp4
```

## Change it

- Colours, fonts and spacing live in `index.html` `:root` (`--ms-*`). Never hard-code a hex in a scene:
  `style-lint` fails it, on purpose.
- Text in the right-hand value columns is the part a person usually rewrites first.
- Scene timing is the `data-start` / `data-duration` on each host in `index.html`. Change those and add
  the matching whoosh in the audio block below.
- Missing a character in the font? `node scripts/setup-fonts.mjs . --text "你的生僻字"`.
- Extra scene types (quote card, spec table, before/after, product callout, timeline, verdict stamp):
  `references/scene-library.md`.

## Licences

- Font: Noto Sans SC, SIL Open Font License 1.1 — see `assets/fonts/OFL.txt`.
- SFX: Pixabay Content License — see `assets/sfx/CREDITS.md`.
