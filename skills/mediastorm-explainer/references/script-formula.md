# Script formula

The structure is fixed; only the topic changes. Every 影视飓风 explainer is the same five blocks, and
the viewer stays because each block answers the question the previous one raised.

```
钩子 Hook       0-8s      one claim that sounds wrong
承诺 Promise    8-20s     what you will see, three beats
章节 Chapters   20s-end   2-4 chapters, each four beats
爆点 Payoff      last 20%  the one number / one shot everything was for
收口 Outro       3-6s      the opinion, then the CTA
```

## 1. Hook (0-8s)

Pick **one** of these and do not explain it yet:

| Pattern | Shape | Example |
| --- | --- | --- |
| 反常识结论 | X ≠ what you think | `4K ≠ 更清楚` |
| 极端对比 | two numbers side by side | `这台 3000 块，这台 30000 块` |
| 具体问题 | a question the viewer has asked | `为什么你拍的视频，看起来总是"脏"？` |
| 极端条件 | a test nobody would run | `我们把它冻到 -40 度` |
| 损失厌恶 | what you are doing wrong | `你相机的 90% 性能，正在被浪费` |
| 时间/成本 | the effort behind it | `花了 18 个月，只为解决一个问题` |

Rules:

- 8-16 characters on screen. A number or a `≠` is a good hook.
- The first frame is a card, not a fade-in. Frame 0 is the thumbnail on every social platform.
- One sentence of VO, ≤20 字. It states the claim; it does not set it up.
- No "大家好，欢迎来到本期视频". The style never opens with a greeting.

## 2. Promise (8-20s)

- VO: `这期视频，我们用 N 个实验 / 三个问题，把它讲清楚。`
- On screen: the N beats as numbered rows, each 6-12 characters, each with a value or a promise in the
  right column (`手机只有 1/4`).
- The chapters named here must be the chapters that follow, in the same order.

## 3. Chapters — the four beats

Each chapter is 45-90s and has the same internal shape. On a 30s sample, each chapter is one card.

| Beat | Purpose | Length on screen |
| --- | --- | --- |
| ① 提问 | the sub-question this chapter answers, in the viewer's words | 1 sentence |
| ② 演示 | the physical thing: a test, a teardown, a screen, a rig | 2-4 sentences |
| ③ 数字 | one number that settles it, with a source line | 1 number + 1 line |
| ④ 小结 | the takeaway, ≤14 字, usually accented | 1 line |

Rules:

- One idea per chapter. If a chapter needs two numbers, it is two chapters.
- The 数字 beat is where the camera pushes in and the music lifts. Never bury it in the middle.
- The 小结 is a claim, not a summary: `像素不是画质`, not `以上是像素的说明`.
- Name the chapter with a number (`01`) and a claim — the chapter card is a designed 1.2-2s cut, not a
  title slide.

## 4. Payoff

Everything before it exists to make this one line land. It is:

- one sentence, ≤16 字, usually a reversal: `决定画质的，是进光量，不是分辨率。`
- the second of the two heaviest sound moments (the other is the hook)
- the only place the background glow can brighten

## 5. Outro (3-6s)

- Opinion in one line, then the ask. On B站: `点赞 · 投币 · 收藏`, or a next-episode line.
- No long credit roll, no subscribe animation, no "感谢观看" card longer than 2s.
- If the channel has a next-episode tease, name it: `NEXT / 02 进光量`.

## Voice-over rules

- **The voice is the clock.** Every scene's `data-start`/`data-duration` comes from reading the line
  aloud, not from a storyboard guess.
- 4.5-5.5 字/秒. A 30s video carries about 140-160 字 of VO; do not pack more in.
- One sentence = one idea = one shot. If a sentence spans two shots, split it.
- Conclusion first, explanation second: `手机的 4K 更糊。因为它把同样的光，分给了 4 倍的像素。`
- Numbers spoken as a person would: `四分之一`, then the on-screen says `1/4`.
- The last word of a VO line lands on the picture that proves it — time the card to the word, not the
  sentence start.

## Worked example (the starter project, 30s)

| t | Beat | On screen | VO |
| --- | --- | --- | --- |
| 0.0 | Hook | `4K ≠ 更清楚` | 手机拍的 4K，可能还不如相机的 1080P。 |
| 4.0 | Promise | `像素，不等于画质` + 3 rows | 我们用三个实验，把这件事讲清楚。 |
| 8.0 | Chapter 01 | `像素不是画质` | 先看一个数字。 |
| 11.5 | 数字 | `1/4` + two bars | 同样一英寸，手机的单像素只有相机的四分之一。 |
| 18.5 | 对比 | two pixel grids, red underline | 同一个像素，抓到的光差四倍。 |
| 25.0 | Payoff | `决定画质的，是进光量` / `不是分辨率。` | 所以，决定画质的，是进光量，不是分辨率。 |

## Checklist before building

- [ ] Hook is ≤16 characters and is a claim, not a greeting
- [ ] Promise names the exact chapters that follow
- [ ] Each chapter has all four beats, and one number
- [ ] Every number has a source line and a real source
- [ ] The payoff sentence is written before the middle chapters are
- [ ] Total VO length ÷ 5 ≈ total runtime
