# Thumbnail

The channel's thumbnails are a fixed system, not one-off art. 1280x720, one line of type, two
coloured keywords, a cinematic background, a corner badge.

## Layout

| Element | Position (1280x720) | Spec |
| --- | --- | --- |
| Background | full bleed | cinematic image or gradient: cool dark base + a warm gold/teal glow. Never flat. |
| Black band | left 0, top ~90, width 1010, height 150 | pure black, no radius. Holds the headline. |
| Headline | left 150, top 104 | one line, 88-96px, 900 weight, white |
| Keywords | inline in the headline | **yellow `#FFD400`** for attention, **green `#35C46B`** for opportunity, **red `#E5342A`** for risk |
| Badge | left 30, top 22, 104px circle | green disc + one character + a small red play block. This is the channel's identity chip — replace it with the brand's own mark, never copy theirs. |
| Chart / arrow | right 40, bottom 34, 520x300 | 6-7px gold line, optional hand-drawn white arrow pointing at the thesis |
| Source note | left 44, bottom 30 | 28px, ~70% white: `示意 / 非真实标的` when numbers are illustrative |

## Rules

- **One line.** If it needs two lines, the claim is not sharp enough. 8-16 characters is the sweet spot.
- **Two colours maximum** in the type. The base is white; colour marks the two words that flip the meaning.
- The image is a **metaphor, not a screenshot**: a storefront for a retail stock, a chip for semis, a
  falling arrow for a drawdown. Real chart screenshots belong inside the video, not on the thumbnail.
- The face is optional and usually absent; the object and the words carry it.
- Text sits on black so it survives any background. Never put type straight onto a busy photo.
- Check the 320px-wide result: at that size the headline must still read as three or four blocks.

## Rendering it

`templates/thumbnail/` is a standalone 1280x720 HyperFrames project:

```bash
cd thumbnail
npx hyperframes snapshot --at 0.4      # → .hyperframes/artifacts/snapshots/<id>/frame-*.png
```

It is a composition, not a picture, so the text stays in a font you control and the layout is
reproducible. Keep the background as CSS gradients, or drop a generated/stock image into
`assets/background.jpg` and put it behind `.hero`.

## Copy patterns that age well

| Pattern | Example |
| --- | --- |
| 反常识 + 数字 | `PE 低，就是便宜？` |
| 极端对比 | `3000 块 vs 30000 块` |
| 结果前置 | `跌了 30%，反而是机会？` |
| 大众误区 | `90% 的人看错了这张图` |
| 时间压力 | `这次不一样？` |

Do not write a price target or a promised return into a thumbnail — it is a claim the video cannot keep.

## Compliance

- No fabricated numbers, logos you do not have rights to, or another channel's brand mark.
- If the number is illustrative, the source note says `示意`.
- Do not imply the thumbnail, video or channel belongs to 美投讲美股.
