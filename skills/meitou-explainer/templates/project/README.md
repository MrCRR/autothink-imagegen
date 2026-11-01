# 美投君式财经讲解 · 起始项目

43 秒、16:9 的风格样片：深色幻灯片 + 一段手绘白板 + 烧录字幕 + 角标 + 音效。
换文案，留结构。

## 文件

```
index.html                根合成：设计令牌、字体、7 个场景、字幕轨、音效
compositions/
  s01-title.html          本期卡
  s02-hook.html           钩子（红字冲突 + 仪表盘）
  s03-section.html        章节卡 01
  s04-whiteboard.html     手绘白板：PE 公式 + 红圈 + 图章
  s05-data.html           数据卡：四类行业的 PE 对比
  s06-verdict.html        判断：三步过筛
  s07-end.html            收口 + 免责声明
  subtitles.html          字幕轨（由 vo.sample.srt 生成，别手改）
vo.sample.srt             口播时间轴示例
assets/fonts/             Noto Sans SC（幻灯片/字幕）+ ZCOOL KuaiLe（手写）
assets/sfx/               whoosh / pop
thumbnail/index.html      1280x720 缩略图（独立项目，有自己的字体子集）
```

## 运行

```bash
npx hyperframes check --json
npx hyperframes preview --background
npx hyperframes snapshot --at 2,6.5,12,17.8,30.5,35,40.5
npx hyperframes render --quality looks --output out.mp4

cd thumbnail && npx hyperframes snapshot --at 0.4 && cd ..
```

## 改

- 颜色/字号全部走 `index.html` 的 `:root` 令牌；场景里写死 hex 会被 `style-lint` 拦下。
- 场景时长 = `index.html` 里每个 host 的 `data-start` / `data-duration`；改完记得同步音效切点。
- 字幕：改 `vo.sample.srt`，然后
  `node <SKILL_DIR>/scripts/subtitles.mjs vo.sample.srt`。
- 字体缺字：`node <SKILL_DIR>/scripts/setup-fonts.mjs . --text "生僻字"`。
- 更多场景原型（图表截图卡、A/B 对比、三档情景、流程图、循环图）：见 `references/scene-library.md`。

## 合规

- 每个数字都要有来源；示意图要标「示意图」。
- 不给目标价、买卖点位、收益承诺。
- 片尾必须有「不构成投资建议」。
- 字体为 SIL OFL；音效来自 Pixabay（见 `assets/sfx/CREDITS.md`）。
