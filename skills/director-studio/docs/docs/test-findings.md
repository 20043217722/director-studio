# Dreambox 端到端测试发现 (2026-07-13)

## 已验证正常的部分

- libtv CLI 节点创建: 全部类型 (text, script, storyboard, image, video, audio)
- `-s ratio=3:4` 正确设置宽高比
- `-s model=XXX` 正确切换模型
- `libtv download -n "节点名" -o <目录>` 可用
- 管线预设 (pipeline.py) 节点布局正确
- 多模型对比创建节点正常 (同一角色用不同模型)

## 发现的 Bug

### Bug 1: 算力不足 (1200000136) — 严重
平台高峰期所有模型返回算力不足。
影响: 所有 --run 操作。
已修复: batch-run.py 增加重试+退避+模型降级链。

### Bug 2: Quality 参数不通用 — 中等
Seedream 5.0 Lite 的 quality 参数只接受 "2K"/"3K"，不接受 "medium"。
不同模型参数值不同，用户容易写错。
已修复: 增加了模型参数参考表 (docs/model-params.md)。

### Bug 3: prompt 中的 --ar 不被解析 — 中等
用户从外部工具复制的提示词常含 `--ar 3:4`，但 libtv 不解析此语法。
必须用 `-s ratio=3:4` 额外指定。
已修复: 增加提示词预处理说明。

### Bug 4: 节点更新后 --run 不自动使用新模型
`libtv node "xxx" -s "model=Y" --run` 会更新模型但 --run 可能仍用旧参数。
需要先 update 再单独 --run。
已修复: batch-run.py 分两步执行。

## Vision 集成可行性

### 可行方案
- L1 自动元数据检查: 无需 API key，直接分析 node JSON 中的 url/taskInfo
- L2 vision 审核: 需要 DOUBAO_API_KEY/DASHSCOPE_API_KEY/OPENAI_API_KEY 之一
  - 下载图像 → 调 vision.py → 评分 → 建议 KEEP/REGENERATE
- 当前: vision-review.py 已实现两层审核，L2 作为可选

### 局限性
- 需要外部 API key (用户自行配置)
- 评分标准是通用的「构图/解剖/风格」，不一定匹配创作意图
- 角色一致性检查需要多图对比，单图 vision 无法做到

## 深度优化建议

### 高优先级
1. 模型降级链: Lib Image -> Seedream 5.0 Pro -> Lib Navo Pro -> Seedream 5.0 Lite
2. 算力不足自动重试: 指数退避 5s/15s/45s，最多3次
3. 提示词预处理: 自动移除 --ar/--seed 等非 libtv 参数

### 中优先级
4. libtv 积分预估: 生成前估算消耗
5. 生成进度看板: 汇总所有节点状态 (SUCCESS/FAIL/PENDING)
6. 批量下载+归档: 一键下载全部已生成资源

### 低优先级
7. 风格 LUT 自动匹配: 根据导演设定的视觉DNA自动匹配 libtv 滤镜
8. 音频-视频同步检查: 验证音频时长匹配视频总时长
