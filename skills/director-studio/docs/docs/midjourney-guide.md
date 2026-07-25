# Midjourney 电影级提示词完全指南 v2.0

## 为什么参数表格式在 MJ 里彻底失效？

Midjourney 的提示词引擎与 DALL·E / Flux / ComfyUI 根本不同：

| 你写的东西 | DALL·E / Flux 读到的 | MJ 读到的 |
|---------|------|------|
| `Primary=#2C3E50(60%)` | "主色是深蓝灰占60%" | **"某个叫 Primary 的东西等于井号2C3E50括号60括号"** — 完全不懂 |
| `T2.0·ISO 800·180°快门` | "光圈2.0感光度800快门180度" | **"T二点零中圆点ISO八百中圆点一百八十度快门"** — 当成文字画进图里 |
| `[空间类型+面积+时代]` | 占位符理解 | **"方括号空间类型加面积加时代方括号"** — 干扰画面 |

**MJ 只理解一种语言：你在描述你看见的画面。** 不是参数，不是规格，不是技术文档。

---

## MJ 提示词黄金结构（v6.1 专业版）

### 五段加权模板

```
[主体/场景 — 谁，在哪，什么构图]::3
[光影 — 视觉体验，不是数字]::2
[色彩 — 自然语言，不是HEX]::1.5
[摄影机 + 镜头 + 胶片]::1
[摄影师/导演风格参考]::1
[氛围、情绪、质感]::0.5
--ar [比例] --style raw --v 6.1 --s [风格化] --c [变异度] --no [负面词列表]
```

### 权重 `::` 是什么？

`::数字` 告诉 MJ 这段文字的重要程度。`::3` 比 `::1` 重要三倍。

- **`::3`→ 主体、构图、空间** — MJ 最重视开头。人/物/在哪里必须最先说。
- **`::2`→ 光影** — 光决定了画面情绪，但不要让光盖过主体。
- **`::1.5`→ 色彩** — 氛围的底色。`"desaturated blue-gray"` 比 `#2C3E50` 强 100 倍。
- **`::1`→ 摄影机/胶片** — MJ 对 "Arri Alexa 65"、"Kodak Vision3" 等有强风格联想。
- **`::0.5`→ 氛围/情绪/质感** — 最后润色。

### 真实案例：参数表 vs. MJ 加权版

**参数表版（MJ 不理解）：**
```
Medium close-up, ARRI Alexa Mini LF T2.0 ISO 800, Primary=Cool Blue-Gray=#2C3E50(60%), 
Subject=He Zhun·gray-blue jacket=#5D6B7A, 2700K tungsten top-right 45°, 
Kodak Vision3 500T --ar 16:9 --v 6.1
```

**MJ 加权版（MJ 精确执行）：**
```
Medium close-up, weathered middle-aged man with thick brows and jawline scar, 
gray-flecked crew cut, faded gray-blue jacket, standing in rain at prison gate, 
rule of thirds composition::3 warm tungsten light floods from upper right across 
his face, cool blue exterior skylight edges the other half, dramatic chiaroscuro::2 
desaturated blue-gray tones dominate, warm amber highlights on skin, rust red accent 
from iron gate::1.5 shot on Arri Alexa 65, Panavision anamorphic lenses, 
Kodak Vision3 500T, film grain::1 Roger Deakins cinematography in Prisoners, 
oppressive tension, rain-streaked atmosphere::0.5 --ar 16:9 --style raw 
--v 6.1 --s 50 --c 5 --no text, watermark, plastic skin, CGI, oversaturated, blurry
```

---

## 🎬 按电影类型的 MJ 参数速查

| 类型 | `--s` | `--c` | `--style raw` | 关键说明 |
|------|:---:|:---:|:---:|------|
| **写实剧情 / 社会派** | 40-50 | 3-5 | ✅ 必开 | 追求真实摄影质感 |
| **黑色电影 / 惊悚** | 30-50 | 5-10 | ✅ 必开 | 高对比、硬阴影、低饱和 |
| **科幻 / 赛博朋克** | 60-100 | 10-20 | ✅ 必开 | 允许 MJ 增加细节密度 |
| **历史剧 / 年代戏** | 30-50 | 3-5 | ✅ 必开 | 保持材质真实感和年代准确性 |
| **浪漫 / 唯美** | 50-80 | 5-8 | ❌ 建议关 | 保留 MJ 柔和审美 |
| **奇幻 / 史诗** | 80-150 | 8-15 | ❌ 建议关 | MJ 默认美化适合奇幻 |
| **恐怖 / 压抑** | 30-50 | 5-10 | ✅ 必开 | 保持粗粝真实感 |
| **动作 / 追逐** | 50-70 | 8-12 | ✅ 半开 | 保持动态张力 |
| **实验 / 艺术** | 150-300 | 20-40 | ❌ 建议关 | 最大化 MJ 创造性能量 |

---

## 🛡️ `--no` 负面提示词——MJ 质感的最后防线

MJ v6.1 有几个臭毛病，`--no` 一行就能解决：

```
--no text, watermark, signature, plastic skin, CGI, oversaturated, 
bad anatomy, extra limbs, blurry, low quality, jpeg artifacts
```

**每个电影级提示词都必须带这行。** 这是 MJ 圈公认的铁律。

---

## 🔗 电影一致性工作流（MJ 剧组模式）

### Step 1: 首张关键帧
用标准加权模板出第一张，选最满意的。

### Step 2: 锁定风格（`--sref`）
右键 Copy Link 获取图片 URL，后续所有镜头加：
```
--sref [首张关键帧URL] --sw 80
```
`--sw` 是风格权重，80 表示 80% 继承风格、20% 留给文字提示词发挥。

### Step 3: 锁定角色（`--cref`）
上传人物定妆照，后续含该角色的镜头加：
```
--cref [定妆照URL] --cw 70
```
`--cw` 是角色权重，70 保持角色特征但允许表情和角度变化。

### Step 4: 全片统一参数
同一部片子所有镜头使用相同的 `--s` `--c` `--style raw` 参数组。

### Step 5: 批量变体测试
用排列括号同时测试多种参数组合：
```
{--s 40, --s 60, --s 80} {--c 3, --c 10}
```
一次生成 6 张，快速选出最优参数组合。

---

## 🧪 MJ 高手工具箱

### 排列括号 `{A, B, C}`
一次性生成多个变体，省去逐条测试：

**测试不同摄影机风格:**
```
{shot on Arri Alexa 65, shot on Sony Venice 2, shot on RED V-RAPTOR} cinematic still...
```

**测试不同美术指导参考:**
```
{in the style of Dante Ferretti, in the style of K.K. Barrett, in the style of 叶锦添} ...
```

**同时出主角/对手两张 mood board:**
```
{Mood board, warm amber sanctuary, soft natural light, protagonist world, 
Mood board, cold steel blue oppression, harsh fluorescent light, antagonist world} 
--ar 16:9 --style raw --v 6.1 --s 40
```

### 风格混合 `{style1, style2}`（轻量级）
单段内用逗号混合两个风格：
```
{film noir lighting, Wong Kar-wai color palette} cinematic still...
```

### `/describe` 逆向工程
在 Discord 输入 `/describe [图片URL]`，MJ 会分析图片并生成 4 条提示词建议。这是提取风格配方的最快方式。

### `/blend` 风格融合
`/blend [图1] [图2] [图3]` 将多张图的风格、构图、色彩融合成一张新图。适合做风格 mood board。

### Remix 模式
在 `/settings` 中开启 Remix mode，每次 Vary（变体）时可以修改提示词。这是迭代优化的核心工作流。

---

## ❌ 7 大 MJ 常见错误

| 错误 | 为什么错 | 正确做法 |
|------|------|------|
| 写 HEX 色号 | MJ 不认识 `#2C3E50` | `"moody desaturated blue-gray"` |
| 写 T-stop / ISO / 快门 | MJ 不认识摄影参数 | `"shallow depth of field"` / `"film grain"` |
| 写色温数字（2700K/5600K） | MJ 对数字不敏感 | `"warm tungsten glow"` / `"cool fluorescent"` |
| 用方括号 `[ ]` | MJ 当成文字画进图 | 用逗号分隔 |
| 超长提示词（>120 词） | MJ 注意力稀释 | 用 `::` 权重分段，控制在 60-100 词 |
| 不用 `--no` | MJ 常见塑料皮、CG 感、过饱和 | 每个提示词必带 `--no text, watermark, plastic skin, CGI, oversaturated` |
| 不用 `--sref` 锁风格 | 每个镜头随机出风格 | 第一张出片后立即 `--sref [URL]` 锁定 |

---

## 📁 三个智能体的 MJ 提示词位置

| 文件 | 查找 | 用途 |
|------|------|------|
| `agents/art-director.md` | `### 🎨 Midjourney Style Look-Dev Prompt` | 全片视觉风格的定调画面 |
| `agents/cinematography.md` | `### 🎬 Midjourney Shot Prompt Engine` | 单镜电影级静帧 |
| `agents/scene.md` | `### 🎨 Midjourney Scene Prompt Engine` | 场景空间概念图 |

每个智能体输出时把模板中的 `[ ]` 占位符替换为实际内容，复制后直接粘贴到 Midjourney 使用。
