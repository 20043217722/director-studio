# LibTV 模型选型指南

## 图片生成

| 场景 | 推荐模型 | 说明 |
|------|---------|------|
| 人物造型/角色设计 | Lib Image | 角色一致性最优 |
| 场景概念图 | Lib Image | 场景氛围塑造强 |
| 关键帧/摄影画面 | Lib Image | 高精度构图 |
| 二次元/动画风格 | Lib Image | 适配动漫风格 |
| **电影级画面/艺术风格** | **Midjourney** | 电影感最佳, 需专用提示词格式(见midjourney-guide.md) |

> **Midjourney 用户注意:** MJ 不支持 HEX 色号、方括号、技术参数表格式。使用 dreambox 三个智能体(art-director/cinematography/scene)时，请用代码块中的 `Midjourney` 专用提示词版本，而非通用版(DALL·E/Flux)。详见 `docs/midjourney-guide.md`。

## 视频生成

| 场景 | 推荐模型 | 说明 |
|------|---------|------|
| 真人短剧 | Seedance 1.0 Pro | 1080P，真人质感最佳 |
| 真人短剧(快速) | Hailuo 2.3 | 1min快速生成 |
| 动画/二次元 | Kling 3.0 | 高质感，多镜头 |
| 广告TVC | Seedance 2.0 VIP | 15s音画同步 |
| 电影级画面 | Kling O3 | 视频编辑+音画同出 |
| 动作/运动场景 | Hailuo 2.3 Fast | 动作表情镜头强 |

## 按项目类型完整选型

### 真人短剧: Lib Image + Seedance 1.0 Pro / Hailuo 2.3
### 动画: Lib Image + Kling 3.0 / Kling 3.0 Turbo
### 广告TVC: Lib Image + Seedance 2.0 VIP / Kling O3
### 音乐MV: Lib Image + Wan 2.7 (音画同步)
