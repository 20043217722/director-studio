# 导演工作室 Director Studio

AI驱动的影视创作桌面应用。整合**导演、剧本医生、美术指导、后期总监**四大智能体，覆盖从创意到后期的全流程。

## 智能体

| 智能体 | 能力 |
|--------|------|
| 导演 | 分镜设计 · 剧本创作 · 预算通告 · 连续性审查 |
| 剧本医生 | 四层诊断 · 逐句修改 · 健康度评分 |
| 美术指导 | 视觉概念 · 色彩体系 · 场景服装设计 |
| 后期总监 | 剪辑策略 · 调色方案 · 声音设计 · VFX规划 |

## 支持的AI模型

DeepSeek · OpenAI · Claude · 通义千问 · GLM · Kimi · 自定义

## 技术栈

React 18 · Vite 5 · Tailwind CSS 3 · Electron 28

## 安装使用

```bash
# 安装依赖
npm install

# 开发模式（浏览器）
npm run dev

# 桌面应用
npm run electron:dev

# 打包
npm run electron:build
```

## 文件支持

导入：PDF / DOCX / PPTX / XLSX / 图片

导出：分镜表 · 剧本 · 预算表 · 通告单

## Claude Code Skill

本仓库同时是一个 Claude Code 插件。安装：

```
/plugin install github.com/holo-cat/director-studio
```

安装后在 Claude Code 中使用 `/导演` `/剧本医生` `/美术指导` `/后期总监` 命令启动对应智能体。

## License

MIT
