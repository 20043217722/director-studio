# Dreambox 使用示例

## 例1：真人短剧全管线

用户输入：
> 我想拍一个3分钟的真人短剧，讲一个女孩在雨夜中偶遇一只受伤流浪猫
> 并决定带它回家的故事。风格参考岩井俊二的《情书》。

Codex 执行流程：

### Step 1: 导演 — 故事开发 + 分镜脚本

读取 `agents/director.md`，注入导演 system prompt，输入用户想法。
导演输出：
- 故事驱动三问（欲望·阻碍·代价）
- 完整剧本
- 分镜脚本（含每镜的景别/机位/运动/时长/画面/光影/台词/音效）
- 资产分发清单

### Step 2: 创建 libtv 画布

```bash
mkdir rain-cat-short-film && cd rain-cat-short-film
libtv workspace use 2658324
NEW=$(libtv project create "雨夜与猫-真人短剧" -d "3分钟真人短剧，风格参考岩井俊二" | jq -r '.projectMeta.uuid')
libtv project use "$NEW"
```

### Step 3: 写入剧本和分镜

```bash
# 创建前期策划分组
libtv group create "前期策划区"

# 剧本节点
libtv node create "剧本" -t script --prompt "<导演生成的剧本>"

# 分镜脚本节点
libtv node create "分镜脚本" -t storyboard --prompt "<分镜表内容>"
```

### Step 4: 并行调用各专业智能体

```bash
# 读取 agents/character.md，以人物造型智能体身份生成角色方案
libtv node create "人物造型-女主角" -t image \
  -s "model=Lib Image" \
  --prompt "<人物造型智能体输出的图片生成提示词>"

# 读取 agents/scene.md，生成场景设计
libtv node create "场景-雨夜街道" -t image \
  -s "model=Lib Image" \
  --prompt "<场景设计智能体输出的场景提示词>"

# 读取 agents/cinematography.md，生成关键帧提示词
libtv node create "摄影指导-分镜1" -t image \
  -s "model=Lib Image" \
  --prompt "<摄影指导输出的关键帧提示词>"

# 读取 agents/motion.md，生成视频运动提示词
libtv node create "视频-分镜1" -t video \
  -s "model=可灵O1" \
  --prompt "<剧幕文戏输出的视频提示词>" \
  --left "摄影指导-分镜1"

# 读取 agents/sound.md，生成声音方案
libtv node create "声音设计" -t audio --prompt "<声音设计智能体输出的方案>"
```

### Step 5: 连线

在画布上手动或通过 CLI 连线：导演 → 各专业节点 → 生成节点

### Step 6: 汇报

```
画布已创建: https://www.liblib.tv/canvas?projectId=<uuid>
```

---

## 例2：单智能体 — 只有场景设计需求

用户输入：
> 帮我设计一个赛博朋克风格的东京小巷场景

Codex 读取 `agents/scene.md`，注入场景设计 system prompt，生成场景方案。
如果用户需要，创建 libtv image 节点写入生成的提示词。

---

## 例3：已有剧本，跳过导演

用户输入：
> 我有一段现成的剧本，帮我做人设和场景设计，剧名《冰河追凶》

Codex 跳过导演智能体，直接读取 `agents/character.md` 和 `agents/scene.md`，
从剧本中提取角色和场景信息，依次调用两个智能体。
