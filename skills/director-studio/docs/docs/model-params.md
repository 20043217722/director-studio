# libtv 模型参数参考表

不同模型的可接受参数值不同。写 --set/--prompt 前参考此表。

## 图片模型

| 模型 | quality | ratio | resolution |
|------|---------|-------|------------|
| Lib Image | medium, 2K | 1:1, 3:4, 4:3, 9:16, 16:9 | 1K, 2K |
| Lib Navo Pro | 2K, 4K | 同上 | 2K, 4K |
| Lib Navo 2 | 2K | 同上 | 2K |
| Seedream 5.0 Pro | 2K, 3K | 同上 | 2K, 3K |
| Seedream 5.0 Lite | 2K, 3K | 同上 | 2K, 3K |
| Seedream 4.6 | 2K | 同上 | 2K |

## 视频模型

| 模型 | duration | ratio |
|------|----------|-------|
| Seedance 1.0 Pro | 5, 8, 10s | 16:9 |
| Seedance 2.0 VIP | 5, 8, 10, 15s | 16:9 |
| Hailuo 2.3 | 5, 6, 8s | 16:9 |
| Kling 3.0 | 5, 10s | 16:9 |
| Kling 3.0 Turbo | 5, 10s | 16:9 |

## 常见错误

- Seedream Lite 写 `quality=medium` 会报错，应写 `quality=2K`
- 视频 duration 必须是模型支持的离散值，不能写 7s 或 12s
- ratio 值用冒号格式: `16:9`, `3:4`，不能用 `16/9` 或 `1.78`
